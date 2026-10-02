/**
 * Applying a draft never writes over a confirmed booking.
 *
 * Runs the statements Apply uses (src/rota/apply.ts) against a real SQLite
 * database built from every migration in order, so the schema — the unique
 * (service, role, slot), the foreign keys, the cascade onto change requests —
 * is the one production has, not a copy of it typed out here.
 *
 *   npm run test:apply
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { CLEAR_DRAFT_PLACES_SQL, PLACE_SQL, appliedNotice } from '../src/rota/apply.js';
import { MERGE_PERSON_ROLES_SQL } from '../src/db.js';

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

console.log('applying a draft:');

const db = new DatabaseSync(':memory:');
// D1 enforces foreign keys; plain SQLite does not unless asked.
db.exec('PRAGMA foreign_keys = ON');
// Relative to the repo root, which is where npm runs the bundled test from.
//
// One migration is skipped: 0008 is the room diary's data import, regenerated
// after 0010 added the external_ref column it now fills, so it no longer runs
// against a database built from scratch in order. It is room bookings only —
// nothing Apply reads or writes — and every other migration, schema and seed
// alike, runs exactly as production ran it.
const SKIP = new Set(['0008_import_room_bookings.sql']);
for (const f of readdirSync('migrations').filter((n) => n.endsWith('.sql') && !SKIP.has(n)).sort()) {
  try {
    db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  } catch (e) {
    throw new Error(`${f}: ${(e as Error).message}`);
  }
}

const one = <T>(sql: string, ...args: unknown[]) => db.prepare(sql).get(...(args as never[])) as T;
const role = one<{ id: number }>('SELECT id FROM roles ORDER BY id LIMIT 1').id;
const [a, b, c] = (db.prepare('SELECT id FROM people ORDER BY id LIMIT 3').all() as { id: number }[]).map((r) => r.id);
const svc = Number(db.prepare(
  `INSERT INTO services (service_date, service_time, title) VALUES ('2030-01-06', '10:30', 'Worship')`,
).run().lastInsertRowid);

const row = (slot: number) => one<{ id: number; person_id: number; status: string; generated: number; reason: string } | undefined>(
  'SELECT id, person_id, status, generated, reason FROM assignments WHERE service_id = ? AND role_id = ? AND slot = ?',
  svc, role, slot);

// Slot 1: confirmed by hand on the service page WHILE the draft was open.
db.prepare(`INSERT INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
            VALUES (?, ?, 1, ?, 'confirmed', 0, 'Put on by Matt')`).run(svc, role, a);
// Slot 2: somebody who declined, with their "I cannot make it" attached.
const declined = Number(db.prepare(`INSERT INTO assignments (service_id, role_id, slot, person_id, status, generated)
            VALUES (?, ?, 2, ?, 'declined', 0)`).run(svc, role, b).lastInsertRowid);
db.prepare(`INSERT INTO change_requests (assignment_id, person_id, kind) VALUES (?, ?, 'cannot_do')`).run(declined, b);
// Slot 3: empty.

const draft = [
  { slot: 1, personId: c, reason: 'Generated for slot 1.' },
  { slot: 2, personId: c, reason: 'Generated for slot 2.' },
  { slot: 3, personId: b, reason: 'Put on by Matt while checking the draft.' },
];
db.prepare(CLEAR_DRAFT_PLACES_SQL).run(JSON.stringify(draft.map((d) => [svc, role, d.slot])));
const changes = draft.map((d) => Number(db.prepare(PLACE_SQL).run(svc, role, d.slot, d.personId, d.reason).changes));

const s1 = row(1)!;
ok('a booking confirmed while the draft was open is left exactly as it was',
  s1.person_id === a && s1.status === 'confirmed' && s1.reason === 'Put on by Matt',
  JSON.stringify(s1));
ok('and the write for that place reports no change, which is how Apply counts it', changes[0] === 0,
  `changes ${changes.join(',')}`);

const s2 = row(2)!;
ok('a place that is not confirmed is replaced by the draft', s2.person_id === c && s2.status === 'draft' && s2.generated === 1,
  JSON.stringify(s2));
ok("and the old person's \"I cannot make it\" goes with their row rather than moving to the new one",
  one<{ n: number }>('SELECT COUNT(*) AS n FROM change_requests').n === 0);

const s3 = row(3)!;
ok('an empty place is filled, as draft, with its reason', s3.person_id === b && s3.status === 'draft'
  && s3.reason.startsWith('Put on by '), JSON.stringify(s3));
ok('so two of the three went on', changes.filter((n) => n > 0).length === 2);

// The clear never reaches a confirmed row, even one it is pointed at directly.
db.prepare(CLEAR_DRAFT_PLACES_SQL).run(JSON.stringify([[svc, role, 1]]));
ok('the clear never deletes a confirmed booking', row(1)?.status === 'confirmed');

// Nor a place it was not given.
db.prepare(`INSERT INTO assignments (service_id, role_id, slot, person_id, status, generated)
            VALUES (?, ?, 4, ?, 'draft', 0)`).run(svc, role, a);
db.prepare(CLEAR_DRAFT_PLACES_SQL).run(JSON.stringify([[svc, role, 3]]));
ok('and touches only the places it is given', row(4)?.person_id === a && row(3) === undefined);

// ---- merging two records keeps what each said about how often -------------
// The draft goes by each person's own figures now, so a merge that drops the
// duplicate's "As often as needed", or its cap, changes who preaches.
{
  const [keep, dup] = [a, b];
  const roleIds = (db.prepare('SELECT id FROM roles ORDER BY id LIMIT 3').all() as { id: number }[]).map((r) => r.id);
  const [r1, r2, r3] = roleIds;
  db.prepare('DELETE FROM person_roles WHERE person_id IN (?, ?)').run(keep, dup);
  // r1: only the duplicate has it, with a tick and a cap.
  db.prepare(`INSERT INTO person_roles (person_id, role_id, can_do, willing, max_per_period, period_days, ask_any_time)
              VALUES (?, ?, 1, 1, 2, 30, 1)`).run(dup, r1);
  // r2: both have it; the kept record has no figures, the duplicate does.
  db.prepare(`INSERT INTO person_roles (person_id, role_id, can_do, willing) VALUES (?, ?, 1, 1)`).run(keep, r2);
  db.prepare(`INSERT INTO person_roles (person_id, role_id, can_do, willing, min_gap_days, ask_any_time)
              VALUES (?, ?, 1, 1, 91, 1)`).run(dup, r2);
  // r3: both have a cap; the kept record's stands whole.
  db.prepare(`INSERT INTO person_roles (person_id, role_id, can_do, willing, max_per_period, period_days)
              VALUES (?, ?, 1, 1, 4, 30)`).run(keep, r3);
  db.prepare(`INSERT INTO person_roles (person_id, role_id, can_do, willing, max_per_period, period_days)
              VALUES (?, ?, 1, 1, 1, 91)`).run(dup, r3);

  db.prepare(MERGE_PERSON_ROLES_SQL('?1', '?2')).run(dup, keep);
  const pr = (roleId: number) => one<{ max_per_period: number | null; period_days: number | null;
    min_gap_days: number | null; ask_any_time: number; can_do: number }>(
    'SELECT * FROM person_roles WHERE person_id = ? AND role_id = ?', keep, roleId);

  const m1 = pr(r1);
  ok('a merge brings across a role only the duplicate had, tick and cap included',
    m1.can_do === 1 && m1.ask_any_time === 1 && m1.max_per_period === 2 && m1.period_days === 30, JSON.stringify(m1));
  const m2 = pr(r2);
  ok('and fills in figures the kept record had left blank, keeping the tick',
    m2.min_gap_days === 91 && m2.ask_any_time === 1, JSON.stringify(m2));
  const m3 = pr(r3);
  ok('but a cap the kept record already had stands whole, never half replaced',
    m3.max_per_period === 4 && m3.period_days === 30, JSON.stringify(m3));
}

ok('the notice says what was left alone, and why',
  appliedNotice(12, 1, 2).includes('12 places from the draft are now on the rota')
  && appliedNotice(12, 1, 2).includes('1 was left as it was, because somebody booked that place by hand')
  && appliedNotice(12, 1, 2).includes('2 could not go on'));
ok('and says nothing extra when nothing was', appliedNotice(1, 0, 0) === '1 place from the draft is now on the rota, marked as draft.');

console.log(failures === 0 ? '\nApply OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
