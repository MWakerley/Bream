-- Asking to book a room from outside the system.
--
-- Somebody who is not signed in — a toddler group, a family wanting the hall
-- for a party — fills in a public form. Their request is held on the diary as
-- TENTATIVE straight away, so nobody else can book over it while it waits, and
-- appears at the top of the Rooms page for somebody to approve or decline.
--
-- THE HOLD IS AN ORDINARY room_bookings ROW, marked tentative. The clash
-- check, the diary, the calendar and the public availability view all already
-- understand room_bookings, so none of them needs to learn a second kind of
-- booking to keep a request's time safe. Approving clears the mark; declining
-- cancels the rows. status stays 'booked' while tentative precisely so every
-- existing "is this room free?" query counts the hold as taken.

CREATE TABLE room_requests (
  id            INTEGER PRIMARY KEY,
  room_id       INTEGER NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  -- Who is asking. Email is required: it is how the answer reaches them.
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL,
  phone         TEXT,
  organisation  TEXT,
  purpose       TEXT    NOT NULL,
  people        INTEGER NOT NULL,
  -- Members of Bream Church are covered by the church's own insurance.
  -- Anybody else is asked about public liability insurance; NULL for members.
  is_member     INTEGER NOT NULL,
  has_insurance INTEGER,
  notes         TEXT,
  -- The first (or only) occurrence.
  starts_at     TEXT    NOT NULL,
  ends_at       TEXT    NOT NULL,
  -- A repeating request: the pattern and when it stops. NULL for a one-off.
  freq          TEXT,
  until_date    TEXT,
  -- Dates in a repeating request that were already taken when it was made,
  -- as a JSON array, so the person deciding can see what was left out.
  clash_dates   TEXT,
  status        TEXT    NOT NULL DEFAULT 'pending',
  -- A one-way hash of the address the request came from. Never shown and
  -- never reversible; kept only so one connection cannot hold every room by
  -- inventing a new email address for each request.
  ip_hash       TEXT,
  -- An unguessable reference for the "we have your request" page, so that
  -- page can be reached again by a plain link and refreshing it never sends
  -- the request a second time.
  receipt       TEXT    UNIQUE,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_at    TEXT,
  decided_by    INTEGER REFERENCES people (id) ON DELETE SET NULL,
  decision_note TEXT,
  CHECK (status IN ('pending', 'approved', 'declined')),
  CHECK (people > 0),
  CHECK (ends_at > starts_at),
  CHECK (freq IS NULL OR freq IN ('weekly', 'fortnightly', 'monthly-date', 'monthly-weekday'))
);
CREATE INDEX room_requests_pending ON room_requests (status, created_at);
CREATE INDEX room_requests_email ON room_requests (lower(email), status);
CREATE INDEX room_requests_ip ON room_requests (ip_hash, status);

-- The hold. is_tentative = 1 while the request waits; request_id links every
-- held occurrence back to the request that made it.
ALTER TABLE room_bookings ADD COLUMN is_tentative INTEGER NOT NULL DEFAULT 0;
ALTER TABLE room_bookings ADD COLUMN request_id INTEGER REFERENCES room_requests (id) ON DELETE SET NULL;
CREATE INDEX room_bookings_request ON room_bookings (request_id);

-- Which rooms may be asked for from outside. Off by default: opening a room to
-- the public is a decision, not something a migration should make.
ALTER TABLE rooms ADD COLUMN public_booking INTEGER NOT NULL DEFAULT 0;

-- The form's settings. One row.
CREATE TABLE room_form_settings (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  -- Closed until somebody opens it on the Booking form tab.
  is_open           INTEGER NOT NULL DEFAULT 0,
  intro             TEXT,
  -- Told about each new request. NULL means nobody is emailed; the requests
  -- still wait on the Rooms page.
  notify_email      TEXT,
  -- How soon, and how far ahead, somebody may ask for.
  min_days_notice   INTEGER NOT NULL DEFAULT 2,
  max_days_ahead    INTEGER NOT NULL DEFAULT 180,
  allow_repeating   INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO room_form_settings (id, intro) VALUES (1,
  'Use this form to ask to book a room at Bream Church. Your request is not confirmed until we have been in touch — we will reply by email.');
