/**
 * Tests for the draft rota as something that can be changed by hand.
 *
 * Each of these is something that would go wrong quietly: a hand change that
 * the download does not show, a confirmed booking an editor thought was free,
 * a warning about somebody who is no longer on, or Apply writing a different
 * rota from the one on the screen.
 *
 *   npm run test:draft
 */
import { generateRota, epochDay } from '../src/rota/generate.js';
import { buildDraftView, derive, editableSlots, editService } from '../src/rota/draft.js';
import type { DraftCandidate, DraftView, EditContext } from '../src/rota/draft.js';
import { DEFAULT_RULES } from '../src/rota/types.js';
import type { GeneratorInput, GeneratorResult, GenService } from '../src/rota/types.js';

const R = { preacher: 1, reader: 2, computer: 3, kids: 4 };
const ROLE_NAMES = new Map<number, string>([
  [R.preacher, 'Preacher'], [R.reader, 'Reader'], [R.computer, 'Computer operator'],
  [R.kids, "Children's work"],
]);
const ROLES = [
  { roleId: R.preacher, min: 1, ideal: 1 },
  { roleId: R.reader, min: 2, ideal: 2 },
  { roleId: R.computer, min: 1, ideal: 1 },
  { roleId: R.kids, min: 1, ideal: 1 },
];

/** Two Sundays in the diary and one the draft would add (negative id). */
function services(): GenService[] {
  return [
    { id: 1, date: '2026-11-01' },
    { id: 2, date: '2026-11-08' },
    { id: -1, date: '2026-11-15' },
  ].map((s) => ({
    ...s, day: epochDay(s.date), time: '10:30', title: 'Worship', isCommunion: false,
    roles: ROLES.map((r) => ({ ...r })),
  }));
}

const PEOPLE = [
  ...[101, 102, 103, 104].map((id) => ({ id, name: `Preacher ${id}`, role: R.preacher })),
  ...[201, 202, 203, 204, 205, 206].map((id) => ({ id, name: `Reader ${id}`, role: R.reader })),
  ...[301, 302, 303].map((id) => ({ id, name: `Computer ${id}`, role: R.computer })),
  ...[401, 402, 403].map((id) => ({ id, name: `Kids ${id}`, role: R.kids })),
];

function input(): GeneratorInput {
  return {
    services: services(),
    people: PEOPLE.map((p) => ({ id: p.id, name: p.name })),
    roleNames: ROLE_NAMES,
    capabilities: PEOPLE.map((p) => ({
      personId: p.id, roleId: p.role, desiredEveryDays: null, minGapDays: null, maxPerWindow: null,
    })),
    combinations: new Map([
      [`${R.preacher}:${R.kids}`, { verdict: 'red' as const, reason: 'would be preaching while children\'s work is on' }],
      [`${R.reader}:${R.computer}`, { verdict: 'amber' as const, reason: 'allowed but not ideal' }],
    ]),
    pairs: [], unavailable: [], history: [],
    pinned: [
      // A confirmed booking the generator was given the person for.
      { serviceId: 1, roleId: R.preacher, slot: 1, personId: 101 },
      // One it was NOT: somebody who has stopped serving but is still booked.
      { serviceId: 2, roleId: R.reader, slot: 1, personId: 999 },
    ],
    runSeed: 'draft',
  };
}

/** Everybody ticked for each role, plus three people worth a word each. */
function candidates(): Map<number, DraftCandidate[]> {
  const out = new Map<number, DraftCandidate[]>();
  for (const p of PEOPLE) {
    out.set(p.role, [...(out.get(p.role) ?? []),
      { id: p.id, name: p.name, on_break: 0, is_guest: 0, away: 0 }]);
  }
  out.get(R.computer)!.push(
    { id: 501, name: 'Sue Baker', on_break: 0, is_guest: 0, away: 1 },
    { id: 502, name: 'Pat Doyle', on_break: 1, is_guest: 0, away: 0 },
    { id: 503, name: 'Roger Vane', on_break: 0, is_guest: 1, away: 0 },
  );
  // The preacher can be put on children's work by hand, and a reader on the
  // computer, so the combination rules have something to say.
  out.get(R.kids)!.push({ id: 101, name: 'Preacher 101', on_break: 0, is_guest: 0, away: 0 });
  out.get(R.computer)!.push(...[201, 202, 203, 204, 205, 206].map((id) =>
    ({ id, name: `Reader ${id}`, on_break: 0, is_guest: 0, away: 0 })));
  return out;
}

const CTX = (): EditContext => ({
  by: 'Matt', candidates: candidates(), combinations: input().combinations,
});

const key = (a: { serviceId: number; roleId: number; slot: number; personId: number }) =>
  `${a.serviceId}|${a.roleId}|${a.slot}|${a.personId}`;

const svc = (v: DraftView, id: number) => v.services.find((s) => s.id === id)!;
const row = (v: DraftView, id: number, roleId: number) => svc(v, id).rows.find((r) => r.roleId === roleId)!;

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

console.log('draft:');

const inp = input();
const result = generateRota(inp);
const view = buildDraftView(inp, result, {
  createdSundays: 1, released: [], pinNames: new Map([[999, 'Old Tom']]),
});
const d0 = derive(view);

// ---- 1. grouped the way a rota is read -------------------------------------
{
  ok('services come in date order', view.services.map((s) => s.id).join(',') === '1,2,-1');
  ok('a Sunday the draft would add is marked new', svc(view, -1).isNew && !svc(view, 1).isNew);
  ok('every service has its roles in order',
    view.services.every((s) => s.rows.map((r) => r.roleId).join(',') === '1,2,3,4'));
  let misplaced = 0;
  for (const a of result.allocations) {
    const r = row(view, a.serviceId, a.roleId);
    if (!r.people.some((p) => p.personId === a.personId && p.slot === a.slot && p.pinned === a.pinned)) misplaced++;
  }
  ok('every allocation is under its own service and role', misplaced === 0, `${misplaced} missing`);
  ok('people in a row are sorted by place',
    view.services.every((s) => s.rows.every((r) => r.people.every((p, i, arr) => i === 0 || arr[i - 1]!.slot < p.slot))));
}

// ---- 2. a booking the generator was not given is shown, and held ----------
{
  const readers = row(view, 2, R.reader);
  const tom = readers.people.find((p) => p.personId === 999);
  ok('a confirmed booking for somebody not in the pool is shown', !!tom && tom.pinned && tom.name === 'Old Tom' && tom.slot === 1);
  ok('and its place cannot be edited', !editableSlots(readers).includes(1), editableSlots(readers).join(','));
  ok('and it is not written by Apply', !d0.allocations.some((a) => a.personId === 999));
  ok('but it is in the download', d0.grid.find((s) => s.id === 2)!.rows.find((r) => r.roleId === R.reader)!.names.includes('Old Tom'));
  ok('and counted against the minimum', readers.people.length === 2,
    `${readers.people.length} people on readers`);
  const fallback = buildDraftView(inp, result, { createdSundays: 0, released: [], pinNames: new Map() });
  ok('a name that cannot be found still shows the place as taken',
    row(fallback, 2, R.reader).people.some((p) => p.personId === 999 && p.name === 'Already booked'));
}

// ---- 3. Apply writes what the generator decided, while nothing is changed --
{
  const generated = result.allocations.filter((a) => !a.pinned).map(key).sort();
  const derived = d0.allocations.map(key).sort();
  ok('derive gives Apply exactly the generator\'s placements', JSON.stringify(generated) === JSON.stringify(derived),
    `${generated.length} vs ${derived.length}`);
  ok('with the generator\'s reasons',
    d0.allocations.every((a) => result.allocations.some((g) => key(g) === key(a) && g.reason === a.reason)));
  const genLoad = new Map(result.load.map((l) => [l.personId, l.total]));
  ok('the load matches the generator\'s, person for person',
    [...genLoad].every(([id, n]) => d0.load.find((l) => l.personId === id)?.total === n));
  ok('fresh and kept add up', d0.fresh === derived.length && d0.kept === 2, `${d0.fresh}/${d0.kept}`);
  const genAmber = result.warnings.filter((w) => w.startsWith('Settled for an amber combination ')).sort();
  const ourAmber = d0.worthKnowing.filter((w) => w.startsWith('Settled for an amber combination ')).sort();
  ok('the amber summary reads as the generator wrote it', JSON.stringify(genAmber) === JSON.stringify(ourAmber));
}

// ---- 4. warnings: one placement's goes with the person ---------------------
{
  const r: GeneratorResult = {
    allocations: [
      { serviceId: 1, roleId: R.computer, slot: 1, personId: 301, pinned: false,
        reason: 'Computer 301 last did this 7 days ago, against a rhythm of about 15 — placed sooner than they asked to be asked again because the service would otherwise be short.',
        amber: [] },
      { serviceId: 1, roleId: R.reader, slot: 1, personId: 201, pinned: false, reason: 'x.', amber: [] },
      { serviceId: 1, roleId: R.reader, slot: 2, personId: 202, pinned: false, reason: 'x.', amber: [] },
      { serviceId: 1, roleId: R.kids, slot: 1, personId: 202, pinned: false,
        reason: 'Reader 202 has not done this in the period looked at (also Reader — allowed but not ideal).',
        amber: ['also Reader — allowed but not ideal'] },
    ],
    gaps: [{ serviceId: 1, roleId: R.preacher, slot: 1, because: {}, message: 'Nobody is able to do this role.' }],
    warnings: [
      'Preacher: nobody is marked as able to do this, so all 1 place will be left empty.',
      '2026-11-01: Computer 301 is on Computer operator sooner than they asked to be asked again.',
      'Settled for an amber combination 1 time: also Reader — allowed but not ideal.',
    ],
    load: [],
  };
  const small: GeneratorInput = { ...input(), services: [services()[0]!], pinned: [] };
  const v = buildDraftView(small, r, { createdSundays: 0, released: [], pinNames: new Map() });
  const comp = row(v, 1, R.computer).people[0]!;
  ok('a relaxation warning moves onto its person', comp.warning === r.warnings[1]);
  ok('and leaves the general list', v.warnings.length === 1 && v.warnings[0] === r.warnings[0], JSON.stringify(v.warnings));
  ok('the generator\'s amber summary is not kept', !v.warnings.some((w) => w.startsWith('Settled')));
  const d = derive(v);
  ok('derive puts them all back, in the generator\'s order',
    JSON.stringify(d.worthKnowing) === JSON.stringify(r.warnings), JSON.stringify(d.worthKnowing));
  ok('a gap\'s message is kept on its row', row(v, 1, R.preacher).message === 'Nobody is able to do this role.');
  ok('and the empty place is counted', d.empty === 1, `${d.empty}`);

  const out = editService(v, 1, new Map([[`${R.computer}:1`, 302]]), CTX());
  if ('error' in out) ok('replacing the relaxed person works', false, out.error);
  else {
    ok('the warning goes with the person replaced', !derive(out.view).worthKnowing.includes(r.warnings[1]!));
    ok('a row nobody changed keeps its message', row(out.view, 1, R.preacher).message !== null);
  }

  // Taking 202 off readers takes away the reason their kids place was amber.
  const off = editService(v, 1, new Map([[`${R.reader}:2`, 203]]), CTX());
  if ('error' in off) ok('changing the other half of an amber works', false, off.error);
  else {
    const kid = row(off.view, 1, R.kids).people[0]!;
    ok('an amber that no longer applies is cleared', kid.amber.length === 0, JSON.stringify(kid.amber));
    ok('and its reason stops mentioning it', !kid.reason.includes('also Reader'), kid.reason);
    ok('and the summary is worked out again',
      !derive(off.view).worthKnowing.some((w) => w.startsWith('Settled')));
  }
}

// ---- 5. changing a service by hand ----------------------------------------
{
  const before = JSON.stringify(view);
  const comp = row(view, 1, R.computer).people[0]!;
  const other = [301, 302, 303].find((id) => id !== comp.personId)!;
  const out = editService(view, 1, new Map([[`${R.computer}:1`, other]]), CTX());
  ok('the draft it was given is not changed', JSON.stringify(view) === before);
  if ('error' in out) ok('replacing a generated person works', false, out.error);
  else {
    const p = row(out.view, 1, R.computer).people[0]!;
    ok('the new person is on', p.personId === other && p.slot === 1);
    ok('their reason starts "Put on by ", in the service page\'s words', p.reason.startsWith('Put on by Matt'), p.reason);
    ok('and they are marked as changed by hand', p.byHand === true && !p.pinned);
    const d = derive(out.view);
    ok('Apply writes the new person', d.allocations.some((a) => a.serviceId === 1 && a.roleId === R.computer && a.personId === other));
    ok('and not the old one', !d.allocations.some((a) => a.serviceId === 1 && a.roleId === R.computer && a.personId === comp.personId));
    ok('the download shows the change',
      JSON.stringify(d.grid.find((s) => s.id === 1)!.rows.find((r) => r.roleId === R.computer)!.names) === JSON.stringify([p.name]));
    const was = (id: number) => d0.load.find((l) => l.personId === id)?.total ?? 0;
    const now = (id: number) => d.load.find((l) => l.personId === id)?.total ?? 0;
    ok('the load moves with it', now(other) === was(other) + 1 && now(comp.personId) === was(comp.personId) - 1);
    ok('the revision goes up', out.view.rev === view.rev + 1 && out.view.edits === 1);
    ok('the save is remembered for the notice', out.view.lastSave?.serviceId === 1 && out.view.lastSave.changed === 1);
    ok('nothing else at that service changed',
      JSON.stringify(row(out.view, 1, R.reader)) === JSON.stringify(row(view, 1, R.reader)));
  }
}

{
  const out = editService(view, 1, new Map([[`${R.reader}:2`, null]]), CTX());
  if ('error' in out) ok('"nobody" works', false, out.error);
  else {
    const readers = row(out.view, 1, R.reader);
    ok('"nobody" takes the person off', readers.people.length === 1 && !readers.people.some((p) => p.slot === 2));
    ok('and the row is short', derive(out.view).empty === d0.empty + 1, `${derive(out.view).empty} vs ${d0.empty}`);
    ok('and the place can be filled again', editableSlots(readers).includes(2));
  }
}

{
  const out = editService(view, 1, new Map([[`${R.computer}:1`, 777]]), CTX());
  ok('somebody not ticked for the role is refused', 'error' in out && /not ticked/.test(out.error),
    'error' in out ? out.error : 'accepted');
  const named = editService(view, 1, new Map([[`${R.computer}:1`, 104]]), CTX());
  ok('and named, with where to tick them', 'error' in named && named.error.startsWith('Preacher 104 is not ticked')
    && /People/.test(named.error), 'error' in named ? named.error : 'accepted');
}

{
  const out = editService(view, 1, new Map([[`${R.reader}:1`, 205], [`${R.reader}:2`, 205]]), CTX());
  ok('the same person twice in one role is refused', 'error' in out && /twice/.test(out.error),
    'error' in out ? out.error : 'accepted');
}

{
  const out = editService(view, 1, new Map([[`${R.preacher}:1`, 102]]), CTX());
  if ('error' in out) ok('a posted confirmed place is ignored', false, out.error);
  else {
    const preacher = row(out.view, 1, R.preacher).people;
    ok('a posted confirmed place is ignored', preacher.length === 1 && preacher[0]!.personId === 101 && preacher[0]!.pinned);
    ok('and counts as no change', out.changed === 0 && out.view.edits === 0 && out.view.rev === view.rev + 1);
  }
}

{
  const ghost = editService(view, 2, new Map([[`${R.reader}:1`, 203]]), CTX());
  ok('nor can a booking the generator held for somebody else be overwritten',
    !('error' in ghost) && row(ghost.view, 2, R.reader).people.some((p) => p.personId === 999 && p.slot === 1));
}

{
  // The preacher (a confirmed booking) also on children's work: not allowed.
  const out = editService(view, 1, new Map([[`${R.kids}:1`, 101]]), CTX());
  if ('error' in out) ok('a red combination is allowed by hand', false, out.error);
  else {
    const kid = row(out.view, 1, R.kids).people[0]!;
    ok('a red combination is allowed by hand, with a note',
      kid.personId === 101 && (kid.notes ?? []).includes('cannot also be Preacher at the same service'), JSON.stringify(kid.notes));
    ok('and the save says so', out.notes.some((n) => /Preacher 101 is also on Preacher here, which is marked as not allowed together/.test(n)),
      JSON.stringify(out.notes));
  }
}

{
  const reader = row(view, 1, R.reader).people[0]!.personId;
  const out = editService(view, 1, new Map([[`${R.computer}:1`, reader]]), CTX());
  if ('error' in out) ok('an amber combination by hand', false, out.error);
  else {
    const comp = row(out.view, 1, R.computer).people[0]!;
    ok('an amber combination is shown on the later role',
      comp.amber.length === 1 && comp.amber[0] === 'also Reader — allowed but not ideal', JSON.stringify(comp.amber));
    ok('and in the summary', derive(out.view).worthKnowing.some((w) => w.includes('also Reader — allowed but not ideal')));
  }
}

{
  const out = editService(view, 2, new Map([[`${R.computer}:1`, 501]]), CTX());
  ok('away that day is noted', !('error' in out)
    && (row(out.view, 2, R.computer).people[0]!.notes ?? []).includes('away that day')
    && out.notes.includes('Sue Baker is away that day.'), 'error' in out ? out.error : JSON.stringify(out.notes));
  const brk = editService(view, 2, new Map([[`${R.computer}:1`, 502]]), CTX());
  ok('on a break is noted', !('error' in brk) && (row(brk.view, 2, R.computer).people[0]!.notes ?? []).includes('on a break'));
  const guest = editService(view, 2, new Map([[`${R.computer}:1`, 503]]), CTX());
  ok('a guest is noted', !('error' in guest) && (row(guest.view, 2, R.computer).people[0]!.notes ?? []).includes('guest')
    && guest.notes.includes('Roger Vane is a guest.'));
}

{
  const out = editService(view, -1, new Map([[`${R.computer}:1`, 503]]), CTX());
  if ('error' in out) ok('a Sunday the draft would add can be changed', false, out.error);
  else {
    ok('a Sunday the draft would add can be changed',
      derive(out.view).allocations.some((a) => a.serviceId === -1 && a.roleId === R.computer && a.personId === 503));
  }
  ok('a service not in the draft is refused', 'error' in editService(view, 42, new Map(), CTX()));
}

{
  const spare = [201, 202, 203, 204, 205, 206].find((id) => !row(view, 1, R.reader).people.some((p) => p.personId === id))!;
  const a = editService(view, 1, new Map([[`${R.reader}:2`, null]]), CTX());
  const b = !('error' in a) ? editService(a.view, 1, new Map([[`${R.reader}:2`, spare]]), CTX()) : a;
  ok('every save moves the revision on', !('error' in b) && b.view.rev === 2 && b.view.edits === 2,
    !('error' in b) ? `rev ${b.view.rev} edits ${b.view.edits}` : b.error);
  ok('a place emptied can be filled again', !('error' in b) && row(b.view, 1, R.reader).people.some((p) => p.personId === spare && p.slot === 2));
}

// ---- 6. free places are counted, as the generator counts them --------------
// A confirmed booking can sit in a place numbered above the role's ideal: a
// visiting preacher put on beside a generated one lands in place 2, and the
// generated one is later taken off. Offering "places 1 to the ideal" then let a
// second preacher on to a one-preacher Sunday.
{
  const one: GeneratorInput = {
    ...input(), services: [services()[0]!],
    pinned: [{ serviceId: 1, roleId: R.preacher, slot: 2, personId: 101 }],
  };
  const res = generateRota(one);
  ok('the generator adds no second preacher beside a booking in place 2',
    !res.allocations.some((a) => a.roleId === R.preacher && !a.pinned));
  const v = buildDraftView(one, res, { createdSundays: 0, released: [], pinNames: new Map() });
  const preacher = row(v, 1, R.preacher);
  ok('so the draft offers no place to fill there', editableSlots(preacher).length === 0, editableSlots(preacher).join(','));
  const out = editService(v, 1, new Map([[`${R.preacher}:1`, 102]]), CTX());
  ok('and a place 1 sent anyway puts nobody else on', !('error' in out) && out.changed === 0
    && !derive(out.view).allocations.some((a) => a.roleId === R.preacher), 'error' in out ? out.error : `${out.changed}`);

  const booked = (slot: number) => ({
    personId: 900 + slot, name: `Booked ${slot}`, slot, reason: 'Already set — left exactly as it was.',
    amber: [] as string[], pinned: true,
  });
  const four = { roleId: 9, roleName: 'Prayer ministry', min: 2, ideal: 4, message: null, people: [booked(3), booked(5)] };
  ok('four places, with bookings in 3 and 5, offer the two lowest free', editableSlots(four).join(',') === '1,2',
    editableSlots(four).join(','));
  const mine = { ...four, people: [{ ...booked(1), personId: 31, pinned: false }, booked(3), booked(5)] };
  ok('the draft\'s own person keeps their place, and only one more is offered', editableSlots(mine).join(',') === '1,2',
    editableSlots(mine).join(','));
}

// ---- 7. a warning goes to the placement the rule was bent for --------------
// The generator's sentence names a date, a person and a role. Somebody on the
// same role at 08:00 and at 10:30 is over their limit only at 10:30, so the
// warning must go with that one: replacing it clears the warning, and replacing
// the 08:00 one does not.
{
  const day = '2026-11-01';
  const twice: GeneratorInput = {
    services: (['08:00', '10:30'] as const).map((time, i) => ({
      id: i + 1, date: day, day: epochDay(day), time, title: 'Worship', isCommunion: false,
      roles: [{ roleId: R.preacher, min: 1, ideal: 1 }],
    })),
    people: [{ id: 21, name: 'Bob' }], roleNames: ROLE_NAMES,
    capabilities: [{
      personId: 21, roleId: R.preacher, askAnyTime: true, desiredEveryDays: null, minGapDays: null,
      maxPerWindow: { count: 1, windowDays: 30 },
    }],
    combinations: new Map(), pairs: [], unavailable: [], history: [], pinned: [], runSeed: 'twice',
  };
  const res = generateRota(twice);
  const said = `${day}: Bob is on Preacher over the limit they asked for.`;
  const v = buildDraftView(twice, res, { createdSundays: 0, released: [], pinNames: new Map() });
  const early = row(v, 1, R.preacher).people[0];
  const late = row(v, 2, R.preacher).people[0];
  ok('the generator bent Bob\'s limit at 10:30', res.warnings.includes(said)
    && !!late?.reason.includes(' — placed over the limit they asked for because'), JSON.stringify(res.warnings));
  ok('and the warning is on the 10:30 placement, not the 08:00 one', late?.warning === said && !early?.warning,
    `08:00 ${early?.warning ?? '-'} / 10:30 ${late?.warning ?? '-'}`);
  const ctx: EditContext = {
    by: 'Matt', combinations: new Map(),
    candidates: new Map([[R.preacher, [21, 22].map((id) => ({
      id, name: id === 21 ? 'Bob' : 'Cal', on_break: 0, is_guest: 0, away: 0,
    }))]]),
  };
  const lateOff = editService(v, 2, new Map([[`${R.preacher}:1`, 22]]), ctx);
  ok('replacing the 10:30 Bob takes the warning with him',
    !('error' in lateOff) && !derive(lateOff.view).worthKnowing.includes(said));
  const earlyOff = editService(v, 1, new Map([[`${R.preacher}:1`, 22]]), ctx);
  ok('replacing the 08:00 Bob leaves it, since 10:30 is still over his limit',
    !('error' in earlyOff) && derive(earlyOff.view).worthKnowing.includes(said));
}

// ---- 8. the real generator's warnings and ambers, end to end ---------------
// draft.ts finds a relaxation warning by rebuilding the generator's sentence and
// reading its "— placed ... because" clause, and works the amber summary out
// again from the chips. Both depend on generate.ts's exact words, so this drives
// the real generator into both rather than trusting a hand-written result that
// could drift from it — as section 4's has, once, already.
//
// Ann is the only computer operator and asked for a fortnight between turns, so
// every Sunday after the first she is put on "sooner than they asked". Cy is the
// only one for prayer ministry and one of only two readers, and the two together
// are amber. Prayer's role id is the lower, so on a tie the generator fills it
// first and puts the amber on Cy's reading — the role read FIRST on the service.
{
  const G = { computer: 1, prayer: 2, reader: 3, preacher: 4 };
  const names = new Map([[G.computer, 'Computer operator'], [G.prayer, 'Prayer ministry'],
    [G.reader, 'Reader'], [G.preacher, 'Preacher']]);
  const roles = [
    { roleId: G.preacher, min: 1, ideal: 1 }, { roleId: G.reader, min: 2, ideal: 2 },
    { roleId: G.prayer, min: 1, ideal: 1 }, { roleId: G.computer, min: 1, ideal: 1 },
  ];
  const who = [
    { id: 11, name: 'Ann', roles: [G.computer] }, { id: 13, name: 'Cy', roles: [G.reader, G.prayer] },
    { id: 14, name: 'Dan', roles: [G.reader] }, { id: 15, name: 'Eve', roles: [G.preacher] },
    { id: 16, name: 'Fay', roles: [G.preacher] },
  ];
  const combinations = new Map([[`${G.prayer}:${G.reader}`, { verdict: 'amber' as const, reason: 'tiring' }]]);
  const real: GeneratorInput = {
    services: ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22'].map((date, i) => ({
      id: i + 1, date, day: epochDay(date), time: '10:30', title: 'Worship', isCommunion: false,
      roles: roles.map((r) => ({ ...r })),
    })),
    people: who.map((p) => ({ id: p.id, name: p.name })),
    roleNames: names,
    capabilities: who.flatMap((p) => p.roles.map((roleId) => ({
      personId: p.id, roleId, desiredEveryDays: null, maxPerWindow: null,
      minGapDays: p.name === 'Ann' ? 14 : null,
    }))),
    combinations, pairs: [], unavailable: [], history: [], pinned: [], runSeed: 'real',
    rules: { ...DEFAULT_RULES, whenShort: 'bend_both' },
  };
  const res = generateRota(real);
  const v = buildDraftView(real, res, { createdSundays: 0, released: [], pinNames: new Map() });
  const d = derive(v);

  const bent = res.allocations.filter((a) => a.reason.includes(' — placed '));
  ok('the generator bent a rule to fill the computer', bent.length === 3, `${bent.length} bent`);
  ok('every placement it bent a rule for carries its warning', bent.every((a) =>
    row(v, a.serviceId, a.roleId).people.some((p) => p.personId === a.personId && p.slot === a.slot && !!p.warning)));
  ok('and none is left in the general list', !v.warnings.some((w) =>
    w.includes('sooner than they asked to be asked again') || w.includes('over the limit they asked for')),
    JSON.stringify(v.warnings));

  const amberOf = (lines: string[]) => lines.filter((w) => w.startsWith('Settled for an amber combination ')).sort();
  ok('the generator settled for an amber', amberOf(res.warnings).length > 0, JSON.stringify(res.warnings));
  ok('and the draft\'s amber summary is the generator\'s, word for word',
    JSON.stringify(amberOf(d.worthKnowing)) === JSON.stringify(amberOf(res.warnings)),
    `${JSON.stringify(amberOf(d.worthKnowing))} vs ${JSON.stringify(amberOf(res.warnings))}`);

  const ctx: EditContext = {
    by: 'Matt', combinations, roleNames: names,
    candidates: new Map([
      [G.computer, [{ id: 11, name: 'Ann' }, { id: 17, name: 'Hal' }]],
      [G.reader, [{ id: 13, name: 'Cy' }, { id: 14, name: 'Dan' }]],
      [G.prayer, [{ id: 13, name: 'Cy' }]],
      [G.preacher, [{ id: 15, name: 'Eve' }, { id: 16, name: 'Fay' }]],
    ].map(([roleId, list]) => [roleId as number,
      (list as { id: number; name: string }[]).map((c) => ({ ...c, on_break: 0, is_guest: 0, away: 0 }))])),
  };

  // Replacing a relaxed placement takes its warning, and only its warning.
  const relaxed = row(v, 2, G.computer).people[0]!;
  const swapped = editService(v, 2, new Map([[`${G.computer}:1`, 17]]), ctx);
  if ('error' in swapped) ok('replacing a placement the generator bent a rule for', false, swapped.error);
  else {
    const after = derive(swapped.view).worthKnowing;
    ok('replacing a placement the generator bent a rule for takes its warning',
      !!relaxed.warning && !after.includes(relaxed.warning), relaxed.warning ?? 'no warning');
    ok('and leaves the other Sundays\' warnings', bent.length - 1 === after.filter((w) => w.includes('sooner than they asked')).length);
  }

  // Changing only the preacher leaves Cy's amber where the generator put it.
  const reader0 = row(v, 1, G.reader).people.find((p) => p.personId === 13)!;
  const prayer0 = row(v, 1, G.prayer).people.find((p) => p.personId === 13)!;
  ok('the generator put the amber on Cy\'s reading, with its reason',
    reader0.amber.join() === 'also Prayer ministry — tiring' && reader0.reason.includes('(also Prayer ministry — tiring)')
    && prayer0.amber.length === 0, `${JSON.stringify(reader0.amber)} ${reader0.reason}`);
  const other = row(v, 1, G.preacher).people[0]!.personId === 15 ? 16 : 15;
  const preached = editService(v, 1, new Map([[`${G.preacher}:1`, other]]), ctx);
  if ('error' in preached) ok('changing an unrelated role', false, preached.error);
  else {
    const reader1 = row(preached.view, 1, G.reader).people.find((p) => p.personId === 13)!;
    const prayer1 = row(preached.view, 1, G.prayer).people.find((p) => p.personId === 13)!;
    ok('changing an unrelated role leaves an amber where it was',
      JSON.stringify(reader1.amber) === JSON.stringify(reader0.amber) && prayer1.amber.length === 0,
      `${JSON.stringify(reader1.amber)} / ${JSON.stringify(prayer1.amber)}`);
    ok('and its reason still says why', reader1.reason === reader0.reason && prayer1.reason === prayer0.reason, reader1.reason);
    ok('and the summary is unchanged',
      JSON.stringify(amberOf(derive(preached.view).worthKnowing)) === JSON.stringify(amberOf(d.worthKnowing)));
  }

  // Cy taken off reading and put back by hand: the clash now involves somebody
  // just put on, so it is told on the later role — and that reason says why.
  const cySlot = reader0.slot;
  const off = editService(v, 1, new Map([[`${G.reader}:${cySlot}`, null]]), ctx);
  const back = 'error' in off ? off : editService(off.view, 1, new Map([[`${G.reader}:${cySlot}`, 13]]), ctx);
  if ('error' in back) ok('an amber that moves', false, back.error);
  else {
    const reader2 = row(back.view, 1, G.reader).people.find((p) => p.personId === 13)!;
    const prayer2 = row(back.view, 1, G.prayer).people.find((p) => p.personId === 13)!;
    ok('an amber that moves goes on the later role', prayer2.amber.join() === 'also Reader — tiring'
      && reader2.amber.length === 0, `${JSON.stringify(reader2.amber)} / ${JSON.stringify(prayer2.amber)}`);
    ok('and the reason where it now sits says why', prayer2.reason.includes(' (also Reader — tiring).'), prayer2.reason);
    ok('while the one it left does not', !reader2.reason.includes('(also'), reader2.reason);
  }
}

// ---- 9. "Tell me about every empty place" ----------------------------------
// The generator reports a place between a role's minimum and its ideal only when
// the church ticked this. The draft must count it too, or the setting does
// nothing on the page at all.
{
  const PR = 9;
  const base: GeneratorInput = {
    services: ['2026-11-01', '2026-11-08'].map((date, i) => ({
      id: i + 1, date, day: epochDay(date), time: '10:30', title: 'Worship', isCommunion: false,
      roles: [{ roleId: PR, min: 2, ideal: 4 }],
    })),
    people: [{ id: 31, name: 'Don' }, { id: 32, name: 'Christine' }],
    roleNames: new Map([[PR, 'Prayer ministry']]),
    capabilities: [31, 32].map((personId) => ({
      personId, roleId: PR, desiredEveryDays: null, minGapDays: null, maxPerWindow: null,
    })),
    combinations: new Map(), pairs: [], unavailable: [], history: [], pinned: [], runSeed: 'every',
  };
  const every: GeneratorInput = { ...base, rules: { ...DEFAULT_RULES, listEveryEmptyPlace: true } };
  const res = generateRota(every);
  const v = buildDraftView(every, res, { createdSundays: 0, released: [], pinNames: new Map() });
  ok('the setting is kept with the draft', v.listEveryEmptyPlace === true);
  ok('the generator reported the places short of the ideal', res.gaps.length === 2, `${res.gaps.length} gaps`);
  ok('and the draft counts every one of them', derive(v).empty === 4, `${derive(v).empty}`);
  ok('with the generator\'s reason kept on the row', row(v, 1, PR).message !== null);

  const plain = buildDraftView(base, generateRota(base), { createdSundays: 0, released: [], pinNames: new Map() });
  ok('without it, only places short of the minimum are counted',
    plain.listEveryEmptyPlace === false && derive(plain).empty === 0, `${derive(plain).empty}`);
  const parked: DraftView = { ...v };
  delete parked.listEveryEmptyPlace;
  ok('a draft parked before the setting was kept reads as without it', derive(parked).empty === 0);
}

console.log(failures === 0 ? '\nDraft OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
