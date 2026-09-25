-- Which roles a service cannot go ahead without.
--
-- Until now every role with nobody on it was shown the same way, so a missing
-- preacher and a missing second welcomer looked equally alarming. A role marked
-- critical that has nobody (or fewer than its minimum) is a service in trouble;
-- any other role short is a service that is short-handed, and says so.
--
-- Nothing is critical by default: which roles matter most is the church's call,
-- made on the Roles page.
ALTER TABLE roles ADD COLUMN is_critical INTEGER NOT NULL DEFAULT 0;
