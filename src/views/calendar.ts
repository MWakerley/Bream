import { html } from 'hono/html';

/**
 * A month grid.
 *
 * Shared by the rota and the room diary because they are the same question asked
 * twice — "what is on, and when" — and two calendars that behaved differently
 * would be two things to learn.
 *
 * Built from ISO date strings rather than Date objects throughout. The church is
 * in one timezone and every date here is a wall-clock day, so converting to a
 * Date only creates opportunities for a booking to slide onto the previous day.
 *
 * On a phone the same markup is laid out as a list, one day to a line (see
 * "Phones: the month calendar" in app.css). Seven columns 44rem wide in a box
 * under half that was a strip you had to drag about to read anything. So each
 * day carries its own weekday name, which only a phone shows — on a computer
 * the column heading says it — and an empty day is marked, so a phone can
 * keep it to one short line. One copy of the month rather than two, so a
 * screen reader never hears it twice and a "+" is never in the page twice.
 */

export interface CalendarEntry {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Empty for an entry that is only shown, not opened. */
  href: string;
  /** Shown first, in bold — usually a time. */
  lead?: string;
  label: string;
  /** Drives the colour of the dot. */
  tone?: 'navy' | 'gold' | 'green' | 'red';
  /** A booking's own look, from the palette in src/rooms.ts. A colour wins
   *  over the tone. */
  colour?: string | null;
  font?: string | null;
  title?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** 'YYYY-MM' -> the previous and next month, as 'YYYY-MM'. */
export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = (y ?? 1970) * 12 + ((m ?? 1) - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Today's date in Britain, as 'YYYY-MM-DD', for the pages the public sees.
 *
 * new Date().toISOString() is the date in UTC, which all summer is still
 * yesterday between midnight and one in the morning here: the website's room
 * diary listed yesterday, and on the 1st opened on last month. Intl knows when
 * the clocks change. The parts are put together by hand, as formatDateTime in
 * rota.ts does, rather than trusting a locale to write dates as YYYY-MM-DD —
 * that is a habit of en-CA, not a promise. The instant can be given, so a test
 * can stand at a fixed moment.
 */
export function londonToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Every day shown in the grid: the month, padded to whole weeks from Monday. */
function gridDays(ym: string): { date: string; inMonth: boolean }[] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1));
  const last = new Date(Date.UTC(y ?? 1970, m ?? 1, 0));
  // getUTCDay is 0=Sunday; the week starts on Monday here.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - lead * 86400000);
  const trail = (7 - ((lead + last.getUTCDate()) % 7)) % 7;
  const total = lead + last.getUTCDate() + trail;

  const out = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    out.push({ date: d, inMonth: d.slice(0, 7) === ym });
  }
  return out;
}

/**
 * The month's name with arrows either side, and a way back to this month.
 *
 * Given `months`, an arrow that would leave that range is drawn greyed and
 * goes nowhere. The website's room diary reaches only from this month to a
 * year on, and an arrow that led to a month it then refused to show would
 * look broken.
 *
 * `today` ('YYYY-MM-DD') is where Today leads; the website's diary gives the
 * date in Britain. Without it, this month in UTC, as the system's own
 * calendars have always had it.
 */
export function monthHead(opts: {
  month: string;
  baseHref: string;
  extraQuery?: string;
  months?: { first: string; last: string };
  today?: string;
}) {
  const { month, baseHref, months } = opts;
  const current = opts.today ? opts.today.slice(0, 7) : thisMonth();
  const extra = opts.extraQuery ? `&${opts.extraQuery}` : '';
  const arrow = (by: -1 | 1) => {
    const to = shiftMonth(month, by);
    const label = by < 0 ? 'Previous month' : 'Next month';
    const glyph = by < 0 ? '←' : '→';
    return months && (to < months.first || to > months.last)
      ? html`<span class="btn-secondary is-off" aria-disabled="true" title="${label}">${glyph}</span>`
      : html`<a class="btn-secondary" href="${baseHref}?month=${to}${extra}" aria-label="${label}">${glyph}</a>`;
  };
  return html`
    <div class="cal-head">
      ${arrow(-1)}
      <h2 class="cal-month">${monthLabel(month)}</h2>
      ${arrow(1)}
      <a class="btn-quiet" href="${baseHref}?month=${current}${extra}">Today</a>
    </div>`;
}

export function monthCalendar(opts: {
  month: string;
  entries: CalendarEntry[];
  /** Where the arrows point; `${base}?month=YYYY-MM` plus any extra query. */
  baseHref: string;
  extraQuery?: string;
  /** The months the arrows may reach, as 'YYYY-MM'. Optional; see monthHead. */
  months?: { first: string; last: string };
  /** Today, as 'YYYY-MM-DD': the day ringed, and where Today leads. Optional;
   *  without it, the date in UTC. */
  today?: string;
  emptyMessage?: string;
  /**
   * Makes each day itself clickable, for "book this day".
   *
   * Given `{ href, label }`, every day in the month gets an add button linking
   * to `href` with the date appended. Days in the leading and trailing weeks of
   * the grid belong to other months and are left alone — clicking 29 September
   * from the October grid and getting a September booking is the kind of thing
   * nobody notices until the room is double-booked.
   */
  addDay?: {
    href: string;
    label: string;
    /** Only days from here to here get a "+", as 'YYYY-MM-DD'. Optional. */
    from?: string;
    until?: string;
  };
}) {
  const { month, entries, baseHref } = opts;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);

  const byDay = new Map<string, CalendarEntry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const days = gridDays(month);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return html`
    ${monthHead({ month, baseHref, extraQuery: opts.extraQuery, months: opts.months, today: opts.today })}

    ${entries.length === 0 && opts.emptyMessage
      ? html`<div class="notice notice-info"><p style="margin:0">${opts.emptyMessage}</p></div>`
      : ''}

    <div class="cal-scroll">
      <div class="cal" role="table" aria-label="${monthLabel(month)}">
        <div class="cal-row cal-names" role="row">
          ${dayNames.map((d) => html`<div class="cal-name" role="columnheader">${d}</div>`)}
        </div>
        ${Array.from({ length: days.length / 7 }, (_, w) => html`
          <div class="cal-row" role="row">
            ${days.slice(w * 7, w * 7 + 7).map((d, i) => {
              const list = byDay.get(d.date) ?? [];
              return html`<div class="cal-day ${d.inMonth ? '' : 'cal-out'} ${list.length ? '' : 'cal-empty'} ${d.date === today ? 'cal-today' : ''}"
                                role="cell">
                <span class="cal-dow">${dayNames[i]}</span>
                <span class="cal-n">${Number(d.date.slice(8, 10))}</span>
                ${opts.addDay && d.inMonth
                    && (!opts.addDay.from || d.date >= opts.addDay.from)
                    && (!opts.addDay.until || d.date <= opts.addDay.until)
                  ? html`<a class="cal-add" href="${opts.addDay.href}${opts.addDay.href.includes('?') ? '&' : '?'}on=${d.date}"
                             title="${opts.addDay.label} on ${d.date}">
                      <span aria-hidden="true">+</span>
                      <span class="sr-only">${opts.addDay.label} on ${d.date}</span>
                    </a>`
                  : ''}
                ${list.map(
                  // No href, no link: the public booking page shows when a room
                  // is taken, and must not point anybody at the booking itself.
                  (e) => e.href
                    ? html`<a class="cal-item ${itemClass(e)}" href="${e.href}"
                                 title="${e.title ?? `${e.lead ?? ''} ${e.label}`}">
                        ${e.lead ? html`<strong>${e.lead}</strong> ` : ''}${e.label}
                      </a>`
                    : html`<span class="cal-item ${itemClass(e)}"
                                 title="${e.title ?? `${e.lead ?? ''} ${e.label}`}">
                        ${e.lead ? html`<strong>${e.lead}</strong> ` : ''}${e.label}
                      </span>`,
                )}
              </div>`;
            })}
          </div>`)}
      </div>
    </div>
  `;
}

/** The classes for one entry: its tone, or its own colour, and its lettering. */
const itemClass = (e: CalendarEntry) =>
  (e.colour ? `cal-c-${e.colour}` : `cal-${e.tone ?? 'navy'}`) + (e.font ? ` cal-f-${e.font}` : '');

/** The list/calendar switch that sits above both views. */
export function viewTabs(current: 'list' | 'calendar', listHref: string, calendarHref: string) {
  return html`<div class="tabs" role="tablist">
    <a class="tab ${current === 'list' ? 'is-on' : ''}" href="${listHref}"
       role="tab" aria-selected="${current === 'list' ? 'true' : 'false'}">List</a>
    <a class="tab ${current === 'calendar' ? 'is-on' : ''}" href="${calendarHref}"
       role="tab" aria-selected="${current === 'calendar' ? 'true' : 'false'}">Calendar</a>
  </div>`;
}
