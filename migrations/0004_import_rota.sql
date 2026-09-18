-- The church's actual rota for September to November 2026, imported from
-- "September-November 2026.xlsx" by seed/build-rota-import.cjs.
--
-- Assignments are inserted as CONFIRMED: this is the rota the church is already
-- running, not a draft the system produced. Any name the importer could not match
-- to a person is simply not inserted, which shows up as a gap on the dashboard —
-- honest, and visible, rather than quietly dropped.

-- 2026-09-06 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-09-06', '10:30', st.id, 'Worship', NULL, 0, 'John 1:1-5, 14'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Robert';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Heather';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Louisa';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Dave';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Anna';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Volodymyr';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Chris L';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Lesley';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Dorothy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Alla';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Sergii';

-- 2026-09-06 18:00 — LIFT
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-09-06', '18:00', st.id, 'LIFT', NULL, 0, NULL
  FROM service_types st WHERE st.name = 'LIFT';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '18:00'
   AND r.key = 'worship_leader' AND p.display_name = 'Stu';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '18:00'
   AND r.key = 'worship_leader' AND p.display_name = 'Nat';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-06' AND s.service_time = '18:00'
   AND r.key = 'sound_desk' AND p.display_name = 'Alex';

-- 2026-09-13 10:30 — Holy Communion
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-09-13', '10:30', st.id, 'Holy Communion', NULL, 1, 'Matt 1:18-25'
  FROM service_types st WHERE st.name = 'Holy Communion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'communion_preside' AND p.display_name = 'Robert';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Robert';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Robert';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 3, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Iain';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 4, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Liz';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'steward' AND p.display_name = 'Jane S';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Christine E';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Jane S';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Suzi';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Dave';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Artur';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Dima';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Iain';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Hannah';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sue';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sheila';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Kay';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-13' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Joanne';

-- 2026-09-20 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-09-20', '10:30', st.id, 'Worship', NULL, 0, 'Luke 4:16-21'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Andy E';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Joanne';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Louisa';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Alex';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Iain';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Barry';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sveta';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Alla';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Kev';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-20' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Jane';

-- 2026-09-27 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-09-27', '10:30', st.id, 'Worship', NULL, 0, 'Matt 28:16-20'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Scilla';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Suzi';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Dave';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Artur';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Dima';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Kay';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Louisa';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Christine';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sue';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Glenn';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-09-27' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Joanne';

-- 2026-10-04 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-10-04', '10:30', st.id, 'Worship', NULL, 0, 'Is 53:4-9'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Robert';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Shirley';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Louisa';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Dave';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Matt';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Gail';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Lesley';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Christine';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-04' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Pete';

-- 2026-10-11 10:30 — Holy Communion HARVEST
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-10-11', '10:30', st.id, 'Holy Communion HARVEST', NULL, 1, 'Acts 2:22-36'
  FROM service_types st WHERE st.name = 'Holy Communion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'communion_preside' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 3, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Andy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 4, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Jane S';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'steward' AND p.display_name = 'Christine';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Sally C';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Dorothy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Dave';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Artur';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Dima';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Daisy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Christine';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Gail';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Sue';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-11' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Shelia';

-- 2026-10-18 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-10-18', '10:30', st.id, 'Worship', NULL, 0, NULL
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Paul L';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Liz E';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Christine E';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Stu';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Nat';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Dave';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Alex';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Kay';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Louisa';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Hannah';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Iain';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Chris L';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Lesley';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Dorothy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Heather';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-18' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Pete';

-- 2026-10-25 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-10-25', '10:30', st.id, 'Worship', NULL, 0, 'Gen 12:1-9'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Matt W';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Heather';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Suzi';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'computer' AND p.display_name = 'Louisa';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Artur';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'sound_desk' AND p.display_name = 'Dima';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Anna';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Volodymyr';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Barry';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sveta';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Alla';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Andy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-10-25' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Liz';

-- 2026-11-01 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-11-01', '10:30', st.id, 'Worship', NULL, 0, 'Gen 44:18-34'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO service_role_overrides (service_id, role_id, applies, note)
SELECT s.id, r.id, 0, 'Kids in Service Half Term'
  FROM services s, roles r
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30' AND r.key = 'children_rec_yr5';
INSERT OR IGNORE INTO service_role_overrides (service_id, role_id, applies, note)
SELECT s.id, r.id, 0, 'Kids in Service Half Term'
  FROM services s, roles r
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30' AND r.key = 'children_yr6_14';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Iain';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Joanne';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Scilla';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Kev';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Jane';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sue';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sheila';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Alla';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-01' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Sergii';

-- 2026-11-08 10:30 — Holy Communion
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-11-08', '10:30', st.id, 'Holy Communion', NULL, 1, 'Josh 2:8-21'
  FROM service_types st WHERE st.name = 'Holy Communion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'communion_preside' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 3, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Heather';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 4, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'communion_distribution' AND p.display_name = 'Christine';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'steward' AND p.display_name = 'Andy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Jane S';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Iain';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Matt';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Gail';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Ruth';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Pete';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Kay';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-08' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Joanne';

-- 2026-11-15 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-11-15', '10:30', st.id, 'Worship', NULL, 0, '1 Sam 16:1-13'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Barry';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Shirley D';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Kay';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Louisa';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Don';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Chris L';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Lesley';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Christine';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Kev';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-15' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Jane';

-- 2026-11-15 15:00 — Remembrance
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-11-15', '15:00', st.id, 'Remembrance', 'Bream Cenotaph', 0, NULL
  FROM service_types st WHERE st.name = 'Other';

-- 2026-11-22 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-11-22', '10:30', st.id, 'Worship', NULL, 0, 'Matt 1:18-25'
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Robert';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Andy E';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Sally C';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'worship_leader' AND p.display_name = 'Matt R';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Anna';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'children_rec_yr5' AND p.display_name = 'Volodymyr';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'children_yr6_14' AND p.display_name = 'Steve';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Kev';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Chris L';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Sue';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Glenn';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Sue';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-22' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Sheila';

-- 2026-11-29 10:30 — Worship
INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)
SELECT '2026-11-29', '10:30', st.id, 'Worship', NULL, 0, NULL
  FROM service_types st WHERE st.name = 'Worship';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'preacher' AND p.display_name = 'Barry';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'service_leader' AND p.display_name = 'Matt W';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Dorothy';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'reader' AND p.display_name = 'Liz';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Iain';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'prayer_ministry' AND p.display_name = 'Hannah';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Marion';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'tea_coffee' AND p.display_name = 'Gail';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 1, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Heather';
INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
SELECT s.id, r.id, 2, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'
  FROM services s, roles r, people p
 WHERE s.service_date = '2026-11-29' AND s.service_time = '10:30'
   AND r.key = 'welcome_team' AND p.display_name = 'Pete';
