import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate } from './rota.js';
import type { GeneratorResult } from '../rota/types.js';

const BACK = { href: '/app/rota', label: 'The rota' };

export function generateFormPage(opts: {
  ctx: ViewCtx;
  defaultFrom: string;
  defaultTo: string;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  return layout(
    { title: 'Generate a draft rota', back: BACK, ...opts.ctx },
    html`
      <p class="page-intro">
        Produces a <strong>draft</strong> and shows it to you before anything is saved.
        Nothing is written until you press Apply.
      </p>

      ${opts.notice
        ? html`<div class="notice notice-${opts.notice.tone}"><p style="margin:0">${opts.notice.text}</p></div>`
        : ''}

      <form method="post" action="/app/rota/generate" class="card">
        <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))">
          <div class="field" style="margin-bottom:0">
            <label for="from">From</label>
            <input id="from" name="from" type="date" value="${opts.defaultFrom}" required>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="to">To</label>
            <input id="to" name="to" type="date" value="${opts.defaultTo}" required>
          </div>
        </div>
        <label class="check" style="margin-top:1rem;max-width:34rem">
          <input type="checkbox" name="skip_sundays" value="1">
          <span>
            <span class="check-label">Do not add any missing Sundays</span>
            <span class="check-note">
              Normally any missing 10:30 Sunday services are planned in for you, since they
              happen every week regardless — but they are only actually added to the diary if
              you accept the draft. Tick this to work only with the services that already exist.
            </span>
          </span>
        </label>

        <p style="margin:1.25rem 0 0">
          <button class="btn-primary" type="submit">Generate a draft</button>
        </p>
      </form>

      <div class="card">
        <h2 style="margin-top:0;font-family:var(--serif);font-weight:500;font-size:1.25rem">
          What it will and will not do
        </h2>
        <ul style="margin:0;padding-left:1.2rem;color:var(--ink-2)">
          <li><strong>Anything already confirmed is left alone.</strong> The rota you are
              running now is treated as fixed, not as a suggestion to improve on.</li>
          <li><strong>It will never break a red rule</strong>, and it will never put someone
              on a day they have said they are away.</li>
          <li><strong>It leaves a place empty rather than inventing a name.</strong> Empty
              places are listed so you can see exactly what still needs a person.</li>
          <li><strong>People still marked "needs review" are skipped</strong> — the import
              cannot tell which person a first name refers to.</li>
          <li><strong>Anyone taking a break is left out</strong>, and so is anyone marked as a
              guest. If either is already down for a service in the range, the draft takes them
              off and fills the place — and names each one before anything is saved. The only
              exception is a guest somebody put on a service by hand, who stays.</li>
          <li>Every choice comes with a sentence saying why.</li>
        </ul>
      </div>
    `,
  );
}

export interface PreviewService {
  id: number;
  date: string;
  time: string;
  title: string;
  /** Not in the diary yet — it appears only if this draft is accepted. */
  isNew?: boolean;
  rows: { roleName: string; people: { name: string; reason: string; amber: string[]; pinned: boolean }[];
          missing: number; message: string | null }[];
}

export function previewPage(opts: {
  ctx: ViewCtx;
  from: string;
  to: string;
  result: GeneratorResult;
  services: PreviewService[];
  token: string;
  /** Sundays that WILL be created if this draft is accepted. Nothing has been
   *  written yet — a draft that is rejected must leave no trace. */
  createdSundays?: number;
  /** Existing bookings this draft takes off, with the service they were on. */
  released?: { name: string; why: 'break' | 'guest'; date: string; roleName: string }[];
}) {
  const { result, services } = opts;
  const released = opts.released ?? [];
  const fresh = result.allocations.filter((a) => !a.pinned).length;
  const kept = result.allocations.length - fresh;
  const made = opts.createdSundays ?? 0;

  return layout(
    { title: 'Draft rota', back: { href: '/app/rota/generate', label: 'Generate' }, ...opts.ctx },
    html`
      ${made > 0
        ? html`<div class="notice notice-warn" role="status"><p style="margin:0">
            <strong>${made}</strong> Sunday service${made === 1 ? ' is' : 's are'} not in the
            diary yet. ${made === 1 ? 'It' : 'They'} will be added when you accept this draft —
            nothing has been written yet, so if you close this page now, nothing changes. Any
            service already in the diary is left exactly as it is.
          </p></div>`
        : ''}

      ${released.length
        ? html`<div class="notice notice-warn" role="status">
            <p style="margin-top:0"><strong>${released.length}
              booking${released.length === 1 ? '' : 's'} will be taken off</strong>, because the
              person is taking a break or is a guest. Their places are filled below where
              somebody else could be found.</p>
            <ul style="margin-bottom:0">
              ${released.map((r) => html`<li>${formatDate(r.date)} — <strong>${r.name}</strong>,
                ${r.roleName} (${r.why === 'break' ? 'taking a break' : 'guest'})</li>`)}
            </ul>
          </div>`
        : ''}

      <p class="page-intro">
        ${formatDate(opts.from)} to ${formatDate(opts.to)} —
        <strong>${fresh}</strong> new placement${fresh === 1 ? '' : 's'},
        ${kept} left exactly as ${kept === 1 ? 'it was' : 'they were'},
        <strong>${result.gaps.length}</strong> place${result.gaps.length === 1 ? '' : 's'} still empty.
      </p>

      <div class="card" style="border-top:3px solid var(--brass)">
        <p style="margin-top:0"><strong>Nothing has been saved yet.</strong></p>
        <form method="post" action="/app/rota/generate/apply" class="inline-form">
          <input type="hidden" name="token" value="${opts.token}">
          <input type="hidden" name="from" value="${opts.from}">
          <input type="hidden" name="to" value="${opts.to}">
          <button class="btn-primary" type="submit">Apply this draft</button>
        </form>
        <a class="btn-secondary" href="/app/rota/generate" style="margin-left:.75rem">Start again</a>
        <p style="margin-bottom:0;margin-top:.9rem;color:var(--ink-2);font-size:.9375rem">
          Applying saves the new placements as <em>draft</em>, so they are visibly different
          from the confirmed rota until someone confirms them.
        </p>
      </div>

      ${result.warnings.length
        ? html`<h2 class="section-h2">Worth knowing</h2>
            <div class="notice notice-warn">
              <ul style="margin:0;padding-left:1.2rem">
                ${result.warnings.map((w) => html`<li>${w}</li>`)}
              </ul>
            </div>`
        : ''}

      <h2 class="section-h2">The draft</h2>
      ${services.map(
        (s) => html`<div class="card">
          <h3 style="margin:0 0 .75rem;font-family:var(--serif);font-weight:500;font-size:1.25rem">
            ${formatDate(s.date)}, ${s.time} — ${s.title}
            ${s.isNew ? chip('amber', 'new service') : ''}
          </h3>
          <div class="table-scroll">
            <table class="grid">
              <tbody>
                ${s.rows.map(
                  (r) => html`<tr class="${r.missing > 0 ? 'row-gap' : ''}">
                    <th scope="row" style="white-space:nowrap;text-transform:none;letter-spacing:0;font-size:1rem;border-bottom:1px solid var(--rule)">
                      ${r.roleName}
                    </th>
                    <td>
                      ${r.people.length
                        ? r.people.map(
                            (p) => html`<div style="margin-bottom:.35rem">
                              <strong>${p.name}</strong>
                              ${p.pinned ? chip('neutral', 'already set') : ''}
                              ${p.amber.length ? chip('amber', 'amber') : ''}
                              <div style="font-size:.9375rem;color:var(--ink-2)">${p.reason}</div>
                            </div>`,
                          )
                        : ''}
                      ${r.missing > 0
                        ? html`<div style="color:var(--bad);font-weight:600">
                            ${r.missing} still needed${r.message ? html` — <span style="font-weight:400">${r.message}</span>` : ''}
                          </div>`
                        : ''}
                    </td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </div>
        </div>`,
      )}

      <h2 class="section-h2">How the load falls</h2>
      <div class="table-scroll">
        <table class="grid">
          <thead><tr><th>Person</th><th class="num">Times on</th></tr></thead>
          <tbody>
            ${result.load.map(
              (l) => html`<tr><td>${l.name}</td><td class="num">${l.total}</td></tr>`,
            )}
          </tbody>
        </table>
      </div>
    `,
  );
}
