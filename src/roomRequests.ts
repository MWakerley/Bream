import { findClashes, planSeries } from './rooms.js';
import { FREQUENCIES, type Frequency } from './recurrence.js';
import { formatDate } from './views/rota.js';

/**
 * Requests to book a room, made from the public form.
 *
 * A request is held on the diary as tentative room_bookings rows the moment it
 * is made — see migration 0025 for why the hold is an ordinary booking row —
 * and waits on the Rooms page for somebody to approve or decline it.
 */

export interface FormSettings {
  is_open: number;
  intro: string | null;
  notify_email: string | null;
  min_days_notice: number;
  max_days_ahead: number;
  allow_repeating: number;
}

export async function loadFormSettings(db: D1Database): Promise<FormSettings> {
  const row = await db.prepare(
    `SELECT is_open, intro, notify_email, min_days_notice, max_days_ahead, allow_repeating
       FROM room_form_settings WHERE id = 1`,
  ).first<FormSettings>();
  // Closed if the row is somehow missing: a public form must fail shut.
  return row ?? {
    is_open: 0, intro: null, notify_email: null, min_days_notice: 2, max_days_ahead: 180, allow_repeating: 1,
  };
}

export interface PublicRoom { id: number; name: string; capacity: number | null; notes: string | null }

/** The rooms that may be asked for from outside. */
export async function listPublicRooms(db: D1Database): Promise<PublicRoom[]> {
  const { results } = await db.prepare(
    `SELECT id, name, capacity, notes FROM rooms
      WHERE is_active = 1 AND public_booking = 1 ORDER BY sort_order, name`,
  ).all<PublicRoom>();
  return results;
}

/**
 * When a room is taken, and nothing else about it.
 *
 * This is what the public page sees, so it carries no titles, no names and no
 * contact details — only whether each stretch is booked or held for a request
 * still being decided. Somebody choosing a time needs to know it is taken, not
 * who by.
 */
export async function busyBetween(
  db: D1Database,
  roomId: number,
  from: string,
  to: string,
): Promise<{ starts_at: string; ends_at: string; tentative: number }[]> {
  const { results } = await db.prepare(
    `SELECT starts_at, ends_at, is_tentative AS tentative
       FROM room_bookings
      WHERE room_id = ?1 AND status = 'booked'
        AND starts_at < ?3 AND ends_at > ?2
      ORDER BY starts_at`,
  ).bind(roomId, from, to).all<{ starts_at: string; ends_at: string; tentative: number }>();
  return results;
}

export interface RequestInput {
  roomId: number;
  onDate: string;
  fromTime: string;
  toTime: string;
  freq: Frequency | null;
  untilDate: string | null;
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  purpose: string;
  people: number;
  isMember: boolean;
  /** Null for a member, whose cover is the church's own. */
  hasInsurance: boolean | null;
  notes: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Real clock times only. The browser's time box already limits them, but a
// public form has to be right about whatever arrives, however it was sent.
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** A date that really exists: 2026-02-31 parses, but not back to itself. */
const realDate = (d: string) =>
  DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))
  && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** One line of text: a name or a purpose never needs a line break, and one in
 *  an email subject would be trouble. */
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** The most occurrences one repeating request may hold: a year of weekly. */
export const MAX_REQUEST_OCCURRENCES = 52;
/** The longest single booking the form will hold. Anything longer is a
 *  conversation with the office, not a form. */
export const MAX_HOURS = 12;
/**
 * Limits on how much of the diary requests may hold while they wait.
 *
 * Without them one person, inventing a new email address each time, could
 * hold every public room all day for months — and every hold blocks the
 * office's own bookings until somebody declines it. Per address, per
 * connection, and overall.
 */
export const LIMITS = { perEmail: 3, perConnection: 3, heldOverall: 300 };

/**
 * A request from the public form, checked.
 *
 * Every rule is re-checked here even where the page already enforces it: the
 * form is public, so anything the page promises has to be true of whatever
 * arrives, however it was sent.
 */
export function readRequest(
  form: FormData,
  settings: FormSettings,
  rooms: PublicRoom[],
  today: string,
): { ok: true; value: RequestInput } | { ok: false; error: string } {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const bad = (error: string) => ({ ok: false as const, error });

  const roomId = Number(s('room_id'));
  if (!rooms.some((r) => r.id === roomId)) return bad('Choose one of the rooms listed.');

  const onDate = s('on_date');
  const fromTime = s('from_time');
  const toTime = s('to_time');
  if (!realDate(onDate)) return bad('Choose the date you would like.');
  if (!TIME.test(fromTime) || !TIME.test(toTime)) return bad('Give a start and a finish time.');
  if (toTime <= fromTime) return bad('The finish time has to be after the start time.');
  if (minutes(toTime) - minutes(fromTime) > MAX_HOURS * 60) {
    return bad(`A booking here can be up to ${MAX_HOURS} hours. For anything longer, please ring the church office.`);
  }

  const earliest = addDays(today, settings.min_days_notice);
  const latest = addDays(today, settings.max_days_ahead);
  if (onDate < earliest) {
    return bad(settings.min_days_notice > 0
      ? `Please ask at least ${settings.min_days_notice} day${settings.min_days_notice === 1 ? '' : 's'} ahead. For anything sooner, ring the church office.`
      : 'That date has already gone.');
  }
  if (onDate > latest) return bad(`We take requests up to ${settings.max_days_ahead} days ahead.`);

  let freq: Frequency | null = null;
  let untilDate: string | null = null;
  const repeat = s('repeat');
  if (repeat) {
    if (!settings.allow_repeating) return bad('Repeating bookings cannot be asked for here — please ring the church office.');
    if (!FREQUENCIES.some((f) => f.value === repeat)) return bad('That repeat pattern was not recognised.');
    freq = repeat as Frequency;
    untilDate = s('until');
    if (!realDate(untilDate) || untilDate < onDate) return bad('Give the date the repeating booking should end.');
    if (untilDate > latest) return bad(`A repeating booking can run up to ${settings.max_days_ahead} days ahead.`);
  }

  const name = oneLine(s('name'));
  const email = s('email');
  const purpose = oneLine(s('purpose'));
  const people = Number(s('people'));
  if (!name) return bad('Please give your name.');
  if (!EMAIL.test(email)) return bad('Please give an email address — it is how we will reply.');
  if (!purpose) return bad('Please say what the booking is for.');
  if (!Number.isInteger(people) || people < 1 || people > 1000) return bad('How many people will there be? Give a number.');

  const member = s('is_member');
  if (member !== '1' && member !== '0') return bad('Please say whether you are a member of Bream Church.');
  const isMember = member === '1';
  let hasInsurance: boolean | null = null;
  if (!isMember) {
    const ins = s('has_insurance');
    if (ins !== '1' && ins !== '0') return bad('Please say whether you have public liability insurance.');
    hasInsurance = ins === '1';
  }

  const cap = (v: string, n: number) => (v ? v.slice(0, n) : null);
  return {
    ok: true,
    value: {
      roomId, onDate, fromTime, toTime, freq, untilDate,
      name: name.slice(0, 120), email: email.slice(0, 200), phone: cap(oneLine(s('phone')), 40),
      organisation: cap(oneLine(s('organisation')), 120), purpose: purpose.slice(0, 200), people,
      isMember, hasInsurance, notes: cap(s('notes'), 2000),
    },
  };
}

/** A one-way hash of the connection's address, for the per-connection limit.
 *  Salted so the stored value is no use for looking anybody up elsewhere. */
export async function hashAddress(ip: string | undefined): Promise<string | null> {
  if (!ip) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bream-room-requests:${ip}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export type CreateResult =
  | { ok: true; requestId: number; receipt: string; held: string[]; clashDates: string[] }
  | { ok: false; error: string };

/**
 * Makes the request and holds its time.
 *
 * A one-off that clashes is refused, so the person can pick another time while
 * they are still on the page. A repeating request keeps the dates that are free
 * and names the ones that are not — the same rule the office's own repeating
 * bookings follow — and is refused only if every date is taken, or if it would
 * hold more dates than a request may.
 *
 * The request and its holds are written in ONE batch, which D1 runs as a
 * single transaction: a request is never left without its holds, nor holds
 * without their request.
 */
export async function createRequest(
  db: D1Database,
  v: RequestInput,
  ipHash: string | null,
): Promise<CreateResult> {
  // The limits first, so a flood is turned away before any work is done.
  const load = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM room_requests WHERE status = 'pending' AND lower(email) = lower(?1)) AS by_email,
       (SELECT COUNT(*) FROM room_requests WHERE status = 'pending' AND ?2 IS NOT NULL AND ip_hash = ?2) AS by_ip,
       (SELECT COUNT(*) FROM room_bookings WHERE is_tentative = 1 AND status = 'booked') AS held`,
  ).bind(v.email, ipHash).first<{ by_email: number; by_ip: number; held: number }>();
  if ((load?.by_email ?? 0) >= LIMITS.perEmail || (load?.by_ip ?? 0) >= LIMITS.perConnection) {
    return { ok: false, error: `You already have ${LIMITS.perEmail} requests waiting for an answer. `
      + 'Please wait to hear about those, or ring the church office.' };
  }

  let dates: string[];
  let clashDates: string[] = [];
  if (v.freq && v.untilDate) {
    const plan = await planSeries(db, v.roomId, v.onDate, v.untilDate, v.freq, v.fromTime, v.toTime);
    // Refused rather than quietly cut short: a request that silently lost its
    // last dates would still say "until" a date it no longer reaches.
    if (plan.truncated || plan.dates.length + plan.clashes.length > MAX_REQUEST_OCCURRENCES) {
      const all = [...plan.dates, ...plan.clashes.map((c) => c.date)].sort();
      const lastAllowed = all[MAX_REQUEST_OCCURRENCES - 1];
      return { ok: false, error: `A repeating request can cover up to ${MAX_REQUEST_OCCURRENCES} dates`
        + (lastAllowed ? ` — please end it on or before ${formatDate(lastAllowed)}.` : '.') };
    }
    dates = plan.dates;
    clashDates = plan.clashes.map((c) => c.date);
    if (!dates.length) {
      return { ok: false, error: plan.clashes.length
        ? 'Every one of those dates is already taken. Please try another time or day.'
        : 'That pattern gives no dates. Check the dates and try again.' };
    }
  } else {
    const clashes = await findClashes(db, v.roomId, `${v.onDate}T${v.fromTime}`, `${v.onDate}T${v.toTime}`);
    if (clashes.length) {
      return { ok: false, error: 'Sorry — that room is already taken for some or all of that time. The calendar shows when it is free.' };
    }
    dates = [v.onDate];
  }
  if ((load?.held ?? 0) + dates.length > LIMITS.heldOverall) {
    return { ok: false, error: 'We have a lot of requests waiting to be answered just now. '
      + 'Please try again in a few days, or ring the church office.' };
  }

  const receipt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const title = v.organisation ? `${v.purpose} (${v.organisation})` : v.purpose;
  const contact = [v.name, v.phone ?? v.email].filter(Boolean).join(' · ');
  // Found by its receipt, not by "the newest request", so another request
  // arriving in the same instant can never be linked to these holds.
  const hold = db.prepare(
    `INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, is_tentative, request_id)
     VALUES (?1, ?2, ?3, ?4, ?5, 'Asked for online — waiting to be approved', 1,
             (SELECT id FROM room_requests WHERE receipt = ?6))`,
  );
  await db.batch([
    db.prepare(
      `INSERT INTO room_requests
         (room_id, name, email, phone, organisation, purpose, people, is_member, has_insurance, notes,
          starts_at, ends_at, freq, until_date, clash_dates, ip_hash, receipt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
    ).bind(v.roomId, v.name, v.email, v.phone, v.organisation, v.purpose, v.people,
      v.isMember ? 1 : 0, v.hasInsurance == null ? null : v.hasInsurance ? 1 : 0, v.notes,
      `${dates[0]}T${v.fromTime}`, `${dates[0]}T${v.toTime}`, v.freq, v.untilDate,
      clashDates.length ? JSON.stringify(clashDates) : null, ipHash, receipt),
    ...dates.map((d) => hold.bind(v.roomId, title, `${d}T${v.fromTime}`, `${d}T${v.toTime}`, contact, receipt)),
  ]);
  const made = await db.prepare('SELECT id FROM room_requests WHERE receipt = ?1').bind(receipt).first<{ id: number }>();
  return { ok: true, requestId: made?.id ?? 0, receipt, held: dates, clashDates };
}

export interface RequestRow {
  id: number;
  room_id: number;
  room_name: string;
  room_capacity: number | null;
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  purpose: string;
  people: number;
  is_member: number;
  has_insurance: number | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  freq: Frequency | null;
  until_date: string | null;
  clash_dates: string | null;
  status: 'pending' | 'approved' | 'declined';
  receipt: string | null;
  created_at: string;
  /** Occurrences still held for it. */
  held: number;
  /** The last date still held, for "until" in what is said about it. */
  last_held: string | null;
  /**
   * Other bookings that now overlap its held dates — somebody may have held
   * the room anyway for an event since. Approving would double-book, so the
   * dashboard says so and approval has to be confirmed.
   */
  clashes_now: number;
}

const REQUEST_SELECT = `
  SELECT q.*, r.name AS room_name, r.capacity AS room_capacity,
         (SELECT COUNT(*) FROM room_bookings b
           WHERE b.request_id = q.id AND b.status = 'booked') AS held,
         (SELECT MAX(substr(b.starts_at, 1, 10)) FROM room_bookings b
           WHERE b.request_id = q.id AND b.status = 'booked') AS last_held,
         (SELECT COUNT(*) FROM room_bookings h JOIN room_bookings o
             ON o.room_id = h.room_id AND o.status = 'booked'
            AND (o.request_id IS NULL OR o.request_id <> h.request_id)
            AND o.starts_at < h.ends_at AND o.ends_at > h.starts_at
           WHERE h.request_id = q.id AND h.status = 'booked') AS clashes_now
    FROM room_requests q JOIN rooms r ON r.id = q.room_id`;

/** Requests still waiting. Capped, so the Rooms page can never become
 *  enormous; the limits above keep the real number far lower. */
export async function listPendingRequests(db: D1Database, limit = 50): Promise<RequestRow[]> {
  const { results } = await db.prepare(
    `${REQUEST_SELECT} WHERE q.status = 'pending' ORDER BY q.starts_at, q.created_at LIMIT ?1`,
  ).bind(limit).all<RequestRow>();
  return results;
}

export async function getRequest(db: D1Database, id: number): Promise<RequestRow | null> {
  return db.prepare(`${REQUEST_SELECT} WHERE q.id = ?1`).bind(id).first<RequestRow>();
}

export async function getRequestByReceipt(db: D1Database, receipt: string): Promise<RequestRow | null> {
  return db.prepare(`${REQUEST_SELECT} WHERE q.receipt = ?1`).bind(receipt).first<RequestRow>();
}

export type Decision =
  | { ok: true; request: RequestRow }
  | { ok: false; why: 'gone' | 'clashes'; clashes?: number };

/**
 * Approves a request: its held dates become ordinary bookings.
 *
 * A repeating request becomes a repeating booking only now, so a request that
 * is declined never appears among the church's repeating bookings.
 *
 * Everything is one batch — one transaction — with every statement guarded on
 * the request still being pending and the status change LAST. Two people
 * pressing Approve at once cannot both act, and a failure part-way can never
 * leave a request marked approved with its dates still tentative.
 *
 * If something has since been booked over its held dates (an event holding the
 * room anyway, say), approval is refused unless `anyway` is given.
 *
 * Approving never makes a booking private: is_private is left at 0, on the
 * dates and on any series, so the room diary on the website says what an
 * approved booking is for. Somebody can still tick "Private booking" on it
 * afterwards, as on any other booking.
 */
export async function approveRequest(db: D1Database, id: number, by: number, anyway = false): Promise<Decision> {
  const req = await getRequest(db, id);
  if (!req || req.status !== 'pending') return { ok: false, why: 'gone' };
  if (req.clashes_now > 0 && !anyway) return { ok: false, why: 'clashes', clashes: req.clashes_now };

  const pending = `EXISTS (SELECT 1 FROM room_requests WHERE id = ?1 AND status = 'pending')`;
  const stmts: D1PreparedStatement[] = [];
  const repeating = !!(req.freq && req.until_date);
  if (repeating) {
    const title = req.organisation ? `${req.purpose} (${req.organisation})` : req.purpose;
    // The series ends on the last date actually held, not the date asked for,
    // so it never claims weeks it does not have.
    stmts.push(db.prepare(
      `INSERT INTO room_booking_series
         (room_id, title, contact, notes, freq, from_date, until_date, from_time, to_time, created_by)
       SELECT ?2, ?3, ?4, 'Asked for online', ?5, ?6, ?7, ?8, ?9, ?10 WHERE ${pending}`,
    ).bind(id, req.room_id, title, [req.name, req.phone ?? req.email].join(' · '), req.freq,
      req.starts_at.slice(0, 10), req.last_held ?? req.until_date, req.starts_at.slice(11, 16),
      req.ends_at.slice(11, 16), by));
  }
  stmts.push(db.prepare(
    `UPDATE room_bookings
        SET is_tentative = 0, booked_by = ?2, notes = 'Asked for online',
            series_id = CASE WHEN ?3 = 1
              THEN (SELECT MAX(id) FROM room_booking_series WHERE room_id = room_bookings.room_id AND created_by = ?2)
              ELSE series_id END
      WHERE request_id = ?1 AND status = 'booked' AND ${pending}`,
  ).bind(id, by, repeating ? 1 : 0));
  stmts.push(db.prepare(
    `UPDATE room_requests SET status = 'approved', decided_at = datetime('now'), decided_by = ?2
      WHERE id = ?1 AND status = 'pending'`,
  ).bind(id, by));
  const res = await db.batch(stmts);
  if (!res.at(-1)?.meta.changes) return { ok: false, why: 'gone' };
  return { ok: true, request: { ...req, status: 'approved' } };
}

/**
 * Declines a request and lets its held dates go. One transaction, status last,
 * as for approving. The held rows lose their tentative mark as they are
 * cancelled, so nothing afterwards mistakes them for a request still waiting.
 */
export async function declineRequest(
  db: D1Database, id: number, by: number, note: string | null,
): Promise<Decision> {
  const req = await getRequest(db, id);
  if (!req || req.status !== 'pending') return { ok: false, why: 'gone' };
  const res = await db.batch([
    db.prepare(
      `UPDATE room_bookings SET status = 'cancelled', is_tentative = 0
        WHERE request_id = ?1 AND is_tentative = 1
          AND EXISTS (SELECT 1 FROM room_requests WHERE id = ?1 AND status = 'pending')`,
    ).bind(id),
    db.prepare(
      `UPDATE room_requests
          SET status = 'declined', decided_at = datetime('now'), decided_by = ?2, decision_note = ?3
        WHERE id = ?1 AND status = 'pending'`,
    ).bind(id, by, note),
  ]);
  if (!res.at(-1)?.meta.changes) return { ok: false, why: 'gone' };
  return { ok: true, request: { ...req, status: 'declined' } };
}

/** How a request's timing reads: one date, or the pattern and how many. */
export function describeRequestWhen(
  r: Pick<RequestRow, 'starts_at' | 'ends_at' | 'freq' | 'until_date'> & { last_held?: string | null },
  held?: number,
) {
  const times = `${r.starts_at.slice(11, 16)}–${r.ends_at.slice(11, 16)}`;
  if (!r.freq) return { first: r.starts_at.slice(0, 10), times, pattern: null as string | null, held };
  const label = FREQUENCIES.find((f) => f.value === r.freq)?.label ?? r.freq;
  const until = r.last_held ?? r.until_date;
  return { first: r.starts_at.slice(0, 10), times, pattern: `${label} until ${until ? formatDate(until) : '—'}`, held };
}

// ---------------------------------------------------------------------------
// The emails
// ---------------------------------------------------------------------------

/** How a request's dates read in an email. */
function datesLine(r: { starts_at: string; ends_at: string; freq: Frequency | null; until_date: string | null }, held: unknown[]) {
  const times = `${r.starts_at.slice(11, 16)}–${r.ends_at.slice(11, 16)}`;
  if (!r.freq) return `${formatDate(r.starts_at.slice(0, 10))}, ${times}`;
  const label = FREQUENCIES.find((f) => f.value === r.freq)?.label.toLowerCase() ?? r.freq;
  return `${label}, ${times}, from ${formatDate(r.starts_at.slice(0, 10))} until ${formatDate(r.until_date!)}`
    + (held.length ? ` (${held.length} date${held.length === 1 ? '' : 's'})` : '');
}

export interface RequestEmail { to: string; subject: string; body: string }

/** To the person asking: we have it, it is not confirmed yet. */
export function receivedEmail(v: RequestInput, roomName: string, held: string[], clashDates: string[]): RequestEmail {
  const first = { starts_at: `${held[0]}T${v.fromTime}`, ends_at: `${held[0]}T${v.toTime}`, freq: v.freq, until_date: held.at(-1) ?? v.untilDate };
  return {
    to: v.email,
    subject: `We have your request for the ${roomName}`,
    body: [
      `Dear ${v.name},`,
      '',
      `Thank you for asking to book the ${roomName} for ${v.purpose}: ${datesLine(first, held)}.`,
      '',
      'This is not confirmed yet. We are holding the time for you while we decide, and will email again to confirm.',
      ...(clashDates.length
        ? ['', `These dates were already taken, so they are not part of your request: ${clashDates.map(formatDate).join(', ')}.`]
        : []),
      '',
      'Bream Church',
    ].join('\n'),
  };
}

/** To the office: somebody has asked. */
export function officeEmail(v: RequestInput, roomName: string, held: string[], adminUrl: string, to: string): RequestEmail {
  const first = { starts_at: `${held[0]}T${v.fromTime}`, ends_at: `${held[0]}T${v.toTime}`, freq: v.freq, until_date: held.at(-1) ?? v.untilDate };
  return {
    to,
    subject: `Room request: ${roomName}, ${formatDate(held[0]!)} — ${v.name}`,
    body: [
      `${v.name} has asked to book the ${roomName}.`,
      '',
      `When: ${datesLine(first, held)}`,
      `For: ${v.purpose}${v.organisation ? ` (${v.organisation})` : ''}, ${v.people} people`,
      `Member of Bream Church: ${v.isMember ? 'yes' : 'no'}`,
      ...(v.isMember ? [] : [`Public liability insurance: ${v.hasInsurance ? 'yes' : 'NO'}`]),
      `Email: ${v.email}${v.phone ? `   Phone: ${v.phone}` : ''}`,
      ...(v.notes ? ['', v.notes] : []),
      '',
      `The time is held as tentative. Approve or decline it here: ${adminUrl}`,
    ].join('\n'),
  };
}

/** To the person asking, once somebody has decided. */
export function decisionEmail(r: RequestRow, approved: boolean, note: string | null): RequestEmail {
  const line = datesLine({ ...r, until_date: r.last_held ?? r.until_date }, Array.from({ length: r.held }));
  return {
    to: r.email,
    subject: approved
      ? `Confirmed: the ${r.room_name} for ${r.purpose}`
      : `Your request for the ${r.room_name}`,
    body: [
      `Dear ${r.name},`,
      '',
      approved
        ? `Good news — your booking of the ${r.room_name} for ${r.purpose} is confirmed: ${line}.`
        : `Thank you for asking to book the ${r.room_name} for ${r.purpose} (${line}). I am sorry to say we cannot take the booking this time, and the time is no longer held.`,
      ...(note ? ['', note] : []),
      '',
      'Bream Church',
    ].join('\n'),
  };
}
