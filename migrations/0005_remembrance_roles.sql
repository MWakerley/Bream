-- The Remembrance act is held at Bream Cenotaph, not in church.
--
-- Imported one-off services inherit all fourteen roles, so this one was
-- reporting thirteen unfilled roles including a sound desk and a tea rota at a
-- war memorial. That is a false alarm, and a gap warning nobody believes is
-- worse than no gap warning at all.
--
-- Only the roles that CANNOT exist outdoors at a memorial are switched off here.
-- Readers, stewards, welcome and prayer ministry are all plausible at a
-- Remembrance act, so they are deliberately left in place for the church to
-- decide with the "Not needed here" button on the service page.
INSERT OR IGNORE INTO service_role_overrides (service_id, role_id, applies, note)
SELECT s.id, r.id, 0, 'Outdoor service at the Cenotaph - please check'
  FROM services s, roles r
 WHERE s.location = 'Bream Cenotaph'
   AND r.key IN ('sound_desk', 'computer', 'tea_coffee',
                 'children_rec_yr5', 'children_yr6_14', 'worship_leader');
