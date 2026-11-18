-- Somebody taking part in ONE service — a visiting speaker, a friend of the
-- family reading at a baptism — without becoming a record under People.
--
-- The name lives on the booking itself, with person_id left NULL, so it goes
-- when the booking goes and nothing about them is kept anywhere else. A row
-- with neither a person nor a one-off name is an empty place, as before.
--
-- No CHECK constraint, for the reason 0017 gives: D1 refuses DROP COLUMN on a
-- table that carries one. The length is checked in the POST handler instead.
ALTER TABLE assignments ADD COLUMN one_off_name TEXT;
