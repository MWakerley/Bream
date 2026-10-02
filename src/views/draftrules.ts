import { html } from 'hono/html';
import { layout, type ViewCtx } from './layout.js';
import type { RotaRulesRow } from '../db.js';

/**
 * The rules the draft rota is built to — the ones that apply to the whole rota.
 *
 * How often one person does a given job used to be set here too, a figure per
 * role. It is not any more: people differ too much for one figure to fit a whole
 * team — one preacher is glad to preach twice a month, another would rather once
 * a quarter — and a team-wide figure could quietly hold back somebody who had
 * asked to do more. That is now said only on each person's own record, so this
 * page just says where to find it, for anybody who comes looking here first.
 *
 * Deliberately no scoring weights. Every one of them is expressed relative to
 * the others, so one typed digit would invert the generator while every
 * sentence explaining a choice went on reading correctly. What should move the
 * fairness is the INTERVAL it is measured against, and that is each person's
 * own "how often they want to do it".
 */
export function draftRulesPage(opts: {
  rules: RotaRulesRow;
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { rules, ctx, notice } = opts;

  return layout(
    {
      title: 'Rules for draft rotas',
      eyebrow: 'Settings',
      heading: 'Rules for draft rotas',
      intro: 'The rules that apply to every draft rota, whoever is on it. How often each '
        + 'person does a particular job is kept on their own record instead.',
      back: { href: '/app/settings', label: 'Settings' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <div class="notice notice-info">
        <p style="margin:0">
          If a rule turns out to be too tight the draft tells you: it leaves a place empty and
          says why, rather than quietly ignoring what you asked for.
        </p>
      </div>

      <h2 class="section-h2">How often one person does the same job</h2>
      <div class="card">
        <p style="margin-top:0">
          <strong>This is set for each person now, not here.</strong> People differ — one
          preacher is glad to preach twice a month, another would rather once a quarter — so
          the draft goes by what each of them has said. Open somebody under
          <a href="/app/settings/people">People</a> and fill in <strong>How often they want to
          do it</strong>, or set a whole team at once with
          <a href="/app/settings/people/by-role">Edit by role</a>. The
          <strong>As often as needed</strong> tick is there too.
        </p>
        <p style="margin-bottom:0;color:var(--ink-2)">
          Anybody who has not said gets a fair share of whatever is left, once everybody who
          has said is counted.
        </p>
      </div>

      <form method="post" action="/app/settings/draft-rules">
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
          <a class="btn-secondary" href="/app/settings/generate">Generate a draft with them</a>
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
