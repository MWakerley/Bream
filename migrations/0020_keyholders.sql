-- Who holds a key to the buildings.
--
-- A flag on the person rather than a separate table: the question is "does
-- this person have one", and the register is simply everyone for whom the
-- answer is yes.
--
-- keyholder_since is stamped when the tick goes on, so the register can say
-- how long somebody has had one. keyholder_note is optional and free text —
-- "Church Centre front door", "key 4" — because every church labels its keys
-- differently and a fixed list of doors would be wrong for somebody.
--
-- Deliberately independent of is_active. Somebody who stops serving may well
-- still have a key in a drawer, and that is exactly who the register needs to
-- show, not hide.
ALTER TABLE people ADD COLUMN is_keyholder INTEGER NOT NULL DEFAULT 0;
ALTER TABLE people ADD COLUMN keyholder_since TEXT;
ALTER TABLE people ADD COLUMN keyholder_note TEXT;
