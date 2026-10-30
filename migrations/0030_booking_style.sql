-- A colour and a lettering for a room booking, so it stands out on the room
-- calendar: the toddler group always in green, a funeral in grey, the PCC in
-- capitals. Chosen from a fixed palette when the booking is made or changed
-- (BOOKING_COLOURS and BOOKING_FONTS in src/rooms.ts); NULL is the calendar's
-- usual look, which on "All rooms" is the room's own colour.
--
-- On the series too, so a repeating booking keeps its look when its pattern is
-- rebuilt, and every week of it is changed at once.
--
-- No CHECKs, for the reason in 0017's header; anything not in the palette is
-- read as NULL.
ALTER TABLE room_bookings ADD COLUMN colour TEXT;
ALTER TABLE room_bookings ADD COLUMN font TEXT;
ALTER TABLE room_booking_series ADD COLUMN colour TEXT;
ALTER TABLE room_booking_series ADD COLUMN font TEXT;
