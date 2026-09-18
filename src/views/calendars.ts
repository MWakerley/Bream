import { html } from 'hono/html';
import { layout, type ViewCtx } from './layout.js';
import { monthCalendar, monthLabel, viewTabs, type CalendarEntry } from './calendar.js';
import type { ServiceSummary } from '../db.js';
import type { BookingRow, RoomRow } from './rooms.js';

const time = (iso: string) => iso.slice(11, 16);

/** Room diary, one room at a time, as a month grid. */
export function roomsCalendarPage(opts: {
  rooms: RoomRow[];
  /** Null means every room at once. */
  roomId: number | null;
  bookings: BookingRow[];
  counts: Map<number, number>;
  month: string;
  ctx: ViewCtx;
}) {
  const { rooms, roomId, bookings, counts, month, ctx } = opts;
  const current = rooms.find((r) => r.id === roomId);

  const entries: CalendarEntry[] = bookings.map((b) => ({
    date: b.starts_at.slice(0, 10),
    href: `/app/rooms/${b.id}`,
    lead: time(b.starts_at),
    label: b.title,
    // With every room shown at once the colour is the only thing separating
    // them, so it follows the room rather than being decorative.
    tone: roomId ? 'navy' : (['navy', 'gold', 'green', 'red'] as const)[(b.room_id - 1) % 4],
    title: `${b.room_name}: ${b.title}, ${time(b.starts_at)}–${time(b.ends_at)}`,
  }));

  const q = (id: number | null) => (id ? `room=${id}` : '');

  return layout(
    {
      title: 'Room diary',
      eyebrow: 'Rooms',
      heading: current ? current.name : 'All rooms',
      intro: current?.notes ?? 'Every room, side by side. Pick one to see it on its own.',
      back: { href: '/app', label: 'All areas' },
      ...ctx,
    },
    html`
      ${viewTabs('calendar', '/app/rooms', `/app/rooms/calendar?month=${month}${roomId ? `&room=${roomId}` : ''}`)}

      <div class="pills">
        <a class="pill ${roomId === null ? 'is-on' : ''}"
           href="/app/rooms/calendar?month=${month}">All rooms</a>
        ${rooms.map(
          (r) => html`<a class="pill ${roomId === r.id ? 'is-on' : ''}"
                         href="/app/rooms/calendar?month=${month}&room=${r.id}">
            ${r.name} <span class="pill-n">${counts.get(r.id) ?? 0}</span>
          </a>`,
        )}
      </div>

      ${monthCalendar({
        month,
        entries,
        baseHref: '/app/rooms/calendar',
        extraQuery: q(roomId),
        emptyMessage: `Nothing booked in ${monthLabel(month)}${current ? ` for the ${current.name}` : ''}.`,
      })}

      <p style="margin-top:1.25rem">
        <a class="btn-secondary" href="/app/rooms">Back to the list, and to make a booking</a>
      </p>
    `,
  );
}

/** The rota as a month grid, so a Sunday can be reached in one click. */
export function rotaCalendarPage(opts: {
  services: ServiceSummary[];
  month: string;
  ctx: ViewCtx;
}) {
  const { services, month, ctx } = opts;

  const entries: CalendarEntry[] = services.map((s) => ({
    date: s.service_date,
    href: `/app/rota/service/${s.id}`,
    lead: s.service_time,
    label: s.title ?? 'Worship',
    // Red where somebody still has to be found, amber-ish where it is merely
    // below ideal. Colour is never the only signal — the title attribute and the
    // service page both say it in words.
    tone: s.gaps.length ? 'red' : s.short.length ? 'gold' : 'green',
    title: s.gaps.length
      ? `${s.title ?? 'Worship'} — nobody on ${s.gaps.join(', ')}`
      : `${s.title ?? 'Worship'} at ${s.service_time}`,
  }));

  const withGaps = services.filter((s) => s.gaps.length).length;

  return layout(
    {
      title: 'Rota calendar',
      eyebrow: 'Rota',
      heading: 'Rota calendar',
      intro: 'Click any service to see who is on what.',
      back: { href: '/app', label: 'All areas' },
      ...ctx,
    },
    html`
      ${viewTabs('calendar', '/app/rota', `/app/rota/calendar?month=${month}`)}

      ${withGaps > 0
        ? html`<div class="notice notice-warn" role="status"><p style="margin:0">
            <strong>${withGaps}</strong> service${withGaps === 1 ? '' : 's'} this month
            ${withGaps === 1 ? 'has' : 'have'} a role with nobody assigned — shown in red.
          </p></div>`
        : ''}

      ${monthCalendar({
        month,
        entries,
        baseHref: '/app/rota/calendar',
        emptyMessage: `No services in ${monthLabel(month)}. Add them under Settings → Services.`,
      })}

      <p style="margin-top:1.25rem;color:var(--ink-2);font-size:.9375rem">
        Green means every role is filled · amber means below the ideal number ·
        red means somebody still has to be found.
      </p>
    `,
  );
}
