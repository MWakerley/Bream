import { html, raw } from 'hono/html';
import { layout, chip, KEY_ICON, type ViewCtx } from './layout.js';
import type { RoleRow } from '../db.js';
import { formatDate, formatDateTime } from './rota.js';
import { UNITS, toUnits } from '../frequency.js';

const BACK = { href: '/app/settings/people', label: 'People' };

export interface PersonRoleSetting {
  role_id: number;
  can_do: number;
  willing: number;
  max_per_period: number | null;
  period_days: number | null;
  min_gap_days: number | null;
  /** How many times they have actually done it, from the imported rota. */
  done: number;
}

export interface PersonEditData {
  id: number;
  display_name: string;
  full_name: string | null;
  email: string | null;
  needs_review: number;
  review_note: string | null;
  is_active: number;
  is_admin: number;
  /** Still one of us, but not to be put on anything for now. */
  on_break: number;
  /** When the break started, so a break nobody has ended can be noticed. */
  on_break_since: string | null;
  /** A visitor: assignable by hand, never drawn from the pool automatically. */
  is_guest: number;
  /** Holds a key to the buildings. On the keyholder register when ticked. */
  is_keyholder?: number;
  keyholder_since?: string | null;
  /** Which keys, in the church's own words. Optional. */
  keyholder_note?: string | null;
  /** Services they are still down for. Only loaded when it matters — that is,
   *  when they are on a break and somebody should see what was already agreed. */
  upcoming?: {
    service_id: number; service_date: string; role_name: string;
    /** 'confirmed' needs a human decision; 'draft' clears itself next time a
     *  rota is generated, so it is not worth anybody's Saturday. */
    status: string;
  }[];
  settings: Map<number, PersonRoleSetting>;
  /** Their sign-in, if they have one at all. Most of the roster does not. */
  account?: PersonAccount | null;
  /** Offered when they have no sign-in, so one can be given from this page. */
  profiles?: { id: number; name: string; is_default: number }[];
}

/**
 * 'Andy Ewens' -> 'andyewens'.
 *
 * The same rule as access.ts's suggestUsername, repeated here rather than
 * imported: this file is bundled into the render tests, and pulling in the
 * access module would drag WebCrypto along with it for one string function.
 * If one changes, change both — seed/access-test.ts pins the shared rule.
 */
function suggestedUsername(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 40) || 'user';
}

export interface PersonAccount {
  username: string | null;
  email: string | null;
  profile_name: string | null;
  /** Null until they have actually signed in once. */
  last_sign_in_at: string | null;
  /** They are still on the temporary password they were given. */
  must_change: number;
}

/** "3 days ago", for a date that is more useful as a distance than as a date. */
function howLongAgo(iso: string, today: Date): string {
  const then = new Date(`${iso.replace(' ', 'T')}Z`);
  const days = Math.floor((today.getTime() - then.getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function personPage(opts: {
  person: PersonEditData;
  roles: RoleRow[];
  ctx: ViewCtx;
  saved?: boolean;
  /** A password just reset by an administrator, shown once and never stored. */
  reset?: { password: string; emailed: string | null; emailError: string | null };
  notice?: { tone: 'ok' | 'bad'; text: string };
  /** Injected so the page renders the same way every time it is tested. */
  today?: Date;
}) {
  const { person: p, roles, ctx } = opts;
  const today = opts.today ?? new Date();
  // A confirmed place is a promise somebody made and needs a person to unmake.
  // A draft one the generator will drop by itself, and asking a churchwarden to
  // action it would be wasting their Saturday.
  const firm = (p.upcoming ?? []).filter((u) => u.status !== 'draft');
  const loose = (p.upcoming ?? []).filter((u) => u.status === 'draft');

  return layout(
    {
      title: p.display_name,
      eyebrow: 'Person',
      heading: p.display_name,
      back: BACK,
      ...ctx,
    },
    html`
      ${opts.saved ? html`<div class="notice notice-ok" role="status"><p>Saved.</p></div>` : ''}
      ${opts.notice
        ? html`<div class="notice notice-${opts.notice.tone}" role="status">
            <p style="margin:0">${opts.notice.text}</p></div>`
        : ''}

      ${p.on_break
        ? html`<div class="notice notice-warn">
            <p style="margin-top:0">
              <strong>${p.display_name} is taking a break${p.on_break_since
                ? ` — since ${formatDate(p.on_break_since.slice(0, 10))}`
                : ''}.</strong>
              They will not be put on anything when a rota is generated. Untick
              <strong>Taking a break</strong> below and they carry on exactly as before — nothing
              else about them has changed.
            </p>
            ${firm.length
              ? html`<p style="margin-bottom:0">
                  They are still down for
                  <strong>${firm.length}</strong> service${firm.length === 1 ? '' : 's'}
                  arranged before the break. Going on a break does not cancel something already
                  agreed, so ${firm.length === 1 ? 'it is' : 'they are'} left exactly as
                  ${firm.length === 1 ? 'it is' : 'they are'} — open
                  ${firm.length === 1 ? 'it' : 'each one'} and use <strong>Take off</strong> if
                  they cannot do it after all:
                  ${firm.map((u, i) => html`${i ? ', ' : ''}<a
                    href="/app/rota/service/${u.service_id}">${formatDate(u.service_date)} (${u.role_name})</a>`)}.
                </p>`
              : ''}
            ${loose.length
              ? html`<p style="margin-bottom:0;color:var(--ink-2)">
                  ${loose.length} more ${loose.length === 1 ? 'is' : 'are'} only a draft
                  suggestion, so ${loose.length === 1 ? 'it' : 'they'} will drop off by
                  ${loose.length === 1 ? 'itself' : 'themselves'} the next time a rota is
                  generated. Nothing to do.
                </p>`
              : ''}
          </div>`
        : ''}

      ${p.is_guest
        ? html`<div class="notice notice-info">
            <p style="margin:0">
              <strong>${p.display_name} is a guest.</strong> Put them on a service yourself whenever
              they are coming — the rota simply never picks them on its own, and they are not
              counted when the system works out whether there are enough people for a role.
            </p>
          </div>`
        : ''}

      ${p.needs_review
        ? html`<div class="notice notice-warn">
            <p><strong>This name may be a duplicate.</strong> ${p.review_note}</p>
            <p>
              If they are the same person, <a href="/app/settings/people/merge">merge them</a>.
              If they are genuinely different people, clear the flag below and they will be
              included when a rota is generated.
            </p>
          </div>`
        : ''}

      <form method="post" action="/app/settings/people/${p.id}">
        <div class="card">
          <h2>Details</h2>
          <!-- Three across on a wide screen, stacking on a narrow one. The hints
               differ in length, so .grid-fields bottom-aligns the inputs. -->
          <div class="grid-fields grid-3">
            <div class="field">
              <label for="display_name">Name on the rota</label>
              <span class="hint">How they appear on the printed rota.</span>
              <input id="display_name" name="display_name" type="text" value="${p.display_name}" required>
            </div>
            <div class="field">
              <label for="full_name">Full name</label>
              <span class="hint">Optional — it is what settles "which Andy?"</span>
              <input id="full_name" name="full_name" type="text" value="${p.full_name ?? ''}">
            </div>
            <div class="field">
              <label for="email">Email</label>
              <span class="hint">Only needed if they sign in.</span>
              <input id="email" name="email" type="email" value="${p.email ?? ''}">
            </div>
          </div>
          <!-- Three ways somebody can be left off a rota, and they mean three
               different things. Kept side by side so the difference is visible
               at the moment of ticking, rather than discovered later when the
               generator quietly skips somebody. -->
          <div class="checks" style="margin-top:.5rem">
            <label class="check">
              <input type="checkbox" name="is_active" value="1" ${p.is_active ? 'checked' : ''}>
              <span><span class="check-label">Still serving</span>
                <span class="check-note">Turn off when someone stops, rather than deleting them —
                  it keeps their history intact.</span></span>
            </label>
            <label class="check">
              <input type="checkbox" name="on_break" value="1" ${p.on_break ? 'checked' : ''}>
              <span><span class="check-label">Taking a break</span>
                <span class="check-note">Still one of us, just not at the moment. They will not be
                  put on anything new until this is unticked, and then they carry on as
                  before.</span></span>
            </label>
            <label class="check">
              <input type="checkbox" name="is_guest" value="1" ${p.is_guest ? 'checked' : ''}>
              <span><span class="check-label">Guest</span>
                <span class="check-note">A visiting preacher or worship leader. You can still put
                  them on a service yourself; the rota will never pick them on its own.</span></span>
            </label>
            <label class="check">
              <input type="checkbox" id="is_keyholder" name="is_keyholder" value="1" ${p.is_keyholder ? 'checked' : ''}>
              <span><span class="check-label">${raw(KEY_ICON)} Keyholder</span>
                <span class="check-note">Has a key to the buildings${p.is_keyholder && p.keyholder_since
                  ? ` — since ${formatDate(p.keyholder_since.slice(0, 10))}` : ''}. Listed on the
                  <a href="/app/settings/keyholders">keyholder register</a>.</span></span>
            </label>
            <div class="field" id="keyholder-note" ${p.is_keyholder ? '' : 'hidden'}>
              <label for="keyholder_note_in">Which keys</label>
              <span class="hint">Optional — e.g. "Church Centre front door".</span>
              <input id="keyholder_note_in" name="keyholder_note" type="text"
                     value="${p.keyholder_note ?? ''}">
            </div>
            <script>
              (function () {
                var box = document.getElementById('is_keyholder');
                var note = document.getElementById('keyholder-note');
                box.addEventListener('change', function () { note.hidden = !box.checked; });
              }());
            </script>
            ${p.needs_review
              ? html`<label class="check">
                  <input type="checkbox" name="clear_review" value="1">
                  <span><span class="check-label">Not a duplicate</span>
                    <span class="check-note">Clears the warning and lets the generator use them.</span></span>
                </label>`
              : ''}
          </div>
        </div>

        <div class="card">
          <h2>What they can do</h2>
          <p style="color:var(--ink-2)">
            Tick every role this person <em>could</em> take, not only the ones they have done
            lately. The counts show what the September–November rota records, which is where
            these ticks came from — but somebody who has not read this quarter may still be
            perfectly willing to read.
          </p>

          <div class="checks">
            ${roles.map((r) => {
              const s = p.settings.get(r.id);
              return html`<label class="check">
                <input type="checkbox" name="role_${r.id}" value="1" ${s?.can_do ? 'checked' : ''}>
                <span>
                  <span class="check-label">${r.name}</span>
                  <span class="check-note">
                    ${s && s.done > 0
                      ? `Has done this ${s.done} time${s.done === 1 ? '' : 's'}`
                      : 'Not recorded doing this yet'}
                    ${r.communion_only ? ' · communion services only' : ''}
                  </span>
                </span>
              </label>`;
            })}
          </div>
        </div>

        <div class="card">
          <h2>How often they want to do it</h2>
          <p style="color:var(--ink-2)">
            Only the roles ticked above appear here. Leave blank for "no strong view" —
            the rota will then aim for a fair share.
          </p>
          <p id="freq-empty" class="hint" hidden>
            Nothing ticked yet. Tick a role above and it will appear here.
          </p>
          <div class="table-scroll">
            <table class="grid" id="freq-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>At most</th>
                  <th>Not more often than</th>
                </tr>
              </thead>
              <tbody>
                ${roles.map((r) => {
                  const s = p.settings.get(r.id);
                  // Rendered for every role and hidden unless ticked, so the rows
                  // can appear the moment a box is ticked without a round trip —
                  // and so the page still works with no JavaScript at all.
                  return html`<tr data-freq-for="${r.id}" ${s?.can_do ? '' : 'hidden'}>
                    <td><strong>${r.name}</strong></td>
                    <td>
                      <span class="freq">
                        <input type="number" min="1" max="30" style="width:4.5rem"
                               name="max_${r.id}" value="${s?.max_per_period ?? ''}"
                               aria-label="How many times, for ${r.name}">
                        <span>time(s) every</span>
                        <input type="number" min="1" max="24" style="width:4.5rem"
                               name="periodn_${r.id}"
                               value="${toUnits(s?.period_days ?? null)?.n ?? ''}"
                               aria-label="How many, for ${r.name}">
                        <select name="periodu_${r.id}"
                                aria-label="Weeks, months or quarters, for ${r.name}">
                          ${UNITS.map((u) => html`<option value="${u.value}"
                            ${toUnits(s?.period_days ?? null)?.unit === u.value ? 'selected' : ''}>${u.label}</option>`)}
                        </select>
                      </span>
                    </td>
                    <td>
                      <span class="freq">
                        <span>once every</span>
                        <input type="number" min="1" max="24" style="width:4.5rem"
                               name="gapn_${r.id}"
                               value="${toUnits(s?.min_gap_days ?? null)?.n ?? ''}"
                               aria-label="How many, minimum gap for ${r.name}">
                        <select name="gapu_${r.id}"
                                aria-label="Weeks, months or quarters, minimum gap for ${r.name}">
                          ${UNITS.map((u) => html`<option value="${u.value}"
                            ${toUnits(s?.min_gap_days ?? null)?.unit === u.value ? 'selected' : ''}>${u.label}</option>`)}
                        </select>
                      </span>
                    </td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>
          <p style="color:var(--ink-2);font-size:.9375rem;margin-bottom:0">
            For example: "twice a month" is <strong>2 times every 1 month</strong>.
            "Only every three months" is <strong>once every 1 quarter</strong>.
          </p>
        </div>

        <div class="btn-row">
          <button class="btn-primary" type="submit">Save this person</button>
          <a class="btn-secondary" href="/app/settings/people">Cancel</a>
        </div>
      </form>

      <h2 class="section-h2">Signing in</h2>
      ${opts.reset
        ? html`<div class="notice notice-ok" role="status">
            <p style="margin-top:0"><strong>New temporary password for ${p.display_name}:</strong></p>
            <p class="temp-password">${opts.reset.password}</p>
            <p style="margin-bottom:0">
              ${opts.reset.emailed
                ? `It has also been emailed to ${opts.reset.emailed}.`
                : opts.reset.emailError
                  ? `The email did not go — ${opts.reset.emailError}. Read the password out to them instead; it is shown here only once.`
                  : 'Write it down or read it out now — it is shown here only once, and cannot be looked up later.'}
              They will have to choose their own password the first time they sign in.
            </p>
          </div>`
        : ''}

      <div class="card">
        ${!p.account
          ? html`<p style="margin-top:0">
                <strong>${p.display_name} has no sign-in.</strong> They are on the rota, but
                they cannot open the system to see it. That is how most of the roster is set
                up, and it is perfectly fine.
              </p>

              <form method="post" action="/app/settings/people/${p.id}/give-login">
                <h3 style="margin-bottom:.35rem">Give them a sign-in</h3>
                <p class="hint" style="margin-top:0">
                  They get a username and a temporary password. The password is shown here once,
                  so you can read it out — it is not stored anywhere you could look it up again.
                  They must choose their own the first time they sign in.
                </p>
                <div class="grid-fields">
                  <div class="field">
                    <label for="username">Username</label>
                    <span class="hint">What they type to sign in. Their email works too.</span>
                    <input id="username" name="username" type="text"
                           value="${suggestedUsername(p.display_name)}" required>
                  </div>
                  <div class="field">
                    <label for="profile_id">What they can see</label>
                    <span class="hint">
                      <a href="/app/settings/profiles">Profiles</a> decide which pages open.
                    </span>
                    <select id="profile_id" name="profile_id" required>
                      ${(p.profiles ?? []).map(
                        (pr) => html`<option value="${pr.id}" ${pr.is_default ? 'selected' : ''}>
                          ${pr.name}${pr.is_default ? ' — the usual one' : ''}
                        </option>`,
                      )}
                    </select>
                  </div>
                </div>
                ${p.email
                  ? html`<label class="check" style="max-width:28rem;margin-bottom:1rem">
                      <input type="checkbox" name="send_email" value="1" checked>
                      <span><span class="check-label">Email it to ${p.email}</span>
                        <span class="check-note">It is shown on screen either way.</span></span>
                    </label>`
                  : html`<p style="color:var(--ink-2);font-size:.9375rem">
                      No email address on file for them, so nothing can be sent — read the
                      password out, or add their email above and save first.
                    </p>`}
                <button class="btn-primary" type="submit">Give ${p.display_name} a sign-in</button>
              </form>`
          : html`
              <dl class="facts">
                <div>
                  <dt>Username</dt>
                  <dd>${p.account.username ?? html`<span style="color:var(--ink-2)">none — they sign in with their email</span>`}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>${p.account.email ?? html`<span style="color:var(--ink-2)">none on file</span>`}</dd>
                </div>
                <div>
                  <dt>What they can see</dt>
                  <dd>${p.account.profile_name ?? html`<span style="color:var(--ink-2)">no profile — they can see nothing</span>`}</dd>
                </div>
                <div>
                  <dt>Last signed in</dt>
                  <dd>
                    ${p.account.last_sign_in_at
                      ? html`<strong>${formatDateTime(p.account.last_sign_in_at)}</strong>
                          <span style="color:var(--ink-2)"> · ${howLongAgo(p.account.last_sign_in_at, today)}</span>`
                      : html`${chip('amber', 'Never')}
                          <div style="font-size:.9375rem;color:var(--ink-2);margin-top:.25rem">
                            They have a sign-in but have not used it yet.
                          </div>`}
                  </dd>
                </div>
              </dl>

              ${p.account.must_change
                ? html`<div class="notice notice-warn" style="margin-bottom:0">
                    <p style="margin:0">
                      They are still on the temporary password they were given, and will be
                      asked to choose their own the next time they sign in.
                    </p>
                  </div>`
                : ''}

              <form method="post" action="/app/settings/people/${p.id}/reset-password"
                    style="margin-top:1.25rem"
                    onsubmit="return confirm('Give ${p.display_name} a new temporary password? Their current one stops working straight away.')">
                <h3 style="margin-bottom:.35rem">They have forgotten their password</h3>
                <p class="hint" style="margin-top:0">
                  There is no "forgot my password" link — nothing is emailed unless you ask for
                  it here. This gives them a fresh temporary password, shown on screen so you
                  can read it out, and signs them out everywhere.
                </p>
                ${p.account.email
                  ? html`<label class="check" style="max-width:28rem;margin-bottom:1rem">
                      <input type="checkbox" name="send_email" value="1" checked>
                      <span><span class="check-label">Email it to ${p.account.email}</span>
                        <span class="check-note">It is shown on screen either way.</span></span>
                    </label>`
                  : html`<p style="color:var(--ink-2);font-size:.9375rem">
                      No email address on file, so you will need to read it out to them.
                    </p>`}
                <button class="btn-secondary" type="submit">Reset their password</button>
              </form>`}
      </div>

      <script>
        // Keep the "how often" rows in step with the ticks above. Without this
        // the page lists all fourteen roles and somebody has to read past twelve
        // that do not apply to them.
        (function () {
          var boxes = document.querySelectorAll('input[type=checkbox][name^="role_"]');
          var empty = document.getElementById('freq-empty');
          var table = document.getElementById('freq-table');
          function sync() {
            var anyOn = false;
            boxes.forEach(function (b) {
              var id = b.name.slice(5);
              var row = document.querySelector('[data-freq-for="' + id + '"]');
              if (row) row.hidden = !b.checked;
              if (b.checked) anyOn = true;
            });
            if (empty) empty.hidden = anyOn;
            if (table) table.parentElement.hidden = !anyOn;
          }
          boxes.forEach(function (b) { b.addEventListener('change', sync); });
          sync();
        }());
      </script>
    `,
  );
}

export interface MergeGroup {
  suggestion: string;
  people: { id: number; display_name: string; done: number; needs_review: number }[];
}

export function mergePage(opts: {
  groups: MergeGroup[];
  all: { id: number; display_name: string; done: number }[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { groups, all, ctx, notice } = opts;
  return layout(
    {
      title: 'Merge duplicate people',
      eyebrow: 'People',
      heading: 'Merge duplicates',
      intro: 'The spreadsheet uses first names, so the same person can appear more than once. '
        + 'Merging moves all their history onto one record and removes the others.',
      back: BACK,
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p>${notice.text}</p></div>`
        : ''}

      <div class="notice notice-info">
        <p style="margin:0">
          Merging cannot be undone. Everything the duplicates did — every service, every role,
          every pairing — moves onto the person you keep, so nothing is lost.
        </p>
      </div>

      ${groups.length
        ? html`<h2 class="section-h2">Likely duplicates</h2>
            ${groups.map(
              (g) => html`<div class="card">
                <h3 style="margin-top:0">${g.suggestion}</h3>
                <p style="color:var(--ink-2)">
                  Choose the one to keep, then tick the others to fold into it —
                  or, if these really are different people, say so and they will stop
                  being flagged.
                </p>
                <form method="post" action="/app/settings/people/merge">
                  <div class="table-scroll">
                    <table class="grid">
                      <thead><tr><th>Keep</th><th>Merge in</th><th>Name</th>
                                 <th class="num">Times on the rota</th><th></th></tr></thead>
                      <tbody>
                        ${g.people.map(
                          (p, i) => html`<tr>
                            <td><input type="radio" name="keep_id" value="${p.id}" ${i === 0 ? 'checked' : ''}
                                       aria-label="Keep ${p.display_name}" style="width:1.3rem;height:1.3rem"></td>
                            <td><input type="checkbox" name="merge_ids" value="${p.id}"
                                       aria-label="Merge ${p.display_name}" style="width:1.3rem;height:1.3rem"></td>
                            <td><a href="/app/settings/people/${p.id}"><strong>${p.display_name}</strong></a>
                                ${p.needs_review ? chip('amber', 'flagged') : ''}</td>
                            <td class="num">${p.done}</td>
                            <td>
                              <button class="linkish" type="submit"
                                      formaction="/app/settings/people/${p.id}/not-duplicate"
                                      formnovalidate
                                      title="Leave ${p.display_name} as their own person and stop flagging them">
                                Not a duplicate
                              </button>
                            </td>
                          </tr>`,
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div class="btn-row" style="margin-top:1rem">
                    <button class="btn-primary" type="submit">Merge the ticked ones</button>
                    <button class="btn-secondary" type="submit" formnovalidate
                            formaction="/app/settings/people/not-duplicates"
                            title="Clear the flag on all ${g.people.length} without merging anything">
                      These are all different people
                    </button>
                  </div>
                  ${g.people.map((p) => html`<input type="hidden" name="group_ids" value="${p.id}">`)}
                </form>
              </div>`,
            )}`
        : html`<div class="card"><p style="margin:0">
            No likely duplicates left. Anything flagged has been dealt with.
          </p></div>`}

      <h2 class="section-h2">Merge any two people</h2>
      <form method="post" action="/app/settings/people/merge" class="card">
        <p style="margin-top:0;color:var(--ink-2)">
          For duplicates the system did not spot — different first names for the same person, say.
        </p>
        <div class="grid-fields">
          <div class="field">
            <label for="keep_any">Keep this person</label>
            <select id="keep_any" name="keep_id" required>
              ${all.map((p) => html`<option value="${p.id}">${p.display_name} (${p.done})</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="merge_any">Fold this one into them</label>
            <select id="merge_any" name="merge_ids" required>
              ${all.map((p) => html`<option value="${p.id}">${p.display_name} (${p.done})</option>`)}
            </select>
          </div>
        </div>
        <button class="btn-primary" type="submit">Merge</button>
      </form>
    `,
  );
}
