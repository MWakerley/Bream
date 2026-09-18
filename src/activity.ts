import { formatDate } from './views/rota.js';

/**
 * What has changed lately, for the top of the home page.
 *
 * The case that started this: somebody says on their own page that they cannot
 * preach on the 20th, and nobody finds out until somebody notices the gap. A
 * change like that needs to reach the person who can do something about it, and
 * the home page is the only screen everybody opens.
 *
 * Built from five small queries merged in JavaScript rather than one UNION.
 * D1 refuses a compound SELECT of even eight terms, and merging here also lets
 * each source keep the columns that make sense for it instead of being bent
 * into one shape.
 */

export interface ActivityItem {
  /** SQLite datetime, UTC. Only used for ordering and for "3 days ago". */
  when: string;
  icon: string;
  tone: 'bad' | 'warn' | 'ok' | 'navy';
  /** Who did it. Shown in bold. */
  who: string;
  /** What they did, as a sentence continuing from the name. */
  what: string;
  /** Where it matters, if there is somewhere to go. */
  href?: string;
  /** The area this belongs to, so somebody is never shown a link that refuses them. */
  area: string;
}

export async function recentActivity(
  db: D1Database,
  areas: Set<string>,
  limit = 8,
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  // 1. Somebody saying they cannot do something. The reason this exists.
  if (areas.has('rota')) {
    const { results } = await db
      .prepare(
        `SELECT cr.created_at, cr.kind, cr.status, cr.message,
                p.display_name, r.name AS role_name,
                s.id AS service_id, s.service_date
           FROM change_requests cr
           JOIN people p      ON p.id = cr.person_id
           JOIN assignments a ON a.id = cr.assignment_id
           JOIN roles r       ON r.id = a.role_id
           JOIN services s    ON s.id = a.service_id
          ORDER BY cr.created_at DESC
          LIMIT 12`,
      )
      .all<any>();
    for (const r of results) {
      const when = formatDate(r.service_date);
      items.push({
        when: r.created_at,
        icon: r.kind === 'cannot_do' ? '⚠️' : '🔄',
        tone: r.status === 'open' ? 'bad' : 'ok',
        who: r.display_name,
        what: r.kind === 'cannot_do'
          ? `cannot do ${r.role_name} on ${when}${r.status === 'open' ? ' — still needs somebody' : ''}`
          : r.kind === 'swap'
            ? `has asked to swap ${r.role_name} on ${when}`
            : `left a note about ${r.role_name} on ${when}`,
        href: `/app/rota/service/${r.service_id}`,
        area: 'rota',
      });
    }
  }

  // 2. Somebody saying when they are away.
  if (areas.has('rota')) {
    const { results } = await db
      .prepare(
        `SELECT u.created_at, u.from_date, u.to_date, u.reason, p.display_name
           FROM unavailability u JOIN people p ON p.id = u.person_id
          WHERE u.to_date >= date('now')
          ORDER BY u.created_at DESC
          LIMIT 8`,
      )
      .all<any>();
    for (const r of results) {
      const span = r.from_date === r.to_date
        ? `on ${formatDate(r.from_date)}`
        : `from ${formatDate(r.from_date)} to ${formatDate(r.to_date)}`;
      items.push({
        when: r.created_at,
        icon: '🏖️',
        tone: 'warn',
        who: r.display_name,
        what: `is away ${span}${r.reason ? ` — ${r.reason}` : ''}`,
        href: '/app/rota/calendar',
        area: 'rota',
      });
    }
  }

  // 3. Rooms booked.
  if (areas.has('rooms')) {
    const { results } = await db
      .prepare(
        `SELECT b.created_at, b.id, b.title, b.starts_at, b.status,
                rm.name AS room_name, p.display_name
           FROM room_bookings b
           JOIN rooms rm ON rm.id = b.room_id
           LEFT JOIN people p ON p.id = b.booked_by
          WHERE b.starts_at >= datetime('now', '-1 day')
          ORDER BY b.created_at DESC
          LIMIT 8`,
      )
      .all<any>();
    for (const r of results) {
      items.push({
        when: r.created_at,
        icon: r.status === 'cancelled' ? '🚫' : '🚪',
        tone: r.status === 'cancelled' ? 'warn' : 'navy',
        who: r.display_name ?? 'The office',
        what: `${r.status === 'cancelled' ? 'cancelled' : 'booked'} the ${r.room_name} `
          + `for ${r.title} on ${formatDate(r.starts_at.slice(0, 10))}`,
        href: `/app/rooms/${r.id}`,
        area: 'rooms',
      });
    }
  }

  // 4. Event bookings, as a count per event rather than one line each — twenty
  //    people booking a supper is one piece of news, not twenty.
  if (areas.has('events')) {
    const { results } = await db
      .prepare(
        `SELECT MAX(b.created_at) AS created_at, COUNT(*) AS n,
                SUM(b.party_size) AS people, e.id, e.title
           FROM event_bookings b JOIN events e ON e.id = b.event_id
          WHERE b.status = 'booked' AND b.created_at >= datetime('now', '-14 days')
          GROUP BY e.id
          ORDER BY created_at DESC
          LIMIT 5`,
      )
      .all<any>();
    for (const r of results) {
      items.push({
        when: r.created_at,
        icon: '🎟️',
        tone: 'ok',
        who: `${r.n} ${r.n === 1 ? 'booking' : 'bookings'}`,
        what: `for ${r.title}${r.people !== r.n ? ` — ${r.people} people` : ''}`,
        href: `/app/events/${r.id}`,
        area: 'events',
      });
    }
  }

  // 5. People stepping back. A break nobody has ended is worth noticing.
  if (areas.has('rota')) {
    const { results } = await db
      .prepare(
        `SELECT on_break_since AS created_at, display_name
           FROM people
          WHERE on_break = 1 AND on_break_since IS NOT NULL
          ORDER BY on_break_since DESC
          LIMIT 5`,
      )
      .all<any>();
    for (const r of results) {
      items.push({
        when: r.created_at,
        icon: '⏸️',
        tone: 'warn',
        who: r.display_name,
        what: 'is taking a break, so will not be put on anything new',
        area: 'rota',
      });
    }
  }

  // Newest first, then trimmed. Sorting here rather than in SQL is what lets
  // five different tables share one list without a compound SELECT.
  return items
    .filter((i) => i.when)
    .sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
    .slice(0, limit);
}

/** "3 days ago". A distance is more use here than a date. */
export function howLongAgo(sqlite: string, now: Date): string {
  const then = new Date(`${sqlite.replace(' ', 'T')}${/[Zz]$/.test(sqlite) ? '' : 'Z'}`);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (!Number.isFinite(mins)) return '';
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}
