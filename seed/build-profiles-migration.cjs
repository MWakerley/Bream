// Generates migrations/0014_profiles_and_logins.sql.
//
// Written by a script rather than by hand because the permission rows are a
// product of profiles x areas, and D1 refuses even a handful of UNION ALL terms
// in one statement — so each row needs its own INSERT.
const fs = require('fs');

const AREAS = {
  Administrator: ['rota', 'rota.manage', 'rooms', 'rooms.manage', 'events', 'events.manage', 'me', 'settings'],
  'Rota coordinator': ['rota', 'rota.manage', 'rooms', 'events', 'me'],
  'Room bookings': ['rota', 'rooms', 'rooms.manage', 'events', 'events.manage', 'me'],
  Volunteer: ['rota', 'rooms', 'events', 'me'],
};

const q = (x) => (x == null ? 'NULL' : "'" + String(x).replace(/'/g, "''") + "'");

const L = [];
L.push(`-- User profiles: what a person is allowed to see.
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
`);

const PROFILES = [
  ['Administrator', 'Everything, including adding people and changing what others can see.', 0, 1],
  ['Rota coordinator', 'Builds and publishes the rota. Can see people and services.', 0, 0],
  ['Room bookings', 'Books rooms and runs events. Cannot change the rota.', 0, 0],
  ['Volunteer', 'Their own dates, and a read-only view of what is on.', 1, 0],
];
for (const [name, desc, isDefault, isAdmin] of PROFILES) {
  L.push(`INSERT INTO profiles (name, description, is_default, is_admin) VALUES (${q(name)}, ${q(desc)}, ${isDefault}, ${isAdmin});`);
}
L.push('');

for (const [profile, areas] of Object.entries(AREAS)) {
  for (const area of areas) {
    L.push(`INSERT INTO profile_areas (profile_id, area) SELECT id, ${q(area)} FROM profiles WHERE name = ${q(profile)};`);
  }
}
L.push('');
L.push(`-- Anyone who is already an administrator stays one; everybody else starts as a
-- volunteer, which is the least that lets them see their own dates.
UPDATE people SET profile_id = (SELECT id FROM profiles WHERE name = 'Administrator') WHERE is_admin = 1;
UPDATE people SET profile_id = (SELECT id FROM profiles WHERE name = 'Volunteer') WHERE is_admin = 0 AND profile_id IS NULL;`);

fs.writeFileSync(__dirname + '/../migrations/0014_profiles_and_logins.sql', L.join('\n') + '\n');
const n = L.join('\n').split(';').length - 1;
console.log(`wrote 0014_profiles_and_logins.sql — ${n} statements, no UNION ALL`);
