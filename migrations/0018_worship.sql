-- The worship team's own roster.
--
-- Deliberately separate from the main rota rather than fourteen more roles on
-- it. The worship leader works out who is playing what, week by week, and that
-- is a different job from the churchwarden working out who is preaching — done
-- by a different person, at a different time, to different rules. Folding it
-- into `roles` would put a drummer into every gap warning, every combination
-- rule and every fair-share calculation, none of which mean anything here.
--
-- Nothing is compulsory. A service with no worship plan at all is normal, and
-- so is a plan with only two singers named.

CREATE TABLE worship_plans (
  id         INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL UNIQUE REFERENCES services (id) ON DELETE CASCADE,
  -- 'live'   — a band, so every instrument is offered
  -- 'lyrics' — sung to recorded music, so only voices are
  kind       TEXT    NOT NULL DEFAULT 'live',
  notes      TEXT,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (kind IN ('live', 'lyrics'))
);

-- One row per position filled. A position nobody is on simply has no row, which
-- is what makes "you don't have to have all of these" the default rather than a
-- special case.
--
-- person_id OR name: most of the band are on the roster, but a visiting
-- musician or somebody's son who plays drums once is not, and making the
-- worship leader add them to the church roster first would be a barrier to
-- writing down something true. Exactly one of the two is set.
CREATE TABLE worship_slots (
  id        INTEGER PRIMARY KEY,
  plan_id   INTEGER NOT NULL REFERENCES worship_plans (id) ON DELETE CASCADE,
  -- 'drums' | 'bass' | 'guitar' | 'keys' | 'singer1' | 'singer2' | 'singer3'
  position  TEXT    NOT NULL,
  person_id INTEGER REFERENCES people (id) ON DELETE SET NULL,
  name      TEXT,
  UNIQUE (plan_id, position),
  CHECK (person_id IS NOT NULL OR (name IS NOT NULL AND name <> ''))
);

CREATE INDEX worship_slots_by_plan ON worship_slots (plan_id);
