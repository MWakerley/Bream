import { DEFAULT_RULES } from './types.js';
import { weekOfMonth } from '../frequency.js';
import type {
  Allocation, Gap, GenCapability, GeneratorInput, GeneratorResult, GenService, ServedRecord, Verdict,
} from './types.js';

/**
 * Draft rota generation.
 *
 * Greedy, walking services in date order, filling the most-constrained role
 * first and picking the person with the highest score. Chosen over a full
 * constraint solver on the design panel's unanimous verdict, principally because
 * every allocation here can be explained in one sentence — and a rota a
 * churchwarden cannot explain is one they override, after which the system stops
 * being used.
 *
 * PURE. No I/O, no Date.now(), no Math.random(), no module-level mutable state
 * (a Workers isolate is reused between requests, so module state would leak
 * across generations). The same inputs always give the same rota; regenerating
 * and getting a different answer each time destroys trust faster than a bad
 * rota does.
 */

const W = {
  debt: 100, // how overdue they are — the governing term
  fair: 40, // brake on the person who is capable of everything
  rest: 30, // short-horizon spacing across all roles
  pair: 25, // completing a pair who like serving together
  amber: 60, // per amber combination incurred
  sticky: 15, // held this slot in the previous draft
  beat: 30, // exactly on the spacing they asked for ("every other week")
} as const;

/** Someone who has never served ranks above the on-time and below the truly
 *  overdue, rather than infinitely overdue. */
const NEVER_SERVED_RATIO = 2.0;
const DEBT_CAP = 2.5;
/** A stated rhythm implies a floor even when nobody sets one. */
const IMPLIED_FLOOR = 0.5;
/** However many places the people with a stated rhythm would take, those with
 *  none are reckoned to share at least this many between them A QUARTER — see
 *  the fair-share section for why it cannot be allowed to reach nought, and for
 *  why it is a figure per quarter rather than per draft. */
const LEFTOVER_FLOOR = 1;
/** Thirteen weeks: the length of draft LEFTOVER_FLOOR is reckoned against. */
const QUARTER_DAYS = 91;
/** A draft with services on only one day is taken to speak for a week of rota,
 *  the commonest spacing there is. See coveredDays. */
const ONE_DAY_SPEAKS_FOR = 7;
/** Somebody who left their figure blank is "standing in", rather than taking a
 *  fair share, once what is left for them is less than half what an even share
 *  would have given them. Only the wording of a reason turns on it. */
const STAND_IN_FACTOR = 2;
/** Relaxation never goes below this, whatever the tier. */
const RELAX_FLOOR_DAYS = 7;

export function epochDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** FNV-1a. A reproducible coin-flip for candidates that are genuinely identical,
 *  so ties break the same way on every run without calling Math.random. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const comboKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
const pairKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

export function generateRota(input: GeneratorInput): GeneratorResult {
  const {
    services, people, roleNames, capabilities, combinations, pairs,
    unavailable, history, pinned, runSeed,
  } = input;
  // The church's own rules. Absent means exactly what the generator did before
  // there was a settings page, which is what every existing test asserts.
  const rules = input.rules ?? DEFAULT_RULES;
  // Only ONE weight is settable, and it is read through a per-run copy so the
  // module-level W stays immutable — a Workers isolate is reused between
  // requests, and a mutated constant would leak one church's setting into the
  // next request.
  const w = { ...W, fair: rules.fairWeight };

  // ---- indexes ------------------------------------------------------------
  const personById = new Map(people.map((p) => [p.id, p]));
  const capBy = new Map<string, GenCapability>();
  const eligible = new Map<number, number[]>(); // roleId -> personIds, sorted
  for (const c of capabilities) {
    if (!personById.has(c.personId)) continue;
    capBy.set(`${c.personId}:${c.roleId}`, c);
    const arr = eligible.get(c.roleId) ?? [];
    arr.push(c.personId);
    eligible.set(c.roleId, arr);
  }
  for (const arr of eligible.values()) arr.sort((a, b) => a - b);

  const unavailByPerson = new Map<number, { fromDay: number; toDay: number }[]>();
  for (const u of unavailable) {
    const arr = unavailByPerson.get(u.personId) ?? [];
    arr.push({ fromDay: u.fromDay, toDay: u.toDay });
    unavailByPerson.set(u.personId, arr);
  }

  const pairsByPerson = new Map<number, typeof pairs>();
  for (const p of pairs) {
    for (const id of [p.aId, p.bId]) {
      const arr = pairsByPerson.get(id) ?? [];
      arr.push(p);
      pairsByPerson.set(id, arr);
    }
  }

  const sorted = [...services].sort(
    (a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.id - b.id,
  );
  const horizonDays = sorted.length
    ? Math.max(1, (sorted[sorted.length - 1]!.day - sorted[0]!.day) + 1)
    : 1;

  // ---- fair-share cadence -------------------------------------------------
  // Where somebody has stated no preference, their target rhythm is their share
  // of that role: horizon * eligibleCount / totalSlots. One formula serves an
  // 8-person preaching pool (~56 days) and a 23-person welcome pool (~80 days)
  // with nobody configuring either.
  //
  // Unless somebody in the role HAS said. Then each of them is expected to take
  // the turns their own rhythm implies — about six a quarter for the vicar who
  // asked for twice a month, one for the preacher who asked for once a quarter —
  // and the people who said nothing share what is LEFT, rather than an even
  // split of the whole. The even split is what used to happen, and it meant the
  // fairness brake below held the vicar back towards the same share as
  // everybody else: exactly what he had asked not to have.
  //
  // Where NOBODY in a role has said anything, the arithmetic is the old
  // arithmetic exactly — the same expressions in the same order, not merely the
  // same algebra — so a church that has set no preferences gets the very rota
  // it got before, down to the last tie-break. seed/generator-test.ts holds a
  // fingerprint of that rota, taken from the code before this change.
  const slotsPerRole = new Map<number, number>();
  for (const s of sorted) {
    for (const r of s.roles) slotsPerRole.set(r.roleId, (slotsPerRole.get(r.roleId) ?? 0) + r.ideal);
  }

  /** What this person asked for in this role, in days, or null if they said
   *  nothing. load.ts has already folded a cap into desiredEveryDays; the cap is
   *  read here as well so a caller that sets only the cap means the same thing. */
  const statedEvery = (c: GenCapability | undefined): number | null => {
    const every = c?.desiredEveryDays
      || (c?.maxPerWindow ? c.maxPerWindow.windowDays / c.maxPerWindow.count : null);
    // Only a real number of days counts as having said something. load.ts never
    // hands over anything else, but the shares below divide by it, and one
    // nonsense row must not turn a whole role's arithmetic into NaN.
    return every != null && Number.isFinite(every) && every > 0 ? every : null;
  };

  // How long a stretch of the calendar the draft speaks for, in each role.
  //
  // horizonDays runs from the first service to the last, and that is one
  // service short of it: four Sundays are four weeks of rota, not the 22 days
  // from the first to the fourth, and one Sunday is that week, not a single
  // day. Measured from first to last, a weekly vicar's rhythm came to a seventh
  // of a place in a one-Sunday draft and three of four in a month, and the
  // people who said nothing took the rest — so how often he preached depended
  // on how many weeks somebody happened to ask for, not on what his record said.
  //
  // Each service is counted as standing for the average spacing of the role's
  // own services, so a weekly role counts a week apiece and a monthly one a
  // month; services on one day only are taken to speak for a week. The choosing
  // reads this only in a role where somebody HAS stated a figure; where nobody
  // has, the old horizon arithmetic below is left exactly as it was.
  const coveredDays = new Map<number, number>();
  {
    const daysByRole = new Map<number, Set<number>>();
    for (const s of sorted) {
      for (const r of s.roles) {
        if (!(r.ideal > 0)) continue;
        const set = daysByRole.get(r.roleId) ?? new Set<number>();
        set.add(s.day);
        daysByRole.set(r.roleId, set);
      }
    }
    for (const [roleId, set] of daysByRole) {
      const days = [...set].sort((a, b) => a - b);
      const n = days.length;
      coveredDays.set(roleId, n > 1
        ? ((days[n - 1]! - days[0]!) * n) / (n - 1)
        : ONE_DAY_SPEAKS_FOR);
    }
  }
  const covered = (roleId: number) => coveredDays.get(roleId) ?? horizonDays;

  // A role's places, by which Sunday of the month they fall on, so somebody who
  // only does the 2nd Sunday is never expected to take more places than the
  // 2nd Sundays hold.
  const slotsByWeek = new Map<number, number[]>();
  for (const s of sorted) {
    const wk = weekOfMonth(s.date);
    for (const r of s.roles) {
      const arr = slotsByWeek.get(r.roleId) ?? [0, 0, 0, 0, 0, 0];
      arr[wk] = (arr[wk] ?? 0) + r.ideal;
      slotsByWeek.set(r.roleId, arr);
    }
  }
  const slotsOnTheirWeeks = (c: GenCapability | undefined, roleId: number) => {
    if (!c?.weeksOfMonth) return Infinity;
    const arr = slotsByWeek.get(roleId) ?? [];
    return c.weeksOfMonth.reduce((n, wk) => n + (arr[wk] ?? 0), 0);
  };

  /** How many of a role's places somebody's own rhythm would take: the weeks
   *  the draft covers divided by their rhythm, so a weekly vicar is every one of
   *  the Sundays in a draft of any length — but never more than the Sundays
   *  they are willing to do. */
  const statedTurns = (every: number, roleId: number, slots: number, c?: GenCapability) =>
    Math.min(slots, covered(roleId) / every, slotsOnTheirWeeks(c, roleId));

  const evenShare = new Map<number, number>(); // the old figure: everybody alike
  const fairShare = new Map<number, number>(); // the target for those who said nothing
  const unstatedTurns = new Map<number, number>(); // places each of them is expected to take
  // What the reasons quote and the audit reports, kept apart from the figures
  // the choosing runs on, so that rewording an explanation can never change who
  // is chosen.
  const shareToQuote = new Map<number, number>(); // the fair share, as a reason says it
  const standingIn = new Set<number>(); // roles where those who said nothing only fill in
  const statedAsk = new Map<number, { demand: number; unstated: number }>();
  for (const [roleId, slots] of slotsPerRole) {
    const pool = eligible.get(roleId) ?? [];
    const n = pool.length;
    let unstated = 0;
    let statedDemand = 0;
    for (const pid of pool) {
      const c = capBy.get(`${pid}:${roleId}`);
      const every = statedEvery(c);
      if (every == null) unstated++;
      else statedDemand += statedTurns(every, roleId, slots, c);
    }
    statedAsk.set(roleId, { demand: statedDemand, unstated });
    const even = n > 0 && slots > 0 ? (horizonDays * n) / slots : horizonDays;
    evenShare.set(roleId, even);
    // The same even share measured over the weeks the draft covers. It is the
    // figure a reason quotes even where nobody has said anything. The horizon
    // figure the choosing still runs on there is a little short over a quarter
    // (52 days rather than 56 for eight preachers), which changes nothing anyone
    // would notice; but in a one-Sunday draft it is "once every 8 days" for one
    // of eight preachers, which reads as nonsense.
    const span = covered(roleId);
    const evenCovered = n > 0 && slots > 0 ? (span * n) / slots : span;
    shareToQuote.set(roleId, evenCovered);
    if (unstated === n || !(slots > 0)) {
      fairShare.set(roleId, even);
      if (n > 0 && slots > 0) unstatedTurns.set(roleId, slots / n);
      continue;
    }
    if (unstated === 0) {
      // Everybody has said; nobody is aimed at a share.
      fairShare.set(roleId, even);
      continue;
    }
    // When the people who stated a rhythm would between them fill every place —
    // the vicar who asks for every week — what is left is nought, and their
    // share of nought is "never": an infinite target, or a division by zero.
    // Instead they are reckoned to share at least one place a quarter, so each
    // is aimed at no less often than once in about (91 * unstated) days. In
    // practice that makes them fill-ins, there for the Sundays the vicar is away
    // or held back, and still ordered among themselves by who has gone longest.
    //
    // The figure is a TARGET, measured as debt; the floor it would imply is
    // capped separately in floorGap, so a long target never makes a fill-in
    // harder to reach on the day they are needed.
    //
    // That one place is reckoned per QUARTER, in proportion to the weeks the
    // draft covers, and the share is measured over those same weeks. Held at
    // one place per draft, it was the whole of a one-Sunday draft and a quarter
    // of a four-Sunday one, so the fill-ins' target came out at a week or two —
    // well overdue on any Sunday — and they took the Sundays the vicar had
    // asked for. In proportion, the target is the same however many weeks are
    // drafted at once: about 637 days for seven fill-ins behind a weekly vicar,
    // whether the draft is one Sunday or thirteen.
    const leftover = Math.max(
      LEFTOVER_FLOOR * (span / QUARTER_DAYS),
      slots - Math.min(slots, statedDemand),
    );
    const share = (span * unstated) / leftover;
    fairShare.set(roleId, share);
    unstatedTurns.set(roleId, leftover / unstated);
    shareToQuote.set(roleId, share);
    // "Once every 637 days" is arithmetically their share, and no help at all
    // to the person reading why Sue is on: what has happened is that others
    // asked for most of the places and she is filling a gap.
    if (share > STAND_IN_FACTOR * evenCovered) standingIn.add(roleId);
  }

  const targetInterval = (personId: number, roleId: number): number =>
    statedEvery(capBy.get(`${personId}:${roleId}`))
      ?? Math.max(1, fairShare.get(roleId) ?? horizonDays);
  const floorGap = (personId: number, roleId: number): number => {
    const c = capBy.get(`${personId}:${roleId}`);
    // What they asked for themselves always wins, exemption or not: the tick
    // removes a rule set on somebody's behalf, never one they set themselves.
    if (c?.minGapDays != null) return c.minGapDays;
    // "Ask them as often as needed". Without this the implied floor below would
    // still refuse the vicar at about half his fair share — which is precisely
    // the case the churchwarden meant by "unless someone is doing them
    // frequently", and it would have gone on happening invisibly.
    if (c?.askAnyTime) return 0;
    const every = statedEvery(c);
    if (every != null) return every * IMPLIED_FLOOR;
    // Somebody who said nothing, measured against what is left by those who
    // did. That target can be long — years, when the vicar has asked for every
    // week — and the floor it implies is a HARD refusal at the first attempt,
    // which even "leave the place empty" never bends. So the floor is never
    // stricter than the even share would have made it: other people asking for
    // more must never be the reason a service goes short on the Sunday the
    // vicar is away. With nobody stating anything the two figures are the same
    // number, and this is the old floor exactly.
    const share = Math.min(fairShare.get(roleId) ?? horizonDays, evenShare.get(roleId) ?? horizonDays);
    return Math.max(1, share) * IMPLIED_FLOOR;
  };

  // ---- ledger, seeded from history ---------------------------------------
  // Without this the first weeks of a quarter are decided by tie-breaks and
  // somebody who served last Sunday gets booked again on the first.
  const lastInRole = new Map<string, number>();
  const lastAnyRole = new Map<number, number>();
  const servedDays = new Map<string, number[]>(); // person:role -> sorted days
  const countInRole = new Map<string, number>();
  const countTotal = new Map<number, number>();

  const record = (r: ServedRecord) => {
    const k = `${r.personId}:${r.roleId}`;
    lastInRole.set(k, Math.max(lastInRole.get(k) ?? -Infinity, r.day));
    lastAnyRole.set(r.personId, Math.max(lastAnyRole.get(r.personId) ?? -Infinity, r.day));
    const arr = servedDays.get(k) ?? [];
    arr.push(r.day);
    arr.sort((a, b) => a - b);
    servedDays.set(k, arr);
    countInRole.set(k, (countInRole.get(k) ?? 0) + 1);
    countTotal.set(r.personId, (countTotal.get(r.personId) ?? 0) + 1);
  };
  for (const h of history) record(h);

  // Bookings already fixed LATER in the draft. The walk goes in date order and
  // records a pin only when it reaches that service, so without these a pin on
  // 29 November was invisible on 22 November: the draft would happily put the
  // same person on the Sunday before, inside their own gap and over their own
  // limit, and only the pin it could not see kept them on the 29th as well.
  const dayOfService = new Map(sorted.map((s) => [s.id, s.day]));
  const pinnedAhead = new Map<string, number[]>(); // person:role -> days, sorted
  const pinnedAheadAny = new Map<number, number[]>(); // person -> days, sorted
  for (const p of pinned) {
    const day = dayOfService.get(p.serviceId);
    if (day == null || !personById.has(p.personId)) continue;
    const k = `${p.personId}:${p.roleId}`;
    pinnedAhead.set(k, [...(pinnedAhead.get(k) ?? []), day].sort((a, b) => a - b));
    pinnedAheadAny.set(p.personId, [...(pinnedAheadAny.get(p.personId) ?? []), day].sort((a, b) => a - b));
  }

  /**
   * Whether one more turn on `day` keeps within "N times every P".
   *
   * Every window of P days that would contain the new turn is checked, looking
   * forward to fixed bookings as well as back, not only the window ending today.
   *
   * P is taken in whole weeks, rounded down: services come a week apart, and a
   * month is 30 days, so "once a month" over a 30-day window refused a fourth
   * Sunday 28 days on and made it every five weeks; "twice a month" refused the
   * third of a run of alternate Sundays. Quarters are 13 weeks exactly and are
   * unchanged.
   */
  const fitsCap = (days: number[], day: number, cap: { count: number; windowDays: number }) => {
    const win = cap.windowDays >= 7 ? Math.floor(cap.windowDays / 7) * 7 : cap.windowDays;
    const near = days.filter((d) => d > day - win && d < day + win);
    const starts = [day, ...near.filter((d) => d <= day)];
    for (const s of starts) {
      const n = 1 + near.filter((d) => d >= s && d < s + win).length;
      if (n > cap.count) return false;
    }
    return true;
  };

  // Counts accumulated during THIS run, used for fairness and tie-breaks.
  const runTotal = new Map<number, number>();
  const runInRole = new Map<string, number>();

  // Expected load for a person: the sum over their roles of the places they are
  // expected to take there — the turns their own rhythm implies where they gave
  // one, their share of what is left where they did not, and plain slots
  // divided by eligible count where nobody in the role said anything. Measured
  // against their OWN expectation, not the congregation mean — a preacher
  // legitimately serves more than a reader, and the vicar who asked for every
  // other Sunday more than either. Holding him to an even share instead is the
  // brake this used to apply, and it quietly undid what he had asked for.
  const expectedLoad = new Map<number, number>();
  for (const c of capabilities) {
    const n = eligible.get(c.roleId)?.length ?? 0;
    const slots = slotsPerRole.get(c.roleId) ?? 0;
    if (!n || !slots) continue;
    const every = statedEvery(c);
    const turns = every != null
      ? statedTurns(every, c.roleId, slots, c)
      : unstatedTurns.get(c.roleId) ?? slots / n;
    expectedLoad.set(c.personId, (expectedLoad.get(c.personId) ?? 0) + turns);
  }

  const isUnavailable = (personId: number, day: number) =>
    (unavailByPerson.get(personId) ?? []).some((u) => day >= u.fromDay && day <= u.toDay);

  const verdictFor = (a: number, b: number): Verdict =>
    combinations.get(comboKey(a, b))?.verdict ?? 'green';

  const pairBetween = (a: number, b: number, roleId: number) => {
    const list = (pairsByPerson.get(a) ?? []).filter(
      (p) => (p.aId === b || p.bId === b) && (p.roleId === null || p.roleId === roleId),
    );
    // Two people can hold more than one pairing at once — a role-scoped "keep
    // apart" and a general "prefer together", say. Taking whichever happened to
    // be first meant a keep-apart could be silently ignored. Keeping people
    // apart is the stronger statement, and a rule naming this role beats one
    // that applies to any role, so the list is ordered rather than sampled.
    list.sort((x, y) => {
      if (x.mode !== y.mode) return x.mode === 'avoid' ? -1 : 1;
      if ((x.roleId === null) !== (y.roleId === null)) return x.roleId === null ? 1 : -1;
      if (x.strength !== y.strength) return x.strength === 'must' ? -1 : 1;
      return 0;
    });
    return list[0];
  };

  // ---- output -------------------------------------------------------------
  const allocations: Allocation[] = [];
  const gaps: Gap[] = [];
  const warnings: string[] = [];

  // ---- capacity audit, before anything is allocated ----------------------
  // Deliberately conservative: it only reports a shortfall it can prove from
  // the FLOOR, because an audit that cries shortfall on every role (the flaw the
  // review found in the original design) trains people to ignore it.
  for (const [roleId, slots] of slotsPerRole) {
    const pool = eligible.get(roleId) ?? [];
    if (pool.length === 0) {
      warnings.push(
        `${roleNames.get(roleId) ?? 'A role'}: nobody is marked as able to do this, so all ` +
        `${slots} place${slots === 1 ? '' : 's'} will be left empty.`,
      );
      continue;
    }
    let supply = 0;
    for (const pid of pool) {
      const gap = Math.max(1, floorGap(pid, roleId));
      supply += Math.min(Math.floor(horizonDays / gap) + 1,
        slotsOnTheirWeeks(capBy.get(`${pid}:${roleId}`), roleId));
    }
    if (supply < slots) {
      warnings.push(
        `${roleNames.get(roleId) ?? 'A role'}: ${slots} places to fill, but the ` +
        `${pool.length} people who can do it cannot cover more than ${supply} at the ` +
        `intervals they have asked for. Some places will stay empty.`,
      );
    }
    // The opposite of a shortfall: people's own figures asking for every place
    // there is. Those who left theirs blank are then aimed at almost nothing —
    // there for the Sundays the others cannot do, and otherwise not at all.
    // That is what the rules say should happen, but it decides who is on the
    // rota, and the draft's load list only names people who got a turn, so
    // without this somebody can drop off a whole quarter with nothing said.
    // Counted before the clamp in the fair-share loop, so the figure is what
    // was really asked for. It never fires where nobody has given a figure.
    const asked = statedAsk.get(roleId);
    if (asked && asked.unstated > 0 && asked.unstated < pool.length && asked.demand >= slots) {
      const gave = pool.length - asked.unstated;
      warnings.push(
        `${roleNames.get(roleId) ?? 'A role'}: ` +
        (gave === 1
          ? 'the one person who gave a figure has'
          : `the ${gave} people who gave a figure have`) +
        (slots === 1
          ? ' asked for the only place, so '
          : ` asked for about ${Math.round(asked.demand)} of the ${slots} places, so `) +
        (asked.unstated === 1 ? 'the one who left theirs blank' : `the ${asked.unstated} who left theirs blank`) +
        ` will only be asked when ${gave === 1 ? 'that person cannot' : 'those people cannot'}.`,
      );
    }
  }

  // ---- the walk -----------------------------------------------------------
  for (const svc of sorted) {
    // Roles this person already holds AT THIS SERVICE. Populated by pins and by
    // each allocation as it is made, so combination rules see the real picture.
    const held = new Map<number, number[]>(); // personId -> roleIds
    const takenSlots = new Map<number, Set<number>>(); // roleId -> slot numbers used
    const placedInRole = new Map<number, number[]>(); // roleId -> personIds

    // How many places each role has at THIS service. A must-pair cannot apply to
    // a role that only ever seats one person.
    const roleCapacity = new Map<number, number>();
    for (const r of svc.roles) roleCapacity.set(r.roleId, r.ideal);

    /**
     * Everyone who must serve alongside this person in this role, following the
     * chain: if Sue must be with Sheila and Sue must be with Glenn, all three
     * belong together. Returns the others, not the person themselves.
     */
    const mustGroup = (personId: number, roleId: number): number[] => {
      const seen = new Set<number>([personId]);
      const queue = [personId];
      while (queue.length) {
        const who = queue.shift()!;
        for (const p of pairsByPerson.get(who) ?? []) {
          if (p.mode !== 'together' || p.strength !== 'must') continue;
          if (p.roleId !== null && p.roleId !== roleId) continue;
          const other = p.aId === who ? p.bId : p.aId;
          if (seen.has(other)) continue;
          seen.add(other);
          queue.push(other);
        }
      }
      seen.delete(personId);
      return [...seen].sort((a, b) => a - b);
    };

    const listNames = (ids: number[]) =>
      ids.map((id) => personById.get(id)?.name ?? 'their partner')
        .reduce((acc, n, i, arr) =>
          i === 0 ? n : i === arr.length - 1 ? `${acc} and ${n}` : `${acc}, ${n}`, '');

    const holdRole = (personId: number, roleId: number, slot: number) => {
      const h = held.get(personId) ?? [];
      h.push(roleId);
      held.set(personId, h);
      const t = takenSlots.get(roleId) ?? new Set<number>();
      t.add(slot);
      takenSlots.set(roleId, t);
      const p = placedInRole.get(roleId) ?? [];
      p.push(personId);
      placedInRole.set(roleId, p);
    };

    // Pins first, so every later decision sees them.
    for (const pin of pinned.filter((p) => p.serviceId === svc.id)) {
      const person = personById.get(pin.personId);
      if (!person) {
        // Somebody the generator may not use (stopped serving, or flagged as a
        // possible duplicate) but who is still genuinely booked. The slot stays
        // theirs: treating it as free would hand it to somebody else, and
        // apply's INSERT OR REPLACE would then overwrite the confirmed row.
        const t = takenSlots.get(pin.roleId) ?? new Set<number>();
        t.add(pin.slot);
        takenSlots.set(pin.roleId, t);
        continue;
      }
      allocations.push({
        serviceId: svc.id, roleId: pin.roleId, slot: pin.slot, personId: pin.personId,
        reason: 'Already set — left exactly as it was.', amber: [], pinned: true,
      });
      holdRole(pin.personId, pin.roleId, pin.slot);
      record({ personId: pin.personId, roleId: pin.roleId, day: svc.day });
      runTotal.set(pin.personId, (runTotal.get(pin.personId) ?? 0) + 1);
      const rk = `${pin.personId}:${pin.roleId}`;
      runInRole.set(rk, (runInRole.get(rk) ?? 0) + 1);
    }

    /**
     * Why a person cannot take this role at this service, or null if they can.
     * `allowInsideGap` / `allowOverCap` are the relaxation tiers. RED and
     * unavailable are never relaxed, at any tier, by any path.
     */
    const blockedBecause = (
      personId: number,
      roleId: number,
      opts: { allowInsideGap?: boolean; allowOverCap?: boolean; skipMustPairs?: boolean } = {},
      seatsRemaining = 99,
    ): string | null => {
      const own = capBy.get(`${personId}:${roleId}`);
      if (!own) return 'cannot do this role';
      if (isUnavailable(personId, svc.day)) return 'unavailable that day';
      // "Only the 2nd Sunday of the month". Like being away, never bent.
      if (own.weeksOfMonth && !own.weeksOfMonth.includes(weekOfMonth(svc.date))) {
        return 'only does certain Sundays of the month';
      }

      const heldRoles = held.get(personId) ?? [];
      if (heldRoles.includes(roleId)) return 'already in this role here';

      if (rules.maxRolesPerService != null
          && heldRoles.length >= rules.maxRolesPerService
          && !opts.allowOverCap) {
        return 'already doing enough at this service';
      }

      for (const other of heldRoles) {
        if (verdictFor(roleId, other) === 'red') {
          return `cannot also be ${roleNames.get(other) ?? 'in that role'} at the same service`;
        }
      }
      // An "avoid" pairing with somebody already on this service.
      for (const [otherId] of held) {
        if (otherId === personId) continue;
        const p = pairBetween(personId, otherId, roleId);
        if (p && p.mode === 'avoid') return 'asked not to serve alongside someone already on';
      }

      const k = `${personId}:${roleId}`;
      const floor = floorGap(personId, roleId);
      const last = lastInRole.get(k);
      if (last != null && Number.isFinite(last)) {
        const since = svc.day - last;
        if (since < floor && !(opts.allowInsideGap && since >= RELAX_FLOOR_DAYS)) {
          return 'too soon after their last time in this role';
        }
      }
      // The same gap, looking forward to a date they are already down for.
      const next = (pinnedAhead.get(k) ?? []).find((d) => d > svc.day);
      if (next != null) {
        const until = next - svc.day;
        if (until < floor && !(opts.allowInsideGap && until >= RELAX_FLOOR_DAYS)) {
          return 'too close to a date they are already down for';
        }
      }

      // A gap before their next job of ANY kind.
      //
      // The `sinceAny > 0` guard is load-bearing and must not be removed.
      // record() writes lastAnyRole = svc.day as each allocation commits, so
      // within one service a person who has just been given a role has
      // sinceAny === 0. Without the guard, ANY non-zero setting here would
      // forbid every second role at a single service — silently retiring the
      // whole green/amber/red combinations page, which records this church
      // doubling preside+leader ten times and preacher+leader eight.
      //
      // How many jobs at one service is the separate rule above. This one is
      // about the gap between Sundays.
      if (rules.anyRoleHardDays > 0 && !capBy.get(k)?.askAnyTime) {
        const lastAny = lastAnyRole.get(personId);
        if (lastAny != null && Number.isFinite(lastAny)) {
          const sinceAny = svc.day - lastAny;
          if (sinceAny > 0 && sinceAny < rules.anyRoleHardDays
              && !(opts.allowInsideGap && sinceAny >= RELAX_FLOOR_DAYS)) {
            return 'on something else too recently';
          }
        }
        const nextAny = (pinnedAheadAny.get(personId) ?? []).find((d) => d > svc.day);
        if (nextAny != null) {
          const untilAny = nextAny - svc.day;
          if (untilAny < rules.anyRoleHardDays
              && !(opts.allowInsideGap && untilAny >= RELAX_FLOOR_DAYS)) {
            return 'too close to a date they are already down for';
          }
        }
      }

      /**
       * A MUST pairing: these two are never split up.
       *
       * Placing one alone is only allowed when the partner is already here, or
       * when the partner could also be placed and there is a seat left for them.
       * The partner's own availability is tested with `skipMustPairs`, which is
       * what stops two people who must serve together from each waiting on the
       * other and neither ever being placeable.
       */
      if (!opts.skipMustPairs) {
        // A role with only ever ONE place cannot hold a pair, so an unscoped
        // "must be together" would otherwise bar both people from preaching,
        // leading, and every other single-person job for ever. Where the role has
        // no room for two, the pairing simply does not apply.
        const roleSeats = roleCapacity.get(roleId) ?? 1;
        if (roleSeats >= 2) {
          // The whole GROUP at once, not each partner in turn.
          //
          // Somebody can have more than one must-partner — Sue serves with both
          // Sheila and Glenn — and checking them one at a time reserves a single
          // extra place however many people actually have to come with them. The
          // first partner then takes the last seat and the rest are dropped,
          // splitting a pairing that was supposed to be unbreakable.
          const need = mustGroup(personId, roleId).filter(
            (id) => !(placedInRole.get(roleId) ?? []).includes(id),
          );
          if (need.length) {
            if (seatsRemaining < need.length + 1) {
              return `must serve with ${listNames(need)}, and there ${seatsRemaining === 1 ? 'is only one place' : `are only ${seatsRemaining} places`} left`;
            }
            for (const partner of need) {
              if (blockedBecause(partner, roleId, { ...opts, skipMustPairs: true }) !== null) {
                return `must serve with ${personById.get(partner)?.name ?? 'their partner'}, who is not available`;
              }
            }
          }
        }
      }
      const cap = own.maxPerWindow;
      if (cap && !opts.allowOverCap) {
        const days = [
          ...(servedDays.get(k) ?? []),
          ...(pinnedAhead.get(k) ?? []).filter((d) => d > svc.day),
        ];
        if (!fitsCap(days, svc.day, cap)) return 'already at the limit they asked for';
      }
      return null;
    };

    /** Candidate score. Higher is better. */
    const scoreOf = (personId: number, roleId: number) => {
      const k = `${personId}:${roleId}`;
      const target = Math.max(1, targetInterval(personId, roleId));
      const last = lastInRole.get(k);
      const ratio = last == null || !Number.isFinite(last)
        ? NEVER_SERVED_RATIO
        : Math.min(DEBT_CAP, Math.max(0, (svc.day - last) / target));
      let score = W.debt * (ratio - 1);

      // "Every other week": exactly on their beat is where they want to be. The
      // floor already stops them coming round sooner; this stops the draft
      // drifting them a week later, which would leave them on the wrong
      // alternate Sundays from then on.
      const spacing = capBy.get(k)?.spacingDays;
      if (spacing && last != null && Number.isFinite(last)) {
        const since = svc.day - last;
        if (since > 0 && since % spacing === 0) score += W.beat;
      }

      const expect = expectedLoad.get(personId) ?? 1;
      const done = (runTotal.get(personId) ?? 0);
      score -= w.fair * Math.max(0, done / Math.max(0.5, expect) - 1);

      // The soft version of the same idea: a preference that costs points
      // rather than refusing. Skipped entirely when set to none.
      if (rules.anyRoleSoftDays > 0) {
        const any = lastAnyRole.get(personId);
        if (any != null && Number.isFinite(any)) {
          score -= W.rest * Math.max(0, 1 - (svc.day - any) / rules.anyRoleSoftDays);
        }
      }

      // Pairing competes through the score rather than pre-empting a seat, so a
      // partner never displaces someone far more overdue.
      let pairTerm = 0;
      for (const other of placedInRole.get(roleId) ?? []) {
        const p = pairBetween(personId, other, roleId);
        if (p && p.mode === 'together') {
          pairTerm = Math.max(pairTerm, Math.min(1, p.weight / 5));
        }
      }
      score += W.pair * pairTerm;

      let ambers = 0;
      for (const other of held.get(personId) ?? []) {
        if (verdictFor(roleId, other) === 'amber') ambers++;
      }
      score -= W.amber * ambers;

      if (pinned.some((p) => p.serviceId === svc.id && p.roleId === roleId && p.personId === personId)) {
        score += W.sticky;
      }
      return score;
    };

    const ambersFor = (personId: number, roleId: number) => {
      const out: string[] = [];
      for (const other of held.get(personId) ?? []) {
        if (verdictFor(roleId, other) === 'amber') {
          const c = combinations.get(comboKey(roleId, other));
          out.push(
            `also ${roleNames.get(other) ?? 'another role'}` +
            (c?.reason ? ` — ${c.reason}` : ''),
          );
        }
      }
      return out;
    };

    // Most-constrained role first, recomputed per service. Counted ONCE into a
    // map rather than inside a sort comparator, which would rerun the whole
    // candidate scan O(n log n) times per service.
    const seatsLeft = new Map<number, number>();
    for (const r of svc.roles) {
      seatsLeft.set(r.roleId, Math.max(0, r.ideal - (takenSlots.get(r.roleId)?.size ?? 0)));
    }
    const freedom = new Map<number, number>();
    for (const r of svc.roles) {
      const pool = eligible.get(r.roleId) ?? [];
      const open = pool.filter((p) => blockedBecause(p, r.roleId) === null).length;
      const seats = Math.max(1, seatsLeft.get(r.roleId) ?? 1);
      freedom.set(r.roleId, open / seats);
    }
    const roleOrder = [...svc.roles].sort(
      (a, b) => (freedom.get(a.roleId) ?? 0) - (freedom.get(b.roleId) ?? 0) || a.roleId - b.roleId,
    );

    for (const role of roleOrder) {
      const pool = eligible.get(role.roleId) ?? [];

      for (let filledCount = (takenSlots.get(role.roleId)?.size ?? 0); filledCount < role.ideal; filledCount++) {
        // Lowest unused slot number — derived from the slots actually taken, not
        // from a count, so a pin at slot 3 does not collide with a new slot 1.
        const taken = takenSlots.get(role.roleId) ?? new Set<number>();
        let slot = 1;
        while (taken.has(slot)) slot++;

        const belowMinimum = filledCount < role.min;
        const because: Record<string, number> = {};

        // Tier 0, then relaxations — and only ever to reach the MINIMUM. A place
        // between minimum and ideal is left empty rather than bending somebody's
        // stated preference merely to make the rota tidy.
        const allTiers = [{}, { allowInsideGap: true }, { allowInsideGap: true, allowOverCap: true }];
        const howFar = rules.whenShort === 'leave_empty' ? 1
          : rules.whenShort === 'bend_gap' ? 2
            : 3;
        const tiers = belowMinimum ? allTiers.slice(0, howFar) : [{}];

        let chosen: number | null = null;
        let relaxed: string | null = null;

        // How many places are still open in this role, which decides whether a
        // person with a MUST partner can be placed at all.
        const seatsLeftHere = role.ideal - (takenSlots.get(role.roleId)?.size ?? 0);

        for (const [tierIndex, opts] of tiers.entries()) {
          const candidates: number[] = [];
          for (const pid of pool) {
            const why = blockedBecause(pid, role.roleId, opts, seatsLeftHere);
            if (why === null) candidates.push(pid);
            else if (tierIndex === 0) because[why] = (because[why] ?? 0) + 1;
          }
          if (!candidates.length) continue;

          candidates.sort((a, b) => {
            const d = scoreOf(b, role.roleId) - scoreOf(a, role.roleId);
            if (Math.abs(d) > 1e-9) return d;
            const la = lastInRole.get(`${a}:${role.roleId}`) ?? -Infinity;
            const lb = lastInRole.get(`${b}:${role.roleId}`) ?? -Infinity;
            if (la !== lb) return la - lb; // longest since doing it first
            const ta = runTotal.get(a) ?? 0;
            const tb = runTotal.get(b) ?? 0;
            if (ta !== tb) return ta - tb;
            const ha = hash(`${runSeed}|${role.roleId}|${a}`);
            const hb = hash(`${runSeed}|${role.roleId}|${b}`);
            if (ha !== hb) return ha - hb;
            return a - b;
          });

          chosen = candidates[0]!;
          if (tierIndex > 0) {
            relaxed = tierIndex === 1
              ? 'sooner than they asked to be asked again'
              : 'over the limit they asked for';
          }
          break;
        }

        if (chosen === null) {
          if (belowMinimum || rules.listEveryEmptyPlace) {
            const reasons = Object.entries(because).sort((a, b) => b[1] - a[1]);
            gaps.push({
              serviceId: svc.id, roleId: role.roleId, slot,
              because,
              message: reasons.length
                ? `Nobody available: ${reasons.map(([r, n]) => `${n} ${r}`).join(', ')}.`
                : 'Nobody is able to do this role.',
            });
          }
          // Between minimum and ideal, an empty place is a fine outcome and is
          // not reported as a gap. Stop filling this role either way.
          break;
        }

        // ---- commit ----
        const amber = ambersFor(chosen, role.roleId);
        const name = personById.get(chosen)?.name ?? `#${chosen}`;
        const k = `${chosen}:${role.roleId}`;
        const last = lastInRole.get(k);
        const parts: string[] = [];
        if (last == null || !Number.isFinite(last)) {
          parts.push(`${name} has not done this in the period looked at`);
        } else {
          const since = svc.day - last;
          const asked = statedEvery(capBy.get(k));
          const days = (d: number) => `${d} day${d === 1 ? '' : 's'}`;
          // Say where the rhythm came from. "Against a rhythm of about 15" left
          // the reader to guess whether that was what the person asked for or
          // something the system made up — and those deserve different answers
          // when somebody asks why they are on again so soon.
          //
          // And quote a share only where it means something. Behind somebody
          // who asked for most of the places it is years ("once every 637
          // days"), which is true and tells the reader nothing; what has really
          // happened is that they are filling a gap, so that is what is said.
          parts.push(
            `${name} last did this ${days(since)} ago` +
            (asked != null
              ? `, against the once every ${days(Math.round(asked))} or so they asked for`
              : standingIn.has(role.roleId)
                ? ', and is standing in: most of these places go to people who asked to do it more often'
                : `, against a fair share of about once every ${days(Math.max(1, Math.round(shareToQuote.get(role.roleId) ?? horizonDays)))}`),
          );
        }
        for (const other of placedInRole.get(role.roleId) ?? []) {
          const p = pairBetween(chosen, other, role.roleId);
          if (p && p.mode === 'together') {
            parts.push(`and usually serves with ${personById.get(other)?.name ?? 'them'}`);
            break;
          }
        }
        if (amber.length) parts.push(`(${amber.join('; ')})`);
        if (relaxed) parts.push(`— placed ${relaxed} because the service would otherwise be short`);

        allocations.push({
          serviceId: svc.id, roleId: role.roleId, slot, personId: chosen,
          reason: parts.join(', ').replace(/, \(/g, ' (').replace(/, —/g, ' —') + '.',
          amber, pinned: false,
        });
        if (relaxed) {
          warnings.push(
            `${svc.date}: ${name} is on ${roleNames.get(role.roleId) ?? 'a role'} ${relaxed}.`,
          );
        }

        holdRole(chosen, role.roleId, slot);
        record({ personId: chosen, roleId: role.roleId, day: svc.day });
        runTotal.set(chosen, (runTotal.get(chosen) ?? 0) + 1);
        runInRole.set(k, (runInRole.get(k) ?? 0) + 1);

        // The whole MUST group goes in immediately, in the same breath.
        //
        // As a group, not one at a time: somebody can have two must-partners, and
        // placing them individually lets the first take the last seat while the
        // rest are silently dropped — splitting a pairing that is supposed to be
        // unbreakable. The filter above already checked they all fit and are all
        // placeable, so this is the commit of a decision already made.
        //
        // Each is tested under the SAME relaxation the first of the group went in
        // under. Testing at tier 0 while their partner was placed at tier 2 is
        // the other way a pair gets split.
        if ((roleCapacity.get(role.roleId) ?? 1) >= 2) {
          const relaxOpts = relaxed
            ? { allowInsideGap: true, allowOverCap: true, skipMustPairs: true }
            : { skipMustPairs: true };
          const group = mustGroup(chosen, role.roleId)
            .filter((id) => !(placedInRole.get(role.roleId) ?? []).includes(id));

          for (const partner of group) {
            const takenNow = takenSlots.get(role.roleId) ?? new Set<number>();
            if (takenNow.size >= role.ideal) break;
            if (blockedBecause(partner, role.roleId, relaxOpts) !== null) break;

            let pslot = 1;
            while (takenNow.has(pslot)) pslot++;
            const pname = personById.get(partner)?.name ?? `#${partner}`;
            allocations.push({
              serviceId: svc.id, roleId: role.roleId, slot: pslot, personId: partner,
              reason: `${pname} always serves with ${name}, so they go on together.`,
              amber: ambersFor(partner, role.roleId), pinned: false,
            });
            holdRole(partner, role.roleId, pslot);
            record({ personId: partner, roleId: role.roleId, day: svc.day });
            runTotal.set(partner, (runTotal.get(partner) ?? 0) + 1);
            const pk = `${partner}:${role.roleId}`;
            runInRole.set(pk, (runInRole.get(pk) ?? 0) + 1);
            filledCount++;
          }
        }
      }
    }
  }

  // ---- amber summary ------------------------------------------------------
  const amberCounts = new Map<string, number>();
  for (const a of allocations) {
    for (const t of a.amber) amberCounts.set(t, (amberCounts.get(t) ?? 0) + 1);
  }
  for (const [what, n] of [...amberCounts].sort((a, b) => b[1] - a[1])) {
    warnings.push(`Settled for an amber combination ${n} time${n === 1 ? '' : 's'}: ${what}.`);
  }

  const load = people
    .map((p) => {
      const byRole: Record<number, number> = {};
      for (const a of allocations) {
        if (a.personId === p.id) byRole[a.roleId] = (byRole[a.roleId] ?? 0) + 1;
      }
      return { personId: p.id, name: p.name, total: runTotal.get(p.id) ?? 0, byRole };
    })
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { allocations, gaps, warnings, load };
}
