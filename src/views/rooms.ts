import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate, formatSpan, lastDay } from './rota.js';
import { viewTabs } from './calendar.js';
import { FREQUENCIES, describeSeries } from '../recurrence.js';
import type { SeriesRow } from '../rooms.js';
import { requestsDashboard } from './roomRequests.js';
import type { RequestRow } from '../roomRequests.js';

export interface RoomRow { id: number; name: string; capacity: number | null; notes: string | null }
export interface BookingRow {
  id: number;
  room_id: number;
  room_name: string;
  title: string;
  starts_at: string; // 'YYYY-MM-DDTHH:MM'
  ends_at: string;
  contact: string | null;
  notes: string | null;
  status: string;
  booked_by_name: string | null;
  series_id?: number | null;
  /** Set when the room is held for an event, which then owns its times. */
  event_id?: number | null;
  /** 1 while a request from the public form is waiting to be decided. */
  is_tentative?: number;
  /** The request a booking came from, if any. */
  request_id?: number | null;
  /** 1 when the website's room diary shows it only as "Private booking". */
  is_private?: number;
}

const BACK = { href: '/app', label: 'All areas' };

/**
 * Beside a private booking wherever the system lists or draws it. Inside, the
 * booking is shown in full as always; the chip only tells staff that the
 * website is not saying what it is.
 */
export const PRIVATE_CHIP = html`<span class="chip chip-neutral"
  title="The room diary on the website shows just &quot;Private booking&quot; and the time">Private</span>`;

/**
 * The "Private booking" tick, the same on every form that makes or changes a
 * booking. `more` is a sentence for where it reaches further or less far.
 */
function privateTick(on: boolean, more = '') {
  // was_private is what the box showed when the page was drawn, so a save from
  // a page left open can tell "unticked it" from "never saw it ticked" — see
  // privateAfterSave in src/rooms.ts.
  return html`<input type="hidden" name="was_private" value="${on ? '1' : '0'}">
  <label class="check" style="max-width:34rem;margin-bottom:1.25rem">
    <input type="checkbox" name="is_private" value="1" ${on ? 'checked' : ''}>
    <span><span class="check-label">Private booking</span>
      <span class="check-note">The room diary on the website shows just "Private booking" and the time — not what it is for.${more ? ` ${more}` : ''}</span></span>
  </label>`;
}

const time = (iso: string) => iso.slice(11, 16);
const date = (iso: string) => iso.slice(0, 10);

const nextDay = (d: string) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Every day a booking touches. One day for an ordinary booking; each day in
 * turn for a room held over an event that runs from Saturday to Sunday. A
 * booking that ends at exactly midnight does not touch the next day.
 */
export function daysCovered(b: { starts_at: string; ends_at: string }): string[] {
  const last = lastDay(b.starts_at, b.ends_at);
  const out: string[] = [];
  // Capped, so a mistyped year can never make a page build thousands of rows.
  for (let d = date(b.starts_at); d <= last && out.length < 62; d = nextDay(d)) out.push(d);
  return out;
}

/** How a booking reads on one of its days: 19:00–21:00 on a single day, and
 *  "from 19:00", "all day", "until 16:00" across the days of a longer one. */
export function timeOnDay(b: { starts_at: string; ends_at: string }, day: string): string {
  const first = day === date(b.starts_at);
  const last = daysCovered(b).at(-1) === day;
  if (first && last) return `${time(b.starts_at)}–${time(b.ends_at) === '00:00' ? 'midnight' : time(b.ends_at)}`;
  if (first) return `from ${time(b.starts_at)}`;
  if (last) return time(b.ends_at) === '00:00' ? 'all day' : `until ${time(b.ends_at)}`;
  return 'all day';
}

/**
 * Bookings grouped by day, which is how anyone actually reads a room diary.
 *
 * A booking appears on every day it covers, so the hall held for a weekend
 * away is shown as taken on the Sunday too — not only on the Saturday it
 * started. Days are kept to the window that was fetched: a day outside it
 * would look emptier than it is, because its other bookings were never asked
 * for.
 */
function byDay(bookings: BookingRow[], from: string, windowDays = 28) {
  const until = new Date(Date.parse(`${from}T00:00:00Z`) + windowDays * 86_400_000).toISOString().slice(0, 10);
  const m = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    for (const d of daysCovered(b)) {
      if (d < from || d >= until) continue;
      m.set(d, [...(m.get(d) ?? []), b]);
    }
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function roomsPage(opts: {
  rooms: RoomRow[];
  bookings: BookingRow[];
  series: SeriesRow[];
  /** Requests from the public form still waiting to be decided. */
  requests?: RequestRow[];
  ctx: ViewCtx;
  weekFrom: string;
  notice?: { tone: 'ok' | 'bad'; text: string };
  /** Repopulates the form when a booking clashed, so nothing is retyped. */
  form?: Record<string, string>;
}) {
  const { rooms, bookings, series, ctx, notice, weekFrom } = opts;
  const canDecide = !ctx.areas || ctx.areas.has('rooms.manage');
  const f = opts.form ?? {};
  const days = byDay(bookings, weekFrom);

  return layout(
    {
      title: 'Room booking',
      eyebrow: 'Rooms',
      heading: 'Room booking',
      intro: 'Book a room, check what is free, and change or cancel a booking.',
      back: BACK,
      ...ctx,
    },
    html`
      ${viewTabs('list', '/app/rooms', '/app/rooms/calendar')}

      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      ${requestsDashboard(opts.requests ?? [], canDecide)}

      <h2 class="section-h2" id="book">Make a booking</h2>
      <form method="post" action="/app/rooms/book" class="card">
        <div class="grid-fields">
          <div class="field">
            <label for="room_id">Which room</label>
            <select id="room_id" name="room_id" required>
              ${rooms.map((r) => html`<option value="${r.id}" ${String(f.room_id) === String(r.id) ? 'selected' : ''}>
                ${r.name}${r.capacity ? ` (holds ${r.capacity})` : ''}
              </option>`)}
            </select>
          </div>
          <div class="field">
            <label for="on_date">Date</label>
            <input id="on_date" name="on_date" type="date" value="${f.on_date ?? ''}" required>
          </div>
          <div class="field">
            <label for="from_time">From</label>
            <input id="from_time" name="from_time" type="time" value="${f.from_time ?? '19:00'}" required>
          </div>
          <div class="field">
            <label for="to_time">Until</label>
            <input id="to_time" name="to_time" type="time" value="${f.to_time ?? '21:00'}" required>
          </div>
        </div>
        <div class="field">
          <label for="title">What is it for</label>
          <input id="title" name="title" type="text" value="${f.title ?? ''}"
                 placeholder="e.g. Home group, PCC meeting, Toddler group" required>
        </div>
        <div class="grid-fields">
          <div class="field">
            <label for="contact">Who to ask about it</label>
            <span class="hint">A name or phone number. Optional.</span>
            <input id="contact" name="contact" type="text" value="${f.contact ?? ''}">
          </div>
          <div class="field">
            <label for="notes">Anything else</label>
            <span class="hint">Optional.</span>
            <input id="notes" name="notes" type="text" value="${f.notes ?? ''}">
          </div>
        </div>
        ${privateTick(!!f.is_private, 'For a repeating booking, every date it books.')}

        <h3 style="margin-bottom:.5rem">Does it repeat?</h3>
        <div class="grid-fields">
          <div class="field">
            <label for="repeat">How often</label>
            <span class="hint">Leave as "just once" for a one-off.</span>
            <select id="repeat" name="repeat">
              <option value="">Just once</option>
              ${FREQUENCIES.map((x) => html`<option value="${x.value}">${x.label} — ${x.note}</option>`)}
            </select>
          </div>
          <div class="field" id="until-field" hidden>
            <label for="until">Carry on until</label>
            <span class="hint">A year ahead is usual; you can extend it later.</span>
            <input id="until" name="until" type="date" value="${f.until ?? ''}">
          </div>
        </div>

        <button class="btn-primary" type="submit">Book this room</button>
      </form>

      <script>
        // The "until" date only means anything once a repeat is chosen.
        (function () {
          var sel = document.getElementById('repeat');
          var f = document.getElementById('until-field');
          var until = document.getElementById('until');
          function sync() {
            var on = sel.value !== '';
            f.hidden = !on;
            if (until) until.required = on;
            // Default to a year out the first time somebody picks a repeat.
            if (on && until && !until.value) {
              var d = new Date();
              d.setFullYear(d.getFullYear() + 1);
              until.value = d.toISOString().slice(0, 10);
            }
          }
          sel.addEventListener('change', sync);
          sync();
        }());
      </script>

      ${series.length
        ? html`<h2 class="section-h2">Repeating bookings</h2>
            <div class="table-scroll">
              <table class="grid">
                <thead>
                  <tr><th>What</th><th>Room</th><th>Pattern</th><th>Time</th>
                      <th class="num">Still to come</th><th></th></tr>
                </thead>
                <tbody>
                  ${series.map(
                    (s) => html`<tr>
                      <td><a href="/app/rooms/series/${s.id}"><strong>${s.title}</strong></a>
                        ${s.is_private ? PRIVATE_CHIP : ''}</td>
                      <td>${s.room_name}</td>
                      <td>${describeSeries(s.from_date, s.freq, s.until_date)}</td>
                      <td class="num">${s.from_time}–${s.to_time}</td>
                      <td class="num">${s.upcoming} <span style="color:var(--ink-2)">of ${s.total}</span></td>
                      <td>
                        <a class="linkish" href="/app/rooms/series/${s.id}">Change or cancel</a>
                      </td>
                    </tr>`,
                  )}
                </tbody>
              </table>
            </div>
            <p style="color:var(--ink-2);font-size:.9375rem">
              Cancelling a series removes the bookings still to come and leaves the ones that
              have already happened. A single week can be cancelled on its own below.
            </p>`
        : ''}

      <h2 class="section-h2">What is booked</h2>
      <form method="get" action="/app/rooms" class="card" style="padding-block:1rem">
        <div class="grid-fields" style="align-items:end">
          <div class="field" style="margin-bottom:0">
            <label for="from">Show bookings from</label>
            <input id="from" name="from" type="date" value="${weekFrom}">
          </div>
          <div class="field" style="margin-bottom:0">
            <button class="btn-secondary" type="submit">Show</button>
          </div>
        </div>
      </form>

      ${days.length === 0
        ? html`<div class="card"><p style="margin:0">Nothing booked in this period.</p></div>`
        : days.map(
            ([d, list]) => html`<div class="card">
              <h3 style="margin-top:0">${formatDate(d)}</h3>
              <div class="table-scroll">
                <table class="grid">
                  <thead><tr><th>Room</th><th>Time</th><th>What for</th><th>Contact</th><th></th></tr></thead>
                  <tbody>
                    ${list
                      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                      .map(
                        (b) => html`<tr>
                          <td><strong>${b.room_name}</strong>
                            ${b.is_tentative ? html`<div>${chip('amber', 'Tentative')}</div>` : ''}</td>
                          <td class="num">${timeOnDay(b, d)}</td>
                          <td>
                            ${b.title} ${b.is_private ? PRIVATE_CHIP : ''}
                            ${b.series_id ? html`<div style="font-size:.8125rem;color:var(--ink-2)">part of a repeating booking</div>` : ''}
                            ${daysCovered(b).length > 1
                              ? html`<div style="font-size:.8125rem;color:var(--ink-2)">${formatSpan(b.starts_at, b.ends_at)}</div>`
                              : ''}
                            ${b.notes ? html`<div style="font-size:.9375rem;color:var(--ink-2)">${b.notes}</div>` : ''}
                          </td>
                          <td style="color:var(--ink-2)">
                            ${b.contact ?? b.booked_by_name ?? '—'}
                          </td>
                          <td>
                            ${b.is_tentative && b.request_id
                              // A request still being decided: approve or decline it
                              // above, not by editing or cancelling the hold.
                              ? html`<a class="linkish" href="#request-${b.request_id}">Waiting — decide above</a>`
                              : b.event_id
                              // Held for an event: the event owns it. A Cancel
                              // here, under the Sunday of a weekend, would cancel
                              // the Saturday too and quietly take the room off
                              // the event.
                              ? html`<a class="linkish" href="/app/events/${b.event_id}">Held for an event</a>`
                              : html`<div class="btn-row" style="gap:.4rem">
                                  <a class="linkish" href="/app/rooms/${b.id}">Change</a>
                                  <form method="post" action="/app/rooms/${b.id}/cancel" class="inline-form"
                                        onsubmit="return confirm('Cancel this booking?')">
                                    <button class="linkish" type="submit"
                                            style="color:var(--bad)">Cancel</button>
                                  </form>
                                </div>`}
                          </td>
                        </tr>`,
                      )}
                  </tbody>
                </table>
              </div>
            </div>`,
          )}

      <h2 class="section-h2">The rooms</h2>
      <ul class="tiles" style="margin-bottom:1.25rem">
        ${rooms.map(
          (r) => html`<li><span class="tile" style="cursor:default">
            <span class="tile-label">${r.name}</span>
            <span class="tile-note">${r.capacity ? `Holds about ${r.capacity}` : 'No capacity recorded'}</span>
          </span></li>`,
        )}
      </ul>
      ${ctx.isAdmin
        ? html`<p><a class="btn-secondary" href="/app/settings/rooms">Add or rename a room</a></p>`
        : ''}
    `,
  );
}

export function editBookingPage(opts: {
  booking: BookingRow;
  rooms: RoomRow[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { booking: b, rooms, ctx, notice } = opts;
  // A request from the public form still waiting to be decided. It is approved
  // or declined as a whole on the Rooms page; editing one of its held dates
  // here would leave the request and the diary disagreeing.
  if (b.is_tentative && b.request_id) {
    return layout(
      { title: 'Waiting to be decided', eyebrow: 'Rooms', heading: b.title,
        back: { href: '/app/rooms', label: 'Room booking' }, ...ctx },
      html`
        ${notice
          ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
          : ''}
        <div class="card">
          <p style="margin-top:0">
            <strong>${b.room_name}</strong> is held <strong>tentatively</strong> for a request made
            online: ${b.title}, ${formatSpan(b.starts_at, b.ends_at)}.
          </p>
          <p>It stays held until somebody approves or declines the request.</p>
          <p style="margin-bottom:0">
            <a class="btn-primary" href="/app/rooms#request-${b.request_id}">See the request</a>
          </p>
        </div>
      `,
    );
  }
  // A room held for an event takes its times from the event. Editing it here
  // would let the two disagree — and this form only knows about one day, so
  // saving a hold over a weekend would quietly shrink it to the Saturday.
  if (b.event_id) {
    return layout(
      {
        title: 'Held for an event',
        eyebrow: 'Rooms',
        heading: b.title,
        back: { href: '/app/rooms', label: 'Room booking' },
        ...ctx,
      },
      html`
        ${notice
          ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
          : ''}
        <div class="card">
          ${b.status === 'booked'
            ? html`<p style="margin-top:0">
                <strong>${b.room_name}</strong> is held for the event <strong>${b.title}</strong>,
                ${formatSpan(b.starts_at, b.ends_at)}.
              </p>
              <p>
                Its times come from the event, so they are changed there: move the event and its
                rooms move with it; untick this room on the event to let it go.
              </p>`
            // Unticked on the event since. Still no one-day form here: saving it
            // would revive a hold the event has let go, possibly cut to one day.
            : html`<p style="margin-top:0">
                <strong>${b.room_name}</strong> was held for the event <strong>${b.title}</strong>
                and has since been let go, so it is free again. To hold it once more, tick it on
                the event.
              </p>`}
          <p style="margin-bottom:0">
            <a class="btn-primary" href="/app/events/${b.event_id}">Open the event</a>
          </p>
        </div>
      `,
    );
  }
  return layout(
    {
      title: 'Change a booking',
      eyebrow: 'Rooms',
      heading: b.title,
      back: { href: '/app/rooms', label: 'Room booking' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}
      ${b.status === 'cancelled'
        ? html`<div class="notice notice-warn"><p style="margin:0">
            This booking is cancelled. Saving it again will put it back.</p></div>`
        : ''}
      ${b.is_private
        ? html`<p>${PRIVATE_CHIP} <span style="color:var(--ink-2)">The room diary on the website
            shows this just as "Private booking", with the room and the time.</span></p>`
        : ''}

      <form method="post" action="/app/rooms/${b.id}" class="card">
        <div class="grid-fields">
          <div class="field">
            <label for="room_id">Which room</label>
            <select id="room_id" name="room_id" required>
              ${rooms.map((r) => html`<option value="${r.id}" ${r.id === b.room_id ? 'selected' : ''}>${r.name}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="on_date">Date</label>
            <input id="on_date" name="on_date" type="date" value="${date(b.starts_at)}" required>
          </div>
          <div class="field">
            <label for="from_time">From</label>
            <input id="from_time" name="from_time" type="time" value="${time(b.starts_at)}" required>
          </div>
          <div class="field">
            <label for="to_time">Until</label>
            <input id="to_time" name="to_time" type="time" value="${time(b.ends_at)}" required>
          </div>
        </div>
        <div class="field">
          <label for="title">What is it for</label>
          <input id="title" name="title" type="text" value="${b.title}" required>
        </div>
        <div class="grid-fields">
          <div class="field">
            <label for="contact">Who to ask about it</label>
            <input id="contact" name="contact" type="text" value="${b.contact ?? ''}">
          </div>
          <div class="field">
            <label for="notes">Anything else</label>
            <input id="notes" name="notes" type="text" value="${b.notes ?? ''}">
          </div>
        </div>
        ${privateTick(!!b.is_private, b.series_id
          // Saving here detaches this week from its series, as any change to
          // one week does, so say how far the tick reaches.
          ? 'This week only: the rest of the repeating booking keeps its own setting. A later change to the series leaves this week as you set it here — unless the series is saved with "Private booking" ticked, which makes every week private.'
          : '')}
        <div class="btn-row">
          <button class="btn-primary" type="submit">Save changes</button>
          <a class="btn-secondary" href="/app/rooms">Back without saving</a>
        </div>
      </form>
    `,
  );
}

export function editSeriesPage(opts: {
  series: SeriesRow;
  rooms: RoomRow[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { series: s, rooms, ctx, notice } = opts;
  return layout(
    {
      title: 'Change a repeating booking',
      eyebrow: 'Rooms',
      heading: s.title,
      intro: describeSeries(s.from_date, s.freq, s.until_date),
      back: { href: '/app/rooms', label: 'Room booking' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <div class="stat-row">
        <div class="stat"><span class="stat-n">${s.upcoming}</span><span class="stat-l">still to come</span></div>
        <div class="stat"><span class="stat-n">${s.total}</span><span class="stat-l">bookings in total</span></div>
      </div>
      ${s.is_private
        ? html`<p>${PRIVATE_CHIP} <span style="color:var(--ink-2)">The room diary on the website
            shows these just as "Private booking", with the room and the time.</span></p>`
        : ''}

      <div class="notice notice-info">
        <p style="margin-top:0"><strong>What a change here will and will not touch.</strong></p>
        <ul style="margin:0;padding-left:1.2rem">
          <li>Bookings that have <strong>already happened</strong> are left exactly as they are.</li>
          <li>Any week you <strong>changed on its own</strong> keeps your version — a change here
              will not overwrite it.</li>
          <li>Any week you <strong>cancelled</strong> stays cancelled; it will not come back.</li>
          <li>Everything else still to come is rebuilt from the pattern below.</li>
          <li>The <strong>Private booking</strong> tick reaches further, because the website shows the
              whole of this month: ticked, it makes every booking in the series private, past ones and
              weeks changed on their own included. Unticked, any week changed on its own keeps the tick it has.</li>
        </ul>
      </div>

      <form method="post" action="/app/rooms/series/${s.id}" class="card">
        <div class="grid-fields">
          <div class="field">
            <label for="room_id">Which room</label>
            <select id="room_id" name="room_id" required>
              ${rooms.map((r) => html`<option value="${r.id}" ${r.id === s.room_id ? 'selected' : ''}>${r.name}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="from_time">From</label>
            <input id="from_time" name="from_time" type="time" value="${s.from_time}" required>
          </div>
          <div class="field">
            <label for="to_time">Until</label>
            <input id="to_time" name="to_time" type="time" value="${s.to_time}" required>
          </div>
        </div>

        <div class="field">
          <label for="title">What is it for</label>
          <input id="title" name="title" type="text" value="${s.title}" required>
        </div>

        <div class="grid-fields">
          <div class="field">
            <label for="contact">Who to ask about it</label>
            <span class="hint">Optional.</span>
            <input id="contact" name="contact" type="text" value="${s.contact ?? ''}">
          </div>
          <div class="field">
            <label for="notes">Anything else</label>
            <span class="hint">Optional.</span>
            <input id="notes" name="notes" type="text" value="${s.notes ?? ''}">
          </div>
        </div>
        ${privateTick(!!s.is_private, 'Every booking in the series — see above.')}

        <div class="grid-fields">
          <div class="field">
            <label for="freq">How often</label>
            <span class="hint">Changing this rebuilds every future date.</span>
            <select id="freq" name="freq" required>
              ${FREQUENCIES.map((x) => html`<option value="${x.value}" ${x.value === s.freq ? 'selected' : ''}>${x.label}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="until">Carry on until</label>
            <span class="hint">Push this out to extend the series.</span>
            <input id="until" name="until" type="date" value="${s.until_date}" required>
          </div>
          <div class="field">
            <label for="anchor">Started on</label>
            <span class="hint">Fixed — it is what sets the weekday and the pattern.</span>
            <input id="anchor" type="date" value="${s.from_date}" disabled>
          </div>
        </div>

        <div class="btn-row">
          <button class="btn-primary" type="submit">Save the whole series</button>
          <a class="btn-secondary" href="/app/rooms">Back without saving</a>
        </div>
      </form>

      <form method="post" action="/app/rooms/series/${s.id}/cancel" class="card"
            data-confirm="Cancel the ${s.upcoming} bookings still to come? Past ones are kept."
            onsubmit="return confirm(this.dataset.confirm)">
        <h2 style="margin-top:0">Stop it altogether</h2>
        <p style="color:var(--ink-2)">
          Cancels the ${s.upcoming} booking${s.upcoming === 1 ? '' : 's'} still to come and
          leaves everything that has already happened.
        </p>
        <button class="btn-danger" type="submit">Cancel the whole series</button>
      </form>
    `,
  );
}

/** Shown when a booking would land on top of another one. */
export function clashNotice(clashes: BookingRow[]) {
  return `That room is already booked: ${clashes
    .map((c) => `${c.title}, ${formatSpan(c.starts_at, c.ends_at)}`)
    .join('; ')}.`;
}
