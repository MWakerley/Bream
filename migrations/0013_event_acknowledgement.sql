-- An acknowledgement email after somebody books.
--
-- send_ack forces ask_email on and makes the address compulsory on the booking
-- form: promising a confirmation and then having nowhere to send it is worse
-- than not offering one.
ALTER TABLE events ADD COLUMN send_ack INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN ack_subject TEXT;
ALTER TABLE events ADD COLUMN ack_body TEXT;

-- What actually happened to each acknowledgement, so "did they get an email?"
-- has an answer. A send that failed must not lose the booking, so the outcome is
-- recorded against the booking rather than thrown.
ALTER TABLE event_bookings ADD COLUMN ack_status TEXT;
ALTER TABLE event_bookings ADD COLUMN ack_error TEXT;
