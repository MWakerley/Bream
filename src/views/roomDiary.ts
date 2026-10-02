import { html } from 'hono/html';
import { layout, chip, type Html } from './layout.js';
import { formatDate, formatSpan } from './rota.js';
import { monthCalendar, monthHead, monthLabel, type CalendarEntry } from './calendar.js';
import { daysCovered, timeOnDay } from './rooms.js';
import type { PublicDiaryRow } from '../rooms.js';

/**
 * The room diary, for the church's website.
 *
 * Two pages anybody can open without signing in — a month calendar and a
 * list — for seeing what is on in each room. They are for looking at only:
 * no "+", no forms, and not a single link into the system or to the booking
 * form, so nothing on them can be mistaken for a way to book.
 *
 * Every booking arrives through listPublicDiary, which never reads contacts,
 * notes or who booked it, and withholds the title wherever it must not be
 * shown. The labels are worked out again here all the same, so a page handed
 * the wrong rows still says no more than it should.
 */

export interface DiaryPageOpts {
  rooms: { id: number; name: string }[];
  /** Null means every room at once. */
  roomId: number | null;
  bookings: PublicDiaryRow[];
  month: string;
  /** The months the arrows may reach, as 'YYYY-MM'. */
  months: { first: string; last: string };
  /** The days that were read, `to` not included. Nothing outside them is
   *  drawn: a weekend that began before them would otherwise show its first
   *  day, and the website does not show the past. */
  from: string;
  to: string;
  showTitles: boolean;
}

export const HELD = 'Held — not yet confirmed';

/** What the website says a booking is for. */
export function diaryLabel(b: PublicDiaryRow, showTitles: boolean): string {
  if (b.is_tentative) return HELD;
  if (!showTitles || b.unpublished_event || !b.title) return 'Booked';
  return b.title;
}

const query = (roomId: number | null, month: string) => `month=${month}${roomId ? `&room=${roomId}` : ''}`;

/** "All rooms" and then each room, as on the internal calendar. */
function roomTabs(base: string, o: DiaryPageOpts) {
  const tab = (id: number | null, name: string) => html`<a class="pill ${o.roomId === id ? 'is-on' : ''}"
       href="${base}?${query(id, o.month)}" ${o.roomId === id ? html`aria-current="page"` : ''}>${name}</a>`;
  return html`<nav class="pills" aria-label="Rooms">
    ${tab(null, 'All rooms')}
    ${o.rooms.map((r) => tab(r.id, r.name))}
  </nav>`;
}

function diaryPage(body: Html) {
  return layout(
    {
      title: 'Room diary',
      chrome: false,
      eyebrow: 'Bream Church',
      heading: 'Room diary',
      headingAside: 'What is on in our rooms, and when',
    },
    html`<div style="max-width:62rem;margin-inline:auto">${body}</div>`,
  );
}

/** Under the tabs on both pages: what the words mean, and that this is not
 *  where to book. No link to the booking form, deliberately — the website
 *  decides where that goes. */
const KEY = html`<p style="color:var(--ink-2);margin-top:0">
    <strong>${HELD}</strong> means somebody has asked for that time and is waiting to hear.
    This diary is for information only; to book a room, please get in touch with the church office.
  </p>`;

/** Days a booking is drawn on: each one it covers, inside what was read. */
const daysShown = (b: PublicDiaryRow, o: DiaryPageOpts) =>
  daysCovered(b).filter((d) => d >= o.from && d < o.to);

export function publicDiaryCalendarPage(o: DiaryPageOpts) {
  const room = o.rooms.find((r) => r.id === o.roomId) ?? null;

  const entries: CalendarEntry[] = o.bookings.flatMap((b) => daysShown(b, o).map((day) => {
    const what = diaryLabel(b, o.showTitles);
    return {
      date: day,
      // No href: an entry is shown, never opened.
      href: '',
      lead: timeOnDay(b, day),
      // With every room at once the room has to be named on the entry itself.
      label: room ? what : `${b.room_name}: ${what}`,
      // One room: gold for a hold, as on the booking form. Every room: the
      // colour follows the room, as on the internal calendar, and a hold is
      // told apart by its words.
      tone: room
        ? (b.is_tentative ? 'gold' as const : 'navy' as const)
        : (['navy', 'gold', 'green', 'red'] as const)[(b.room_id - 1) % 4],
      title: `${b.room_name}: ${what}, ${formatSpan(b.starts_at, b.ends_at)}`,
    };
  }));

  return diaryPage(html`
    ${roomTabs('/rooms/calendar', o)}
    ${KEY}
    <p><a class="btn-quiet" href="/rooms/list?${query(o.roomId, o.month)}">See this as a list</a></p>
    ${monthCalendar({
      month: o.month,
      entries,
      baseHref: '/rooms/calendar',
      extraQuery: o.roomId ? `room=${o.roomId}` : '',
      months: o.months,
      emptyMessage: `Nothing booked in ${monthLabel(o.month)}${room ? ` for the ${room.name}` : ''}.`,
    })}
  `);
}

export function publicDiaryListPage(o: DiaryPageOpts) {
  const room = o.rooms.find((r) => r.id === o.roomId) ?? null;

  // By day, as the internal diary is: a room held for a weekend is listed on
  // each of its days, not only the one it began.
  const byDay = new Map<string, PublicDiaryRow[]>();
  for (const b of o.bookings) {
    for (const d of daysShown(b, o)) byDay.set(d, [...(byDay.get(d) ?? []), b]);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  // This month is listed from today, so "nothing booked" means the rest of it.
  const rest = o.from > `${o.month}-01`;

  return diaryPage(html`
    ${roomTabs('/rooms/list', o)}
    ${KEY}
    <p><a class="btn-quiet" href="/rooms/calendar?${query(o.roomId, o.month)}">See this as a calendar</a></p>
    ${monthHead({ month: o.month, baseHref: '/rooms/list', extraQuery: o.roomId ? `room=${o.roomId}` : '', months: o.months })}

    ${days.length === 0
      ? html`<div class="card"><p style="margin:0">
          Nothing booked ${rest ? 'for the rest of' : 'in'} ${monthLabel(o.month)}${room ? ` for the ${room.name}` : ''}.
        </p></div>`
      : days.map(([d, list]) => html`<div class="card">
          <h3 style="margin-top:0">${formatDate(d)}</h3>
          <div class="table-scroll">
            <table class="grid">
              <thead><tr><th>Room</th><th>Time</th><th>What for</th></tr></thead>
              <tbody>
                ${list
                  .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.room_name.localeCompare(b.room_name))
                  .map((b) => html`<tr>
                    <td><strong>${b.room_name}</strong></td>
                    <td class="num">${timeOnDay(b, d)}</td>
                    <td>
                      ${b.is_tentative ? chip('amber', HELD) : diaryLabel(b, o.showTitles)}
                      ${daysCovered(b).length > 1
                        ? html`<div style="font-size:.8125rem;color:var(--ink-2)">${formatSpan(b.starts_at, b.ends_at)}</div>`
                        : ''}
                    </td>
                  </tr>`)}
              </tbody>
            </table>
          </div>
        </div>`)}
  `);
}

/** Both pages, while the diary is switched off. Says nothing else at all. */
export function diaryClosedPage() {
  return layout(
    { title: 'Room diary', chrome: false, eyebrow: 'Bream Church', heading: 'Room diary' },
    html`<div style="max-width:40rem;margin-inline:auto"><div class="card"><p style="margin:0">
      The room diary is not available at the moment. If you need to know whether a room is free,
      please get in touch with the church office.</p></div></div>`,
  );
}
