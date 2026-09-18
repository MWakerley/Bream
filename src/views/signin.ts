import { html } from 'hono/html';
import { layout } from './layout.js';

export function signInPage(opts: { error?: string; next?: string } = {}) {
  return layout(
    { title: 'Sign in', heading: 'Bream Church', chrome: false },
    html`
      <div class="signin-wrap">
        <p class="page-intro">Rota and diary management. Please sign in.</p>

        ${opts.error
          ? html`<div class="notice notice-bad" role="alert"><p>${opts.error}</p></div>`
          : ''}

        <form method="post" action="/auth/sign-in" class="card">
          <input type="hidden" name="next" value="${opts.next ?? '/app'}">
          <div class="field">
            <label for="email">Username</label>
            <span class="hint">
              Your name with the spaces taken out — Andy Ewens signs in as
              <strong>andyewens</strong>. Your email address works too, if you gave one.
            </span>
            <input id="email" name="email" type="text" autocomplete="username"
                   autocapitalize="none" required autofocus>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <button class="btn-primary" type="submit">Sign in</button>
        </form>
      </div>
    `,
  );
}

/** The one-time bootstrap form. Reachable only while no admin exists AND the
 *  caller presents the ADMIN_BOOTSTRAP_TOKEN secret. */
export function setupPage(token: string, error?: string) {
  return layout(
    { title: 'Create the first administrator', chrome: false },
    html`
      <div class="signin-wrap">
        <p class="page-intro">
          This form works once. After the first administrator exists it stops responding,
          whether or not the setup token is still set.
        </p>

        ${error ? html`<div class="notice notice-bad" role="alert"><p>${error}</p></div>` : ''}

        <form method="post" action="/admin/setup" class="card">
          <input type="hidden" name="token" value="${token}">
          <div class="field">
            <label for="name">Your name</label>
            <input id="name" name="name" type="text" required autofocus>
          </div>
          <div class="field">
            <label for="email">Email</label>
            <span class="hint">This is what you will sign in with.</span>
            <input id="email" name="email" type="email" autocomplete="username" required>
          </div>
          <div class="field">
            <label for="password">Choose a password</label>
            <span class="hint">At least 12 characters. It is hashed here and never stored anywhere else.</span>
            <input id="password" name="password" type="password" autocomplete="new-password"
                   minlength="12" required>
          </div>
          <div class="field">
            <label for="password2">Type it again</label>
            <input id="password2" name="password2" type="password" autocomplete="new-password"
                   minlength="12" required>
          </div>
          <button class="btn-primary" type="submit">Create administrator</button>
        </form>
      </div>
    `,
  );
}
