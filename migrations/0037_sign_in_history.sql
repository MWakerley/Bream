-- Every successful sign-in, for the Login history page in the Admin Centre.
--
-- credentials.last_sign_in_at (0015) keeps only the latest, which answers "has
-- this person ever used their account" but not "who has been using the system
-- lately". One row per sign-in answers both. Failed attempts are not recorded:
-- the page is about activity, and a wrong password says nothing about it.
--
-- Goes with the person (ON DELETE CASCADE). Somebody merged into another record
-- or deleted has no history worth keeping on a page that lists people.
CREATE TABLE sign_ins (
  id            INTEGER PRIMARY KEY,
  person_id     INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  signed_in_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sign_ins_when   ON sign_ins (signed_in_at);
CREATE INDEX sign_ins_person ON sign_ins (person_id, signed_in_at);

-- What can be recovered of the past. A session is made only by signing in (or
-- by the first-time setup, which is a sign-in too), and one still on record
-- says when. Sessions end on signing out or expiry, so this is partial — the
-- page says the history starts from when this went live.
INSERT INTO sign_ins (person_id, signed_in_at)
SELECT person_id, created_at FROM sessions;

-- And the last sign-in of anybody whose session has since gone, so nobody who
-- has signed in shows an empty history.
INSERT INTO sign_ins (person_id, signed_in_at)
SELECT c.person_id, c.last_sign_in_at
  FROM credentials c
 WHERE c.last_sign_in_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sign_ins s
                    WHERE s.person_id = c.person_id
                      AND s.signed_in_at = c.last_sign_in_at);
