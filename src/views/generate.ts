import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate } from './rota.js';
import { editableSlots, type DraftCandidate, type DraftDerived, type DraftPerson, type DraftService,
         type DraftView } from '../rota/draft.js';

const BACK = { href: '/app/settings', label: 'Admin Centre' };

export function generateFormPage(opts: {
  ctx: ViewCtx;
  defaultFrom: string;
  defaultTo: string;
  notice?: { tone: 'ok' | 'bad'; text: string };
  /** A draft this person has not applied yet. Its only address is a random
   *  token, so without this a draft left by the back link or the menu could
   *  not be found again — and generating afresh would quietly start without
   *  the changes made to it by hand. */
  resume?: { href: string; from: string; to: string; edits: number };
}) {
  const r = opts.resume;
  return layout(
    { title: 'Generate a draft rota', back: BACK, ...opts.ctx },
    html`
      <p class="page-intro">
        Produces a <strong>draft</strong> and shows it to you before anything is saved. You
        can change any service in it by hand first. Nothing is written until you press Apply.
      </p>

      ${opts.notice
        ? html`<div class="notice notice-${opts.notice.tone}"><p style="margin:0">${opts.notice.text}</p></div>`
        : ''}

      ${r
        ? html`<div class="notice notice-warn" role="status">
            <p style="margin-top:0">${`You have a draft for ${formatDate(r.from)} to ${formatDate(r.to)} `
              + 'that has not been applied yet'
              + (r.edits > 0 ? `, with ${r.edits} ${plural(r.edits, 'change', 'changes')} by hand` : '')
              + '.'}
              ${r.edits > 0
                ? 'Making a new one below starts again from scratch, without your changes.'
                : 'You can carry on with it, or make a new one below.'}
            </p>
            <p style="margin:0"><a class="btn-secondary" href="${r.href}">Carry on checking it</a></p>
          </div>`
        : ''}

      <form method="post" action="/app/settings/generate" class="card">
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
          <li><strong>Anyone taking a break is left out</strong>, and so is anyone marked as a
              guest. If either is already down for a service in the range, the draft takes them
              off and fills the place — and names each one before anything is saved. The only
              exception is a guest somebody put on a service by hand, who stays.</li>
          <li>Every choice comes with a sentence saying why.</li>
          <li><strong>You can change any service before applying.</strong> Press Change on it,
              pick somebody else, and the draft — and its downloads — show your choice.</li>
        </ul>
      </div>
    `,
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "a, b and c". */
const joinAnd = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/** The chip for a short fact about somebody, in the colours the service page
 *  uses for the same facts. */
function noteChip(note: string) {
  if (note.startsWith('cannot also be ')) return chip('red', note);
  if (note === 'away that day' || note === 'on a break') return chip('amber', note);
  if (note === 'guest') return chip('navy', note);
  return chip('neutral', note);
}

function personLine(p: DraftPerson) {
  return html`<div style="margin-bottom:.35rem">
    <strong>${p.name}</strong>
    ${p.pinned ? chip('neutral', 'already set') : ''}
    ${p.byHand ? chip('neutral', 'changed by hand') : ''}
    ${p.amber.length ? chip('amber', 'amber') : ''}
    ${(p.notes ?? []).map(noteChip)}
    <div style="font-size:.9375rem;color:var(--ink-2)">${p.reason}</div>
  </div>`;
}

const ROLE_TH = 'white-space:nowrap;text-transform:none;letter-spacing:0;font-size:1rem;border-bottom:1px solid var(--rule)';

export function previewPage(opts: {
  ctx: ViewCtx;
  from: string;
  to: string;
  token: string;
  view: DraftView;
  /** derive(view) — passed in rather than worked out here, so the page shows
   *  exactly what was written back to the parked draft. */
  derived: DraftDerived;
  /** The save that brought the person back here, shown on that service. */
  saved?: DraftView['lastSave'];
}) {
  const { view, derived: d, token } = opts;
  const released = view.released;
  const made = view.createdSundays;
  const base = `/app/settings/generate/draft/${token}`;

  // What Apply will do, in one place: the card at the bottom says it, and the
  // "are you sure" box says it again in the same words.
  const facts = [
    `${d.fresh} ${plural(d.fresh, 'placement goes', 'placements go')} on the rota as draft`,
    ...(made > 0 ? [`${made} ${plural(made, 'Sunday is', 'Sundays are')} added to the diary`] : []),
    ...(released.length
      ? [`${released.length} ${plural(released.length, 'booking is', 'bookings are')} taken off`]
      : []),
  ];
  const confirmText = `Apply this draft? ${joinAnd(facts)}. This cannot be undone from this page. Are you sure?`;
  const byHand = view.services.reduce(
    (n, s) => n + s.rows.reduce((m, r) => m + r.people.filter((p) => p.byHand).length, 0), 0);

  return layout(
    { title: 'Draft rota', back: { href: '/app/settings/generate', label: 'Generate' }, ...opts.ctx },
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
        <strong>${d.fresh}</strong> new placement${d.fresh === 1 ? '' : 's'},
        ${d.kept} left exactly as ${d.kept === 1 ? 'it was' : 'they were'},
        <strong>${d.empty}</strong> place${d.empty === 1 ? '' : 's'} still empty.
      </p>

      <!-- Deliberately no Apply here. It used to sit beside Start again, where
           it was far too easy to press by mistake on the way to checking the
           draft. It is now the last thing on the page, after every service. -->
      <div class="card" style="border-top:3px solid var(--brass)">
        <!-- Not "nothing has been saved": a hand change IS saved, into the draft,
             and the same page then says "Saved your changes to ..." on that
             service. What has not happened is anything reaching the rota. -->
        <p style="margin-top:0"><strong>Nothing is on the rota yet.</strong>${view.edits > 0
          ? ' Your changes are kept in this draft until you apply it.'
          : ''}</p>
        <p>
          Check each service below. Press <strong>Change</strong> on any of them to put somebody
          else on, and apply the draft at the bottom of this page when it is right.
        </p>
        <p class="btn-row" style="margin:1rem 0 0">
          ${view.edits > 0
            ? html`<a class="btn-secondary" href="/app/settings/generate"
                  data-confirm="Start again? The changes you have made to this draft by hand will not be kept."
                  onclick="return confirm(this.dataset.confirm)">Start again</a>`
            : html`<a class="btn-secondary" href="/app/settings/generate">Start again</a>`}
        </p>
        <!-- The draft as it stands, in the same layout as the rota's own
             download, so it can be sent round for comments before it is
             applied. Marked DRAFT throughout so nobody mistakes it. Hand
             changes are in it: it is built from the same saved draft. -->
        <p class="btn-row" style="margin:1rem 0 0">
          <span style="color:var(--ink-2);align-self:center">This draft, to send round before applying:</span>
          <a class="btn-quiet" href="${base}/rota.xlsx">Download for Excel</a>
          <a class="btn-quiet" href="${base}/rota.pdf">Download PDF</a>
        </p>
      </div>

      ${d.worthKnowing.length
        ? html`<h2 class="section-h2">Worth knowing</h2>
            <div class="notice notice-warn">
              ${view.edits > 0
                ? html`<p style="font-size:.9375rem">
                    These were worked out when the draft was made. Anything you change by hand
                    is checked as you save it, and shown on that service.
                  </p>`
                : ''}
              <ul style="margin:0;padding-left:1.2rem">
                ${d.worthKnowing.map((w) => html`<li>${w}</li>`)}
              </ul>
            </div>`
        : ''}

      <h2 class="section-h2">The draft</h2>
      ${view.services.map((s) => {
        const saved = opts.saved && opts.saved.serviceId === s.id ? opts.saved : null;
        return html`<div class="card" id="svc-${s.id}">
          <div style="display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:baseline;justify-content:space-between;margin-bottom:.75rem">
            <h3 style="margin:0;font-family:var(--serif);font-weight:500;font-size:1.25rem">
              ${formatDate(s.date)}, ${s.time} — ${s.title}
              ${s.isNew ? chip('amber', 'new service') : ''}
            </h3>
            <a class="btn-quiet" href="${base}/service/${s.id}">Change<span class="sr-only"> ${formatDate(s.date)}</span></a>
          </div>
          ${saved
            ? html`<div class="notice notice-ok" role="status">
                <p style="margin:0">${saved.changed > 0
                  ? html`Saved your changes to ${formatDate(s.date)}.`
                  : html`Nothing was changed on ${formatDate(s.date)}.`}</p>
                ${saved.notes.length
                  ? html`<ul style="margin:.5rem 0 0;padding-left:1.2rem">
                      ${saved.notes.map((n) => html`<li>${n}</li>`)}
                    </ul>`
                  : ''}
              </div>`
            : ''}
          <!-- On a phone the role is a heading over its people, rather than a
               column beside them that left the reasons a few words wide. -->
          <div class="table-scroll">
            <table class="grid stack">
              <tbody>
                ${s.rows.map((r) => {
                  const missing = Math.max(0, r.min - r.people.length);
                  // Only when the church asked to hear about every empty place
                  // (Draft rota rules), and quietly: the service has what it needs.
                  const belowIdeal = missing === 0 && view.listEveryEmptyPlace
                    ? Math.max(0, r.ideal - r.people.length) : 0;
                  return html`<tr class="${missing > 0 ? 'row-gap' : ''}">
                    <th scope="row" style="${ROLE_TH}">${r.roleName}</th>
                    <td>
                      ${r.people.map(personLine)}
                      ${missing > 0
                        ? html`<div style="color:var(--bad);font-weight:600">
                            ${missing} still needed${r.message ? html` — <span style="font-weight:400">${r.message}</span>` : ''}
                          </div>`
                        : ''}
                      ${belowIdeal > 0
                        ? html`<div style="color:var(--warn)">
                            ${belowIdeal} short of the ideal of ${r.ideal}${r.message ? html` — ${r.message}` : ''}
                          </div>`
                        : ''}
                    </td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>
        </div>`;
      })}

      <h2 class="section-h2">How the load falls</h2>
      <div class="table-scroll">
        <table class="grid">
          <thead><tr><th>Person</th><th class="num">Times on</th></tr></thead>
          <tbody>
            ${d.load.map(
              (l) => html`<tr><td>${l.name}</td><td class="num">${l.total}</td></tr>`,
            )}
          </tbody>
        </table>
      </div>

      <!-- Last on the page, and well apart from everything above it, so it is
           reached only by somebody who has scrolled past every service — and
           then it asks once more. -->
      <h2 class="section-h2" style="margin-top:3.5rem">When the draft is right</h2>
      <div class="card" style="border-top:3px solid var(--brass)">
        <p style="margin-top:0"><strong>Applying puts this draft on the rota.</strong></p>
        <ul style="padding-left:1.2rem;color:var(--ink-2)">
          <li><strong>${d.fresh}</strong> ${plural(d.fresh, 'placement goes', 'placements go')} on
              the rota, marked as <em>draft</em> so they are visibly different from the confirmed
              rota.</li>
          <!-- Said plainly, because nothing on the page would tell them: a place
               changed by hand is not kept any more surely than the rest. There
               is no step that confirms a draft place, so the next draft applied
               over these dates replaces it. -->
          ${byHand > 0
            ? html`<li>${byHand === 1
                ? 'The place you changed by hand goes on as draft like the rest.'
                : `The ${byHand} places you changed by hand go on as draft like the rest.`}
                If a later draft for the same dates is applied, ${byHand === 1 ? 'it is' : 'they are'}
                replaced along with everything else from this one. To keep somebody for certain,
                put them on from the service's own page once this is applied.</li>`
            : ''}
          ${made > 0
            ? html`<li><strong>${made}</strong> Sunday ${plural(made, 'service is', 'services are')}
                added to the diary.</li>`
            : ''}
          ${released.length
            ? html`<li><strong>${released.length}</strong>
                ${plural(released.length, 'booking is', 'bookings are')} taken off, as listed at the
                top of this page.</li>`
            : ''}
          <li>Anything still marked draft from an earlier generated rota between
              ${formatDate(opts.from)} and ${formatDate(opts.to)} is replaced by this one.</li>
          <li>Anything somebody has booked by hand on a service's own page since this draft was
              made is left as it is.</li>
          <li>It cannot be undone from this page.</li>
        </ul>
        <form method="post" action="/app/settings/generate/apply" style="margin:0"
              data-confirm="${confirmText}"
              onsubmit="return confirm(this.dataset.confirm)">
          <input type="hidden" name="token" value="${token}">
          <input type="hidden" name="from" value="${opts.from}">
          <input type="hidden" name="to" value="${opts.to}">
          <button class="btn-primary" type="submit">Apply this draft</button>
        </form>
      </div>
    `,
  );
}

/**
 * One service of a draft, to change by hand.
 *
 * Laid out like the service page's own picker, and offering the same people:
 * everybody ticked for the role, with anything the person choosing might not
 * know said beside the name. Nobody is hidden for being away or on a break —
 * the person choosing may well have rung them — but a confirmed booking is
 * shown and not offered, because the draft never rewrites one.
 */
export function draftServiceEditPage(opts: {
  ctx: ViewCtx;
  token: string;
  view: DraftView;
  service: DraftService;
  /** roleId -> everybody ticked for it. */
  candidates: Map<number, DraftCandidate[]>;
  error?: string;
  /** What was sent, so a refused save does not throw away the other choices. */
  posted?: Map<string, number | null>;
}) {
  const s = opts.service;
  const draftHref = `/app/settings/generate/draft/${opts.token}`;

  /** Every role a person holds at this service, bar one place. */
  const elsewhere = (personId: number, roleId: number, slot: number) =>
    s.rows
      .filter((r) => r.people.some((p) => p.personId === personId && !(r.roleId === roleId && p.slot === slot)))
      .map((r) => r.roleName);

  const label = (c: DraftCandidate, roleId: number, slot: number) => {
    const other = elsewhere(c.id, roleId, slot);
    const notes = [
      c.on_break ? 'on a break' : '',
      c.is_guest ? 'guest' : '',
      c.away ? 'away that day' : '',
      other.length ? `already on ${joinAnd(other)} here` : '',
    ].filter(Boolean);
    return notes.length ? `${c.name} — ${notes.join(', ')}` : c.name;
  };

  return layout(
    {
      title: `Change ${formatDate(s.date)}`,
      back: { href: `${draftHref}#svc-${s.id}`, label: 'The draft' },
      ...opts.ctx,
    },
    html`
      <p class="page-intro">
        ${s.time} — ${s.title} ${s.isNew ? chip('amber', 'new service') : ''}
      </p>

      ${opts.error
        ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">${opts.error}</p></div>`
        : ''}

      <p style="color:var(--ink-2)">
        Changes are saved into the draft only. Nothing reaches the rota until the draft is applied.
      </p>

      <form method="post" action="${draftHref}/service/${s.id}">
        <input type="hidden" name="rev" value="${opts.view.rev}">
        <!-- As on the draft itself: a card per role on a phone, its pickers
             the full width of the screen under the role's name. -->
        <div class="table-scroll">
          <table class="grid stack">
            <tbody>
              ${s.rows.map((r) => {
                const slots = editableSlots(r);
                const pool = opts.candidates.get(r.roleId) ?? [];
                return html`<tr>
                  <th scope="row" style="${ROLE_TH}">${r.roleName}</th>
                  <td>
                    ${r.people.filter((p) => p.pinned).map((p) => html`<div style="margin-bottom:.6rem">
                      <strong>${p.name}</strong> ${chip('neutral', 'already set')}
                      <div style="font-size:.9375rem;color:var(--ink-2)">
                        A confirmed booking, so the draft leaves it alone. Once the draft is
                        applied it can be changed on the service's own page.
                      </div>
                    </div>`)}

                    ${slots.map((slot) => {
                      const id = `p_${r.roleId}_${slot}`;
                      const key = `${r.roleId}:${slot}`;
                      const current = r.people.find((p) => !p.pinned && p.slot === slot) ?? null;
                      // Somebody the draft has here who is no longer ticked for the
                      // role (or no longer active) is still listed, so saving the
                      // rest of the service does not quietly take them off.
                      const stray = current && !pool.some((c) => c.id === current.personId) ? current : null;
                      const offered = new Set<number | null>([null, ...pool.map((c) => c.id), stray?.personId ?? null]);
                      const wanted = opts.posted?.has(key) ? opts.posted.get(key) ?? null : undefined;
                      const selected = wanted !== undefined && offered.has(wanted)
                        ? wanted : current?.personId ?? null;
                      // The role is already the row's heading, so a one-place role's
                      // label is for screen readers only. Places are numbered as the
                      // rota numbers them, so a confirmed booking in place 1 leaves
                      // the free one called place 2.
                      return html`<div class="field" style="margin-bottom:.75rem">
                        ${slots.length > 1
                          ? html`<label for="${id}"><span class="sr-only">${r.roleName}, </span>Place ${slot}</label>`
                          : html`<label class="sr-only" for="${id}">${r.roleName}</label>`}
                        ${current ? html`<span class="hint">${current.reason}</span>` : ''}
                        <select id="${id}" name="${id}" style="max-width:100%">
                          <option value="" ${selected === null ? 'selected' : ''}>— nobody —</option>
                          ${stray
                            ? html`<option value="${stray.personId}" ${selected === stray.personId ? 'selected' : ''}>${stray.name} — as in the draft</option>`
                            : ''}
                          ${pool.map((c) => html`<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${label(c, r.roleId, slot)}</option>`)}
                        </select>
                      </div>`;
                    })}

                    ${slots.length && !pool.length
                      ? html`<p class="hint" style="margin:.35rem 0 0">
                          Nobody is ticked for ${r.roleName}.
                          <a href="/app/settings/people">Open somebody under People</a>, tick it,
                          and they will appear here.
                        </p>`
                      : ''}
                  </td>
                </tr>`;
              })}
            </tbody>
          </table>
        </div>

        <p class="btn-row" style="margin:1.25rem 0 0">
          <button class="btn-primary" type="submit">Save changes to this service</button>
          <a class="btn-secondary" href="${draftHref}#svc-${s.id}">Cancel</a>
        </p>
      </form>
    `,
  );
}
