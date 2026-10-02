import type { GeneratorInput, GeneratorResult, Verdict } from './types.js';

/**
 * A parked draft, as something a person can change before it is applied.
 *
 * The generator hands back a whole rota at once, and whoever checks it nearly
 * always knows something the roster does not: the computer operator it picked
 * is away that week, the visiting preacher is already arranged. Making them
 * apply the draft first and put each of those right on the rota afterwards
 * means the copy they download and send round is wrong in exactly the places
 * they already knew about. So the draft is held as a model of its own — the
 * services as they are shown — and a hand change edits that model.
 *
 * Everything Apply and the downloads read (the allocations, the grid) is worked
 * out FROM the model by derive(), every time it is saved. Two copies kept in
 * step by hand drift apart; one copy and a function cannot.
 *
 * PURE, like the generator: no I/O and no clock. The routes read and write the
 * row; this only decides what the draft says.
 */

export interface DraftPerson {
  personId: number;
  name: string;
  slot: number;
  /** One sentence saying why, as on every generated placement. */
  reason: string;
  amber: string[];
  /** A confirmed booking the draft leaves exactly alone. Never editable here. */
  pinned: boolean;
  /** Put on by the person checking the draft, not by the generator. */
  byHand?: boolean;
  /** Short facts worth a chip: "away that day", "on a break", "guest",
   *  "cannot also be ... at the same service". */
  notes?: string[];
  /** The generator's warning about this one placement, if it had to bend a
   *  rule to make it. Kept with the person so it goes when they do. */
  warning?: string;
}

export interface DraftRow {
  roleId: number;
  roleName: string;
  min: number;
  ideal: number;
  /** Sorted by slot. */
  people: DraftPerson[];
  /** Why the generator could not fill a place here, while that is still true. */
  message: string | null;
}

export interface DraftService {
  id: number;
  date: string;
  time: string;
  title: string;
  /** A Sunday not in the diary yet; it appears only if the draft is applied.
   *  Its id is negative until then. */
  isNew: boolean;
  rows: DraftRow[];
}

export interface DraftReleased {
  name: string;
  why: 'break' | 'guest';
  date: string;
  roleName: string;
}

export interface DraftView {
  v: 2;
  /** Goes up on every save, so a save made from a page that is out of date
   *  (a second tab, say) can be told apart and refused. */
  rev: number;
  /** How many saves actually changed something. */
  edits: number;
  services: DraftService[];
  /** The generator's warnings that are about the draft as a whole rather than
   *  one placement — a role nobody can do, a pool too small for its places. */
  warnings: string[];
  released: DraftReleased[];
  createdSundays: number;
  /** What the last save changed, for the notice on the page it lands on. */
  lastSave?: { serviceId: number; notes: string[]; changed: number };
}

/** What Apply writes: one row per place the draft fills that is not already
 *  booked. */
export interface DraftAllocation {
  serviceId: number;
  roleId: number;
  slot: number;
  personId: number;
  reason: string;
}

/** The shape the downloads read, unchanged from before drafts were editable. */
export interface DraftGridService {
  id: number;
  date: string;
  time: string;
  title: string;
  rows: { roleId: number; names: string[] }[];
}

export interface DraftDerived {
  allocations: DraftAllocation[];
  grid: DraftGridService[];
  load: { personId: number; name: string; total: number }[];
  /** Places the draft fills, by the generator or by hand. */
  fresh: number;
  /** Confirmed bookings left exactly as they were. */
  kept: number;
  /** Places still short of each role's minimum. */
  empty: number;
  worthKnowing: string[];
}

/** Somebody who could be put on a role by hand, as the route reads them. */
export interface DraftCandidate {
  id: number;
  name: string;
  on_break: number | boolean;
  is_guest: number | boolean;
  away: number | boolean;
}

export interface EditContext {
  /** The display name of whoever is changing the draft. */
  by: string;
  /** roleId -> everybody ticked for it. */
  candidates: Map<number, DraftCandidate[]>;
  /** Keyed 'minRoleId:maxRoleId', as the generator reads them. */
  combinations: Map<string, { verdict: Verdict; reason: string | null }>;
  /** Optional: the row's own name is used where a role is missing. */
  roleNames?: Map<number, string>;
}

export type EditOutcome =
  | { view: DraftView; changed: number; notes: string[] }
  | { error: string };

/** The two ways the generator bends a person's own rule to reach a minimum.
 *  Must match generate.ts word for word: buildDraftView finds each warning by
 *  rebuilding the sentence. */
const RELAXED = ['sooner than they asked to be asked again', 'over the limit they asked for'];
/** derive() works these out again from the people, so the generator's own
 *  copies would only go stale after the first hand change. */
const AMBER_SUMMARY = 'Settled for an amber combination ';
/** load.ts keeps a guest's confirmed booking on the next generation ONLY when
 *  its reason starts with exactly this. Do not reword it. */
const BY_HAND = 'Put on by ';
const RED_NOTE = 'cannot also be ';

const comboKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

/**
 * The generator's result, grouped the way a rota is read.
 *
 * Also shows the bookings the generator holds but says nothing about: a
 * confirmed place belonging to somebody it was not given (stopped serving, or
 * still waiting to be reviewed). generate.ts keeps the slot theirs and makes no
 * allocation for it, so the old preview simply did not show them — harmless
 * while nothing could be edited, but an editor that thought the slot was free
 * would let Apply's INSERT OR REPLACE overwrite a booking the church has made.
 */
export function buildDraftView(
  input: Pick<GeneratorInput, 'services' | 'people' | 'roleNames' | 'pinned'>,
  result: GeneratorResult,
  extras: { createdSundays: number; released: DraftReleased[]; pinNames: Map<number, string> },
): DraftView {
  const nameOf = new Map(input.people.map((p) => [p.id, p.name]));
  // Every generated placement, by the exact warning the generator would have
  // written had it bent a rule for it.
  const byWarning = new Map<string, DraftPerson[]>();

  const services: DraftService[] = [...input.services]
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.id - b.id)
    .map((s) => ({
      id: s.id, date: s.date, time: s.time, title: s.title,
      // A negative id is one of the Sundays only imagined so far.
      isNew: s.id < 0,
      rows: s.roles.map((r) => {
        const people: DraftPerson[] = result.allocations
          .filter((a) => a.serviceId === s.id && a.roleId === r.roleId)
          .map((a) => ({
            personId: a.personId, name: nameOf.get(a.personId) ?? `#${a.personId}`,
            slot: a.slot, reason: a.reason, amber: [...a.amber], pinned: a.pinned,
          }));
        for (const pin of input.pinned) {
          if (pin.serviceId !== s.id || pin.roleId !== r.roleId || nameOf.has(pin.personId)) continue;
          people.push({
            personId: pin.personId, name: extras.pinNames.get(pin.personId) ?? 'Already booked',
            slot: pin.slot, amber: [], pinned: true,
            reason: 'Already set — left exactly as it was, though they are not being given anything new at the moment.',
          });
        }
        people.sort((a, b) => a.slot - b.slot);

        const roleWord = input.roleNames.get(r.roleId) ?? 'a role';
        for (const p of people) {
          if (p.pinned) continue;
          for (const relaxed of RELAXED) {
            const w = `${s.date}: ${p.name} is on ${roleWord} ${relaxed}.`;
            byWarning.set(w, [...(byWarning.get(w) ?? []), p]);
          }
        }
        return {
          roleId: r.roleId,
          roleName: input.roleNames.get(r.roleId) ?? 'Role',
          min: r.min, ideal: r.ideal,
          people,
          message: result.gaps.find((g) => g.serviceId === s.id && g.roleId === r.roleId)?.message ?? null,
        };
      }),
    }));

  const warnings: string[] = [];
  for (const w of result.warnings) {
    if (w.startsWith(AMBER_SUMMARY)) continue;
    const who = (byWarning.get(w) ?? []).find((p) => !p.warning);
    if (who) who.warning = w;
    else warnings.push(w);
  }

  return {
    v: 2, rev: 0, edits: 0, services, warnings,
    released: extras.released, createdSundays: extras.createdSundays,
  };
}

/** Everything that is worked out from the draft rather than stored in it. */
export function derive(view: DraftView): DraftDerived {
  const allocations: DraftAllocation[] = [];
  const load = new Map<number, { personId: number; name: string; total: number }>();
  const amberCounts = new Map<string, number>();
  const placementWarnings: string[] = [];
  let fresh = 0;
  let kept = 0;
  let empty = 0;

  for (const s of view.services) {
    for (const r of s.rows) {
      empty += Math.max(0, r.min - r.people.length);
      for (const p of r.people) {
        if (p.pinned) kept++;
        else {
          fresh++;
          allocations.push({ serviceId: s.id, roleId: r.roleId, slot: p.slot, personId: p.personId, reason: p.reason });
        }
        const l = load.get(p.personId) ?? { personId: p.personId, name: p.name, total: 0 };
        l.total++;
        load.set(p.personId, l);
        for (const t of p.amber) amberCounts.set(t, (amberCounts.get(t) ?? 0) + 1);
        if (p.warning) placementWarnings.push(p.warning);
      }
    }
  }

  // The same sentence the generator writes, so a draft nobody has touched
  // reads exactly as it did before drafts could be changed.
  const amber = [...amberCounts]
    .sort((a, b) => b[1] - a[1])
    .map(([what, n]) => `${AMBER_SUMMARY}${n} time${n === 1 ? '' : 's'}: ${what}.`);

  return {
    allocations,
    grid: view.services.map((s) => ({
      id: s.id, date: s.date, time: s.time, title: s.title,
      rows: s.rows.map((r) => ({ roleId: r.roleId, names: r.people.map((p) => p.name) })),
    })),
    load: [...load.values()]
      .filter((l) => l.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    fresh, kept, empty,
    worthKnowing: [...view.warnings, ...placementWarnings, ...amber],
  };
}

/**
 * The places in a role a hand change may set.
 *
 * Every place the draft itself fills, and every free place up to the role's
 * ideal. A confirmed booking's place is never one of them: it is changed on the
 * service's own page once the draft is applied, because a draft that could
 * rewrite confirmed bookings would be one nobody dared apply.
 */
export function editableSlots(row: DraftRow): number[] {
  const pinned = new Set(row.people.filter((p) => p.pinned).map((p) => p.slot));
  const out = new Set(row.people.filter((p) => !p.pinned).map((p) => p.slot));
  for (let s = 1; s <= row.ideal; s++) if (!pinned.has(s)) out.add(s);
  return [...out].sort((a, b) => a - b);
}

/**
 * One service of the draft, changed by hand.
 *
 * `choices` is keyed 'roleId:slot', holding a person's id or null for nobody.
 * A place not mentioned is left as it is, and anything sent for a confirmed
 * booking's place is ignored rather than refused — it was never offered.
 *
 * Nothing a person chooses deliberately is refused for being unwise. Away that
 * day, on a break, a guest, a combination marked as not allowed: each is said
 * plainly, on the page and in the notice after saving, and then the choice
 * stands — exactly as on the service page. The only refusals are things that
 * cannot be right: somebody not ticked for the role at all, or the same person
 * in two places in one role.
 */
export function editService(
  view: DraftView,
  serviceId: number,
  choices: Map<string, number | null>,
  ctx: EditContext,
): EditOutcome {
  const next = JSON.parse(JSON.stringify(view)) as DraftView;
  const svc = next.services.find((s) => s.id === serviceId);
  if (!svc) return { error: 'That service is not part of this draft any more.' };

  const roleName = (r: DraftRow) => ctx.roleNames?.get(r.roleId) ?? r.roleName;
  const nameFor = (id: number) => {
    for (const list of ctx.candidates.values()) {
      const c = list.find((x) => x.id === id);
      if (c) return c.name;
    }
    for (const r of svc.rows) {
      const p = r.people.find((x) => x.personId === id);
      if (p) return p.name;
    }
    return 'That person';
  };

  let changed = 0;
  const arrivals: { person: DraftPerson; row: DraftRow; cand: DraftCandidate }[] = [];

  for (const row of svc.rows) {
    const pool = ctx.candidates.get(row.roleId) ?? [];
    let rowChanged = false;
    for (const slot of editableSlots(row)) {
      const key = `${row.roleId}:${slot}`;
      if (!choices.has(key)) continue;
      const want = choices.get(key) ?? null;
      const current = row.people.find((p) => !p.pinned && p.slot === slot) ?? null;
      if ((current?.personId ?? null) === want) continue;

      let arriving: DraftPerson | null = null;
      if (want !== null) {
        const cand = pool.find((c) => c.id === want);
        if (!cand) {
          return {
            error: `${nameFor(want)} is not ticked as able to do ${roleName(row)}. Tick them for it on `
              + 'their own page in People, and they will be offered here.',
          };
        }
        const notes = [
          cand.away ? 'away that day' : '',
          cand.on_break ? 'on a break' : '',
          cand.is_guest ? 'guest' : '',
        ].filter(Boolean);
        arriving = {
          personId: cand.id, name: cand.name, slot,
          // Must start BY_HAND: see its comment.
          reason: `${BY_HAND}${ctx.by} while checking the draft.`,
          amber: [], pinned: false, byHand: true,
          ...(notes.length ? { notes } : {}),
        };
        arrivals.push({ person: arriving, row, cand });
      }
      // The person replaced takes their warning with them: it was about them.
      row.people = row.people.filter((p) => p !== current);
      if (arriving) row.people.push(arriving);
      changed++;
      rowChanged = true;
    }
    if (!rowChanged) continue;

    row.people.sort((a, b) => a.slot - b.slot);
    const seen = new Set<number>();
    for (const p of row.people) {
      if (seen.has(p.personId)) {
        return {
          error: `${p.name} is down for ${roleName(row)} twice. Choose somebody else for one of the places.`,
        };
      }
      seen.add(p.personId);
    }
    // The generator's reason for an empty place no longer describes a row
    // somebody has just changed by hand.
    row.message = null;
  }

  if (changed > 0) recheckCombinations(svc, ctx);

  // What to say after saving. Only about the people just put on: anything else
  // at this service was already on the page before the save.
  const notes: string[] = [];
  for (const { person, row, cand } of arrivals) {
    if (cand.away) notes.push(`${person.name} is away that day.`);
    if (cand.on_break) notes.push(`${person.name} is taking a break at the moment.`);
    if (cand.is_guest) notes.push(`${person.name} is a guest.`);
    for (const other of svc.rows) {
      if (other === row || !other.people.some((p) => p.personId === person.personId)) continue;
      const c = ctx.combinations.get(comboKey(row.roleId, other.roleId));
      if (c?.verdict === 'red') {
        notes.push(`${person.name} is also on ${roleName(other)} here, which is marked as not allowed together.`);
      } else if (c?.verdict === 'amber') {
        notes.push(`${person.name} is also on ${roleName(other)} here, which is marked as not ideal.`);
      }
    }
  }

  next.rev += 1;
  if (changed > 0) next.edits += 1;
  next.lastSave = { serviceId, notes, changed };
  return { view: next, changed, notes };
}

/**
 * Amber and red, worked out again for everybody the draft placed at one
 * service, after a hand change.
 *
 * Each clash is told once, on the later of the two roles in the order the
 * service is read — or always on the draft's own placement when the other half
 * is a confirmed booking, which is never rewritten. Red is a note rather than a
 * refusal: the generator never makes one, so a red here is something a person
 * chose with the warning in front of them.
 */
function recheckCombinations(svc: DraftService, ctx: EditContext) {
  const where = new Map<number, { index: number; person: DraftPerson }[]>();
  svc.rows.forEach((r, index) => {
    for (const person of r.people) {
      where.set(person.personId, [...(where.get(person.personId) ?? []), { index, person }]);
    }
  });

  svc.rows.forEach((row, index) => {
    for (const p of row.people) {
      if (p.pinned) continue;
      const before = p.amber;
      const amber: string[] = [];
      const notes = (p.notes ?? []).filter((n) => !n.startsWith(RED_NOTE));
      for (const other of where.get(p.personId) ?? []) {
        if (other.index === index) continue;
        if (!other.person.pinned && other.index > index) continue;
        const otherRow = svc.rows[other.index]!;
        const otherName = ctx.roleNames?.get(otherRow.roleId) ?? otherRow.roleName;
        const c = ctx.combinations.get(comboKey(row.roleId, otherRow.roleId));
        // The generator's own words, from ambersFor in generate.ts.
        if (c?.verdict === 'amber') amber.push(`also ${otherName}${c.reason ? ` — ${c.reason}` : ''}`);
        if (c?.verdict === 'red') notes.push(`${RED_NOTE}${otherName} at the same service`);
      }
      // A generated reason quotes its ambers in brackets. Rewritten to match,
      // so a reason never mentions a clash that a hand change has taken away.
      const quoted = before.length ? ` (${before.join('; ')})` : '';
      if (quoted && p.reason.includes(quoted)) {
        p.reason = p.reason.replace(quoted, amber.length ? ` (${amber.join('; ')})` : '');
      }
      p.amber = amber;
      if (notes.length) p.notes = notes;
      else delete p.notes;
    }
  });
}
