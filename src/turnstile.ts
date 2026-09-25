/**
 * Cloudflare Turnstile, on the public event booking form.
 *
 * That form is the only page in this system anybody on the internet can post to
 * without signing in, which makes it the only page worth protecting this way.
 * Turnstile rather than a picture-of-a-bus CAPTCHA: most visitors are never
 * asked to do anything at all, and the ones who are get a checkbox rather than
 * a puzzle. The congregation includes people who would simply give up on
 * "select all the traffic lights".
 *
 * FAILING OPEN IS DELIBERATE. If no keys are configured the form takes bookings
 * with no challenge. A church that cannot take bookings because a key was
 * mistyped is worse off than a church that gets the occasional junk booking —
 * and junk bookings can now be deleted from the event page.
 */

/** Whether a challenge can be shown at all. Both halves have to be present. */
export function turnstileReady(env: { TURNSTILE_SITEKEY?: string; TURNSTILE_SECRET?: string }): boolean {
  return Boolean(env.TURNSTILE_SITEKEY && env.TURNSTILE_SECRET);
}

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

/**
 * Check the token the widget put in the form.
 *
 * `remoteIp` is passed when we have it — Cloudflare puts the visitor's address
 * in CF-Connecting-IP — because it lets Turnstile spot one machine hammering
 * the form with freshly solved tokens.
 */
export async function verifyTurnstile(
  env: { TURNSTILE_SITEKEY?: string; TURNSTILE_SECRET?: string },
  token: string,
  remoteIp?: string | null,
  /** The words on the button the visitor presses, so "press X again" names
   *  a button that is actually on their page. */
  button = 'Book my place',
): Promise<TurnstileResult> {
  if (!turnstileReady(env)) return { ok: true, skipped: true };

  if (!token) {
    return {
      ok: false,
      error: `Please tick the box that says you are not a robot, then press ${button} again.`,
    };
  }

  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET!);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  let data: { success?: boolean; 'error-codes'?: string[] };
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    data = await res.json();
  } catch (err) {
    // Cloudflare's own endpoint being unreachable is not the visitor's fault,
    // and turning that into "your booking failed" would lose real bookings for
    // a fault at our end. Logged so it is visible in `wrangler tail`.
    console.error('Turnstile verification unreachable', err);
    return { ok: true, skipped: true };
  }

  if (data.success) return { ok: true };

  const codes = data['error-codes'] ?? [];
  console.error('Turnstile rejected a booking', codes);

  // A token is single-use and expires after about five minutes, so the common
  // real-world failure is somebody leaving the form open and coming back to it.
  // That deserves "try again", not "you look like a robot".
  const stale = codes.includes('timeout-or-duplicate');
  return {
    ok: false,
    error: stale
      ? 'This page has been open a while, so the "not a robot" check expired. '
        + `Everything you typed is still here — tick it again and press ${button}.`
      : 'The "not a robot" check did not pass. Please tick the box and try once more. '
        + 'If it keeps refusing, ring the church office and they will book you in.',
  };
}
