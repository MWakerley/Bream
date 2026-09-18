-- Room bookings imported from the church Google Calendar export
-- ("Church Center"), covering 2026-09-18 to 2027-09-18.
--
-- Times are Europe/London wall-clock. 874 of the source events were stored in
-- UTC and were converted through the tz database, not by a fixed offset, so
-- summer bookings keep the hour somebody actually booked.
--
-- Recurring events are expanded here rather than stored as a rule, because the
-- diary has no concept of a repeat. EXDATE cancellations and RECURRENCE-ID
-- moves were applied first.
--
-- All-day entries were EXCLUDED: most are staff notes
-- ("Claire back", "Steve away") rather than room bookings, and importing them
-- would mark a room unavailable all day and invent clashes.

-- Idempotent: re-running replaces the imported set rather than doubling it.
--
-- The calendar reference goes in external_ref, NOT in notes. It lived in notes
-- once and every imported booking then showed a line of machine noise on the
-- room diary — "ical:11ntir29rs6j40dj7h8bdgodqp@google.com" under Parish
-- Breakfast. notes is read by people; external_ref is read by this script.
DELETE FROM room_bookings WHERE external_ref IS NOT NULL;

INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Parish Breakfast', '2026-09-19T09:30', '2026-09-19T10:30', NULL, NULL, '11ntir29rs6j40dj7h8bdgodqp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:Site', '2026-09-19T15:00', '2026-09-19T20:00', NULL, NULL, '54oht9k00af651rpo2u3t7hvbl@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-09-21T09:30', '2026-09-21T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2026-09-21T19:00', '2026-09-21T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-09-22T10:30', '2026-09-22T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Fire Service 12.00', '2026-09-22T12:00', '2026-09-22T13:30', NULL, 'time read from the title; length assumed 90 minutes', '0ej98rgn8nak2qngrknh3hbrus@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-09-23T08:00', '2026-09-23T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Dance event -Rikki inc film crew', '2026-09-23T10:00', '2026-09-23T12:00', NULL, NULL, '600q1lkq2ulf8o87sj6fml3grt@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-09-24T10:30', '2026-09-24T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-09-24T13:45', '2026-09-24T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-09-24T18:30', '2026-09-24T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-09-24T19:15', '2026-09-24T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-09-28T09:30', '2026-09-28T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-09-28T14:30', '2026-09-28T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-09-28T19:30', '2026-09-28T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-09-29T10:30', '2026-09-29T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-09-30T08:00', '2026-09-30T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-10-01T10:30', '2026-10-01T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-10-01T13:45', '2026-10-01T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-10-01T18:30', '2026-10-01T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-10-01T19:15', '2026-10-01T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-10-05T09:30', '2026-10-05T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-10-06T10:30', '2026-10-06T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-10-07T08:00', '2026-10-07T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-10-08T10:30', '2026-10-08T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-10-08T13:45', '2026-10-08T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-10-08T18:30', '2026-10-08T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Deanery Synod', '2026-10-08T19:00', '2026-10-08T21:00', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study (maybe Don to run it this week)?', '2026-10-08T19:15', '2026-10-08T20:15', NULL, NULL, '36ovvqo65qpjdbb1m62bfdtq20@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2026-10-10T10:00', '2026-10-10T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-10-12T09:30', '2026-10-12T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-10-12T14:30', '2026-10-12T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-10-12T19:30', '2026-10-12T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-10-13T10:30', '2026-10-13T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-10-14T08:00', '2026-10-14T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2026-10-14T10:00', '2026-10-14T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2026-10-14T19:30', '2026-10-14T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PTO Safegarding Training', '2026-10-15T09:30', '2026-10-15T12:30', NULL, NULL, '53seumkcf34kg9vht1r6jt6v4i@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-10-15T10:30', '2026-10-15T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-10-15T13:45', '2026-10-15T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-10-15T18:30', '2026-10-15T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-10-15T19:15', '2026-10-15T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2026-10-16T09:00', '2026-10-16T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-10-19T09:30', '2026-10-19T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2026-10-19T19:00', '2026-10-19T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-10-20T10:30', '2026-10-20T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-10-21T08:00', '2026-10-21T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'School Harvest Festival 9.30', '2026-10-21T09:30', '2026-10-21T11:00', NULL, 'time read from the title; length assumed 90 minutes', '0d6mq279k5v3a8lm799u782is0@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-10-22T10:30', '2026-10-22T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-10-22T13:45', '2026-10-22T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-10-22T18:30', '2026-10-22T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-10-22T19:15', '2026-10-22T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-10-26T14:30', '2026-10-26T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-10-26T19:30', '2026-10-26T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-10-27T10:30', '2026-10-27T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-10-28T08:00', '2026-10-28T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-10-29T10:30', '2026-10-29T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-10-29T13:45', '2026-10-29T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-10-29T18:30', '2026-10-29T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-10-29T19:15', '2026-10-29T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2026-10-30T09:00', '2026-10-30T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-11-02T09:30', '2026-11-02T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Diocesan Board of Education', '2026-11-02T17:00', '2026-11-02T20:00', NULL, NULL, 'qk5lru8vga59vm8qlmlpojdv25@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-11-03T10:30', '2026-11-03T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-11-04T08:00', '2026-11-04T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-11-05T10:30', '2026-11-05T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-11-05T13:45', '2026-11-05T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-11-05T18:30', '2026-11-05T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-11-05T19:15', '2026-11-05T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-11-09T09:30', '2026-11-09T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-11-09T14:30', '2026-11-09T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-11-09T19:30', '2026-11-09T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-11-10T10:30', '2026-11-10T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-11-11T08:00', '2026-11-11T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2026-11-11T10:00', '2026-11-11T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2026-11-11T19:30', '2026-11-11T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-11-12T10:30', '2026-11-12T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-11-12T13:45', '2026-11-12T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-11-12T18:30', '2026-11-12T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-11-12T19:15', '2026-11-12T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2026-11-13T09:00', '2026-11-13T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2026-11-14T10:00', '2026-11-14T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-11-16T09:30', '2026-11-16T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2026-11-16T19:00', '2026-11-16T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-11-17T10:30', '2026-11-17T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-11-18T08:00', '2026-11-18T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-11-19T10:30', '2026-11-19T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-11-19T13:45', '2026-11-19T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-11-19T18:30', '2026-11-19T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-11-19T19:15', '2026-11-19T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:Site', '2026-11-21T15:00', '2026-11-21T20:00', NULL, NULL, '2sfv5vhj0t8usujou9432bhvve@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-11-23T09:30', '2026-11-23T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-11-23T14:30', '2026-11-23T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-11-23T19:30', '2026-11-23T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-11-24T10:30', '2026-11-24T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-11-25T08:00', '2026-11-25T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-11-26T10:30', '2026-11-26T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-11-26T13:45', '2026-11-26T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-11-26T18:30', '2026-11-26T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-11-26T19:15', '2026-11-26T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2026-11-27T09:00', '2026-11-27T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-11-30T09:30', '2026-11-30T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-12-01T10:30', '2026-12-01T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-12-02T08:00', '2026-12-02T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-12-03T10:30', '2026-12-03T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-12-03T13:45', '2026-12-03T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-12-03T18:30', '2026-12-03T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-12-03T19:15', '2026-12-03T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'LIFT 6pm - contemporary carols', '2026-12-06T18:00', '2026-12-06T19:30', NULL, 'time read from the title; length assumed 90 minutes', '4g50rprj8v3c84pmbdkthn18uo@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-12-07T09:30', '2026-12-07T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gardening Society Cmas Party', '2026-12-08T06:00', '2026-12-08T11:00', NULL, NULL, '308g7vbdrans1fu7jftjnl8vsm@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-12-08T10:30', '2026-12-08T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-12-09T08:00', '2026-12-09T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2026-12-09T10:00', '2026-12-09T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2026-12-09T19:30', '2026-12-09T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-12-10T10:30', '2026-12-10T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-12-10T13:45', '2026-12-10T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Carols at Whitemead 6pm', '2026-12-10T18:00', '2026-12-10T19:30', NULL, 'time read from the title; length assumed 90 minutes', '4nfl2v3gttq3lv7gnv6905buml@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-12-10T18:30', '2026-12-10T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-12-10T19:15', '2026-12-10T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2026-12-11T09:00', '2026-12-11T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2026-12-12T10:00', '2026-12-12T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, '10.30am Family Nativity & Christingle', '2026-12-13T10:30', '2026-12-13T12:00', NULL, 'time read from the title; length assumed 90 minutes', '140d1uni4bqddabqs26deeocao@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2026-12-14T09:30', '2026-12-14T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-12-14T14:30', '2026-12-14T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2026-12-14T19:30', '2026-12-14T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-12-15T10:30', '2026-12-15T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-12-16T08:00', '2026-12-16T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2026-12-17T10:30', '2026-12-17T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2026-12-17T13:45', '2026-12-17T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2026-12-17T18:30', '2026-12-17T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Bible Study', '2026-12-17T19:15', '2026-12-17T20:15', NULL, NULL, '164iav98saqqilt9a0dckskhh4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'School Christingle 9.30am', '2026-12-18T09:30', '2026-12-18T11:00', NULL, 'time read from the title; length assumed 90 minutes', '5ae3i4e7ja0pd8fr8n85e5mp95@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Sergio & Cheri times unknown', '2026-12-18T18:00', '2026-12-18T21:00', NULL, NULL, '5nkggif019iulivm3eo37m4ofh@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:Site', '2026-12-19T15:00', '2026-12-19T20:00', NULL, NULL, '7rmueqpj4nvdeffq7b5j5d9qg7@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, '6pm - Lessons & Carols', '2026-12-20T18:00', '2026-12-20T19:30', NULL, 'time read from the title; length assumed 90 minutes', '1th83p18gc7389269le48dpd81@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2026-12-21T19:00', '2026-12-21T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2026-12-22T10:30', '2026-12-22T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2026-12-23T08:00', '2026-12-23T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, '10.30am - Family friendly Service', '2026-12-25T10:30', '2026-12-25T12:00', NULL, 'time read from the title; length assumed 90 minutes', '595lm2is7omr4otqcs5hdoi86o@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-04T14:30', '2027-01-04T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-04T19:30', '2027-01-04T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-01-05T10:30', '2027-01-05T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-01-06T08:00', '2027-01-06T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-01-07T10:30', '2027-01-07T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-01-07T13:45', '2027-01-07T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-01-07T18:30', '2027-01-07T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-01-08T09:00', '2027-01-08T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-01-09T10:00', '2027-01-09T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-01-11T09:30', '2027-01-11T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-11T14:30', '2027-01-11T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-11T19:30', '2027-01-11T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-01-12T10:30', '2027-01-12T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-01-13T08:00', '2027-01-13T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-01-13T10:00', '2027-01-13T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-01-13T19:30', '2027-01-13T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-01-14T10:30', '2027-01-14T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-01-14T13:45', '2027-01-14T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-01-14T18:30', '2027-01-14T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-01-18T09:30', '2027-01-18T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-18T14:30', '2027-01-18T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-01-18T19:00', '2027-01-18T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-18T19:30', '2027-01-18T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-01-19T10:30', '2027-01-19T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-01-20T08:00', '2027-01-20T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-01-21T10:30', '2027-01-21T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-01-21T13:45', '2027-01-21T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-01-21T18:30', '2027-01-21T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-01-22T09:00', '2027-01-22T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-01-25T09:30', '2027-01-25T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-25T14:30', '2027-01-25T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-01-25T19:30', '2027-01-25T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-01-26T10:30', '2027-01-26T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-01-27T08:00', '2027-01-27T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-01-28T10:30', '2027-01-28T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-01-28T13:45', '2027-01-28T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-01-28T18:30', '2027-01-28T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-02-01T09:30', '2027-02-01T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-01T14:30', '2027-02-01T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-01T19:30', '2027-02-01T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-02-02T10:30', '2027-02-02T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-02-03T08:00', '2027-02-03T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-02-04T10:30', '2027-02-04T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-02-04T13:45', '2027-02-04T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-02-04T18:30', '2027-02-04T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-02-05T09:00', '2027-02-05T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-02-08T09:30', '2027-02-08T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-08T14:30', '2027-02-08T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-08T19:30', '2027-02-08T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-02-09T10:30', '2027-02-09T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-02-10T08:00', '2027-02-10T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-02-10T10:00', '2027-02-10T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-02-10T19:30', '2027-02-10T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-02-11T10:30', '2027-02-11T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-02-11T13:45', '2027-02-11T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-02-11T18:30', '2027-02-11T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-02-13T10:00', '2027-02-13T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-02-15T09:30', '2027-02-15T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-15T14:30', '2027-02-15T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-02-15T19:00', '2027-02-15T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-15T19:30', '2027-02-15T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-02-16T10:30', '2027-02-16T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-02-17T08:00', '2027-02-17T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-02-18T10:30', '2027-02-18T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-02-18T13:45', '2027-02-18T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-02-18T18:30', '2027-02-18T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-02-19T09:00', '2027-02-19T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-02-22T09:30', '2027-02-22T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-22T14:30', '2027-02-22T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-02-22T19:30', '2027-02-22T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-02-23T10:30', '2027-02-23T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-02-24T08:00', '2027-02-24T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-02-25T10:30', '2027-02-25T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-02-25T13:45', '2027-02-25T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-02-25T18:30', '2027-02-25T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-03-01T09:30', '2027-03-01T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-01T14:30', '2027-03-01T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-01T19:30', '2027-03-01T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-03-02T10:30', '2027-03-02T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-03-03T08:00', '2027-03-03T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-03-04T10:30', '2027-03-04T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-03-04T13:45', '2027-03-04T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-03-04T18:30', '2027-03-04T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-03-05T09:00', '2027-03-05T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-03-08T09:30', '2027-03-08T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-08T14:30', '2027-03-08T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-08T19:30', '2027-03-08T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-03-09T10:30', '2027-03-09T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-03-10T08:00', '2027-03-10T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-03-10T10:00', '2027-03-10T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-03-10T19:30', '2027-03-10T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-03-11T10:30', '2027-03-11T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-03-11T13:45', '2027-03-11T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-03-11T18:30', '2027-03-11T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-03-13T10:00', '2027-03-13T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-03-15T09:30', '2027-03-15T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-15T14:30', '2027-03-15T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-03-15T19:00', '2027-03-15T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-15T19:30', '2027-03-15T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-03-16T10:30', '2027-03-16T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:site', '2027-03-16T15:00', '2027-03-16T21:00', NULL, NULL, '23funvhlk3ask5khv4sjpt76nb@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-03-17T08:00', '2027-03-17T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-03-18T10:30', '2027-03-18T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-03-18T13:45', '2027-03-18T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-03-18T18:30', '2027-03-18T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-03-19T09:00', '2027-03-19T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:site', '2027-03-20T15:00', '2027-03-20T21:00', NULL, NULL, '3294hmop7843s2pikgrrlk51vc@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-03-22T09:30', '2027-03-22T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-22T14:30', '2027-03-22T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-22T19:30', '2027-03-22T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-03-23T10:30', '2027-03-23T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-03-24T08:00', '2027-03-24T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'School Easter Service 9.30', '2027-03-24T09:30', '2027-03-24T11:00', NULL, 'time read from the title; length assumed 90 minutes', '7o7kq3qk2qpf9d1kdh2vf75vti@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-03-25T10:30', '2027-03-25T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-03-25T13:45', '2027-03-25T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-03-25T18:30', '2027-03-25T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-03-29T09:30', '2027-03-29T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-29T14:30', '2027-03-29T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-03-29T19:30', '2027-03-29T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-03-30T10:30', '2027-03-30T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-03-31T08:00', '2027-03-31T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-04-01T10:30', '2027-04-01T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-04-01T13:45', '2027-04-01T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-04-01T18:30', '2027-04-01T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-04-02T09:00', '2027-04-02T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-04-05T09:30', '2027-04-05T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-05T14:30', '2027-04-05T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-05T19:30', '2027-04-05T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-04-06T10:30', '2027-04-06T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-04-07T08:00', '2027-04-07T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-04-08T10:30', '2027-04-08T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-04-08T13:45', '2027-04-08T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-04-08T18:30', '2027-04-08T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-04-10T10:00', '2027-04-10T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-04-12T09:30', '2027-04-12T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-12T14:30', '2027-04-12T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-12T19:30', '2027-04-12T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-04-13T10:30', '2027-04-13T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-04-14T08:00', '2027-04-14T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-04-14T10:00', '2027-04-14T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-04-14T19:30', '2027-04-14T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-04-15T10:30', '2027-04-15T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-04-15T13:45', '2027-04-15T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-04-15T18:30', '2027-04-15T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-04-16T09:00', '2027-04-16T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:Site', '2027-04-17T15:00', '2027-04-17T20:00', NULL, NULL, '6o01n47p33r72uchveei7jhuad@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-04-19T09:30', '2027-04-19T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-19T14:30', '2027-04-19T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-04-19T19:00', '2027-04-19T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-19T19:30', '2027-04-19T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-04-20T10:30', '2027-04-20T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-04-21T08:00', '2027-04-21T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-04-22T10:30', '2027-04-22T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-04-22T13:45', '2027-04-22T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-04-22T18:30', '2027-04-22T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-04-26T09:30', '2027-04-26T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-26T14:30', '2027-04-26T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-04-26T19:30', '2027-04-26T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-04-27T10:30', '2027-04-27T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-04-28T08:00', '2027-04-28T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-04-29T10:30', '2027-04-29T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-04-29T13:45', '2027-04-29T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-04-29T18:30', '2027-04-29T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-04-30T09:00', '2027-04-30T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-05-03T09:30', '2027-05-03T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-03T14:30', '2027-05-03T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-03T19:30', '2027-05-03T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-05-04T10:30', '2027-05-04T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-05-05T08:00', '2027-05-05T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-05-06T10:30', '2027-05-06T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-05-06T13:45', '2027-05-06T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-05-06T18:30', '2027-05-06T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-05-08T10:00', '2027-05-08T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-05-10T09:30', '2027-05-10T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-10T14:30', '2027-05-10T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-10T19:30', '2027-05-10T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-05-11T10:30', '2027-05-11T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-05-12T08:00', '2027-05-12T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-05-12T10:00', '2027-05-12T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-05-12T19:30', '2027-05-12T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-05-13T10:30', '2027-05-13T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-05-13T13:45', '2027-05-13T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-05-13T18:30', '2027-05-13T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-05-14T09:00', '2027-05-14T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:site', '2027-05-15T15:00', '2027-05-15T21:00', NULL, NULL, '3q7k6s7h84c08u2thpchvi0qtd@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:site', '2027-05-16T15:00', '2027-05-16T21:00', NULL, NULL, '23funvhlk3ask5khv4sjpt76nb@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-05-17T09:30', '2027-05-17T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-17T14:30', '2027-05-17T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-05-17T19:00', '2027-05-17T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-17T19:30', '2027-05-17T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-05-18T10:30', '2027-05-18T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-05-19T08:00', '2027-05-19T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-05-20T10:30', '2027-05-20T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-05-20T13:45', '2027-05-20T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-05-20T18:30', '2027-05-20T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-05-24T09:30', '2027-05-24T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-24T14:30', '2027-05-24T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-24T19:30', '2027-05-24T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-05-25T10:30', '2027-05-25T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-05-26T08:00', '2027-05-26T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-05-27T10:30', '2027-05-27T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-05-27T13:45', '2027-05-27T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-05-27T18:30', '2027-05-27T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-05-28T09:00', '2027-05-28T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-05-31T09:30', '2027-05-31T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-31T14:30', '2027-05-31T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-05-31T19:30', '2027-05-31T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-06-01T10:30', '2027-06-01T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-06-02T08:00', '2027-06-02T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-06-03T10:30', '2027-06-03T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-06-03T13:45', '2027-06-03T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-06-03T18:30', '2027-06-03T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-06-07T09:30', '2027-06-07T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-07T14:30', '2027-06-07T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-07T19:30', '2027-06-07T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-06-08T10:30', '2027-06-08T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-06-09T08:00', '2027-06-09T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-06-09T10:00', '2027-06-09T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-06-09T19:30', '2027-06-09T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-06-10T10:30', '2027-06-10T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-06-10T13:45', '2027-06-10T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-06-10T18:30', '2027-06-10T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-06-11T09:00', '2027-06-11T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-06-12T10:00', '2027-06-12T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-06-14T09:30', '2027-06-14T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-14T14:30', '2027-06-14T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-14T19:30', '2027-06-14T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-06-15T10:30', '2027-06-15T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-06-16T08:00', '2027-06-16T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-06-17T10:30', '2027-06-17T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-06-17T13:45', '2027-06-17T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-06-17T18:30', '2027-06-17T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:Site', '2027-06-19T15:00', '2027-06-19T20:00', NULL, NULL, '3pf3utepjd23d965nisnb4n9oj@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-06-21T09:30', '2027-06-21T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-21T14:30', '2027-06-21T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-06-21T19:00', '2027-06-21T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-21T19:30', '2027-06-21T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-06-22T10:30', '2027-06-22T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-06-23T08:00', '2027-06-23T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-06-24T10:30', '2027-06-24T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-06-24T13:45', '2027-06-24T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-06-24T18:30', '2027-06-24T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-06-25T09:00', '2027-06-25T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-06-28T09:30', '2027-06-28T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-28T14:30', '2027-06-28T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-06-28T19:30', '2027-06-28T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-06-29T10:30', '2027-06-29T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-06-30T08:00', '2027-06-30T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-07-01T10:30', '2027-07-01T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-07-01T13:45', '2027-07-01T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-07-01T18:30', '2027-07-01T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-07-05T09:30', '2027-07-05T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-05T14:30', '2027-07-05T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-05T19:30', '2027-07-05T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-07-06T10:30', '2027-07-06T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-07-07T08:00', '2027-07-07T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-07-08T10:30', '2027-07-08T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-07-08T13:45', '2027-07-08T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-07-08T18:30', '2027-07-08T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-07-09T09:00', '2027-07-09T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-07-10T10:00', '2027-07-10T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-07-12T09:30', '2027-07-12T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-12T14:30', '2027-07-12T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-12T19:30', '2027-07-12T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-07-13T10:30', '2027-07-13T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-07-14T08:00', '2027-07-14T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-07-14T10:00', '2027-07-14T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-07-14T19:30', '2027-07-14T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-07-15T10:30', '2027-07-15T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-07-15T13:45', '2027-07-15T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-07-15T18:30', '2027-07-15T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:site', '2027-07-16T15:00', '2027-07-16T21:00', NULL, NULL, '23funvhlk3ask5khv4sjpt76nb@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-07-19T09:30', '2027-07-19T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-19T14:30', '2027-07-19T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-07-19T19:00', '2027-07-19T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-19T19:30', '2027-07-19T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-07-20T10:30', '2027-07-20T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-07-21T08:00', '2027-07-21T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'School Leavers Service 9.30', '2027-07-21T09:30', '2027-07-21T11:00', NULL, 'time read from the title; length assumed 90 minutes', '5vsmu8j81hgik9uac9gcg4g8lr@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-07-22T10:30', '2027-07-22T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-07-22T13:45', '2027-07-22T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-07-22T18:30', '2027-07-22T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-07-23T09:00', '2027-07-23T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-07-26T09:30', '2027-07-26T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-26T14:30', '2027-07-26T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-07-26T19:30', '2027-07-26T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-07-27T10:30', '2027-07-27T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-07-28T08:00', '2027-07-28T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-07-29T10:30', '2027-07-29T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-07-29T13:45', '2027-07-29T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-07-29T18:30', '2027-07-29T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-08-02T09:30', '2027-08-02T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-02T14:30', '2027-08-02T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-02T19:30', '2027-08-02T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-08-03T10:30', '2027-08-03T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-08-04T08:00', '2027-08-04T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-08-05T10:30', '2027-08-05T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-08-05T13:45', '2027-08-05T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-08-05T18:30', '2027-08-05T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-08-06T09:00', '2027-08-06T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-08-09T09:30', '2027-08-09T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-09T14:30', '2027-08-09T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-09T19:30', '2027-08-09T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-08-10T10:30', '2027-08-10T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-08-11T08:00', '2027-08-11T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-08-11T10:00', '2027-08-11T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-08-11T19:30', '2027-08-11T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-08-12T10:30', '2027-08-12T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-08-12T13:45', '2027-08-12T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-08-12T18:30', '2027-08-12T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-08-14T10:00', '2027-08-14T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-08-16T09:30', '2027-08-16T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-16T14:30', '2027-08-16T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'PCC', '2027-08-16T19:00', '2027-08-16T21:00', NULL, NULL, '3en218dq2mdqvq90d48hic9hhe@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-16T19:30', '2027-08-16T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-08-17T10:30', '2027-08-17T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-08-18T08:00', '2027-08-18T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-08-19T10:30', '2027-08-19T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-08-19T13:45', '2027-08-19T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-08-19T18:30', '2027-08-19T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-08-20T09:00', '2027-08-20T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-08-23T09:30', '2027-08-23T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-23T14:30', '2027-08-23T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-23T19:30', '2027-08-23T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-08-24T10:30', '2027-08-24T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-08-25T08:00', '2027-08-25T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-08-26T10:30', '2027-08-26T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-08-26T13:45', '2027-08-26T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-08-26T18:30', '2027-08-26T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-08-30T09:30', '2027-08-30T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-30T14:30', '2027-08-30T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-08-30T19:30', '2027-08-30T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-08-31T10:30', '2027-08-31T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-09-01T08:00', '2027-09-01T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-09-02T10:30', '2027-09-02T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-09-02T13:45', '2027-09-02T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-09-02T18:30', '2027-09-02T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-09-03T09:00', '2027-09-03T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-09-06T09:30', '2027-09-06T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-09-06T14:30', '2027-09-06T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-09-06T19:30', '2027-09-06T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-09-07T10:30', '2027-09-07T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-09-08T08:00', '2027-09-08T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Memory Cafe', '2027-09-08T10:00', '2027-09-08T12:30', NULL, NULL, '188aq8tccvgtorrbjau04299ta_R20260909T090000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Monthly Prayer Meeting', '2027-09-08T19:30', '2027-09-08T21:00', NULL, NULL, '7gbkhjaq7j5vmkdlmrgc6b3qph@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-09-09T10:30', '2027-09-09T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-09-09T13:45', '2027-09-09T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-09-09T18:30', '2027-09-09T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Prayer in the Village', '2027-09-11T10:00', '2027-09-11T12:00', NULL, NULL, '03dgfr14evhj09gm1a6mgrg1la@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Under 5''s', '2027-09-13T09:30', '2027-09-13T11:30', NULL, NULL, '604l9koj34mu3ur59c2ujcmpv4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-09-13T14:30', '2027-09-13T16:00', NULL, NULL, '4df0o5kgec1ir4s6h4bdmdbncp@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Rob & Jane''s small group', '2027-09-13T19:30', '2027-09-13T21:00', NULL, NULL, '1p36qeq8c7fhh3u6cgnr3qmrq4@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Chill & Chat', '2027-09-14T10:30', '2027-09-14T12:00', NULL, NULL, '2ihcpbdqrk3gg5c31nogfe11li_R20260512T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Morning Prayer', '2027-09-15T08:00', '2027-09-15T09:00', NULL, NULL, '35gu49tkgb46ruqj8lgd1hmrg2@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Communion in Church', '2027-09-16T10:30', '2027-09-16T11:30', NULL, NULL, '58ldsbmt0ik1dm8lp6pcv4a228_R20250807T093000@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Main church';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Gentle Exercise Class', '2027-09-16T13:45', '2027-09-16T15:30', NULL, NULL, 'jm3q71lumg2jt37rqngslk1v66_R20250703T124500@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'X:site', '2027-09-16T15:00', '2027-09-16T21:00', NULL, NULL, '23funvhlk3ask5khv4sjpt76nb@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Soaking', '2027-09-16T18:30', '2027-09-16T19:00', NULL, NULL, '4tp00i5gfholrjpj1roeblefno@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)
SELECT r.id, 'Lunch Club', '2027-09-17T09:00', '2027-09-17T14:30', NULL, NULL, '06dfu05om2plv1c2eul9p19ns9@google.com', 'booked'
  FROM rooms r WHERE r.name = 'Church Centre';
