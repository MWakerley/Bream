import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDateTime } from './rota.js';
import { howLongAgo } from './person.js';

const SETTINGS = { href: '/app/settings', label: 'Admin Centre' };

/** One person with a sign-in, and how much they have used it. */
export interface LoginSummaryRow {
  id: number;
  display_name: string;
  profile_name: string | null;
  is_active: number;
  last_sign_in_at: string | null;
  /** Sign-ins in the last 30 days. */
  recent: number;
  /** Every sign-in on record. */
  total: number;
}

/** One sign-in, for the list of the latest. */
export interface SignInRow {
  person_id: number;
  display_name: string;
  signed_in_at: string;
}

/**
 * Login history: who has been using the system, and when.
 *
 * Two views of the same rows. The table answers "is everybody we gave a sign-in
 * actually using it" — one line per person, never-used accounts included, since
 * that is often the thing worth noticing. The list underneath answers "who has
 * been on lately", newest first.
 */
export function loginHistoryPage(opts: {
  people: LoginSummaryRow[];
  latest: SignInRow[];
  /** How many sign-ins the list of the latest leaves out. */
  more: number;
  /** When the earliest sign-in on record happened, if there is one. */
  since: string | null;
  ctx: ViewCtx;
  today?: Date;
}) {
  const today = opts.today ?? new Date();
  const used = opts.people.filter((p) => p.last_sign_in_at);
  const never = opts.people.filter((p) => !p.last_sign_in_at);
  const lately = opts.people.filter((p) => p.recent > 0);

  return layout(
    { title: 'Login history', back: SETTINGS, ...opts.ctx },
    html`
      <p class="page-intro">
        Who has signed in to the system, and when.
        ${opts.people.length
          ? html`${opts.people.length} ${opts.people.length === 1 ? 'person has' : 'people have'} a sign-in;
              ${lately.length} signed in during the last 30 days${never.length
                ? html`, and ${never.length} never ${never.length === 1 ? 'has' : 'have'}` : ''}.`
          : 'Nobody has been given a sign-in yet.'}
      </p>
      <p class="hint" style="margin-top:-.5rem">
        ${opts.since
          ? html`Sign-ins are on record from ${formatDateTime(opts.since)}. Before this page
              existed only each person's latest sign-in was kept, so earlier ones are not here.`
          : 'Every sign-in from now on is recorded here.'}
        Only successful sign-ins are listed.
      </p>

      ${opts.people.length
        ? html`<h2 class="section-h2">By person</h2>
          <div class="table-scroll">
            <!-- A card per person on a phone (.stack in app.css). Never-used
                 accounts sort last, and say so rather than showing a blank. -->
            <table class="grid stack" id="login-people">
              <thead><tr>
                <th>Name</th><th>Last signed in</th><th>Last 30 days</th><th>On record</th><th>Can see</th>
              </tr></thead>
              <tbody>
                ${[...used, ...never].map((p) => html`<tr>
                  <td class="stack-title">
                    <a href="/app/settings/people/${p.id}"><strong>${p.display_name}</strong></a>
                    ${p.is_active ? '' : chip('amber', 'No longer serving')}
                  </td>
                  <td data-label="Last signed in">
                    ${p.last_sign_in_at
                      ? html`${formatDateTime(p.last_sign_in_at)}
                          <div style="font-size:.9375rem;color:var(--ink-2)">${howLongAgo(p.last_sign_in_at, today)}</div>`
                      : chip('amber', 'Never')}
                  </td>
                  <td data-label="Last 30 days">${p.recent ? `${p.recent} time${p.recent === 1 ? '' : 's'}` : '—'}</td>
                  <td data-label="On record">${p.total || '—'}</td>
                  <td data-label="Can see" style="color:var(--ink-2)">${p.profile_name ?? 'nothing — no profile'}</td>
                </tr>`)}
              </tbody>
            </table>
          </div>`
        : ''}

      ${opts.latest.length
        ? html`<h2 class="section-h2">Latest sign-ins</h2>
          <div class="table-scroll">
            <table class="grid stack" id="login-latest">
              <thead><tr><th>When</th><th>Who</th></tr></thead>
              <tbody>
                ${opts.latest.map((s) => html`<tr>
                  <td class="stack-title">${formatDateTime(s.signed_in_at)}</td>
                  <td data-label="Who"><a href="/app/settings/people/${s.person_id}">${s.display_name}</a></td>
                </tr>`)}
              </tbody>
            </table>
          </div>
          ${opts.more
            ? html`<p class="hint">The latest ${opts.latest.length} are shown; ${opts.more} older
                ${opts.more === 1 ? 'is' : 'are'} counted in the table above.</p>`
            : ''}`
        : ''}
    `,
  );
}
