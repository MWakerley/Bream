-- Per-service exceptions to a role's normal requirement.
--
-- The church's own rota needs this in three shapes, all visible in the
-- spreadsheet:
--   * "N/A"        - Christmas Eve and Christmas Day run no children's work at
--                    all. The role does not apply, so it must NOT be reported as
--                    an unfilled gap every time someone opens the dashboard.
--   * "self-serve" - tea and coffee on the Sunday after Christmas. Nobody is on
--                    the rota and that is correct.
--   * a different count - a big festival service may want more welcomers than an
--                    ordinary Sunday.
--
-- Without this table the only ways to express "not needed here" are to leave a
-- permanent false warning on the service or to delete the role globally, and
-- both are wrong.
CREATE TABLE service_role_overrides (
  service_id   INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  role_id      INTEGER NOT NULL REFERENCES roles (id)    ON DELETE CASCADE,
  -- 0 means this role simply does not exist at this service.
  applies      INTEGER NOT NULL DEFAULT 1,
  -- NULL means "use the role's own figure".
  min_needed   INTEGER,
  ideal_needed INTEGER,
  -- Shown on the service so the reason is visible rather than folklore:
  -- 'Kids in service - half term', 'self-serve'.
  note         TEXT,
  PRIMARY KEY (service_id, role_id),
  CHECK (applies IN (0, 1)),
  CHECK (min_needed   IS NULL OR min_needed   >= 0),
  CHECK (ideal_needed IS NULL OR min_needed IS NULL OR ideal_needed >= min_needed)
);
