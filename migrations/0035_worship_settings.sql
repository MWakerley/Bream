-- The Worship Rota's kinds of worship and its positions, as data the Admin
-- Centre can change, rather than a list in src/worship.ts. Filled with exactly
-- what the code had, so nothing changes on the day this runs.
--
-- Keys never change once made (a saved week points at them); names, notes,
-- order and whether each is still offered all can.

CREATE TABLE worship_kinds (
  key        TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  note       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE worship_positions (
  key        TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active  INTEGER NOT NULL DEFAULT 1
);

-- Which positions each kind asks about: a band asks about everybody, lyrics
-- only about singers.
CREATE TABLE worship_kind_positions (
  kind_key     TEXT NOT NULL REFERENCES worship_kinds (key) ON DELETE CASCADE,
  position_key TEXT NOT NULL REFERENCES worship_positions (key) ON DELETE CASCADE,
  PRIMARY KEY (kind_key, position_key)
);

INSERT INTO worship_kinds (key, label, note, sort_order) VALUES
  ('live',   'Live worship',   'A band — drums, bass, guitar, keys and singers', 10),
  ('lyrics', 'Worship lyrics', 'Sung to recorded music — singers only',         20);

INSERT INTO worship_positions (key, label, sort_order) VALUES
  ('drums',   'Drums',     10),
  ('bass',    'Bass',      20),
  ('guitar',  'Guitar',    30),
  ('keys',    'Keyboards', 40),
  ('singer1', 'Singer 1',  50),
  ('singer2', 'Singer 2',  60),
  ('singer3', 'Singer 3',  70);

INSERT INTO worship_kind_positions (kind_key, position_key)
SELECT 'live', key FROM worship_positions;
INSERT INTO worship_kind_positions (kind_key, position_key) VALUES
  ('lyrics', 'singer1'), ('lyrics', 'singer2'), ('lyrics', 'singer3');

-- worship_plans.kind is held to 'live' or 'lyrics' by a CHECK that SQLite
-- cannot drop without rebuilding the table (and so cascading through every
-- saved slot). A week's kind now lives in kind_key, which can be any kind
-- above; kind stays as it was for anything older that reads it.
ALTER TABLE worship_plans ADD COLUMN kind_key TEXT;
UPDATE worship_plans SET kind_key = kind;
