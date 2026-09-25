-- Safeguarding: which roles somebody holds, which courses each role needs, and
-- whether each person has done them.
--
-- Deliberately separate from the rota's roles. "Churchwarden" and "PCC member"
-- are offices, not jobs on a Sunday, and "working with children" cuts across a
-- dozen rota roles at once. Folding these into `roles` would put a PCC member
-- into every gap warning.
--
-- Which course each role needs is the church's call, set on one grid in
-- Settings, rather than written in here: the diocese changes its requirements
-- and nobody should need a programmer when it does. The roles and courses are
-- seeded with the ones the church named; the grid starts empty.

CREATE TABLE safeguarding_roles (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE safeguarding_courses (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 100
);

-- One row per tick on the Settings grid: this role needs this course.
CREATE TABLE safeguarding_requirements (
  role_id   INTEGER NOT NULL REFERENCES safeguarding_roles (id)   ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES safeguarding_courses (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, course_id)
);

-- Which safeguarding roles a person holds.
CREATE TABLE person_safeguarding_roles (
  person_id INTEGER NOT NULL REFERENCES people (id)             ON DELETE CASCADE,
  role_id   INTEGER NOT NULL REFERENCES safeguarding_roles (id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, role_id)
);

-- Whether a person has done a course. A row exists once somebody has answered
-- the question either way; no row means nobody has said. done_at is stamped
-- when it first becomes a yes, so "when did they do it?" has at least an
-- approximate answer. Kept when a role is untaken, because having done a
-- course stays true whether or not it is currently needed.
CREATE TABLE person_courses (
  person_id  INTEGER NOT NULL REFERENCES people (id)               ON DELETE CASCADE,
  course_id  INTEGER NOT NULL REFERENCES safeguarding_courses (id) ON DELETE CASCADE,
  done       INTEGER NOT NULL,
  done_at    TEXT,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (person_id, course_id),
  CHECK (done IN (0, 1))
);

INSERT INTO safeguarding_roles (name, sort_order) VALUES
  ('PCC member', 10),
  ('Churchwarden', 20),
  ('Safeguarding Officer', 30),
  ('Working with children or vulnerable adults', 40),
  ('Recruiter', 50);

INSERT INTO safeguarding_courses (name, sort_order) VALUES
  ('Basic Awareness', 10),
  ('Foundation', 20),
  ('Leadership', 30),
  ('Raising Awareness of Domestic Abuse', 40),
  ('Safer Recruitment and People Management', 50),
  ('PSO Induction', 60),
  ('DBS Check', 70);
