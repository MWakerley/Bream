-- User profiles: what a person is allowed to see.
--
-- Until now access was a single is_admin flag — administrator or not. That is
-- too blunt for a church: the person who books rooms has no business rewriting
-- the rota, and a volunteer needs their own dates without being able to edit
-- everybody else's.
--
-- A profile is a named set of AREAS. People are given a profile; the profile
-- decides which pages they can open. Areas are rows rather than columns so that
-- adding one later is a row, not a migration.
--
-- NOTE: credentials.must_change already exists, from the first migration. Every
-- page redirects to the change-password form while it is set, so a temporary
-- password cannot quietly become a permanent one.
CREATE TABLE profiles (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  -- The profile new people get unless told otherwise.
  is_default  INTEGER NOT NULL DEFAULT 0,
  -- Grants everything, including managing profiles. Kept as a flag so the system
  -- can refuse to leave itself with no way back in.
  is_admin    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per area a profile may open. Absence of a row means no access.
CREATE TABLE profile_areas (
  profile_id INTEGER NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  area       TEXT    NOT NULL,
  PRIMARY KEY (profile_id, area)
);

ALTER TABLE people ADD COLUMN profile_id INTEGER REFERENCES profiles (id) ON DELETE SET NULL;
ALTER TABLE people ADD COLUMN username TEXT;

-- Usernames are how people sign in, so they must be unique — but only where one
-- is set, and most of the imported volunteers have none.
CREATE UNIQUE INDEX people_username_unique ON people (username) WHERE username IS NOT NULL;

INSERT INTO profiles (name, description, is_default, is_admin) VALUES ('Administrator', 'Everything, including adding people and changing what others can see.', 0, 1);
INSERT INTO profiles (name, description, is_default, is_admin) VALUES ('Rota coordinator', 'Builds and publishes the rota. Can see people and services.', 0, 0);
INSERT INTO profiles (name, description, is_default, is_admin) VALUES ('Room bookings', 'Books rooms and runs events. Cannot change the rota.', 0, 0);
INSERT INTO profiles (name, description, is_default, is_admin) VALUES ('Volunteer', 'Their own dates, and a read-only view of what is on.', 1, 0);

INSERT INTO profile_areas (profile_id, area) SELECT id, 'rota' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rota.manage' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rooms' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rooms.manage' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'events' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'events.manage' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'me' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'settings' FROM profiles WHERE name = 'Administrator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rota' FROM profiles WHERE name = 'Rota coordinator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rota.manage' FROM profiles WHERE name = 'Rota coordinator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rooms' FROM profiles WHERE name = 'Rota coordinator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'events' FROM profiles WHERE name = 'Rota coordinator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'me' FROM profiles WHERE name = 'Rota coordinator';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rota' FROM profiles WHERE name = 'Room bookings';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rooms' FROM profiles WHERE name = 'Room bookings';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rooms.manage' FROM profiles WHERE name = 'Room bookings';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'events' FROM profiles WHERE name = 'Room bookings';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'events.manage' FROM profiles WHERE name = 'Room bookings';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'me' FROM profiles WHERE name = 'Room bookings';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rota' FROM profiles WHERE name = 'Volunteer';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'rooms' FROM profiles WHERE name = 'Volunteer';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'events' FROM profiles WHERE name = 'Volunteer';
INSERT INTO profile_areas (profile_id, area) SELECT id, 'me' FROM profiles WHERE name = 'Volunteer';

-- Anyone who is already an administrator stays one; everybody else starts as a
-- volunteer, which is the least that lets them see their own dates.
UPDATE people SET profile_id = (SELECT id FROM profiles WHERE name = 'Administrator') WHERE is_admin = 1;
UPDATE people SET profile_id = (SELECT id FROM profiles WHERE name = 'Volunteer') WHERE is_admin = 0 AND profile_id IS NULL;
