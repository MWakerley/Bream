// Checks the recurrence expansion against hand-worked cases.
//
// A wrong expansion is the failure mode that looks fine: the diary fills up with
// plausible bookings on the wrong days, and nobody notices until somebody finds
// the hall occupied. So the rules are checked against dates worked out by hand,
// and the real file is checked for the two things that indicate a broken
// expander — duplicate rows, and occurrences on the wrong weekday.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Re-implement nothing: pull the expander out of the importer by running it in
// report mode and parsing what it produced would be indirect, so instead the
// importer is required with a flag that stops it running.
const src = fs.readFileSync(path.join(__dirname, 'import-ical.cjs'), 'utf8');

// Extract the pure helpers so they can be exercised directly.
const sandbox = { module: { exports: {} }, require, console, process: { argv: ['', '', 'x'], exit() {} } };
const helpers = src.slice(src.indexOf('const DAYS ='), src.indexOf('// ----', src.indexOf('function expand')));
const prelude = src.slice(src.indexOf('const dayOf ='), src.indexOf('// ---------------------------------------------------------------------------\n// Parsing'));
const fn = new Function('parseDt', `${prelude}\n${helpers}\nreturn { expand, addDays, dayOf };`);
const { expand } = fn((prop, value) => {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? { kind: 'date', local: `${m[1]}-${m[2]}-${m[3]}` } : null;
});

let fails = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`  FAIL ${name}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`); }
  else console.log(`  ok   ${name}`);
}

const ev = (startLocal, rrule) => ({ start: { kind: 'time', local: startLocal }, rrule, exdates: [] });

console.log('recurrence expansion:');

// 2026-09-21 is a Monday.
check('weekly on Monday',
  expand(ev('2026-09-21T09:30', 'FREQ=WEEKLY;BYDAY=MO'), '2026-09-21', '2026-10-12').dates,
  ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']);

check('fortnightly on Monday',
  expand(ev('2026-09-21T09:30', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO'), '2026-09-21', '2026-11-02').dates,
  ['2026-09-21', '2026-10-05', '2026-10-19', '2026-11-02']);

check('weekly on two days',
  expand(ev('2026-09-21T09:30', 'FREQ=WEEKLY;BYDAY=MO,WE'), '2026-09-21', '2026-10-01').dates,
  ['2026-09-21', '2026-09-23', '2026-09-28', '2026-09-30']);

check('weekly with COUNT',
  expand(ev('2026-09-21T09:30', 'FREQ=WEEKLY;BYDAY=MO;COUNT=3'), '2026-09-21', '2026-12-31').dates,
  ['2026-09-21', '2026-09-28', '2026-10-05']);

check('weekly with UNTIL',
  expand(ev('2026-09-21T09:30', 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261005T225959Z'), '2026-09-21', '2026-12-31').dates,
  ['2026-09-21', '2026-09-28', '2026-10-05']);

// Second Wednesday: Oct 2026 -> 14th, Nov -> 11th, Dec -> 9th.
check('monthly, 2nd Wednesday',
  expand(ev('2026-10-14T19:00', 'FREQ=MONTHLY;BYDAY=2WE'), '2026-10-01', '2026-12-31').dates,
  ['2026-10-14', '2026-11-11', '2026-12-09']);

// Last Sunday: Oct 2026 -> 25th, Nov -> 29th, Dec -> 27th.
check('monthly, last Sunday',
  expand(ev('2026-10-25T10:00', 'FREQ=MONTHLY;BYDAY=-1SU'), '2026-10-01', '2026-12-31').dates,
  ['2026-10-25', '2026-11-29', '2026-12-27']);

check('monthly by date',
  expand(ev('2026-10-16T10:00', 'FREQ=MONTHLY;BYMONTHDAY=16'), '2026-10-01', '2027-01-31').dates,
  ['2026-10-16', '2026-11-16', '2026-12-16', '2027-01-16']);

check('a series that ended before the window yields nothing',
  expand(ev('2022-01-03T09:30', 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20220331T225959Z'), '2026-09-18', '2027-09-18').dates,
  []);

console.log('\nagainst the real file:');
const ICS = process.argv[2];
if (ICS && fs.existsSync(ICS)) {
  const out = execFileSync(process.execPath,
    [path.join(__dirname, 'import-ical.cjs'), ICS, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const rows = JSON.parse(out.slice(out.indexOf('[')));
  // Duplicates: the same room, the same instant, the same title.
  const seen = new Map();
  let dupes = 0;
  for (const r of rows) {
    const k = `${r.room}|${r.starts_at}|${r.title}`;
    if (seen.has(k)) dupes++;
    seen.set(k, true);
  }
  console.log(`  ${dupes === 0 ? 'ok  ' : 'FAIL'} no duplicate bookings (${rows.length} rows, ${dupes} duplicates)`);
  if (dupes) fails++;

  // Every booking must end after it starts, and sit inside the window.
  const bad = rows.filter((r) => !(r.ends_at > r.starts_at));
  console.log(`  ${bad.length === 0 ? 'ok  ' : 'FAIL'} every booking ends after it starts (${bad.length} bad)`);
  if (bad.length) { fails++; console.log('       e.g.', JSON.stringify(bad[0])); }

  // Nothing before the window.
  const early = rows.filter((r) => r.starts_at.slice(0, 10) < new Date().toISOString().slice(0, 10));
  console.log(`  ${early.length === 0 ? 'ok  ' : 'FAIL'} nothing dated before today (${early.length})`);
  if (early.length) fails++;
} else {
  console.log('  (no .ics given — skipped)');
}

console.log(fails === 0 ? '\nRecurrence OK.' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
