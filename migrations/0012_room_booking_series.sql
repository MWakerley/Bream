-- Repeating room bookings.
--
-- A weekly home group was 50 separate rows with nothing tying them together, so
-- cancelling it meant cancelling fifty bookings by hand. This adds the thing
-- they belong to.
--
-- THE OCCURRENCES ARE STILL REAL ROWS. The alternative — storing only the rule
-- and working out the dates when somebody looks — would mean the clash check,
-- the diary, the calendar and the 499 already-imported bookings all had to learn
-- about recurrence. Keeping real rows means every one of those carries on
-- working, a single occurrence can be moved or cancelled without touching the
-- rest, and the clash check stays one indexed range scan.
--
-- The cost is that a series has a horizon rather than running forever, and
-- extending it is a deliberate act. For a church diary that is the right trade:
-- nobody wants a booking silently held in 2034.
CREATE TABLE room_booking_series (
  id          INTEGER PRIMARY KEY,
  room_id     INTEGER NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  contact     TEXT,
  notes       TEXT,
  -- The pattern, as picked from the dropdown.
  freq        TEXT    NOT NULL,
  from_date   TEXT    NOT NULL,
  until_date  TEXT    NOT NULL,
  from_time   TEXT    NOT NULL,
  to_time     TEXT    NOT NULL,
  created_by  INTEGER REFERENCES people (id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (freq IN ('weekly', 'fortnightly', 'monthly-date', 'monthly-weekday')),
  CHECK (until_date >= from_date),
  CHECK (to_time > from_time)
);

-- Which series an occurrence belongs to, if any. ON DELETE SET NULL rather than
-- CASCADE on purpose: removing the series should not silently erase the history
-- of meetings that already happened.
ALTER TABLE room_bookings ADD COLUMN series_id INTEGER REFERENCES room_booking_series (id) ON DELETE SET NULL;

-- Set when somebody edits one occurrence on its own. The series then leaves it
-- alone, so "move just this week's to the Prayer room" survives a later change
-- to the series as a whole.
ALTER TABLE room_bookings ADD COLUMN series_detached INTEGER NOT NULL DEFAULT 0;

CREATE INDEX room_bookings_series ON room_bookings (series_id, starts_at);
