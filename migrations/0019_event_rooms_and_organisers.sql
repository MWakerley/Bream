-- Three things an event needed that it did not have.
--
-- 1. ROOMS. Putting on a supper in the Church Centre meant adding the event and
--    then, separately, remembering to book the hall — and forgetting was how two
--    things ended up in it at once. An event can now hold rooms itself.
--
--    The holds are ordinary room_bookings rows, pointed back at the event. The
--    clash check, the room diary and the calendar already understand those, so
--    none of them has to learn what an event is. ON DELETE SET NULL, not
--    CASCADE, for the same reason as series_id: removing an event should not
--    silently erase a diary entry somebody may have relied on.
ALTER TABLE room_bookings ADD COLUMN event_id INTEGER REFERENCES events (id) ON DELETE SET NULL;
CREATE INDEX room_bookings_event ON room_bookings (event_id);

-- events.ends_at has existed since 0001 but nothing ever set it. A room cannot
-- be held for "from seven until whenever", so it is now asked for.

-- 2. ORGANISERS. Whoever is running the thing, as opposed to whoever typed it
--    in. Usually one person, sometimes a couple, so a table rather than two
--    columns. Name is required; email is only required when they are to be
--    told about bookings, and that is checked in the application.
CREATE TABLE event_organisers (
  id         INTEGER PRIMARY KEY,
  event_id   INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  email      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100
);
CREATE INDEX event_organisers_by_event ON event_organisers (event_id, sort_order);

-- 3. Whether the organisers get an email each time somebody books.
ALTER TABLE events ADD COLUMN notify_organisers INTEGER NOT NULL DEFAULT 0;
