-- Applying a draft now confirms what it puts on the rota: pressing "Apply this
-- draft" is the decision, and nothing ever came along afterwards to turn a
-- draft place into a confirmed one. Everything already applied is brought into
-- line, so January and the rest stop showing "draft".
--
-- generated is left as it is — it still says the generator made the place.
UPDATE assignments
   SET status = 'confirmed', updated_at = datetime('now')
 WHERE status = 'draft';
