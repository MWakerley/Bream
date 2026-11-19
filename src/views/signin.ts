import { html } from 'hono/html';
import { layout } from './layout.js';

/**
 * The front door: what breamchurch.stack66.com opens on.
 *
 * Its own document rather than the shared layout, because it is the one page
 * built around a navy hero — the logo stays on the white bar above it, never
 * on the navy, where the charcoal "Church" would all but vanish. The form sits
 * beside the welcome on a computer and under it on a phone.
 */
export function signInPage(opts: { error?: string; next?: string } = {}) {
  return html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — Bream Church Management System</title>
<meta name="description" content="The Bream Church Management System. Sign in to see the rota, book a room, put on an event or send the newsletter.">
<meta name="theme-color" content="#324158">
<link rel="icon" href="/assets/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/icon-180.png">
<meta property="og:title" content="Bream Church Management System">
<meta property="og:image" content="https://breamchurch.stack66.com/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Nunito+Sans:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/assets/app.css">
<link rel="stylesheet" href="/assets/landing.css">
</head>
<body class="landing">
<a class="skip" href="#main">Skip to content</a>

<header class="topbar topbar-bare">
  <div class="topbar-inner">
    <span class="brand"><img src="/assets/logo-transparent.png" width="227" height="93" alt="Bream Church"></span>
  </div>
</header>

<main id="main">
  <section class="hero">
    <div class="hero-inner hero-split">
      <div class="hero-words">
        <p class="eyebrow">Bream Church</p>
        <h1>Church <br>Management <br>System</h1>
        <p class="hero-lead">
          The rota, room bookings, events and the newsletter — everything that keeps
          church life running, in one place.
        </p>
        <p class="hero-note">
          Not got a sign-in? Whoever looks after the rota can set one up for you.
        </p>
      </div>

      <div class="signin-panel">
        <h2 class="signin-h2">Sign in</h2>
        ${opts.error
          ? html`<div class="notice notice-bad" role="alert"><p>${opts.error}</p></div>`
          : ''}

        <form method="post" action="/auth/sign-in">
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
          <button class="btn-primary btn-big btn-wide" type="submit">Sign in</button>
        </form>
        <p class="signin-forgot"><a href="/auth/forgotten-password">Forgotten your password?</a></p>
        <p class="signin-note">Not got a sign-in? Whoever looks after the rota can set one up for you.</p>
      </div>
    </div>
  </section>
</main>

<footer class="landing-foot">
  <div class="wrap">
    <p><strong>Bream Church</strong></p>
    <p>Church Management System · making a difference</p>
  </div>
</footer>
</body>
</html>`;
}

/**
 * "Forgotten your password?" — asks for their email and sends a temporary one.
 *
 * Says the same thing whether or not the address is on file, so the form cannot
 * be used to find out who has a sign-in here.
 */
export function forgottenPasswordPage(opts: {
  sent?: boolean;
  error?: string;
  /** Present only when the robot check is set up. */
  turnstileSitekey?: string;
} = {}) {
  return layout(
    { title: 'Forgotten your password', chrome: false },
    html`
      <div class="signin-wrap">
        ${opts.sent
          ? html`<div class="notice notice-ok" role="status">
              <p><strong>Check your email.</strong> If that address belongs to somebody with a
                sign-in here, a temporary password is on its way to it now.</p>
              <p style="margin-bottom:0">It works for 24 hours. When you sign in with it you will be
                asked to choose your own password straight away. Your old password keeps working
                until then, so if you remember it after all, just use that.</p>
            </div>
            <p class="page-intro">Nothing arrived after a few minutes? Look in your junk folder.
              If you have no email address on file, whoever looks after the rota can reset your
              password for you.</p>
            <p><a class="btn-primary" href="/auth/sign-in">Back to sign in</a></p>`
          : html`
            <p class="page-intro">
              Type the email address you gave the church and we will send you a temporary
              password. You will choose your own as soon as you sign in with it.
            </p>
            ${opts.error ? html`<div class="notice notice-bad" role="alert"><p>${opts.error}</p></div>` : ''}
            <form method="post" action="/auth/forgotten-password" class="card">
              <div class="field">
                <label for="email">Your email address</label>
                <input id="email" name="email" type="email" autocomplete="email"
                       autocapitalize="none" required autofocus maxlength="200">
              </div>
              ${opts.turnstileSitekey
                ? html`<div class="field">
                    <div class="cf-turnstile" data-sitekey="${opts.turnstileSitekey}"
                         data-theme="light" data-action="forgotten-password"></div>
                    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
                  </div>`
                : ''}
              <button class="btn-primary" type="submit">Send me a temporary password</button>
            </form>
            <p class="hint">No email address on file? Whoever looks after the rota can reset your
              password for you. <a href="/auth/sign-in">Back to sign in</a></p>`}
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
