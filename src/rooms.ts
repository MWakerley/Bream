import type { BookingRow, RoomRow } from './views/rooms.js';
import { expandSeries, type Frequency } from './recurrence.js';
import { shiftMonth } from './views/calendar.js';

/**
 * Room bookings.
 *
 * Overlap is checked here rather than by a constraint: SQLite has no exclusion
 * constraint, and a trigger would make amending a booking fail against itself.
 * The check is one indexed range scan thanks to room_bookings_window.
 */

export async function listRooms(db: D1Database): Promise<RoomRow[]> {
  const { results } = await db
    .prepare('SELECT id, name, capacity, notes FROM rooms WHERE is_active = 1 ORDER BY sort_order, name')
    .all<RoomRow>();
  return results;
}

export async function listBookings(
  db: D1Database,
  fromDate: string,
  days = 28,
): Promise<BookingRow[]> {
  const to = new Date(new Date(`${fromDate}T00:00:00Z`).getTime() + days * 86_400_000)
    .toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT b.id, b.room_id, r.name AS room_name, b.title, b.starts_at, b.ends_at,
              b.contact, b.notes, b.status, b.series_id, b.event_id, b.is_tentative, b.request_id,
              p.display_name AS booked_by_name
         FROM room_bookings b
         JOIN rooms r ON r.id = b.room_id
         LEFT JOIN people p ON p.id = b.booked_by
        WHERE b.status = 'booked'
          -- Anything that OVERLAPS the window, not only what starts in it: an
          -- event held over a weekend started on the Saturday, and must still
          -- be there when somebody looks at the Sunday.
          AND b.starts_at < ?2 AND b.ends_at > ?1
        ORDER BY b.starts_at, r.sort_order`,
    )
    .bind(`${fromDate}T00:00`, `${to}T00:00`)
    .all<BookingRow>();
  return results;
}

export async function getBooking(db: D1Database, id: number): Promise<BookingRow | null> {
  return db
    .prepare(
      `SELECT b.id, b.room_id, r.name AS room_name, b.title, b.starts_at, b.ends_at,
              b.contact, b.notes, b.status, b.series_id, b.event_id, b.is_tentative, b.request_id,
              p.display_name AS booked_by_name
         FROM room_bookings b
         JOIN rooms r ON r.id = b.room_id
         LEFT JOIN people p ON p.id = b.booked_by
        WHERE b.id = ?1`,
    )
    .bind(id)
    .first<BookingRow>();
}

/**
 * Bookings of the same room that overlap the given window.
 *
 * Two periods overlap when each starts before the other ends. Touching at the
 * boundary is NOT an overlap — a 19:00–21:00 home group and a 21:00–22:00 choir
 * practice are fine back to back, and treating that as a clash would be wrong.
 */
export async function findClashes(
  db: D1Database,
  roomId: number,
  startsAt: string,
  endsAt: string,
  excludeId?: number,
): Promise<BookingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT b.id, b.room_id, r.name AS room_name, b.title, b.starts_at, b.ends_at,
              b.contact, b.notes, b.status, b.series_id, NULL AS booked_by_name
         FROM room_bookings b JOIN rooms r ON r.id = b.room_id
        WHERE b.room_id = ?1
          AND b.status = 'booked'
          AND b.starts_at < ?3
          AND b.ends_at   > ?2
          AND (?4 IS NULL OR b.id <> ?4)
        ORDER BY b.starts_at`,
    )
    .bind(roomId, startsAt, endsAt, excludeId ?? null)
    .all<BookingRow>();
  return results;
}

export interface BookingInput {
  roomId: number;
  onDate: string;
  fromTime: string;
  toTime: string;
  title: string;
  contact: string | null;
  notes: string | null;
}

/** Validates a submitted booking, returning the instants or an error message. */
export function readBooking(form: FormData): { ok: true; value: BookingInput } | { ok: false; error: string } {
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const roomId = Number(form.get('room_id'));
  const onDate = s('on_date');
  const fromTime = s('from_time');
  const toTime = s('to_time');
  const title = s('title');

  if (!Number.isInteger(roomId)) return { ok: false, error: 'Choose a room.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(onDate)) return { ok: false, error: 'Choose a date.' };
  if (!/^\d{2}:\d{2}$/.test(fromTime) || !/^\d{2}:\d{2}$/.test(toTime)) {
    return { ok: false, error: 'Give a start and an end time.' };
  }
  if (toTime <= fromTime) {
    return { ok: false, error: 'The end time has to be after the start time.' };
  }
  if (!title) return { ok: false, error: 'Say what the booking is for.' };

  return {
    ok: true,
    value: {
      roomId, onDate, fromTime, toTime, title,
      contact: s('contact') || null,
      notes: s('notes') || null,
    },
  };
}

export const instants = (v: BookingInput) => ({
  startsAt: `${v.onDate}T${v.fromTime}`,
  endsAt: `${v.onDate}T${v.toTime}`,
});

// ---------------------------------------------------------------------------
// Repeating bookings
// ---------------------------------------------------------------------------

export interface SeriesRow {
  id: number;
  room_id: number;
  room_name: string;
  title: string;
  contact: string | null;
  notes: string | null;
  freq: Frequency;
  from_date: string;
  until_date: string;
  from_time: string;
  to_time: string;
  /** Occurrences still to come. */
  upcoming: number;
  total: number;
}

export async function listSeries(db: D1Database): Promise<SeriesRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT s.*, r.name AS room_name,
              (SELECT COUNT(*) FROM room_bookings b
                WHERE b.series_id = s.id AND b.status = 'booked') AS total,
              (SELECT COUNT(*) FROM room_bookings b
                WHERE b.series_id = s.id AND b.status = 'booked'
                  AND b.starts_at >= ?1) AS upcoming
         FROM room_booking_series s JOIN rooms r ON r.id = s.room_id
        ORDER BY s.from_date DESC`,
    )
    .bind(`${today}T00:00`)
    .all<SeriesRow>();
  return results;
}

export async function getSeries(db: D1Database, id: number): Promise<SeriesRow | null> {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .prepare(
      `SELECT s.*, r.name AS room_name,
              (SELECT COUNT(*) FROM room_bookings b
                WHERE b.series_id = s.id AND b.status = 'booked') AS total,
              (SELECT COUNT(*) FROM room_bookings b
                WHERE b.series_id = s.id AND b.status = 'booked'
                  AND b.starts_at >= ?2) AS upcoming
         FROM room_booking_series s JOIN rooms r ON r.id = s.room_id
        WHERE s.id = ?1`,
    )
    .bind(id, `${today}T00:00`)
    .first<SeriesRow>();
}

export interface SeriesEditResult {
  written: number;
  clashes: { date: string; with: string }[];
  protectedDates: string[];
  skipped: { date: string; why: string }[];
  truncated: boolean;
}

/**
 * Applies a change to a whole series.
 *
 * THREE KINDS OF OCCURRENCE ARE LEFT ALONE, and each for a reason that matters:
 *
 *   * ones in the PAST. They already happened. Moving a meeting that took place
 *     last Tuesday to a different room rewrites the diary.
 *   * ones somebody DETACHED by editing that week on its own. "Just this week we
 *     are upstairs" has to survive a later change to the series.
 *   * ones somebody CANCELLED. Re-creating a week that was deliberately called
 *     off would be the system arguing with the person using it.
 *
 * Everything else in the future is rebuilt from the new pattern.
 */
export async function applySeriesEdit(
  db: D1Database,
  id: number,
  next: {
    roomId: number; title: string; contact: string | null; notes: string | null;
    freq: Frequency; untilDate: string; fromTime: string; toTime: string;
  },
  bookedBy: number,
): Promise<SeriesEditResult> {
  const today = new Date().toISOString().slice(0, 10);
  const from = `${today}T00:00`;

  const existing = await db.prepare(
    'SELECT from_date FROM room_booking_series WHERE id = ?1',
  ).bind(id).first<{ from_date: string }>();
  const anchor = existing?.from_date ?? today;

  // Dates already decided one way or another, which the rebuild must not touch.
  const { results: keep } = await db
    .prepare(
      `SELECT substr(starts_at, 1, 10) AS day FROM room_bookings
        WHERE series_id = ?1 AND starts_at >= ?2
          AND (series_detached = 1 OR status = 'cancelled')`,
    )
    .bind(id, from)
    .all<{ day: string }>();
  const protectedDates = [...new Set(keep.map((k) => k.day))];

  // The pattern is worked out from the series' own first date — a Tuesday
  // group edited on a Friday is still a Tuesday group — and then only the dates
  // from today on are kept, since the past is not being rewritten. Working it
  // out from today instead used to move every future date onto today's weekday.
  const full = await planSeries(
    db, next.roomId, anchor, next.untilDate, next.freq, next.fromTime, next.toTime, id);
  const plan = {
    ...full,
    dates: full.dates.filter((d) => d >= today),
    clashes: full.clashes.filter((c) => c.date >= today),
  };

  await db.prepare(
    `UPDATE room_booking_series
        SET room_id = ?2, title = ?3, contact = ?4, notes = ?5,
            freq = ?6, until_date = ?7, from_time = ?8, to_time = ?9
      WHERE id = ?1`,
  ).bind(id, next.roomId, next.title, next.contact, next.notes,
    next.freq, next.untilDate, next.fromTime, next.toTime).run();

  // Out with the future ones this series still owns outright...
  await db.prepare(
    `DELETE FROM room_bookings
      WHERE series_id = ?1 AND starts_at >= ?2
        AND series_detached = 0 AND status = 'booked'`,
  ).bind(id, from).run();

  // ...and in with the new pattern, minus anything already decided.
  const wanted = plan.dates.filter((d) => !protectedDates.includes(d));
  if (wanted.length) {
    const stmt = db.prepare(
      `INSERT INTO room_bookings
         (room_id, title, starts_at, ends_at, booked_by, contact, notes, series_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    );
    const rows = wanted.map((d) => stmt.bind(
      next.roomId, next.title, `${d}T${next.fromTime}`, `${d}T${next.toTime}`,
      bookedBy, next.contact, next.notes, id));
    for (let i = 0; i < rows.length; i += 100) await db.batch(rows.slice(i, i + 100));
  }

  return {
    written: wanted.length,
    clashes: plan.clashes,
    protectedDates,
    skipped: plan.skipped,
    truncated: plan.truncated,
  };
}

export interface SeriesPlan {
  dates: string[];
  clashes: { date: string; with: string }[];
  skipped: { date: string; why: string }[];
  truncated: boolean;
}

/**
 * Works out what a proposed series would actually book.
 *
 * Every occurrence is checked against what is already in the diary, and a clash
 * takes that ONE date out rather than failing the whole series. A year-long
 * weekly booking should not be refused because of one Christmas concert — but
 * the dates it could not take have to be named, not quietly dropped.
 */
export async function planSeries(
  db: D1Database,
  roomId: number,
  fromDate: string,
  untilDate: string,
  freq: Frequency,
  fromTime: string,
  toTime: string,
  excludeSeriesId?: number,
): Promise<SeriesPlan> {
  const { dates, truncated, skipped } = expandSeries(fromDate, untilDate, freq);
  if (!dates.length) return { dates: [], clashes: [], skipped, truncated };

  // One query for the whole window rather than one per occurrence: a weekly
  // year is 52 round trips otherwise, and D1 caps queries per invocation.
  const { results: existing } = await db
    .prepare(
      `SELECT b.title, b.starts_at, b.ends_at
         FROM room_bookings b
        WHERE b.room_id = ?1 AND b.status = 'booked'
          AND b.starts_at < ?3 AND b.ends_at > ?2
          AND (?4 IS NULL OR b.series_id IS NULL OR b.series_id <> ?4)`,
    )
    .bind(roomId, `${fromDate}T00:00`, `${untilDate}T23:59`, excludeSeriesId ?? null)
    .all<{ title: string; starts_at: string; ends_at: string }>();

  const free: string[] = [];
  const clashes: { date: string; with: string }[] = [];
  for (const d of dates) {
    const starts = `${d}T${fromTime}`;
    const ends = `${d}T${toTime}`;
    // Touching at the boundary is not a clash: 19:00-21:00 and 21:00-22:00 are
    // fine back to back.
    const hit = existing.find((e) => e.starts_at < ends && e.ends_at > starts);
    if (hit) clashes.push({ date: d, with: hit.title });
    else free.push(d);
  }
  return { dates: free, clashes, skipped, truncated };
}

// ---------------------------------------------------------------------------
// The room diary on the website
// ---------------------------------------------------------------------------
//
// Two read-only pages anybody can open, /rooms/calendar and /rooms/list. Every
// booking they show comes through listPublicDiary below and nowhere else, so
// what the website can say about a booking is decided in one place.

/** How far ahead of this month the website's diary reaches. */
export const DIARY_MONTHS_AHEAD = 12;

export interface DiarySettings { is_public: number; show_titles: number }

export async function loadDiarySettings(db: D1Database): Promise<DiarySettings> {
  const row = await db.prepare(
    'SELECT is_public, show_titles FROM room_diary_settings WHERE id = 1',
  ).first<DiarySettings>();
  // Not public, and no titles, if the row is somehow missing: a page anybody
  // can open must fail shut, as the booking form does.
  return row ?? { is_public: 0, show_titles: 0 };
}

/** The rooms the website's diary has a tab for: the active ones, by name only. */
export async function listDiaryRooms(db: D1Database): Promise<{ id: number; name: string }[]> {
  const { results } = await db
    .prepare('SELECT id, name FROM rooms WHERE is_active = 1 ORDER BY sort_order, name')
    .all<{ id: number; name: string }>();
  return results;
}

/** Everything the website's diary knows about a booking. Nothing else is read. */
export interface PublicDiaryRow {
  room_id: number;
  room_name: string;
  starts_at: string;
  ends_at: string;
  /** NULL wherever it must not be shown — see listPublicDiary. */
  title: string | null;
  /** 1 for a time held for somebody who asked online and is waiting to hear. */
  is_tentative: number;
  /** 1 when the room is held for an event that is not published yet. */
  unpublished_event: number;
}

/** The columns above, for the test that checks nothing else ever comes back. */
export const PUBLIC_DIARY_COLUMNS = [
  'room_id', 'room_name', 'starts_at', 'ends_at', 'title', 'is_tentative', 'unpublished_event',
] as const;

/**
 * What is booked, for the website.
 *
 * THIS IS THE PRIVACY BOUNDARY. It reads the room, the times and the title,
 * and never the contact, the notes, who booked it, the request it came from,
 * its series or its id — so no change to a page can show those by accident,
 * because the page never has them. Cancelled bookings and rooms no longer in
 * use are left out.
 *
 * The title is withheld HERE, not only on the page, wherever it must not be
 * shown, so it never leaves the database:
 *
 *   * titles switched off on Rooms → Booking form: every booking is "Booked".
 *   * a time held for a request still waiting (is_tentative): what a member of
 *     the public typed is not the church's to publish, and it may yet be
 *     declined. The page says "Held — not yet confirmed".
 *   * anything that came from the public form at all (request_id), even once
 *     approved: the same words, typed by the same person, who was never told
 *     they would be on the website.
 *   * a room held for an event that is not published yet: the website must not
 *     announce an event before its organisers do. The page says "Booked".
 */
export async function listPublicDiary(
  db: D1Database,
  fromDate: string,
  toDate: string,
  roomId: number | null,
  showTitles: boolean,
): Promise<PublicDiaryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT b.room_id, r.name AS room_name, b.starts_at, b.ends_at,
              CASE WHEN ?4 = 1 AND b.is_tentative = 0 AND b.request_id IS NULL
                        AND (b.event_id IS NULL OR e.is_published = 1)
                   THEN b.title END AS title,
              b.is_tentative,
              -- An event id with no event behind it counts as unpublished:
              -- when in doubt, say less.
              CASE WHEN b.event_id IS NOT NULL AND COALESCE(e.is_published, 0) <> 1
                   THEN 1 ELSE 0 END AS unpublished_event
         FROM room_bookings b
         JOIN rooms r ON r.id = b.room_id
         LEFT JOIN events e ON e.id = b.event_id
        WHERE b.status = 'booked' AND r.is_active = 1
          -- Overlapping the window, as on the internal diary, so a weekend
          -- away that began on the Saturday is still there on the Sunday.
          AND b.starts_at < ?2 AND b.ends_at > ?1
          AND (?3 IS NULL OR b.room_id = ?3)
        ORDER BY b.starts_at, r.sort_order, r.name`,
    )
    .bind(`${fromDate}T00:00`, `${toDate}T00:00`, roomId, showTitles ? 1 : 0)
    .all<PublicDiaryRow>();
  return results;
}

const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The month the website's diary shows, and the days it may read for it.
 *
 * Kept between this month and DIARY_MONTHS_AHEAD months on, whatever is asked
 * for: the website is not a way to read the church's past diary, and a month
 * that does not exist falls back to this one quietly rather than failing.
 *
 * The list starts from today. The calendar starts from the 1st of this month —
 * a grid with its first days blank would look as though nothing had been on —
 * and reaches a week either side of the month it shows, for the days of the
 * neighbouring months at the edges of the grid, but never before this month
 * or past the last one. `to` is the day after the last day read.
 */
export function publicDiaryWindow(view: 'calendar' | 'list', asked: string | undefined, today: string) {
  const first = today.slice(0, 7);
  const last = shiftMonth(first, DIARY_MONTHS_AHEAD);
  const real = asked && /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : first;
  const month = real < first ? first : real > last ? last : real;
  const next = `${shiftMonth(month, 1)}-01`;
  if (view === 'list') {
    return { month, first, last, from: month === first ? today : `${month}-01`, to: next };
  }
  const floor = `${first}-01`;
  const ceiling = `${shiftMonth(last, 1)}-01`;
  const from = addDays(`${month}-01`, -7);
  const to = addDays(next, 7);
  return { month, first, last, from: from < floor ? floor : from, to: to > ceiling ? ceiling : to };
}
