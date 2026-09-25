-- Which keys a keyholder has, as a choice rather than free text.
--
-- The free-text "which keys" box from 0020 is replaced by four ticks: Church,
-- Church Centre, Church Office, Not known. Somebody can hold more than one,
-- so this is a JSON array of keys ('church', 'centre', 'office', 'unknown')
-- rather than a single value. "Not known" stands alone — it is what gets
-- recorded when somebody is ticked as a keyholder with nothing else chosen,
-- because a register that silently says nothing is worse than one that says
-- "we don't know".
--
-- keyholder_note is left in place (D1 will not drop a column cheaply) but is
-- no longer written. When this ran, no keyholder had a note in it.
ALTER TABLE people ADD COLUMN keyholder_keys TEXT;

-- Anybody already ticked is recorded as "not known" rather than as nothing.
UPDATE people SET keyholder_keys = '["unknown"]' WHERE is_keyholder = 1;
