/**
 * The room diary on the website says only what it should.
 *
 * Runs listPublicDiary (src/rooms.ts) against a real SQLite database built from
 * every migration in order, so the columns, the joins and the defaults are the
 * ones production has. The bookings put in carry contacts, notes and who booked
 * them, as real ones do, and the test fails if any of that comes back — or if a
 * cancelled booking, a room no longer in use, the past, or anything beyond a
 * year ahead does, or a private booking's title.
 *
 * Then the whole app is driven through its own fetch, against the same
 * database: the two public pages as the website would load them, and the
 * Rooms forms as somebody signed in would use them, so the routes, the gate,
 * the headers and the "Private booking" tick are tested as they really run.
 *
 *   npm run test:rooms
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { listPublicDiary, loadDiarySettings, listDiaryRooms, publicDiaryWindow,
         PUBLIC_DIARY_COLUMNS, DIARY_MONTHS_AHEAD, type PublicDiaryRow } from '../src/rooms.js';
import { mayAccess, areaForPath } from '../src/access.js';
import { shiftMonth, londonToday } from '../src/views/calendar.js';
import app from '../src/index.js';

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
 * Just enough of D1 for the code under test and for the whole app driven
 * through its fetch below: prepare, bind, first, all, run and batch, a batch
 * being one transaction as it is on D1. The SQL is passed through untouched,
 * so it is the real query that runs. bind() gives a new statement, as D1's
 * does, so one INSERT bound once for each date is one row for each date.
 */
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
    try {
      const out = stmts.map((s) => s.exec());
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },
} as unknown as D1Database;

const run = (sql: string, ...args: unknown[]) => Number(db.prepare(sql).run(...(args as never[])).lastInsertRowid);
const rows = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => db.prepare(sql).all(...(args as never[])) as T[];

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

  // The tick lives on the booking and on the series, defaulting to 0, with no
  // CHECK on either (0017's header says why).
  const cols = (t: string) => rows<{ name: string; dflt_value: string | null; notnull: number }>(`PRAGMA table_info(${t})`)
    .find((c) => c.name === 'is_private');
  ok('"Private booking" is a column on bookings and on series, not null, 0 unless ticked',
    ['room_bookings', 'room_booking_series'].every((t) => cols(t)?.notnull === 1 && cols(t)?.dflt_value === '0'));
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
  tentative?: number; request?: number | null; event?: number | null; series?: number | null; private?: number }) => run(
  `INSERT INTO room_bookings (room_id, title, starts_at, ends_at, booked_by, contact, notes, status,
                              is_tentative, request_id, event_id, series_id, external_ref, is_private)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ical:EXTERNAL-REF', ?)`,
  o.room ?? roomA, o.title, o.starts, o.ends, person ?? null, PRIVATE.contact, PRIVATE.notes,
  o.status ?? 'booked', o.tentative ?? 0, o.request ?? null, o.event ?? null, o.series ?? null, o.private ?? 0);

const series = run(
  `INSERT INTO room_booking_series (room_id, title, contact, notes, freq, from_date, until_date, from_time, to_time, created_by)
   VALUES (?, 'Choir practice', 'SERIES-CONTACT', 'SERIES-NOTE', 'weekly', '2030-03-01', '2030-12-31', '19:00', '21:00', ?)`,
  roomB, person ?? null);
const privateSeries = run(
  `INSERT INTO room_booking_series (room_id, title, contact, notes, freq, from_date, until_date, from_time, to_time, created_by, is_private)
   VALUES (?, 'Grief support SECRET-PRIVATE-SERIES', 'SERIES-CONTACT', 'SERIES-NOTE', 'weekly', '2030-03-06', '2030-12-31', '10:00', '11:00', ?, 1)`,
  roomB, person ?? null);

book({ title: 'Home group', starts: '2030-03-20T19:00', ends: '2030-03-20T21:00' });
book({ title: 'Choir practice', starts: '2030-03-19T19:00', ends: '2030-03-19T21:00', room: roomB, series });
book({ title: 'Called off', starts: '2030-03-21T19:00', ends: '2030-03-21T21:00', status: 'cancelled' });
book({ title: 'Toddler group (Bream Tots)', starts: '2030-03-22T10:00', ends: '2030-03-22T11:30', tentative: 1, request: waiting });
book({ title: 'Surprise party', starts: '2030-03-23T19:00', ends: '2030-03-23T23:00', event: hidden });
book({ title: 'Harvest Supper', starts: '2030-03-24T19:00', ends: '2030-03-24T22:00', event: published });
book({ title: 'In a room no longer used', starts: '2030-03-25T19:00', ends: '2030-03-25T21:00', room: roomGone });
book({ title: 'Counselling SECRET-PRIVATE-ONE', starts: '2030-03-26T10:00', ends: '2030-03-26T11:00', private: 1 });
book({ title: 'Grief support SECRET-PRIVATE-SERIES', starts: '2030-03-27T10:00', ends: '2030-03-27T11:00',
  room: roomB, series: privateSeries, private: 1 });
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
const starts = (rs: PublicDiaryRow[]) => rs.map((r) => r.starts_at);
const byStart = (rs: PublicDiaryRow[], s: string) => rs.find((r) => r.starts_at === s);

// Every month the website can show, read the way the list reads them.
const everyMonth: PublicDiaryRow[] = [];
for (let i = 0; i <= DIARY_MONTHS_AHEAD; i++) {
  everyMonth.push(...await shown('list', shiftMonth(TODAY.slice(0, 7), i)));
}
for (let i = 0; i <= DIARY_MONTHS_AHEAD; i++) {
  everyMonth.push(...await shown('calendar', shiftMonth(TODAY.slice(0, 7), i)));
}
for (const titles of [true, false]) everyMonth.push(...await shown('list', undefined, null, titles));

ok('only the allowed columns ever come back',
  everyMonth.length > 0 && everyMonth.every((r) =>
    JSON.stringify(Object.keys(r).sort()) === JSON.stringify([...PUBLIC_DIARY_COLUMNS].sort())),
  JSON.stringify(Object.keys(everyMonth[0] ?? {})));
const all = JSON.stringify(everyMonth);
ok('no contact, note, booker, request, series, reference or private title reaches the website',
  !['Sue Smith', '07700', 'SECRET-NOTE', 'Jane Public', 'jane@example.org', 'REQUEST-NOTE', 'SERIES-CONTACT',
    'SERIES-NOTE', 'EXTERNAL-REF', 'ROOM-NOTE-SECRET', 'SECRET-PRIVATE', '"id"', 'booked_by', 'series_id',
    'request_id', 'event_id'].some((s) => all.includes(s)), all.slice(0, 400));
ok('nothing cancelled, nothing in a room no longer used',
  !all.includes('2030-03-21T19:00') && !all.includes('2030-03-25T19:00') && !all.includes('Diary Old Vestry'));
ok('nothing from before this month, and nothing past the twelfth month ahead',
  !all.includes('2030-02-20') && !all.includes('2031-04-05')
  && all.includes('2031-03-28T19:00'));

const list = await shown('list', undefined);
ok('the list of this month is exactly the bookings from today to its end', JSON.stringify(starts(list)) === JSON.stringify([
  '2030-03-19T19:00', '2030-03-20T19:00', '2030-03-22T10:00', '2030-03-23T19:00', '2030-03-24T19:00',
  '2030-03-26T10:00', '2030-03-27T10:00',
]), JSON.stringify(starts(list)));

const cal = await shown('calendar', undefined);
ok('the calendar of this month adds its earlier days, and a weekend running into it — but not last month',
  JSON.stringify(starts(cal)) === JSON.stringify([
    '2030-02-28T19:00', '2030-03-05T19:00', '2030-03-19T19:00', '2030-03-20T19:00', '2030-03-22T10:00',
    '2030-03-23T19:00', '2030-03-24T19:00', '2030-03-26T10:00', '2030-03-27T10:00', '2030-04-02T14:00',
  ]), JSON.stringify(starts(cal)));

ok('an ordinary booking shows what it is for', byStart(list, '2030-03-20T19:00')?.title === 'Home group'
  && byStart(list, '2030-03-20T19:00')?.is_private === 0);
ok('a booking that is part of a series shows its title and nothing of the series',
  byStart(list, '2030-03-19T19:00')?.title === 'Choir practice');
const priv = byStart(list, '2030-03-26T10:00');
ok('a booking ticked private has no title, and is marked as private',
  priv?.title === null && priv?.is_private === 1 && priv?.is_tentative === 0, JSON.stringify(priv));
const privSeries = byStart(list, '2030-03-27T10:00');
ok('and so does a date of a series ticked private', privSeries?.title === null && privSeries?.is_private === 1,
  JSON.stringify(privSeries));
const held = byStart(list, '2030-03-22T10:00');
ok('a time held for a request still waiting has no title, and is marked as held',
  held?.title === null && held?.is_tentative === 1 && held?.is_private === 0, JSON.stringify(held));
const surprise = byStart(list, '2030-03-23T19:00');
ok('a room held for an event not yet published has no title, and says so',
  surprise?.title === null && surprise?.unpublished_event === 1, JSON.stringify(surprise));
const harvest = byStart(list, '2030-03-24T19:00');
ok('a room held for a published event shows the event', harvest?.title === 'Harvest Supper' && harvest?.unpublished_event === 0,
  JSON.stringify(harvest));
const party = byStart(await shown('list', '2030-04'), '2030-04-02T14:00');
ok('a booking asked for online and since approved says what it is for',
  party?.title === 'Birthday party (Smith family)' && party.is_tentative === 0 && party.is_private === 0, JSON.stringify(party));

const noTitles = await shown('list', undefined, null, false);
ok('with titles switched off, no title leaves the database at all, and private is still marked',
  noTitles.length === list.length && noTitles.every((r) => r.title === null)
  && byStart(noTitles, '2030-03-26T10:00')?.is_private === 1, JSON.stringify(noTitles));

{
  // Only 0 is public. Anything else that ever got into the column is private.
  db.exec(`UPDATE room_bookings SET is_private = 2 WHERE title = 'Home group'`);
  const odd = byStart(await shown('list', undefined), '2030-03-20T19:00');
  ok('anything but 0 in the column counts as private', odd?.title === null && odd?.is_private === 1, JSON.stringify(odd));
  db.exec(`UPDATE room_bookings SET is_private = 0 WHERE title = 'Home group'`);
}

const parlour = await shown('calendar', undefined, roomB);
ok('one room shows only that room', parlour.length === 3 && parlour.every((r) => r.room_name === 'Diary Parlour'),
  JSON.stringify(parlour));

const rooms = await listDiaryRooms(d1);
ok('the tabs are the rooms in use, by id and name only',
  rooms.some((r) => r.name === 'Diary Hall') && !rooms.some((r) => r.name === 'Diary Old Vestry')
  && rooms.every((r) => JSON.stringify(Object.keys(r)) === '["id","name"]'), JSON.stringify(rooms));

// ---- the months it may show --------------------------------------------------
const w = (view: 'calendar' | 'list', m: string | undefined, today = TODAY) => {
  const x = publicDiaryWindow(view, m, today);
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

// ---- today, in Britain -------------------------------------------------------
// Half past midnight on 1 August is 23:30 on 31 July in UTC. The website used
// to take the UTC date, so for that hour it listed yesterday and, on the 1st,
// opened on the month just gone.
{
  const justAfterMidnight = londonToday(new Date('2026-07-31T23:30:00Z'));
  ok('in summer, half past midnight on the 1st is already the 1st in Britain',
    justAfterMidnight === '2026-08-01', justAfterMidnight);
  ok('so the list starts that day, and the calendar opens on the new month',
    w('list', undefined, justAfterMidnight) === '2026-08 2026-08-01 2026-09-01'
    && w('calendar', undefined, justAfterMidnight).startsWith('2026-08 2026-08-01'),
    `${w('list', undefined, justAfterMidnight)} | ${w('calendar', undefined, justAfterMidnight)}`);
  ok('in winter Britain keeps UTC: half past eleven on New Year\'s Eve is still the 31st',
    londonToday(new Date('2026-12-31T23:30:00Z')) === '2026-12-31');
  ok('and the hour the clocks go back is still the same day',
    londonToday(new Date('2026-10-25T00:30:00Z')) === '2026-10-25' && londonToday(new Date('2026-10-24T23:30:00Z')) === '2026-10-25');
}

// ---- the real app, through its own fetch ---------------------------------------
console.log('\nthe pages as the website and the office use them:');
{
  const env = { DB: d1 } as never;
  const exec = { waitUntil() {}, passThroughOnException() {} } as never;
  const call = async (path: string, init?: RequestInit) => {
    const res = await app.fetch(new Request(`https://bream.test${path}`, init), env, exec);
    return { status: res.status, headers: res.headers, body: await res.text() };
  };

  // Somebody signed in who books rooms, with a session row as sign-in makes.
  const staff = run(`INSERT INTO people (display_name, profile_id)
                     VALUES ('Rooms Tester', (SELECT id FROM profiles WHERE name = 'Room bookings'))`);
  run(`INSERT INTO sessions (id, person_id, expires_at) VALUES ('rooms-test-session', ?, '2999-01-01T00:00:00.000Z')`, staff);
  const signedIn = { cookie: 'bream_session=rooms-test-session' };
  const post = (path: string, fields: Record<string, string>, headers: Record<string, string> = signedIn) =>
    call(path, { method: 'POST', headers, body: new URLSearchParams(fields) });
  // The decision email has nowhere to go here, and says so on the console.
  const quietly = async <T>(f: () => Promise<T>) => {
    const was = console.error;
    console.error = () => {};
    try { return await f(); } finally { console.error = was; }
  };

  // Next month, as Britain counts it: always on the website, always in the
  // future, whichever day this runs.
  const M = shiftMonth(londonToday().slice(0, 7), 1);
  const roomR = run(`INSERT INTO rooms (name, sort_order) VALUES ('Diary Snug', 4)`);
  const booking = (title: string) => rows<{ id: number; is_private: number; series_id: number | null;
    series_detached: number; starts_at: string; ends_at: string; status: string }>(
    `SELECT id, is_private, series_id, series_detached, starts_at, ends_at, status FROM room_bookings
      WHERE title = ? ORDER BY starts_at`, title);
  const seriesOf = (title: string) => rows<{ id: number; is_private: number }>(
    'SELECT id, is_private FROM room_booking_series WHERE title = ?', title)[0];

  // One private booking, one ordinary one beside it.
  const one = await post('/app/rooms/book', { room_id: String(roomA), on_date: `${M}-10`, from_time: '10:00',
    to_time: '11:00', title: 'Counselling SECRET-ROUTE-ONE', is_private: '1' });
  ok('booking a room with "Private booking" ticked saves it private', one.status === 200
    && booking('Counselling SECRET-ROUTE-ONE').length === 1 && booking('Counselling SECRET-ROUTE-ONE')[0]?.is_private === 1,
    `${one.status} ${JSON.stringify(booking('Counselling SECRET-ROUTE-ONE'))}`);
  await post('/app/rooms/book', { room_id: String(roomA), on_date: `${M}-10`, from_time: '12:00',
    to_time: '13:00', title: 'Coffee morning' });
  ok('and without it, not', booking('Coffee morning')[0]?.is_private === 0);

  const refused = await post('/app/rooms/book', { room_id: String(roomA), on_date: `${M}-10`, from_time: '10:30',
    to_time: '11:30', title: 'Clashing SECRET-ECHO', is_private: '1' });
  ok('a booking refused for a clash comes back with the tick still ticked',
    refused.body.includes('already booked') && refused.body.includes('name="is_private" value="1" checked')
    && refused.body.includes('value="Clashing SECRET-ECHO"') && booking('Clashing SECRET-ECHO').length === 0);

  // A repeating private booking: the series carries the tick, and so does
  // every date it books.
  const S = 'Support group SECRET-ROUTE-SERIES';
  await post('/app/rooms/book', { room_id: String(roomB), on_date: `${M}-02`, from_time: '19:00', to_time: '20:30',
    title: S, is_private: '1', repeat: 'weekly', until: `${M}-28` });
  const sId = seriesOf(S)?.id ?? 0;
  ok('a repeating booking ticked private is private on the series and on every date',
    seriesOf(S)?.is_private === 1 && booking(S).length === 4 && booking(S).every((b) => b.is_private === 1),
    JSON.stringify([seriesOf(S), booking(S)]));
  const sForm = (o: Record<string, string> = {}) => ({ room_id: String(roomB), from_time: '19:00', to_time: '21:00',
    title: S, freq: 'weekly', until: `${M}-28`, is_private: '1', ...o });
  await post(`/app/rooms/series/${sId}`, sForm());
  ok('changing the series with the tick kept rebuilds every date, still private',
    booking(S).length === 4 && booking(S).every((b) => b.is_private === 1 && b.ends_at.endsWith('T21:00')),
    JSON.stringify(booking(S)));

  // The app's own pages show it in full, with the chip.
  const inside = await call(`/app/rooms?from=${M}-01`, { headers: signedIn });
  ok('inside, the list shows a private booking in full, with a "Private" chip',
    inside.body.includes('Counselling SECRET-ROUTE-ONE') && />Private<\/span>/.test(inside.body));
  const insideCal = await call(`/app/rooms/calendar?month=${M}`, { headers: signedIn });
  ok('and the calendar says "(private)" after it',
    insideCal.body.includes('Counselling SECRET-ROUTE-ONE (private)') && insideCal.body.includes(`${S} (private)`));
  const onePage = await call(`/app/rooms/${booking('Counselling SECRET-ROUTE-ONE')[0]?.id}`, { headers: signedIn });
  const sPage = await call(`/app/rooms/series/${sId}`, { headers: signedIn });
  ok('the booking and the series each open with the tick ticked',
    onePage.body.includes('name="is_private" value="1" checked') && sPage.body.includes('name="is_private" value="1" checked'));

  // A request from the public form: held without a title, then approved.
  const reqId = run(`INSERT INTO room_requests (room_id, name, email, purpose, organisation, people, is_member, starts_at, ends_at, status)
                     VALUES (?, 'Ann Asker', 'ann@example.org', 'Birthday tea', 'Jones family', 20, 0, ?, ?, 'pending')`,
    roomR, `${M}-12T14:00`, `${M}-12T16:00`);
  run(`INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, is_tentative, request_id)
       VALUES (?, 'Birthday tea (Jones family)', ?, ?, 'Ann Asker · ann@example.org', 'Asked for online — waiting to be approved', 1, ?)`,
    roomR, `${M}-12T14:00`, `${M}-12T16:00`, reqId);
  const waitingList = await call(`/rooms/list?month=${M}`);
  ok('a request still waiting shows only that it is held',
    waitingList.body.includes('Held — not yet confirmed') && !waitingList.body.includes('Birthday tea'));
  await quietly(() => post(`/app/rooms/requests/${reqId}/approve`, {}));
  ok('approving it does not make it private',
    booking('Birthday tea (Jones family)')[0]?.is_private === 0 && booking('Birthday tea (Jones family)')[0]?.status === 'booked');

  // The website, as it loads them.
  for (const page of ['list', 'calendar']) {
    const r = await call(`/rooms/${page}?month=${M}`);
    ok(`/rooms/${page} answers, is never cached, and shows what bookings are for`,
      r.status === 200 && r.headers.get('cache-control') === 'no-store'
      && r.body.includes('Coffee morning') && r.body.includes('Birthday tea (Jones family)'),
      `${r.status} ${r.headers.get('cache-control')}`);
    ok(`/rooms/${page} shows a private booking as "Private booking", and never its title`,
      r.body.includes('Private booking') && !r.body.includes('SECRET-ROUTE') && !r.body.includes('Support group')
      && !r.body.includes('Counselling'));
    ok(`/rooms/${page} links nowhere into the system`, !/href="\/app/.test(r.body) && !r.body.includes('<form'));
  }

  // One week of a series changed on its own keeps its own tick; see
  // applySeriesEdit for why ticking the whole series reaches it anyway.
  const P = 'Choir SERIES-PUBLIC';
  await post('/app/rooms/book', { room_id: String(roomA), on_date: `${M}-03`, from_time: '18:00', to_time: '19:00',
    title: P, repeat: 'weekly', until: `${M}-28` });
  const pId = seriesOf(P)?.id ?? 0;
  const third = booking(P)[2]!;
  await post(`/app/rooms/${third.id}`, { room_id: String(roomA), on_date: third.starts_at.slice(0, 10),
    from_time: '18:00', to_time: '19:00', title: P, is_private: '1' });
  const pAfter = () => booking(P).map((b) => `${b.is_private}${b.series_detached ? 'd' : ''}`).join(' ');
  ok('ticking one week of a series private makes just that week private, and detaches it',
    pAfter() === '0 0 1d 0', pAfter());
  const pForm = (o: Record<string, string> = {}) => ({ room_id: String(roomA), from_time: '18:00', to_time: '19:30',
    title: P, freq: 'weekly', until: `${M}-28`, ...o });
  await post(`/app/rooms/series/${pId}`, pForm());
  ok('changing the series, unticked, leaves that week private', pAfter() === '0 0 1d 0', pAfter());
  await post(`/app/rooms/series/${pId}`, pForm({ is_private: '1' }));
  ok('ticking the whole series private reaches every week',
    pAfter() === '1 1 1d 1' && seriesOf(P)?.is_private === 1, pAfter());
  await post(`/app/rooms/${third.id}`, { room_id: String(roomA), on_date: third.starts_at.slice(0, 10),
    from_time: '18:00', to_time: '19:00', title: P });
  ok('a week of a private series can still be unticked on its own', pAfter() === '1 1 0d 1', pAfter());
  await post(`/app/rooms/series/${pId}`, pForm({ is_private: '1', to_time: '20:00' }));
  ok('but changing the series with the tick kept makes that week private again — when in doubt, say less',
    pAfter() === '1 1 1d 1', pAfter());

  // A page left open while the booking was made private elsewhere. Saving it
  // with the box untouched must not put the title back on the website...
  await post(`/app/rooms/${third.id}`, { room_id: String(roomA), on_date: third.starts_at.slice(0, 10),
    from_time: '18:00', to_time: '19:15', title: P, was_private: '0' });
  ok('a stale page, drawn unticked, does not quietly make a private booking public',
    booking(P)[2]?.is_private === 1, pAfter());
  await post(`/app/rooms/series/${pId}`, pForm({ was_private: '0', to_time: '20:15' }));
  ok('nor does a stale series page', seriesOf(P)?.is_private === 1 && pAfter() === '1 1 1d 1', pAfter());
  // ...but unticking a box that was drawn ticked is a decision, and stands.
  await post(`/app/rooms/${third.id}`, { room_id: String(roomA), on_date: third.starts_at.slice(0, 10),
    from_time: '18:00', to_time: '19:15', title: P, was_private: '1' });
  ok('unticking a box the page showed ticked still makes it public', booking(P)[2]?.is_private === 0, pAfter());
  // Put that week back as the series checks below expect to find it.
  await post(`/app/rooms/${third.id}`, { room_id: String(roomA), on_date: third.starts_at.slice(0, 10),
    from_time: '18:00', to_time: '19:15', title: P, is_private: '1', was_private: '0' });

  // Ticked on the Approve form: private from the moment it is approved, since
  // a request cannot be edited while it waits.
  const req2 = run(`INSERT INTO room_requests (room_id, name, email, purpose, organisation, people, is_member, starts_at, ends_at, status)
                    VALUES (?, 'Bea Asker', 'bea@example.org', 'Bereavement support', 'Smith family', 6, 0, ?, ?, 'pending')`,
    roomR, `${M}-13T14:00`, `${M}-13T16:00`);
  run(`INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, is_tentative, request_id)
       VALUES (?, 'Bereavement support (Smith family)', ?, ?, 'Bea Asker · bea@example.org', 'Asked for online — waiting to be approved', 1, ?)`,
    roomR, `${M}-13T14:00`, `${M}-13T16:00`, req2);
  await quietly(() => post(`/app/rooms/requests/${req2}/approve`, { is_private: '1' }));
  const afterApprove = await call(`/rooms/list?month=${M}`);
  ok('a request approved with Private ticked is private from the start',
    booking('Bereavement support (Smith family)')[0]?.is_private === 1
    && !afterApprove.body.includes('Bereavement support') && !afterApprove.body.includes('Smith family'));
  await post(`/app/rooms/series/${pId}`, pForm());
  ok('and unticking the series leaves the week changed on its own as it was', pAfter() === '0 0 1d 0', pAfter());

  // Switched off: one sentence, nothing else, still never cached.
  db.exec('UPDATE room_diary_settings SET is_public = 0');
  for (const page of ['list', 'calendar']) {
    const r = await call(`/rooms/${page}?month=${M}`);
    ok(`switched off, /rooms/${page} says only that the diary is not available`,
      r.status === 200 && r.headers.get('cache-control') === 'no-store'
      && r.body.includes('The room diary is not available at the moment.')
      && !['Coffee morning', 'Private booking', 'Held', 'Birthday tea', '<table', 'cal-item', 'Diary Hall']
        .some((s) => r.body.includes(s)));
  }

  // Nobody can switch it back on without signing in.
  const anon = await post('/app/rooms/booking-form/diary', { is_public: '1', show_titles: '1' }, {});
  ok('saving the diary settings without signing in is sent to sign in, and changes nothing',
    anon.status === 302 && (anon.headers.get('location') ?? '').startsWith('/auth/sign-in')
    && (await loadDiarySettings(d1)).is_public === 0, `${anon.status} ${anon.headers.get('location')}`);
  await post('/app/rooms/booking-form/diary', { is_public: '1', show_titles: '1' });
  ok('signed in, it can be', (await loadDiarySettings(d1)).is_public === 1);
}

console.log(failures === 0 ? '\nPublic room diary OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
