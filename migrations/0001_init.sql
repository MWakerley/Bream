-- Bream Church Rota and Diary Management System — initial schema.
--
-- Dates and times are stored as TEXT in ISO-8601 ('2026-09-20', '10:30',
-- '2026-09-20T10:30'). SQLite has no date type, ISO strings sort correctly as
-- text, and it keeps D1's JSON round-trip honest.
--
-- A NOTE ON CHECK CONSTRAINTS: D1 refuses ALTER TABLE ... DROP COLUMN on a table
-- carrying a CHECK constraint, and a failed migration blocks every later deploy.
-- The CHECKs below are therefore only on values whose vocabulary is genuinely
-- fixed (a traffic light is red/amber/green and always will be). Anything that
-- might grow — role names, service types — is a row in a table, not a CHECK.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per human. Volunteers and admins are the same table: at a village
-- church the vicar is also a preacher and a service leader, and splitting them
-- would mean maintaining the same person twice.
CREATE TABLE people (
  id                INTEGER PRIMARY KEY,
  -- How they appear on the rota, e.g. 'Shirley D'. This is what the imported
  -- spreadsheet gives us and what the church actually calls them.
  display_name      TEXT    NOT NULL,
  full_name         TEXT,
  email             TEXT,
  phone             TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  is_admin          INTEGER NOT NULL DEFAULT 0,
  -- Set on import where the spreadsheet name was ambiguous ('Matt' could be
  -- Matt R or Matt W). The Settings screen lists these for a human to resolve;
  -- the generator refuses to schedule a person still flagged.
  needs_review      INTEGER NOT NULL DEFAULT 0,
  review_note       TEXT,
  -- "happy to work with anyone else" — the opposite of insisting on a partner.
  happy_with_anyone INTEGER NOT NULL DEFAULT 1,
  notes             TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Email is the login identifier, so it must be unique — but only when present.
-- Most of the 87 imported volunteers have no email yet, and SQLite's unique
-- index ignores NULLs, which is exactly the behaviour wanted here.
CREATE UNIQUE INDEX people_email_unique ON people (email) WHERE email IS NOT NULL;
CREATE INDEX people_active ON people (is_active, display_name);

-- Password credentials, kept out of `people` so a query that lists volunteers
-- cannot accidentally select a hash.
CREATE TABLE credentials (
  person_id      INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
  password_hash  TEXT    NOT NULL,   -- base64 PBKDF2-SHA256 output
  salt           TEXT    NOT NULL,   -- base64, 16 random bytes
  iterations     INTEGER NOT NULL,   -- recorded so the cost can be raised later
  must_change    INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id          TEXT    PRIMARY KEY,   -- 32 random bytes, base64url
  person_id   INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT    NOT NULL
);
CREATE INDEX sessions_person ON sessions (person_id);
CREATE INDEX sessions_expiry ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- Roles are DATA, not an enum, because the church explicitly wants to add more.
-- min_needed vs ideal_needed exists because prayer ministry is "2 minimum,
-- 4 ideal": below min is a gap warning, between min and ideal is merely untidy.
CREATE TABLE roles (
  id             INTEGER PRIMARY KEY,
  key            TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  -- Column heading used by the old spreadsheet, so an import can map to it and
  -- so the rota print-out can keep the names people already recognise.
  sheet_heading  TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 100,
  min_needed     INTEGER NOT NULL DEFAULT 1,
  ideal_needed   INTEGER NOT NULL DEFAULT 1,
  -- Preside and communion distribution only apply when the service is communion.
  communion_only INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  notes          TEXT,
  CHECK (min_needed >= 0),
  CHECK (ideal_needed >= min_needed)
);

-- Which roles a person can and will do. `can_do` is the church's view of
-- competence; `willing` is the person's own answer in self-service. Both must be
-- true for the generator to use them — that is what makes it self-service rather
-- than the vicar guessing.
CREATE TABLE person_roles (
  person_id      INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  role_id        INTEGER NOT NULL REFERENCES roles (id)  ON DELETE CASCADE,
  can_do         INTEGER NOT NULL DEFAULT 1,
  willing        INTEGER NOT NULL DEFAULT 1,

  -- Frequency, in two independent directions, because the church asked for both:
  --   "I'll preach twice a month"      -> max_per_period 2, period_days 30
  --   "I'll only preach every 3 months"-> min_gap_days 90
  -- Either may be NULL, meaning "no limit of that kind".
  max_per_period INTEGER,
  period_days    INTEGER,
  min_gap_days   INTEGER,

  note           TEXT,
  PRIMARY KEY (person_id, role_id),
  CHECK (max_per_period IS NULL OR max_per_period > 0),
  CHECK (period_days    IS NULL OR period_days    > 0),
  CHECK (min_gap_days   IS NULL OR min_gap_days   > 0)
);
CREATE INDEX person_roles_by_role ON person_roles (role_id, can_do, willing);

-- One person holding two roles in the SAME service: is that fine, untidy, or
-- forbidden? Stored once per unordered pair, normalised so role_a_id < role_b_id,
-- which the unique index below enforces rather than trusting the caller.
CREATE TABLE role_combinations (
  role_a_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  role_b_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  verdict   TEXT    NOT NULL,
  reason    TEXT,
  PRIMARY KEY (role_a_id, role_b_id),
  CHECK (verdict IN ('green', 'amber', 'red')),
  CHECK (role_a_id < role_b_id)
);

-- Who works with whom. Deliberately NOT a "spouse" field on people: the real
-- rota shows Pete paired with both Ruth and Heather, Sue with both Sheila and
-- Glenn, and Kay with both Sveta and Louisa. So a person may have several
-- pairings, and a pairing may be scoped to one role.
CREATE TABLE pairings (
  id          INTEGER PRIMARY KEY,
  person_a_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  person_b_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  -- NULL means the pairing applies in any role.
  role_id     INTEGER          REFERENCES roles (id)  ON DELETE CASCADE,
  mode        TEXT    NOT NULL DEFAULT 'together',
  strength    TEXT    NOT NULL DEFAULT 'prefer',
  note        TEXT,
  CHECK (mode     IN ('together', 'avoid')),
  CHECK (strength IN ('must', 'prefer')),
  CHECK (person_a_id < person_b_id)
);
CREATE UNIQUE INDEX pairings_unique
  ON pairings (person_a_id, person_b_id, IFNULL(role_id, -1));

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------

CREATE TABLE service_types (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL UNIQUE,
  is_communion INTEGER NOT NULL DEFAULT 0,
  default_time TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  notes        TEXT
);

-- Every service, the weekly 10:30 and the irregular extras alike. The church's
-- own rota has 09:00 said communion, 16:00 Messy Christingle, 18:00 LIFT,
-- 23:30 Christmas Eve and a 15:00 Remembrance service at the Cenotaph, so there
-- is no "regular service" table and "extras" table — there is just this.
CREATE TABLE services (
  id              INTEGER PRIMARY KEY,
  service_date    TEXT    NOT NULL,           -- 'YYYY-MM-DD'
  service_time    TEXT    NOT NULL,           -- 'HH:MM'
  service_type_id INTEGER          REFERENCES service_types (id) ON DELETE SET NULL,
  -- Free title where the type is not the whole story: 'Holy Communion HARVEST',
  -- 'Carols by Candlelight', 'Worship Lent 2'.
  title           TEXT,
  -- Defaults to the church; the Remembrance service is at Bream Cenotaph.
  location        TEXT,
  -- Overrides the service type when a one-off is or is not communion.
  is_communion    INTEGER,
  is_cancelled    INTEGER NOT NULL DEFAULT 0,
  -- The vicar fills these in ahead of time.
  readings        TEXT,
  sermon_title    TEXT,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX services_slot ON services (service_date, service_time);
CREATE INDEX services_by_date ON services (service_date);

-- One row per required place. A role needing 2 people produces slots 1 and 2, so
-- an unfilled place is a row with person_id NULL rather than a missing row —
-- which is what makes "this service has a gap" a simple query instead of a
-- comparison against expected counts.
CREATE TABLE assignments (
  id          INTEGER PRIMARY KEY,
  service_id  INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES roles (id)    ON DELETE CASCADE,
  slot        INTEGER NOT NULL,
  person_id   INTEGER          REFERENCES people (id)   ON DELETE SET NULL,
  status      TEXT    NOT NULL DEFAULT 'vacant',
  -- True when the generator placed this rather than a human.
  generated   INTEGER NOT NULL DEFAULT 0,
  -- One sentence saying why this person was chosen. A rota nobody can explain
  -- is a rota nobody trusts, so the generator is required to fill this in.
  reason      TEXT,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (service_id, role_id, slot),
  CHECK (status IN ('vacant', 'draft', 'confirmed', 'declined')),
  CHECK (slot > 0)
);
CREATE INDEX assignments_by_person ON assignments (person_id, service_id);
CREATE INDEX assignments_by_service ON assignments (service_id, role_id);

-- ---------------------------------------------------------------------------
-- Self-service
-- ---------------------------------------------------------------------------

CREATE TABLE unavailability (
  id         INTEGER PRIMARY KEY,
  person_id  INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  from_date  TEXT    NOT NULL,
  to_date    TEXT    NOT NULL,
  reason     TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (to_date >= from_date)
);
CREATE INDEX unavailability_person_dates ON unavailability (person_id, from_date, to_date);

CREATE TABLE change_requests (
  id            INTEGER PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  person_id     INTEGER NOT NULL REFERENCES people (id)      ON DELETE CASCADE,
  kind          TEXT    NOT NULL,
  message       TEXT,
  status        TEXT    NOT NULL DEFAULT 'open',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT,
  resolved_by   INTEGER REFERENCES people (id) ON DELETE SET NULL,
  CHECK (kind   IN ('cannot_do', 'swap', 'note')),
  CHECK (status IN ('open', 'accepted', 'declined'))
);
CREATE INDEX change_requests_open ON change_requests (status, created_at);

-- ---------------------------------------------------------------------------
-- Room booking
-- ---------------------------------------------------------------------------

CREATE TABLE rooms (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL UNIQUE,
  capacity  INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes     TEXT
);

-- Overlap is checked in application code, not by a constraint: SQLite has no
-- exclusion constraint, and a trigger that rejected an overlap would make
-- amending a booking (which briefly overlaps itself) fail. The index below is
-- what makes that check one indexed range scan.
CREATE TABLE room_bookings (
  id         INTEGER PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  starts_at  TEXT    NOT NULL,          -- 'YYYY-MM-DDTHH:MM'
  ends_at    TEXT    NOT NULL,
  booked_by  INTEGER          REFERENCES people (id) ON DELETE SET NULL,
  contact    TEXT,
  notes      TEXT,
  status     TEXT    NOT NULL DEFAULT 'booked',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (ends_at > starts_at),
  CHECK (status IN ('booked', 'cancelled'))
);
CREATE INDEX room_bookings_window ON room_bookings (room_id, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id                INTEGER PRIMARY KEY,
  slug              TEXT    NOT NULL UNIQUE,   -- public booking URL
  title             TEXT    NOT NULL,
  description       TEXT,
  starts_at         TEXT    NOT NULL,
  ends_at           TEXT,
  location          TEXT,
  -- NULL means unlimited. Counted against the SUM of party_size, not the row
  -- count, because "how many are coming" is the catering question.
  capacity          INTEGER,
  booking_opens_at  TEXT,
  booking_closes_at TEXT,
  is_published      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (capacity IS NULL OR capacity > 0)
);

-- The admin defines the booking form per event: numbers attending, food
-- preferences, allergies, whatever that event needs.
CREATE TABLE event_fields (
  id         INTEGER PRIMARY KEY,
  event_id   INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  key        TEXT    NOT NULL,
  label      TEXT    NOT NULL,
  hint       TEXT,
  kind       TEXT    NOT NULL,
  -- JSON array of choices, for 'select' and 'radio'.
  options    TEXT,
  required   INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 100,
  UNIQUE (event_id, key),
  CHECK (kind IN ('text', 'textarea', 'number', 'select', 'radio', 'checkbox'))
);

CREATE TABLE event_bookings (
  id         INTEGER PRIMARY KEY,
  event_id   INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  email      TEXT,
  phone      TEXT,
  party_size INTEGER NOT NULL DEFAULT 1,
  status     TEXT    NOT NULL DEFAULT 'booked',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (party_size > 0),
  CHECK (status IN ('booked', 'cancelled', 'waitlist'))
);
CREATE INDEX event_bookings_by_event ON event_bookings (event_id, status);

CREATE TABLE event_booking_answers (
  booking_id INTEGER NOT NULL REFERENCES event_bookings (id) ON DELETE CASCADE,
  field_id   INTEGER NOT NULL REFERENCES event_fields (id)   ON DELETE CASCADE,
  value      TEXT,
  PRIMARY KEY (booking_id, field_id)
);
