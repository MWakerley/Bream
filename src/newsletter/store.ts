import { newSessionId } from '../auth.js';
import { usableEmail } from '../email.js';
import { MAX_REPEAT_COUNT, eventOccurrences, repeatOf } from '../events.js';

/**
 * The newsletter's data: its subscribers, its issues, and the week ahead read
 * from the diary.
 */

// ---- blocks ------------------------------------------------------------------

export type Block =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'quote'; text: string; cite: string }
  | { id: string; type: 'image'; key: string | null; caption: string }
  | { id: string; type: 'week' };

export type BlockType = Block['type'];
export const BLOCK_TYPES: BlockType[] = ['heading', 'text', 'quote', 'image', 'week'];

/** Something added to the week ahead by hand. */
export interface ExtraItem { id: string; date: string; time: string; title: string; note: string }

/** One line of the week ahead, whichever way it got there. */
export interface WeekItem {
  /** Stable, so an item taken out stays out however often the diary is read. */
  key: string;
  date: string;
  /** 'HH:MM', or '' for something with no set time. */
  time: string;
  endTime: string;
  title: string;
  note: string;
  kind: 'service' | 'event' | 'booking' | 'added';
}

export interface NewsletterRow {
  id: number;
  title: string;
  week_from: string;
  blocks: string;
  extra_items: string;
  hidden_items: string;
  week_snapshot: string | null;
  status: 'draft' | 'sending' | 'sent';
  created_at: string;
  updated_at: string;
  test_sent_at: string | null;
  test_sent_to: string | null;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  created_by_name?: string | null;
  sent_by_name?: string | null;
}

export interface Newsletter {
  row: NewsletterRow;
  blocks: Block[];
  extra: ExtraItem[];
  hidden: string[];
}

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  try {
    const v = JSON.parse(s ?? '');
    return Array.isArray(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Only well-formed blocks survive a read, so one bad row cannot break the page. */
export function parseBlocks(s: string | null | undefined): Block[] {
  return parseJson<unknown[]>(s, []).flatMap((raw): Block[] => {
    const b = raw as Record<string, unknown>;
    const id = typeof b.id === 'string' ? b.id : newId();
    const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
    switch (b.type) {
      case 'heading': return [{ id, type: 'heading', text: str('text') }];
      case 'text': return [{ id, type: 'text', text: str('text') }];
      case 'quote': return [{ id, type: 'quote', text: str('text'), cite: str('cite') }];
      case 'image': return [{ id, type: 'image', key: str('key') || null, caption: str('caption') }];
      case 'week': return [{ id, type: 'week' }];
      default: return [];
    }
  });
}

export const newId = () => newSessionId().slice(0, 10);

export function toNewsletter(row: NewsletterRow): Newsletter {
  return {
    row,
    blocks: parseBlocks(row.blocks),
    extra: parseJson<ExtraItem[]>(row.extra_items, []).filter((x) => x && typeof x.title === 'string'),
    hidden: parseJson<string[]>(row.hidden_items, []).filter((x) => typeof x === 'string'),
  };
}

const SELECT_NEWSLETTER = `
  SELECT n.*, c.display_name AS created_by_name, s.display_name AS sent_by_name
    FROM newsletters n
    LEFT JOIN people c ON c.id = n.created_by
    LEFT JOIN people s ON s.id = n.sent_by`;

export async function getNewsletter(db: D1Database, id: number): Promise<Newsletter | null> {
  const row = await db.prepare(`${SELECT_NEWSLETTER} WHERE n.id = ?1`).bind(id).first<NewsletterRow>();
  return row ? toNewsletter(row) : null;
}

export async function listNewsletters(db: D1Database): Promise<NewsletterRow[]> {
  const { results } = await db
    .prepare(`${SELECT_NEWSLETTER} ORDER BY COALESCE(n.sent_at, n.updated_at) DESC, n.id DESC`)
    .all<NewsletterRow>();
  return results;
}

export async function saveNewsletter(db: D1Database, id: number, n: {
  title: string; week_from: string; blocks: Block[]; extra: ExtraItem[]; hidden: string[];
}) {
  await db.prepare(
    `UPDATE newsletters
        SET title = ?2, week_from = ?3, blocks = ?4, extra_items = ?5, hidden_items = ?6,
            updated_at = datetime('now')
      WHERE id = ?1 AND status = 'draft'`,
  ).bind(id, n.title, n.week_from, JSON.stringify(n.blocks), JSON.stringify(n.extra),
    JSON.stringify([...new Set(n.hidden)])).run();
}

/** What a new issue starts with: something to say, and the week ahead. */
export function starterBlocks(): Block[] {
  return [
    { id: newId(), type: 'heading', text: 'Welcome' },
    { id: newId(), type: 'text', text: 'A warm welcome to this week’s newsletter from Bream Church.' },
    { id: newId(), type: 'week' },
  ];
}

// ---- the week ahead ------------------------------------------------------------

export const WEEK_DAYS = 7;

export const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * Everything on in the church for the seven days from `from`.
 *
 * Services from the rota, published events, and room bookings — by what they
 * are and when, NEVER by room, and under the same rules as the room diary on
 * the website, only stricter: no booking ticked private, nothing held for a
 * request not yet approved, no room held for an event not yet published (the
 * event itself appears once it is), and nothing cancelled. A newsletter goes
 * to people's inboxes and cannot be taken back, so when in doubt it is left
 * out — it can always be added by hand.
 *
 * The same thing booked in two rooms at once is one line, not two.
 */
export async function diaryWeek(db: D1Database, from: string): Promise<WeekItem[]> {
  if (!isDate(from)) return [];
  const to = addDays(from, WEEK_DAYS);
  const [services, events, bookings] = await db.batch([
    db.prepare(
      `SELECT s.id, s.service_date AS date, s.service_time AS time,
              COALESCE(NULLIF(TRIM(s.title), ''), t.name, 'Service') AS title, s.location
         FROM services s LEFT JOIN service_types t ON t.id = s.service_type_id
        WHERE s.is_cancelled = 0 AND s.service_date >= ?1 AND s.service_date < ?2
        ORDER BY s.service_date, s.service_time`,
    ).bind(from, to),
    db.prepare(
      // From far enough back to catch a repeating event that began before this
      // week (a year of fortnights); expanded and trimmed to the week below.
      `SELECT id, title, starts_at, ends_at, repeat_freq, repeat_count FROM events
        WHERE is_published = 1 AND starts_at >= ?3 AND starts_at < ?2
        ORDER BY starts_at`,
    ).bind(`${from}T00:00`, `${to}T00:00`, `${addDays(from, -2 * 7 * MAX_REPEAT_COUNT)}T00:00`),
    db.prepare(
      `SELECT b.title, b.starts_at, b.ends_at
         FROM room_bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.status = 'booked' AND r.is_active = 1
          AND b.is_private = 0 AND b.is_tentative = 0 AND b.event_id IS NULL
          AND b.starts_at >= ?1 AND b.starts_at < ?2
          AND TRIM(COALESCE(b.title, '')) <> ''
        ORDER BY b.starts_at`,
    ).bind(`${from}T00:00`, `${to}T00:00`),
  ]);

  const items: WeekItem[] = [];
  for (const s of (services?.results ?? []) as { id: number; date: string; time: string; title: string; location: string | null }[]) {
    items.push({ key: `service:${s.id}`, date: s.date, time: s.time ?? '', endTime: '', title: s.title,
      note: s.location ?? '', kind: 'service' });
  }
  for (const e of (events?.results ?? []) as { id: number; title: string; starts_at: string; ends_at: string | null; repeat_freq: string | null; repeat_count: number | null }[]) {
    // Each time a repeating event happens this week, not only its first.
    for (const t of eventOccurrences(e.starts_at, e.ends_at ?? e.starts_at, repeatOf(e))) {
      const date = t.startsAt.slice(0, 10);
      if (date < from || date >= to) continue;
      // A one-off keeps the key it always had, so a newsletter that left it out
      // still leaves it out.
      items.push({ key: repeatOf(e) ? `event:${e.id}:${date}` : `event:${e.id}`, date, time: t.startsAt.slice(11, 16),
        endTime: e.ends_at && t.endsAt.slice(0, 10) === date ? t.endsAt.slice(11, 16) : '',
        title: e.title, note: '', kind: 'event' });
    }
  }
  for (const b of (bookings?.results ?? []) as { title: string; starts_at: string; ends_at: string }[]) {
    const title = b.title.trim();
    items.push({ key: `booking:${b.starts_at}:${title.toLowerCase()}`, date: b.starts_at.slice(0, 10),
      time: b.starts_at.slice(11, 16),
      endTime: b.ends_at.slice(0, 10) === b.starts_at.slice(0, 10) ? b.ends_at.slice(11, 16) : '',
      title, note: '', kind: 'booking' });
  }

  // One line per thing: two rooms, or a service that also has a room booked
  // under the same name, at the same time.
  const seen = new Set<string>();
  return sortWeek(items.filter((i) => {
    const k = `${i.date}T${i.time}|${i.title.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }));
}

export function sortWeek(items: WeekItem[]): WeekItem[] {
  return [...items].sort((a, b) => `${a.date}T${a.time || '99'}`.localeCompare(`${b.date}T${b.time || '99'}`)
    || a.title.localeCompare(b.title));
}

/** The diary's week, less what was taken out, plus what was added by hand. */
export function weekFor(n: Newsletter, diary: WeekItem[]): WeekItem[] {
  const hidden = new Set(n.hidden);
  const to = addDays(n.row.week_from, WEEK_DAYS);
  const added: WeekItem[] = n.extra
    .filter((x) => x.date >= n.row.week_from && x.date < to)
    .map((x) => ({ key: `added:${x.id}`, date: x.date, time: x.time, endTime: '', title: x.title,
      note: x.note, kind: 'added' as const }));
  return sortWeek([...diary.filter((i) => !hidden.has(i.key)), ...added]);
}

/** What the newsletter shows: frozen once it has gone, live until then. */
export async function weekShown(db: D1Database, n: Newsletter): Promise<WeekItem[]> {
  if (n.row.week_snapshot) return parseJson<WeekItem[]>(n.row.week_snapshot, []);
  return weekFor(n, await diaryWeek(db, n.row.week_from));
}

// ---- subscribers ---------------------------------------------------------------

export interface SubscriberRow {
  id: number;
  email: string;
  name: string | null;
  status: 'pending' | 'active';
  token: string;
  source: 'form' | 'admin';
  consent_text: string;
  consent_at: string;
  confirmed_at: string | null;
  created_at: string;
  added_by_name: string | null;
}

/** The words somebody agrees to on the sign-up form. Stored with their row,
 *  so if these are ever changed, what each person agreed to is still known. */
export const CONSENT_TEXT =
  'I would like to receive the Bream Church newsletter and associated news about the church by '
  + 'email. I agree to Bream Church keeping my name and email address for this purpose only, in '
  + 'line with UK GDPR. I can unsubscribe at any time using the link in every email, and my '
  + 'details will then be deleted.';

/** What is recorded for somebody the office adds. */
export const ADMIN_CONSENT_TEXT =
  'Added by the church office, who confirmed this person has asked to receive the Bream Church '
  + 'newsletter and associated news about the church by email.';

/** How long an unconfirmed sign-up is kept before it is thrown away. */
export const PENDING_DAYS = 7;

export async function listSubscribers(db: D1Database): Promise<SubscriberRow[]> {
  await dropStalePending(db);
  const { results } = await db.prepare(
    `SELECT s.*, p.display_name AS added_by_name
       FROM newsletter_subscribers s LEFT JOIN people p ON p.id = s.added_by
      ORDER BY s.status = 'pending', LOWER(COALESCE(s.name, s.email))`,
  ).all<SubscriberRow>();
  return results;
}

export async function activeSubscribers(db: D1Database): Promise<{ id: number; email: string; name: string | null; token: string }[]> {
  const { results } = await db.prepare(
    `SELECT id, email, name, token FROM newsletter_subscribers WHERE status = 'active' ORDER BY id`,
  ).all<{ id: number; email: string; name: string | null; token: string }>();
  return results;
}

export async function countActive(db: D1Database): Promise<number> {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'active'`)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** Sign-ups never confirmed are not kept: an address nobody confirmed is an
 *  address we have no consent for. */
export async function dropStalePending(db: D1Database) {
  await db.prepare(
    `DELETE FROM newsletter_subscribers
      WHERE status = 'pending' AND created_at < datetime('now', ?1)`,
  ).bind(`-${PENDING_DAYS} days`).run();
}

export type SignUpOutcome =
  /** Send them the confirm email with this token. */
  | { kind: 'confirm'; token: string }
  /** Already on the list, or asked a moment ago: send nothing more. */
  | { kind: 'quiet' };

/**
 * Somebody filled in the form on the website.
 *
 * Whatever happens, the page they see afterwards says the same thing — "check
 * your inbox" — so the form cannot be used to find out who is on the list.
 */
export async function signUp(db: D1Database, emailRaw: string, name: string): Promise<SignUpOutcome> {
  const email = usableEmail(emailRaw);
  if (!email) return { kind: 'quiet' };
  await dropStalePending(db);
  const existing = await db.prepare(
    `SELECT id, status, token, created_at > datetime('now', '-10 minutes') AS recent
       FROM newsletter_subscribers WHERE email = ?1`,
  ).bind(email).first<{ id: number; status: string; token: string; recent: number }>();
  if (existing?.status === 'active') return { kind: 'quiet' };
  // Pressed twice, or a script filling the form: one email is enough.
  if (existing?.recent) return { kind: 'quiet' };

  const token = newSessionId();
  if (existing) {
    await db.prepare(
      `UPDATE newsletter_subscribers
          SET token = ?2, name = ?3, consent_text = ?4, consent_at = datetime('now'), created_at = datetime('now')
        WHERE id = ?1`,
    ).bind(existing.id, token, name || null, CONSENT_TEXT).run();
  } else {
    await db.prepare(
      `INSERT INTO newsletter_subscribers (email, name, status, token, source, consent_text)
       VALUES (?1, ?2, 'pending', ?3, 'form', ?4)`,
    ).bind(email, name || null, token, CONSENT_TEXT).run();
  }
  return { kind: 'confirm', token };
}

export async function subscriberByToken(db: D1Database, token: string) {
  if (!token || token.length < 20) return null;
  return db.prepare('SELECT id, email, name, status FROM newsletter_subscribers WHERE token = ?1')
    .bind(token).first<{ id: number; email: string; name: string | null; status: string }>();
}

/** The button in the confirm email. The token is kept: it is now the one in
 *  their unsubscribe link. */
export async function confirmSubscriber(db: D1Database, token: string): Promise<boolean> {
  const r = await db.prepare(
    `UPDATE newsletter_subscribers SET status = 'active', confirmed_at = datetime('now')
      WHERE token = ?1 AND status = 'pending'`,
  ).bind(token).run();
  return (r.meta?.changes ?? 0) > 0;
}

/** Off the list, and out of the database. */
export async function unsubscribe(db: D1Database, token: string): Promise<boolean> {
  if (!token || token.length < 20) return false;
  const r = await db.prepare('DELETE FROM newsletter_subscribers WHERE token = ?1').bind(token).run();
  return (r.meta?.changes ?? 0) > 0;
}

/**
 * The office adds people — one, or a pasted list. One per line, as
 * "Name, email", "Name <email>", or just the email.
 */
export function parseSubscriberList(text: string): { email: string; name: string }[] {
  const out: { email: string; name: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const found = line.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/);
    const email = usableEmail(found?.[0]);
    if (!email) continue;
    const name = line.replace(found![0], '').replace(/[<>,;"\t]/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ email, name });
  }
  return out;
}

export async function addByOffice(
  db: D1Database, people: { email: string; name: string }[], addedBy: number,
): Promise<{ added: number; already: number }> {
  let added = 0;
  let already = 0;
  const seen = new Set<string>();
  for (const p of people) {
    const k = p.email.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const existing = await db.prepare('SELECT id, status FROM newsletter_subscribers WHERE email = ?1')
      .bind(p.email).first<{ id: number; status: string }>();
    if (existing?.status === 'active') { already++; continue; }
    if (existing) {
      await db.prepare(
        `UPDATE newsletter_subscribers
            SET status = 'active', source = 'admin', consent_text = ?2, consent_at = datetime('now'),
                confirmed_at = datetime('now'), added_by = ?3, name = COALESCE(?4, name)
          WHERE id = ?1`,
      ).bind(existing.id, ADMIN_CONSENT_TEXT, addedBy, p.name || null).run();
    } else {
      await db.prepare(
        `INSERT INTO newsletter_subscribers (email, name, status, token, source, consent_text, confirmed_at, added_by)
         VALUES (?1, ?2, 'active', ?3, 'admin', ?4, datetime('now'), ?5)`,
      ).bind(p.email, p.name || null, newSessionId(), ADMIN_CONSENT_TEXT, addedBy).run();
    }
    added++;
  }
  return { added, already };
}
