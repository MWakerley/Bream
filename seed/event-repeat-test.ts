/**
 * Events that happen more than once hold their rooms every time.
 *
 * Drives the event pages through the app's own fetch, against a real SQLite
 * database built from every migration (the same stand-in for D1 as
 * message-test). Checks that a six-week course holds each ticked room on each
 * of its six evenings; that a clash on ANY of them is caught, not only on the
 * first; that changing the course moves the holds rather than piling up new
 * ones; and the small rules about what a repeat may be.
 *
 *   npm run test:repeat
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { describeRepeat, eventOccurrences } from '../src/events.js';
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
const rows = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => db.prepare(sql).all(...(args as never[])) as T[];

const env = { DB: d1 } as never;
const exec = { waitUntil() {}, passThroughOnException() {} } as never;
const call = async (path: string, init?: RequestInit) => {
  const res = await app.fetch(new Request(`https://bream.test${path}`, { ...init, headers: { cookie: 'bream_session=rep-admin' } }), env, exec);
  return { status: res.status, location: res.headers.get('location'), body: await res.text() };
};
const post = (path: string, fields: [string, string][]) =>
  call(path, { method: 'POST', body: new URLSearchParams(fields) });

const admin = run(`INSERT INTO people (display_name, is_admin, profile_id)
                   VALUES ('Office Admin', 1, (SELECT id FROM profiles WHERE name = 'Administrator'))`);
run(`INSERT INTO sessions (id, person_id, expires_at) VALUES ('rep-admin', ?, '2999-01-01T00:00:00.000Z')`, admin);
const hall = (rows<{ id: number }>(`SELECT id FROM rooms WHERE is_active = 1 ORDER BY sort_order LIMIT 1`)[0])!.id;
const room2 = (rows<{ id: number }>(`SELECT id FROM rooms WHERE is_active = 1 ORDER BY sort_order LIMIT 1 OFFSET 1`)[0])!.id;
const holds = (eventId: number) => rows<{ room_id: number; starts_at: string; ends_at: string }>(
  `SELECT room_id, starts_at, ends_at FROM room_bookings WHERE event_id = ? AND status = 'booked' ORDER BY room_id, starts_at`, eventId);

/** The course's form. `extra` REPLACES a field of the same name — except
 *  room_ids, which is a list, so an extra room is added to the hall. */
const course = (extra: [string, string][] = []): [string, string][] => {
  const base: [string, string][] = [
    ['title', 'Alpha course'], ['on_date', '2027-01-20'], ['start_time', '19:00'],
    ['end_date', '2027-01-20'], ['end_time', '21:00'], ['max_per_booking', '10'],
    ['repeat', 'weekly'], ['repeat_count', '6'], ['room_ids', String(hall)],
  ];
  const replaced = new Set(extra.map(([k]) => k).filter((k) => k !== 'room_ids'));
  return [...base.filter(([k]) => !replaced.has(k)), ...extra];
};

console.log('repeating events:');

// The dates themselves.
{
  const t = eventOccurrences('2027-01-20T19:00', '2027-01-20T21:00', { freq: 'weekly', count: 6 });
  ok('every week for 6 weeks is six Wednesdays, same times',
    t.length === 6 && t[5]!.startsAt === '2027-02-24T19:00' && t.every((x) => x.endsAt.endsWith('T21:00')),
    JSON.stringify(t.map((x) => x.startsAt)));
  const d = eventOccurrences('2027-03-29T23:00', '2027-03-30T01:00', { freq: 'daily', count: 3 });
  ok('daily keeps the wall-clock times across the clocks changing',
    d.map((x) => x.startsAt).join() === '2027-03-29T23:00,2027-03-30T23:00,2027-03-31T23:00');
  ok('and is described in words',
    describeRepeat({ starts_at: '2027-01-20T19:00', ends_at: '2027-01-20T21:00', repeat_freq: 'weekly', repeat_count: 6 })
      === 'Every week, 6 times: Wed 20 Jan 2027 to Wed 24 Feb 2027');
}

// A six-week course, holding the hall every week.
let courseId = 0;
{
  const r = await post('/app/events/new', course());
  courseId = Number(r.location?.split('/').pop());
  ok('a repeating event is made', r.status === 303 && courseId > 0, `${r.status} ${r.body.slice(0, 200)}`);
  const h = holds(courseId);
  ok('and the hall is held on each of the six evenings', h.length === 6
    && h.map((x) => x.starts_at.slice(0, 10)).join() === '2027-01-20,2027-01-27,2027-02-03,2027-02-10,2027-02-17,2027-02-24',
    JSON.stringify(h));
  const page = await call(`/app/events/${courseId}`);
  ok('its page shows the repeat, ready to change', page.body.includes('value="weekly" selected') && page.body.includes('value="6"'));
}

// A clash on the fourth week — not the first — is still caught.
{
  run(`INSERT INTO room_bookings (room_id, title, starts_at, ends_at, booked_by) VALUES (?, 'Choir', '2027-03-17T19:30', '2027-03-17T20:30', ?)`, room2, admin);
  const r = await post('/app/events/new', [
    ['title', 'Lent course'], ['on_date', '2027-02-24'], ['start_time', '19:00'], ['end_date', '2027-02-24'],
    ['end_time', '21:00'], ['max_per_booking', '10'], ['repeat', 'weekly'], ['repeat_count', '5'], ['room_ids', String(room2)],
  ]);
  ok('a clash on a later week is refused, and named', r.status === 409 && r.body.includes('Choir'), `${r.status}`);
  ok('and nothing is made', rows(`SELECT 1 FROM events WHERE title = 'Lent course'`).length === 0);
}

// Changing the course: one week shorter, a second room. Holds move, none pile up.
{
  run(`UPDATE room_bookings SET notes = 'Key from Sue' WHERE event_id = ? AND room_id = ? AND starts_at LIKE '2027-01-20%'`, courseId, hall);
  const r = await post(`/app/events/${courseId}/details`,
    course([['room_ids', String(room2)], ['repeat_count', '5']]));
  ok('the course can be changed', r.status === 200 && r.body.includes('each of the 4 times after'), r.body.match(/notice[^<]*<p[^>]*>([^<]*)/)?.[1] ?? String(r.status));
  const h = holds(courseId);
  ok('now five weeks, in both rooms', h.length === 10 && h.filter((x) => x.room_id === room2).length === 5, JSON.stringify(h.length));
  ok('the dropped sixth week is let go, not deleted',
    rows(`SELECT 1 FROM room_bookings WHERE event_id = ? AND status = 'cancelled' AND starts_at LIKE '2027-02-24%'`, courseId).length === 1);
  ok('and a note on a hold survives, because holds are moved, not replaced',
    rows(`SELECT 1 FROM room_bookings WHERE event_id = ? AND status = 'booked' AND notes = 'Key from Sue'`, courseId).length === 1);
  const once = await post(`/app/events/${courseId}/details`, course([['repeat', '']]));
  ok('switching back to just once holds the rooms once', once.status === 200 && holds(courseId).length === 1);
}

// What a repeat may be.
{
  const bad = async (fields: [string, string][]) => (await post('/app/events/new', fields)).body;
  ok('a count is required', (await bad(course([['repeat_count', '']]))).includes('how many times'));
  ok('and not absurd', (await bad(course([['repeat_count', '400']]))).includes('from 2 to 52'));
  ok('an overnight event every day is refused, since each night would run into the next',
    (await bad(course([['repeat', 'daily'], ['end_date', '2027-01-21'], ['end_time', '20:00']]))).includes('runs into the next'));
}

console.log(failures === 0 ? '\nRepeating events OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
