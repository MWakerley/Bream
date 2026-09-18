/**
 * Property tests for the rota generator.
 *
 * Each of these corresponds to something that would be embarrassing in front of
 * a congregation: a preacher rota'd to run children's work, the same person on
 * three weeks running, a rota that comes out different every time you press the
 * button, or a name invented to fill a hole.
 *
 *   npm run test:gen
 */
import { generateRota, epochDay } from '../src/rota/generate.js';
import type { GeneratorInput, GenService } from '../src/rota/types.js';

const R = { preacher: 1, leader: 2, worship: 3, reader: 4, prayer: 5, kids: 6, sound: 7, welcome: 8 };
const ROLE_NAMES = new Map<number, string>([
  [R.preacher, 'Preacher'], [R.leader, 'Service leader'], [R.worship, 'Worship leader'],
  [R.reader, 'Reader'], [R.prayer, 'Prayer ministry'], [R.kids, "Children's work"],
  [R.sound, 'Sound desk'], [R.welcome, 'Welcome team'],
]);

/** 13 Sundays, like a quarter. */
function sundays(n = 13, start = '2026-09-06'): GenService[] {
  const out: GenService[] = [];
  const d0 = epochDay(start);
  for (let i = 0; i < n; i++) {
    const day = d0 + i * 7;
    const iso = new Date(day * 86_400_000).toISOString().slice(0, 10);
    out.push({
      id: i + 1, date: iso, day, time: '10:30', title: 'Worship', isCommunion: false,
      roles: [
        { roleId: R.preacher, min: 1, ideal: 1 },
        { roleId: R.leader, min: 1, ideal: 1 },
        { roleId: R.worship, min: 1, ideal: 1 },
        { roleId: R.reader, min: 2, ideal: 2 },
        { roleId: R.prayer, min: 2, ideal: 4 },
        { roleId: R.kids, min: 2, ideal: 2 },
        { roleId: R.sound, min: 1, ideal: 1 },
        { roleId: R.welcome, min: 2, ideal: 2 },
      ],
    });
  }
  return out;
}

function base(): GeneratorInput {
  // Mirrors the real shape: a tiny preaching pool against a large welcome pool.
  const people = [
    ...Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, name: `Preacher${i}` })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: 200 + i, name: `Sound${i}` })),
    ...Array.from({ length: 23 }, (_, i) => ({ id: 300 + i, name: `Helper${i}` })),
  ];
  const capabilities = [
    ...Array.from({ length: 8 }, (_, i) => [
      { personId: 100 + i, roleId: R.preacher, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
      { personId: 100 + i, roleId: R.leader, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
    ]).flat(),
    ...Array.from({ length: 8 }, (_, i) => [
      { personId: 200 + i, roleId: R.sound, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
      { personId: 200 + i, roleId: R.worship, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
    ]).flat(),
    ...Array.from({ length: 23 }, (_, i) => [
      { personId: 300 + i, roleId: R.welcome, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
      { personId: 300 + i, roleId: R.reader, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
      { personId: 300 + i, roleId: R.prayer, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
      { personId: 300 + i, roleId: R.kids, desiredEveryDays: null, minGapDays: null, maxPerWindow: null },
    ]).flat(),
  ];
  return {
    services: sundays(), people, roleNames: ROLE_NAMES, capabilities,
    combinations: new Map([
      // The operator's own rule.
      [`${Math.min(R.preacher, R.kids)}:${Math.max(R.preacher, R.kids)}`,
        { verdict: 'red' as const, reason: 'would be preaching while children\'s work is on' }],
      [`${Math.min(R.leader, R.worship)}:${Math.max(R.leader, R.worship)}`,
        { verdict: 'amber' as const, reason: 'allowed but not ideal' }],
    ]),
    pairs: [], unavailable: [], history: [], pinned: [], runSeed: 'test',
  };
}

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

console.log('generator:');

// ---- 1. a RED combination must never be produced --------------------------
{
  const inp = base();
  // Make everyone able to preach AND do kids, so the only thing stopping the
  // clash is the rule itself.
  for (let i = 0; i < 23; i++) {
    inp.capabilities.push({ personId: 300 + i, roleId: R.preacher, desiredEveryDays: null, minGapDays: null, maxPerWindow: null });
  }
  const res = generateRota(inp);
  let clashes = 0;
  for (const svc of inp.services) {
    const here = res.allocations.filter((a) => a.serviceId === svc.id);
    const byPerson = new Map<number, number[]>();
    for (const a of here) byPerson.set(a.personId, [...(byPerson.get(a.personId) ?? []), a.roleId]);
    for (const roles of byPerson.values()) {
      if (roles.includes(R.preacher) && roles.includes(R.kids)) clashes++;
    }
  }
  ok('never produces a RED combination', clashes === 0, `${clashes} clashes`);
}

// ---- 2. determinism -------------------------------------------------------
{
  const a = generateRota(base());
  const b = generateRota(base());
  ok('same input gives the same rota', JSON.stringify(a.allocations) === JSON.stringify(b.allocations));
}

// ---- 3. unavailability is never overridden --------------------------------
{
  const inp = base();
  const victim = 100;
  inp.unavailable = [{ personId: victim, fromDay: epochDay('2026-09-01'), toDay: epochDay('2026-12-31') }];
  const res = generateRota(inp);
  ok('never schedules someone who is away',
    res.allocations.every((a) => a.personId !== victim));
}

// ---- 4. a hole is reported, never invented --------------------------------
{
  const inp = base();
  inp.capabilities = inp.capabilities.filter((c) => c.roleId !== R.sound); // nobody can do sound
  const res = generateRota(inp);
  ok('leaves an impossible role empty', res.allocations.every((a) => a.roleId !== R.sound));
  ok('reports it as a gap', res.gaps.filter((g) => g.roleId === R.sound).length === 13,
    `${res.gaps.filter((g) => g.roleId === R.sound).length} gaps`);
  ok('warns before generating', res.warnings.some((w) => /Sound desk: nobody/.test(w)));
}

// ---- 5. pins survive, and do not collide on slot numbers ------------------
{
  const inp = base();
  // A pin at slot 2 of a 2-seat role: the generated one must take slot 1.
  inp.pinned = [{ serviceId: 1, roleId: R.reader, slot: 2, personId: 305 }];
  const res = generateRota(inp);
  const readers = res.allocations.filter((a) => a.serviceId === 1 && a.roleId === R.reader);
  ok('keeps the pinned person', readers.some((a) => a.personId === 305 && a.slot === 2));
  ok('fills the other seat without colliding',
    readers.length === 2 && new Set(readers.map((a) => a.slot)).size === 2,
    `slots ${readers.map((a) => a.slot).join(',')}`);
}

// ---- 6. stated cadence is respected ---------------------------------------
{
  const inp = base();
  // "I'll only preach every 3 months."
  for (const c of inp.capabilities) {
    if (c.roleId === R.preacher && c.personId === 100) c.minGapDays = 90;
  }
  const res = generateRota(inp);
  const days = res.allocations
    .filter((a) => a.personId === 100 && a.roleId === R.preacher)
    .map((a) => inp.services.find((s) => s.id === a.serviceId)!.day)
    .sort((x, y) => x - y);
  let tooClose = 0;
  for (let i = 1; i < days.length; i++) if (days[i]! - days[i - 1]! < 90) tooClose++;
  ok('honours "only every 3 months"', tooClose === 0, `${tooClose} too close`);
}

// ---- 7. the scarce pool is spread, not burned on one person ---------------
{
  const res = generateRota(base());
  const counts = new Map<number, number>();
  for (const a of res.allocations.filter((x) => x.roleId === R.preacher)) {
    counts.set(a.personId, (counts.get(a.personId) ?? 0) + 1);
  }
  const vals = [...counts.values()];
  const spread = Math.max(...vals) - Math.min(...vals);
  ok('spreads a scarce role across its pool', counts.size >= 6 && spread <= 2,
    `${counts.size} preachers used, spread ${spread}`);
}

// ---- 8. pairs are favoured ------------------------------------------------
{
  const inp = base();
  inp.pairs = [{ aId: 300, bId: 301, roleId: R.welcome, mode: 'together', strength: 'prefer', weight: 8, note: null }];
  const res = generateRota(inp);
  let together = 0;
  for (const svc of inp.services) {
    const w = res.allocations.filter((a) => a.serviceId === svc.id && a.roleId === R.welcome).map((a) => a.personId);
    if (w.includes(300) && w.includes(301)) together++;
  }
  const solo = res.allocations.filter(
    (a) => a.roleId === R.welcome && (a.personId === 300 || a.personId === 301)).length - together * 2;
  ok('puts a pair together when it uses them', together > 0 && solo <= together,
    `together ${together}, solo ${solo}`);
}

// ---- 9. every allocation carries an explanation ---------------------------
{
  const res = generateRota(base());
  ok('explains every allocation',
    res.allocations.every((a) => a.reason && a.reason.length > 15));
  const sample = res.allocations.find((a) => !a.pinned)!;
  console.log(`       e.g. "${sample.reason}"`);
}

// ---- 10. between minimum and ideal, an empty place is not a gap -----------
{
  const res = generateRota(base());
  // Prayer ministry is min 2, ideal 4, with a pool of 23 shared across 4 roles.
  const prayerGaps = res.gaps.filter((g) => g.roleId === R.prayer);
  const perService = new Map<number, number>();
  for (const a of res.allocations.filter((x) => x.roleId === R.prayer)) {
    perService.set(a.serviceId, (perService.get(a.serviceId) ?? 0) + 1);
  }
  const anyBelowMin = [...perService.values()].some((n) => n < 2);
  ok('no gap reported while the minimum is met', prayerGaps.length === 0 || anyBelowMin,
    `${prayerGaps.length} prayer gaps`);
}

// ---- 11. a MUST pair is never split -------------------------------------
{
  const inp = base();
  inp.pairs = [{ aId: 300, bId: 301, roleId: R.welcome, mode: 'together', strength: 'must', weight: 9, note: null }];
  const res = generateRota(inp);
  let split = 0, together = 0;
  for (const svc of inp.services) {
    const w = res.allocations.filter((a) => a.serviceId === svc.id && a.roleId === R.welcome).map((a) => a.personId);
    const a = w.includes(300), b = w.includes(301);
    if (a && b) together++;
    else if (a !== b) split++;
  }
  ok('a must-pair is never split up', split === 0, `${split} services had one without the other`);
  ok('a must-pair is still used', together > 0, `used together ${together} times`);
}

// ---- 12. a must-pair whose partner is away is not placed alone -----------
{
  const inp = base();
  inp.pairs = [{ aId: 300, bId: 301, roleId: R.welcome, mode: 'together', strength: 'must', weight: 9, note: null }];
  // 301 is away for the whole horizon, so 300 must never appear on welcome.
  inp.unavailable = [{ personId: 301, fromDay: epochDay('2026-09-01'), toDay: epochDay('2026-12-31') }];
  const res = generateRota(inp);
  const lone = res.allocations.filter((a) => a.roleId === R.welcome && a.personId === 300).length;
  ok('the partner being away keeps both off', lone === 0, `${lone} lone placements`);
  // And the service is still filled by other people rather than left short.
  const perService = new Map<number, number>();
  for (const a of res.allocations.filter((x) => x.roleId === R.welcome)) {
    perService.set(a.serviceId, (perService.get(a.serviceId) ?? 0) + 1);
  }
  const short = [...perService.values()].filter((n) => n < 2).length;
  ok('and the role is still filled by others', short === 0, `${short} services short on welcome`);
}

// ---- 13. two people who must serve together do not deadlock --------------
{
  const inp = base();
  // Mutual must pairs are the case that made the original design unfillable:
  // each waited on the other and neither could ever be placed.
  inp.pairs = [
    { aId: 300, bId: 301, roleId: R.welcome, mode: 'together', strength: 'must', weight: 9, note: null },
    { aId: 302, bId: 303, roleId: R.welcome, mode: 'together', strength: 'must', weight: 9, note: null },
  ];
  const res = generateRota(inp);
  const used = new Set(res.allocations.filter((a) => a.roleId === R.welcome).map((a) => a.personId));
  ok('mutual must-pairs do not deadlock', used.size > 0, 'nobody was placed at all');
  const pairedUsed = [300, 301, 302, 303].filter((p) => used.has(p)).length;
  ok('and the paired people are usable', pairedUsed === 0 || pairedUsed % 2 === 0,
    `${pairedUsed} of the four were used`);
}

// ---- 14. "keep apart" is honoured ----------------------------------------
{
  const inp = base();
  inp.pairs = [{ aId: 300, bId: 301, roleId: R.welcome, mode: 'avoid', strength: 'prefer', weight: 5, note: null }];
  const res = generateRota(inp);
  let togetherAnyway = 0;
  for (const svc of inp.services) {
    const w = res.allocations.filter((a) => a.serviceId === svc.id && a.roleId === R.welcome).map((a) => a.personId);
    if (w.includes(300) && w.includes(301)) togetherAnyway++;
  }
  ok('people marked "keep apart" are never put together', togetherAnyway === 0,
    `${togetherAnyway} services had both`);
}

// ---- 15. a must-pair on a one-place role does not bar both from it --------
{
  const inp = base();
  // An unscoped "must be together" used to block BOTH people from every role
  // that only ever seats one person — so a married couple could never preach.
  inp.pairs = [{ aId: 100, bId: 101, roleId: null, mode: 'together', strength: 'must', weight: 9, note: null }];
  const res = generateRota(inp);
  const preachers = new Set(res.allocations.filter((a) => a.roleId === R.preacher).map((a) => a.personId));
  ok('an unscoped must-pair can still take a one-place role',
    preachers.has(100) || preachers.has(101),
    `preachers used: ${[...preachers].join(',')}`);
  // ...and on a two-place role they still go together.
  let split = 0;
  for (const svc of inp.services) {
    const w = res.allocations.filter((a) => a.serviceId === svc.id && a.roleId === R.reader).map((a) => a.personId);
    if (w.includes(100) !== w.includes(101) && (w.includes(100) || w.includes(101))) split++;
  }
  ok('and are still never split on a two-place role', split === 0, `${split} splits`);
}

// ---- 16. "keep apart" beats a competing "together" -----------------------
{
  const inp = base();
  // The same two people with BOTH rules. Keeping them apart is the stronger
  // statement and must win, whichever order the rows arrive in.
  inp.pairs = [
    { aId: 300, bId: 301, roleId: null, mode: 'together', strength: 'prefer', weight: 8, note: null },
    { aId: 300, bId: 301, roleId: R.welcome, mode: 'avoid', strength: 'prefer', weight: 5, note: null },
  ];
  const res = generateRota(inp);
  let together = 0;
  for (const svc of inp.services) {
    const w = res.allocations.filter((a) => a.serviceId === svc.id && a.roleId === R.welcome).map((a) => a.personId);
    if (w.includes(300) && w.includes(301)) together++;
  }
  ok('a keep-apart rule is not overridden by a together rule', together === 0,
    `${together} services had both`);
}

// ---- 17. a must-pair is not split by a relaxation ------------------------
{
  const inp = base();
  // Tight cadence on everyone, so the generator has to relax to fill the role,
  // and a must-pair that must survive that relaxation intact.
  for (const c of inp.capabilities) if (c.roleId === R.welcome) c.minGapDays = 60;
  inp.pairs = [{ aId: 300, bId: 301, roleId: R.welcome, mode: 'together', strength: 'must', weight: 9, note: null }];
  const res = generateRota(inp);
  let split = 0;
  for (const svc of inp.services) {
    const w = res.allocations.filter((a) => a.serviceId === svc.id && a.roleId === R.welcome).map((a) => a.personId);
    if (w.includes(300) !== w.includes(301)) split++;
  }
  ok('relaxing a cadence never splits a must-pair', split === 0,
    `${split} services had one without the other`);
}

// ---- 18. somebody with TWO must-partners takes both, or none -------------
{
  const inp = base();
  // Sue serves with both Sheila and Glenn. Checking partners one at a time
  // reserved a single extra seat however many had to come, so the first took it
  // and the rest were silently dropped — splitting an unbreakable pairing.
  inp.pairs = [
    { aId: 300, bId: 301, roleId: R.prayer, mode: 'together', strength: 'must', weight: 9, note: null },
    { aId: 300, bId: 302, roleId: R.prayer, mode: 'together', strength: 'must', weight: 9, note: null },
  ];
  const res = generateRota(inp);
  let broken = 0;
  for (const svc of inp.services) {
    const on = res.allocations
      .filter((a) => a.serviceId === svc.id && a.roleId === R.prayer)
      .map((a) => a.personId);
    const present = [300, 301, 302].filter((p) => on.includes(p));
    // All three, or none — never one or two of them.
    if (present.length !== 0 && present.length !== 3) broken++;
  }
  ok('a group of three who must serve together is never broken up', broken === 0,
    `${broken} services had only part of the group`);
}


// ---------------------------------------------------------------------------
// Case 19: somebody taking a break, or a guest.
//
// Both are enforced in SQL by OMITTING their capability rows while leaving them
// in `people` — see the two queries in src/rota/load.ts and the comment saying
// why they must not both be filtered. So the test is written the same way: take
// base(), drop person 100's capabilities, leave 100 in `people`. That is exactly
// the shape the database produces, which is the only reason this test means
// anything about the real thing.
// ---------------------------------------------------------------------------
{
  const withoutCaps = (): ReturnType<typeof base> => {
    const inp = base();
    inp.capabilities = inp.capabilities.filter((c) => c.personId !== 100);
    return inp;
  };

  // The control. Without this, a pool where 100 simply never came up looks
  // identical to a filter that works, and the test proves nothing.
  const before = generateRota(base());
  ok('the control: person 100 IS used when nothing is set',
    before.allocations.some((a) => a.personId === 100),
    'if this fails the rest of case 19 is vacuous');

  const after = generateRota(withoutCaps());

  // Every role, not just preacher: base() gives each preacher BOTH preacher and
  // leader, so checking one role would pass a half-done implementation.
  ok('somebody on a break is never allocated, in any role',
    !after.allocations.some((a) => a.personId === 100),
    `${after.allocations.filter((a) => a.personId === 100).length} allocations`);

  ok('and does not appear in the load report',
    !after.load.some((l) => l.personId === 100));

  // Leaving somebody off must not knock the rota over. This is what separates
  // "they were left out" from "the whole thing fell apart".
  const newGaps = after.gaps.length - before.gaps.length;
  ok('and the rest of the rota still fills up', newGaps <= 0,
    `${newGaps} new gaps appeared`);

  // The load-bearing one. blockedBecause gates on capBy BEFORE any relaxation
  // tier, so a shortage must never quietly bring them back.
  const squeezed = withoutCaps();
  squeezed.capabilities = squeezed.capabilities.filter(
    (c) => c.roleId !== R.preacher || c.personId === 101);
  const tight = generateRota(squeezed);
  ok('and is not brought back when the pool runs short',
    !tight.allocations.some((a) => a.personId === 100),
    'a break must outrank the relaxation tiers, not lose to them');

  // The keep-and-warn contract: an arrangement already made still stands. This
  // is why the PEOPLE query is deliberately not filtered — 100 is still in
  // `people`, so the pin survives and its slot stays taken.
  const pinned = withoutCaps();
  const svc = pinned.services[0]!;
  pinned.pinned = [{ serviceId: svc.id, roleId: R.preacher, slot: 1, personId: 100 }];
  const kept = generateRota(pinned);
  const stillOn = kept.allocations.filter(
    (a) => a.serviceId === svc.id && a.roleId === R.preacher && a.personId === 100);
  ok('but something already arranged is left exactly as it was',
    stillOn.length === 1 && stillOn[0]!.pinned,
    'going on a break must not cancel a confirmed place');

  // And nobody else is handed that slot. If the people query were filtered the
  // pin would vanish, slot 1 would look free, and apply's INSERT OR REPLACE
  // would overwrite the confirmed row on the unique (service, role, slot).
  const sameSlot = kept.allocations.filter(
    (a) => a.serviceId === svc.id && a.roleId === R.preacher && a.slot === 1);
  ok('and nobody else is given their slot', sameSlot.length === 1,
    `${sameSlot.length} people ended up in slot 1 — this is the silent-overwrite bug`);
}
console.log(failures === 0 ? '\nGenerator OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
