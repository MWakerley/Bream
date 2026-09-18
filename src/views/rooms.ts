import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate } from './rota.js';
import { viewTabs } from './calendar.js';
import { FREQUENCIES, describeSeries } from '../recurrence.js';
import type { SeriesRow } from '../rooms.js';

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
}

const BACK = { href: '/app', label: 'All areas' };

const time = (iso: string) => iso.slice(11, 16);
const date = (iso: string) => iso.slice(0, 10);

/** Bookings grouped by day, which is how anyone actually reads a room diary. */
function byDay(bookings: BookingRow[]) {
  const m = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const d = date(b.starts_at);
    m.set(d, [...(m.get(d) ?? []), b]);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function roomsPage(opts: {
  rooms: RoomRow[];
  bookings: BookingRow[];
  series: SeriesRow[];
  ctx: ViewCtx;
  weekFrom: string;
  notice?: { tone: 'ok' | 'bad'; text: string };
  /** Repopulates the form when a booking clashed, so nothing is retyped. */
  form?: Record<string, string>;
}) {
  const { rooms, bookings, series, ctx, notice, weekFrom } = opts;
  const f = opts.form ?? {};
  const days = byDay(bookings);

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
                      <td><a href="/app/rooms/series/${s.id}"><strong>${s.title}</strong></a></td>
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
                          <td><strong>${b.room_name}</strong></td>
                          <td class="num">${time(b.starts_at)}–${time(b.ends_at)}</td>
                          <td>
                            ${b.title}
                            ${b.series_id ? html`<div style="font-size:.8125rem;color:var(--ink-2)">part of a repeating booking</div>` : ''}
                            ${b.notes ? html`<div style="font-size:.9375rem;color:var(--ink-2)">${b.notes}</div>` : ''}
                          </td>
                          <td style="color:var(--ink-2)">
                            ${b.contact ?? b.booked_by_name ?? '—'}
                          </td>
                          <td>
                            <div class="btn-row" style="gap:.4rem">
                              <a class="linkish" href="/app/rooms/${b.id}">Change</a>
                              <form method="post" action="/app/rooms/${b.id}/cancel" class="inline-form"
                                    onsubmit="return confirm('Cancel this booking?')">
                                <button class="linkish" type="submit"
                                        style="color:var(--bad)">Cancel</button>
                              </form>
                            </div>
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

      <div class="notice notice-info">
        <p style="margin-top:0"><strong>What a change here will and will not touch.</strong></p>
        <ul style="margin:0;padding-left:1.2rem">
          <li>Bookings that have <strong>already happened</strong> are left exactly as they are.</li>
          <li>Any week you <strong>changed on its own</strong> keeps your version — a change here
              will not overwrite it.</li>
          <li>Any week you <strong>cancelled</strong> stays cancelled; it will not come back.</li>
          <li>Everything else still to come is rebuilt from the pattern below.</li>
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
            onsubmit="return confirm('Cancel the ${s.upcoming} bookings still to come? Past ones are kept.')">
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
    .map((c) => `${c.title}, ${formatDate(date(c.starts_at))} ${time(c.starts_at)}–${time(c.ends_at)}`)
    .join('; ')}.`;
}
