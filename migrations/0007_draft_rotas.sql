-- A generated draft, parked between the preview and the admin pressing Apply.
--
-- Held rather than regenerated on Apply: if anything changed in between — a new
-- unavailability, an edited role count — regenerating would save a rota that is
-- not the one the person looked at and agreed to.
CREATE TABLE draft_rotas (
  token      TEXT    PRIMARY KEY,
  person_id  INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  from_date  TEXT    NOT NULL,
  to_date    TEXT    NOT NULL,
  payload    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX draft_rotas_person ON draft_rotas (person_id, created_at);
