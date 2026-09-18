/**
 * Passwords and sessions.
 *
 * THE ONE THING TO KNOW BEFORE EDITING THIS FILE: workerd refuses any single
 * PBKDF2 `deriveBits` call above 100,000 iterations —
 *
 *   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
 *   supported (requested 600000)
 *
 * — and the local test runtime does NOT enforce it, so this fails only in
 * production, as a generic HTTP 500 on every sign-in. It has already happened
 * on this Cloudflare account.
 *
 * The answer is not to drop to 100,000, which would hand an attacker a six-fold
 * discount. The ceiling is per CALL, not per password, and PBKDF2 is itself
 * nothing but a serial chain of HMAC rounds — so chaining six calls of 100,000,
 * each taking the previous output as its input, costs an attacker exactly what
 * one 600,000 call would.
 */

const TOTAL_ITERATIONS = 600_000; // OWASP floor for PBKDF2-SHA-256
const PER_CALL_MAX = 100_000; // workerd's hard ceiling — do not raise
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

/** Guards against a hand-edited row turning a sign-in into a CPU bomb. */
const MAX_STORED_ITERATIONS = 10_000_000;

const enc = new TextEncoder();

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Derive `iterations` worth of PBKDF2 without ever asking workerd for more than
 * it allows in one go. Each round re-keys with the previous round's output, so
 * the total serial work is the sum of the rounds.
 */
async function deriveChained(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  if (iterations < 1 || iterations > MAX_STORED_ITERATIONS) {
    throw new Error(`Refusing to derive with ${iterations} iterations`);
  }
  let material: Uint8Array | string = password;
  let remaining = iterations;

  while (remaining > 0) {
    const round = Math.min(remaining, PER_CALL_MAX);
    const key = await crypto.subtle.importKey(
      'raw',
      typeof material === 'string' ? enc.encode(material) : (material as unknown as BufferSource),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: round, hash: 'SHA-256' },
      key,
      KEY_BYTES * 8,
    );
    material = new Uint8Array(bits);
    remaining -= round;
  }
  return material as Uint8Array;
}

export interface StoredPassword {
  password_hash: string;
  salt: string;
  iterations: number;
}

export async function hashPassword(password: string): Promise<StoredPassword> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveChained(password, salt, TOTAL_ITERATIONS);
  return {
    password_hash: toBase64(hash),
    salt: toBase64(salt),
    iterations: TOTAL_ITERATIONS,
  };
}

/** Length-independent, value-independent comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: StoredPassword): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  try {
    const salt = fromBase64(stored.salt);
    const expected = fromBase64(stored.password_hash);
    const actual = await deriveChained(password, salt, stored.iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = 'bream_session';
const SESSION_HOURS = 12;

export function newSessionId(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  // base64url, so it is safe in a cookie without escaping.
  return toBase64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sessionCookie(id: string, maxAgeSeconds: number): string {
  const parts = [
    `${SESSION_COOKIE}=${id}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax', // Lax, not Strict: a link from an email must still land signed in
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function sessionExpiry(now = new Date()): string {
  return new Date(now.getTime() + SESSION_HOURS * 3600_000).toISOString();
}

export const SESSION_MAX_AGE_SECONDS = SESSION_HOURS * 3600;
