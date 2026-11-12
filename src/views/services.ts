import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate } from './rota.js';

export interface ServiceTypeOption { id: number; name: string; is_communion: number; default_time: string | null }
export interface ServiceListRow {
  id: number;
  service_date: string;
  service_time: string;
  title: string | null;
  location: string | null;
  type_name: string | null;
  is_cancelled: number;
}

export function servicesPage(opts: {
  services: ServiceListRow[];
  types: ServiceTypeOption[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
  /** The rooms that can be booked, for "Where". */
  rooms?: { id: number; name: string }[];
  /** A form handed back (a clash, a mistake), so nothing is retyped. */
  form?: Record<string, string>;
}) {
  const { services, types, ctx, notice } = opts;
  const today = new Date().toISOString().slice(0, 10);
  const rooms = opts.rooms ?? [];
  const f = opts.form ?? {};
  // The main church, where most services are, when there is a room by that
  // name; otherwise the first room.
  const defaultRoom = (rooms.find((r) => /church/i.test(r.name) && !/centre/i.test(r.name)) ?? rooms[0])?.id ?? '';

  return layout(
    { title: 'Services', back: { href: '/app', label: 'All areas' }, ...ctx },
    html`
      <p class="page-intro">
        The 10:30 Sunday pattern, plus the one-off services around it — Christmas, Remembrance,
        Messy Church and the rest.
      </p>

      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <h2 class="section-h2">Add the Sunday pattern</h2>
      <form method="post" action="/app/settings/services/generate" class="card">
        <p style="margin-top:0">
          Creates a 10:30 service for every Sunday between two dates. The
          <strong>second Sunday of each month</strong> is made Holy Communion, which is the
          pattern your current rota follows — you can change any individual service afterwards.
          Sundays that already have a 10:30 service are left alone.
        </p>
        <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))">
          <div class="field" style="margin-bottom:0">
            <label for="from">From</label>
            <input id="from" name="from" type="date" value="${today}" required>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="to">To</label>
            <input id="to" name="to" type="date" required>
          </div>
        </div>
        <p style="margin-bottom:0;margin-top:1rem">
          <button class="btn-primary" type="submit">Create the Sundays</button>
        </p>
      </form>

      <h2 class="section-h2" id="add-one">Add a one-off service</h2>
      <form method="post" action="/app/settings/services/add" class="card">
        <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))">
          <div class="field" style="margin-bottom:0">
            <label for="date">Date</label>
            <input id="date" name="date" type="date" value="${f.date ?? ''}" required>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="time">Time</label>
            <input id="time" name="time" type="time" value="${f.time ?? '10:30'}" required>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="type">Type</label>
            <select id="type" name="service_type_id">
              ${types.map((t) => html`<option value="${t.id}" ${f.service_type_id === String(t.id) ? 'selected' : ''}>${t.name}</option>`)}
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:1rem">
          <label for="title">Title</label>
          <span class="hint">What it is called on the rota, e.g. "Carols by Candlelight".</span>
          <input id="title" name="title" type="text" value="${f.title ?? ''}" required>
        </div>
        <!-- Where: one of the church's own rooms, which is then booked for it
             in the room diary, or somewhere else written in. -->
        <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))">
          <div class="field" style="margin-bottom:0">
            <label for="room_id">Where</label>
            <span class="hint">Choosing a room books it for the service.</span>
            <select id="room_id" name="room_id">
              ${rooms.map((r) => html`<option value="${r.id}" ${String(f.room_id ?? defaultRoom) === String(r.id) ? 'selected' : ''}>${r.name}</option>`)}
              <option value="" ${f.room_id === '' ? 'selected' : ''}>Somewhere else…</option>
            </select>
          </div>
          <div class="field" style="margin-bottom:0" id="until-field">
            <label for="until">Room needed until</label>
            <span class="hint">When the room can be let go.</span>
            <input id="until" name="until" type="time" value="${f.until ?? '12:00'}">
          </div>
        </div>
        <div class="field" id="elsewhere-field" style="margin-top:1rem" ${f.room_id === '' ? '' : 'hidden'}>
          <label for="location">Where, then</label>
          <span class="hint">Not one of our rooms, so nothing is booked.</span>
          <input id="location" name="location" type="text" placeholder="Bream Cenotaph" value="${f.location ?? ''}">
        </div>
        <script>
          (function () {
            var room = document.getElementById('room_id');
            var until = document.getElementById('until-field');
            var where = document.getElementById('elsewhere-field');
            var time = document.getElementById('time');
            var end = document.getElementById('until');
            function sync() {
              var elsewhere = room.value === '';
              where.hidden = !elsewhere;
              until.hidden = elsewhere;
              end.required = !elsewhere;
            }
            // Start time moved: keep the room for the same length as before.
            var last = time.value;
            time.addEventListener('change', function () {
              var a = last.split(':'), b = time.value.split(':'), e = end.value.split(':');
              if (a.length === 2 && b.length === 2 && e.length === 2) {
                var m = (+e[0] * 60 + +e[1]) + ((+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]));
                if (m > 0 && m < 1440) end.value = ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2);
              }
              last = time.value;
            });
            room.addEventListener('change', sync);
            sync();
          }());
        </script>
        <button class="btn-primary" type="submit" style="margin-top:1rem">Add this service</button>
      </form>

      <h2 class="section-h2">All services (${services.length})</h2>
      ${services.length === 0
        ? html`<div class="card"><p style="margin:0">None yet.</p></div>`
        : html`<div class="table-scroll">
            <!-- A card per service on a phone, its date the heading; the Past
                 or Upcoming chip needs no name in front of it. -->
            <table class="grid stack">
              <thead><tr><th>When</th><th>Service</th><th>Type</th><th>Where</th><th></th></tr></thead>
              <tbody>
                ${services.map(
                  (s) => html`<tr>
                    <td class="stack-title">
                      <a href="/app/rota/service/${s.id}">${formatDate(s.service_date)}</a>
                      <div class="num" style="color:var(--ink-2);font-size:.9375rem">${s.service_time}</div>
                    </td>
                    <td data-label="Service">${s.title ?? 'Worship'}</td>
                    <td data-label="Type">${s.type_name ?? '—'}</td>
                    <td data-label="Where" style="color:var(--ink-2)">${s.location ?? 'Church'}</td>
                    <td>${s.service_date < today ? chip('neutral', 'Past') : chip('green', 'Upcoming')}</td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`}
    `,
  );
}
