-- The steward is a communion role.
--
-- Seeded wrongly as applying to every service, which made "Steward: nobody
-- assigned" appear on all nine ordinary Sundays in the imported rota — by some
-- margin the loudest false alarm on the dashboard.
--
-- The spreadsheet settles it: every one of the three steward assignments in
-- September to November falls on a Holy Communion service (Jane S on 13 Sep,
-- Christine on 11 Oct, Andy on 8 Nov), and the column is blank on all twelve
-- non-communion services.
--
-- Renamed to match what it is actually called, while sheet_heading keeps the
-- spreadsheet's own wording so the import still maps.
UPDATE roles
   SET communion_only = 1,
       name = 'Communion steward'
 WHERE key = 'steward';
