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
 */

export interface CalendarEntry {
  /** 'YYYY-MM-DD' */
  date: string;
  href: string;
  /** Shown first, in bold — usually a time. */
  lead?: string;
  label: string;
  /** Drives the colour of the dot. */
  tone?: 'navy' | 'gold' | 'green' | 'red';
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

export function monthCalendar(opts: {
  month: string;
  entries: CalendarEntry[];
  /** Where the arrows point; `${base}?month=YYYY-MM` plus any extra query. */
  baseHref: string;
  extraQuery?: string;
  emptyMessage?: string;
}) {
  const { month, entries, baseHref } = opts;
  const extra = opts.extraQuery ? `&${opts.extraQuery}` : '';
  const today = new Date().toISOString().slice(0, 10);

  const byDay = new Map<string, CalendarEntry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const days = gridDays(month);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return html`
    <div class="cal-head">
      <a class="btn-secondary" href="${baseHref}?month=${shiftMonth(month, -1)}${extra}"
         aria-label="Previous month">←</a>
      <h2 class="cal-month">${monthLabel(month)}</h2>
      <a class="btn-secondary" href="${baseHref}?month=${shiftMonth(month, 1)}${extra}"
         aria-label="Next month">→</a>
      <a class="btn-quiet" href="${baseHref}?month=${thisMonth()}${extra}">Today</a>
    </div>

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
            ${days.slice(w * 7, w * 7 + 7).map((d) => {
              const list = byDay.get(d.date) ?? [];
              return html`<div class="cal-day ${d.inMonth ? '' : 'cal-out'} ${d.date === today ? 'cal-today' : ''}"
                                role="cell">
                <span class="cal-n">${Number(d.date.slice(8, 10))}</span>
                ${list.map(
                  (e) => html`<a class="cal-item cal-${e.tone ?? 'navy'}" href="${e.href}"
                                 title="${e.title ?? `${e.lead ?? ''} ${e.label}`}">
                    ${e.lead ? html`<strong>${e.lead}</strong> ` : ''}${e.label}
                  </a>`,
                )}
              </div>`;
            })}
          </div>`)}
      </div>
    </div>
  `;
}

/** The list/calendar switch that sits above both views. */
export function viewTabs(current: 'list' | 'calendar', listHref: string, calendarHref: string) {
  return html`<div class="tabs" role="tablist">
    <a class="tab ${current === 'list' ? 'is-on' : ''}" href="${listHref}"
       role="tab" aria-selected="${current === 'list' ? 'true' : 'false'}">List</a>
    <a class="tab ${current === 'calendar' ? 'is-on' : ''}" href="${calendarHref}"
       role="tab" aria-selected="${current === 'calendar' ? 'true' : 'false'}">Calendar</a>
  </div>`;
}
