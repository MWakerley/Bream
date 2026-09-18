/**
 * Tests for repeating room bookings.
 *
 * The two cases that matter are the ones a calendar cannot represent honestly:
 * a monthly booking on the 31st, which has no February, and "the 5th Tuesday",
 * which most months do not have. Sliding either onto a nearby date would book a
 * room on a day nobody asked for, so both are skipped and reported.
 */
import { expandSeries, describeSeries, MAX_OCCURRENCES } from '../src/recurrence.js';

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g === w) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); failures++; }
}

console.log('repeating bookings:');

// 2026-09-21 is a Monday.
eq('every week', expandSeries('2026-09-21', '2026-10-12', 'weekly').dates,
  ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']);

eq('the start date is always the first one',
  expandSeries('2026-09-21', '2026-09-21', 'weekly').dates, ['2026-09-21']);

eq('every two weeks', expandSeries('2026-09-21', '2026-11-02', 'fortnightly').dates,
  ['2026-09-21', '2026-10-05', '2026-10-19', '2026-11-02']);

eq('monthly on the same date', expandSeries('2026-09-15', '2027-01-31', 'monthly-date').dates,
  ['2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15']);

// 2026-09-08 is the 2nd Tuesday. Oct -> 13th, Nov -> 10th, Dec -> 8th.
eq('monthly on the same weekday', expandSeries('2026-09-08', '2026-12-31', 'monthly-weekday').dates,
  ['2026-09-08', '2026-10-13', '2026-11-10', '2026-12-08']);

// ---- the awkward ones ----------------------------------------------------
{
  // The 31st: only 7 months of 2027 have one.
  const r = expandSeries('2027-01-31', '2027-12-31', 'monthly-date');
  const months = r.dates.map((d) => d.slice(5, 7));
  eq('the 31st skips months that have none', months,
    ['01', '03', '05', '07', '08', '10', '12']);
  ok('and says which it skipped', r.skipped.length === 5, `${r.skipped.length} skipped`);
  ok('with a readable reason', /there is no 31st that month/.test(r.skipped[0]?.why ?? ''),
    r.skipped[0]?.why);
}

{
  // 2026-09-29 is the 5th Tuesday of September. Most months have no 5th Tuesday.
  const r = expandSeries('2026-09-29', '2027-03-31', 'monthly-weekday');
  ok('the 5th weekday only lands where it exists', r.dates.length < 7,
    `${r.dates.length} occurrences of a 5th Tuesday in 7 months`);
  ok('every date it produced really is a Tuesday',
    r.dates.every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 2));
  ok('and the missing months are reported', r.skipped.length > 0);
}

// ---- guards ---------------------------------------------------------------
eq('an end before the start gives nothing',
  expandSeries('2026-10-01', '2026-09-01', 'weekly').dates, []);
eq('a malformed date gives nothing',
  expandSeries('not-a-date', '2026-12-31', 'weekly').dates, []);

{
  // Ten years of weekly would be ~520; the cap has to hold and say so.
  const r = expandSeries('2026-01-01', '2036-01-01', 'weekly');
  ok('a very long run is capped', r.dates.length === MAX_OCCURRENCES, `${r.dates.length}`);
  ok('and reports that it was cut short', r.truncated);
}

// ---- descriptions ---------------------------------------------------------
eq('describes a weekly series', describeSeries('2026-09-21', 'weekly', '2027-09-21'),
  'Every Monday until 2027-09-21');
eq('describes a monthly weekday series', describeSeries('2026-09-08', 'monthly-weekday', '2027-09-08'),
  'The 2nd Tuesday of each month until 2027-09-08');
eq('describes a monthly date series', describeSeries('2026-09-03', 'monthly-date', '2027-09-03'),
  'The 3rd of each month until 2027-09-03');

console.log(failures === 0 ? '\nRepeating bookings OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
