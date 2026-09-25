-- The most places one booking may take.
--
-- The public form allowed up to fifty, so one person could empty an event in a
-- single go. Ten covers any family; the event's settings can raise or lower it.
-- The office taking a booking by phone is not held to it — they are the ones a
-- school party rings.
ALTER TABLE events ADD COLUMN max_per_booking INTEGER NOT NULL DEFAULT 10;
