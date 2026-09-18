import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { searchBox } from './search.js';
import { UNITS, toUnits } from '../frequency.js';
import type { PersonForRole, RoleRow } from '../db.js';

/**
 * Everybody against one role, in one editable list.
 *
 * Setting up fourteen roles across sixty-nine people one person at a time is
 * over nine hundred visits to a form. Asking the question the other way round —
 * "who can preach?" — turns it into fourteen.
 */
export function peopleByRolePage(opts: {
  roles: RoleRow[];
  role: RoleRow;
  people: PersonForRole[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { roles, role, people, ctx, notice } = opts;
  const can = people.filter((p) => p.can_do);
  const flagged = people.filter((p) => p.can_do && p.needs_review).length;

  return layout(
    {
      title: `Who can do ${role.name}`,
      eyebrow: 'Settings',
      heading: `Who can do ${role.name}`,
      intro: 'Tick everybody who could take this role, and set how often they want to. '
        + 'Everything here is saved together.',
      back: { href: '/app/settings/people', label: 'People' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <form method="get" action="/app/settings/people/by-role" class="card" style="padding-block:1rem">
        <div class="grid-fields" style="align-items:end">
          <div class="field" style="margin-bottom:0">
            <label for="role">Show people who can do</label>
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

      <div class="stat-row">
        <div class="stat">
          <span class="stat-n">${can.length}</span>
          <span class="stat-l">can do ${role.name}</span>
        </div>
        <div class="stat">
          <span class="stat-n">${role.min_needed}${role.ideal_needed !== role.min_needed ? `–${role.ideal_needed}` : ''}</span>
          <span class="stat-l">needed per service</span>
        </div>
        <div class="stat ${can.length > 0 && can.length < role.min_needed * 3 ? 'stat-full' : ''}">
          <span class="stat-n">${people.length}</span>
          <span class="stat-l">people to choose from</span>
        </div>
      </div>

      ${can.length > 0 && can.length < role.min_needed * 3
        ? html`<div class="notice notice-warn"><p style="margin:0">
            Only ${can.length} ${can.length === 1 ? 'person' : 'people'} can do this, and every
            service needs ${role.min_needed}. That is a thin pool — the rota will have to use
            the same people often, or leave places empty.
          </p></div>`
        : ''}

      ${flagged
        ? html`<div class="notice notice-warn"><p style="margin:0">
            ${flagged} of them ${flagged === 1 ? 'is' : 'are'} still flagged as a possible
            duplicate, so the generator will skip ${flagged === 1 ? 'them' : 'them'}.
            <a href="/app/settings/people/merge">Sort that out</a> first.
          </p></div>`
        : ''}

      <form method="post" action="/app/settings/people/by-role">
        <input type="hidden" name="role_id" value="${role.id}">

        ${searchBox({
          target: 'byrole-list',
          label: 'Find a person',
          placeholder: 'Start typing a name…',
          noun: 'people',
          hint: 'This only hides rows from view. Anything you have already ticked or typed is '
            + 'still saved, whether or not it is on screen when you press Save.',
        })}

        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Can do it</th><th>Name</th><th class="num">Done</th>
                <th>At most</th><th>Not more often than</th>
              </tr>
            </thead>
            <!-- Hiding a row does not take its inputs out of the form: a hidden
                 field still submits. So filtering is purely visual, and the
                 "shown" list below still covers everybody, ticked or not. -->
            <tbody id="byrole-list">
              ${people.map(
                (p) => html`<tr data-search="${p.display_name}">
                  <td>
                    <!-- Every person shown is listed here whether ticked or not.
                         An unticked box is not submitted, so without this the
                         save could not tell "unticked" from "not on the page"
                         and would have to guess. -->
                    <input type="hidden" name="shown" value="${p.id}">
                    <label class="check" style="padding:.4rem .6rem">
                      <input type="checkbox" name="can" value="${p.id}" ${p.can_do ? 'checked' : ''}
                             aria-label="${p.display_name} can do ${role.name}">
                      <span class="check-label" style="font-size:.9375rem">Yes</span>
                    </label>
                  </td>
                  <td>
                    <a href="/app/settings/people/${p.id}"><strong>${p.display_name}</strong></a>
                    ${p.needs_review ? html`<div>${chip('amber', 'possible duplicate')}</div>` : ''}
                  </td>
                  <td class="num">${p.done || ''}</td>
                  <td>
                    <span class="freq">
                      <input type="number" min="1" max="30" style="width:4rem"
                             name="max_${p.id}" value="${p.max_per_period ?? ''}"
                             aria-label="How many times for ${p.display_name}">
                      <span>every</span>
                      <input type="number" min="1" max="24" style="width:4rem"
                             name="periodn_${p.id}" value="${toUnits(p.period_days)?.n ?? ''}"
                             aria-label="How many, for ${p.display_name}">
                      <select name="periodu_${p.id}" aria-label="Unit for ${p.display_name}">
                        ${UNITS.map((u) => html`<option value="${u.value}"
                          ${toUnits(p.period_days)?.unit === u.value ? 'selected' : ''}>${u.label}</option>`)}
                      </select>
                    </span>
                  </td>
                  <td>
                    <span class="freq">
                      <span>once every</span>
                      <input type="number" min="1" max="24" style="width:4rem"
                             name="gapn_${p.id}" value="${toUnits(p.min_gap_days)?.n ?? ''}"
                             aria-label="Minimum gap for ${p.display_name}">
                      <select name="gapu_${p.id}" aria-label="Gap unit for ${p.display_name}">
                        ${UNITS.map((u) => html`<option value="${u.value}"
                          ${toUnits(p.min_gap_days)?.unit === u.value ? 'selected' : ''}>${u.label}</option>`)}
                      </select>
                    </span>
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>

        <div class="btn-row" style="margin-top:1.25rem">
          <button class="btn-primary" type="submit">Save who can do ${role.name}</button>
          <a class="btn-secondary" href="/app/settings/people">Back to everybody</a>
        </div>
      </form>
    `,
  );
}
