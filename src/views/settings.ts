import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { searchBox } from './search.js';
import type { CombinationRow, PairingRow, PersonWithRoles, RoleRow } from '../db.js';

const BACK = { href: '/app', label: 'All areas' };

export function peoplePage(people: PersonWithRoles[], ctx: ViewCtx) {
  const needsReview = people.filter((p) => p.needs_review);
  return layout(
    { title: 'People and roles', back: BACK, ...ctx },
    html`
      <p class="page-intro">
        ${people.length} people. Click any name to change what they can do and how often
        they want to do it.
      </p>

      <div class="notice notice-info">
        <p style="margin-top:0">
          <strong>Setting up a role for lots of people at once?</strong>
          <a href="/app/settings/people/by-role">Edit by role</a> asks the question the other way
          round — pick Preacher, and tick everybody who could preach. Fourteen visits instead of
          sixty-nine.
        </p>
        <p style="margin-bottom:0">
          The ticks were taken from what each person has actually done on the
          September–November rota — but that is only a starting point. Somebody who has not
          read this quarter may be perfectly willing to read, so open them and tick it.
        </p>
      </div>

      ${needsReview.length
        ? html`<div class="notice notice-warn">
            <p><strong>${needsReview.length} names may be duplicates.</strong> The spreadsheet
              uses first names, so one person can appear more than once — Andy, Andy E and
              Andy Ewens are probably all the same person. Anyone still flagged is skipped when
              a rota is generated.</p>
            <p style="margin-bottom:0">
              <a class="btn-primary" href="/app/settings/people/merge">Merge duplicates</a>
            </p>
          </div>`
        : ''}

      <div class="btn-row" style="margin-bottom:1.25rem">
        <a class="btn-primary" href="/app/settings/people/new">Add a person</a>
        <a class="btn-secondary" href="/app/settings/people/merge">Merge duplicates</a>
        <a class="btn-secondary" href="/app/settings/people/by-role">Edit by role</a>
        <a class="btn-secondary" href="/app/settings/profiles">What people can see</a>
        <a class="btn-secondary" href="/app/settings/roles">Roles and numbers</a>
        <a class="btn-secondary" href="/app/settings/combinations">Combination rules</a>
        <a class="btn-secondary" href="/app/settings/pairs">Who works with whom</a>
      </div>

      ${searchBox({
        target: 'people-list',
        label: 'Find a person',
        placeholder: 'Start typing a name…',
        noun: 'people',
        hint: 'Matches the name, the full name, the email address and the roles they can do — '
          + 'so typing "preacher" lists everyone who can preach.',
      })}

      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr><th>Name</th><th>What they can do</th><th class="num">Roles</th><th>Status</th></tr>
          </thead>
          <!-- The rows carry their own searchable text. Keeping it to the four
               fields below stops a search for "Andy" matching somebody whose
               duplicate note merely mentions Andy. -->
          <tbody id="people-list">
            ${people.map(
              (p) => html`<tr class="${p.needs_review ? 'row-gap' : ''}"
                    data-search="${[p.display_name, p.full_name, p.email, p.role_names]
                      .filter(Boolean)
                      .join(' ')}">
                <td>
                  <a href="/app/settings/people/${p.id}"><strong>${p.display_name}</strong></a>
                </td>
                <td>${p.role_names ?? html`<span style="color:var(--ink-2)">nothing ticked yet</span>`}</td>
                <td class="num">${p.role_count}</td>
                <td>
                  ${p.needs_review
                    ? html`${chip('red', 'Possible duplicate')}
                        <div style="font-size:.9375rem;color:var(--ink-2);margin-top:.25rem">
                          ${p.review_note}
                        </div>`
                    : chip('green', 'OK')}
                </td>
              </tr>`,
            )}
          </tbody>
        </table>
      </div>
    `,
  );
}

export function rolesPage(
  roles: RoleRow[],
  ctx: ViewCtx,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  return layout(
    {
      title: 'Roles',
      eyebrow: 'Settings',
      heading: 'Roles',
      intro: 'What a service needs, and how many of each. Minimum is the point below which a '
        + 'service is flagged as having a gap; ideal is what the rota aims for.',
      back: BACK,
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <form method="post" action="/app/settings/roles">
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Role</th><th class="num">Minimum</th><th class="num">Ideal</th>
                <th>When</th><th>Called this on the spreadsheet</th><th>In use</th>
              </tr>
            </thead>
            <tbody>
              ${roles.map(
                (r) => html`<tr>
                  <td>
                    <input type="hidden" name="id" value="${r.id}">
                    <input type="text" name="name_${r.id}" value="${r.name}"
                           aria-label="Name of role ${r.name}" required>
                  </td>
                  <td>
                    <input type="number" name="min_${r.id}" value="${r.min_needed}" min="0" max="20"
                           style="width:5rem" aria-label="Minimum needed for ${r.name}">
                  </td>
                  <td>
                    <input type="number" name="ideal_${r.id}" value="${r.ideal_needed}" min="0" max="20"
                           style="width:5rem" aria-label="Ideal number for ${r.name}">
                  </td>
                  <td>
                    <select name="communion_${r.id}" aria-label="When ${r.name} applies">
                      <option value="0" ${r.communion_only ? '' : 'selected'}>Every service</option>
                      <option value="1" ${r.communion_only ? 'selected' : ''}>Communion only</option>
                    </select>
                  </td>
                  <td>
                    <input type="text" name="sheet_${r.id}" value="${r.sheet_heading ?? ''}"
                           aria-label="Spreadsheet heading for ${r.name}" placeholder="—">
                  </td>
                  <td>
                    <label class="check" style="padding:.4rem .6rem">
                      <input type="checkbox" name="active_${r.id}" value="1" ${r.is_active ? 'checked' : ''}
                             aria-label="${r.name} is in use">
                      <span class="check-label" style="font-size:.9375rem">Yes</span>
                    </label>
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>
        <p style="color:var(--ink-2);font-size:.9375rem">
          Turning a role off keeps its history but stops it being asked for on new services.
          Ideal must be at least the minimum.
        </p>
        <button class="btn-primary" type="submit">Save all roles</button>
      </form>

      <h2 class="section-h2">Add a role</h2>
      <form method="post" action="/app/settings/roles/new" class="card">
        <div class="grid-fields">
          <div class="field">
            <label for="new_name">What is it called</label>
            <span class="hint">e.g. Flowers, Bell ringing, Refreshments.</span>
            <input id="new_name" name="name" type="text" required>
          </div>
          <div class="field">
            <label for="new_min">Minimum needed</label>
            <span class="hint">Below this a service is flagged.</span>
            <input id="new_min" name="min_needed" type="number" min="0" max="20" value="1" required>
          </div>
          <div class="field">
            <label for="new_ideal">Ideal number</label>
            <span class="hint">What the rota aims for.</span>
            <input id="new_ideal" name="ideal_needed" type="number" min="0" max="20" value="1" required>
          </div>
          <div class="field">
            <label for="new_when">When it applies</label>
            <span class="hint">Communion-only roles do not exist on other Sundays.</span>
            <select id="new_when" name="communion_only">
              <option value="0">Every service</option>
              <option value="1">Communion services only</option>
            </select>
          </div>
        </div>
        <button class="btn-primary" type="submit">Add this role</button>
      </form>
    `,
  );
}

/**
 * The red/amber/green grid for one person holding two roles at the same service.
 * Rendered as a real matrix because that is how the question is actually asked —
 * "can the service leader also lead worship?" is a lookup of a row against a
 * column, not an entry in a list.
 */
export function combinationsPage(
  roles: RoleRow[],
  combos: CombinationRow[],
  ctx: ViewCtx,
) {
  const key = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
  const map = new Map(combos.map((c) => [key(c.role_a_id, c.role_b_id), c]));

  const counts = { green: 0, amber: 0, red: 0, unset: 0 };
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const c = map.get(key(roles[i]!.id, roles[j]!.id));
      if (c) counts[c.verdict]++;
      else counts.unset++;
    }
  }

  // The column headings are rotated, so their length becomes a height. Drop the
  // parenthetical age range — it is in the Roles page and repeating it here only
  // makes every column 3rem taller.
  const short = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');

  const cellFor = (a: RoleRow, b: RoleRow) => {
    const c = map.get(key(a.id, b.id));
    if (!c) return html`<td class="combo-unset" title="Not yet decided">·</td>`;
    const glyph = c.verdict === 'green' ? '✓' : c.verdict === 'amber' ? '~' : '✕';
    return html`<td
      class="combo-${c.verdict}"
      title="${a.name} + ${b.name}: ${c.verdict.toUpperCase()} — ${c.reason ?? ''}"
    >
      <span class="sr-only">${a.name} plus ${b.name}: ${c.verdict}. ${c.reason ?? ''}</span>
      <span aria-hidden="true">${glyph}</span>
    </td>`;
  };

  return layout(
    { title: 'Role combination rules', back: BACK, ...ctx },
    html`
      <p class="page-intro">
        When one person holds two roles at the same service. Green is fine, amber is allowed
        but not ideal, red is not allowed.
      </p>

      <div class="notice notice-ok">
        <p style="margin-top:0">
          ${counts.green} green · ${counts.amber} amber · ${counts.red} red ·
          ${counts.unset} not yet decided.
          The green rules were taken from combinations the church <em>already</em> does — hover
          any cell to see how often. The rest are left blank deliberately rather than guessed at.
        </p>
        <p style="margin-bottom:0">
          <strong>A blank cell is treated as allowed.</strong> Nothing is blocked until somebody
          says so, so anything that really must not happen needs setting to red.
        </p>
      </div>

      <div class="btn-row" style="margin-bottom:1.25rem">
        <a class="btn-primary" href="/app/settings/combinations/by-role">Change these rules</a>
      </div>

      <p style="color:var(--ink-2)">
        Click any role name below to set what that role may also do at the same service.
      </p>

      <div class="table-scroll">
        <table class="grid combo-grid">
          <thead>
            <tr>
              <th>Role</th>
              ${roles.map((r) => html`<th class="combo-head" title="${r.name}"><span>${short(r.name)}</span></th>`)}
            </tr>
          </thead>
          <tbody>
            ${roles.map(
              (a) => html`<tr>
                <th scope="row">
                  <a href="/app/settings/combinations/by-role?role=${a.id}">${a.name}</a>
                </th>
                ${roles.map((b) =>
                  a.id === b.id ? html`<td class="combo-self">—</td>` : cellFor(a, b),
                )}
              </tr>`,
            )}
          </tbody>
        </table>
      </div>

      <p style="color:var(--ink-2);font-size:.9375rem">
        ✓ green · ~ amber · ✕ red · · not yet decided
      </p>
    `,
  );
}

export function pairsPage(
  pairs: PairingRow[],
  people: { id: number; display_name: string }[],
  roles: RoleRow[],
  ctx: ViewCtx,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const musts = pairs.filter((p) => p.strength === 'must').length;

  return layout(
    {
      title: 'Who works with whom',
      eyebrow: 'Settings',
      heading: 'Who works with whom',
      intro: 'People who serve together. This is what stops the rota splitting up a couple who '
        + 'always do welcome as a pair.',
      back: BACK,
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <div class="notice notice-info">
        <p style="margin-top:0"><strong>Must</strong> means they cannot be separated. The rota
          will only use one of them if it can use both — and if it cannot, it leaves the place
          empty and says so rather than splitting them.</p>
        <p style="margin-bottom:0"><strong>Prefer</strong> means it will put them together where
          it can, but will use one of them on their own if that is what fills the service.</p>
      </div>

      <p style="color:var(--ink-2)">
        ${pairs.length} pairing${pairs.length === 1 ? '' : 's'},
        ${musts} of them compulsory. These were seeded from how often people appeared together
        on the old spreadsheet, so they all started as preferences — change any that are really
        fixed, and remove any that are just coincidence.
      </p>

      <form method="post" action="/app/settings/pairs">
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr><th>Together</th><th>In role</th><th>Strength</th><th>Why it is here</th><th>Remove</th></tr>
            </thead>
            <tbody>
              ${pairs.map(
                (p) => html`<tr>
                  <td><strong>${p.a_name}</strong> and <strong>${p.b_name}</strong></td>
                  <td>
                    <select name="role_${p.id}" aria-label="Role for ${p.a_name} and ${p.b_name}">
                      <option value="">Any role</option>
                      ${roles.map(
                        (r) => html`<option value="${r.id}" ${p.role_id === r.id ? 'selected' : ''}>${r.name}</option>`,
                      )}
                    </select>
                  </td>
                  <td>
                    <select name="strength_${p.id}" aria-label="Strength for ${p.a_name} and ${p.b_name}">
                      <option value="prefer" ${p.strength === 'must' ? '' : 'selected'}>Prefer together</option>
                      <option value="must" ${p.strength === 'must' ? 'selected' : ''}>Must be together</option>
                      <option value="avoid" ${p.mode === 'avoid' ? 'selected' : ''}>Keep apart</option>
                    </select>
                  </td>
                  <td style="color:var(--ink-2);font-size:.9375rem">${p.note ?? '—'}</td>
                  <td>
                    <label class="check" style="padding:.4rem .6rem">
                      <input type="checkbox" name="remove" value="${p.id}"
                             aria-label="Remove the pairing of ${p.a_name} and ${p.b_name}">
                      <span class="check-label" style="font-size:.9375rem">Remove</span>
                    </label>
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>
        <p style="margin-top:1rem">
          <button class="btn-primary" type="submit">Save all pairings</button>
        </p>
      </form>

      <h2 class="section-h2">Add a pairing</h2>
      <form method="post" action="/app/settings/pairs/new" class="card">
        <div class="grid-fields">
          <div class="field">
            <label for="a">This person</label>
            <select id="a" name="person_a" required>
              ${people.map((p) => html`<option value="${p.id}">${p.display_name}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="b">and this person</label>
            <select id="b" name="person_b" required>
              ${people.map((p) => html`<option value="${p.id}">${p.display_name}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="new_role">In which role</label>
            <span class="hint">Leave as "any" unless it only applies to one job.</span>
            <select id="new_role" name="role_id">
              <option value="">Any role</option>
              ${roles.map((r) => html`<option value="${r.id}">${r.name}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="new_strength">How firm is it</label>
            <span class="hint">Must means they are never split up.</span>
            <select id="new_strength" name="strength">
              <option value="prefer">Prefer together</option>
              <option value="must">Must be together</option>
              <option value="avoid">Keep apart</option>
            </select>
          </div>
        </div>
        <button class="btn-primary" type="submit">Add this pairing</button>
      </form>
    `,
  );
}
