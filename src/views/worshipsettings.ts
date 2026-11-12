import { html } from 'hono/html';
import { layout, type ViewCtx } from './layout.js';
import type { WorshipSettings } from '../worship.js';

const SETTINGS = { href: '/app/settings', label: 'Admin Centre' };

/**
 * Admin Centre → Worship Rota: the kinds of worship a week can be, the
 * positions on the team, and which positions each kind asks about.
 *
 * Nothing is deleted. A kind or position that stops being used is untucked
 * ("no longer offered"), so a week saved with it still says what it was.
 */
export function worshipSettingsPage(opts: {
  settings: WorshipSettings;
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { settings, ctx, notice } = opts;
  const { kinds, positions } = settings;

  return layout(
    {
      title: 'Worship Rota settings',
      eyebrow: 'Admin Centre',
      heading: 'Worship Rota',
      intro: 'The kinds of worship a week can be, the positions on the team, and which positions '
        + 'each kind asks about. These are the choices on every Worship Rota card.',
      back: SETTINGS,
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <h2 class="section-h2">Kinds of worship</h2>
      <p style="color:var(--ink-2)">
        Tick the positions each kind asks about. A kind that is not offered any more stays on
        weeks already saved with it, but is not offered for new ones.
      </p>
      <form method="post" action="/app/settings/worship/kinds">
        <div class="table-scroll matrix">
          <table class="grid worship-kinds">
            <thead><tr>
              <th>Kind</th>
              ${positions.map((p) => html`<th class="wk-pos ${p.is_active ? '' : 'is-off'}" title="${p.label}">${p.label}</th>`)}
              <th>Order</th><th>Offered</th>
            </tr></thead>
            <tbody>
              ${kinds.map((k) => html`<tr class="${k.is_active ? '' : 'row-off'}">
                <th scope="row">
                  <input type="text" name="label_${k.key}" value="${k.label}" required
                         aria-label="Name of ${k.label}" class="wk-label">
                  <input type="text" name="note_${k.key}" value="${k.note ?? ''}"
                         placeholder="A line saying what it is" aria-label="Note for ${k.label}" class="wk-note">
                </th>
                ${positions.map((p) => html`<td class="wk-tick">
                  <input type="checkbox" name="pos_${k.key}" value="${p.key}"
                         ${k.positions.includes(p.key) ? 'checked' : ''}
                         aria-label="${k.label} asks about ${p.label}">
                </td>`)}
                <td><input type="number" name="order_${k.key}" value="${k.sort_order}" min="0" max="9999"
                           style="width:5rem" aria-label="Order of ${k.label}"></td>
                <td class="wk-tick"><input type="checkbox" name="active_${k.key}" value="1"
                           ${k.is_active ? 'checked' : ''} aria-label="${k.label} is offered"></td>
              </tr>`)}
            </tbody>
          </table>
        </div>
        <p style="margin-top:1rem"><button class="btn-primary" type="submit">Save the kinds</button></p>
      </form>

      <form method="post" action="/app/settings/worship/kinds/new" class="card">
        <h3 style="margin-top:0">Add a kind of worship</h3>
        <div class="grid-fields">
          <div class="field">
            <label for="new_kind_label">What it is called</label>
            <input id="new_kind_label" name="label" type="text" required placeholder="e.g. Acoustic">
          </div>
          <div class="field">
            <label for="new_kind_note">A line saying what it is</label>
            <span class="hint">Optional. Shown beside it in the dropdown.</span>
            <input id="new_kind_note" name="note" type="text" placeholder="e.g. Guitar and two voices">
          </div>
        </div>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 1rem">
          <legend>Which positions it asks about</legend>
          <div class="key-options">
            ${positions.filter((p) => p.is_active).map((p) => html`<label class="key-option">
              <input type="checkbox" name="pos" value="${p.key}"> ${p.label}
            </label>`)}
          </div>
        </fieldset>
        <button class="btn-primary" type="submit">Add this kind</button>
      </form>

      <h2 class="section-h2">Positions</h2>
      <p style="color:var(--ink-2)">
        The boxes on each Worship Rota card, in this order. Renaming one keeps everybody already
        down for it.
      </p>
      <form method="post" action="/app/settings/worship/positions">
        <div class="table-scroll">
          <table class="grid stack">
            <thead><tr><th>Position</th><th>Order</th><th>Offered</th></tr></thead>
            <tbody>
              ${positions.map((p) => html`<tr class="${p.is_active ? '' : 'row-off'}">
                <td class="stack-title">
                  <input type="text" name="label_${p.key}" value="${p.label}" required aria-label="Name of ${p.label}">
                </td>
                <td data-label="Order"><input type="number" name="order_${p.key}" value="${p.sort_order}"
                           min="0" max="9999" style="width:5rem" aria-label="Order of ${p.label}"></td>
                <td data-label="Offered">
                  <label class="check" style="padding:.4rem .6rem">
                    <input type="checkbox" name="active_${p.key}" value="1" ${p.is_active ? 'checked' : ''}
                           aria-label="${p.label} is offered">
                    <span class="check-label" style="font-size:.9375rem">Yes</span>
                  </label>
                </td>
              </tr>`)}
            </tbody>
          </table>
        </div>
        <p style="margin-top:1rem"><button class="btn-primary" type="submit">Save the positions</button></p>
      </form>

      <form method="post" action="/app/settings/worship/positions/new" class="card">
        <h3 style="margin-top:0">Add a position</h3>
        <div class="field">
          <label for="new_pos_label">What it is called</label>
          <input id="new_pos_label" name="label" type="text" required placeholder="e.g. Singer 4, Violin, Sound">
        </div>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 1rem">
          <legend>Which kinds of worship ask about it</legend>
          <div class="key-options">
            ${kinds.filter((k) => k.is_active).map((k) => html`<label class="key-option">
              <input type="checkbox" name="kind" value="${k.key}" checked> ${k.label}
            </label>`)}
          </div>
        </fieldset>
        <button class="btn-primary" type="submit">Add this position</button>
      </form>
    `,
  );
}
