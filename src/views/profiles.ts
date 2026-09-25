import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { AREAS, type ProfileRow } from '../access.js';

const BACK = { href: '/app/settings', label: 'Settings' };

export function profilesPage(opts: {
  profiles: ProfileRow[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { profiles, ctx, notice } = opts;

  return layout(
    {
      title: 'What people can see',
      eyebrow: 'Settings',
      heading: 'What people can see',
      intro: 'A profile is a set of areas. Everyone is given one, and it decides which pages '
        + 'they can open.',
      back: BACK,
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <div class="notice notice-info">
        <p style="margin:0">
          Ticking nothing gives someone a sign-in that can see nothing, which is a fair way to
          suspend an account without deleting anybody. The system will not let you remove
          <strong>Settings</strong> from the last profile that has it, because that would lock
          everybody out with no way back in.
        </p>
      </div>

      ${profiles.map(
        (p) => html`<form method="post" action="/app/settings/profiles/${p.id}" class="card">
          <div style="display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:baseline;justify-content:space-between">
            <h2 style="margin:0">${p.name}</h2>
            <span>
              ${p.is_admin ? chip('navy', 'Full access') : ''}
              ${p.is_default ? chip('green', 'Given to new people') : ''}
              ${chip('neutral', `${p.people} ${p.people === 1 ? 'person' : 'people'}`)}
            </span>
          </div>

          <div class="grid-fields" style="margin-top:1rem">
            <div class="field">
              <label for="name_${p.id}">Name of this profile</label>
              <input id="name_${p.id}" name="name" type="text" value="${p.name}" required>
            </div>
            <div class="field">
              <label for="desc_${p.id}">What it is for</label>
              <input id="desc_${p.id}" name="description" type="text" value="${p.description ?? ''}">
            </div>
          </div>

          <div class="checks">
            ${AREAS.map(
              (a) => html`<label class="check">
                <input type="checkbox" name="area" value="${a.key}" ${p.areas.includes(a.key) ? 'checked' : ''}>
                <span>
                  <span class="check-label">${a.label}</span>
                  <span class="check-note">${a.note}</span>
                </span>
              </label>`,
            )}
          </div>

          <div class="checks" style="margin-top:.75rem">
            <label class="check">
              <input type="checkbox" name="is_default" value="1" ${p.is_default ? 'checked' : ''}>
              <span><span class="check-label">Give this to new people</span>
                <span class="check-note">Only one profile can be the default.</span></span>
            </label>
          </div>

          <div class="btn-row" style="margin-top:1rem">
            <button class="btn-primary" type="submit">Save this profile</button>
            ${p.people === 0 && !p.is_admin
              ? html`<button class="btn-danger" type="submit"
                        formaction="/app/settings/profiles/${p.id}/delete" formnovalidate
                        onclick="return confirm('Delete the ${p.name} profile?')">Delete</button>`
              : html`<span style="color:var(--ink-2);font-size:.9375rem">
                  ${p.is_admin ? 'The full-access profile cannot be deleted.' : `Used by ${p.people}, so it cannot be deleted.`}
                </span>`}
          </div>
        </form>`,
      )}

      <h2 class="section-h2">Add a profile</h2>
      <form method="post" action="/app/settings/profiles/new" class="card">
        <div class="grid-fields">
          <div class="field">
            <label for="new_name">Name</label>
            <span class="hint">e.g. "Vestry", "Youth leader".</span>
            <input id="new_name" name="name" type="text" required>
          </div>
          <div class="field">
            <label for="new_desc">What it is for</label>
            <span class="hint">Optional.</span>
            <input id="new_desc" name="description" type="text">
          </div>
        </div>
        <div class="checks">
          ${AREAS.map(
            (a) => html`<label class="check">
              <input type="checkbox" name="area" value="${a.key}" ${a.key === 'me' ? 'checked' : ''}>
              <span><span class="check-label">${a.label}</span>
                <span class="check-note">${a.note}</span></span>
            </label>`,
          )}
        </div>
        <button class="btn-primary" type="submit" style="margin-top:1rem">Add this profile</button>
      </form>
    `,
  );
}

export function addPersonPage(opts: {
  profiles: ProfileRow[];
  ctx: ViewCtx;
  error?: string;
  form?: Record<string, string>;
  /** Shown once, after an account is made. */
  created?: { name: string; username: string; password: string; emailed: string | null; emailError: string | null };
}) {
  const { profiles, ctx } = opts;
  const f = opts.form ?? {};
  const c = opts.created;

  return layout(
    {
      title: 'Add a person',
      eyebrow: 'Settings',
      heading: 'Add a person',
      intro: 'Add somebody to the roster. Give them a sign-in as well if they need one.',
      back: { href: '/app/settings/people', label: 'People' },
      ...ctx,
    },
    html`
      ${opts.error ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">${opts.error}</p></div>` : ''}

      ${c
        ? html`<div class="notice notice-ok">
            <p><strong>${c.name} has been added.</strong></p>
            <p style="margin-bottom:.5rem">Their sign-in is:</p>
            <p class="creds">
              <span><span class="creds-l">Username</span><strong>${c.username}</strong></span>
              <span><span class="creds-l">Temporary password</span><strong>${c.password}</strong></span>
            </p>
            <p>
              <strong>This password is shown once and is not stored anywhere in readable form.</strong>
              They must change it the first time they sign in.
            </p>
            ${c.emailed
              ? html`<p style="margin-bottom:0">It has been emailed to ${c.emailed}.</p>`
              : c.emailError
                ? html`<p style="margin-bottom:0">
                    It could <strong>not</strong> be emailed (${c.emailError}), so please pass it on
                    yourself.</p>`
                : html`<p style="margin-bottom:0">No email address was given, so please pass it on yourself.</p>`}
          </div>`
        : ''}

      <form method="post" action="/app/settings/people/new" class="card">
        <div class="grid-fields grid-3">
          <div class="field">
            <label for="display_name">Name on the rota</label>
            <span class="hint">How they appear on the printed rota.</span>
            <input id="display_name" name="display_name" type="text" value="${f.display_name ?? ''}" required>
          </div>
          <div class="field">
            <label for="full_name">Full name</label>
            <span class="hint">Optional.</span>
            <input id="full_name" name="full_name" type="text" value="${f.full_name ?? ''}">
          </div>
          <div class="field">
            <label for="email">Email</label>
            <span class="hint">Needed to send them their sign-in.</span>
            <input id="email" name="email" type="email" value="${f.email ?? ''}">
          </div>
        </div>

        <h3 style="margin-bottom:.5rem">Do they need to sign in?</h3>
        <div class="checks">
          <label class="check">
            <input type="checkbox" id="give_login" name="give_login" value="1"
                   ${f.give_login ? 'checked' : ''}>
            <span><span class="check-label">Give them a sign-in</span>
              <span class="check-note">Most volunteers on the rota do not need one. Leave this
                off to add somebody to the roster only.</span></span>
          </label>
        </div>

        <div id="login-fields" hidden style="margin-top:1.25rem">
          <div class="grid-fields">
            <div class="field">
              <label for="username">Username</label>
              <span class="hint">What they type to sign in. Left blank, one is made from their name.</span>
              <input id="username" name="username" type="text" value="${f.username ?? ''}"
                     autocapitalize="none" autocomplete="off">
            </div>
            <div class="field">
              <label for="profile_id">What they can see</label>
              <span class="hint">Can be changed at any time under "What people can see".</span>
              <select id="profile_id" name="profile_id">
                ${profiles.map(
                  (p) => html`<option value="${p.id}" ${p.is_default ? 'selected' : ''}>${p.name}</option>`,
                )}
              </select>
            </div>
          </div>
          <div class="checks">
            <label class="check">
              <input type="checkbox" name="send_email" value="1" checked>
              <span><span class="check-label">Email them their sign-in details</span>
                <span class="check-note">Only possible if an email address is given above.</span></span>
            </label>
          </div>
          <p class="hint" style="margin-top:.75rem">
            A temporary password is generated and shown once. They must change it the first
            time they sign in.
          </p>
        </div>

        <button class="btn-primary" type="submit" style="margin-top:1.25rem">Add this person</button>
      </form>

      <script>
        // The sign-in questions only apply when a sign-in is being given.
        (function () {
          var box = document.getElementById('give_login');
          var fields = document.getElementById('login-fields');
          function sync() { fields.hidden = !box.checked; }
          box.addEventListener('change', sync);
          sync();
        }());
      </script>
    `,
  );
}

/** Forced on first sign-in, and reachable afterwards from the top bar. */
export function changePasswordPage(opts: { ctx?: ViewCtx; forced: boolean; error?: string }) {
  return layout(
    {
      title: 'Choose a password',
      heading: opts.forced ? 'Choose your own password' : 'Change your password',
      eyebrow: 'Bream Church',
      chrome: false,
    },
    html`
      <div class="signin-wrap">
        ${opts.forced
          ? html`<p class="page-intro">
              You signed in with a temporary password. Please choose your own before carrying on.
            </p>`
          : ''}
        ${opts.error ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">${opts.error}</p></div>` : ''}
        <form method="post" action="/auth/change-password" class="card">
          <div class="field">
            <label for="current">Your current password</label>
            <input id="current" name="current" type="password" autocomplete="current-password" required autofocus>
          </div>
          <div class="field">
            <label for="password">New password</label>
            <span class="hint">At least 12 characters. A few words together is easier to
              remember than something unpronounceable, and harder to guess.</span>
            <input id="password" name="password" type="password" autocomplete="new-password"
                   minlength="12" required>
          </div>
          <div class="field">
            <label for="password2">Type it again</label>
            <input id="password2" name="password2" type="password" autocomplete="new-password"
                   minlength="12" required>
          </div>
          <button class="btn-primary" type="submit">Save my password</button>
        </form>
      </div>
    `,
  );
}
