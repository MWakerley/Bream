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
  /** The church asked to hear about every empty place, not only those below a
   *  role's minimum ("Tell me about every empty place" in Draft rota rules).
   *  Kept with the draft because the setting can change while it is open, and
   *  absent from drafts parked before it was kept, which read as false. */
  listEveryEmptyPlace?: boolean;
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
  /** Places still short of each role's minimum — or of its ideal, when the
   *  church asked to hear about every empty place. */
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
/** How a reason starts when a person chose somebody rather than the generator:
 *  the same words the service page writes. On a CONFIRMED booking load.ts reads
 *  them, and keeps a guest on the next generation only when the reason starts
 *  with exactly this — so it is not to be reworded.
 *
 *  It protects nothing for a place changed here, though. Apply writes those as
 *  draft like the rest of the draft, nothing ever turns a draft place into a
 *  confirmed one, and the next draft applied over the same dates replaces them
 *  with everything else from this one. The way to keep somebody for certain is
 *  to put them on from the service's own page once the draft is applied, and
 *  the Apply card says so. The words match only so the two read alike. */
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
  input: Pick<GeneratorInput, 'services' | 'people' | 'roleNames' | 'pinned' | 'rules'>,
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
            // Only the placement the generator actually bent the rule for, which
            // its own reason says in these words. The sentence alone names a date,
            // a person and a role, so somebody on the same role at 08:00 and at
            // 10:30 would hand the 10:30's warning to the 08:00 — and replacing
            // the one that really broke their limit would leave it behind.
            if (!p.reason.includes(` — placed ${relaxed} because`)) continue;
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
    listEveryEmptyPlace: !!input.rules?.listEveryEmptyPlace,
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
      // Short of the minimum is always worth counting. Short of the ideal only
      // when the church asked to hear about every empty place — which the
      // generator honours by reporting those places, and which the count on the
      // page would otherwise quietly ignore.
      empty += Math.max(0, (view.listEveryEmptyPlace ? r.ideal : r.min) - r.people.length);
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
 * Every place the draft itself fills, and as many free places as it takes to
 * bring the role up to its ideal — counted, the way the generator counts, not
 * read off as place numbers 1 to the ideal. A confirmed booking can sit in a
 * place numbered above the ideal (put on beside a generated preacher, who was
 * later taken off), and offering place 1 as well then put a second preacher on
 * a one-preacher Sunday, under a select with no visible label.
 *
 * A confirmed booking's place is never one of them: it is changed on the
 * service's own page once the draft is applied, because a draft that could
 * rewrite confirmed bookings would be one nobody dared apply.
 */
export function editableSlots(row: DraftRow): number[] {
  const pinned = row.people.filter((p) => p.pinned).length;
  const used = new Set(row.people.map((p) => p.slot));
  // The draft's own people keep their places whatever the count, so that any of
  // them can still be taken off.
  const out = new Set(row.people.filter((p) => !p.pinned).map((p) => p.slot));
  // Then the lowest free numbers, as the generator would pick them.
  for (let s = 1; pinned + out.size < row.ideal; s++) if (!used.has(s)) out.add(s);
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

  if (changed > 0) recheckCombinations(svc, ctx, new Set(arrivals.map((a) => a.person)));

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

type Placed = { row: DraftRow; index: number; person: DraftPerson };

/**
 * Amber and red, worked out again at one service after a hand change — but
 * only for the clashes the change could have touched.
 *
 * A clash neither half of which was changed stays exactly where it was. The
 * generator puts an amber on whichever of the two it placed second, which
 * follows how hard each role was to fill rather than the order the service is
 * read in; working every clash out again on any save moved those to the other
 * role, took the explanation out of one reason and left the other chip with
 * none, and told one combination in two different wordings across the draft.
 * So changing the preacher now leaves the reader's amber alone.
 *
 * A clash that involves somebody just put on is told once: on the later of the
 * two roles in the order the service is read, or always on the draft's own
 * placement when the other half is a confirmed booking, which is never
 * rewritten. A clash whose other half has just been taken off simply goes. Red
 * is a note rather than a refusal: the generator never makes one, so a red
 * here is something a person chose with the warning in front of them.
 */
function recheckCombinations(svc: DraftService, ctx: EditContext, fresh: Set<DraftPerson>) {
  const placed: Placed[] = svc.rows.flatMap((row, index) => row.people.map((person) => ({ row, index, person })));
  const nameOf = (r: DraftRow) => ctx.roleNames?.get(r.roleId) ?? r.roleName;

  /** Which of somebody's other places a chip or a note is about, by the role it
   *  names: the longest name that fits, so "Reader" never claims a chip that
   *  says "Reader (youth)". Both the name the draft was made with and today's
   *  are tried, in case the role has been renamed since. */
  const about = (said: string, lead: string, others: Placed[]) => {
    let best: Placed | undefined;
    let bestLength = -1;
    for (const o of others) {
      for (const n of [o.row.roleName, nameOf(o.row)]) {
        const fits = said === `${lead}${n}` || said.startsWith(`${lead}${n} `);
        if (fits && n.length > bestLength) { best = o; bestLength = n.length; }
      }
    }
    return best;
  };

  // First, what each of the draft's own placements keeps: whatever it said
  // about a clash whose two halves are both still here, and neither just put on.
  const plan = new Map<DraftPerson, { amber: string[]; notes: string[] }>();
  for (const { index, person: p } of placed) {
    if (p.pinned) continue;
    const others = placed.filter((o) => o.index !== index && o.person.personId === p.personId);
    const stands = (said: string, lead: string) => {
      if (fresh.has(p)) return false;
      const o = about(said, lead, others);
      return !!o && !fresh.has(o.person);
    };
    plan.set(p, {
      amber: p.amber.filter((a) => stands(a, 'also ')),
      notes: (p.notes ?? []).filter((n) => !n.startsWith(RED_NOTE) || stands(n, RED_NOTE)),
    });
  }

  // Then every clash with somebody just put on. `placed` is in the order the
  // service is read, so `b` is always the later of the two roles.
  placed.forEach((a, i) => {
    for (const b of placed.slice(i + 1)) {
      if (a.person.personId !== b.person.personId || a.index === b.index) continue;
      if (!fresh.has(a.person) && !fresh.has(b.person)) continue;
      const [holder, other] = b.person.pinned ? [a, b] : [b, a];
      const says = plan.get(holder.person);
      if (!says) continue;
      const c = ctx.combinations.get(comboKey(holder.row.roleId, other.row.roleId));
      const otherName = nameOf(other.row);
      // The generator's own words, from ambersFor in generate.ts.
      if (c?.verdict === 'amber') says.amber.push(`also ${otherName}${c.reason ? ` — ${c.reason}` : ''}`);
      if (c?.verdict === 'red') says.notes.push(`${RED_NOTE}${otherName} at the same service`);
    }
  });

  for (const [p, { amber, notes }] of plan) {
    if (JSON.stringify(amber) !== JSON.stringify(p.amber)) p.reason = requote(p.reason, p.amber, amber);
    p.amber = amber;
    if (notes.length) p.notes = notes;
    else delete p.notes;
  }
}

/**
 * A reason, rewritten to quote the ambers its placement now carries.
 *
 * A generated reason names its ambers in brackets, so a reason never mentions a
 * clash a hand change has taken away — and one that has just been given an
 * amber says why, rather than showing a chip with nothing to explain it. The
 * bracket goes where the generator puts it: before any "— placed ... because"
 * and before the full stop.
 */
function requote(reason: string, before: string[], after: string[]): string {
  const was = before.length ? ` (${before.join('; ')})` : '';
  const now = after.length ? ` (${after.join('; ')})` : '';
  // A function rather than a string, so a "$" in a role's name is not read as
  // a replacement pattern.
  if (was && reason.includes(was)) return reason.replace(was, () => now);
  if (!now) return reason;
  const at = reason.indexOf(' — placed ');
  if (at >= 0) return `${reason.slice(0, at)}${now}${reason.slice(at)}`;
  return reason.endsWith('.') ? `${reason.slice(0, -1)}${now}.` : `${reason}${now}`;
}
