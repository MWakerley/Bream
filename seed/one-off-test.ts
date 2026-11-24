/**
 * "Someone just for this service?" and My dates.
 *
 * The "Put somebody on…" list only offers people ticked for the role, so a
 * coordinator wanting somebody who is under People but not ticked types their
 * name into the one-off box instead. Kept as a bare name, that date never
 * reached the person's My dates — Iain preaching at the Christingle. What must
 * hold:
 *
 *   * a name that is exactly one active person's puts THAT person on, and the
 *     date is on their My dates;
 *   * a name nobody has stays a one-off;
 *   * a name two people share stays a one-off rather than guessing;
 *   * the matched person is not put on the same role twice.
 *
 * Same set-up as forgot-test: the whole app through its own fetch, against a
 * real SQLite database built from every migration.
 *
 *   npm run test:oneoff
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

await withLogin('Claire', 'claire', 'Administrator');
const iain = await withLogin('Zebedee Test', 'zebedee', 'Volunteer');
run(`INSERT INTO people (display_name) VALUES ('Quentin Twin')`);
run(`INSERT INTO people (display_name) VALUES ('quentin twin')`);
const roleId = (name: string) => Number(all<{ id: number }>('SELECT id FROM roles WHERE name = ?', name)[0]?.id);
const preacher = roleId('Preacher');
const tea = roleId('Tea and coffee');
// Iain is under People but NOT ticked for Preacher — the case that went wrong.
run('INSERT INTO person_roles (person_id, role_id, can_do, willing) VALUES (?, ?, 0, 1)', iain, preacher);
const svc = run(`INSERT INTO services (service_date, service_time, title)
                 VALUES ('2099-12-13', '10:30', 'Family Service & Christingle')`);

const claire = await cookieFor('claire');
const iainCookie = await cookieFor('zebedee');
ok('both can sign in', claire !== '' && iainCookie !== '');

const oneOff = (roleId: number, name: string) =>
  post(`/app/rota/service/${svc}/role/${roleId}/add-one-off`, [['name', name]], claire);
const rows = (roleId: number) => all<{ person_id: number | null; one_off_name: string | null }>(
  'SELECT person_id, one_off_name FROM assignments WHERE service_id = ? AND role_id = ? ORDER BY slot', svc, roleId);

console.log('one-off names:');

const r1 = await oneOff(preacher, '  zebedee   TEST ');
ok('typing a name already under People is accepted', r1.status === 303, String(r1.status));
const p = rows(preacher);
ok('and puts that person on, not a bare name',
  p.length === 1 && p[0]?.person_id === iain && p[0]?.one_off_name === null, JSON.stringify(p));

const mine = await call('/app/me', undefined, iainCookie);
ok('so the date is on their My dates',
  mine.status === 200 && mine.body.includes('Family Service &amp; Christingle'), String(mine.status));

await oneOff(preacher, 'Zebedee Test');
ok('typing them again does not put them on twice', rows(preacher).length === 1, JSON.stringify(rows(preacher)));

await oneOff(tea, 'Visiting Vicar');
const t1 = rows(tea);
ok('a name nobody has stays a one-off',
  t1.length === 1 && t1[0]?.person_id === null && t1[0]?.one_off_name === 'Visiting Vicar', JSON.stringify(t1));

await oneOff(tea, 'Quentin Twin');
const t2 = rows(tea);
ok('a name two people share stays a one-off rather than guessing',
  t2.length === 2 && t2[1]?.person_id === null && t2[1]?.one_off_name === 'Quentin Twin', JSON.stringify(t2));

if (failures) { console.log(`\n${failures} failed.`); process.exit(1); }
console.log('\nOne-off names OK.');
