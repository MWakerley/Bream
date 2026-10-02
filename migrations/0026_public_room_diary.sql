-- The room diary, for the church's website.
--
-- Two read-only pages outside the system, /rooms/calendar and /rooms/list, so
-- the website can show what is on in each room without anybody signing in.
-- They are for looking at, not booking: no forms, no "+", and no links into
-- the system. Asking for a room is still the booking form's job.
--
-- WHAT THEY SHOW IS DECIDED IN ONE QUERY, listPublicDiary in src/rooms.ts,
-- which reads only the room, the times and the title — never the contact,
-- the notes, who booked it or anything about a request. The diary is there to
-- show people what is going on in the church, so a booking says what it is
-- for — including one that was asked for online and has since been approved.
-- Three kinds never show their title even when titles are on: a booking
-- ticked private reads "Private booking" (see below), a time held for
-- somebody who asked online and is still waiting to hear reads "Held — not
-- yet confirmed", and a room held for an event that is not published yet
-- reads just "Booked", so the website cannot announce an event before its
-- organisers do.
--
-- One row, like room_form_settings. The only CHECK is the one that keeps it
-- to one row; nothing else is constrained, for the reason in 0017's header
-- (D1 refuses to drop a column from a table carrying one). The POST handler
-- only ever writes 0 or 1.
CREATE TABLE room_diary_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  -- Whether the two pages answer at all. Off, they say only that the diary
  -- is not available, so a link already on the website fails politely.
  is_public   INTEGER NOT NULL DEFAULT 1,
  -- Whether a booking shows what it is for ("Toddler group") or only that
  -- the room is taken ("Booked"). Some bookings never show it; see above.
  show_titles INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO room_diary_settings (id) VALUES (1);

-- PRIVATE BOOKINGS. Most of what happens in the church is for everybody to
-- see, but not all of it: a counselling session, a family meeting after a
-- funeral, a group that meets in confidence. Ticked "Private booking", the
-- website shows just "Private booking" with the room and the time, never what
-- it is for. Inside the system nothing is hidden; a "Private" chip only tells
-- staff the website is not saying.
--
-- On the series as well as on each booking, because a repeating booking's
-- future dates are deleted and rebuilt from the series whenever the series is
-- changed (applySeriesEdit in src/rooms.ts). A tick kept only on the rows
-- would be lost at the next edit, so the series carries it and writes it onto
-- every row it creates or rebuilds — and onto its past rows too, since the
-- website shows the whole of this month, earlier days included.
--
-- A week changed on its own is detached from its series and keeps its own
-- tick, as it keeps its own room and times: unticking the series never makes
-- it public. The one exception is deliberate: ticking the series private
-- makes every week of it private, those changed on their own included,
-- because a private series with one week still showing what it is would be
-- worse than none. When in doubt, the website says less.
--
-- Nothing else sets it. A room held for an event follows the event's own
-- rules, and approving a request from the public form leaves it at 0, so an
-- approved booking says what it is.
--
-- No CHECK, for the reason in 0017's header; the POST handlers only ever write
-- 0 or 1, and the query treats anything but 0 as private.
ALTER TABLE room_bookings ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE room_booking_series ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
