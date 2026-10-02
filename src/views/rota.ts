import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { viewTabs } from './calendar.js';
import type { Candidate, ServiceDetail, ServiceSummary } from '../db.js';

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
 * A span of time, in words — an event, or a room held for one.
 *
 *   Sat 10 Oct 2026 at 19:00                        no finish recorded
 *   Sat 10 Oct 2026, 19:00–21:00                    one day
 *   Sat 10 Oct 2026 19:00 to Sun 11 Oct 2026 16:00  runs over
 *
 * Takes 'YYYY-MM-DDTHH:MM' strings, as they are stored.
 */
export function formatSpan(startsAt: string, endsAt: string | null): string {
  const start = formatDate(startsAt.slice(0, 10));
  if (!endsAt) return `${start} at ${startsAt.slice(11, 16)}`;
  if (lastDay(startsAt, endsAt) === startsAt.slice(0, 10)) {
    const until = endsAt.slice(11, 16) === '00:00' ? 'midnight' : endsAt.slice(11, 16);
    return `${start}, ${startsAt.slice(11, 16)}–${until}`;
  }
  return `${start} ${startsAt.slice(11, 16)} to ${formatDate(endsAt.slice(0, 10))} ${endsAt.slice(11, 16)}`;
}

/**
 * The last day something actually takes place on.
 *
 * Its finish date — except that finishing at exactly midnight means finishing
 * at the end of the day before. An evening from 19:00 to midnight is stored as
 * ending at 00:00 the next day, and it is still one evening: the diary must
 * not show the room taken on the Sunday, and the booking page must not call it
 * a two-day event. Every "which days" question goes through here so the
 * answers cannot drift apart.
 */
export function lastDay(startsAt: string, endsAt: string): string {
  const end = endsAt.slice(0, 10);
  if (endsAt.slice(11, 16) === '00:00' && end > startsAt.slice(0, 10)) {
    return new Date(Date.parse(`${end}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  }
  return end;
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
 * "Reader 1 of 2" — a role that has somebody on it but fewer than wanted.
 *
 * Deliberately never called unfilled. Somebody IS doing it; what is missing is a
 * second pair of hands, and the wording has to say which of those two problems
 * this is. Calling both "unfilled" made a service with one reader look exactly
 * like a service with none.
 */
export function describeUnder(under: { role: string; filled: number; min: number }[]): string {
  return under.map((u) => `${u.role} ${u.filled} of ${u.min}`).join(', ');
}

/** A red dot for a critical role that is missing. Paired with words every time,
 *  so the colour never carries the meaning on its own. */
const RED_DOT = html`<span class="crit-dot" aria-hidden="true"></span>`;

/**
 * One service as a card, with the full roster folded away underneath it.
 *
 * Cards rather than table rows because a service is a thing, not a row of
 * figures. Four states, worst first:
 *
 *   critical — a role the church marked critical to the service is below its
 *              minimum. A red dot, "Key roles missing", and the card washed red.
 *   short    — some other role has nobody, or too few. "Short-handed", amber:
 *              worth sorting, but the service can go ahead.
 *   ideal    — everything has its minimum, some roles could use more.
 *   ok       — everyone in place.
 */
function serviceCard(s: ServiceSummary, detail?: ServiceDetail) {
  const critical = s.critical ?? [];
  const minorGaps = s.gaps.filter((r) => !critical.includes(r));
  const minorUnder = s.under.filter((u) => !critical.includes(u.role));
  const minor = [...minorGaps, ...minorUnder.map((u) => u.role)];
  const minorText = [
    minorGaps.length ? `nobody on ${minorGaps.join(', ')}` : '',
    minorUnder.length ? describeUnder(minorUnder) : '',
  ].filter(Boolean).join(' · ');
  const state = critical.length ? 'critical' : minor.length ? 'under' : s.short.length ? 'short' : 'ok';
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
          ${state === 'critical'
            ? html`<span class="chip chip-red chip-critical">${RED_DOT}Key roles missing</span>
                <span class="svc-detail">Still to book: ${critical.join(', ')}${minor.length
                  ? ` · also ${minorText}` : ''}</span>`
            : state === 'under'
              ? html`${chip('amber', 'Short-handed')}
                  <span class="svc-detail">${minorText.charAt(0).toUpperCase() + minorText.slice(1)}</span>`
              : state === 'short'
                ? html`${chip('amber', 'Below ideal')}
                    <span class="svc-detail">Could do with more on ${s.short.join(', ')}</span>`
                : html`${chip('green', 'Everyone in place')}
                    <span class="svc-detail">${s.filled} people</span>`}
        </span>
      </span>
      <span class="svc-go" aria-hidden="true">→</span>
    </a>
    ${detail
      ? html`<details class="svc-more">
          <summary>Who is on what</summary>
          ${roster(detail)}
        </details>`
      : ''}
  </li>`;
}

/**
 * Every role on a service and who is on it. The same view whether it is the
 * next service at the top of the page or one opened out further down.
 */
function roster(s: ServiceDetail) {
  return html`
    ${s.readings || s.sermon_title
      ? html`<p class="next-up-readings">
          ${s.sermon_title ? html`<strong>${s.sermon_title}</strong>` : ''}
          ${s.sermon_title && s.readings ? ' · ' : ''}
          ${s.readings ?? ''}
        </p>`
      : ''}
    <ul class="next-up-roles">
      ${s.roles.map((r) => {
        const below = r.people.length < r.min_needed;
        const cls = r.is_critical && below ? 'is-critical'
          : r.people.length === 0 ? 'is-empty' : below ? 'is-under' : '';
        return html`<li class="${cls}">
          <span class="nu-role">${cls === 'is-critical' ? RED_DOT : ''}${r.role_name}</span>
          <span class="nu-who">
            ${r.people.length
              ? html`${r.people.map((a) => a.display_name).join(', ')}${below
                  ? html` <span class="nu-note">${r.people.length} of ${r.min_needed}</span>`
                  : ''}`
              : cls === 'is-critical' ? 'nobody yet — critical' : 'nobody yet'}
          </span>
        </li>`;
      })}
    </ul>`;
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
  const below = next.roles.filter((r) => r.people.length < r.min_needed);
  const critical = below.filter((r) => r.is_critical);
  return html`
    <section class="next-up">
      <div class="next-up-head">
        <div>
          <p class="next-up-when">Next service · ${formatDate(next.service_date)} at ${next.service_time}</p>
          <h2 class="next-up-title">${next.title ?? 'Worship'}</h2>
          ${next.location ? html`<p class="next-up-where">${next.location}</p>` : ''}
        </div>
        <div class="next-up-status">
          ${critical.length
            ? html`<span class="chip chip-red chip-critical">${RED_DOT}Key roles missing</span>`
            : below.length
              ? chip('amber', `Short-handed on ${below.length} role${below.length === 1 ? '' : 's'}`)
              : chip('green', 'Everyone is in place')}
        </div>
      </div>

      ${roster(next)}

      <p class="next-up-more">
        <a class="btn-secondary" href="/app/rota/service/${next.id}">Open this service</a>
      </p>
    </section>`;
}

export function rotaDashboard(
  services: ServiceSummary[],
  ctx: ViewCtx,
  next?: ServiceDetail | null,
  /** Every listed service in full, so each can open out to show its roster. */
  details?: Map<number, ServiceDetail>,
  /** What a draft just applied did, including anything it left alone. */
  notice?: { tone: 'ok' | 'warn'; text: string },
) {
  const withCritical = services.filter((s) => (s.critical ?? []).length);
  const withGaps = services.filter((s) => s.gaps.length);
  // Short-handed but with nobody actually missing. Kept apart from withGaps so
  // the headline number means one thing only: services needing somebody found.
  const underOnly = services.filter((s) => !s.gaps.length && s.under.length);
  return layout(
    { title: 'The rota', back: BACK, ...ctx },
    html`
      ${viewTabs('list', '/app/rota', '/app/rota/calendar')}

      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      ${next ? nextServiceCard(next) : ''}

      <p class="page-intro">Everything coming up. Click a date to see who is on what.</p>

      <div class="btn-row" style="margin-bottom:1.5rem">
        <a class="btn-primary" href="/app/settings/services#add-one">Add a service</a>
        <a class="btn-secondary" href="/app/rota/gaps">Unfilled roles</a>
        <a class="btn-secondary" href="/app/rota/requests">People who cannot make it</a>
        <a class="btn-secondary" href="/app/rota/readings">Readings</a>
        <a class="btn-secondary" href="/app/settings/generate">Generate a whole draft</a>
      </div>

      <div class="btn-row" style="margin:-.75rem 0 1.5rem">
        <span style="color:var(--ink-2);align-self:center">Every future service, to send or print:</span>
        <a class="btn-quiet" href="/app/rota/export.pdf">Download PDF</a>
        <a class="btn-quiet" href="/app/rota/export.xlsx">Download for Excel</a>
      </div>

      ${withCritical.length
        ? html`<div class="notice notice-bad" role="alert">
            <p style="margin:0">
              <span class="crit-dot" aria-hidden="true"></span>
              <strong>Key roles are missing.</strong>
              ${withCritical.length} of the next ${services.length} services
              ${withCritical.length === 1 ? 'is' : 'are'} missing a role marked critical to the
              service: ${withCritical.map((s) => `${formatDate(s.service_date)} (${(s.critical ?? []).join(', ')})`).join('; ')}.
            </p>
          </div>`
        : ''}

      ${withGaps.length
        ? html`<div class="notice notice-warn" role="status">
            <p style="margin:0">
              <strong>${withGaps.length}</strong> of the next ${services.length} services
              ${withGaps.length === 1 ? 'has a role' : 'have roles'} with nobody at all on it.
              <a href="/app/rota/gaps">See just those</a>.
            </p>
          </div>`
        : underOnly.length
          ? html`<div class="notice notice-warn" role="status">
              <p style="margin:0">
                Every role on every upcoming service has somebody on it.
                <strong>${underOnly.length}</strong>
                ${underOnly.length === 1 ? 'service is' : 'services are'} short-handed —
                fewer people than you would like, but nobody missing.
                <a href="/app/rota/gaps">See which</a>.
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
        : html`<ul class="svc-list">${services.map((s) => serviceCard(s, details?.get(s.id)))}</ul>`}
    `,
  );
}

export function gapsPage(services: ServiceSummary[], ctx: ViewCtx) {
  const withGaps = services.filter((s) => s.gaps.length);
  const underOnly = services.filter((s) => !s.gaps.length && s.under.length);
  return layout(
    { title: 'Roles that need somebody', back: { href: '/app/rota', label: 'The rota' }, ...ctx },
    html`
      <p class="page-intro">
        Two different problems, kept apart. <strong>Nobody on it</strong> means the role has
        not been given to anyone. <strong>Short-handed</strong> means somebody is doing it,
        but fewer people than the role asks for.
      </p>

      <h2 class="section-h2">Nobody on it</h2>
      ${withGaps.length === 0
        ? html`<div class="notice notice-ok"><p style="margin:0">
            Nothing unfilled. Every role on every upcoming service has somebody on it.
          </p></div>`
        : html`<div class="table-scroll">
            <!-- On a phone each service is a card, its date the heading. -->
            <table class="grid stack">
              <thead><tr><th>When</th><th>Service</th><th>Nobody assigned to</th></tr></thead>
              <tbody>
                ${withGaps.map(
                  (s) => html`<tr class="row-gap">
                    <td class="stack-title">
                      <a href="/app/rota/service/${s.id}"><strong>${formatDate(s.service_date)}</strong></a>
                      <div class="num" style="color:var(--ink-2);font-size:.9375rem">${s.service_time}</div>
                    </td>
                    <td data-label="Service">${s.title ?? 'Worship'}</td>
                    <td data-label="Nobody assigned to"><strong style="color:var(--bad)">${s.gaps.join(', ')}</strong></td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`}

      <h2 class="section-h2">Short-handed</h2>
      ${underOnly.length === 0
        ? html`<div class="notice notice-ok"><p style="margin:0">
            Nothing short-handed either — every role has the number of people it asks for.
          </p></div>`
        : html`<p style="color:var(--ink-2)">
              Somebody is doing each of these. A second pair of hands would help, but nothing
              here is unfilled.
            </p>
            <!-- On a phone the last name is the heading less its "on": whole,
                 it took two lines of the card's narrow column of names. -->
            <div class="table-scroll">
              <table class="grid stack">
                <thead><tr><th>When</th><th>Service</th><th>Could do with more on</th></tr></thead>
                <tbody>
                  ${underOnly.map(
                    (s) => html`<tr>
                      <td class="stack-title">
                        <a href="/app/rota/service/${s.id}"><strong>${formatDate(s.service_date)}</strong></a>
                        <div class="num" style="color:var(--ink-2);font-size:.9375rem">${s.service_time}</div>
                      </td>
                      <td data-label="Service">${s.title ?? 'Worship'}</td>
                      <td data-label="Could do with more"><strong style="color:var(--warn)">${describeUnder(s.under)}</strong></td>
                    </tr>`,
                  )}
                </tbody>
              </table>
            </div>`}
    `,
  );
}

/**
 * "Sue Baker — on a break, away that day".
 *
 * Everyone in this list can already do the role, so that is not worth saying.
 * What IS worth saying is anything the person clicking might not know: nobody
 * is hidden on the strength of these, because a churchwarden ringing round on a
 * Saturday night knows more than the roster does.
 */
function candidateLabel(c: Candidate): string {
  const notes = [
    c.on_break ? 'on a break' : '',
    c.is_guest ? 'guest' : '',
    c.away ? 'away that day' : '',
  ].filter(Boolean);
  return notes.length ? `${c.display_name} — ${notes.join(', ')}` : c.display_name;
}

export function servicePage(
  s: ServiceDetail,
  ctx: ViewCtx,
  /** Who can be put on each role by hand. Absent means the pickers are hidden,
   *  which is what a viewer without the right to change the rota sees. */
  candidatesFor?: Map<number, Candidate[]>,
) {
  // Nobody on it at all, versus somebody on it but not enough of them. Only
  // the first is a role that needs filling.
  const empty = s.roles.filter((r) => r.people.length === 0);
  const under = s.roles.filter((r) => r.people.length > 0 && r.people.length < r.min_needed);
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

      ${empty.length
        ? html`<div class="notice notice-bad" role="status">
            <p style="margin:0">
              Nobody is assigned to
              <strong>${empty.map((g) => g.role_name).join(', ')}</strong>.
            </p>
          </div>`
        : ''}

      ${under.length
        ? html`<div class="notice notice-warn" role="status">
            <p style="margin:0">
              Everything here has somebody on it. These roles ask for more people than they
              have: <strong>${under.map((r) => `${r.role_name} ${r.people.length} of ${r.min_needed}`).join(', ')}</strong>.
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

      <!-- On a phone each role is a card: its name, who is on it, how it
           stands, then its button. The table was 680px wide there, with Status
           and "Not needed here" off the right edge — on the page people check
           on a Sunday morning. "Who" goes unlabelled: a list of names, or
           "nobody yet", says what it is. -->
      <div class="table-scroll">
        <table class="grid stack">
          <thead><tr><th>Role</th><th>Who</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${s.roles.map((r) => {
              const nobody = r.people.length === 0;
              const short = !nobody && r.people.length < r.min_needed;
              const belowIdeal = !nobody && !short && r.people.length < r.ideal_needed;
              return html`<tr class="${nobody ? 'row-gap' : ''}">
                <td class="stack-title"><strong>${r.role_name}</strong></td>
                <td>
                  ${r.people.length
                    ? html`<ul class="assignees">
                        ${r.people.map((a) => html`<li>
                          <span class="assignee-name">${a.display_name}</span>
                          ${a.status === 'draft' ? chip('neutral', 'draft') : ''}
                          ${a.on_break ? chip('amber', 'on a break') : ''}
                          ${a.is_guest ? chip('navy', 'guest') : ''}
                          ${candidatesFor
                            ? html`<form method="post"
                                action="/app/rota/service/${s.id}/assignment/${a.assignment_id}/remove"
                                class="inline-form"
                                data-confirm="Take ${a.display_name} off ${r.role_name} for this service?"
                                onsubmit="return confirm(this.dataset.confirm)">
                            <button class="linkish" type="submit" style="color:var(--bad)"
                                    title="Take ${a.display_name} off ${r.role_name}">Take off</button>
                          </form>`
                            : ''}
                        </li>`)}
                      </ul>`
                    : html`<span style="color:var(--bad);font-weight:600">nobody yet</span>`}

                  <!-- Everybody active is offered, not only those the generator
                       would pick. A guest preacher is chosen exactly this way and
                       would never appear otherwise, and somebody on a break may
                       still say yes when asked directly. The list says who is on
                       a break, who is away and who cannot normally do the role,
                       and then leaves the decision to the person clicking. -->
                  ${candidatesFor
                    ? html`<form method="post" action="/app/rota/service/${s.id}/role/${r.role_id}/add"
                        class="add-person">
                    <label class="sr-only" for="add-${r.role_id}">Put somebody on ${r.role_name}</label>
                    <select id="add-${r.role_id}" name="person_id" required>
                      <option value="">Put somebody on…</option>
                      ${(candidatesFor?.get(r.role_id) ?? [])
                        .filter((cand) => !cand.already_here)
                        .map((cand) => html`<option value="${cand.id}">${candidateLabel(cand)}</option>`)}
                    </select>
                    <button class="btn-secondary" type="submit">Add</button>
                  </form>
                  ${(candidatesFor?.get(r.role_id) ?? []).filter((cand) => !cand.already_here).length === 0
                    ? html`<p class="hint" style="margin:.35rem 0 0">
                        Nobody else is ticked for ${r.role_name}.
                        <a href="/app/settings/people/by-role?role=${r.role_id}">Tick somebody</a>
                        and they will appear here.
                      </p>`
                    : ''}`
                    : ''}
                </td>
                <td data-label="Status">
                  ${nobody
                    ? chip('red', 'Nobody on it')
                    : short
                      ? chip('red', `${r.people.length} of ${r.min_needed}`)
                      : belowIdeal
                        ? chip('amber', 'Below ideal')
                        : chip('green', 'OK')}
                </td>
                <td class="stack-actions">
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
              <!-- The button keeps to the right on a computer. On a phone it is
                   a stack-actions row, a flex box, where text-align does not
                   move it: it starts at the left like every other card's. -->
              <table class="grid stack">
                <tbody>
                  ${s.notApplicable.map(
                    (n) => html`<tr>
                      <td class="stack-title"><strong>${n.role_name}</strong></td>
                      <td style="color:var(--ink-2)">${n.note ?? '—'}</td>
                      <td class="stack-actions" style="text-align:right">
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
