import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import type { CombinationForRole, RoleRow } from '../db.js';

/**
 * What one role may be combined with, in one editable list.
 *
 * The matrix on the other page is the right way to READ this — a grid shows at a
 * glance where the gaps are. It is the wrong way to EDIT it: the question is
 * never "fill in this 14x14 grid", it is "the preacher is already preaching,
 * what else can they do?" That is one row of the grid, asked out loud.
 */
export function combinationsByRolePage(opts: {
  roles: RoleRow[];
  role: RoleRow;
  others: CombinationForRole[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { roles, role, others, ctx, notice } = opts;
  const counts = {
    green: others.filter((o) => o.verdict === 'green').length,
    amber: others.filter((o) => o.verdict === 'amber').length,
    red: others.filter((o) => o.verdict === 'red').length,
    unset: others.filter((o) => o.verdict === null).length,
  };

  return layout(
    {
      title: `What else a ${role.name} can do`,
      eyebrow: 'Admin Centre',
      heading: `What else can the ${role.name} do?`,
      intro: `Somebody is already down as ${role.name} at a service. This says which other `
        + 'jobs they may take at the same service, and the rota is built to obey it.',
      back: { href: '/app/settings/combinations', label: 'All combination rules' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <form method="get" action="/app/settings/combinations/by-role" class="card"
            style="padding-block:1rem">
        <div class="grid-fields" style="align-items:end">
          <div class="field" style="margin-bottom:0">
            <label for="role">Someone is already the</label>
            <select id="role" name="role" onchange="this.form.submit()">
              ${roles.map(
                (r) => html`<option value="${r.id}" ${r.id === role.id ? 'selected' : ''}>${r.name}</option>`,
              )}
            </select>
          </div>
          <div class="field" style="margin-bottom:0">
            <button class="btn-secondary" type="submit">Show</button>
          </div>
        </div>
      </form>

      <div class="notice notice-info">
        <p style="margin-top:0"><strong>How the rota uses this.</strong></p>
        <ul style="margin:0">
          <li><strong>Fine</strong> — the rota will do it without hesitating.</li>
          <li><strong>Not ideal</strong> — allowed, but the rota avoids it where it can, and
            tells you every time it had to settle for one.</li>
          <li><strong>Not allowed</strong> — the rota will never do it. If that means a place
            cannot be filled, it leaves the place empty and warns you, rather than breaking
            the rule quietly.</li>
          <li><strong>Not decided</strong> — treated as <em>fine</em>. Nothing is blocked until
            you say so, so anything that really must not happen needs setting to
            <em>Not allowed</em> here.</li>
        </ul>
      </div>

      <div class="stat-row">
        <div class="stat"><span class="stat-n">${counts.green}</span><span class="stat-l">fine</span></div>
        <div class="stat"><span class="stat-n">${counts.amber}</span><span class="stat-l">not ideal</span></div>
        <div class="stat"><span class="stat-n">${counts.red}</span><span class="stat-l">not allowed</span></div>
        <div class="stat"><span class="stat-n">${counts.unset}</span><span class="stat-l">not decided</span></div>
      </div>

      <form method="post" action="/app/settings/combinations/by-role">
        <input type="hidden" name="role_id" value="${role.id}">

        ${others.map((o) => html`
          <div class="card combo-card">
            <input type="hidden" name="shown" value="${o.role_id}">
            <div class="combo-card-head">
              <h3 style="margin:0">
                ${role.name} <span style="color:var(--ink-2)">and also</span> ${o.role_name}
              </h3>
              ${o.observed > 0
                ? chip('navy', `Already done ${o.observed} time${o.observed === 1 ? '' : 's'}`)
                : chip('neutral', 'Never done')}
              ${o.communion_only ? chip('amber', 'Communion services only') : ''}
            </div>

            <div class="verdicts">
              ${VERDICTS.map((vd) => html`
                <label class="verdict verdict-${vd.value ?? 'unset'}">
                  <input type="radio" name="v_${o.role_id}" value="${vd.value ?? ''}"
                         ${o.verdict === vd.value ? 'checked' : ''}>
                  <span>
                    <span class="check-label">${vd.label}</span>
                    <span class="check-note">${vd.note}</span>
                  </span>
                </label>`)}
            </div>

            <div class="field" style="margin-bottom:0;margin-top:.75rem">
              <label for="reason_${o.role_id}">Why — shown when the rota mentions this rule</label>
              <input id="reason_${o.role_id}" name="reason_${o.role_id}" type="text"
                     value="${o.reason ?? ''}"
                     placeholder="e.g. too much for one person on a communion Sunday">
            </div>
          </div>`)}

        <div class="btn-row" style="margin-top:1.25rem">
          <button class="btn-primary" type="submit">Save what the ${role.name} can also do</button>
          <a class="btn-secondary" href="/app/settings/combinations">Back to the grid</a>
        </div>
      </form>
    `,
  );
}

/**
 * The four states, in the words the church uses rather than the words the
 * database uses. "Amber" means nothing to somebody looking at this for the
 * first time; "allowed, but not ideal" means exactly what it says.
 */
const VERDICTS: { value: 'green' | 'amber' | 'red' | null; label: string; note: string }[] = [
  { value: 'green', label: 'Fine', note: 'Do it whenever it helps' },
  { value: 'amber', label: 'Not ideal', note: 'Only if there is no better way' },
  { value: 'red', label: 'Not allowed', note: 'Never, even if it leaves a gap' },
  { value: null, label: 'Not decided', note: 'Treated as fine for now' },
];
