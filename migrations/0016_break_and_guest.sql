-- Two reasons the generator should leave somebody alone.
--
-- Both mean "never put this person on a rota you build yourself", and neither
-- means "this person cannot serve" — an administrator can still put either of
-- them on a service by hand, which is the entire point of the second one.
--
-- They are separate columns rather than one status, because they are different
-- facts about different people and both can be true at once. A regular preacher
-- who is also taking a break is on a break; a visiting preacher who is also
-- taking a break is both. Folding them into a single enum would make "why is
-- this person not being picked?" unanswerable.
--
-- Neither is is_active. Turning somebody inactive says they have stopped
-- serving and hides them from the roster entirely; these two people are still
-- on the roster and still expect to be there when they come back.

-- Temporary, and set by the person themselves or on their behalf: they are
-- still here, still willing, but would rather not be put on anything for a
-- while. Unticking it resumes them with no other state to restore.
ALTER TABLE people ADD COLUMN on_break INTEGER NOT NULL DEFAULT 0;

-- When they went on it, so the settings screen can say "since March" rather
-- than just "on a break" — a break nobody has ended in eight months is worth
-- someone asking about.
ALTER TABLE people ADD COLUMN on_break_since TEXT;

-- Permanent, and a property of who they are: a visiting preacher or worship
-- leader who comes when invited. They are put on a service deliberately, by
-- name, and must never be drawn from the pool automatically — nor counted as
-- part of it when the system works out whether a pool is thin.
ALTER TABLE people ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0;

-- Both are read on every generation and on the settings lists, always together
-- with is_active.
CREATE INDEX people_available ON people (is_active, on_break, is_guest);
