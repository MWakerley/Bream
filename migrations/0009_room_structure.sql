-- How the building actually fits together, as the church describes it:
-- upstairs in the Church Centre are the Sofa room and the Prayer room.
--
-- This matters for two reasons.
--
-- First, it explains the apparent double-bookings in the imported calendar. The
-- Church Centre runs two things at once because "upstairs" and "downstairs" are
-- different spaces — so 13 overlapping pairs in the import are very likely not
-- clashes at all.
--
-- Second, it tells the clash check what to do. Booking the Sofa room does NOT
-- make the Church Centre hall unavailable, and vice versa, so they are correctly
-- separate rooms. But a booking that only says "upstairs" cannot be placed
-- without knowing which of the two it means, and the importer refuses to guess.
UPDATE rooms SET notes = 'The downstairs hall. Upstairs are the Sofa room and the Prayer room, which are booked separately.'
 WHERE name = 'Church Centre';

UPDATE rooms SET notes = 'Upstairs in the Church Centre.'
 WHERE name IN ('Sofa room', 'Prayer room');

UPDATE rooms SET notes = 'The church building itself.'
 WHERE name = 'Main church';
