-- Rules for building a draft rota.
--
-- The point of this migration is NOT to introduce a rule. It is to write down
-- the one that has been running since the generator was written, and hand
-- somebody the pencil.
--
-- src/rota/generate.ts floorGap() returns `targetInterval * IMPLIED_FLOOR`
-- (0.5) for anybody who has not stated a minimum gap of their own, and that
-- figure is a HARD refusal at line 323 — not a preference. Every role has
-- therefore always had a minimum gap between turns, derived from the size of
-- its team, which nobody chose, nobody was shown, and nobody could change.
--
-- No CHECK constraints below, deliberately: D1 refuses ALTER TABLE ... DROP
-- COLUMN on a table that carries one, and a migration that cannot be undone
-- blocks every later deploy. Ranges are checked in the POST handler instead,
-- the same way POST /app/settings/roles already does it.

-- The hard floor for everybody in this role who has not said otherwise.
-- NULL means "work it out from the size of the team", which is exactly what
-- happens today.
ALTER TABLE roles ADD COLUMN default_min_gap_days INTEGER;

-- The rhythm the draft AIMS at, which may be longer than the floor above.
-- NULL means "spread evenly across everyone who can do it" — the existing
-- fair-share figure, which is live and grows as a team grows.
ALTER TABLE roles ADD COLUMN default_target_days INTEGER;

-- "Ask them as often as needed." The churchwarden's own words were "minimum
-- gaps between preaching UNLESS of course someone is doing them frequently",
-- and this is that clause. Per person per ROLE, because the vicar preaches most
-- weeks but still reads once a quarter like anybody else.
ALTER TABLE person_roles ADD COLUMN ask_any_time INTEGER NOT NULL DEFAULT 0;

-- The handful of rules that apply to the whole rota rather than to one role.
-- One row, id = 1. Every default below reproduces today's behaviour exactly, so
-- nothing changes until somebody changes it.
CREATE TABLE rota_rules (
  id                     INTEGER PRIMARY KEY,
  -- How long to leave before somebody's next job of ANY kind.
  -- 'none' | 'week_prefer' | 'fortnight_prefer' | 'month_prefer'
  -- | 'not_two_sundays' | 'fortnight_rule'
  -- The two ending _rule are hard refusals; the _prefer ones only cost points,
  -- which is what the generator's `rest` term already does.
  any_role_gap           TEXT    NOT NULL DEFAULT 'fortnight_prefer',
  -- Most jobs one person may hold at a single service. NULL = no limit, which
  -- is today's behaviour. The green/amber/red combination rules still apply on
  -- top of this; that page says WHICH pairs, this says HOW MANY.
  max_roles_per_service  INTEGER,
  -- What to do when a service would otherwise be short.
  -- 'leave_empty' | 'bend_gap' | 'bend_both'
  when_short             TEXT    NOT NULL DEFAULT 'bend_both',
  -- 'even' | 'balanced' | 'best_fit'. Stored as a word rather than as the
  -- weight it maps to, so the three numbers can be retuned later without
  -- stranding a value nobody chose.
  fairness               TEXT    NOT NULL DEFAULT 'balanced',
  -- Report a place that is empty even where the service is not below its
  -- minimum. Off today.
  list_every_empty_place INTEGER NOT NULL DEFAULT 0,
  updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO rota_rules (id) VALUES (1);

-- Seed each role's floor from the figure the generator is already using.
--
--   fairShare = horizonDays * eligible / totalIdealSlots
--   floor     = fairShare * 0.5
--
-- A quarter is 13 Sundays, so 91 days and 13 * ideal_needed slots stand in for
-- the live figures. Because the slot count scales with the horizon, that ratio
-- is the same for a six-month window as for a three-month one.
--
-- The pool is counted with exactly the filters src/rota/load.ts uses on the
-- person_roles query — can_do, willing, active, not needs_review, not on_break,
-- not a guest — so this count matches the one the generator will make.
--
-- Rounded DOWN to whole weeks, for two reasons. src/frequency.ts toUnits()
-- renders 24 days as "3 weeks", so saving the form untouched would write back
-- 21 — the form appearing to mangle a value, which that function exists to
-- prevent. And down rather than up is the permissive direction, so the first
-- draft generated after this migration cannot have an empty place that the
-- draft before it did not.
--
-- A role nobody can do yet divides by zero, yields NULL, and is left to work
-- itself out. communion_only roles come out a little low because 13
-- over-counts their slots — again permissive, and raisable on the page.
UPDATE roles
   SET default_min_gap_days = (
         SELECT MAX(7, CAST( (91.0 * COUNT(*))
                             / (13.0 * MAX(roles.ideal_needed, 1))
                             / 2.0 / 7.0 AS INTEGER) * 7)
           FROM person_roles pr
           JOIN people p ON p.id = pr.person_id
          WHERE pr.role_id = roles.id
            AND pr.can_do = 1 AND pr.willing = 1
            AND p.is_active = 1 AND p.needs_review = 0
            AND p.on_break = 0 AND p.is_guest = 0
       )
 WHERE is_active = 1;
