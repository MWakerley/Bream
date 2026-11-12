-- Each room's own colour on the "All rooms" calendar, chosen in Admin Centre >
-- Rooms from the same palette a booking can be given (BOOKING_COLOURS in
-- src/rooms.ts). A booking's own colour still wins over its room's.
--
-- Filled in with exactly what the calendar has been showing: it cycled navy,
-- gold, green, red by room id, so nothing changes on the day this runs.
-- No CHECK, for the reason in 0017's header; anything not in the palette is
-- read as no colour.
ALTER TABLE rooms ADD COLUMN colour TEXT;
UPDATE rooms SET colour = CASE (id - 1) % 4
  WHEN 0 THEN 'navy' WHEN 1 THEN 'gold' WHEN 2 THEN 'green' ELSE 'red' END;
