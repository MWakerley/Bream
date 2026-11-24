/**
 * Deleting a role from Admin Centre > Roles.
 *
 * What must hold: Delete asks first and says what will go (people ticked,
 * upcoming and past places); only somebody with the Admin Centre can do it;
 * everything hanging off the role goes with it and nothing else does; and a
 * second delete from a stale tab is harmless.
 *
 * Same set-up as one-off-test.
 *
 *   npm run test:roledel
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
const all = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) =>
  db.prepare(sql).all(...(args as never[])) as T[];

const env = { DB: d1 } as never;
const exec = { waitUntil() {}, passThroughOnException() {} } as never;
const call = async (path: string, init?: RequestInit, cookie = '') => {
  const res = await app.fetch(new Request(`https://bream.test${path}`, { ...init, headers: cookie ? { cookie } : {} }), env, exec);
  return { status: res.status, location: res.headers.get('location'), cookie: res.headers.get('set-cookie'), body: await res.text() };
};
const post = (path: string, fields: [string, string][], cookie?: string) =>
  call(path, { method: 'POST', body: new URLSearchParams(fields) }, cookie);

const PW = 'a-test-password-1';
async function withLogin(name: string, username: string, profile: string) {
  const id = run(`INSERT INTO people (display_name, username, profile_id)
                  VALUES (?, ?, (SELECT id FROM profiles WHERE name = ?))`, name, username, profile);
  const h = await hashPassword(PW);
  run('INSERT INTO credentials (person_id, password_hash, salt, iterations) VALUES (?, ?, ?, ?)',
    id, h.password_hash, h.salt, h.iterations);
  return id;
}
async function cookieFor(username: string) {
  const r = await post('/auth/sign-in', [['email', username], ['password', PW]]);
  return (r.cookie ?? '').split(';')[0] ?? '';
}

const one = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) =>
  db.prepare(sql).get(...(args as never[])) as T;

await withLogin('Claire', 'claire', 'Administrator');
await withLogin('Vera Volunteer', 'vera', 'Volunteer');
const admin = await cookieFor('claire');
const volunteer = await cookieFor('vera');

// A role with something of everything hanging off it.
const role = run(`INSERT INTO roles (key, name) VALUES ('flowers_test', 'Flowers Test')`);
const other = Number(one<{ id: number }>(`SELECT id FROM roles WHERE id <> ? ORDER BY id LIMIT 1`, role).id);
const ann = run(`INSERT INTO people (display_name) VALUES ('Ann Petal')`);
const bob = run(`INSERT INTO people (display_name) VALUES ('Bob Stem')`);
run('INSERT INTO person_roles (person_id, role_id, can_do, willing) VALUES (?, ?, 1, 1)', ann, role);
run('INSERT INTO person_roles (person_id, role_id, can_do, willing) VALUES (?, ?, 1, 1)', bob, role);
run('INSERT INTO person_roles (person_id, role_id, can_do, willing) VALUES (?, ?, 1, 1)', ann, other);
const past = run(`INSERT INTO services (service_date, service_time) VALUES ('2001-01-07', '10:30')`);
const future = run(`INSERT INTO services (service_date, service_time) VALUES ('2099-01-04', '10:30')`);
run(`INSERT INTO assignments (service_id, role_id, slot, person_id, status) VALUES (?, ?, 1, ?, 'confirmed')`, past, role, ann);
run(`INSERT INTO assignments (service_id, role_id, slot, one_off_name, status) VALUES (?, ?, 2, 'Guest', 'confirmed')`, past, role);
run(`INSERT INTO assignments (service_id, role_id, slot, person_id, status) VALUES (?, ?, 1, ?, 'confirmed')`, future, role, bob);
run(`INSERT INTO assignments (service_id, role_id, slot, person_id, status) VALUES (?, ?, 1, ?, 'confirmed')`, future, other, ann);
run(`INSERT INTO role_combinations (role_a_id, role_b_id, verdict) VALUES (?, ?, 'red')`,
  Math.min(role, other), Math.max(role, other));

const otherCounts = () => [
  one<{ n: number }>('SELECT COUNT(*) AS n FROM assignments WHERE role_id = ?', other).n,
  one<{ n: number }>('SELECT COUNT(*) AS n FROM person_roles WHERE role_id = ?', other).n,
].join('/');
const otherBefore = otherCounts();

console.log('deleting a role:');

const list = await call('/app/settings/roles', undefined, admin);
ok('the Roles page offers Delete on each role', list.status === 200
  && list.body.includes(`/app/settings/roles/${role}/delete`));

const ask = await call(`/app/settings/roles/${role}/delete`, undefined, admin);
ok('Delete asks first, saying what will go', ask.status === 200
  && ask.body.includes('2 people are ticked')
  && ask.body.includes('1 place on an upcoming service')
  && ask.body.includes('2 places on past services'), String(ask.status));
ok('and offers switching it off instead', ask.body.includes('switch it off instead'));
ok('asking deletes nothing', one<{ n: number }>('SELECT COUNT(*) AS n FROM roles WHERE id = ?', role).n === 1);

const refused = await post(`/app/settings/roles/${role}/delete`, [], volunteer);
ok('somebody without the Admin Centre cannot delete one', refused.status !== 200
  && one<{ n: number }>('SELECT COUNT(*) AS n FROM roles WHERE id = ?', role).n === 1, String(refused.status));

const done = await post(`/app/settings/roles/${role}/delete`, [], admin);
ok('the admin can delete it', done.status === 200 && done.body.includes('Deleted &quot;Flowers Test&quot;')
  && one<{ n: number }>('SELECT COUNT(*) AS n FROM roles WHERE id = ?', role).n === 0, String(done.status));
const left = (t: string) => one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE role_id = ?`, role).n;
ok('everything that hung off it went too',
  left('person_roles') === 0 && left('assignments') === 0
  && one<{ n: number }>('SELECT COUNT(*) AS n FROM role_combinations WHERE role_a_id = ? OR role_b_id = ?', role, role).n === 0);
ok('and other roles are untouched', otherCounts() === otherBefore, `${otherBefore} -> ${otherCounts()}`);

const again = await post(`/app/settings/roles/${role}/delete`, [], admin);
ok('deleting it again from a stale tab just goes back to Roles',
  again.status === 303 && again.location === '/app/settings/roles', `${again.status} ${again.location}`);

if (failures) { console.log(`\n${failures} failed.`); process.exit(1); }
console.log('\nDeleting roles OK.');
