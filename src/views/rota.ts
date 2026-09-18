import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { viewTabs } from './calendar.js';
import type { ServiceDetail, ServiceSummary } from '../db.js';

const BACK = { href: '/app', label: 'All areas' };

/** '2026-11-15' -> 'Sun 15 Nov 2026'. Built from the ISO string rather than a
 *  Date, so it cannot drift by a day depending on the runtime's timezone. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dow = days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  return `${dow} ${d} ${months[m - 1]} ${y}`;
}

/**
 * '2026-09-18 14:07:33' -> 'Thu 18 Sep 2026 at 14:07'.
 *
 * SQLite's datetime('now') is UTC with a space in the middle. Britain is an hour
 * ahead of that for half the year, so the time is converted for display rather
 * than sliced out of the string — otherwise a sign-in at nine in the morning in
 * June would be reported as eight.
 */
export function formatDateTime(sqlite: string): string {
  const iso = `${sqlite.replace(' ', 'T')}${/[Zz]|[+-]\d\d:?\d\d$/.test(sqlite) ? '' : 'Z'}`;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return sqlite;

  // Intl is used only to find which local date and time this instant falls on;
  // the words come from formatDate. Letting Intl name the month too would print
  // "Sept", since that is en-GB's short form, while every other date on the page
  // says "Sep" — the same day, spelled two ways, on one screen.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(when);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  // en-GB renders midnight as hour 24, which is not a date this function should
  // ever produce — it belongs to the following day, which the parts already say.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${formatDate(`${get('year')}-${get('month')}-${get('day')}`)} at ${hour}:${get('minute')}`;
}

/**
 * One service as a card.
 *
 * Cards rather than table rows because a service is a thing, not a row of
 * figures — and because a whole row washed red reads as an error rather than as
 * "somebody still to find". The state shows in a coloured edge and a chip, so
 * colour is never carrying the meaning on its own.
 */
function serviceCard(s: ServiceSummary) {
  const state = s.gaps.length ? 'gap' : s.short.length ? 'short' : 'ok';
  const [y, m, d] = s.service_date.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dow = days[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';

  return html`<li>
    <a class="svc svc-${state}" href="/app/rota/service/${s.id}">
      <span class="svc-date" aria-hidden="true">
        <span class="svc-dow">${dow}</span>
        <span class="svc-dd">${d}</span>
        <span class="svc-mon">${months[(m ?? 1) - 1]}</span>
      </span>
      <span class="svc-body">
        <span class="svc-top">
          <span class="svc-title">${s.title ?? 'Worship'}</span>
          <span class="svc-time">${s.service_time}</span>
        </span>
        <span class="sr-only">${formatDate(s.service_date)}</span>
        ${s.location ? html`<span class="svc-where">${s.location}</span>` : ''}
        <span class="svc-meta">
          ${state === 'gap'
            ? html`${chip('red', `${s.gaps.length} still to find`)}
                <span class="svc-detail">Nobody on ${s.gaps.join(', ')}</span>`
            : state === 'short'
              ? html`${chip('amber', 'Below ideal')}
                  <span class="svc-detail">Could do with more on ${s.short.join(', ')}</span>`
              : html`${chip('green', 'Everyone in place')}
                  <span class="svc-detail">${s.filled} people</span>`}
        </span>
      </span>
      <span class="svc-go" aria-hidden="true">→</span>
    </a>
  </li>`;
}

/**
 * The next service, at a glance.
 *
 * The thing somebody opening this page almost always wants is "who is on this
 * Sunday" — and until now that took a click. Everything the service needs is
 * here, including the roles nobody is on, because an empty slot is the part
 * worth seeing.
 */
function nextServiceCard(next: ServiceDetail) {
  const gaps = next.roles.filter((r) => r.people.length < r.min_needed);
  return html`
    <section class="next-up">
      <div class="next-up-head">
        <div>
          <p class="next-up-when">Next service · ${formatDate(next.service_date)} at ${next.service_time}</p>
          <h2 class="next-up-title">${next.title ?? 'Worship'}</h2>
          ${next.location ? html`<p class="next-up-where">${next.location}</p>` : ''}
        </div>
        <div class="next-up-status">
          ${gaps.length
            ? chip('red', `${gaps.length} role${gaps.length === 1 ? '' : 's'} unfilled`)
            : chip('green', 'Everyone is in place')}
        </div>
      </div>

      ${next.readings || next.sermon_title
        ? html`<p class="next-up-readings">
            ${next.sermon_title ? html`<strong>${next.sermon_title}</strong>` : ''}
            ${next.sermon_title && next.readings ? ' · ' : ''}
            ${next.readings ?? ''}
          </p>`
        : ''}

      <ul class="next-up-roles">
        ${next.roles.map(
          (r) => html`<li class="${r.people.length < r.min_needed ? 'is-empty' : ''}">
            <span class="nu-role">${r.role_name}</span>
            <span class="nu-who">
              ${r.people.length ? r.people.join(', ') : 'nobody yet'}
            </span>
          </li>`,
        )}
      </ul>

      <p class="next-up-more">
        <a class="btn-secondary" href="/app/rota/service/${next.id}">Open this service</a>
      </p>
    </section>`;
}

export function rotaDashboard(
  services: ServiceSummary[],
  ctx: ViewCtx,
  next?: ServiceDetail | null,
) {
  const withGaps = services.filter((s) => s.gaps.length);
  return layout(
    { title: 'The rota', back: BACK, ...ctx },
    html`
      ${viewTabs('list', '/app/rota', '/app/rota/calendar')}

      ${next ? nextServiceCard(next) : ''}

      <p class="page-intro">Everything coming up. Click a date to see who is on what.</p>

      <div class="btn-row" style="margin-bottom:1.5rem">
        <a class="btn-primary" href="/app/settings/services#add-one">Add a service</a>
        <a class="btn-secondary" href="/app/rota/gaps">Unfilled roles</a>
        <a class="btn-secondary" href="/app/rota/requests">People who cannot make it</a>
        <a class="btn-secondary" href="/app/rota/readings">Readings</a>
        <a class="btn-secondary" href="/app/rota/generate">Generate a whole draft</a>
      </div>

      ${withGaps.length
        ? html`<div class="notice notice-bad" role="status">
            <p style="margin:0">
              <strong>${withGaps.length}</strong> of the next ${services.length} services
              ${withGaps.length === 1 ? 'has a role' : 'have roles'} with nobody assigned.
              <a href="/app/rota/gaps">See just those</a>.
            </p>
          </div>`
        : services.length
          ? html`<div class="notice notice-ok"><p style="margin:0">Every upcoming service has its required roles filled.</p></div>`
          : ''}

      ${services.length === 0
        ? html`<div class="card"><p style="margin:0">
            No upcoming services yet.
            <a href="/app/settings/services#add-one">Add one</a>, or
            <a href="/app/settings/services">set up the Sunday pattern</a>.
          </p></div>`
        : html`<ul class="svc-list">${services.map(serviceCard)}</ul>`}
    `,
  );
}

export function gapsPage(services: ServiceSummary[], ctx: ViewCtx) {
  const withGaps = services.filter((s) => s.gaps.length);
  return layout(
    { title: 'Unfilled roles', back: { href: '/app/rota', label: 'The rota' }, ...ctx },
    html`
      <p class="page-intro">
        Services where a role is below the minimum it needs. Roles that are merely below
        their ideal are not listed here — those show on the rota as "below ideal".
      </p>
      ${withGaps.length === 0
        ? html`<div class="notice notice-ok"><p style="margin:0">Nothing unfilled. Every upcoming service has its minimum covered.</p></div>`
        : html`<div class="table-scroll">
            <table class="grid">
              <thead><tr><th>When</th><th>Service</th><th>Nobody assigned to</th></tr></thead>
              <tbody>
                ${withGaps.map(
                  (s) => html`<tr class="row-gap">
                    <td>
                      <a href="/app/rota/service/${s.id}"><strong>${formatDate(s.service_date)}</strong></a>
                      <div class="num" style="color:var(--ink-2);font-size:.9375rem">${s.service_time}</div>
                    </td>
                    <td>${s.title ?? 'Worship'}</td>
                    <td><strong style="color:var(--bad)">${s.gaps.join(', ')}</strong></td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`}
    `,
  );
}

export function servicePage(s: ServiceDetail, ctx: ViewCtx) {
  const gaps = s.roles.filter((r) => r.people.length < r.min_needed);
  return layout(
    {
      title: `${formatDate(s.service_date)} ${s.service_time}`,
      heading: s.title ?? 'Worship',
      back: { href: '/app/rota', label: 'The rota' },
      ...ctx,
    },
    html`
      <p class="page-intro">
        ${formatDate(s.service_date)} at ${s.service_time}${s.location ? `, ${s.location}` : ''}
        ${s.is_communion ? html` · ${chip('neutral', 'Communion')}` : ''}
      </p>

      ${gaps.length
        ? html`<div class="notice notice-bad" role="status">
            <p style="margin:0">
              Nobody is assigned to
              <strong>${gaps.map((g) => g.role_name).join(', ')}</strong>.
            </p>
          </div>`
        : ''}

      <div class="card">
        <h2 style="margin-top:0;font-family:var(--serif);font-weight:500">Readings and sermon</h2>
        <p style="margin-bottom:.35rem"><strong>Readings:</strong>
          ${s.readings ?? html`<span style="color:var(--ink-2)">not set yet</span>`}</p>
        <p style="margin-bottom:0"><strong>Sermon title:</strong>
          ${s.sermon_title ?? html`<span style="color:var(--ink-2)">not set yet</span>`}</p>
        <p style="margin-bottom:0;margin-top:.75rem">
          <a href="/app/rota/readings">Edit readings and sermon titles</a>
        </p>
      </div>

      <div class="table-scroll">
        <table class="grid">
          <thead><tr><th>Role</th><th>Who</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${s.roles.map((r) => {
              const short = r.people.length < r.min_needed;
              const belowIdeal = !short && r.people.length < r.ideal_needed;
              return html`<tr class="${short ? 'row-gap' : ''}">
                <td><strong>${r.role_name}</strong></td>
                <td>
                  ${r.people.length
                    ? r.people.join(', ')
                    : html`<span style="color:var(--bad);font-weight:600">nobody yet</span>`}
                </td>
                <td>
                  ${short
                    ? chip('red', `${r.min_needed - r.people.length} short`)
                    : belowIdeal
                      ? chip('amber', 'Below ideal')
                      : chip('green', 'OK')}
                </td>
                <td>
                  <form method="post" action="/app/rota/service/${s.id}/role/${r.role_id}/off"
                        class="inline-form">
                    <button class="linkish" type="submit"
                            title="This service does not need ${r.role_name} at all">
                      Not needed here
                    </button>
                  </form>
                </td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>

      ${s.notApplicable.length
        ? html`<h2 class="section-h2">Not needed at this service</h2>
            <div class="card">
              <p style="margin-top:0;color:var(--ink-2)">
                These roles are switched off here, so they are not counted as gaps.
              </p>
              <table class="grid">
                <tbody>
                  ${s.notApplicable.map(
                    (n) => html`<tr>
                      <td><strong>${n.role_name}</strong></td>
                      <td style="color:var(--ink-2)">${n.note ?? '—'}</td>
                      <td style="text-align:right">
                        <form method="post"
                              action="/app/rota/service/${s.id}/role/${n.role_id}/on"
                              class="inline-form">
                          <button class="linkish" type="submit">Put it back</button>
                        </form>
                      </td>
                    </tr>`,
                  )}
                </tbody>
              </table>
            </div>`
        : ''}
    `,
  );
}

export function readingsPage(services: ServiceSummary[], ctx: ViewCtx, saved?: string) {
  return layout(
    { title: 'Readings and sermon titles', back: { href: '/app/rota', label: 'The rota' }, ...ctx },
    html`
      <p class="page-intro">
        For the vicar. Fill these in ahead of time and they appear on every view of the
        service. Each row saves on its own.
      </p>

      ${saved ? html`<div class="notice notice-ok" role="status"><p style="margin:0">Saved ${saved}.</p></div>` : ''}

      ${services.map(
        (s) => html`<form method="post" action="/app/rota/readings" class="card">
          <input type="hidden" name="service_id" value="${s.id}">
          <h2 style="margin:0 0 .75rem;font-family:var(--serif);font-weight:500;font-size:1.25rem">
            ${formatDate(s.service_date)}, ${s.service_time} — ${s.title ?? 'Worship'}
          </h2>
          <div class="field">
            <label for="readings-${s.id}">Readings</label>
            <input id="readings-${s.id}" name="readings" type="text"
                   value="${s.readings ?? ''}" placeholder="e.g. Rom 8:18-30, Luke 21:25-36">
          </div>
          <div class="field">
            <label for="sermon-${s.id}">Sermon title</label>
            <input id="sermon-${s.id}" name="sermon_title" type="text" value="${s.sermon_title ?? ''}">
          </div>
          <button class="btn-primary" type="submit">Save this service</button>
        </form>`,
      )}
    `,
  );
}
