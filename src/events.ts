import type { BookingRow, EventRow, FieldRow } from './views/events.js';
import { formatDate, formatSpan, lastDay } from './views/rota.js';
import { londonToday } from './views/calendar.js';

/** Events, their custom booking forms, and the bookings people make. */

/** A URL-safe slug, made unique by suffixing if it is already taken. */
export async function makeSlug(db: D1Database, title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'event';
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    const hit = await db.prepare('SELECT 1 FROM events WHERE slug = ?1').bind(slug).first();
    if (!hit) return slug;
  }
  // 50 events with the same name is not a real case, but never loop forever.
  return `${base}-${Date.now().toString(36)}`;
}

/** Capacity counts PEOPLE, not bookings: "how many are coming" is the catering
 *  question, and one booking can be a family of five. */
const COUNTS = `
  COALESCE((SELECT SUM(party_size) FROM event_bookings b
             WHERE b.event_id = e.id AND b.status = 'booked'), 0) AS booked,
  COALESCE((SELECT COUNT(*) FROM event_bookings b
             WHERE b.event_id = e.id AND b.status = 'booked'), 0) AS bookings
`;

export async function listEvents(db: D1Database): Promise<EventRow[]> {
  const { results } = await db
    .prepare(`SELECT e.*, ${COUNTS} FROM events e ORDER BY e.starts_at DESC`)
    .all<EventRow>();
  return results;
}

export async function getEvent(db: D1Database, id: number): Promise<EventRow | null> {
  return db.prepare(`SELECT e.*, ${COUNTS} FROM events e WHERE e.id = ?1`)
    .bind(id).first<EventRow>();
}

export async function getEventBySlug(db: D1Database, slug: string): Promise<EventRow | null> {
  return db.prepare(`SELECT e.*, ${COUNTS} FROM events e WHERE e.slug = ?1`)
    .bind(slug).first<EventRow>();
}

export async function listFields(db: D1Database, eventId: number): Promise<FieldRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM event_fields WHERE event_id = ?1 ORDER BY sort_order, id')
    .bind(eventId)
    .all<FieldRow>();
  return results;
}

/**
 * Every booking on an event, cancelled ones included.
 *
 * Cancelling keeps the row rather than deleting it. Someone rings the office to
 * pull out, and a fortnight later rings back asking whether they were ever on
 * the list — a row that says "cancelled" answers that, and a deleted row cannot.
 * It stays until somebody deletes it from the event's cancelled list, one at a
 * time or all at once, once that record is no longer wanted.
 * Only 'booked' rows count towards capacity, which is what COUNTS already does.
 */
export async function listBookings(db: D1Database, eventId: number): Promise<BookingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, email, phone, party_size, status, created_at
         FROM event_bookings WHERE event_id = ?1
        ORDER BY status = 'cancelled', created_at`,
    )
    .bind(eventId)
    .all<Omit<BookingRow, 'answers'>>();
  if (!results.length) return [];

  const { results: answers } = await db
    .prepare(
      `SELECT a.booking_id, a.field_id, a.value
         FROM event_booking_answers a
         JOIN event_bookings b ON b.id = a.booking_id
        WHERE b.event_id = ?1`,
    )
    .bind(eventId)
    .all<{ booking_id: number; field_id: number; value: string | null }>();

  const byBooking = new Map<number, Record<string, string>>();
  for (const a of answers) {
    const m = byBooking.get(a.booking_id) ?? {};
    m[String(a.field_id)] = a.value ?? '';
    byBooking.set(a.booking_id, m);
  }
  return results.map((b) => ({ ...b, answers: byBooking.get(b.id) ?? {} }));
}

/** One booking, for the page that amends it. */
export async function getBooking(
  db: D1Database,
  eventId: number,
  bookingId: number,
): Promise<BookingRow | null> {
  const row = await db
    .prepare(
      `SELECT id, name, email, phone, party_size, status, created_at
         FROM event_bookings WHERE id = ?1 AND event_id = ?2`,
    )
    .bind(bookingId, eventId)
    .first<Omit<BookingRow, 'answers'>>();
  if (!row) return null;

  const { results } = await db
    .prepare('SELECT field_id, value FROM event_booking_answers WHERE booking_id = ?1')
    .bind(bookingId)
    .all<{ field_id: number; value: string | null }>();

  const answers: Record<string, string> = {};
  for (const a of results) answers[String(a.field_id)] = a.value ?? '';
  return { ...row, answers };
}

/**
 * Write a booking the office has taken or amended over the phone.
 *
 * The answers are replaced wholesale rather than merged: the form always sends
 * every question, so a question the caller has now declined to answer has to be
 * able to go back to empty, and a merge could never clear one.
 */
export async function saveBooking(
  db: D1Database,
  opts: {
    eventId: number;
    bookingId?: number;
    booking: BookingAttempt;
    status: 'booked' | 'cancelled' | 'waitlist';
  },
): Promise<number> {
  const { eventId, bookingId, booking, status } = opts;
  let id = bookingId;

  if (id == null) {
    const res = await db
      .prepare(
        `INSERT INTO event_bookings (event_id, name, email, phone, party_size, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(eventId, booking.name, booking.email, booking.phone, booking.partySize, status)
      .run();
    id = Number(res.meta.last_row_id);
  } else {
    await db
      .prepare(
        `UPDATE event_bookings
            SET name = ?3, email = ?4, phone = ?5, party_size = ?6, status = ?7
          WHERE id = ?1 AND event_id = ?2`,
      )
      .bind(id, eventId, booking.name, booking.email, booking.phone, booking.partySize, status)
      .run();
    await db.prepare('DELETE FROM event_booking_answers WHERE booking_id = ?1').bind(id).run();
  }

  if (booking.answers.length) {
    const stmt = db.prepare(
      'INSERT INTO event_booking_answers (booking_id, field_id, value) VALUES (?1, ?2, ?3)',
    );
    await db.batch(booking.answers.map((a) => stmt.bind(id, a.fieldId, a.value)));
  }
  return id;
}

/** A stable key for a field, derived from its label. Used so exported answers
 *  have something readable in them rather than bare ids. */
export function fieldKey(label: string, existing: Set<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
  let key = base;
  let n = 2;
  while (existing.has(key)) key = `${base}_${n++}`;
  return key;
}

export interface BookingAttempt {
  name: string;
  email: string | null;
  phone: string | null;
  partySize: number;
  answers: { fieldId: number; value: string }[];
}

export function readBookingForm(
  form: FormData,
  fields: FieldRow[],
  /**
   * Who is filling this in. The same fields either way — only the wording
   * changes, because "please give your name" is nonsense on a screen where the
   * office is typing in somebody else's.
   */
  who: 'self' | 'office' = 'self',
  /** The most places one booking may take. The office is held only to 50. */
  maxParty = 50,
): { ok: true; value: BookingAttempt } | { ok: false; error: string } {
  const office = who === 'office';
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const name = s('name');
  const partySize = Number(form.get('party_size'));

  if (!name) {
    return { ok: false, error: office ? 'Give a name for this booking.' : 'Please give your name.' };
  }
  const most = office ? 50 : Math.min(50, Math.max(1, maxParty));
  if (!Number.isInteger(partySize) || partySize < 1) {
    return {
      ok: false,
      error: office
        ? 'How many people is this booking for? Give a number from 1 to 50.'
        : `How many of you are coming? Give a number from 1 to ${most}.`,
    };
  }
  if (partySize > most) {
    return {
      ok: false,
      error: office
        ? 'One booking can be for at most 50 people. Split a bigger group into two.'
        : `One booking can be for up to ${most} ${most === 1 ? 'person' : 'people'}. `
          + 'For a bigger group, please speak to the church office.',
    };
  }

  const answers: { fieldId: number; value: string }[] = [];
  for (const f of fields) {
    const v = s(`f_${f.id}`);
    // A required question stays required over the phone too, otherwise the
    // caterer gets a list with a blank where an allergy should be.
    if (f.required && !v) {
      return { ok: false, error: office ? `Still to answer: ${f.label}` : `Please answer: ${f.label}` };
    }
    if (v) answers.push({ fieldId: f.id, value: v });
  }
  return {
    ok: true,
    value: { name, email: s('email') || null, phone: s('phone') || null, partySize, answers },
  };
}

/**
 * Whether this booking still fits.
 *
 * Re-read at the moment of writing rather than trusting the number shown on the
 * page: two people can open the last place at the same time, and the second one
 * has to be told rather than quietly overbooking the caterer.
 */
export async function hasRoom(
  db: D1Database,
  eventId: number,
  partySize: number,
  /**
   * The booking being amended, whose own places must not be counted against it.
   * Without this, changing a party of two to a party of three would be measured
   * as though five people were coming, and a full event could never be edited
   * at all — not even to correct a spelling.
   */
  excludeBookingId?: number,
): Promise<{ ok: true } | { ok: false; left: number }> {
  const row = await db
    .prepare(
      `SELECT e.capacity,
              COALESCE((SELECT SUM(party_size) FROM event_bookings b
                         WHERE b.event_id = e.id AND b.status = 'booked'
                           AND b.id IS NOT ?2), 0) AS booked
         FROM events e WHERE e.id = ?1`,
    )
    .bind(eventId, excludeBookingId ?? null)
    .first<{ capacity: number | null; booked: number }>();
  if (!row || row.capacity == null) return { ok: true };
  const left = row.capacity - row.booked;
  return partySize <= left ? { ok: true } : { ok: false, left: Math.max(0, left) };
}

// ---------------------------------------------------------------------------
// Organisers
// ---------------------------------------------------------------------------

export interface OrganiserRow { id: number; name: string; email: string | null }

export async function listOrganisers(db: D1Database, eventId: number): Promise<OrganiserRow[]> {
  const { results } = await db
    .prepare('SELECT id, name, email FROM event_organisers WHERE event_id = ?1 ORDER BY sort_order, id')
    .bind(eventId)
    .all<OrganiserRow>();
  return results;
}

/**
 * The organisers from a submitted form: rows of organiser_name / organiser_email
 * in the order they were shown. A row left completely blank is ignored — the
 * form always shows one empty row to type into — but an email with no name is
 * refused, because "who is this?" is the first thing anybody reading it asks.
 */
export function readOrganisers(
  form: FormData,
  notify: boolean,
): { ok: true; value: { name: string; email: string | null }[] } | { ok: false; error: string } {
  const names = form.getAll('organiser_name').map((v) => String(v).trim());
  const emails = form.getAll('organiser_email').map((v) => String(v).trim());
  const out: { name: string; email: string | null }[] = [];
  for (let i = 0; i < Math.max(names.length, emails.length); i++) {
    const name = names[i] ?? '';
    const email = emails[i] ?? '';
    if (!name && !email) continue;
    if (!name) return { ok: false, error: `Give a name for the organiser with the email ${email}.` };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: `"${email}" does not look like an email address.` };
    }
    out.push({ name, email: email || null });
  }
  if (out.length > 10) return { ok: false, error: 'Ten organisers is the most one event can have.' };
  if (notify && !out.some((o) => o.email)) {
    return {
      ok: false,
      error: 'To email the organisers when somebody books, at least one of them needs an email address.',
    };
  }
  return { ok: true, value: out };
}

export async function saveOrganisers(
  db: D1Database,
  eventId: number,
  organisers: { name: string; email: string | null }[],
): Promise<void> {
  const stmt = db.prepare(
    'INSERT INTO event_organisers (event_id, name, email, sort_order) VALUES (?1, ?2, ?3, ?4)',
  );
  await db.batch([
    db.prepare('DELETE FROM event_organisers WHERE event_id = ?1').bind(eventId),
    ...organisers.map((o, i) => stmt.bind(eventId, o.name, o.email, i)),
  ]);
}

// ---------------------------------------------------------------------------
// Rooms held for an event
// ---------------------------------------------------------------------------

/** The rooms this event currently holds. */
export async function eventRoomIds(db: D1Database, eventId: number): Promise<number[]> {
  const { results } = await db
    .prepare(`SELECT DISTINCT room_id FROM room_bookings WHERE event_id = ?1 AND status = 'booked'`)
    .bind(eventId)
    .all<{ room_id: number }>();
  return results.map((r) => r.room_id);
}

export function readRoomIds(form: FormData): number[] {
  return [...new Set(form.getAll('room_ids').map(Number).filter(Number.isInteger))];
}

/**
 * Which of these rooms are already taken by something else in this window.
 *
 * The event's own holds are left out, so moving an event by half an hour is
 * not refused for clashing with itself. Touching at the boundary is not a
 * clash, the same rule as every other room booking.
 */
export async function eventRoomClashes(
  db: D1Database,
  roomIds: number[],
  times: Occurrence[],
  eventId?: number,
): Promise<{ room: string; title: string; starts_at: string; ends_at: string }[]> {
  if (!roomIds.length || !times.length) return [];
  // One query per time the event happens, sent together: a six-week course is
  // checked on each of its six evenings, not only the first.
  const stmt = db
    .prepare(
      `SELECT r.name AS room, b.title, b.starts_at, b.ends_at
         FROM room_bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.room_id IN (SELECT value FROM json_each(?1))
          AND b.status = 'booked'
          AND b.starts_at < ?3 AND b.ends_at > ?2
          AND (?4 IS NULL OR b.event_id IS NULL OR b.event_id <> ?4)
        ORDER BY r.sort_order, b.starts_at`,
    );
  const batched = await db.batch<{ room: string; title: string; starts_at: string; ends_at: string }>(
    times.map((t) => stmt.bind(JSON.stringify(roomIds), t.startsAt, t.endsAt, eventId ?? null)));
  // The same booking can clash with two of the times (a weekend away against a
  // daily club), so it is named once.
  const seen = new Set<string>();
  return batched.flatMap((b) => b.results ?? []).filter((c) => {
    const k = `${c.room}|${c.starts_at}|${c.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function describeClashes(
  clashes: { room: string; title: string; starts_at: string; ends_at: string }[],
): string {
  // A repeating event against a weekly group can clash on every one of its
  // dates; the first few say enough.
  const list = clashes.slice(0, 6)
    .map((c) => `${c.room} (${c.title}, ${formatSpan(c.starts_at, c.ends_at)})`)
    .join('; ') + (clashes.length > 6 ? `; and ${clashes.length - 6} more` : '');
  return `${clashes.length === 1 ? 'A room is' : 'Some rooms are'} already booked then: ${list}. `
    + `Untick ${clashes.length === 1 ? 'it' : 'them'}, change the time, or tick below to hold the rooms anyway.`;
}

/**
 * Makes the event's room holds match what was ticked: every ticked room, for
 * every time the event happens.
 *
 * Holds still wanted are MOVED rather than replaced — each room's holds, in
 * date order, onto the event's times in date order — so a note somebody added
 * to one on the room diary survives the event changing time. Holds no longer
 * wanted (a room unticked, or a course cut from six weeks to five) are
 * cancelled, not deleted, like every other room booking. Call
 * eventRoomClashes first: this writes without checking.
 */
export async function syncEventRooms(
  db: D1Database,
  opts: {
    eventId: number; roomIds: number[]; title: string;
    times: Occurrence[]; bookedBy: number;
  },
): Promise<void> {
  const { eventId, roomIds, title, times, bookedBy } = opts;
  const { results: held } = await db
    .prepare(`SELECT id, room_id FROM room_bookings WHERE event_id = ?1 AND status = 'booked'
               ORDER BY starts_at, id`)
    .bind(eventId)
    .all<{ id: number; room_id: number }>();

  const stmts: D1PreparedStatement[] = [];
  const move = db.prepare('UPDATE room_bookings SET title = ?2, starts_at = ?3, ends_at = ?4 WHERE id = ?1');
  const cancel = db.prepare(`UPDATE room_bookings SET status = 'cancelled' WHERE id = ?1`);
  const insert = db.prepare(
    `INSERT INTO room_bookings (room_id, title, starts_at, ends_at, booked_by, notes, event_id)
     VALUES (?1, ?2, ?3, ?4, ?5, 'Held for an event', ?6)`,
  );
  for (const h of held) {
    if (!roomIds.includes(h.room_id)) stmts.push(cancel.bind(h.id));
  }
  for (const r of roomIds) {
    const mine = held.filter((h) => h.room_id === r);
    times.forEach((t, i) => {
      const h = mine[i];
      stmts.push(h
        ? move.bind(h.id, title, t.startsAt, t.endsAt)
        : insert.bind(r, title, t.startsAt, t.endsAt, bookedBy, eventId));
    });
    for (const h of mine.slice(times.length)) stmts.push(cancel.bind(h.id));
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
}

// ---------------------------------------------------------------------------
// Events that happen more than once (migrations/0031)
// ---------------------------------------------------------------------------

export type RepeatFreq = 'daily' | 'weekly' | 'fortnightly';

export const EVENT_REPEATS: { value: RepeatFreq; label: string; days: number }[] = [
  { value: 'daily', label: 'Every day', days: 1 },
  { value: 'weekly', label: 'Every week', days: 7 },
  { value: 'fortnightly', label: 'Every two weeks', days: 14 },
];

/** A year of weekly sessions; more is almost certainly a typing slip. */
export const MAX_REPEAT_COUNT = 52;

export interface EventRepeat { freq: RepeatFreq; count: number }
export interface Occurrence { startsAt: string; endsAt: string }

/** An event's own repeat, or null when it happens once (or the row is odd). */
export function repeatOf(e: { repeat_freq?: string | null; repeat_count?: number | null }): EventRepeat | null {
  const r = EVENT_REPEATS.find((x) => x.value === e.repeat_freq);
  const n = Number(e.repeat_count);
  return r && Number.isInteger(n) && n >= 2 && n <= MAX_REPEAT_COUNT ? { freq: r.value, count: n } : null;
}

/** 'YYYY-MM-DDTHH:MM' moved on by whole days, the wall-clock time kept. */
function shiftDays(iso: string, days: number): string {
  const d = new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + days * 86_400_000);
  return d.toISOString().slice(0, 10) + iso.slice(10);
}

/** Every time the event happens: the first, then the same times moved on. */
export function eventOccurrences(startsAt: string, endsAt: string, repeat: EventRepeat | null): Occurrence[] {
  if (!repeat) return [{ startsAt, endsAt }];
  const step = EVENT_REPEATS.find((x) => x.value === repeat.freq)!.days;
  return Array.from({ length: repeat.count }, (_, i) => ({
    startsAt: shiftDays(startsAt, i * step), endsAt: shiftDays(endsAt, i * step),
  }));
}

/**
 * The repeat from an event's form, or null for "just once".
 *
 * Refused when one time would run into the next — an overnight event "every
 * day" — since every room would then be held twice over, and nobody means it.
 */
export function readEventRepeat(
  form: FormData,
  startsAt: string,
  endsAt: string | null,
): { ok: true; value: EventRepeat | null } | { ok: false; error: string } {
  const freq = EVENT_REPEATS.find((x) => x.value === String(form.get('repeat') ?? ''));
  if (!freq) return { ok: true, value: null };
  const n = Number(String(form.get('repeat_count') ?? '').trim());
  if (!Number.isInteger(n) || n < 2 || n > MAX_REPEAT_COUNT) {
    return { ok: false, error: `Say how many times it happens, from 2 to ${MAX_REPEAT_COUNT} — the first one included.` };
  }
  if (!endsAt) return { ok: false, error: 'Give a finish time, so each time it happens has an end.' };
  const end = Date.parse(`${endsAt}:00Z`);
  const nextStart = Date.parse(`${shiftDays(startsAt, freq.days)}:00Z`);
  if (end > nextStart) {
    return { ok: false, error: `Each time runs into the next: it finishes after it starts again ${freq.label.toLowerCase()}.` };
  }
  return { ok: true, value: { freq: freq.value, count: n } };
}

/** "Every week, 6 times: Wed 21 Jan 2026 to Wed 25 Feb 2026", or '' for once. */
export function describeRepeat(e: {
  starts_at: string; ends_at: string | null; repeat_freq?: string | null; repeat_count?: number | null;
}): string {
  const r = repeatOf(e);
  if (!r) return '';
  const times = eventOccurrences(e.starts_at, e.ends_at ?? e.starts_at, r);
  const label = EVENT_REPEATS.find((x) => x.value === r.freq)!.label;
  return `${label}, ${r.count} times: ${formatDate(times[0]!.startsAt.slice(0, 10))} to `
    + `${formatDate(times[times.length - 1]!.startsAt.slice(0, 10))}`;
}

/** When an event runs, in words, its repeat included. */
export function eventWhenText(e: {
  starts_at: string; ends_at: string | null; repeat_freq?: string | null; repeat_count?: number | null;
}): string {
  const once = formatSpan(e.starts_at, e.ends_at);
  const rep = describeRepeat(e);
  return rep ? `${once} — ${rep[0]!.toLowerCase()}${rep.slice(1)}` : once;
}

// ---------------------------------------------------------------------------
// When an event runs
// ---------------------------------------------------------------------------

/** The longest an event may run. A weekend away is three days; a fortnight
 *  allows a holiday club. Much past that is almost always a mistyped year, and
 *  it would hold every ticked room for the whole of it. */
export const MAX_EVENT_DAYS = 14;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/**
 * The start and finish of an event, from its form.
 *
 * The finish date defaults to the start date, so a form that only sends a
 * finish time — or an older page still open in somebody's browser — means
 * "the same day", which is what it always meant.
 */
export function readEventWhen(
  form: FormData,
  endRequired: boolean,
): { ok: true; startsAt: string; endsAt: string | null } | { ok: false; error: string } {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const onDate = s('on_date');
  const startTime = s('start_time');
  const endTime = s('end_time');
  const endDate = s('end_date') || onDate;

  if (!DATE.test(onDate) || !TIME.test(startTime)) {
    return { ok: false, error: 'Give the date and time it starts.' };
  }
  if (!endTime) {
    if (endRequired) return { ok: false, error: 'Give the time it finishes.' };
    // A finish date moved to a later day but no time given is somebody part
    // way through saying it runs over — dropping the date silently would lose
    // exactly the thing they meant to change.
    if (s('end_date') && s('end_date') !== onDate) {
      return { ok: false, error: 'Give the time it finishes on that day.' };
    }
    return { ok: true, startsAt: `${onDate}T${startTime}`, endsAt: null };
  }
  if (!DATE.test(endDate) || !TIME.test(endTime)) {
    return { ok: false, error: 'Give the date and time it finishes.' };
  }

  const startsAt = `${onDate}T${startTime}`;
  const endsAt = `${endDate}T${endTime}`;
  if (endDate < onDate) {
    return { ok: false, error: 'The finish date is before the start date.' };
  }
  if (endsAt <= startsAt) {
    return {
      ok: false,
      error: endDate === onDate
        ? 'It has to finish after it starts. If it runs past midnight, set the finish date to the next day.'
        : 'It has to finish after it starts.',
    };
  }
  // Counted in calendar days, Saturday to Sunday being two — the same way the
  // message counts them — up to the last REAL day, so a midnight finish is not
  // an extra day here when it is not one anywhere else.
  const last = lastDay(startsAt, endsAt);
  const days = (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${onDate}T00:00:00Z`)) / 86_400_000 + 1;
  if (days > MAX_EVENT_DAYS) {
    return {
      ok: false,
      error: `That would run for ${days} days. An event can run for up to ${MAX_EVENT_DAYS} — `
        + 'check the year on the finish date.',
    };
  }
  return { ok: true, startsAt, endsAt };
}

// ---------------------------------------------------------------------------
// Whether bookings are still being taken
// ---------------------------------------------------------------------------

/** The wall-clock time in the church's timezone, as 'YYYY-MM-DDTHH:MM' — the
 *  shape event times are stored in, so the two compare as text. */
export function londonNow(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${londonToday(now)}T${get('hour')}:${get('minute')}`;
}

/**
 * Why an event is no longer taking bookings, or null while it is.
 *
 *   'finished'  its last time is over — the end of the last session of a
 *               repeating event; an old event with no finish time is taken to
 *               run to the end of its day
 *   'deadline'  the "bookings close" date chosen for it has passed
 *
 * Whether it is published is a separate question: an unpublished event is
 * not taking bookings either, but for a reason somebody chose.
 */
export function bookingsClosed(
  e: { starts_at: string; ends_at: string | null; booking_closes_at: string | null;
       repeat_freq?: string | null; repeat_count?: number | null },
  now: Date = new Date(),
): 'finished' | 'deadline' | null {
  const end = e.ends_at ?? `${e.starts_at.slice(0, 10)}T23:59`;
  const last = eventOccurrences(e.starts_at, end, repeatOf(e)).at(-1)!;
  if (last.endsAt <= londonNow(now)) return 'finished';
  if (e.booking_closes_at && londonToday(now) > e.booking_closes_at) return 'deadline';
  return null;
}
