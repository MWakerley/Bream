/**
 * The church newsletter: what it says about the week, and who it goes to.
 *
 * Runs against a real SQLite database built from every migration, with
 * stand-ins for the mail binding, the picture store and the static assets,
 * and drives the whole app through its own fetch.
 *
 * The things that must never go wrong are checked first and hardest:
 *   * the week ahead never names a room, and never shows a private booking,
 *     a request not yet approved, an unpublished event, or anything cancelled;
 *   * every newsletter copy goes to ONE person — no Cc, no Bcc, nobody else's
 *     address anywhere in it — with that person's own unsubscribe link;
 *   * only confirmed subscribers get it, and unsubscribing deletes them;
 *   * nothing goes to the list while no newsletter service is switched on.
 *
 *   npm run test:news
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { diaryWeek, parseSubscriberList } from '../src/newsletter/store.js';
import { newsletterHtml } from '../src/newsletter/render.js';
import { newsletterPdf } from '../src/newsletter/pdf.js';
import app from '../src/index.js';

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
const SKIP = new Set(['0008_import_room_bookings.sql']);
for (const f of readdirSync('migrations').filter((n) => n.endsWith('.sql') && !SKIP.has(n)).sort()) {
  try { db.exec(readFileSync(`migrations/${f}`, 'utf8')); } catch (e) { throw new Error(`${f}: ${(e as Error).message}`); }
}
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

// ---- the week ahead ---------------------------------------------------------------
console.log('the week ahead:');
const WEEK = '2030-06-02'; // a Sunday
const person = run(`INSERT INTO people (display_name, email, profile_id) VALUES ('News Admin', 'admin@church.test', (SELECT id FROM profiles WHERE name = 'Administrator'))`);
const hall = run(`INSERT INTO rooms (name, sort_order) VALUES ('SECRET-ROOM-HALL', 50)`);
const snug = run(`INSERT INTO rooms (name, sort_order) VALUES ('SECRET-ROOM-SNUG', 51)`);
const gone = run(`INSERT INTO rooms (name, sort_order, is_active) VALUES ('Old room', 52, 0)`);
const book = (o: { room?: number; title: string; at: string; to?: string; status?: string; tentative?: number; private?: number; event?: number | null }) => run(
  `INSERT INTO room_bookings (room_id, title, starts_at, ends_at, booked_by, contact, notes, status, is_tentative, is_private, event_id)
   VALUES (?, ?, ?, ?, ?, 'CONTACT-SECRET 07700', 'NOTE-SECRET', ?, ?, ?, ?)`,
  o.room ?? hall, o.title, o.at, o.to ?? o.at.replace(/T\d\d/, 'T23'), person, o.status ?? 'booked', o.tentative ?? 0, o.private ?? 0, o.event ?? null);
book({ title: 'Toddler group', at: '2030-06-03T10:00', to: '2030-06-03T11:30' });
book({ title: 'Toddler group', at: '2030-06-03T10:00', to: '2030-06-03T11:30', room: snug }); // two rooms, one line
book({ title: 'Counselling PRIVATE', at: '2030-06-04T10:00', private: 1 });
book({ title: 'Asked for TENTATIVE', at: '2030-06-04T12:00', tentative: 1 });
book({ title: 'Called off CANCELLED', at: '2030-06-04T14:00', status: 'cancelled' });
book({ title: 'In an old room GONE', at: '2030-06-04T16:00', room: gone });
book({ title: 'Too late NEXT-WEEK', at: '2030-06-09T10:00' });
const hidden = run(`INSERT INTO events (slug, title, starts_at, is_published) VALUES ('surprise', 'Surprise UNPUBLISHED', '2030-06-05T19:00', 0)`);
book({ title: 'Surprise UNPUBLISHED', at: '2030-06-05T19:00', event: hidden });
const supper = run(`INSERT INTO events (slug, title, starts_at, ends_at, is_published, location) VALUES ('supper', 'Harvest Supper', '2030-06-06T19:00', '2030-06-06T21:30', 1, 'SECRET-ROOM-HALL')`);
book({ title: 'Harvest Supper', at: '2030-06-06T19:00', event: supper });
run(`INSERT INTO services (service_date, service_time, title) VALUES ('2030-06-02', '10:30', 'Holy Communion')`);
run(`INSERT INTO services (service_date, service_time, title, is_cancelled) VALUES ('2030-06-02', '18:00', 'Evensong CANCELLED', 1)`);

const week = await diaryWeek(d1, WEEK);
const all = JSON.stringify(week);
ok('services, published events and room bookings are all there',
  week.some((i) => i.title === 'Holy Communion' && i.kind === 'service')
  && week.some((i) => i.title === 'Harvest Supper' && i.kind === 'event' && i.endTime === '21:30')
  && week.some((i) => i.title === 'Toddler group' && i.kind === 'booking'), all);
ok('never a room name, a contact or a note', !/SECRET/.test(all), all);
ok('never private, unconfirmed, unpublished, cancelled, in an unused room, or outside the week',
  !/PRIVATE|TENTATIVE|UNPUBLISHED|CANCELLED|GONE|NEXT-WEEK/.test(all), all);
ok('the same thing in two rooms is one line; an event is listed once, not again for its room',
  week.filter((i) => i.title === 'Toddler group').length === 1 && week.filter((i) => i.title === 'Harvest Supper').length === 1);
ok('in date and time order', JSON.stringify(week.map((i) => i.title)) === '["Holy Communion","Toddler group","Harvest Supper"]',
  JSON.stringify(week.map((i) => i.title)));

const emailHtml = newsletterHtml({ title: 'This week', weekFrom: WEEK, blocks: [{ id: 'w', type: 'week' }], week, origin: 'https://x.test' });
ok('the email shows the week by day, with friendly times', emailHtml.includes('Sunday 2 June') && emailHtml.includes('10.30am')
  && emailHtml.includes('7pm – 9.30pm') && !emailHtml.includes('SECRET'));

console.log('\nreading a pasted list:');
const parsed = parseSubscriberList('Jane Smith, jane@example.org\n<bob@example.org>\n\nnot an email\n"Ann Lee" <ann@example.org>;');
ok('"Name, email", "<email>" and "Name <email>" all read; junk skipped',
  JSON.stringify(parsed) === JSON.stringify([{ email: 'jane@example.org', name: 'Jane Smith' }, { email: 'bob@example.org', name: '' },
    { email: 'ann@example.org', name: 'Ann Lee' }]), JSON.stringify(parsed));

// ---- the stand-ins -------------------------------------------------------------------
type Sent = { to: unknown; cc?: unknown; bcc?: unknown; subject: string; html?: string; text?: string;
  headers?: Record<string, string>; attachments?: { filename: string; type: string; content: ArrayBuffer }[] };
const outbox: Sent[] = [];
const binding = { async send(m: Sent) { outbox.push(m); } };
const store = new Map<string, { bytes: Uint8Array; type: string }>();
const IMAGES = {
  async put(key: string, body: ReadableStream, o: { httpMetadata: { contentType: string } }) {
    store.set(key, { bytes: new Uint8Array(await new Response(body).arrayBuffer()), type: o.httpMetadata.contentType });
  },
  async get(key: string) {
    const v = store.get(key);
    if (!v) return null;
    return { async arrayBuffer() { return v.bytes.buffer; }, body: new Blob([v.bytes]).stream(), httpEtag: '"x"',
      writeHttpMetadata(h: Headers) { h.set('content-type', v.type); } };
  },
};
const LOGO = readFileSync('public/assets/logo.png');
const ASSETS = { async fetch() { return new Response(LOGO); } };

const pdfBytes = await newsletterPdf({ title: 'A test', weekFrom: WEEK, week, logo: new Uint8Array(LOGO),
  blocks: [{ id: 'h', type: 'heading', text: 'Hello – “quotes” and émigré' }, { id: 't', type: 'text', text: 'Para one.\n\nPara two.' },
    { id: 'q', type: 'quote', text: 'The Lord is my shepherd', cite: 'Psalm 23' }, { id: 'i', type: 'image', key: 'k', caption: 'A photo' },
    { id: 'w', type: 'week' }],
  images: new Map([['k', { bytes: new Uint8Array(LOGO), type: 'image/png' }]]) });
ok('the PDF builds, with logo, picture and odd characters', new TextDecoder().decode(pdfBytes.slice(0, 5)) === '%PDF-');

// ---- the pages -----------------------------------------------------------------------
console.log('\nthe pages, as the office uses them:');
const exec = { waitUntil() {}, passThroughOnException() {} } as never;
let envVars: Record<string, unknown> = {};
const env = () => ({ DB: d1, EMAIL: binding, ACK_FROM: 'news@church.test', IMAGES, ASSETS, ...envVars }) as never;
run(`INSERT INTO sessions (id, person_id, expires_at) VALUES ('news-admin', ?, '2999-01-01T00:00:00.000Z')`, person);
const vol = run(`INSERT INTO people (display_name, profile_id) VALUES ('Vol', (SELECT id FROM profiles WHERE name = 'Volunteer'))`);
run(`INSERT INTO sessions (id, person_id, expires_at) VALUES ('news-vol', ?, '2999-01-01T00:00:00.000Z')`, vol);
const call = async (path: string, init: RequestInit = {}, cookie: string | null = 'bream_session=news-admin') => {
  const res = await app.fetch(new Request(`https://bream.test${path}`,
    { ...init, headers: { ...(cookie ? { cookie } : {}), ...(init.headers as Record<string, string> ?? {}) } }), env(), exec);
  const isText = !(res.headers.get('content-type') ?? '').includes('pdf');
  return { status: res.status, location: res.headers.get('location'), type: res.headers.get('content-type'),
    body: isText ? await res.text() : '', bytes: isText ? null : new Uint8Array(await res.arrayBuffer()) };
};
const post = (path: string, fields: [string, string | Blob][], cookie?: string | null) => {
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v as string);
  return call(path, { method: 'POST', body: fd }, cookie);
};

const home = await call('/app');
ok('the menu says Admin Centre, not Settings', home.body.includes('>Admin Centre<') && !home.body.includes('>Settings<'));
const centre = await call('/app/settings');
ok('the Admin Centre offers Newsletter', centre.body.includes('Admin Centre') && centre.body.includes('/app/settings/newsletter'));
ok('a volunteer cannot open the newsletter pages', (await call('/app/settings/newsletter', {}, 'bream_session=news-vol')).status === 403);

const created = await post('/app/settings/newsletter/new', []);
const nid = Number(created.location?.split('/').pop());
ok('"Create a newsletter" starts a draft and opens it', created.status === 303 && Number.isInteger(nid));
db.prepare('UPDATE newsletters SET week_from = ? WHERE id = ?').run(WEEK, nid);
const ed = await call(`/app/settings/newsletter/${nid}`);
ok('the writing page shows the week from the diary, by name and time only', ed.status === 200
  && ed.body.includes('Toddler group') && ed.body.includes('Holy Communion') && !ed.body.includes('SECRET-ROOM'));

// What the page would post: its own fields back, plus changes.
const formOf = (body: string): [string, string][] => {
  const out: [string, string][] = [];
  for (const m of body.matchAll(/<input([^>]*)>/g)) {
    const a = m[1]!;
    const name = /name="([^"]+)"/.exec(a)?.[1];
    if (!name || /type="(file|checkbox)"/.test(a) && !/type="checkbox"[^>]*checked/.test(a)) continue;
    out.push([name, /value="([^"]*)"/.exec(a)?.[1]?.replace(/&amp;/g, '&').replace(/&quot;/g, '"') ?? '']);
  }
  for (const m of body.matchAll(/<textarea[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g)) out.push([m[1]!, m[2]!]);
  return out.filter(([k]) => k !== 'do');
};
/** The page's own fields with some replaced, as a browser sends one value per box. */
const merge = (f: [string, string][], extra: [string, string | Blob][]): [string, string | Blob][] => {
  const keys = new Set(extra.map(([k]) => k));
  return [...f.filter(([k]) => !keys.has(k)), ...extra];
};
const set = (f: [string, string][], k: string, v: string) => f.map(([a, b]) => [a, a === k ? v : b] as [string, string]);

let f = formOf(ed.body);
const ids = f.filter(([k]) => k === 'block_id').map(([, v]) => v);
f = set(f, 'title', 'Midsummer at Bream');
f = set(f, `b_${ids[0]}_text`, 'Summer is here');
// Untick the toddler group, add a picture section.
f = f.filter(([k, v]) => !(k === 'show' && v.startsWith('booking:')));
let r = await post(`/app/settings/newsletter/${nid}/save`, [...f, ['do', 'add:image']]);
let n = rows<{ title: string; blocks: string; hidden_items: string }>('SELECT title, blocks, hidden_items FROM newsletters WHERE id = ?', nid)[0]!;
ok('saving keeps the edits and adds a picture section', r.status === 303 && n.title === 'Midsummer at Bream'
  && JSON.parse(n.blocks)[0].text === 'Summer is here' && JSON.parse(n.blocks).at(-1).type === 'image', n.blocks);
ok('an unticked diary item stays out', JSON.parse(n.hidden_items).some((k: string) => k.startsWith('booking:')), n.hidden_items);

f = formOf((await call(`/app/settings/newsletter/${nid}`)).body);
const imgId = JSON.parse(n.blocks).at(-1).id;
r = await post(`/app/settings/newsletter/${nid}/save`, merge(f, [[`b_${imgId}_file`, new File([LOGO], 'church.png', { type: 'image/png' })],
  ['new_title', 'Choir picnic'], ['new_date', '2030-06-07'], ['new_time', '12:00'], ['new_note', 'Bring a rug'], ['do', 'add-item']]));
n = rows<{ title: string; blocks: string; hidden_items: string; extra_items: string }>('SELECT * FROM newsletters WHERE id = ?', nid)[0] as never;
const key = JSON.parse(n.blocks).at(-1).key as string;
ok('a picture is stored, and something added to the week is kept', /^newsletters\/\d+\/.+\.png$/.test(key) && store.has(key)
  && JSON.parse((n as unknown as { extra_items: string }).extra_items)[0]?.title === 'Choir picnic', n.blocks);
r = await post(`/app/settings/newsletter/${nid}/save`, merge(formOf((await call(`/app/settings/newsletter/${nid}`)).body), [['new_title', 'Wrong week'], ['new_date', '2030-07-01'], ['do', 'add-item']]));
ok('a day outside the week is refused, in words', (new URL(r.location ?? '/', 'https://x').searchParams.get('e') ?? '').includes('Choose a day in the week ahead'));
r = await post(`/app/settings/newsletter/${nid}/save`, [...formOf((await call(`/app/settings/newsletter/${nid}`)).body), ['do', `up:${imgId}`]]);
ok('a section moves up', JSON.parse(rows<{ blocks: string }>('SELECT blocks FROM newsletters WHERE id = ?', nid)[0]!.blocks).at(-2).id === imgId);

const pv = await call(`/app/settings/newsletter/${nid}/preview`);
ok('the preview has the logo, title, picture, the added item, and not the unticked one', pv.status === 200
  && pv.body.includes('/assets/logo-transparent.png') && pv.body.includes('Midsummer at Bream') && pv.body.includes('/newsletter/image/')
  && pv.body.includes('Choir picnic') && !pv.body.includes('Toddler group'));
const img = await call(pv.body.match(/src="https:\/\/bream\.test(\/newsletter\/image\/[^"]+)"/)![1]!, {}, null);
ok('its picture loads without signing in', img.status === 200 && img.type === 'image/png');
const pdf = await call(`/app/settings/newsletter/${nid}/newsletter.pdf`);
ok('the PDF downloads', pdf.status === 200 && pdf.type === 'application/pdf' && new TextDecoder().decode(pdf.bytes!.slice(0, 5)) === '%PDF-');

outbox.length = 0;
r = await post(`/app/settings/newsletter/${nid}/save`, merge(formOf((await call(`/app/settings/newsletter/${nid}`)).body), [['test_to', 'me@church.test'], ['do', 'test']]));
const t = outbox[0];
ok('a test copy goes to the one address given, PDF attached', outbox.length === 1 && t?.to === 'me@church.test'
  && !t.cc && !t.bcc && t.attachments?.[0]?.type === 'application/pdf' && t.subject.startsWith('[Test]'), JSON.stringify(t?.to));

// ---- subscribers -----------------------------------------------------------------
console.log('\nsigning up and unsubscribing:');
outbox.length = 0;
const su = await post('/newsletter', [['name', 'Pat Public'], ['email', 'pat@example.org'], ['consent', '1']], null);
const pat = () => rows<{ status: string; token: string; consent_text: string }>(`SELECT * FROM newsletter_subscribers WHERE email = 'pat@example.org'`)[0];
ok('signing up on the website records consent and waits for confirmation', su.status === 200 && su.body.includes('Check your inbox')
  && pat()?.status === 'pending' && /UK GDPR/.test(pat()!.consent_text));
ok('and emails them, alone, a link to confirm', outbox.length === 1 && outbox[0]!.to === 'pat@example.org' && (outbox[0]!.text ?? '').includes(`/newsletter/confirm/${pat()!.token}`));
const noConsent = await post('/newsletter', [['name', 'X'], ['email', 'x@example.org']], null);
ok('without the GDPR tick it is refused', noConsent.status === 400 && rows(`SELECT 1 FROM newsletter_subscribers WHERE email = 'x@example.org'`).length === 0);
await post('/newsletter', [['name', 'Pat Public'], ['email', 'pat@example.org'], ['consent', '1']], null);
ok('pressing it again does not send a second email', outbox.length === 1);
const cg = await call(`/newsletter/confirm/${pat()!.token}`, {}, null);
ok('opening the confirm link only shows a button — a link scanner confirms nobody', cg.body.includes('Confirm my subscription') && pat()?.status === 'pending');
await post(`/newsletter/confirm/${pat()!.token}`, [], null);
ok('pressing it confirms', pat()?.status === 'active');

await post('/newsletter', [['name', 'Never Confirms'], ['email', 'lurker@example.org'], ['consent', '1']], null);
const add = await post('/app/settings/newsletter/subscribers/add', [['list', Array.from({ length: 28 }, (_, i) => `Member ${i}, m${i}@example.org`).join('\n')], ['consent', '1']]);
ok('the office can add a pasted list, with consent recorded', add.body.includes('28 added') && rows(`SELECT 1 FROM newsletter_subscribers WHERE source = 'admin'`).length === 28);
const noTick = await post('/app/settings/newsletter/subscribers/add', [['list', 'a@b.org']]);
ok('but only after ticking that they asked for it', noTick.status === 400);

// ---- sending -----------------------------------------------------------------------
console.log('\nsending:');
outbox.length = 0;
const fin = await call(`/app/settings/newsletter/${nid}/finalise`);
ok('"Are you sure?" with no service switched on: says why, and the button is off',
  fin.body.includes('Are you sure?') && fin.body.includes('not switched on yet') && /id="send-button"\s+disabled/.test(fin.body));
await post(`/app/settings/newsletter/${nid}/send`, []);
ok('and sending anyway sends nothing', outbox.length === 0 && rows<{ status: string }>('SELECT status FROM newsletters WHERE id = ?', nid)[0]!.status === 'draft');

envVars = { NEWSLETTER_SENDER: 'cloudflare' };
let s = await post(`/app/settings/newsletter/${nid}/send`, []);
ok('switched on, the first press sends a batch and carries on by itself', s.status === 200 && s.body.includes('of <strong>29</strong>') && outbox.length === 25, `${s.status} ${outbox.length}`);
const edit = await post(`/app/settings/newsletter/${nid}/save`, [['title', 'CHANGED'], ['do', 'save']]);
ok('once going out it cannot be changed', edit.status === 303 && rows<{ title: string }>('SELECT title FROM newsletters WHERE id = ?', nid)[0]!.title === 'Midsummer at Bream');
s = await post(`/app/settings/newsletter/${nid}/send`, []);
ok('the next press finishes and files it in the archive', s.status === 303 && outbox.length === 29
  && rows<{ status: string; sent_count: number }>('SELECT status, sent_count FROM newsletters WHERE id = ?', nid)[0]!.sent_count === 29);

const subs = rows<{ email: string; token: string }>(`SELECT email, token FROM newsletter_subscribers WHERE status = 'active'`);
const tokenOf = new Map(subs.map((x) => [x.email, x.token]));
const everyAddress = subs.map((x) => x.email);
const leaks = outbox.filter((m) => {
  const to = String(m.to);
  const others = everyAddress.filter((e) => e !== to);
  const blob = JSON.stringify({ ...m, attachments: undefined });
  return m.cc || m.bcc || !tokenOf.has(to) || others.some((e) => blob.includes(e));
});
ok('EVERY copy is to one subscriber alone: no Cc, no Bcc, nobody else’s address anywhere in it', leaks.length === 0,
  JSON.stringify(leaks.map((m) => m.to)));
ok('each person exactly once, and never somebody unconfirmed',
  new Set(outbox.map((m) => m.to)).size === 29 && !outbox.some((m) => m.to === 'lurker@example.org'));
ok('each carries their own unsubscribe link, in the email and as one-click headers', outbox.every((m) => {
  const u = `/newsletter/unsubscribe/${tokenOf.get(String(m.to))}`;
  return (m.html ?? '').includes(u) && m.headers?.['List-Unsubscribe']?.includes(u) && m.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click';
}));
ok('with the PDF attached', outbox.every((m) => m.attachments?.[0]?.filename.endsWith('.pdf')));
const arch = await call('/app/settings/newsletter');
ok('it is in the archive', arch.body.includes('Archive') && arch.body.includes('Midsummer at Bream'));
db.prepare(`INSERT INTO room_bookings (room_id, title, starts_at, ends_at, status) VALUES (?, 'Booked AFTER sending', '2030-06-04T09:00', '2030-06-04T10:00', 'booked')`).run(hall);
ok('and the archive shows what was sent, not today’s diary', !(await call(`/app/settings/newsletter/${nid}/preview`)).body.includes('AFTER sending'));

const patToken = tokenOf.get('pat@example.org')!;
const ug = await call(`/newsletter/unsubscribe/${patToken}`, {}, null);
ok('the unsubscribe link shows a button, and removes nobody by itself', ug.body.includes('Unsubscribe me') && !!pat());
await post(`/newsletter/unsubscribe/${patToken}`, [], null);
ok('pressing it deletes them from the list entirely', !pat());
const m0 = tokenOf.get('m0@example.org')!;
const oneClick = await call(`/newsletter/unsubscribe/${m0}`, { method: 'POST', body: 'List-Unsubscribe=One-Click',
  headers: { 'content-type': 'application/x-www-form-urlencoded' } }, null);
ok('one-click unsubscribe from the inbox works too', oneClick.status === 200 && rows(`SELECT 1 FROM newsletter_subscribers WHERE email = 'm0@example.org'`).length === 0);
ok('and their delivery records go with them', rows('SELECT 1 FROM newsletter_deliveries d LEFT JOIN newsletter_subscribers s ON s.id = d.subscriber_id WHERE s.id IS NULL').length === 0);

console.log(failures === 0 ? '\nNewsletter OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
