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
}) {
  const { services, types, ctx, notice } = opts;
  const today = new Date().toISOString().slice(0, 10);

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
            <input id="date" name="date" type="date" required>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="time">Time</label>
            <input id="time" name="time" type="time" value="10:30" required>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="type">Type</label>
            <select id="type" name="service_type_id">
              ${types.map((t) => html`<option value="${t.id}">${t.name}</option>`)}
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:1rem">
          <label for="title">Title</label>
          <span class="hint">What it is called on the rota, e.g. "Carols by Candlelight".</span>
          <input id="title" name="title" type="text" required>
        </div>
        <div class="field">
          <label for="location">Where</label>
          <span class="hint">Leave blank for the church.</span>
          <input id="location" name="location" type="text" placeholder="Bream Cenotaph">
        </div>
        <button class="btn-primary" type="submit">Add this service</button>
      </form>

      <h2 class="section-h2">All services (${services.length})</h2>
      ${services.length === 0
        ? html`<div class="card"><p style="margin:0">None yet.</p></div>`
        : html`<div class="table-scroll">
            <table class="grid">
              <thead><tr><th>When</th><th>Service</th><th>Type</th><th>Where</th><th></th></tr></thead>
              <tbody>
                ${services.map(
                  (s) => html`<tr>
                    <td>
                      <a href="/app/rota/service/${s.id}">${formatDate(s.service_date)}</a>
                      <div class="num" style="color:var(--ink-2);font-size:.9375rem">${s.service_time}</div>
                    </td>
                    <td>${s.title ?? 'Worship'}</td>
                    <td>${s.type_name ?? '—'}</td>
                    <td style="color:var(--ink-2)">${s.location ?? 'Church'}</td>
                    <td>${s.service_date < today ? chip('neutral', 'Past') : chip('green', 'Upcoming')}</td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`}
    `,
  );
}
