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
} as const;

/** Someone who has never served ranks above the on-time and below the truly
 *  overdue, rather than infinitely overdue. */
const NEVER_SERVED_RATIO = 2.0;
const DEBT_CAP = 2.5;
/** A stated rhythm implies a floor even when nobody sets one. */
const IMPLIED_FLOOR = 0.5;
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
  const slotsPerRole = new Map<number, number>();
  for (const s of sorted) {
    for (const r of s.roles) slotsPerRole.set(r.roleId, (slotsPerRole.get(r.roleId) ?? 0) + r.ideal);
  }
  const fairShare = new Map<number, number>();
  for (const [roleId, slots] of slotsPerRole) {
    const n = eligible.get(roleId)?.length ?? 0;
    fairShare.set(roleId, n > 0 && slots > 0 ? (horizonDays * n) / slots : horizonDays);
  }

  const targetInterval = (personId: number, roleId: number): number => {
    const c = capBy.get(`${personId}:${roleId}`);
    if (c?.desiredEveryDays) return c.desiredEveryDays;
    if (c?.maxPerWindow) return c.maxPerWindow.windowDays / c.maxPerWindow.count;
    return Math.max(1, fairShare.get(roleId) ?? horizonDays);
  };
  const floorGap = (personId: number, roleId: number): number => {
    const c = capBy.get(`${personId}:${roleId}`);
    if (c?.minGapDays != null) return c.minGapDays;
    return targetInterval(personId, roleId) * IMPLIED_FLOOR;
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

  // Counts accumulated during THIS run, used for fairness and tie-breaks.
  const runTotal = new Map<number, number>();
  const runInRole = new Map<string, number>();

  // Expected load for a person: the sum over their roles of that role's slots
  // divided by its eligible count. Measured against their OWN expectation, not
  // the congregation mean — a preacher legitimately serves more than a reader.
  const expectedLoad = new Map<number, number>();
  for (const c of capabilities) {
    const n = eligible.get(c.roleId)?.length ?? 0;
    const slots = slotsPerRole.get(c.roleId) ?? 0;
    if (!n || !slots) continue;
    expectedLoad.set(c.personId, (expectedLoad.get(c.personId) ?? 0) + slots / n);
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
      supply += Math.floor(horizonDays / gap) + 1;
    }
    if (supply < slots) {
      warnings.push(
        `${roleNames.get(roleId) ?? 'A role'}: ${slots} places to fill, but the ` +
        `${pool.length} people who can do it cannot cover more than ${supply} at the ` +
        `intervals they have asked for. Some places will stay empty.`,
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
      if (!person) continue;
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
      if (!capBy.has(`${personId}:${roleId}`)) return 'cannot do this role';
      if (isUnavailable(personId, svc.day)) return 'unavailable that day';

      const heldRoles = held.get(personId) ?? [];
      if (heldRoles.includes(roleId)) return 'already in this role here';

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
      const last = lastInRole.get(k);
      if (last != null && Number.isFinite(last)) {
        const since = svc.day - last;
        const floor = floorGap(personId, roleId);
        if (since < floor && !(opts.allowInsideGap && since >= RELAX_FLOOR_DAYS)) {
          return 'too soon after their last time in this role';
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
      const cap = capBy.get(k)?.maxPerWindow;
      if (cap && !opts.allowOverCap) {
        const days = servedDays.get(k) ?? [];
        const from = svc.day - cap.windowDays;
        let n = 0;
        for (let i = days.length - 1; i >= 0 && days[i]! > from; i--) n++;
        if (n >= cap.count) return 'already at the limit they asked for';
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

      const expect = expectedLoad.get(personId) ?? 1;
      const done = (runTotal.get(personId) ?? 0);
      score -= W.fair * Math.max(0, done / Math.max(0.5, expect) - 1);

      const any = lastAnyRole.get(personId);
      if (any != null && Number.isFinite(any)) {
        score -= W.rest * Math.max(0, 1 - (svc.day - any) / 14);
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
        const tiers = belowMinimum
          ? [{}, { allowInsideGap: true }, { allowInsideGap: true, allowOverCap: true }]
          : [{}];

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
          if (belowMinimum) {
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
          const target = Math.round(targetInterval(chosen, role.roleId));
          parts.push(
            `${name} last did this ${since} day${since === 1 ? '' : 's'} ago` +
            `, against a rhythm of about ${target}`,
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
