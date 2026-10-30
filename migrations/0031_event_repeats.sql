-- Events that happen more than once: a course on six Wednesday evenings from
-- 21 January, a holiday club every morning for a week.
--
-- One event, not six. People book once and come to all of it, which is how a
-- course or a club works; the event's starts_at / ends_at are the FIRST time,
-- and every later one is the same times moved on by the step, so nothing that
-- reads the first time has to change.
--
--   repeat_freq   'daily', 'weekly' or 'fortnightly'. NULL: it happens once.
--   repeat_count  how many times in all, the first included (2 to 52).
--
-- Every ticked room is held for every time — ordinary room_bookings rows
-- pointing back at the event, as a one-off event's hold already is (0019), so
-- the diary, the clash check and the calendars need nothing new. See
-- eventOccurrences and syncEventRooms in src/events.ts.
--
-- No CHECKs, for the reason in 0017's header; src/events.ts reads anything it
-- does not recognise as "happens once".
ALTER TABLE events ADD COLUMN repeat_freq TEXT;
ALTER TABLE events ADD COLUMN repeat_count INTEGER;
