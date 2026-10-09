/**
 * Emailing the people booked on an event never shows anybody else's address.
 *
 * Drives the whole app through its own fetch, against a real SQLite database
 * built from every migration, with a stand-in for the Cloudflare mail binding
 * that records each message handed to it. The test fails if ANY message puts a
 * participant in To or Cc — the one thing this feature must never do — and
 * checks who gets it: everybody booked in, or just the people ticked; never
 * the cancelled, never twice, and the people with no address left out.
 *
 *   npm run test:msg
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { sendBlindCopies, BCC_BATCH } from '../src/email.js';
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

// ---- the stand-in mail provider ------------------------------------------------
type Sent = { to: unknown; cc?: unknown; bcc?: unknown; from: unknown; replyTo?: unknown; subject: string; text: string };
const outbox: Sent[] = [];
/** Addresses the provider refuses, as a suppressed one would be. */
const refuse = new Set<string>();
const FROM = 'bookings@church.test';
const binding = {
  async send(m: Sent) {
    const bcc = ([] as unknown[]).concat(m.bcc ?? []).map(String);
    if (bcc.length + 1 > 50) throw new Error('E_TOO_MANY_RECIPIENTS');
    if (bcc.some((b) => refuse.has(b))) throw new Error('E_RECIPIENT_SUPPRESSED');
    outbox.push(m);
  },
};
const addr = (v: unknown): string[] => ([] as unknown[]).concat(v ?? []).map((x) =>
  typeof x === 'string' ? x : String((x as { email?: string }).email ?? ''));
const delivered = () => outbox.flatMap((m) => addr(m.bcc)).map((e) => e.toLowerCase()).sort();

/** THE check: To is the church alone, Cc is never used. Run after every send. */
function private_(label: string) {
  const leaks = outbox.filter((m) => {
    const to = addr(m.to);
    return to.length !== 1 || to[0] !== FROM || addr(m.cc).length > 0;
  });
  ok(`${label}: every message has only the church in To, and no Cc`, leaks.length === 0 && outbox.length > 0,
    JSON.stringify(leaks.map((m) => ({ to: m.to, cc: m.cc }))));
}

// ---- sendBlindCopies on its own ------------------------------------------------
console.log('sending blind copies:');
{
  const many = Array.from({ length: 95 }, (_, i) => `person${i}@example.org`);
  const r = await sendBlindCopies(binding, FROM, [...many, 'PERSON3@example.org', 'not an address', ''], 'S', 'B');
  private_('95 people');
  ok(`split into batches of at most ${BCC_BATCH}`, outbox.length === 3 && outbox.every((m) => addr(m.bcc).length <= BCC_BATCH),
    outbox.map((m) => addr(m.bcc).length).join(','));
  ok('each person once, whatever the case of their address; nonsense left out',
    r.sent.length === 95 && delivered().length === 95 && r.failed.length === 0);

  outbox.length = 0;
  refuse.add('person7@example.org');
  const r2 = await sendBlindCopies(binding, FROM, many.slice(0, 10), 'S', 'B');
  private_('a batch refused');
  ok('one refused address does not stop the other nine, each still blind-copied alone',
    r2.sent.length === 9 && r2.failed.length === 1 && r2.failed[0]?.email === 'person7@example.org'
    && outbox.length === 9 && outbox.every((m) => addr(m.bcc).length === 1));
  refuse.clear();

  outbox.length = 0;
  const r3 = await sendBlindCopies(undefined, FROM, many, 'S', 'B');
  ok('with no mail binding nothing is tried, and it says why', !!r3.skipped && outbox.length === 0);
}

// ---- the pages -----------------------------------------------------------------
console.log('\nthe pages, as the office uses them:');
{
  const env = { DB: d1, EMAIL: binding, ACK_FROM: FROM } as never;
  const exec = { waitUntil() {}, passThroughOnException() {} } as never;
  const call = async (path: string, init?: RequestInit, cookie = 'bream_session=msg-admin') => {
    const res = await app.fetch(new Request(`https://bream.test${path}`, { ...init, headers: { cookie } }), env, exec);
    return { status: res.status, location: res.headers.get('location'), body: await res.text() };
  };
  const post = (path: string, fields: [string, string][], cookie?: string) =>
    call(path, { method: 'POST', body: new URLSearchParams(fields) }, cookie);

  const admin = run(`INSERT INTO people (display_name, email, profile_id)
                     VALUES ('Office Admin', 'office@church.test', (SELECT id FROM profiles WHERE name = 'Room bookings'))`);
  run(`INSERT INTO sessions (id, person_id, expires_at) VALUES ('msg-admin', ?, '2999-01-01T00:00:00.000Z')`, admin);
  const vol = run(`INSERT INTO people (display_name, profile_id) VALUES ('A Volunteer', (SELECT id FROM profiles WHERE name = 'Volunteer'))`);
  run(`INSERT INTO sessions (id, person_id, expires_at) VALUES ('msg-vol', ?, '2999-01-01T00:00:00.000Z')`, vol);

  const ev = run(`INSERT INTO events (slug, title, starts_at, ends_at, is_published) VALUES ('supper', 'Harvest Supper', '2030-10-10T19:00', '2030-10-10T21:00', 1)`);
  const other = run(`INSERT INTO events (slug, title, starts_at, is_published) VALUES ('other', 'Other Event', '2030-11-10T19:00', 1)`);
  const book = (event: number, name: string, email: string | null, status = 'booked', phone: string | null = null) =>
    run(`INSERT INTO event_bookings (event_id, name, email, phone, status) VALUES (?, ?, ?, ?, ?)`, event, name, email, phone, status);
  const ann = book(ev, 'Ann', 'ann@example.org');
  const bob = book(ev, 'Bob', 'bob@example.org');
  book(ev, 'Bob again', 'BOB@example.org'); // the same person booked twice
  const cat = book(ev, 'Cat', null, 'booked', '01594 000000');
  book(ev, 'Dan (cancelled)', 'dan@example.org', 'cancelled');
  const eve = book(ev, 'Eve (waiting)', 'eve@example.org', 'waitlist');
  const stranger = book(other, 'Stranger', 'stranger@example.org');

  const page = await call(`/app/events/${ev}`);
  ok('the event page offers "Communicate with participants"',
    page.body.includes(`/app/events/${ev}/message`) && page.body.includes('Communicate with participants'));

  const compose = await call(`/app/events/${ev}/message`);
  ok('the writing page opens, with both choices and the blind-copy promise',
    compose.status === 200 && compose.body.includes('Send to all participants')
    && compose.body.includes('Send to selected participants') && compose.body.includes('blind copy'));
  ok('replies are suggested to go to whoever is writing', compose.body.includes('value="office@church.test"'));
  ok('the cancelled booking is not offered; somebody with no email cannot be ticked',
    !compose.body.includes('Dan (cancelled)') && /No email address — cannot be emailed/.test(compose.body));

  const forVol = await call(`/app/events/${ev}/message`, undefined, 'bream_session=msg-vol');
  ok('somebody who may only see events cannot open it (it lists email addresses)', forVol.status !== 200, String(forVol.status));
  const volSend = await post(`/app/events/${ev}/message/send`, [['subject', 'x'], ['body', 'y'], ['booking_id', String(ann)]], 'bream_session=msg-vol');
  ok('nor send anything', volSend.status !== 303 && outbox.length === 0, String(volSend.status));

  outbox.length = 0;
  const empty = await post(`/app/events/${ev}/message/check`, [['subject', ''], ['body', 'Hello'], ['audience', 'all']]);
  ok('no subject is refused, with what was typed kept', empty.status === 400 && empty.body.includes('Give the email a subject')
    && empty.body.includes('Hello'));

  const draft: [string, string][] = [['subject', 'Parking on the night'], ['body', 'Dear all,\r\n\r\nPark at the school.'],
    ['reply_to', 'office@church.test'], ['audience', 'all']];
  const check = await post(`/app/events/${ev}/message/check`, draft);
  ok('"Are you sure?" shows the message, how many, and who has no email', check.status === 200
    && check.body.includes('Are you sure?') && check.body.includes('Park at the school.')
    && check.body.includes('Yes, send it to 2 people') && check.body.includes('Cat') && check.body.includes('01594 000000'));
  ok('checking sends nothing', outbox.length === 0);

  // What the confirm page would post back: the ids it fixed.
  const ids = [...check.body.matchAll(/name="booking_id" value="(\d+)"/g)].map((m) => m[1]!);
  ok('"all" means everybody booked in — not the waiting list, not the cancelled',
    new Set(ids).size === 4 && !ids.includes(String(eve)) && ids.includes(String(cat)), ids.join(','));

  const send = await post(`/app/events/${ev}/message/send`, [...draft, ...[...new Set(ids)].map((i) => ['booking_id', i] as [string, string])]);
  private_('send to all participants');
  ok('it went to Ann and Bob, once each, blind-copied', JSON.stringify(delivered()) === '["ann@example.org","bob@example.org"]',
    JSON.stringify(delivered()));
  ok('replies go where asked', outbox.every((m) => m.replyTo === 'office@church.test'));
  ok('then on to the result page, away from the POST', send.status === 303 && /\/message\/\d+\?sent=1$/.test(send.location ?? ''));
  const result = await call(send.location!);
  ok('which says it was sent, and who had no email', result.body.includes('Sent to 2 people') && result.body.includes('Cat'));
  const rec = rows<{ status: string }>(`SELECT status FROM event_message_recipients ORDER BY booking_id`);
  ok('the record is by booking, with no addresses stored',
    rec.map((r) => r.status).join(',') === 'sent,sent,sent,no_email'
    && !JSON.stringify(rows('SELECT * FROM event_messages')).includes('@example.org'));

  const twice = await post(`/app/events/${ev}/message/send`, [...draft, ...[...new Set(ids)].map((i) => ['booking_id', i] as [string, string])]);
  ok('pressing send again straight after does not send it twice', outbox.length === 1 && twice.status === 303);

  outbox.length = 0;
  const chosen: [string, string][] = [['subject', 'Just you two'], ['body', 'Hello'], ['audience', 'chosen'],
    ['booking_id', String(bob)], ['booking_id', String(eve)], ['booking_id', String(stranger)]];
  const check2 = await post(`/app/events/${ev}/message/check`, chosen);
  ok('selected participants: only those ticked, and never a booking from another event',
    check2.body.includes('Yes, send it to 2 people') && !check2.body.includes('stranger@example.org'));
  await post(`/app/events/${ev}/message/send`, chosen);
  private_('send to selected participants');
  ok('it went to Bob and Eve only', JSON.stringify(delivered()) === '["bob@example.org","eve@example.org"]',
    JSON.stringify(delivered()));

  outbox.length = 0;
  const nobody = await post(`/app/events/${ev}/message/check`, [['subject', 'S'], ['body', 'B'], ['audience', 'chosen']]);
  ok('selected, with nobody ticked, is refused in plain words', nobody.status === 400 && nobody.body.includes('Nobody is ticked'));

  const back = await post(`/app/events/${ev}/message`, chosen);
  ok('"go back and change it" keeps the words and the ticks', back.body.includes('Just you two')
    && new RegExp(`value="${bob}" data-pick data-group="booked"\\s+checked`).test(back.body));
}

console.log(failures === 0 ? '\nEvent messages OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
