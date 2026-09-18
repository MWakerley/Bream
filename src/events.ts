import type { BookingRow, EventRow, FieldRow } from './views/events.js';

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
 * Cancellations are kept rather than deleted. Someone rings the office to pull
 * out, and a fortnight later rings back asking whether they were ever on the
 * list — a row that says "cancelled" answers that, and a deleted row cannot.
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
): { ok: true; value: BookingAttempt } | { ok: false; error: string } {
  const office = who === 'office';
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const name = s('name');
  const partySize = Number(form.get('party_size'));

  if (!name) {
    return { ok: false, error: office ? 'Give a name for this booking.' : 'Please give your name.' };
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    return {
      ok: false,
      error: office
        ? 'How many people is this booking for? Give a number from 1 to 50.'
        : 'How many of you are coming? Give a number from 1 to 50.',
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
