-- When each account was last used.
--
-- It lives on `credentials` rather than on `people` on purpose: most of the
-- roster has no sign-in at all, and a column on `people` would leave sixty-odd
-- NULLs that mean "no account" sitting next to a handful that mean "has an
-- account but has never used it". Those are different facts and the person page
-- says different things about them, so they are kept apart — no credentials row
-- means no login; a row with a NULL date means a login never used.
ALTER TABLE credentials ADD COLUMN last_sign_in_at TEXT;
