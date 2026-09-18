------------------------------------------------------------------------------
-- Bream Church Rota and Diary Management System — initial schema
--
-- Target: Cloudflare D1 (SQLite).  Apply with:
--     npx wrangler d1 migrations apply bream-church --local
--     npx wrangler d1 migrations apply bream-church --remote
--
-- CONVENTIONS
--   * Every table is STRICT: SQLite then enforces the declared type instead of
--     silently coercing.  A typo that puts 'ten' into min_needed fails loudly.
--   * Instants           -> INTEGER, Unix epoch SECONDS, UTC.
--   * Human diary entries -> TEXT 'YYYY-MM-DD' and 'HH:MM', LOCAL time.  A
--     service is "10:30 on Sunday", not an instant: it stays at 10:30 either
--     side of the clocks changing.  Lexicographic order on those formats is
--     chronological, so nothing is lost.  Room bookings are the exception and
--     use epochs, because overlap arithmetic has to be exact — see section 8.
--   * Booleans -> INTEGER 0/1 with a CHECK.  SQLite has no boolean type.
--   * Anything an admin must be able to add later is a ROW, never a CHECK list:
--     roles, service types, rooms, event form fields.  CHECK lists are reserved
--     for closed sets the code switches on.  This matters on D1: a column named
--     by a CHECK cannot be dropped later — the table has to be rebuilt — so the
--     cost of guessing wrong here is a table rebuild in a future migration.
--
-- Foreign keys are enforced by D1 by default; every reference below states its
-- ON DELETE behaviour explicitly rather than relying on the NO ACTION default.
------------------------------------------------------------------------------


------------------------------------------------------------------------------
-- 1. PEOPLE
--
-- The roster arrives from the spreadsheet as bare first names typed by hand
-- over several years.  Measured from September-November 2026.xlsx, the same
-- person columns contain:
--   'Andy' (x7), 'Andy E' (x2), 'Andy Ewens' (x2)  -> almost certainly one man
--   'Sheila' (x8) and 'Shelia' (x1)                -> a typo
--   'Marion' (x11) and 'Marian' (x1)               -> a typo
--   'Matt' (x6), 'Matt R' (x9), 'Matt W' (x3)      -> 'Matt' is truly ambiguous
--   'Sue' (x14) and 'Sue N' (x1)                   -> one person, or two?
-- Import therefore cannot be trusted to create the right people.  Two
-- mechanisms carry the doubt instead of hiding it:
--   needs_review          — import made this row; no human has vouched for it
--   merged_into_person_id — kept forever after a merge, so old links still land
------------------------------------------------------------------------------

CREATE TABLE person (
  id                    INTEGER PRIMARY KEY,
  -- What the printed rota shows.  Must be unambiguous to a human reading it,
  -- which is why the church already writes 'Matt R' and 'Matt W'.
  display_name          TEXT    NOT NULL,
  full_name             TEXT,
  email                 TEXT,
  phone                 TEXT,
  notes                 TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),

  -- Requirement 4, second half: "happy to work with anyone".  A positive
  -- statement, not merely the absence of pairing rows: it tells the generator it
  -- may freely pair this person, rather than leaving them on their own.
  pairs_with_anyone     INTEGER NOT NULL DEFAULT 0
                                CHECK (pairs_with_anyone IN (0, 1)),

  -- Set by import; cleared by a human in Settings.
  needs_review          INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
  review_note           TEXT,

  -- Merging: the losing row stays so historic assignments still resolve, and
  -- points at the survivor.  Reads follow the pointer; writes go to the survivor.
  merged_into_person_id INTEGER REFERENCES person(id) ON DELETE RESTRICT,

  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (length(trim(display_name)) > 0),
  CHECK (merged_into_person_id IS NULL OR merged_into_person_id <> id),
  -- A merged person is never active and is never offered to the generator.
  CHECK (merged_into_person_id IS NULL OR is_active = 0),
  CHECK (email IS NULL OR email LIKE '%_@_%')
) STRICT;

-- Two live people may not share a display name.  This is the constraint that
-- forces 'Sue' vs 'Sue N' to be decided rather than quietly collapsed.
CREATE UNIQUE INDEX ux_person_display_name
  ON person (lower(trim(display_name)))
  WHERE merged_into_person_id IS NULL;

-- Every spelling ever seen for a person.  Import resolves a cell by looking
-- here first; a spelling that is absent, or that two people could claim,
-- becomes a needs_review row rather than a guess.
CREATE TABLE person_alias (
  id          INTEGER PRIMARY KEY,
  person_id   INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  alias       TEXT    NOT NULL,
  source      TEXT    NOT NULL DEFAULT 'manual'
                      CHECK (source IN ('manual', 'import', 'merge')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (length(trim(alias)) > 0)
) STRICT;

-- Globally unique, deliberately: if two people could both answer to 'Matt',
-- neither may own the alias, and the cell stays unresolved for a human.
CREATE UNIQUE INDEX ux_person_alias_alias ON person_alias (lower(trim(alias)));


------------------------------------------------------------------------------
-- 2. AUTHENTICATION
------------------------------------------------------------------------------

-- Admins sign in with a password.  The hash is PBKDF2-SHA256 via WebCrypto,
-- stored as 'pbkdf2$<iterations>$<base64 salt>$<base64 hash>'.
-- NOTE FOR THE WORKER: Cloudflare caps PBKDF2 at 100,000 iterations.  Asking
-- for more throws at runtime, and local tests do NOT enforce the platform cap,
-- so a green suite proves nothing here.  Assert the constant in code.
CREATE TABLE admin_user (
  id              INTEGER PRIMARY KEY,
  email           TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  password_hash   TEXT    NOT NULL,
  -- 'owner' may manage other admins; 'admin' may do everything else.
  access_level    TEXT    NOT NULL DEFAULT 'admin'
                          CHECK (access_level IN ('owner', 'admin')),
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  -- An admin who is also on the rota (the vicar) links to their person row.
  person_id       INTEGER REFERENCES person(id) ON DELETE SET NULL,
  last_login_at   INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (length(email) > 0 AND email LIKE '%_@_%'),
  CHECK (length(password_hash) > 0),
  CHECK (length(trim(name)) > 0)
) STRICT;

-- Case-insensitive: nobody gets in twice as Matt@ and matt@.
CREATE UNIQUE INDEX ux_admin_user_email ON admin_user (lower(email));

-- The session cookie carries a random 256-bit token; only its SHA-256 lands
-- here, so a leaked copy of the database does not hand over live sessions.
CREATE TABLE admin_session (
  id              INTEGER PRIMARY KEY,
  token_hash      TEXT    NOT NULL UNIQUE,
  admin_user_id   INTEGER NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at      INTEGER NOT NULL,
  revoked_at      INTEGER,
  user_agent      TEXT,
  ip              TEXT,
  CHECK (expires_at > created_at)
) STRICT;

-- Volunteers never get a password.  Requirement 7 (declare unavailability,
-- request a change) is served by an emailed single-use link: a random token
-- whose hash is stored here, scoped to one person and one purpose.
CREATE TABLE person_access_token (
  id              INTEGER PRIMARY KEY,
  token_hash      TEXT    NOT NULL UNIQUE,
  person_id       INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  purpose         TEXT    NOT NULL DEFAULT 'self_service'
                          CHECK (purpose IN ('self_service', 'confirm_assignment')),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at      INTEGER NOT NULL,
  used_at         INTEGER,          -- single use; NULL means still live
  CHECK (expires_at > created_at)
) STRICT;


------------------------------------------------------------------------------
-- 3. ROLES, CAPABILITY AND FREQUENCY
------------------------------------------------------------------------------

-- Requirement 10: roles are rows, so an admin can add "Flowers" next year
-- without a migration.
CREATE TABLE role (
  id              INTEGER PRIMARY KEY,
  code            TEXT    NOT NULL UNIQUE,   -- stable key for code paths
  name            TEXT    NOT NULL,          -- what the rota prints
  description     TEXT,
  min_needed      INTEGER NOT NULL DEFAULT 1,
  ideal_needed    INTEGER NOT NULL DEFAULT 1,
  -- Preside and distribution exist only where there is communion.  Driving this
  -- from data is what stops the dashboard warning about a missing Preside on an
  -- ordinary Worship service.
  communion_only  INTEGER NOT NULL DEFAULT 0 CHECK (communion_only IN (0, 1)),
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order      INTEGER NOT NULL DEFAULT 100,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (length(trim(code)) > 0 AND length(trim(name)) > 0),
  CHECK (min_needed >= 0),
  CHECK (ideal_needed >= min_needed)
) STRICT;

-- The spreadsheet's column headings drift between tabs: the same role is
-- 'Kids Church' on one and 'Rec - Yr 5 (4yr-10yr)' on the next; 'Music' means
-- worship leader and 'Laptop' means computer.  Import maps through this table,
-- so a new heading is a one-row fix rather than a code change.
CREATE TABLE role_header_alias (
  id          INTEGER PRIMARY KEY,
  role_id     INTEGER NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  header_text TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (length(trim(header_text)) > 0)
) STRICT;

CREATE UNIQUE INDEX ux_role_header_alias
  ON role_header_alias (lower(trim(header_text)));

-- Requirement 1 (who CAN do what) and requirement 2 (how often they are
-- willing) share one row per person per role: a frequency is a property of a
-- capability and cannot exist without it.  Two tables would permit a frequency
-- for a role the person cannot do.
--
-- HOW FREQUENCY IS EXPRESSED.  The church stated it three ways — "preach every
-- 3 months", "preach twice a month", "lead once a month" — and those are two
-- different kinds of statement:
--   a CEILING : "twice a month"  = never more than 2 in any 30 days
--   a CADENCE : "every 3 months" = aim to use me about every 90 days
-- One number cannot carry both, so there are four columns, all nullable, where
-- NULL means "no stated preference, use the generator's defaults":
--
--   max_per_window / window_days  HARD ceiling.  "Twice a month" -> 2 / 30.
--                                 A ROLLING window, not a calendar month, so
--                                 the 30th and the 1st is still caught.
--   min_gap_days                  HARD floor between two turns.  "Not two weeks
--                                 running" -> 14.
--   target_interval_days          SOFT cadence the generator aims at and is
--                                 scored against.  "Every 3 months" -> 90.
--
-- "Every 3 months" is then max 1 per 90 days plus a 90-day target; "twice a
-- month" is a ceiling of 2 per 30 with a 15-day target.  Both fit, and the
-- direction of each statement is preserved rather than averaged away.
CREATE TABLE person_role (
  person_id             INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  role_id               INTEGER NOT NULL REFERENCES role(id)   ON DELETE CASCADE,

  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  -- Lets the generator prefer a confident pair of hands for a thin role, and
  -- pair a learner with a lead.  The data needs this: only 8 of ~60 people ever
  -- preach and only 8 ever run sound.
  proficiency           TEXT    NOT NULL DEFAULT 'able'
                                CHECK (proficiency IN ('learner', 'able', 'lead')),

  max_per_window        INTEGER,
  window_days           INTEGER,
  min_gap_days          INTEGER,
  target_interval_days  INTEGER,

  notes                 TEXT,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),

  PRIMARY KEY (person_id, role_id),

  -- A ceiling is meaningless without its window, and a window without a ceiling.
  CHECK ((max_per_window IS NULL) = (window_days IS NULL)),
  CHECK (max_per_window IS NULL OR max_per_window >= 1),
  CHECK (window_days IS NULL OR window_days >= 1),
  CHECK (min_gap_days IS NULL OR min_gap_days >= 0),
  CHECK (target_interval_days IS NULL OR target_interval_days >= 1)
) STRICT;


------------------------------------------------------------------------------
-- 4. PAIRING AND ROLE COMBINATION RULES
------------------------------------------------------------------------------

-- Requirement 4.  The spreadsheet shows Pete serving with Ruth eight times and
-- with Heather seven; Sue with Sheila eight times and with Glenn five; Kay with
-- Sveta and with Louisa.  So this is NOT a spouse column on person — it is a
-- many-to-many preference, a person may hold several, and it may be scoped to a
-- role (Artur and Dima appear together on sound and nowhere else).
--
-- Stored ONCE per unordered pair (CHECK a < b).  Two rows per pair would let
-- the table say 'together' in one direction and 'avoid' in the other.
CREATE TABLE pairing_preference (
  id            INTEGER PRIMARY KEY,
  person_a_id   INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  person_b_id   INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  -- NULL = every role.  Set = only when serving in this role.
  role_id       INTEGER REFERENCES role(id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL DEFAULT 'together'
                        CHECK (kind IN ('together', 'avoid')),
  -- 'must' the generator may not break; 'prefer' is scored, not enforced.
  strength      TEXT    NOT NULL DEFAULT 'prefer'
                        CHECK (strength IN ('prefer', 'must')),
  reason        TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (person_a_id < person_b_id)
) STRICT;

-- One verdict per pair per scope.  ifnull() because SQLite treats NULLs in a
-- UNIQUE constraint as distinct, which would otherwise allow two contradictory
-- all-roles rows for the same two people.
CREATE UNIQUE INDEX ux_pairing_pair_scope
  ON pairing_preference (person_a_id, person_b_id, ifnull(role_id, 0));

-- Requirement 3.  One person holding two roles in the SAME service.
-- Canonical unordered pair again: preacher+children's work is red whichever way
-- round you name it, and storing it once makes a contradiction unrepresentable.
-- ABSENCE OF A ROW IS NOT 'UNKNOWN' — it means the default in app_setting
-- 'combination_default', which ships as GREEN.
CREATE TABLE role_combination_rule (
  id          INTEGER PRIMARY KEY,
  role_a_id   INTEGER NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  role_b_id   INTEGER NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  verdict     TEXT    NOT NULL CHECK (verdict IN ('RED', 'AMBER', 'GREEN')),
  reason      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (role_a_id, role_b_id),
  -- Also rules out a self-pair.  "The same role twice" is a different question,
  -- prevented by ux_assignment_person_once_per_role below.
  CHECK (role_a_id < role_b_id)
) STRICT;


------------------------------------------------------------------------------
-- 5. ROOMS, SERVICE TYPES, PATTERNS AND SERVICES
------------------------------------------------------------------------------

CREATE TABLE room (
  id          INTEGER PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  capacity    INTEGER,
  is_bookable INTEGER NOT NULL DEFAULT 1 CHECK (is_bookable IN (0, 1)),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 100,
  notes       TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (capacity IS NULL OR capacity > 0),
  CHECK (length(trim(code)) > 0 AND length(trim(name)) > 0)
) STRICT;

CREATE TABLE service_type (
  id                  INTEGER PRIMARY KEY,
  code                TEXT    NOT NULL UNIQUE,
  name                TEXT    NOT NULL,
  -- Drives which roles are required: preside and distribution are communion-only.
  is_communion        INTEGER NOT NULL DEFAULT 0 CHECK (is_communion IN (0, 1)),
  default_start_time  TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order          INTEGER NOT NULL DEFAULT 100,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (default_start_time IS NULL
         OR default_start_time GLOB '[0-2][0-9]:[0-5][0-9]')
) STRICT;

-- The regular skeleton: "Sunday 10:30 Worship, except the 2nd Sunday which is
-- Holy Communion" — which is exactly what the sheet shows (communion falls on
-- 13 Sept, 11 Oct, 8 Nov).  Patterns are EXPANDED INTO service ROWS when a rota
-- is generated, never evaluated at read time, so editing one Sunday is an
-- ordinary row edit that the pattern can never silently undo.
CREATE TABLE service_pattern (
  id              INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL,
  service_type_id INTEGER NOT NULL REFERENCES service_type(id) ON DELETE RESTRICT,
  room_id         INTEGER REFERENCES room(id) ON DELETE SET NULL,
  -- 0 = Sunday, matching SQLite's strftime('%w').
  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time      TEXT    NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  -- CSV of ordinals within the month, e.g. '2' for the second Sunday, '1,3,4,5'
  -- for all the others.  NULL = every occurrence of that weekday.
  weeks_of_month  TEXT,
  active_from     TEXT    NOT NULL
                          CHECK (active_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  active_to       TEXT    CHECK (active_to IS NULL
                          OR active_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (active_to IS NULL OR active_to >= active_from)
) STRICT;

CREATE TABLE service (
  id                INTEGER PRIMARY KEY,
  service_date      TEXT    NOT NULL
                            CHECK (service_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_time        TEXT    NOT NULL
                            CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  end_time          TEXT    CHECK (end_time IS NULL
                            OR end_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  service_type_id   INTEGER NOT NULL REFERENCES service_type(id) ON DELETE RESTRICT,

  -- Free text overriding the type's name, for the irregular ones the sheet
  -- carries: 'Messy Christingle', 'Carols at Whitemead', 'LIFT'.
  title             TEXT,
  -- The season or theme, which changes service by service while the type
  -- repeats: 'Hope', 'Peace', 'Lent 2', 'HARVEST'.  Deliberately a separate
  -- axis from service_type — the sheet writes 'Peace Holy Communion' as one
  -- string, but Peace is not a kind of service.
  theme             TEXT,

  -- Copied from service_type at creation, then editable: a Worship service can
  -- add communion for one week without inventing a new type.  The generator and
  -- the shortfall view read THIS column, never the type's.
  is_communion      INTEGER NOT NULL DEFAULT 0 CHECK (is_communion IN (0, 1)),

  -- At most one of: a room of ours, or an outside place.  The sheet has both
  -- kinds — 'Bream Cenotaph' for Remembrance, 'Whitemead' for the carols.
  -- Both NULL is legal and means "not decided yet".
  room_id           INTEGER REFERENCES room(id) ON DELETE SET NULL,
  location_text     TEXT,

  -- Requirement 5: the vicar fills these in ahead of time.
  sermon_title      TEXT,
  sermon_notes      TEXT,
  -- The Readings cell verbatim, for import fidelity and for the case where the
  -- vicar types something the parser cannot split into rows.
  readings_raw      TEXT,

  status            TEXT    NOT NULL DEFAULT 'planned'
                            CHECK (status IN ('planned', 'published', 'cancelled')),
  notes             TEXT,

  pattern_id        INTEGER REFERENCES service_pattern(id) ON DELETE SET NULL,
  -- Stable key derived from the source sheet, so re-running an import updates
  -- rather than duplicates.  NULL for services created in the app.
  import_key        TEXT UNIQUE,

  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (end_time IS NULL OR end_time > start_time),
  CHECK (NOT (room_id IS NOT NULL AND location_text IS NOT NULL))
) STRICT;

-- Requirement 5.  Ordered rows rather than one blob, because the sheet pairs
-- them with readers: two readings, two readers, the first reading to the first
-- reader.  service.readings_raw keeps the original text either way.
CREATE TABLE service_reading (
  id            INTEGER PRIMARY KEY,
  service_id    INTEGER NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 1,
  reference     TEXT    NOT NULL,       -- 'Rom 8:18-30'
  bible_version TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (service_id, sort_order),
  CHECK (length(trim(reference)) > 0),
  CHECK (sort_order >= 1)
) STRICT;


------------------------------------------------------------------------------
-- 6. ASSIGNMENTS AND GENERATION
--
-- WHY `kind` EXISTS.  A cell in the person columns of the real sheet is not
-- always a person.  Measured from the file: the Music column holds 'Worship
-- Lyrics' and 'Parkend silver band'; Laptop holds 'Sheets'; Tea/Coffee holds
-- 'self-serve' and 'Mulled wine, Pies'; the two Christmas services hold 'N/A'
-- across every helper column and one row says 'ad hoc'.  Three meanings hide in
-- there:
--   person       — a name to resolve
--   note         — a real arrangement that is not a person ('Worship Lyrics')
--   not_required — this role does not run at this service ('N/A', 'None')
-- Only the third should silence the unfilled-role warning.  Flattening all
-- three to NULL would make the dashboard lie in both directions: it would nag
-- about Christmas Eve children's work that was never going to run, and stay
-- quiet about a sound desk with nobody on it.
------------------------------------------------------------------------------

CREATE TABLE generation_run (
  id                  INTEGER PRIMARY KEY,
  created_by_admin_id INTEGER REFERENCES admin_user(id) ON DELETE SET NULL,
  from_date           TEXT    NOT NULL
                              CHECK (from_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  to_date             TEXT    NOT NULL
                              CHECK (to_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  -- Weights and switches the run used, so a rota can be explained afterwards.
  params_json         TEXT,
  -- What it could not fill, and why.  This is what the admin reads after
  -- pressing Generate, and it is the honest half of "a first stab".
  report_json         TEXT,
  status              TEXT    NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'applied', 'discarded')),
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (to_date >= from_date)
) STRICT;

CREATE TABLE assignment (
  id                INTEGER PRIMARY KEY,
  service_id        INTEGER NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  -- RESTRICT: a role that has ever been used cannot be deleted out from under
  -- the history.  Retiring a role means role.is_active = 0.
  role_id           INTEGER NOT NULL REFERENCES role(id) ON DELETE RESTRICT,
  -- RESTRICT for the same reason: people are deactivated or merged, not deleted.
  person_id         INTEGER REFERENCES person(id) ON DELETE RESTRICT,

  kind              TEXT    NOT NULL DEFAULT 'person'
                            CHECK (kind IN ('person', 'note', 'not_required')),
  -- The cell exactly as written.  Kept forever: it is the evidence when a
  -- resolution is questioned, and the only way to re-resolve after a merge.
  raw_text          TEXT,

  -- 'proposed' is the generator's first stab; 'confirmed' a human has agreed.
  -- Requirement 6 turns entirely on these two being distinguishable, and
  -- requirement 9 counts both as filled — an unconfirmed name is not a hole.
  status            TEXT    NOT NULL DEFAULT 'proposed'
                            CHECK (status IN ('proposed', 'confirmed', 'declined', 'cancelled')),
  source            TEXT    NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('manual', 'generator', 'import')),
  generation_run_id INTEGER REFERENCES generation_run(id) ON DELETE SET NULL,

  -- Preserves the order names appeared in the cell, so reading 1 lines up with
  -- reader 1.  Not unique: a role legitimately holds several people.
  sort_order        INTEGER NOT NULL DEFAULT 1,

  -- Set when import could not resolve raw_text to exactly one person: 'Don?'
  -- (the sheet's own question mark), or 'Matt' where two Matts exist.
  needs_review      INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
  review_note       TEXT,

  confirmed_at      INTEGER,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch()),

  -- A note or a not_required marker never names a person.
  CHECK (kind = 'person' OR person_id IS NULL),
  -- A person row without a person is legal only while flagged for review.
  CHECK (kind <> 'person' OR person_id IS NOT NULL OR needs_review = 1),
  -- A note must actually say something, or it is just a hole with a label.
  CHECK (kind <> 'note' OR length(trim(coalesce(raw_text, ''))) > 0),
  CHECK (sort_order >= 1)
) STRICT;

-- The same person may not hold the same role twice in one service.  Partial, so
-- a cancelled row does not block putting them back.
CREATE UNIQUE INDEX ux_assignment_person_once_per_role
  ON assignment (service_id, role_id, person_id)
  WHERE person_id IS NOT NULL AND status <> 'cancelled';

-- 'not_required' is a statement about the whole role at that service, so there
-- may be only one such row per service and role.
CREATE UNIQUE INDEX ux_assignment_not_required_once
  ON assignment (service_id, role_id)
  WHERE kind = 'not_required' AND status <> 'cancelled';


------------------------------------------------------------------------------
-- 7. AVAILABILITY AND CHANGE REQUESTS  (requirement 7)
------------------------------------------------------------------------------

CREATE TABLE unavailability (
  id                  INTEGER PRIMARY KEY,
  person_id           INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  starts_on           TEXT    NOT NULL
                              CHECK (starts_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  -- Inclusive.  A single day is starts_on = ends_on.
  ends_on             TEXT    NOT NULL
                              CHECK (ends_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  -- NULL = away altogether.  Set = still around, but not for this role.
  role_id             INTEGER REFERENCES role(id) ON DELETE CASCADE,
  reason              TEXT,
  -- NULL when the person entered it themselves through their emailed link.
  created_by_admin_id INTEGER REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (ends_on >= starts_on)
) STRICT;

CREATE TABLE change_request (
  id                     INTEGER PRIMARY KEY,
  assignment_id          INTEGER NOT NULL REFERENCES assignment(id) ON DELETE CASCADE,
  requested_by_person_id INTEGER NOT NULL REFERENCES person(id) ON DELETE RESTRICT,
  kind                   TEXT    NOT NULL
                                 CHECK (kind IN ('release', 'swap', 'query')),
  message                TEXT,
  -- For a swap: who they have already spoken to.
  proposed_person_id     INTEGER REFERENCES person(id) ON DELETE SET NULL,
  status                 TEXT    NOT NULL DEFAULT 'open'
                                 CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn')),
  response_note          TEXT,
  resolved_by_admin_id   INTEGER REFERENCES admin_user(id) ON DELETE SET NULL,
  resolved_at            INTEGER,
  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (proposed_person_id IS NULL
         OR proposed_person_id <> requested_by_person_id),
  -- A closed request has a closing date; an open one does not.
  CHECK ((status = 'open') = (resolved_at IS NULL))
) STRICT;

-- One live request per assignment per person; resolved ones do not block a new
-- one, so a declined swap can be followed by a release.
CREATE UNIQUE INDEX ux_change_request_one_open
  ON change_request (assignment_id, requested_by_person_id)
  WHERE status = 'open';


------------------------------------------------------------------------------
-- 8. EVENTS AND PUBLIC BOOKING  (area C)
--
-- Declared before room_booking because room_booking references event(id), and
-- SQLite resolves a foreign key's parent table when the child is first written
-- to.  Keeping the order right means the file applies top to bottom with no
-- deferred-FK dance.
------------------------------------------------------------------------------

CREATE TABLE event (
  id                INTEGER PRIMARY KEY,
  slug              TEXT    NOT NULL UNIQUE,   -- public URL segment
  title             TEXT    NOT NULL,
  summary           TEXT,
  description       TEXT,
  starts_at         INTEGER NOT NULL,          -- epoch seconds, UTC
  ends_at           INTEGER NOT NULL,
  room_id           INTEGER REFERENCES room(id) ON DELETE SET NULL,
  location_text     TEXT,

  -- NULL = unlimited.  Counted in PEOPLE, against the sum of party_size rather
  -- than the number of bookings: one booking for a family of five takes five
  -- places.  Enforced by trigger, below.
  capacity          INTEGER,
  booking_opens_at  INTEGER,
  booking_closes_at INTEGER,
  is_published      INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  allow_waitlist    INTEGER NOT NULL DEFAULT 0 CHECK (allow_waitlist IN (0, 1)),

  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (ends_at > starts_at),
  CHECK (capacity IS NULL OR capacity > 0),
  CHECK (booking_closes_at IS NULL OR booking_opens_at IS NULL
         OR booking_closes_at >= booking_opens_at),
  CHECK (length(trim(slug)) > 0),
  CHECK (length(trim(title)) > 0),
  CHECK (NOT (room_id IS NOT NULL AND location_text IS NOT NULL))
) STRICT;

-- The admin designs the booking form while creating the event: attendee count,
-- food preferences, allergies, whatever this particular event needs.  Fields
-- are rows, so a new question never means a schema change.
CREATE TABLE event_form_field (
  id            INTEGER PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  -- Stable machine key, used in the answer table and as the CSV column heading.
  field_key     TEXT    NOT NULL,
  label         TEXT    NOT NULL,
  help_text     TEXT,
  field_type    TEXT    NOT NULL
                        CHECK (field_type IN ('text', 'textarea', 'number',
                                              'select', 'multiselect',
                                              'checkbox', 'date', 'email', 'phone')),
  is_required   INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  -- JSON array of choices; required for select/multiselect, forbidden otherwise.
  options_json  TEXT,
  max_length    INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),

  UNIQUE (event_id, field_key),
  CHECK (length(trim(field_key)) > 0 AND length(trim(label)) > 0),
  CHECK (max_length IS NULL OR max_length > 0),
  -- A dropdown with no choices is a broken form, and choices on a free-text box
  -- are a mistake.  Catching both here keeps the renderer free of guesswork.
  CHECK ((field_type IN ('select', 'multiselect')) = (options_json IS NOT NULL))
) STRICT;

CREATE TABLE event_booking (
  id            INTEGER PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  -- Short human reference quoted in the confirmation email.
  reference     TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  email         TEXT,
  phone         TEXT,
  party_size    INTEGER NOT NULL DEFAULT 1,
  status        TEXT    NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('pending', 'confirmed', 'waitlisted', 'cancelled')),
  -- Set when the booker is a known member; NULL for the general public, who are
  -- deliberately NOT added to the volunteer roster by booking an event.
  person_id     INTEGER REFERENCES person(id) ON DELETE SET NULL,
  notes         TEXT,
  confirmed_at  INTEGER,
  cancelled_at  INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (party_size >= 1),
  CHECK (length(trim(name)) > 0),
  CHECK (length(trim(reference)) > 0),
  CHECK (email IS NULL OR email LIKE '%_@_%')
) STRICT;

CREATE TABLE event_booking_answer (
  id          INTEGER PRIMARY KEY,
  booking_id  INTEGER NOT NULL REFERENCES event_booking(id)     ON DELETE CASCADE,
  field_id    INTEGER NOT NULL REFERENCES event_form_field(id)  ON DELETE CASCADE,
  -- Every answer is text; multiselect holds a JSON array.  The field's declared
  -- type tells the reader how to parse it.  One column is what keeps the form
  -- generic — a typed column per field type would defeat the purpose.
  value_text  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (booking_id, field_id)
) STRICT;


------------------------------------------------------------------------------
-- 9. ROOM BOOKING  (area B)
--
-- THE DOUBLE-BOOKING STORY.  SQLite has no exclusion constraint, so "these two
-- bookings must not overlap" cannot be declared.  There are two honest options:
--   (a) chop the day into fixed slots and use a UNIQUE index — ruled out by the
--       church's hours, which include 09:00, 16:00, 18:00 and 23:30 starts;
--   (b) enforce it with triggers.
-- This uses (b): BEFORE INSERT and BEFORE UPDATE triggers that ABORT on any
-- overlap with a live booking of the same room.  They are the guarantee, not a
-- convenience — they hold even if two requests race past an application-level
-- check, because the trigger runs inside the same statement's transaction.
-- Cancelled bookings are excluded from the test, so cancelling frees the slot.
--
-- Instants here are epoch seconds, not local text: overlap arithmetic has to be
-- exact, including across the March and October clock changes.
------------------------------------------------------------------------------

CREATE TABLE room_booking (
  id                  INTEGER PRIMARY KEY,
  room_id             INTEGER NOT NULL REFERENCES room(id) ON DELETE RESTRICT,
  title               TEXT    NOT NULL,
  purpose             TEXT,
  starts_at           INTEGER NOT NULL,   -- epoch seconds, UTC
  ends_at             INTEGER NOT NULL,   -- exclusive: 10:00-11:00 and 11:00-12:00 do not clash
  status              TEXT    NOT NULL DEFAULT 'confirmed'
                              CHECK (status IN ('provisional', 'confirmed', 'cancelled')),

  -- A booking may be the room side of a service or of an event, or freestanding.
  -- Routing services through here is what gives the main church the same
  -- double-booking protection as the meeting rooms, for free.
  service_id          INTEGER REFERENCES service(id) ON DELETE CASCADE,
  event_id            INTEGER REFERENCES event(id)   ON DELETE CASCADE,

  booked_by_person_id INTEGER REFERENCES person(id) ON DELETE SET NULL,
  contact_name        TEXT,
  contact_email       TEXT,
  contact_phone       TEXT,
  notes               TEXT,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (ends_at > starts_at),
  CHECK (length(trim(title)) > 0),
  CHECK (NOT (service_id IS NOT NULL AND event_id IS NOT NULL)),
  CHECK (contact_email IS NULL OR contact_email LIKE '%_@_%')
) STRICT;


------------------------------------------------------------------------------
-- 10. SPREADSHEET IMPORT AUDIT
--
-- Keeps the provenance of every imported row, so a reviewer looking at a
-- doubtful name can be shown the original cell rather than asked to trust it.
------------------------------------------------------------------------------

CREATE TABLE import_batch (
  id                   INTEGER PRIMARY KEY,
  filename             TEXT    NOT NULL,
  imported_by_admin_id INTEGER REFERENCES admin_user(id) ON DELETE SET NULL,
  row_count            INTEGER NOT NULL DEFAULT 0,
  -- How many cells the import refused to guess at.  The number the admin has to
  -- work through before the rota can be trusted.
  review_count         INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

CREATE TABLE import_row (
  id          INTEGER PRIMARY KEY,
  batch_id    INTEGER NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
  sheet_name  TEXT    NOT NULL,
  row_number  INTEGER NOT NULL,
  -- The row as read, heading -> cell text.  The evidence.
  raw_json    TEXT    NOT NULL,
  service_id  INTEGER REFERENCES service(id) ON DELETE SET NULL,
  status      TEXT    NOT NULL DEFAULT 'imported'
                      CHECK (status IN ('imported', 'skipped', 'failed')),
  message     TEXT,
  UNIQUE (batch_id, sheet_name, row_number)
) STRICT;


------------------------------------------------------------------------------
-- 11. SETTINGS AND AUDIT
------------------------------------------------------------------------------

CREATE TABLE app_setting (
  key         TEXT    PRIMARY KEY,
  value       TEXT    NOT NULL,
  description TEXT,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

-- Who changed whose slot.  A rota is a social document; the answer to "why am I
-- on twice in March" should not have to be a shrug.
CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY,
  admin_user_id INTEGER REFERENCES admin_user(id) ON DELETE SET NULL,
  person_id     INTEGER REFERENCES person(id)     ON DELETE SET NULL,
  action        TEXT    NOT NULL,
  entity_table  TEXT    NOT NULL,
  entity_id     INTEGER,
  detail_json   TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

------------------------------------------------------------------------------
-- 12. INDEXES
--
-- Only indexes that serve a query the application actually makes.  The unique
-- indexes above are constraints and live with their tables; these are for speed.
------------------------------------------------------------------------------

-- Dashboard: "the next N services", and every date-range screen.
CREATE INDEX ix_service_date          ON service (service_date, start_time);
CREATE INDEX ix_service_status_date   ON service (status, service_date);
CREATE INDEX ix_service_pattern       ON service (pattern_id) WHERE pattern_id IS NOT NULL;

-- Click through from a service to who is on what.
CREATE INDEX ix_assignment_service    ON assignment (service_id, role_id, sort_order);
-- "Where is Sheila on over the next three months", and the generator's
-- frequency check, which walks a person's history in one role.
CREATE INDEX ix_assignment_person     ON assignment (person_id, role_id)
                                         WHERE person_id IS NOT NULL;
CREATE INDEX ix_assignment_run        ON assignment (generation_run_id)
                                         WHERE generation_run_id IS NOT NULL;
-- The review queue after an import.
CREATE INDEX ix_assignment_review     ON assignment (needs_review) WHERE needs_review = 1;

-- Generator: candidate lookup for a role, and the settings screen per person.
CREATE INDEX ix_person_role_role      ON person_role (role_id) WHERE is_active = 1;
-- The people list, and the review queue.
CREATE INDEX ix_person_active         ON person (is_active, display_name);
CREATE INDEX ix_person_review         ON person (needs_review) WHERE needs_review = 1;
CREATE INDEX ix_person_alias_person   ON person_alias (person_id);

-- Generator: "is this person away on that date".  Leading person_id then the
-- range end, so a single scan settles it.
CREATE INDEX ix_unavailability_person ON unavailability (person_id, ends_on, starts_on);
-- Admin view of everyone away in a period.
CREATE INDEX ix_unavailability_dates  ON unavailability (starts_on, ends_on);

-- Pairing lookups go both ways, so both columns are led once.
CREATE INDEX ix_pairing_a             ON pairing_preference (person_a_id);
CREATE INDEX ix_pairing_b             ON pairing_preference (person_b_id);

-- The admin's open queue.
CREATE INDEX ix_change_request_status ON change_request (status, created_at);
CREATE INDEX ix_change_request_assign ON change_request (assignment_id);

-- Room diary, and the overlap test in the triggers below: room first, then
-- start, so the scan is confined to one room's bookings around the time asked.
CREATE INDEX ix_room_booking_room     ON room_booking (room_id, starts_at, ends_at);
CREATE INDEX ix_room_booking_service  ON room_booking (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX ix_room_booking_event    ON room_booking (event_id)   WHERE event_id   IS NOT NULL;

-- Public "what's on" list, and the admin's event list.
CREATE INDEX ix_event_published       ON event (is_published, starts_at);
CREATE INDEX ix_event_form_field_ev   ON event_form_field (event_id, sort_order);
-- Capacity sum, and the attendee list for one event.
CREATE INDEX ix_event_booking_event   ON event_booking (event_id, status);
CREATE INDEX ix_event_booking_answer  ON event_booking_answer (field_id);

-- Session sweep: delete everything already expired.
CREATE INDEX ix_admin_session_expiry  ON admin_session (expires_at);
CREATE INDEX ix_person_token_expiry   ON person_access_token (expires_at);
CREATE INDEX ix_person_token_person   ON person_access_token (person_id);

CREATE INDEX ix_import_row_batch      ON import_row (batch_id, sheet_name, row_number);
CREATE INDEX ix_audit_log_created     ON audit_log (created_at);
CREATE INDEX ix_audit_log_entity      ON audit_log (entity_table, entity_id);


------------------------------------------------------------------------------
-- 13. TRIGGERS — the constraints SQLite cannot declare
------------------------------------------------------------------------------

-- Room double-booking.  Half-open intervals: [starts_at, ends_at).  Two
-- bookings overlap when each starts before the other ends, so a 10:00-11:00 and
-- an 11:00-12:00 booking sit next to each other without clashing.
CREATE TRIGGER trg_room_booking_no_overlap_insert
BEFORE INSERT ON room_booking
FOR EACH ROW WHEN NEW.status IN ('provisional', 'confirmed')
BEGIN
  SELECT RAISE(ABORT, 'room_booking: that room is already booked for part of this time')
  WHERE EXISTS (
    SELECT 1 FROM room_booking b
     WHERE b.room_id = NEW.room_id
       AND b.status IN ('provisional', 'confirmed')
       AND b.starts_at < NEW.ends_at
       AND b.ends_at   > NEW.starts_at
  );
END;

CREATE TRIGGER trg_room_booking_no_overlap_update
BEFORE UPDATE OF room_id, starts_at, ends_at, status ON room_booking
FOR EACH ROW WHEN NEW.status IN ('provisional', 'confirmed')
BEGIN
  SELECT RAISE(ABORT, 'room_booking: that room is already booked for part of this time')
  WHERE EXISTS (
    SELECT 1 FROM room_booking b
     WHERE b.room_id = NEW.room_id
       AND b.id <> NEW.id
       AND b.status IN ('provisional', 'confirmed')
       AND b.starts_at < NEW.ends_at
       AND b.ends_at   > NEW.starts_at
  );
END;

-- Event capacity, counted in people rather than bookings.  A booking for a
-- family of five takes five of the places.  Waitlisted and cancelled bookings
-- do not consume capacity, which is what makes a waitlist work.
CREATE TRIGGER trg_event_booking_capacity_insert
BEFORE INSERT ON event_booking
FOR EACH ROW WHEN NEW.status IN ('pending', 'confirmed')
BEGIN
  SELECT RAISE(ABORT, 'event_booking: that would take the event over capacity')
  WHERE (SELECT e.capacity FROM event e WHERE e.id = NEW.event_id) IS NOT NULL
    AND NEW.party_size
      + coalesce((SELECT sum(b.party_size) FROM event_booking b
                   WHERE b.event_id = NEW.event_id
                     AND b.status IN ('pending', 'confirmed')), 0)
      > (SELECT e.capacity FROM event e WHERE e.id = NEW.event_id);
END;

CREATE TRIGGER trg_event_booking_capacity_update
BEFORE UPDATE OF party_size, status, event_id ON event_booking
FOR EACH ROW WHEN NEW.status IN ('pending', 'confirmed')
BEGIN
  SELECT RAISE(ABORT, 'event_booking: that would take the event over capacity')
  WHERE (SELECT e.capacity FROM event e WHERE e.id = NEW.event_id) IS NOT NULL
    AND NEW.party_size
      + coalesce((SELECT sum(b.party_size) FROM event_booking b
                   WHERE b.event_id = NEW.event_id
                     AND b.id <> NEW.id
                     AND b.status IN ('pending', 'confirmed')), 0)
      > (SELECT e.capacity FROM event e WHERE e.id = NEW.event_id);
END;

-- An answer must belong to a field of the event being booked.  Without this,
-- nothing stops the allergies answer from the Harvest supper being filed
-- against a booking for the Christmas fair.
CREATE TRIGGER trg_event_answer_field_matches_event
BEFORE INSERT ON event_booking_answer
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'event_booking_answer: field belongs to a different event')
  WHERE (SELECT f.event_id FROM event_form_field f WHERE f.id = NEW.field_id)
     <> (SELECT b.event_id FROM event_booking    b WHERE b.id = NEW.booking_id);
END;

-- Merges must not form a chain: A -> B -> C would make "who is A really" a walk
-- of unknown length.  Point every loser straight at the survivor.
CREATE TRIGGER trg_person_merge_no_chain
BEFORE UPDATE OF merged_into_person_id ON person
FOR EACH ROW WHEN NEW.merged_into_person_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'person: cannot merge into a person who is themselves merged')
  WHERE EXISTS (
    SELECT 1 FROM person t
     WHERE t.id = NEW.merged_into_person_id
       AND t.merged_into_person_id IS NOT NULL
  );
END;


------------------------------------------------------------------------------
-- 14. VIEWS
------------------------------------------------------------------------------

-- Requirement 9, and the engine behind the dashboard warning.  One row per
-- service per role that APPLIES to it — communion-only roles appear only where
-- there is communion, which is why the Preside column being empty on an
-- ordinary Worship service raises nothing.
--
-- 'proposed' counts as filled: the generator's first stab is a name, not a
-- hole.  A 'not_required' row waives the requirement entirely, which is how the
-- sheet's 'N/A' on the Christmas services stops the warning honestly instead of
-- by pretending somebody is on.
CREATE VIEW v_service_role_requirement AS
SELECT
  x.service_id,
  x.service_date,
  x.start_time,
  x.service_title,
  x.is_communion,
  x.role_id,
  x.role_code,
  x.role_name,
  x.min_needed,
  x.ideal_needed,
  x.filled,
  x.waived,
  x.needs_review_count,
  CASE WHEN x.waived = 1 THEN 0 ELSE max(0, x.min_needed   - x.filled) END AS short_of_min,
  CASE WHEN x.waived = 1 THEN 0 ELSE max(0, x.ideal_needed - x.filled) END AS short_of_ideal
FROM (
  SELECT
    s.id                          AS service_id,
    s.service_date                AS service_date,
    s.start_time                  AS start_time,
    coalesce(s.title, st.name)    AS service_title,
    s.is_communion                AS is_communion,
    r.id                          AS role_id,
    r.code                        AS role_code,
    r.name                        AS role_name,
    r.min_needed                  AS min_needed,
    r.ideal_needed                AS ideal_needed,
    coalesce(sum(CASE WHEN a.kind = 'person' AND a.person_id IS NOT NULL
                      THEN 1 ELSE 0 END), 0)                       AS filled,
    coalesce(max(CASE WHEN a.kind = 'not_required' THEN 1 ELSE 0 END), 0) AS waived,
    coalesce(sum(CASE WHEN a.needs_review = 1 THEN 1 ELSE 0 END), 0)      AS needs_review_count
  FROM service s
  JOIN service_type st ON st.id = s.service_type_id
  JOIN role r
    ON r.is_active = 1
   AND (r.communion_only = 0 OR s.is_communion = 1)
  LEFT JOIN assignment a
    ON a.service_id = s.id
   AND a.role_id    = r.id
   AND a.status IN ('proposed', 'confirmed')
  WHERE s.status <> 'cancelled'
  GROUP BY s.id, r.id
) x;

-- The dashboard list (requirement 8) with its warning flag (requirement 9).
CREATE VIEW v_service_staffing AS
SELECT
  service_id,
  service_date,
  start_time,
  service_title,
  is_communion,
  sum(CASE WHEN short_of_min   > 0 THEN 1 ELSE 0 END) AS roles_below_min,
  sum(CASE WHEN short_of_ideal > 0 THEN 1 ELSE 0 END) AS roles_below_ideal,
  sum(short_of_min)                                   AS people_short_of_min,
  sum(needs_review_count)                             AS assignments_needing_review,
  CASE WHEN sum(CASE WHEN short_of_min > 0 THEN 1 ELSE 0 END) > 0
       THEN 1 ELSE 0 END                              AS has_warning
FROM v_service_role_requirement
GROUP BY service_id, service_date, start_time, service_title, is_communion;

-- What the generator asks before offering anyone: when did they last do this,
-- and how often have they done it.  Feeds min_gap_days and target_interval_days.
CREATE VIEW v_person_role_last_served AS
SELECT
  a.person_id,
  a.role_id,
  max(s.service_date) AS last_served_on,
  count(*)            AS times_served
FROM assignment a
JOIN service s ON s.id = a.service_id
WHERE a.person_id IS NOT NULL
  AND a.kind   = 'person'
  AND a.status IN ('proposed', 'confirmed')
  AND s.status <> 'cancelled'
GROUP BY a.person_id, a.role_id;

-- One hop through a merge, so callers never walk the pointer themselves.  The
-- no-chain trigger above is what makes a single hop sufficient.
CREATE VIEW v_person_effective AS
SELECT
  p.id                                        AS person_id,
  coalesce(m.id, p.id)                        AS effective_person_id,
  coalesce(m.display_name, p.display_name)    AS effective_display_name,
  CASE WHEN p.merged_into_person_id IS NULL THEN 0 ELSE 1 END AS is_merged
FROM person p
LEFT JOIN person m ON m.id = p.merged_into_person_id;


------------------------------------------------------------------------------
-- 15. SEED DATA
------------------------------------------------------------------------------

INSERT INTO app_setting (key, value, description) VALUES
  ('church_name', 'Bream Church',
   'Shown in page titles and confirmation emails.'),
  ('timezone', 'Europe/London',
   'Services are stored as local date + time; bookings as UTC epochs. This is the zone that converts between them.'),
  ('combination_default', 'GREEN',
   'Verdict for a pair of roles with no row in role_combination_rule. GREEN means an unlisted combination is allowed; set to AMBER to make the generator wary of anything not explicitly blessed.'),
  ('default_max_per_window', '2',
   'Generator fallback ceiling when a person has stated no preference for a role.'),
  ('default_window_days', '28',
   'Window for default_max_per_window, in days.'),
  ('generate_horizon_months', '3',
   'How far ahead Generate runs by default (requirement 6).'),
  ('warn_unfilled_within_days', '35',
   'A service inside this many days with a role below its minimum raises the dashboard warning (requirement 9).');

-- Rooms, as named by the church.
INSERT INTO room (code, name, capacity, sort_order, notes) VALUES
  ('main_church',   'Main church',    250, 10, 'Used by the Sunday services.'),
  ('church_centre', 'Church Centre',   80, 20, NULL),
  ('prayer_room',   'Prayer room',      8, 30, NULL),
  ('sofa_room',     'Sofa room',       12, 40, NULL);

-- Roles, with the minimum and the ideal the church gave.  Children's work is
-- TWO roles, not one: the sheet rotas the two age bands independently, with
-- different people, and has done under two different sets of column headings.
INSERT INTO role (code, name, description, min_needed, ideal_needed, communion_only, sort_order) VALUES
  ('preacher',              'Preacher',                      NULL,                                     1, 1, 0, 10),
  ('service_leader',        'Service leader',                NULL,                                     1, 1, 0, 20),
  ('communion_preside',     'Communion preside',             'Communion services only.',               1, 1, 1, 30),
  ('communion_distribution','Communion distribution',        'Communion services only.',               4, 4, 1, 40),
  ('reader',                'Reader',                        'One per reading where there are two.',   2, 2, 0, 50),
  ('prayer_ministry',       'Prayer ministry',               'Two will do; four is what good looks like.', 2, 4, 0, 60),
  ('welcome',               'Welcome team',                  NULL,                                     2, 2, 0, 70),
  ('steward',               'Steward',                       NULL,                                     1, 1, 0, 80),
  ('worship_leader',        'Worship leader',                'The spreadsheet calls this Music.',      1, 1, 0, 90),
  ('sound',                 'Sound desk',                    NULL,                                     1, 1, 0, 100),
  ('computer',              'Computer',                      'The spreadsheet calls this Laptop.',     1, 1, 0, 110),
  ('tea_coffee',            'Tea/Coffee',                    NULL,                                     2, 2, 0, 120),
  ('children_rec_yr5',      'Children Rec-Yr5 (4-10yr)',     'Younger band.',                          2, 2, 0, 130),
  ('children_yr6_plus',     'Children Yr6+ (10-14yrs)',      'Older band, rota''d separately.',        2, 2, 0, 140);

-- Every column heading the spreadsheet has used for each role, including the
-- ones that drifted between tabs.  Import maps by these; a new heading next
-- year is one INSERT, not a code change.
WITH h(role_code, header_text) AS (VALUES
  ('preacher',              'Preacher'),
  ('service_leader',        'Leader'),
  ('service_leader',        'Service Leader'),
  ('communion_preside',     'Preside'),
  ('communion_distribution','Communion distribution'),
  ('reader',                'Readers'),
  ('prayer_ministry',       'Prayer Ministry'),
  ('welcome',               'Welcome'),
  ('steward',               'Steward'),
  ('worship_leader',        'Music'),
  ('sound',                 'Sound'),
  ('computer',              'Laptop'),
  ('tea_coffee',            'Tea/Coffee'),
  ('children_rec_yr5',      'Kids Church'),
  ('children_rec_yr5',      'Rec - Yr 5 (4yr-10yr)'),
  ('children_yr6_plus',     'Younger Youth'),
  ('children_yr6_plus',     'Yr 6 + 10-14yrs')
)
INSERT INTO role_header_alias (role_id, header_text)
SELECT r.id, h.header_text FROM h JOIN role r ON r.code = h.role_code;

-- Service types seen in the sheet.  The season ('Hope', 'Lent 2', 'HARVEST') is
-- NOT a type — it goes in service.theme, because it varies week by week while
-- the type repeats.
INSERT INTO service_type (code, name, is_communion, default_start_time, sort_order) VALUES
  ('worship',              'Worship',                 0, '10:30', 10),
  ('holy_communion',       'Holy Communion',          1, '10:30', 20),
  ('said_holy_communion',  'Said Holy Communion',     1, '09:00', 30),
  ('lift',                 'LIFT',                    0, '18:00', 40),
  ('messy_church',         'Messy Church',            0, '16:00', 50),
  ('christingle',          'Christingle',             0, '16:00', 60),
  ('carols',               'Carols by Candlelight',   0, '18:00', 70),
  ('nativity',             'Family Nativity Service', 0, '16:00', 80),
  ('remembrance',          'Remembrance',             0, '15:00', 90),
  ('reflection',           'Reflection',              0, NULL,   100);

-- The regular skeleton the sheet shows: Sunday 10:30 every week, except the
-- second Sunday of the month, which is Holy Communion (13 Sept, 11 Oct, 8 Nov).
-- Generate expands these into service rows; everything irregular is added by
-- hand and is never touched by a pattern.
INSERT INTO service_pattern (name, service_type_id, room_id, weekday, start_time, weeks_of_month, active_from)
SELECT 'Sunday morning worship', st.id, rm.id, 0, '10:30', '1,3,4,5', '2026-09-01'
  FROM service_type st, room rm WHERE st.code = 'worship' AND rm.code = 'main_church';

INSERT INTO service_pattern (name, service_type_id, room_id, weekday, start_time, weeks_of_month, active_from)
SELECT 'Second Sunday Holy Communion', st.id, rm.id, 0, '10:30', '2', '2026-09-01'
  FROM service_type st, room rm WHERE st.code = 'holy_communion' AND rm.code = 'main_church';

-- Role combination rules (requirement 3).  An unlisted pair falls back to
-- app_setting 'combination_default'.
--
-- RED here means the two duties happen AT THE SAME TIME IN DIFFERENT PLACES, so
-- one person cannot hold both however willing they are.  AMBER means workable
-- but not what you would choose.  GREEN is stated explicitly where the sheet
-- shows it happening regularly, so the generator does not merely tolerate the
-- combination but knows it is normal here.
--
-- The GREEN and AMBER rows below are read off the existing rota: Steve preaches
-- and leads and presides in the same service repeatedly; Matt R leads and plays
-- in the same service three times; Liv ran sound and laptop together once.
-- The RED rows are reasoning, not observation — none of them appears in the
-- sheet, which is the point.  Both sets are a starting position for the vicar
-- to correct, not a finding.
WITH v(code_a, code_b, verdict, reason) AS (VALUES
  -- Stated by the church.
  ('service_leader', 'worship_leader', 'AMBER', 'Leading the service and leading the music at once: done here, but it is a lot for one person.'),
  ('preacher', 'children_rec_yr5',    'RED',   'They would be preaching while children''s work runs.'),
  ('preacher', 'children_yr6_plus',   'RED',   'They would be preaching while children''s work runs.'),

  -- Front of house cannot also be out with the children.
  ('service_leader',        'children_rec_yr5',  'RED', 'Leading the service while children''s work runs.'),
  ('service_leader',        'children_yr6_plus', 'RED', 'Leading the service while children''s work runs.'),
  ('communion_preside',     'children_rec_yr5',  'RED', 'Presiding while children''s work runs.'),
  ('communion_preside',     'children_yr6_plus', 'RED', 'Presiding while children''s work runs.'),
  ('worship_leader',        'children_rec_yr5',  'RED', 'Leading the music while children''s work runs.'),
  ('worship_leader',        'children_yr6_plus', 'RED', 'Leading the music while children''s work runs.'),
  ('communion_distribution','children_rec_yr5',  'RED', 'Distributing communion while children''s work runs.'),
  ('communion_distribution','children_yr6_plus', 'RED', 'Distributing communion while children''s work runs.'),

  -- The desk cannot be left.
  ('sound', 'preacher',              'RED', 'The desk cannot be left while they preach.'),
  ('sound', 'service_leader',        'RED', 'The desk cannot be left while they lead.'),
  ('sound', 'worship_leader',        'RED', 'The desk cannot be left while they play.'),
  ('sound', 'communion_preside',     'RED', 'The desk cannot be left while they preside.'),
  ('sound', 'communion_distribution','RED', 'The desk cannot be left during distribution.'),
  ('sound', 'children_rec_yr5',      'RED', 'The desk cannot be left for children''s work.'),
  ('sound', 'children_yr6_plus',     'RED', 'The desk cannot be left for children''s work.'),
  ('computer', 'preacher',              'RED', 'Somebody has to advance the slides while they preach.'),
  ('computer', 'service_leader',        'RED', 'Somebody has to advance the slides while they lead.'),
  ('computer', 'worship_leader',        'RED', 'Somebody has to advance the slides while they play.'),
  ('computer', 'communion_preside',     'RED', 'Somebody has to advance the slides while they preside.'),
  ('computer', 'communion_distribution','RED', 'The laptop cannot be left during distribution.'),
  ('computer', 'children_rec_yr5',      'RED', 'The laptop cannot be left for children''s work.'),
  ('computer', 'children_yr6_plus',     'RED', 'The laptop cannot be left for children''s work.'),

  -- Workable, not ideal.
  ('sound',           'computer',          'AMBER', 'One person on both desk and laptop. It has been done, but it leaves nothing spare.'),
  ('reader',          'children_rec_yr5',  'AMBER', 'The reading comes before the children go out; tight but possible.'),
  ('reader',          'children_yr6_plus', 'AMBER', 'The reading comes before the children go out; tight but possible.'),
  ('welcome',         'children_rec_yr5',  'AMBER', 'Welcoming at the door, then out with the children.'),
  ('welcome',         'children_yr6_plus', 'AMBER', 'Welcoming at the door, then out with the children.'),
  ('prayer_ministry', 'children_rec_yr5',  'AMBER', 'Prayer ministry is at the end, as the children come back.'),
  ('prayer_ministry', 'children_yr6_plus', 'AMBER', 'Prayer ministry is at the end, as the children come back.'),
  ('preacher',        'reader',            'AMBER', 'Reading their own text. Happens when numbers are thin.'),
  ('preacher',        'tea_coffee',        'AMBER', 'Coffee is after the service, so it works, but they will want to be talking to people.'),

  -- Normal here, on the evidence of the existing rota.
  ('preacher',          'service_leader',        'GREEN', 'Routine here.'),
  ('preacher',          'communion_preside',     'GREEN', 'Routine here.'),
  ('preacher',          'communion_distribution','GREEN', 'Routine here.'),
  ('communion_preside', 'service_leader',        'GREEN', 'Routine here.'),
  ('communion_preside', 'communion_distribution','GREEN', 'The president distributes as well.'),
  ('welcome',           'tea_coffee',            'GREEN', 'The same pairs do both, one after the other.'),
  ('steward',           'communion_distribution','GREEN', 'Observed in the existing rota.')
)
INSERT INTO role_combination_rule (role_a_id, role_b_id, verdict, reason)
SELECT min(ra.id, rb.id), max(ra.id, rb.id), v.verdict, v.reason
FROM v
JOIN role ra ON ra.code = v.code_a
JOIN role rb ON rb.code = v.code_b;
