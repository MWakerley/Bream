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
import { capabilityFromRow, loadGeneratorInput } from '../src/rota/load.js';
import { DEFAULT_RULES } from '../src/rota/types.js';
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

  // Whatever IS passed in as a pin stands. load.ts now releases a break's
  // bookings before they get here (so a draft takes them off), but a pin the
  // generator is handed — a guest put on by hand, say — is never second-guessed.
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

  // A booking for somebody the generator cannot use at all — stopped serving,
  // or flagged as a possible duplicate, so absent from `people` — used to be
  // dropped, leaving the slot looking free for apply to overwrite.
  const ghost = withoutCaps();
  const gsvc = ghost.services[0]!;
  ghost.pinned = [{ serviceId: gsvc.id, roleId: R.preacher, slot: 1, personId: 9999 }];
  const ghostRun = generateRota(ghost);
  ok('a booking for someone the generator cannot use still holds its slot',
    !ghostRun.allocations.some(
      (a) => a.serviceId === gsvc.id && a.roleId === R.preacher && a.slot === 1),
    'slot 1 was handed to somebody else, which would overwrite the confirmed row');
}

// ---------------------------------------------------------------------------
// Case 20: the rules the church sets on the Draft rota rules page.
// ---------------------------------------------------------------------------
{
  const withRules = (over: Record<string, unknown>) => {
    const inp = base();
    inp.rules = { ...DEFAULT_RULES, ...over } as typeof inp.rules;
    return inp;
  };

  // A floor each person set on their own record in People ("not more often
  // than once every 8 weeks") reaches the generator as their minGapDays, so the
  // observable effect is the gap between one person's turns widening. There is
  // no floor for a whole role any more — see case 21 — so this is every
  // preacher having said the same thing for themselves.
  {
    const inp = base();
    inp.capabilities = inp.capabilities.map((c) =>
      c.roleId === R.preacher ? { ...c, minGapDays: 56 } : c);
    const res = generateRota(inp);
    const byPerson = new Map<number, number[]>();
    for (const a of res.allocations.filter((x) => x.roleId === R.preacher)) {
      const day = inp.services.find((s) => s.id === a.serviceId)!.day;
      byPerson.set(a.personId, [...(byPerson.get(a.personId) ?? []), day]);
    }
    let tooSoon = 0;
    for (const days of byPerson.values()) {
      days.sort((x, y) => x - y);
      for (let n = 1; n < days.length; n++) if (days[n]! - days[n - 1]! < 56) tooSoon++;
    }
    ok('a gap each person set for themselves is obeyed', tooSoon === 0,
      `${tooSoon} turns came round sooner than they asked`);
  }

  // "Ask them as often as needed". It is an EXEMPTION, not a rhythm: it lifts
  // the spacing the draft works out for somebody (the floor nobody ever chose)
  // and the church's gap between Sundays, and nothing else. Each check below is
  // set where only the tick can let the person be asked again, under "leave
  // the place empty" so that no bending can do it instead — the old check here
  // compared 1 with 1 on a pool with room to spare, and passed with the tick
  // doing nothing at all.
  const withTick = (inp: GeneratorInput) => {
    inp.capabilities = inp.capabilities.map((c) =>
      c.personId === 100 && c.roleId === R.preacher ? { ...c, askAnyTime: true } : c);
    return inp;
  };
  const preaches = (r: ReturnType<typeof generateRota>, ids?: Set<number>) =>
    r.allocations.filter((a) =>
      a.personId === 100 && a.roleId === R.preacher && (!ids || ids.has(a.serviceId))).length;
  {
    // Everybody else away for the first four Sundays. Without the tick, the
    // spacing worked out for him (half an even share, 26 days) refuses him the
    // three Sundays after his first.
    const awayMonth = () => {
      const inp = withRules({ whenShort: 'leave_empty' });
      const month = inp.services.slice(0, 4);
      inp.unavailable = [101, 102, 103, 104, 105, 106, 107].map((personId) => (
        { personId, fromDay: month[0]!.day, toDay: month[3]!.day }));
      return { inp, month: new Set(month.map((s) => s.id)) };
    };
    const plain = awayMonth();
    const ticked = awayMonth();
    withTick(ticked.inp);
    const before = preaches(generateRota(plain.inp), plain.month);
    const after = preaches(generateRota(ticked.inp), ticked.month);
    ok('"ask them as often as needed" lifts the spacing the draft would work out for them',
      after === 4 && after > before, `${before} of 4 Sundays without the tick, ${after} with it`);
  }
  {
    // Two preachers, and the church's rule of a clear fortnight between jobs.
    // Every third Sunday neither may preach, unless one of them has the tick.
    const twoPreachers = () => {
      const inp = withRules({ anyRoleHardDays: 15, whenShort: 'leave_empty' });
      inp.capabilities = inp.capabilities.filter((c) =>
        c.roleId === R.preacher ? c.personId <= 101
          : c.roleId === R.leader ? c.personId > 101 : true);
      return inp;
    };
    const plain = generateRota(twoPreachers());
    const ticked = generateRota(withTick(twoPreachers()));
    const empty = (r: ReturnType<typeof generateRota>) => r.gaps.filter((g) => g.roleId === R.preacher).length;
    ok('and lets them past the church\'s gap between Sundays',
      preaches(ticked) > preaches(plain) && empty(ticked) < empty(plain),
      `${preaches(plain)} turns and ${empty(plain)} empty pulpits without the tick, ` +
      `${preaches(ticked)} and ${empty(ticked)} with it`);
  }
  {
    // And it says nothing about how OFTEN: with enough people to go round, the
    // ticked person preaches exactly as often as they would have without it.
    // Somebody who should be on most Sundays needs a figure as well ("Not more
    // often than 1 week"); with one, the same person preaches every Sunday.
    // (Not the whole draft unchanged: a person the spacing no longer refuses
    // can change which job the draft fills first at a service.)
    const year = () => {
      const inp = base();
      const d0 = inp.services[0]!.day;
      inp.history = Array.from({ length: 52 }, (_, i) => (
        { personId: 100 + ((i + 1) % 8), roleId: R.preacher, day: d0 - 7 * (i + 1) }));
      return inp;
    };
    const plain = preaches(generateRota(year()));
    const ticked = preaches(generateRota(withTick(year())));
    const weekly = year();
    weekly.capabilities = weekly.capabilities.map((c) =>
      c.personId === 100 && c.roleId === R.preacher
        ? { ...c, askAnyTime: true, desiredEveryDays: 7, minGapDays: 7 } : c);
    const withFigure = preaches(generateRota(weekly));
    ok('but the tick is not a rhythm: on its own it does not make them preach more often',
      ticked === plain && withFigure === 13,
      `${plain} turns without the tick, ${ticked} with it, ${withFigure} with "every week" as well`);
  }

  // THE GUARD. record() sets lastAnyRole = svc.day as each allocation commits,
  // so within one service a person just given a role has sinceAny === 0.
  // Without the `sinceAny > 0` check a gap of ANY size would forbid every
  // second role at one service — silently retiring the whole combinations page.
  {
    const plain = generateRota(base());
    const doubled = (r: ReturnType<typeof generateRota>) => {
      let n = 0;
      for (const svc of base().services) {
        const here = r.allocations.filter((a) => a.serviceId === svc.id);
        const seen = new Set<number>();
        for (const a of here) { if (seen.has(a.personId)) n++; seen.add(a.personId); }
      }
      return n;
    };
    const res = generateRota(withRules({ anyRoleHardDays: 15 }));
    ok('a firm gap between Sundays does not forbid two jobs at ONE service',
      doubled(res) > 0 || doubled(plain) === 0,
      'this is the guard that stops the combination rules being silently retired');
  }

  // And it does what it says between services.
  //
  // With bending allowed the floor is RELAX_FLOOR_DAYS, not the rule: a service
  // that would otherwise be short may ask somebody again after a clear week.
  // That is the documented promise of "ask sooner if it comes to it", so the
  // rule is asserted at its strict setting and the bend is asserted separately.
  {
    const res = generateRota(withRules({ anyRoleHardDays: 15, whenShort: 'leave_empty' }));
    const dayOf = new Map(base().services.map((s) => [s.id, s.day]));
    const byPerson = new Map<number, number[]>();
    for (const a of res.allocations) {
      const d = dayOf.get(a.serviceId)!;
      const seen = byPerson.get(a.personId) ?? [];
      if (!seen.includes(d)) seen.push(d);
      byPerson.set(a.personId, seen);
    }
    let tooSoon = 0;
    for (const days of byPerson.values()) {
      days.sort((x, y) => x - y);
      for (let n = 1; n < days.length; n++) if (days[n]! - days[n - 1]! < 15) tooSoon++;
    }
    ok('but it is obeyed between services', tooSoon === 0,
      `${tooSoon} people served again inside a fortnight`);
  }

  // When bending IS allowed, the rule gives way — but never below a clear week,
  // which is the one thing the settings page promises outright.
  {
    const res = generateRota(withRules({ anyRoleHardDays: 15, whenShort: 'bend_both' }));
    const dayOf = new Map(base().services.map((s) => [s.id, s.day]));
    const byPerson = new Map<number, number[]>();
    for (const a of res.allocations) {
      const d = dayOf.get(a.serviceId)!;
      const seen = byPerson.get(a.personId) ?? [];
      if (!seen.includes(d)) seen.push(d);
      byPerson.set(a.personId, seen);
    }
    let insideAWeek = 0;
    for (const days of byPerson.values()) {
      days.sort((x, y) => x - y);
      for (let n = 1; n < days.length; n++) if (days[n]! - days[n - 1]! < 7) insideAWeek++;
    }
    ok('and bending never goes below a clear week', insideAWeek === 0,
      `${insideAWeek} people were asked again inside a week`);
  }

  // Most jobs at one service.
  {
    const res = generateRota(withRules({ maxRolesPerService: 1 }));
    let over = 0;
    for (const svc of base().services) {
      const counts = new Map<number, number>();
      for (const a of res.allocations.filter((x) => x.serviceId === svc.id)) {
        counts.set(a.personId, (counts.get(a.personId) ?? 0) + 1);
      }
      for (const n of counts.values()) if (n > 1) over++;
    }
    ok('a limit on jobs per service is obeyed', over === 0, `${over} people held more`);
  }

  // "Leave the place empty" must not bend anything.
  {
    const strict = generateRota(withRules({ whenShort: 'leave_empty' }));
    const loose = generateRota(withRules({ whenShort: 'bend_both' }));
    ok('refusing to bend never produces FEWER gaps than bending',
      strict.gaps.length >= loose.gaps.length,
      `${strict.gaps.length} strict vs ${loose.gaps.length} bending`);
  }

  // And the defaults change nothing at all, which is the promise the settings
  // page makes: "nothing here changes what the draft does until you change it".
  {
    const without = generateRota(base());
    const withDefaults = generateRota(withRules({}));
    ok('the default rules reproduce the old behaviour exactly',
      JSON.stringify(without.allocations) === JSON.stringify(withDefaults.allocations));
  }
}

// ---------------------------------------------------------------------------
// Case 21: each person's own rhythm drives the draft.
//
// The generator reads only what somebody said on their own record in People.
// The per-role "how often one person does the same job" figures that used to
// sit on Settings > Draft rota rules are not read at all, because a floor set
// for every preacher at once also bound the vicar who had asked to preach far
// more often than the rest. And the rhythms people DID state now really decide
// the draft: those who gave one are expected to take the turns it implies, and
// those who said nothing share what is left — rather than everybody being aimed
// at the same even share, with the fairness brake pulling the vicar back to it.
//
// Most checks below are written to fail on the code before this change; the
// numbers it gave are in the failure messages.
// ---------------------------------------------------------------------------
{
  const fnv = (s: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  // Who goes where, plus the gaps, warnings and totals — everything except the
  // one-sentence reasons, which now deliberately say where a rhythm came from.
  const fingerprint = (r: ReturnType<typeof generateRota>) => {
    const s = JSON.stringify({
      placed: r.allocations.map((a) => [a.serviceId, a.roleId, a.slot, a.personId, a.pinned, a.amber]),
      gaps: r.gaps, warnings: r.warnings, load: r.load,
    });
    return `${fnv(s)}/${s.length}`;
  };
  const setCap = (inp: GeneratorInput, personId: number, roleId: number, over: object) => {
    inp.capabilities = inp.capabilities.map((c) =>
      c.personId === personId && c.roleId === roleId ? { ...c, ...over } : c);
  };
  // A year of Sundays before the quarter, the eight preachers taking it in
  // turns — the shape the imported spreadsheet gives a real church. Without any
  // history every preacher counts as never having served, and the generator
  // deliberately gives each of those a first turn before anybody's rhythm can
  // tell, which would hide what these checks are about.
  const yearOfPreaching = () => {
    const d0 = base().services[0]!.day;
    return Array.from({ length: 52 }, (_, i) => (
      { personId: 100 + ((i + 1) % 8), roleId: R.preacher, day: d0 - 7 * (i + 1) }));
  };
  const preachDays = (inp: GeneratorInput, r: ReturnType<typeof generateRota>, personId: number) =>
    r.allocations
      .filter((a) => a.personId === personId && a.roleId === R.preacher)
      .map((a) => inp.services.find((s) => s.id === a.serviceId)!.day)
      .sort((x, y) => x - y);
  // A month, for "twice a month", is four Sundays: the generator takes a cap's
  // window in whole weeks, so alternate Sundays — 28 days from first to third —
  // are twice a month, as the church means it.
  const mostInAnyMonth = (days: number[]) => {
    let most = 0;
    for (let i = 0; i < days.length; i++) {
      let n = 0;
      for (let j = i; j < days.length && days[j]! - days[i]! < 28; j++) n++;
      most = Math.max(most, n);
    }
    return most;
  };
  const preacherGaps = (r: ReturnType<typeof generateRota>) =>
    r.gaps.filter((g) => g.roleId === R.preacher).length;

  // a. A church where nobody has said anything gets the very rota it got before.
  // The fingerprint was taken from the generator as it stood before per-person
  // rhythms drove the draft (commit e1583fd).
  {
    const fp = fingerprint(generateRota(base()));
    ok('with nobody stating a rhythm, the draft is exactly the one it always was',
      fp === 'bd957c7d/6833', `fingerprint ${fp}, expected bd957c7d/6833`);
  }

  // b. Twice a month and once a quarter, side by side in one pool.
  const twiceAndQuarterly = () => {
    const inp = base();
    inp.history = yearOfPreaching();
    setCap(inp, 100, R.preacher, { desiredEveryDays: 15, maxPerWindow: { count: 2, windowDays: 30 } });
    setCap(inp, 101, R.preacher, { desiredEveryDays: 91, minGapDays: 91 });
    return inp;
  };
  const mixedIn = twiceAndQuarterly();
  const mixed = generateRota(mixedIn);
  {
    const twice = preachDays(mixedIn, mixed, 100);
    const quarterly = preachDays(mixedIn, mixed, 101);
    const average = 13 / 8;
    ok('somebody who asks for twice a month preaches clearly more than the average',
      twice.length >= 2 * average, `${twice.length} against an average of ${average}`);
    ok('but never more than twice in any four Sundays', mostInAnyMonth(twice) <= 2,
      `${mostInAnyMonth(twice)} in one month`);
    // Thirteen Sundays hold at most six turns at two a month. The old even-share
    // brake held this person to every third week: five.
    ok('and as often as twice a month allows', twice.length >= 6,
      `${twice.length} of 13 Sundays (the old code gave 5)`);
    ok('somebody who asks for once a quarter preaches at most once in 13 Sundays',
      quarterly.length <= 1, `${quarterly.length} times`);
  }

  // c. The fairness brake no longer holds back somebody who asked for more.
  const vicarWeekly = () => {
    const inp = base();
    inp.history = yearOfPreaching();
    setCap(inp, 100, R.preacher, { desiredEveryDays: 7 });
    return inp;
  };
  {
    const inp = vicarWeekly();
    const n = preachDays(inp, generateRota(inp), 100).length;
    ok('a vicar who asks for every week preaches on most Sundays', n >= 11,
      `${n} of 13 Sundays (the old code gave 6)`);
  }
  // ...and when he is away, the people who said nothing still step in, even
  // under "leave the place empty". Their share of what he leaves is close to
  // nothing, so their TARGET is long — but the floor that target implies is a
  // hard refusal that rule never bends, and it must not grow with it.
  {
    const inp = vicarWeekly();
    const away = inp.services.slice(4, 7);
    inp.unavailable = [{ personId: 100, fromDay: away[0]!.day, toDay: away[2]!.day }];
    inp.rules = { ...DEFAULT_RULES, whenShort: 'leave_empty' };
    const res = generateRota(inp);
    const covered = away.filter((s) =>
      res.allocations.some((a) => a.serviceId === s.id && a.roleId === R.preacher)).length;
    ok('and when he is away the others still cover, even with nothing allowed to bend',
      covered === 3 && preacherGaps(res) === 0,
      `${covered} of the 3 Sundays covered, ${preacherGaps(res)} preacher gaps`);
  }

  // c2. ...however many Sundays are drafted at once. Measured from the first
  // service to the last, a weekly rhythm came to a seventh of a place in a
  // one-Sunday draft, and the one place set aside for everybody else was the
  // whole of it, so the vicar lost Sundays he had asked for whenever a church
  // drafted a month at a time. The history is the hard case: a year in which he
  // preached three Sundays in four, the last of them the Sunday before, so on
  // the day he is exactly on his rhythm while the others have waited weeks.
  // His figure goes in the way People saves it, through capabilityFromRow.
  const vicarHeavyYear = () => {
    const d0 = base().services[0]!.day;
    return Array.from({ length: 52 }, (_, i) => ({
      personId: i % 4 === 3 ? 101 + (Math.floor(i / 4) % 7) : 100,
      roleId: R.preacher, day: d0 - 7 * (i + 1),
    }));
  };
  const fromRecord = (personId: number, over: object) => capabilityFromRow({
    person_id: personId, role_id: R.preacher, max_per_period: null, period_days: null,
    min_gap_days: null, ask_any_time: 0, ...over,
  });
  const draftOf = (n: number, personId: number, over: object, history: GeneratorInput['history']) => {
    const inp = base();
    inp.services = sundays(n);
    inp.history = history;
    const mine = fromRecord(personId, over);
    inp.capabilities = inp.capabilities.map((c) =>
      c.personId === personId && c.roleId === R.preacher ? mine : c);
    return inp;
  };
  {
    const short: string[] = [];
    for (const n of [1, 2, 4, 13]) {
      const inp = draftOf(n, 100, { max_per_period: 1, period_days: 7 }, vicarHeavyYear());
      const got = preachDays(inp, generateRota(inp), 100).length;
      if (got !== n) short.push(`${got} of ${n}`);
    }
    ok('a vicar who asks for every week preaches every Sunday in a draft of 1, 2, 4 or 13',
      short.length === 0, `he preached ${short.join(', ')} (the old code gave 0 of 1, 0 of 2, 2 of 4)`);
    // And a short draft still finds somebody on the Sunday he is away, with
    // nothing allowed to bend: the fill-ins' long target must not turn into a
    // spacing that refuses them.
    const uncovered: string[] = [];
    for (const n of [1, 4]) {
      const inp = draftOf(n, 100, { max_per_period: 1, period_days: 7 }, vicarHeavyYear());
      inp.unavailable = [{ personId: 100, fromDay: inp.services[0]!.day, toDay: inp.services[0]!.day }];
      inp.rules = { ...DEFAULT_RULES, whenShort: 'leave_empty' };
      const gaps = preacherGaps(generateRota(inp));
      if (gaps) uncovered.push(`${gaps} empty in the ${n}-Sunday draft`);
    }
    ok('and when he is away the others still cover in a short draft too',
      uncovered.length === 0, uncovered.join(', '));
  }
  {
    // The other way round: counting a short draft properly must not let
    // somebody go past a cap they set. Twice a month, with two turns already in
    // the fortnight and the month before the draft, so the cap reaches across
    // the start of it.
    const d0 = base().services[0]!.day;
    const history = yearOfPreaching().filter((h) => h.personId !== 100)
      .concat([{ personId: 100, roleId: R.preacher, day: d0 - 14 }, { personId: 100, roleId: R.preacher, day: d0 - 28 }]);
    const inp = draftOf(4, 100, { max_per_period: 2, period_days: 30 }, history);
    const days = preachDays(inp, generateRota(inp), 100);
    const all = [d0 - 28, d0 - 14, ...days];
    ok('and somebody who asks for twice a month still keeps to it in a 4-Sunday draft',
      days.length >= 1 && mostInAnyMonth(all) <= 2,
      `${days.length} of 4 Sundays, ${mostInAnyMonth(all)} in one month counting the two before`);
  }

  // d. Those who said nothing share what is left, and are not squeezed for it.
  {
    // A church of three preachers, the same year of history either way, a
    // weekly vicar away for four Sundays, and nothing allowed to bend. Behind
    // him the other two are aimed at once in 182 days; were that allowed to set
    // their spacing as well (91 days), neither could cover any of his four
    // Sundays, having both preached within the last few weeks. The
    // control is the same church with nobody having said anything, which
    // covers all four. (The old check compared a run with a year of history
    // against one with none, nought with nought, and could not fail.)
    const threePreachers = (vicarSaid: boolean) => {
      const inp = base();
      const d0 = inp.services[0]!.day;
      inp.history = Array.from({ length: 52 }, (_, i) => (
        { personId: 100 + ((i + 1) % 3), roleId: R.preacher, day: d0 - 7 * (i + 1) }));
      inp.capabilities = inp.capabilities.filter((c) => c.roleId !== R.preacher || c.personId <= 102);
      if (vicarSaid) setCap(inp, 100, R.preacher, { desiredEveryDays: 7, minGapDays: 7 });
      const away = inp.services.slice(4, 8);
      inp.unavailable = [{ personId: 100, fromDay: away[0]!.day, toDay: away[3]!.day }];
      inp.rules = { ...DEFAULT_RULES, whenShort: 'leave_empty' };
      return inp;
    };
    const control = preacherGaps(generateRota(threePreachers(false)));
    const said = preacherGaps(generateRota(threePreachers(true)));
    ok('the rhythms people asked for leave no new empty pulpits',
      control === 0 && said === 0,
      `${said} empty pulpits with the vicar's rhythm, ${control} without it`);
    // Their implied floor, worked out by hand the way the generator does: half
    // the shorter of their share of what is left and the even share. 13 Sundays
    // cover 91 days of rota, though only 85 lie between the first and the last,
    // and the even share is still worked out over the 85; the two who stated a
    // rhythm take 91/15 + 91/91 places.
    const leftover = 13 - (91 / 15 + 91 / 91);
    const floor = Math.min((91 * 6) / leftover, (85 * 8) / 13) / 2;
    let inside = 0;
    for (const pid of [102, 103, 104, 105, 106, 107]) {
      const days = preachDays(mixedIn, mixed, pid);
      for (let i = 1; i < days.length; i++) if (days[i]! - days[i - 1]! < floor) inside++;
    }
    ok('and nobody who said nothing is asked again inside their implied floor', inside === 0,
      `${inside} turns came round inside ${floor.toFixed(1)} days`);
  }

  // e. What somebody said on their record, turned into numbers.
  {
    const row = (over: object) => ({
      person_id: 1, role_id: R.preacher, max_per_period: null, period_days: null,
      min_gap_days: null, ask_any_time: 0, ...over,
    });
    const capOnly = capabilityFromRow(row({ max_per_period: 2, period_days: 30 }));
    ok('"twice a month" aims at every 15 days, as a limit and not a floor',
      capOnly.desiredEveryDays === 15 && capOnly.minGapDays === null
        && capOnly.maxPerWindow?.count === 2 && capOnly.maxPerWindow?.windowDays === 30,
      JSON.stringify(capOnly));
    // Matt Wakerley's record: "once a quarter", and a stray "not more often than
    // every six months" from the box that no longer exists. The old code obeyed
    // the six months and he was never asked. The quarter is what counts now.
    const matt = capabilityFromRow(row({ max_per_period: 1, period_days: 91, min_gap_days: 182 }));
    ok('the old "not more often than" is no longer read',
      matt.desiredEveryDays === 91 && matt.minGapDays === null && matt.maxPerWindow?.windowDays === 91,
      JSON.stringify(matt));
    const alternate = capabilityFromRow(row({ max_per_period: 2, period_days: 30, spacing_weeks: 2 }));
    ok('"twice a month, every other week" is a fortnightly floor under the same rhythm',
      alternate.desiredEveryDays === 15 && alternate.minGapDays === 14 && alternate.spacingDays === 14,
      JSON.stringify(alternate));
    const spacingOnly = capabilityFromRow(row({ spacing_weeks: 2 }));
    ok('"every other week" on its own is the rhythm as well',
      spacingOnly.desiredEveryDays === 14 && spacingOnly.maxPerWindow === null,
      JSON.stringify(spacingOnly));
    const anyTime = capabilityFromRow(row({ max_per_period: 2, period_days: 30, ask_any_time: 1 }));
    ok('"as often as needed" keeps the rhythm but drops the limit',
      anyTime.desiredEveryDays === 15 && anyTime.maxPerWindow === null && anyTime.askAnyTime === true,
      JSON.stringify(anyTime));
    ok('which Sundays of the month come through, and "all five" is any',
      JSON.stringify(capabilityFromRow(row({ weeks_of_month: '3,1' })).weeksOfMonth) === '[1,3]'
        && capabilityFromRow(row({ weeks_of_month: '1,2,3,4,5' })).weeksOfMonth === null
        && capabilityFromRow(row({ weeks_of_month: 'x' })).weeksOfMonth === null);
    const nothing = capabilityFromRow(row({}));
    ok('saying nothing is no view at all',
      nothing.desiredEveryDays === null && nothing.minGapDays === null
        && nothing.maxPerWindow === null && nothing.askAnyTime === false,
      JSON.stringify(nothing));
    ok('"ask them as often as needed" comes through',
      capabilityFromRow(row({ ask_any_time: 1 })).askAnyTime === true);

    // The old per-role figures from Settings. Handing them to capabilityFromRow
    // proved nothing — it never looks at keys it does not know — so this goes
    // through loadGeneratorInput itself, against a stand-in for the database
    // that records every query and answers the capability one with a row
    // carrying both figures, as it would if they were selected again. That
    // catches them being put back into the SELECT, and being folded into a
    // person's figures anywhere on the way out.
    const queries: string[] = [];
    const roleFigures = { ...row({}), default_min_gap_days: 28, default_target_days: 56 };
    const isCapabilityQuery = (sql: string) => /FROM\s+person_roles/.test(sql);
    const fakeDb = {
      prepare(sql: string) {
        queries.push(sql);
        const stmt = {
          sql,
          bind: () => stmt,
          first: async () => null,
          all: async () => ({ results: [] }),
        };
        return stmt;
      },
      batch: async (stmts: { sql: string }[]) =>
        stmts.map((s) => ({ results: isCapabilityQuery(s.sql) ? [roleFigures] : [] })),
    };
    const loaded = await loadGeneratorInput(
      fakeDb as unknown as Parameters<typeof loadGeneratorInput>[0], '2026-09-06', '2026-11-29', 'test');
    const capSql = queries.find(isCapabilityQuery) ?? '';
    ok('the old per-role figures from Settings are not in the capability query',
      capSql !== '' && !/default_min_gap_days|default_target_days/.test(capSql),
      capSql || 'no capability query was made');
    ok('and a row carrying them anyway leaves the person with no view',
      JSON.stringify(loaded.capabilities) === JSON.stringify([nothing]),
      JSON.stringify(loaded.capabilities));
  }

  // f. The explanation says whose rhythm it was.
  {
    const said = mixed.allocations.find((a) => a.personId === 100 && /last did this/.test(a.reason));
    const share = mixed.allocations.find((a) =>
      a.roleId === R.preacher && a.personId >= 102 && /last did this/.test(a.reason));
    ok('a reason says when the rhythm is the one they asked for',
      !!said && /they asked for/.test(said.reason), said?.reason ?? 'no allocation to check');
    ok('and when it is a share of the work', !!share && /fair share/.test(share.reason),
      share?.reason ?? 'no allocation to check');
    if (said) console.log(`       e.g. "${said.reason}"`);
    if (share) console.log(`       e.g. "${share.reason}"`);

    // Somebody filling in behind a vicar who asked for every week. Their share
    // is arithmetically once in about 637 days, which is true and no help to
    // anybody reading why they are on; what the reason says instead is that
    // they are standing in. One sentence, and no figure that means nothing.
    const fillIns = (n: number) => {
      const inp = vicarWeekly();
      inp.services = sundays(n);
      const away = inp.services.slice(Math.min(4, n - 1), Math.min(7, n));
      inp.unavailable = [{ personId: 100, fromDay: away[0]!.day, toDay: away[away.length - 1]!.day }];
      return generateRota(inp).allocations
        .filter((a) => a.roleId === R.preacher && a.personId !== 100 && /last did this/.test(a.reason))
        .map((a) => a.reason);
    };
    const oneSentence = (r: string) => r.indexOf('.') === r.length - 1;
    for (const n of [13, 1]) {
      const reasons = fillIns(n);
      ok(`a fill-in is said to be standing in, with no share quoted (${n}-Sunday draft)`,
        reasons.length > 0 && reasons.every((r) =>
          /, and is standing in: most of these places go to people who asked to do it more often\.$/.test(r)
            && !/once every/.test(r) && oneSentence(r)),
        reasons[0] ?? 'nobody stood in');
      if (n === 13 && reasons[0]) console.log(`       e.g. "${reasons[0]}"`);
    }

    // And where nobody has said anything, a one-Sunday draft quotes the share
    // over the week it covers. From first service to last it is one day, and
    // eight preachers came out at "once every 8 days".
    const oneSunday = base();
    oneSunday.services = sundays(1);
    oneSunday.history = yearOfPreaching();
    const quoted = generateRota(oneSunday).allocations
      .find((a) => a.roleId === R.preacher && /last did this/.test(a.reason))?.reason ?? '';
    ok('and a one-Sunday draft quotes a share that means something',
      /against a fair share of about once every 56 days\.$/.test(quoted), quoted || 'no reason to check');
  }

  // g. When the figures people gave ask for every place a role has, those who
  // left theirs blank are only fill-ins, and the draft says so before it is
  // applied. Before, five blank preachers could get no Sunday in a quarter with
  // nothing said anywhere: the draft's load list only names people who got a
  // turn.
  {
    const fortnightly = base();
    fortnightly.history = yearOfPreaching();
    for (const pid of [100, 101, 102]) {
      setCap(fortnightly, pid, R.preacher, { desiredEveryDays: 14, minGapDays: 14 });
    }
    const said = generateRota(fortnightly).warnings;
    ok('the draft warns when the figures given ask for every place',
      said.includes('Preacher: the 3 people who gave a figure have asked for about 20 of the 13 places, '
        + 'so the 5 who left theirs blank will only be asked when those people cannot.'),
      JSON.stringify(said));
    const vicarSays = generateRota(vicarWeekly()).warnings;
    ok('and says it plainly when it is one person',
      vicarSays.includes('Preacher: the one person who gave a figure has asked for about 13 of the 13 places, '
        + 'so the 7 who left theirs blank will only be asked when that person cannot.'),
      JSON.stringify(vicarSays));

    // Never where it is not so.
    const about = (r: ReturnType<typeof generateRota>) =>
      r.warnings.filter((w) => /who gave a figure/.test(w));
    const everybody = base();
    everybody.history = yearOfPreaching();
    for (let pid = 100; pid < 108; pid++) {
      setCap(everybody, pid, R.preacher, { desiredEveryDays: 56, minGapDays: 56 });
    }
    // A once-a-quarter preacher in a one-Sunday draft has asked for about a
    // thirteenth of that Sunday, not the whole of it — which is what counting
    // "the most turns that would fit" instead of the weeks covered would say.
    const quarterlyOne = base();
    quarterlyOne.services = sundays(1);
    quarterlyOne.history = yearOfPreaching();
    setCap(quarterlyOne, 101, R.preacher, { desiredEveryDays: 91, minGapDays: 91 });
    const quiet = [
      ['nobody gave a figure', about(generateRota(base()))],
      ['the figures leave room', about(mixed)],
      ['nobody left theirs blank', about(generateRota(everybody))],
      ['a slow figure in a short draft', about(generateRota(quarterlyOne))],
    ] as const;
    const noisy = quiet.filter(([, w]) => w.length > 0);
    ok('and does not warn where nobody gave a figure, the figures leave room, nobody left theirs blank, '
      + 'or a slow figure meets a short draft',
      noisy.length === 0, noisy.map(([why, w]) => `${why}: ${w.join(' ')}`).join('; '));
  }
}
// ---------------------------------------------------------------------------
// How often, said once, and when (migrations/0029)
// ---------------------------------------------------------------------------
{
  const set = (inp: GeneratorInput, personId: number, roleId: number, over: object) => {
    inp.capabilities = inp.capabilities.map((c) =>
      c.personId === personId && c.roleId === roleId ? { ...c, ...over } : c);
  };
  const fromRecord = (personId: number, over: object) => capabilityFromRow({
    person_id: personId, role_id: R.preacher, max_per_period: null, period_days: null,
    ask_any_time: 0, ...over,
  });
  const preached = (inp: GeneratorInput, r: ReturnType<typeof generateRota>, personId: number) =>
    r.allocations
      .filter((a) => a.personId === personId && a.roleId === R.preacher)
      .map((a) => inp.services.find((s) => s.id === a.serviceId)!)
      .sort((x, y) => x.day - y.day);
  const year = (d0: number) => Array.from({ length: 52 }, (_, i) => (
    { personId: 100 + ((i + 1) % 8), roleId: R.preacher, day: d0 - 7 * (i + 1) }));

  // Matt Wakerley: "once a quarter", plus a stray six-month gap in the box that
  // has gone. He last preached six weeks before the quarter, and the old code
  // kept him off the whole of it.
  {
    const inp = base();
    const d0 = inp.services[0]!.day;
    inp.history = year(d0).filter((h) => h.personId !== 101).concat({ personId: 101, roleId: R.preacher, day: d0 - 42 });
    inp.capabilities = inp.capabilities.map((c) => c.personId === 101 && c.roleId === R.preacher
      ? fromRecord(101, { max_per_period: 1, period_days: 91, min_gap_days: 182 }) : c);
    const n = preached(inp, generateRota(inp), 101).length;
    ok('somebody who asks for once a quarter is asked once in the quarter', n === 1, `${n} times`);
  }

  // Only the 2nd Sunday of the month: never another week, and still asked.
  {
    const inp = base();
    inp.history = year(inp.services[0]!.day);
    set(inp, 102, R.preacher, { weeksOfMonth: [2] });
    set(inp, 102, R.leader, { weeksOfMonth: [2] });
    const res = generateRota(inp);
    const wrong = res.allocations.filter((a) => a.personId === 102)
      .map((a) => inp.services.find((s) => s.id === a.serviceId)!.date)
      .filter((d) => Math.ceil(Number(d.slice(8, 10)) / 7) !== 2);
    ok('somebody who only does the 2nd Sunday is never put on another week', wrong.length === 0, wrong.join(', '));
    ok('and is still asked on a 2nd Sunday', res.allocations.some((a) => a.personId === 102));
  }

  // "Twice a month, but every other week": every turn a whole number of
  // fortnights after the last, never a week or three weeks.
  {
    const inp = base();
    const d0 = inp.services[0]!.day;
    inp.history = year(d0).filter((h) => h.personId !== 100).concat({ personId: 100, roleId: R.preacher, day: d0 - 14 });
    inp.capabilities = inp.capabilities.map((c) => c.personId === 100 && c.roleId === R.preacher
      ? fromRecord(100, { max_per_period: 2, period_days: 30, spacing_weeks: 2 }) : c);
    const days = [d0 - 14, ...preached(inp, generateRota(inp), 100).map((s) => s.day)];
    const offBeat = days.slice(1).filter((d, i) => (d - days[i]!) % 14 !== 0);
    ok('twice a month, every other week, keeps to alternate Sundays',
      offBeat.length === 0 && days.length >= 6, `${days.length - 1} turns, gaps ${days.slice(1).map((d, i) => d - days[i]!).join(',')}`);
  }

  // "Once a month" is every four Sundays, not every five. The cap's window was
  // 30 days, which refused the fourth Sunday 28 days on.
  {
    const inp = base();
    inp.capabilities = inp.capabilities.filter((c) => c.roleId !== R.preacher || c.personId === 103);
    set(inp, 103, R.preacher, { desiredEveryDays: 30, maxPerWindow: { count: 1, windowDays: 30 } });
    inp.rules = { ...DEFAULT_RULES, whenShort: 'leave_empty' };
    const days = preached(inp, generateRota(inp), 103).map((s) => s.day);
    const gaps = days.slice(1).map((d, i) => d - days[i]!);
    ok('once a month is every four Sundays', gaps.length > 0 && gaps.every((g) => g === 28), gaps.join(','));
  }

  // A date somebody is already down for, later in the draft, counts against
  // their limit and their spacing before the walk reaches it.
  {
    const inp = base();
    set(inp, 105, R.preacher, { desiredEveryDays: 91, maxPerWindow: { count: 1, windowDays: 91 } });
    inp.pinned = [{ serviceId: 5, roleId: R.preacher, slot: 1, personId: 105 }];
    const n = preached(inp, generateRota(inp), 105).length;
    ok('a date already fixed later on counts against their limit', n === 1, `${n} times (old code: 2)`);
  }
}
console.log(failures === 0 ? '\nGenerator OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
