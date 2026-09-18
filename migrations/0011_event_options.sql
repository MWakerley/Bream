-- Two things the person creating an event needs to control, and one that makes
-- the booking page worth looking at.
--
-- ask_email / ask_phone: the booking form asked for both every time, whether or
-- not the event needed them. Collecting a phone number "just in case" is a
-- thing not to do by default, so each is now a deliberate choice. Name and how
-- many are coming stay compulsory — without those there is no booking.
ALTER TABLE events ADD COLUMN ask_email INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events ADD COLUMN ask_phone INTEGER NOT NULL DEFAULT 0;

-- An optional poster. Stored in R2 rather than the database: a JPEG in a D1 row
-- would count against a 2MB row cap and be read back on every query that
-- touches the event. This holds only the object key.
ALTER TABLE events ADD COLUMN poster_key TEXT;
