import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate } from './rota.js';
import { KINDS, POSITIONS, positionsFor, type WorshipSunday } from '../worship.js';

/**
 * The worship team's own area.
 *
 * One card per Sunday, each editable in place. A worship leader sitting down on
 * a Tuesday evening wants to fill in three weeks at once, not open three pages
 * — and every card is its own form, so saving one never disturbs another that
 * is half typed.
 *
 * Nothing on this page is compulsory. Blank is the normal state of most boxes
 * and the page says so rather than marking them as missing.
 */
export function worshipPage(opts: {
  sundays: WorshipSunday[];
  /** Everybody on the roster, for the dropdowns. */
  people: { id: number; display_name: string }[];
  ctx: ViewCtx;
  /** The service whose card was last saved, so it can say so in place. */
  savedId?: number;
  notice?: { tone: 'ok' | 'bad'; text: string };
  canEdit?: boolean;
}) {
  const { sundays, people, ctx, notice } = opts;
  const canEdit = opts.canEdit !== false;
  const planned = sundays.filter((s) => s.plan_id != null).length;

  return layout(
    {
      title: 'Worship',
      eyebrow: 'Rota',
      heading: 'Worship',
      intro: 'Who is playing and singing each week. This is the worship team\'s own list — '
        + 'nothing here is compulsory, and a week with nobody down yet is perfectly normal.',
      back: { href: '/app/rota', label: 'The rota' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <div class="notice notice-info">
        <p style="margin:0">
          <strong>Live worship</strong> asks about the whole band.
          <strong>Worship lyrics</strong> asks only about singers, because there is no band to
          ask about. Either way, leave anything blank that has nobody on it —
          you do not have to fill in every line.
        </p>
      </div>

      <div class="stat-row">
        <div class="stat">
          <span class="stat-n">${planned}</span>
          <span class="stat-l">weeks planned</span>
        </div>
        <div class="stat">
          <span class="stat-n">${sundays.length - planned}</span>
          <span class="stat-l">still to do</span>
        </div>
      </div>

      ${sundays.length === 0
        ? html`<div class="card"><p style="margin:0">
            No services coming up yet. They appear here as soon as they are in the diary.
          </p></div>`
        : sundays.map((s) => worshipCard(s, people, canEdit, opts.savedId === s.service_id))}
    `,
  );
}

function worshipCard(
  s: WorshipSunday,
  people: { id: number; display_name: string }[],
  canEdit: boolean,
  justSaved: boolean,
) {
  const kind = s.kind ?? 'live';
  const filled = s.slots.length;
  const nameOf = new Map(people.map((p) => [p.id, p.display_name]));
  const byPosition = new Map(s.slots.map((x) => [x.position, x]));

  return html`<div class="card worship-card ${justSaved ? 'worship-saved' : ''}">
    <div class="worship-head">
      <div>
        <h2 style="margin:0;font-size:1.15rem">
          ${formatDate(s.service_date)}
          <span style="color:var(--ink-2);font-weight:400">${s.service_time}</span>
        </h2>
        <p style="margin:.2rem 0 0;color:var(--ink-2);font-size:.9375rem">
          ${s.title ?? 'Worship'}${s.is_communion ? ' · Communion' : ''}
          ${s.leaders.length
            ? html` · led by <strong>${s.leaders.join(', ')}</strong>`
            : html` · <span style="color:var(--warn)">no worship leader on the rota yet</span>`}
        </p>
      </div>
      <div>
        ${justSaved ? chip('green', 'Saved') : ''}
        ${s.plan_id == null
          ? chip('neutral', 'Nothing down yet')
          : chip('navy', `${filled} ${filled === 1 ? 'person' : 'people'}`)}
      </div>
    </div>

    ${canEdit
      ? html`<form method="post" action="/app/rota/worship/${s.service_id}">
          <div class="field" style="max-width:26rem">
            <label for="kind-${s.service_id}">What kind of worship</label>
            <select id="kind-${s.service_id}" name="kind"
                    onchange="this.closest('form').querySelectorAll('[data-live]').forEach(function(el){el.hidden = this.value !== 'live';}, this)">
              ${KINDS.map((k) => html`<option value="${k.value}" ${kind === k.value ? 'selected' : ''}>
                ${k.label} — ${k.note}
              </option>`)}
            </select>
          </div>

          <!-- Every position is rendered, and the band half is hidden rather
               than removed when the kind is lyrics. That way switching the
               dropdown reveals the boxes immediately with no round trip, and the
               page still works with no JavaScript at all — it simply shows
               everything, and the save ignores what does not apply. -->
          <div class="worship-grid">
            ${POSITIONS.map((pos) => {
              const cur = byPosition.get(pos.key);
              const id = `${pos.key}-${s.service_id}`;
              return html`<div class="field" data-live="${pos.live ? '1' : ''}"
                                ${pos.live && kind !== 'live' ? 'hidden' : ''}>
                <label for="${id}">${pos.label}</label>
                <select id="${id}" name="p_${pos.key}">
                  <option value="">— nobody —</option>
                  ${people.map((p) => html`<option value="${p.id}"
                    ${cur?.person_id === p.id ? 'selected' : ''}>${p.display_name}</option>`)}
                  <option value="other" ${cur && cur.person_id == null ? 'selected' : ''}>
                    Somebody not on the list…
                  </option>
                </select>
                <input type="text" name="n_${pos.key}" class="worship-other"
                       placeholder="Their name"
                       value="${cur && cur.person_id == null ? (cur.name ?? '') : ''}"
                       aria-label="Name for ${pos.label}, if they are not on the list">
              </div>`;
            })}
          </div>

          <div class="field">
            <label for="notes-${s.service_id}">Notes for the team</label>
            <span class="hint">Songs, keys, who is bringing what — anything worth saying.</span>
            <textarea id="notes-${s.service_id}" name="notes" rows="2">${s.notes ?? ''}</textarea>
          </div>

          <button class="btn-primary" type="submit">Save this week</button>
        </form>`
      : html`<div class="worship-grid">
          ${positionsFor(kind).map((pos) => {
            const cur = byPosition.get(pos.key);
            return html`<p style="margin:0">
              <strong>${pos.label}:</strong>
              ${cur
                ? (cur.person_id != null ? nameOf.get(cur.person_id) ?? cur.name : cur.name)
                : html`<span style="color:var(--ink-2)">nobody yet</span>`}
            </p>`;
          })}
        </div>
        ${s.notes ? html`<p style="margin:.75rem 0 0"><strong>Notes:</strong> ${s.notes}</p>` : ''}`}
  </div>`;
}
