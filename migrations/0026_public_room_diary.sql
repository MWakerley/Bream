-- The room diary, for the church's website.
--
-- Two read-only pages outside the system, /rooms/calendar and /rooms/list, so
-- the website can show what is on in each room without anybody signing in.
-- They are for looking at, not booking: no forms, no "+", and no links into
-- the system. Asking for a room is still the booking form's job.
--
-- WHAT THEY SHOW IS DECIDED IN ONE QUERY, listPublicDiary in src/rooms.ts,
-- which reads only the room, the times and the title — never the contact,
-- the notes, who booked it or anything about a request. Some bookings never
-- show their title even when titles are on: a time held for somebody who
-- asked online and is still waiting to hear reads "Held — not yet
-- confirmed", and a room held for an event that is not published yet reads
-- just "Booked", so the website cannot announce an event before its
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
