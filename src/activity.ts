import { formatDate, lastDay } from './views/rota.js';
import { describeRepeat, repeatOf } from './events.js';

/**
 * What has changed lately, for the top of the home page.
 *
 * The case that started this: somebody says on their own page that they cannot
 * preach on the 20th, and nobody finds out until somebody notices the gap. A
 * change like that needs to reach the person who can do something about it, and
 * the home page is the only screen everybody opens.
 *
 * WHAT BELONGS HERE, and the rule is narrow on purpose:
 *   * somebody coming OFF the rota — cannot do it, asked to swap, gone away,
 *     taking a break
 *   * a new event existing
 *
 * Nothing else. Room bookings were here and had to come out: the church has
 * some 760 of them, every one imported from Google Calendar in the same second,
 * so they buried every genuine change under a wall of "the main church is
 * booked". The test of whether something belongs is not "did it happen" but
 * "would somebody need to DO something about it" — and a routine room booking
 * is somebody doing their job, not news. Event BOOKINGS are out for the same
 * reason: sixty people booking a supper is sixty rows and one fact.
 *
 * Built from small queries merged in JavaScript rather than one UNION. D1
 * refuses a compound SELECT of even eight terms, and merging here also lets
 * each source keep the columns that make sense for it rather than being bent
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
  /** Still waiting on somebody here to act — a place nobody has filled, a
   *  request nobody has answered. Kept on the list however old it is. */
  urgent?: boolean;
  /** Urgent, and older than RECENT_DAYS: shown first, as "Action needed". */
  actionNeeded?: boolean;
}

/**
 * How far back "Lately" looks. Anything older drops off — unless it still
 * needs doing, in which case it stays, and once it is this old it is marked
 * "Action needed" so a fortnight-old problem cannot sit quietly among the news.
 */
export const RECENT_DAYS = 14;

export async function recentActivity(
  db: D1Database,
  areas: Set<string>,
  limit = 8,
  now: Date = new Date(),
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];
  const today = now.toISOString().slice(0, 10);

  // 1. Somebody dropping off a service. The reason this panel exists.
  //
  // 'note' is excluded: a note attached to an assignment is a message, not a
  // change, and this list is only for things that alter who is serving.
  if (areas.has('rota')) {
    const { results } = await db
      .prepare(
        `SELECT cr.created_at, cr.kind, cr.status, cr.message,
                p.display_name, r.name AS role_name,
                s.id AS service_id, s.service_date,
                -- Somebody else is on it now: sorted by hand, even though
                -- nobody pressed the button on the request.
                CASE WHEN a.person_id IS NOT NULL AND a.person_id <> cr.person_id
                     THEN 1 ELSE 0 END AS covered
           FROM change_requests cr
           JOIN people p      ON p.id = cr.person_id
           JOIN assignments a ON a.id = cr.assignment_id
           JOIN roles r       ON r.id = a.role_id
           JOIN services s    ON s.id = a.service_id
          WHERE cr.kind IN ('cannot_do', 'swap')
          -- Unanswered ones first, so an old one still waiting is never pushed
          -- out of the LIMIT by newer news.
          ORDER BY (cr.status = 'open') DESC, cr.created_at DESC
          LIMIT 20`,
      )
      .all<any>();
    for (const r of results) {
      const when = formatDate(r.service_date);
      // Unanswered, still to come, and nobody else put on in their place.
      const urgent = r.status === 'open' && r.service_date >= today && !r.covered;
      items.push({
        when: r.created_at,
        icon: r.kind === 'cannot_do' ? '⚠️' : '🔄',
        tone: urgent ? 'bad' : 'ok',
        who: r.display_name,
        what: r.kind === 'cannot_do'
          ? `cannot do ${r.role_name} on ${when}${urgent && r.kind === 'cannot_do' ? ' — still needs somebody' : ''}`
          : `has asked to swap ${r.role_name} on ${when}`,
        href: `/app/rota/service/${r.service_id}`,
        area: 'rota',
        urgent,
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

  // 3. A new event.
  //
  // The event itself, NOT the bookings people make for it. Somebody booking a
  // place is routine and there can be sixty of them; the event existing is the
  // thing worth telling everybody about once.
  if (areas.has('events')) {
    const { results } = await db
      .prepare(
        `SELECT created_at, id, title, starts_at, ends_at, is_published, repeat_freq, repeat_count
           FROM events
          WHERE created_at >= datetime('now', '-${RECENT_DAYS} days')
          ORDER BY created_at DESC
          LIMIT 5`,
      )
      .all<any>();
    for (const r of results) {
      items.push({
        when: r.created_at,
        icon: '🎟️',
        tone: 'ok',
        who: r.title,
        what: (r.ends_at && lastDay(r.starts_at, r.ends_at) !== r.starts_at.slice(0, 10)
          ? `runs from ${formatDate(r.starts_at.slice(0, 10))} to ${formatDate(lastDay(r.starts_at, r.ends_at))}`
          : `is on ${formatDate(r.starts_at.slice(0, 10))}`)
          + (repeatOf(r) ? ` (${describeRepeat(r).replace(/^E/, 'e')})` : '')
          + (r.is_published ? ' and taking bookings' : ' — not published yet'),
        href: `/app/events/${r.id}`,
        area: 'events',
      });
    }
  }

  // 3b. Somebody outside asking for a room. Exactly the kind of thing this panel
  // is for: nothing happens until somebody here decides, and the time is held
  // on the diary while they wait.
  if (areas.has('rooms') && areas.has('rooms.manage')) {
    const { results } = await db
      .prepare(
        `SELECT q.id, q.created_at, q.name, q.purpose, q.starts_at, q.freq, r.name AS room_name
           FROM room_requests q JOIN rooms r ON r.id = q.room_id
          WHERE q.status = 'pending'
          ORDER BY q.created_at DESC
          LIMIT 5`,
      )
      .all<any>();
    for (const r of results) {
      items.push({
        when: r.created_at,
        icon: '🔑',
        tone: 'warn',
        who: r.name,
        what: `asked to book the ${r.room_name} for ${r.purpose}, ${formatDate(r.starts_at.slice(0, 10))}`
          + (r.freq ? ' (repeating)' : '') + ' — waiting for a decision',
        href: `/app/rooms#request-${r.id}`,
        area: 'rooms.manage',
        urgent: r.starts_at.slice(0, 10) >= today,
      });
    }
  }

  // 4. People stepping back. A break nobody has ended is worth noticing.
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

  return lately(items, limit, now);
}

/**
 * The last RECENT_DAYS, plus anything older that still needs doing, which
 * comes first and is marked "Action needed". Then newest first, then trimmed —
 * never trimming away something that needs action. Sorting here rather than in
 * SQL is what lets several tables share one list without a compound SELECT.
 * Kept apart from the queries so it can be tested without a database.
 */
export function lately(items: ActivityItem[], limit: number, now: Date): ActivityItem[] {
  const cutoff = new Date(now.getTime() - RECENT_DAYS * 86_400_000)
    .toISOString().slice(0, 19).replace('T', ' ');
  const newestFirst = (a: ActivityItem, b: ActivityItem) =>
    (a.when < b.when ? 1 : a.when > b.when ? -1 : 0);
  const kept = items
    .filter((i) => i.when)
    // SQLite's 'YYYY-MM-DD HH:MM:SS' compares as text; an ISO 'T' is read the same.
    .map((i) => ({ ...i, actionNeeded: !!i.urgent && i.when.replace('T', ' ') < cutoff }))
    .filter((i) => i.urgent || i.when.replace('T', ' ') >= cutoff);
  const overdue = kept.filter((i) => i.actionNeeded).sort(newestFirst);
  const rest = kept.filter((i) => !i.actionNeeded).sort(newestFirst);
  return [...overdue, ...rest.slice(0, Math.max(0, limit - overdue.length))];
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
