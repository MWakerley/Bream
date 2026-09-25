import { html } from 'hono/html';
import { layout, type ViewCtx } from './layout.js';
import { UNITS, toUnits } from '../frequency.js';
import type { RoleRow, RotaRulesRow } from '../db.js';

/**
 * The rules the draft rota is built to.
 *
 * Every figure on this page already existed — the generator worked it out from
 * the size of each team and refused people on the strength of it without ever
 * saying so. Nothing here is a new rule; it is the rule that was already
 * running, written down and handed over.
 *
 * Deliberately no scoring weights. Every one of them is expressed relative to
 * the others, so one typed digit would invert the generator while every
 * sentence explaining a choice went on reading correctly. What a settings page
 * should move is the INTERVAL the fairness is measured against, which is what
 * the per-role figures do.
 */
export function draftRulesPage(opts: {
  roles: RoleRow[];
  rules: RotaRulesRow;
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
  /** People a newly tightened figure would push off, named back to be excused. */
  affected?: { role_name: string; role_id: number; people: { id: number; name: string; every: number }[] }[];
}) {
  const { roles, rules, ctx, notice, affected } = opts;

  return layout(
    {
      title: 'Rules for draft rotas',
      eyebrow: 'Settings',
      heading: 'Rules for draft rotas',
      intro: 'Set once here instead of typing the same thing against every preacher one at a '
        + 'time. Anything a person has said for themselves still wins.',
      back: { href: '/app/settings', label: 'Settings' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <div class="notice notice-info">
        <p style="margin-top:0">
          <strong>These figures are not new.</strong> The draft has been working to them all
          along — it worked each one out from the size of the team and never showed anybody.
          Now you can see them and change them.
        </p>
        <p style="margin-bottom:0">
          If a rule turns out to be too tight the draft tells you: it leaves a place empty and
          says why, rather than quietly ignoring what you asked for.
        </p>
      </div>

      ${affected?.length
        ? html`<div class="notice notice-warn">
            <p style="margin-top:0"><strong>Some people already do these jobs more often than
              the figure you have just set.</strong> They will now be pushed off the draft
              unless you say otherwise — which is usually right for a rota, and usually wrong
              for the vicar.</p>
            ${affected.map((a) => html`
              <p style="margin-bottom:.35rem"><strong>${a.role_name}</strong></p>
              <div class="checks" style="margin-bottom:1rem">
                ${a.people.map((pp) => html`<label class="check">
                  <input type="checkbox" name="exempt" value="${a.role_id}:${pp.id}" form="exempt-form">
                  <span><span class="check-label">Ask ${pp.name} as often as needed</span>
                    <span class="check-note">Does it about every ${pp.every} days at the moment.</span></span>
                </label>`)}
              </div>`)}
            <form method="post" action="/app/settings/draft-rules/exempt" id="exempt-form">
              <button class="btn-primary" type="submit">Save these exceptions</button>
            </form>
          </div>`
        : ''}

      <form method="post" action="/app/settings/draft-rules">
        <h2 class="section-h2">How often one person does the same job</h2>
        <div class="card">
          <p style="margin-top:0;color:var(--ink-2)">
            The draft will not put the same person on the same job again inside this gap.
            Clear a box and the draft goes back to working it out from the size of the team.
          </p>

          <div class="table-scroll">
            <table class="grid">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Not more often than</th>
                  <th>Aim for about</th>
                  <th class="num">People who can do it</th>
                </tr>
              </thead>
              <tbody>
                ${roles.map((r) => {
                  const floor = toUnits(r.default_min_gap_days);
                  const target = toUnits(r.default_target_days);
                  return html`<tr>
                    <td><strong>${r.name}</strong></td>
                    <td>
                      <span class="freq">
                        <span>once every</span>
                        <input type="number" min="1" max="24" style="width:4.5rem"
                               name="gapn_${r.id}" value="${floor?.n ?? ''}"
                               aria-label="Minimum gap for ${r.name}">
                        <select name="gapu_${r.id}" aria-label="Gap unit for ${r.name}">
                          ${UNITS.map((u) => html`<option value="${u.value}"
                            ${floor?.unit === u.value ? 'selected' : ''}>${u.label}</option>`)}
                        </select>
                      </span>
                    </td>
                    <td>
                      <span class="freq">
                        <span>once every</span>
                        <input type="number" min="1" max="24" style="width:4.5rem"
                               name="targetn_${r.id}" value="${target?.n ?? ''}"
                               aria-label="Target rhythm for ${r.name}">
                        <select name="targetu_${r.id}" aria-label="Target unit for ${r.name}">
                          ${UNITS.map((u) => html`<option value="${u.value}"
                            ${target?.unit === u.value ? 'selected' : ''}>${u.label}</option>`)}
                        </select>
                      </span>
                    </td>
                    <td class="num">${r.min_needed}${r.ideal_needed !== r.min_needed ? `–${r.ideal_needed}` : ''} needed</td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>
          <p style="color:var(--ink-2);font-size:.9375rem;margin-bottom:0">
            <strong>Not more often than</strong> is a firm rule — the draft leaves a place empty
            rather than break it. <strong>Aim for about</strong> is what it works towards when it
            has a free choice; leave it blank to share the work out evenly.
          </p>
        </div>

        <h2 class="section-h2">Rules for the whole rota</h2>
        <div class="card">
          <div class="field">
            <label for="any_role_gap">Before someone's next job of any kind</label>
            <span class="hint">
              Counted between services, not within one — this never stops somebody doing two
              things at one service, which is what the
              <a href="/app/settings/combinations">combination rules</a> are for.
            </span>
            <select id="any_role_gap" name="any_role_gap">
              ${ANY_ROLE_GAPS.map((g) => html`<option value="${g.value}"
                ${rules.any_role_gap === g.value ? 'selected' : ''}>${g.label}</option>`)}
            </select>
          </div>

          <div class="field">
            <label for="max_roles">Most jobs one person may have at a single service</label>
            <span class="hint">
              Leave blank for no limit, which is what happens now. This is about how many;
              <a href="/app/settings/combinations">combination rules</a> say which.
            </span>
            <input id="max_roles" name="max_roles" type="number" min="1" max="6"
                   style="width:6rem" value="${rules.max_roles_per_service ?? ''}">
          </div>

          <div class="field">
            <label for="when_short">If a service would still be short of people</label>
            <span class="hint">
              Even at its most flexible the draft never asks anybody twice inside a week, and
              never overrides somebody being away.
            </span>
            <select id="when_short" name="when_short">
              ${WHEN_SHORT.map((o) => html`<option value="${o.value}"
                ${rules.when_short === o.value ? 'selected' : ''}>${o.label}</option>`)}
            </select>
          </div>

          <div class="field">
            <label for="fairness">Spreading the work out</label>
            <span class="hint">
              How hard to hold back somebody who can do everything, so that others get a turn.
            </span>
            <select id="fairness" name="fairness">
              ${FAIRNESS.map((o) => html`<option value="${o.value}"
                ${rules.fairness === o.value ? 'selected' : ''}>${o.label}</option>`)}
            </select>
          </div>

          <label class="check" style="max-width:34rem">
            <input type="checkbox" name="list_every_empty_place" value="1"
                   ${rules.list_every_empty_place ? 'checked' : ''}>
            <span><span class="check-label">Tell me about every empty place</span>
              <span class="check-note">
                Including where a service still has the minimum it needs but fewer than the
                ideal. Off by default, because it makes a longer list.
              </span></span>
          </label>
        </div>

        <div class="btn-row" style="margin-top:1.25rem">
          <button class="btn-primary" type="submit">Save these rules</button>
          <a class="btn-secondary" href="/app/rota/generate">Generate a draft with them</a>
        </div>
      </form>
    `,
  );
}

/**
 * The gap before somebody's next job of any kind.
 *
 * The two firm options are stored as 8 and 15 days, not 7 and 14. Consecutive
 * Sundays are exactly 7 days apart and the generator's test is "less than", so
 * a 7 would permit precisely what "never on two Sundays running" forbids.
 */
const ANY_ROLE_GAPS = [
  { value: 'none', label: 'No preference — use them whenever they fit' },
  { value: 'week_prefer', label: 'Prefer to leave a clear week' },
  { value: 'fortnight_prefer', label: 'Prefer to leave a clear fortnight' },
  { value: 'month_prefer', label: 'Prefer to leave a clear month' },
  { value: 'not_two_sundays', label: 'Never on two Sundays running — a firm rule' },
  { value: 'fortnight_rule', label: 'Never inside a fortnight — a firm rule' },
];

const WHEN_SHORT = [
  { value: 'leave_empty', label: 'Leave the place empty and tell me' },
  { value: 'bend_gap', label: 'Ask somebody a little sooner than usual' },
  { value: 'bend_both', label: 'Ask sooner, and go over what they asked for if it comes to it' },
];

const FAIRNESS = [
  { value: 'even', label: 'As evenly as possible — everyone gets a turn' },
  { value: 'balanced', label: 'Fairly evenly, but take the best person for the service' },
  { value: 'best_fit', label: 'Take the best person, even if that means the same faces' },
];
