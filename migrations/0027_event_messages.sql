-- Messages sent from an event to the people who booked on it.
--
-- Kept so the office can see what has already gone out, and when, before
-- sending another. Each message is sent blind-copied (see sendBlindCopies in
-- src/email.ts); the addresses themselves are NOT stored here. Who it went to
-- is recorded by booking, so deleting a booking deletes that line of the record
-- with it, and nothing here outlives the booking it refers to.
CREATE TABLE event_messages (
  id          INTEGER PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  subject     TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  -- 'all': everybody booked in. 'chosen': the people ticked.
  audience    TEXT    NOT NULL,
  sent_count  INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  -- Chosen or booked in, but with no email address to send to.
  no_email_count INTEGER NOT NULL DEFAULT 0,
  sent_by     INTEGER REFERENCES people (id) ON DELETE SET NULL,
  sent_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (audience IN ('all', 'chosen'))
);
CREATE INDEX event_messages_by_event ON event_messages (event_id, sent_at);

CREATE TABLE event_message_recipients (
  message_id  INTEGER NOT NULL REFERENCES event_messages (id) ON DELETE CASCADE,
  booking_id  INTEGER NOT NULL REFERENCES event_bookings (id) ON DELETE CASCADE,
  -- 'sent', 'failed', or 'no_email'.
  status      TEXT    NOT NULL,
  error       TEXT,
  PRIMARY KEY (message_id, booking_id),
  CHECK (status IN ('sent', 'failed', 'no_email'))
);
