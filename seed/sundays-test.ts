/**
 * Tests for working out the Sundays a rota needs.
 *
 * The rule "the second Sunday of the month is communion" is the one worth
 * pinning down: it is easy to write as "the 8th to the 14th" and easy to get
 * wrong at a month boundary or when a month starts on a Sunday.
 */
import { sundaysBetween, provisionalSundays, MAX_RANGE_DAYS } from '../src/services.js';

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
const dates = (r: ReturnType<typeof sundaysBetween>) => (r.ok ? r.sundays.map((s) => s.date) : []);
const communions = (r: ReturnType<typeof sundaysBetween>) =>
  (r.ok ? r.sundays.filter((s) => s.communion).map((s) => s.date) : []);

console.log('Sundays:');

// Sept 2026: Sundays fall on 6, 13, 20, 27.
eq('finds every Sunday in a month', dates(sundaysBetween('2026-09-01', '2026-09-30')),
  ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27']);

ok('a range starting ON a Sunday includes it',
  dates(sundaysBetween('2026-09-06', '2026-09-20'))[0] === '2026-09-06');

ok('a range ending ON a Sunday includes it',
  dates(sundaysBetween('2026-09-01', '2026-09-06')).includes('2026-09-06'));

eq('a single Sunday', dates(sundaysBetween('2026-09-06', '2026-09-06')), ['2026-09-06']);
eq('a range with no Sunday', dates(sundaysBetween('2026-09-07', '2026-09-12')), []);

// ---- the communion rule --------------------------------------------------
// The second Sunday is the one falling on the 8th to the 14th, whatever weekday
// the month begins on. Sept 2026 -> 13th, Oct -> 11th, Nov -> 8th.
eq('the second Sunday of each month is communion',
  communions(sundaysBetween('2026-09-01', '2026-11-30')),
  ['2026-09-13', '2026-10-11', '2026-11-08']);

{
  // A month that STARTS on a Sunday is the awkward one: the 1st is the first
  // Sunday, so the second is the 8th — the very edge of the window.
  const r = sundaysBetween('2026-02-01', '2026-02-28');
  const first = dates(r)[0];
  ok('a month starting on a Sunday is handled',
    first === '2026-02-01' && communions(r).length === 1 && communions(r)[0] === '2026-02-08',
    `first ${first}, communions ${JSON.stringify(communions(r))}`);
}

{
  // Exactly one communion per month, across a long run — the property that
  // matters more than any single date.
  const r = sundaysBetween('2026-01-01', '2026-12-31');
  const byMonth = new Map<string, number>();
  for (const d of communions(r)) {
    const m = d.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  ok('exactly one communion in each of the twelve months',
    byMonth.size === 12 && [...byMonth.values()].every((n) => n === 1),
    `${byMonth.size} months, counts ${JSON.stringify([...byMonth.values()])}`);
}

{
  // Every date produced must really be a Sunday, including across both British
  // Summer Time boundaries.
  const r = sundaysBetween('2026-03-01', '2026-11-30');
  ok('every date really is a Sunday, across both BST changes',
    dates(r).every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0),
    `${dates(r).length} dates`);
  ok('and the clocks changing does not skip or repeat one',
    new Set(dates(r)).size === dates(r).length);
}

// ---- guards ---------------------------------------------------------------
{
  const r = sundaysBetween('2026-10-01', '2026-09-01');
  ok('an end before the start is refused', !r.ok && /after the start/.test(r.error));
}
{
  const r = sundaysBetween('not-a-date', '2026-09-01');
  ok('a malformed date is refused', !r.ok);
}
{
  const r = sundaysBetween('2026-01-01', '2036-01-01');
  ok('a range longer than two years is refused', !r.ok && /two years/.test(r.error));
}
{
  // Just inside the cap must still work.
  const end = new Date(Date.UTC(2026, 0, 1) + (MAX_RANGE_DAYS - 1) * 86400000)
    .toISOString().slice(0, 10);
  const r = sundaysBetween('2026-01-01', end);
  ok('a range just inside the cap is allowed', r.ok && dates(r).length > 100,
    r.ok ? `${dates(r).length} Sundays` : r.error);
}


// ---- Sundays that are planned but not yet written -------------------------
//
// Generating a draft used to create the services first. Somebody who generated
// a draft to see what it looked like, then thought better of it, was left with
// a diary full of empty Sundays to delete one at a time. They are now imagined
// until the draft is accepted, and these are the properties that has to have.
{
  const ROLES = [
    { id: 1, min_needed: 1, ideal_needed: 1, communion_only: 0, is_active: 1 },
    { id: 2, min_needed: 2, ideal_needed: 4, communion_only: 0, is_active: 1 },
    { id: 3, min_needed: 1, ideal_needed: 1, communion_only: 1, is_active: 1 },
    { id: 4, min_needed: 1, ideal_needed: 1, communion_only: 0, is_active: 0 },
  ];
  const r = sundaysBetween('2026-12-06', '2027-01-31');
  const all = r.ok ? r.sundays : [];

  const fresh = provisionalSundays(all, new Set(), ROLES);
  ok('every missing Sunday is planned', fresh.length === all.length,
    `${fresh.length} of ${all.length}`);
  ok('their ids are all negative', fresh.every((s) => s.id < 0),
    'a real row must never be able to collide with one');
  ok('and all different', new Set(fresh.map((s) => s.id)).size === fresh.length);

  const existing = new Set(['2026-12-06', '2026-12-13']);
  const some = provisionalSundays(all, existing, ROLES);
  ok('a Sunday already in the diary is left alone',
    some.length === all.length - 2 && !some.some((s) => existing.has(s.date)),
    'a service renamed to Carol Service must not be planned over');

  const communion = fresh.find((s) => s.isCommunion);
  const ordinary  = fresh.find((s) => !s.isCommunion);
  ok('a communion Sunday asks for the communion-only role',
    !!communion && communion.roles.some((x) => x.roleId === 3));
  ok('an ordinary Sunday does NOT',
    !!ordinary && !ordinary.roles.some((x) => x.roleId === 3),
    'otherwise every ordinary Sunday reports a gap that is not real');
  ok('a retired role is never asked for',
    fresh.every((s) => !s.roles.some((x) => x.roleId === 4)));
  ok('the numbers needed come from the role',
    !!ordinary && ordinary.roles.find((x) => x.roleId === 2)?.min === 2);

  ok('nothing is planned when they all exist',
    provisionalSundays(all, new Set(all.map((s) => s.date)), ROLES).length === 0);

  // The generator does date arithmetic on `day`, so it has to agree with the
  // date string or a Sunday would be scored against the wrong week.
  ok('the epoch day matches the date',
    fresh.every((s) => new Date(s.day * 86400000).toISOString().slice(0, 10) === s.date));
}
console.log(failures === 0 ? '\nSundays OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
