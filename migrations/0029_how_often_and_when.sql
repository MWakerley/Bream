-- How often, said once; and when.
--
-- HOW OFTEN. A person's record used to ask two questions about the same thing:
-- "at most N times every P" and "not more often than once every G". They were
-- meant to be independent, but people answered both, and not always the same
-- way — Matt Wakerley's record said "at most once a quarter" AND "not more
-- often than once every six months", and the draft obeyed the stricter one, so
-- he was never put on to preach at all. The form now asks once ("N times every
-- P"), stored in max_per_period / period_days as before.
--
-- Every existing "not more often than" is folded into that one figure: where it
-- is all the row said, it becomes "once every G"; where the row also had an
-- "at most", the "at most" is what they were asked first and is kept. Then
-- min_gap_days is cleared everywhere, so nothing can quietly go on reading it.
-- The column itself stays: person_roles carries CHECK constraints, and D1
-- refuses to drop a column from such a table (see the note in 0001).
UPDATE person_roles
   SET max_per_period = 1, period_days = min_gap_days
 WHERE min_gap_days IS NOT NULL
   AND (max_per_period IS NULL OR period_days IS NULL);

UPDATE person_roles SET min_gap_days = NULL WHERE min_gap_days IS NOT NULL;

-- WHEN. Some people only do a job on certain Sundays of the month, and some
-- would rather do it every other week than two weeks running. Both are NULL for
-- "any", which is everybody until somebody says otherwise.
--
--   weeks_of_month  which of the month's Sundays, as a list: '2' is the second
--                   Sunday only, '1,3' the first and third. Strictly kept: the
--                   draft never puts them on another week.
--   spacing_weeks   2 = every other week, 3 = every third week, 4 = every
--                   fourth. A preference the draft keeps to, bent only when a
--                   service would otherwise be short — as any gap is.
--
-- No CHECKs, for the reason in 0017's header; the form only writes valid values
-- and src/rota/load.ts ignores anything else.
ALTER TABLE person_roles ADD COLUMN weeks_of_month TEXT;
ALTER TABLE person_roles ADD COLUMN spacing_weeks INTEGER;
