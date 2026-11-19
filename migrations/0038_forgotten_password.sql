-- "Forgotten your password?" on the sign-in page.
--
-- The emailed temporary password is kept BESIDE the real one rather than
-- replacing it. Anybody can type somebody else's email address into that form;
-- if asking reset the password, a stranger could lock any volunteer out just by
-- asking. So the old password keeps working, the temporary one works too until
-- it expires, and whichever is used first decides: signing in with the
-- temporary one makes it the password (to be changed at once), signing in with
-- the old one throws the temporary one away.
ALTER TABLE credentials ADD COLUMN reset_hash TEXT;
ALTER TABLE credentials ADD COLUMN reset_salt TEXT;
ALTER TABLE credentials ADD COLUMN reset_iterations INTEGER;
ALTER TABLE credentials ADD COLUMN reset_expires_at TEXT;
-- When one was last sent, so the form cannot be used to fill somebody's inbox.
ALTER TABLE credentials ADD COLUMN reset_requested_at TEXT;

-- What each row of the Login history is:
--   'password'         signed in with their password (every row so far)
--   'temporary'        signed in with an emailed temporary password
--   'reset_requested'  asked for a temporary password — not a sign-in, and not
--                      counted as one
-- No CHECK constraint, for the reason 0017 gives.
ALTER TABLE sign_ins ADD COLUMN kind TEXT NOT NULL DEFAULT 'password';
