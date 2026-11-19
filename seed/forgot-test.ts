/**
 * "Forgotten your password?" end to end.
 *
 * Drives the whole app through its own fetch, against a real SQLite database
 * built from every migration, with a stand-in for the mail binding — the same
 * set-up as message-test. What must hold:
 *
 *   * the reply never says whether an address is on file;
 *   * asking does NOT stop the real password working (a stranger can ask for
 *     anybody), and signing in with the real one cancels the temporary one;
 *   * the temporary password signs in once, is sent straight to choose a new
 *     password, and is then the password until changed;
 *   * it expires, and cannot be asked for again within ten minutes;
 *   * the Login history records the request and the temporary sign-in, and
 *     does not count the request as a sign-in.
 *
 *   npm run test:forgot
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { hashPassword } from '../src/auth.js';
import app from '../src/index.js';

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
// 0008 is skipped for the reason given in public-rooms-test.
const SKIP = new Set(['0008_import_room_bookings.sql']);
for (const f of readdirSync('migrations').filter((n) => n.endsWith('.sql') && !SKIP.has(n)).sort()) {
  try { db.exec(readFileSync(`migrations/${f}`, 'utf8')); } catch (e) { throw new Error(`${f}: ${(e as Error).message}`); }
}

/** Just enough of D1 — see public-rooms-test for the same shim, explained. */
function statement(sql: string, args: unknown[] = []) {
  const exec = () => {
    const p = db.prepare(sql);
    if (/^\s*(SELECT|WITH)\b/i.test(sql)) return { results: p.all(...(args as never[])), meta: { changes: 0 } };
    const r = p.run(...(args as never[]));
    return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  };
  return {
    bind: (...a: unknown[]) => statement(sql, a),
    async all() { return { results: db.prepare(sql).all(...(args as never[])), meta: {} }; },
    async first(col?: string) {
      const row = (db.prepare(sql).get(...(args as never[])) ?? null) as Record<string, unknown> | null;
      return col ? (row?.[col] ?? null) : row;
    },
    async run() { return exec(); },
    exec,
  };
}
const d1 = {
  prepare: (sql: string) => statement(sql),
  async batch(stmts: { exec(): unknown }[]) {
    db.exec('BEGIN');
    try { const out = stmts.map((s) => s.exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
} as unknown as D1Database;
const run = (sql: string, ...args: unknown[]) => Number(db.prepare(sql).run(...(args as never[])).lastInsertRowid);
const one = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) =>
  db.prepare(sql).get(...(args as never[])) as T;

const outbox: { to: unknown; subject: string; text: string }[] = [];
const binding = { async send(m: { to: unknown; subject: string; text: string }) { outbox.push(m); } };
// No Turnstile keys: the check is skipped, as it fails open by design.
const env = { DB: d1, EMAIL: binding, ACK_FROM: 'bookings@church.test' } as never;
const exec = { waitUntil() {}, passThroughOnException() {} } as never;
const call = async (path: string, init?: RequestInit, cookie = '') => {
  const res = await app.fetch(new Request(`https://bream.test${path}`, { ...init, headers: cookie ? { cookie } : {} }), env, exec);
  return { status: res.status, location: res.headers.get('location'), cookie: res.headers.get('set-cookie'), body: await res.text() };
};
const post = (path: string, fields: [string, string][], cookie?: string) =>
  call(path, { method: 'POST', body: new URLSearchParams(fields) }, cookie);
const signIn = (who: string, password: string) => post('/auth/sign-in', [['email', who], ['password', password]]);
const ask = (who: string) => post('/auth/forgotten-password', [['email', who]]);
const tempFrom = (text: string) => /Temporary password:\s+(\S+)/.exec(text)?.[1] ?? '';

const REAL = 'the-real-password-1';
const sue = run(`INSERT INTO people (display_name, email, username, profile_id)
                 VALUES ('Sue Baker', 'sue@example.org', 'suebaker', (SELECT id FROM profiles WHERE name = 'Volunteer'))`);
{
  const h = await hashPassword(REAL);
  run('INSERT INTO credentials (person_id, password_hash, salt, iterations) VALUES (?, ?, ?, ?)',
    sue, h.password_hash, h.salt, h.iterations);
}
// Somebody with a sign-in but no email: nothing can be sent to them.
const alaha = run(`INSERT INTO people (display_name, username) VALUES ('Alaha', 'alaha')`);
{
  const h = await hashPassword(REAL);
  run('INSERT INTO credentials (person_id, password_hash, salt, iterations) VALUES (?, ?, ?, ?)',
    alaha, h.password_hash, h.salt, h.iterations);
}
const kinds = () => (db.prepare('SELECT kind FROM sign_ins WHERE person_id = ? ORDER BY id').all(sue) as { kind: string }[])
  .map((r) => r.kind).join(',');

console.log('forgotten password:');

const page = await call('/auth/forgotten-password');
ok('the page asks for an email', page.status === 200 && page.body.includes('name="email"'));
ok('and the sign-in page links to it', (await call('/auth/sign-in')).body.includes('/auth/forgotten-password'));

// Nobody, no email, and somebody real all get exactly the same reply.
const r0 = await ask('nobody@example.org');
const r1 = await ask('alaha');
const r2 = await ask('SUE@example.org');
const strip = (b: string) => b.replace(/\s+/g, ' ');
ok('the reply never says whether an address is on file',
  r0.status === 200 && strip(r0.body) === strip(r1.body) && strip(r1.body) === strip(r2.body));
ok('only the real one is emailed, to the address on file', outbox.length === 1
  && String(outbox[0]?.to) === 'sue@example.org', JSON.stringify(outbox.map((m) => m.to)));
const temp = tempFrom(outbox[0]?.text ?? '');
ok('the email has a temporary password and their username', temp.length >= 12
  && (outbox[0]?.text ?? '').includes('suebaker'));
ok('the request is on the Login history', kinds() === 'reset_requested', kinds());

// Asking again straight away sends nothing more.
await ask('sue@example.org');
ok('a second ask within ten minutes sends nothing', outbox.length === 1);

// A stranger asking does not lock Sue out: her own password still works, and
// using it cancels the temporary one.
const own = await signIn('suebaker', REAL);
ok('her real password still works after the ask', own.status === 303 && own.location === '/app', `${own.status} ${own.location}`);
const late = await signIn('suebaker', temp);
ok('and once she has used it, the temporary one no longer does', late.status === 401);
ok('the history says she signed in with her password', kinds() === 'reset_requested,password', kinds());

// Ask again (past the ten minutes) and use the temporary password this time.
run(`UPDATE credentials SET reset_requested_at = datetime('now', '-11 minutes') WHERE person_id = ?`, sue);
await ask('sue@example.org');
const temp2 = tempFrom(outbox[1]?.text ?? '');
ok('after ten minutes another can be sent', outbox.length === 2 && temp2 !== '' && temp2 !== temp);
const viaTemp = await signIn('sue@example.org', temp2);
ok('the temporary password signs in and goes straight to choosing a new one',
  viaTemp.status === 303 && viaTemp.location === '/auth/change-password' && !!viaTemp.cookie, `${viaTemp.status} ${viaTemp.location}`);
const cookie = (viaTemp.cookie ?? '').split(';')[0] ?? '';
const gated = await call('/app', undefined, cookie);
ok('and nothing else opens until they have', gated.status === 302 && gated.location === '/auth/change-password');
ok('it is on the history as a temporary-password sign-in',
  kinds() === 'reset_requested,password,reset_requested,temporary', kinds());
ok('their old password has been replaced by it', (await signIn('suebaker', REAL)).status === 401);

const NEW = 'a-brand-new-password-2';
const changed = await post('/auth/change-password',
  [['current', temp2], ['password', NEW], ['password2', NEW]], cookie);
ok('choosing a new password works with the temporary one as "current"',
  changed.status === 303 && changed.location === '/app?password=changed', `${changed.status} ${changed.location}`);
ok('and then the new password signs in', (await signIn('suebaker', NEW)).status === 303);

// Expiry.
run(`UPDATE credentials SET reset_requested_at = NULL WHERE person_id = ?`, sue);
await ask('sue@example.org');
const temp3 = tempFrom(outbox[2]?.text ?? '');
run(`UPDATE credentials SET reset_expires_at = datetime('now', '-1 minute') WHERE person_id = ?`, sue);
ok('an expired temporary password does not sign in', (await signIn('suebaker', temp3)).status === 401);
ok('somebody who has stopped serving is sent nothing', await (async () => {
  run('UPDATE people SET is_active = 0 WHERE id = ?', sue);
  run(`UPDATE credentials SET reset_requested_at = NULL WHERE person_id = ?`, sue);
  const before = outbox.length;
  await ask('sue@example.org');
  return outbox.length === before;
})());
const counted = one<{ n: number }>(`SELECT COUNT(*) AS n FROM sign_ins WHERE person_id = ? AND kind <> 'reset_requested'`, sue).n;
ok('requests are recorded but not counted as sign-ins', counted === 3, `counted ${counted}`);

console.log(failures === 0 ? '\nForgotten password OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
