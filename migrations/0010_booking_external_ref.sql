-- Move the Google Calendar reference out of the notes field.
--
-- The import wrote "ical:<uid>" into `notes` so that re-running it could find and
-- replace its own rows. That worked, but `notes` is shown to people on the room
-- diary, so every imported booking carried a line of machine noise:
--
--     Parish Breakfast
--     ical:11ntir29rs6j40dj7h8bdgodqp@google.com
--
-- The reference is still worth keeping — it links each row back to the calendar
-- entry it came from, which is what makes a future re-import or re-sync
-- possible — so it moves to its own column rather than being thrown away.
--
-- Note this is ADD COLUMN, not DROP: D1 refuses to drop a column from a table
-- carrying CHECK constraints, and room_bookings has two.
ALTER TABLE room_bookings ADD COLUMN external_ref TEXT;

-- Split the existing values. The importer wrote either "ical:<uid>" alone, or
-- "ical:<uid> · <a real note>" where there was something worth saying — the
-- assumed 90-minute length, or a location from the calendar. The real note is
-- kept; the reference moves across.
--
-- 'ical:' is 5 characters, so the uid starts at 6. The separator ' · ' is three
-- characters (the middle one is U+00B7), and SQLite's instr/substr count
-- characters rather than bytes, so the arithmetic below is safe.
UPDATE room_bookings
   SET external_ref = CASE
         WHEN instr(notes, ' · ') > 0 THEN substr(notes, 6, instr(notes, ' · ') - 6)
         ELSE substr(notes, 6)
       END,
       notes = CASE
         WHEN instr(notes, ' · ') > 0 THEN substr(notes, instr(notes, ' · ') + 3)
         ELSE NULL
       END
 WHERE notes LIKE 'ical:%';

-- What the re-import now matches on instead of the notes text.
CREATE INDEX room_bookings_external_ref ON room_bookings (external_ref);
