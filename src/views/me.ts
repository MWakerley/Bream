import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate } from './rota.js';

export interface MyDuty {
  assignment_id: number;
  service_id: number;
  service_date: string;
  service_time: string;
  title: string | null;
  role_name: string;
  status: string;
  request_status: string | null;
}

export interface AwayRow {
  id: number;
  from_date: string;
  to_date: string;
  reason: string | null;
}

export interface ChangeRequestRow {
  id: number;
  person_name: string;
  role_name: string;
  service_date: string;
  service_time: string;
  title: string | null;
  kind: string;
  message: string | null;
  status: string;
  created_at: string;
}

const BACK = { href: '/app', label: 'All areas' };

/** What one person is down for, and the two things they can do about it. */
export interface LinkCandidate { id: number; display_name: string; duties: number }

export function myRotaPage(opts: {
  duties: MyDuty[];
  away: AwayRow[];
  ctx: ViewCtx;
  /** Other records that might be the same person, offered when you have none. */
  candidates?: LinkCandidate[];
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { duties, away, ctx, notice } = opts;
  const candidates = opts.candidates ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return layout(
    {
      title: 'My rota',
      eyebrow: 'You',
      heading: 'What you are down for',
      intro: 'Your own dates. If you cannot make one, say so here and whoever builds the rota '
        + 'will see it.',
      back: BACK,
      ...ctx,
    },
    html`
      ${notice ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>` : ''}

      ${duties.length === 0 && candidates.length
        ? html`<div class="notice notice-warn">
            <p><strong>You may be on the rota under a different name.</strong>
              Your sign-in is <em>${ctx.signedInAs}</em>, but the rota was imported from a
              spreadsheet that uses shorter names — so your dates are probably sitting under
              one of these.</p>
            <p style="margin-bottom:0">Pick the one that is you and the two records will be
              joined, bringing your dates across.</p>
          </div>
          <div class="table-scroll" style="margin-bottom:1.5rem">
            <table class="grid stack">
              <thead><tr><th>Name on the rota</th><th class="num">Dates</th><th></th></tr></thead>
              <tbody>
                ${candidates.map(
                  (m) => html`<tr>
                    <td class="stack-title"><strong>${m.display_name}</strong></td>
                    <td class="num" data-label="Dates">${m.duties}</td>
                    <td class="stack-actions">
                      <form method="post" action="/app/me/link" class="inline-form"
                            data-confirm="Join ${m.display_name} to your account? This cannot be undone."
                            onsubmit="return confirm(this.dataset.confirm)">
                        <input type="hidden" name="person_id" value="${m.id}">
                        <button class="btn-quiet" type="submit">This is me</button>
                      </form>
                    </td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`
        : ''}

      ${duties.length === 0
        ? html`<div class="card"><p style="margin:0">
            You are not down for anything coming up.</p></div>`
        : html`<div class="table-scroll">
            <!-- The page volunteers open on their phones more than any other.
                 There each date is a card — the day as its heading, what they
                 are doing under it, and "I cannot do this" a full fingertip
                 high — rather than four columns to swipe across. -->
            <table class="grid stack">
              <thead><tr><th>When</th><th>Service</th><th>Doing</th><th></th></tr></thead>
              <tbody>
                ${duties.map(
                  (d) => html`<tr>
                    <td class="stack-title">
                      <a href="/app/rota/service/${d.service_id}"><strong>${formatDate(d.service_date)}</strong></a>
                      <div class="num" style="font-size:.9375rem;color:var(--ink-2)">${d.service_time}</div>
                    </td>
                    <td data-label="Service">${d.title ?? 'Worship'}</td>
                    <td data-label="Doing"><strong>${d.role_name}</strong>
                      ${d.status === 'draft' ? chip('neutral', 'draft') : ''}</td>
                    <td class="stack-actions">
                      ${d.request_status === 'open'
                        ? chip('amber', 'You have asked to change this')
                        : d.request_status === 'accepted'
                          ? chip('green', 'Sorted')
                          : html`<form method="post" action="/app/me/cannot-do" class="inline-form">
                              <input type="hidden" name="assignment_id" value="${d.assignment_id}">
                              <button class="btn-quiet" type="submit">I cannot do this</button>
                            </form>`}
                    </td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`}

      <h2 class="section-h2">When you are away</h2>
      <div class="card">
        <p style="margin-top:0;color:var(--ink-2)">
          Tell the system when you are away and it will not put you on the rota for those dates
          in the first place. This is much easier than asking to swap afterwards.
        </p>
        <form method="post" action="/app/me/away">
          <div class="grid-fields">
            <div class="field">
              <label for="from_date">From</label>
              <input id="from_date" name="from_date" type="date" value="${today}" required>
            </div>
            <div class="field">
              <label for="to_date">Until</label>
              <input id="to_date" name="to_date" type="date" required>
            </div>
            <div class="field">
              <label for="reason">Why, if you like</label>
              <span class="hint">Optional — "on holiday" is plenty.</span>
              <input id="reason" name="reason" type="text">
            </div>
          </div>
          <button class="btn-primary" type="submit">Add these dates</button>
        </form>
      </div>

      ${away.length
        ? html`<div class="table-scroll">
            <!-- No heading cell on a phone: "From" and "Until" both keep their
                 names, so neither date can be taken for the other. -->
            <table class="grid stack">
              <thead><tr><th>From</th><th>Until</th><th>Why</th><th></th></tr></thead>
              <tbody>
                ${away.map(
                  (a) => html`<tr>
                    <td data-label="From">${formatDate(a.from_date)}</td>
                    <td data-label="Until">${formatDate(a.to_date)}</td>
                    <td data-label="Why" style="color:var(--ink-2)">${a.reason ?? '—'}</td>
                    <td class="stack-actions">
                      <form method="post" action="/app/me/away/${a.id}/delete" class="inline-form">
                        <button class="linkish" type="submit" style="color:var(--bad)">Remove</button>
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

/** The admin's queue of people who have asked to be taken off something. */
export function requestsPage(opts: {
  requests: ChangeRequestRow[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { requests, ctx, notice } = opts;
  const open = requests.filter((r) => r.status === 'open');
  const done = requests.filter((r) => r.status !== 'open');

  return layout(
    {
      title: 'Change requests',
      eyebrow: 'Rota',
      heading: 'People who cannot make it',
      intro: 'When somebody says they cannot do a date, it appears here.',
      back: { href: '/app/rota', label: 'The rota' },
      ...ctx,
    },
    html`
      ${notice ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>` : ''}

      ${open.length === 0
        ? html`<div class="notice notice-ok"><p style="margin:0">Nothing outstanding.</p></div>`
        : html`<div class="table-scroll">
            <table class="grid stack">
              <thead><tr><th>Who</th><th>Was down for</th><th>When</th><th>They said</th><th></th></tr></thead>
              <tbody>
                ${open.map(
                  (r) => html`<tr class="row-gap">
                    <td class="stack-title"><strong>${r.person_name}</strong></td>
                    <td data-label="Was down for">${r.role_name}</td>
                    <td data-label="When">${formatDate(r.service_date)}
                      <div class="num" style="font-size:.9375rem;color:var(--ink-2)">${r.service_time}</div></td>
                    <td data-label="They said" style="color:var(--ink-2)">${r.message ?? 'Cannot do this date'}</td>
                    <td class="stack-actions">
                      <div class="btn-row" style="gap:.4rem">
                        <form method="post" action="/app/rota/requests/${r.id}/accept" class="inline-form">
                          <button class="btn-quiet" type="submit">Take them off</button>
                        </form>
                        <form method="post" action="/app/rota/requests/${r.id}/decline" class="inline-form">
                          <button class="linkish" type="submit">Leave as is</button>
                        </form>
                      </div>
                    </td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>`}

      ${done.length
        ? html`<h2 class="section-h2">Already dealt with</h2>
            <div class="table-scroll">
              <table class="grid stack">
                <thead><tr><th>Who</th><th>Was down for</th><th>When</th><th>Outcome</th></tr></thead>
                <tbody>
                  ${done.map(
                    (r) => html`<tr>
                      <td class="stack-title">${r.person_name}</td>
                      <td data-label="Was down for">${r.role_name}</td>
                      <td data-label="When">${formatDate(r.service_date)}</td>
                      <td>${r.status === 'accepted'
                        ? chip('green', 'Taken off')
                        : chip('neutral', 'Left as is')}</td>
                    </tr>`,
                  )}
                </tbody>
              </table>
            </div>`
        : ''}
    `,
  );
}
