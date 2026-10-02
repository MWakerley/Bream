/**
 * The room diary on the website says only what it should.
 *
 * Runs listPublicDiary (src/rooms.ts) against a real SQLite database built from
 * every migration in order, so the columns, the joins and the defaults are the
 * ones production has. The bookings put in carry contacts, notes and who booked
 * them, as real ones do, and the test fails if any of that comes back — or if a
 * cancelled booking, a room no longer in use, the past, or anything beyond a
 * year ahead does.
 *
 *   npm run test:rooms
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { listPublicDiary, loadDiarySettings, listDiaryRooms, publicDiaryWindow,
         PUBLIC_DIARY_COLUMNS, DIARY_MONTHS_AHEAD, type PublicDiaryRow } from '../src/rooms.js';
import { mayAccess, areaForPath } from '../src/access.js';
import { shiftMonth } from '../src/views/calendar.js';

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

console.log('the room diary on the website:');

const db = new DatabaseSync(':memory:');
// D1 enforces foreign keys; plain SQLite does not unless asked.
db.exec('PRAGMA foreign_keys = ON');
// Relative to the repo root, which is where npm runs the bundled test from.
//
// One migration is skipped, as in apply-test: 0008 is the room diary's data
// import, regenerated after 0010 added the external_ref column it now fills,
// so it no longer runs against a database built from scratch in order. It is
// imported bookings only; every table and column this test reads comes from
// the migrations that do run, exactly as production ran them.
const SKIP = new Set(['0008_import_room_bookings.sql']);
for (const f of readdirSync('migrations').filter((n) => n.endsWith('.sql') && !SKIP.has(n)).sort()) {
  try {
    db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  } catch (e) {
    throw new Error(`${f}: ${(e as Error).message}`);
  }
}

/**
 * Just enough of D1 for the functions under test: prepare, bind, all, first.
 * The SQL is passed through untouched, so it is the real query that runs.
 */
const d1 = {
  prepare(sql: string) {
    let args: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) { args = a; return stmt; },
      async all() { return { results: db.prepare(sql).all(...(args as never[])) }; },
      async first() { return db.prepare(sql).get(...(args as never[])) ?? null; },
    };
    return stmt;
  },
} as unknown as D1Database;

const run = (sql: string, ...args: unknown[]) => Number(db.prepare(sql).run(...(args as never[])).lastInsertRowid);

// ---- the settings ------------------------------------------------------------
{
  const table = (db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'room_diary_settings'`).get() as { sql: string }).sql;
  ok('the settings table carries one CHECK, the one that keeps it to one row',
    (table.match(/CHECK/g) ?? []).length === 1 && /CHECK \(id = 1\)/.test(table), table);
  const s = await loadDiarySettings(d1);
  ok('and its row is there, each setting 0 or 1', [0, 1].includes(s.is_public) && [0, 1].includes(s.show_titles),
    JSON.stringify(s));
  db.exec('DELETE FROM room_diary_settings');
  const gone = await loadDiarySettings(d1);
  ok('a missing row fails shut: not public, no titles', gone.is_public === 0 && gone.show_titles === 0, JSON.stringify(gone));
  db.exec('INSERT INTO room_diary_settings (id) VALUES (1)');
}

// ---- who may change them -----------------------------------------------------
ok('saving the diary settings needs the right to manage rooms',
  !mayAccess(new Set(['rooms']), '/app/rooms/booking-form/diary', 'POST')
  && mayAccess(new Set(['rooms', 'rooms.manage']), '/app/rooms/booking-form/diary', 'POST'));
ok('the two public pages are outside /app, so no area applies to them',
  areaForPath('/rooms/calendar') === null && areaForPath('/rooms/list') === null);

// ---- the bookings ------------------------------------------------------------
// A fixed "today", years from the seed data, so the test means the same thing
// whichever day it runs.
const TODAY = '2030-03-15';
const [person] = (db.prepare('SELECT id FROM people ORDER BY id LIMIT 1').all() as { id: number }[]).map((r) => r.id);
const roomA = run(`INSERT INTO rooms (name, sort_order, notes) VALUES ('Diary Hall', 1, 'ROOM-NOTE-SECRET')`);
const roomB = run(`INSERT INTO rooms (name, sort_order) VALUES ('Diary Parlour', 2)`);
const roomGone = run(`INSERT INTO rooms (name, sort_order, is_active) VALUES ('Diary Old Vestry', 3, 0)`);
const published = run(`INSERT INTO events (slug, title, starts_at, is_published) VALUES ('harvest-2030', 'Harvest Supper', '2030-03-24T19:00', 1)`);
const hidden = run(`INSERT INTO events (slug, title, starts_at, is_published) VALUES ('surprise-2030', 'Surprise party', '2030-03-23T19:00', 0)`);
const asked = (purpose: string, status: string) => run(
  `INSERT INTO room_requests (room_id, name, email, phone, purpose, people, is_member, starts_at, ends_at, status, notes)
   VALUES (?, 'Jane Public', 'jane@example.org', '07700 900456', ?, 12, 0, '2030-03-22T10:00', '2030-03-22T11:30', ?, 'REQUEST-NOTE')`,
  roomA, purpose, status);
const waiting = asked('Toddler group', 'pending');
const approved = asked('Birthday party', 'approved');

// Every booking carries the things that must never reach the website.
const PRIVATE = { contact: 'Sue Smith 07700 900123', notes: 'Key under the mat SECRET-NOTE' };
const book = (o: { room?: number; title: string; starts: string; ends: string; status?: string;
  tentative?: number; request?: number | null; event?: number | null; series?: number | null }) => run(
  `INSERT INTO room_bookings (room_id, title, starts_at, ends_at, booked_by, contact, notes, status,
                              is_tentative, request_id, event_id, series_id, external_ref)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ical:EXTERNAL-REF')`,
  o.room ?? roomA, o.title, o.starts, o.ends, person ?? null, PRIVATE.contact, PRIVATE.notes,
  o.status ?? 'booked', o.tentative ?? 0, o.request ?? null, o.event ?? null, o.series ?? null);

const series = run(
  `INSERT INTO room_booking_series (room_id, title, contact, notes, freq, from_date, until_date, from_time, to_time, created_by)
   VALUES (?, 'Choir practice', 'SERIES-CONTACT', 'SERIES-NOTE', 'weekly', '2030-03-01', '2030-12-31', '19:00', '21:00', ?)`,
  roomB, person ?? null);

book({ title: 'Home group', starts: '2030-03-20T19:00', ends: '2030-03-20T21:00' });
book({ title: 'Choir practice', starts: '2030-03-19T19:00', ends: '2030-03-19T21:00', room: roomB, series });
book({ title: 'Called off', starts: '2030-03-21T19:00', ends: '2030-03-21T21:00', status: 'cancelled' });
book({ title: 'Toddler group (Bream Tots)', starts: '2030-03-22T10:00', ends: '2030-03-22T11:30', tentative: 1, request: waiting });
book({ title: 'Surprise party', starts: '2030-03-23T19:00', ends: '2030-03-23T23:00', event: hidden });
book({ title: 'Harvest Supper', starts: '2030-03-24T19:00', ends: '2030-03-24T22:00', event: published });
book({ title: 'In a room no longer used', starts: '2030-03-25T19:00', ends: '2030-03-25T21:00', room: roomGone });
book({ title: 'Birthday party (Smith family)', starts: '2030-04-02T14:00', ends: '2030-04-02T17:00', request: approved });
book({ title: 'Earlier this month', starts: '2030-03-05T19:00', ends: '2030-03-05T21:00' });
book({ title: 'Last month', starts: '2030-02-20T19:00', ends: '2030-02-20T21:00' });
book({ title: 'Weekend into this month', starts: '2030-02-28T19:00', ends: '2030-03-01T16:00', room: roomB });
book({ title: 'Last month in range', starts: '2031-03-28T19:00', ends: '2031-03-28T21:00' });
book({ title: 'Too far ahead', starts: '2031-04-05T19:00', ends: '2031-04-05T21:00' });

/** What the website would be given for a view and month, as the route asks. */
async function shown(view: 'calendar' | 'list', month: string | undefined, roomId: number | null = null, titles = true) {
  const w = publicDiaryWindow(view, month, TODAY);
  return listPublicDiary(d1, w.from, w.to, roomId, titles);
}
const starts = (rows: PublicDiaryRow[]) => rows.map((r) => r.starts_at);
const byStart = (rows: PublicDiaryRow[], s: string) => rows.find((r) => r.starts_at === s);

// Every month the website can show, read the way the list reads them.
const everyMonth: PublicDiaryRow[] = [];
for (let i = 0; i <= DIARY_MONTHS_AHEAD; i++) {
  everyMonth.push(...await shown('list', shiftMonth(TODAY.slice(0, 7), i)));
}
for (let i = 0; i <= DIARY_MONTHS_AHEAD; i++) {
  everyMonth.push(...await shown('calendar', shiftMonth(TODAY.slice(0, 7), i)));
}

ok('only the allowed columns ever come back',
  everyMonth.length > 0 && everyMonth.every((r) =>
    JSON.stringify(Object.keys(r).sort()) === JSON.stringify([...PUBLIC_DIARY_COLUMNS].sort())),
  JSON.stringify(Object.keys(everyMonth[0] ?? {})));
const all = JSON.stringify(everyMonth);
ok('no contact, note, booker, request, series or reference reaches the website',
  !['Sue Smith', '07700', 'SECRET-NOTE', 'Jane Public', 'jane@example.org', 'REQUEST-NOTE', 'SERIES-CONTACT',
    'SERIES-NOTE', 'EXTERNAL-REF', 'ROOM-NOTE-SECRET', '"id"', 'booked_by', 'series_id', 'request_id', 'event_id']
    .some((s) => all.includes(s)), all.slice(0, 400));
ok('nothing cancelled, nothing in a room no longer used',
  !all.includes('2030-03-21T19:00') && !all.includes('2030-03-25T19:00') && !all.includes('Diary Old Vestry'));
ok('nothing from before this month, and nothing past the twelfth month ahead',
  !all.includes('2030-02-20') && !all.includes('2031-04-05')
  && all.includes('2031-03-28T19:00'));

const list = await shown('list', undefined);
ok('the list of this month is exactly the bookings from today to its end', JSON.stringify(starts(list)) === JSON.stringify([
  '2030-03-19T19:00', '2030-03-20T19:00', '2030-03-22T10:00', '2030-03-23T19:00', '2030-03-24T19:00',
]), JSON.stringify(starts(list)));

const cal = await shown('calendar', undefined);
ok('the calendar of this month adds its earlier days, and a weekend running into it — but not last month',
  JSON.stringify(starts(cal)) === JSON.stringify([
    '2030-02-28T19:00', '2030-03-05T19:00', '2030-03-19T19:00', '2030-03-20T19:00', '2030-03-22T10:00',
    '2030-03-23T19:00', '2030-03-24T19:00', '2030-04-02T14:00',
  ]), JSON.stringify(starts(cal)));

ok('an ordinary booking shows what it is for', byStart(list, '2030-03-20T19:00')?.title === 'Home group');
ok('a booking that is part of a series shows its title and nothing of the series',
  byStart(list, '2030-03-19T19:00')?.title === 'Choir practice');
const held = byStart(list, '2030-03-22T10:00');
ok('a time held for a request still waiting has no title, and is marked as held',
  held?.title === null && held?.is_tentative === 1, JSON.stringify(held));
const surprise = byStart(list, '2030-03-23T19:00');
ok('a room held for an event not yet published has no title, and says so',
  surprise?.title === null && surprise?.unpublished_event === 1, JSON.stringify(surprise));
const harvest = byStart(list, '2030-03-24T19:00');
ok('a room held for a published event shows the event', harvest?.title === 'Harvest Supper' && harvest?.unpublished_event === 0,
  JSON.stringify(harvest));
const party = byStart(await shown('list', '2030-04'), '2030-04-02T14:00');
ok('a booking that came from the public form keeps its words private even once approved',
  party !== undefined && party.title === null && party.is_tentative === 0, JSON.stringify(party));

const noTitles = await shown('list', undefined, null, false);
ok('with titles switched off, no title leaves the database at all',
  noTitles.length === list.length && noTitles.every((r) => r.title === null), JSON.stringify(noTitles));

const parlour = await shown('calendar', undefined, roomB);
ok('one room shows only that room', parlour.length === 2 && parlour.every((r) => r.room_name === 'Diary Parlour'),
  JSON.stringify(parlour));

const rooms = await listDiaryRooms(d1);
ok('the tabs are the rooms in use, by id and name only',
  rooms.some((r) => r.name === 'Diary Hall') && !rooms.some((r) => r.name === 'Diary Old Vestry')
  && rooms.every((r) => JSON.stringify(Object.keys(r)) === '["id","name"]'), JSON.stringify(rooms));

// ---- the months it may show --------------------------------------------------
const w = (view: 'calendar' | 'list', m: string | undefined) => {
  const x = publicDiaryWindow(view, m, TODAY);
  return `${x.month} ${x.from} ${x.to}`;
};
ok('the list of this month starts today', w('list', undefined) === '2030-03 2030-03-15 2030-04-01', w('list', undefined));
ok('a later month is listed whole', w('list', '2030-06') === '2030-06 2030-06-01 2030-07-01', w('list', '2030-06'));
ok('the calendar of this month starts on the 1st, never the days before it',
  w('calendar', '2030-03') === '2030-03 2030-03-01 2030-04-08', w('calendar', '2030-03'));
ok('a later calendar reaches the days of the months either side of it',
  w('calendar', '2030-06') === '2030-06 2030-05-25 2030-07-08', w('calendar', '2030-06'));
ok('but the last one stops at the end of its month',
  w('calendar', '2031-03') === '2031-03 2031-02-22 2031-04-01', w('calendar', '2031-03'));
ok('a month already gone shows this one instead', w('list', '2029-01').startsWith('2030-03 2030-03-15'));
ok('a month too far ahead shows the last one there is', w('list', '2099-12').startsWith('2031-03 '));
ok('a month that does not exist, or is not a month, quietly shows this one',
  ['2030-13', '2030-00', '2030-3', 'garbage', '', '2030-04-01'].every((m) => w('list', m).startsWith('2030-03 ')));

console.log(failures === 0 ? '\nPublic room diary OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
