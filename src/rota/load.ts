import { epochDay } from './generate.js';
import { getRotaRules } from '../db.js';
import type { GenCapability, GeneratorInput, GenPair, GenService, Verdict } from './types.js';

/** How far back to look for cadence. A quarter's rota needs roughly a year of
 *  history for "when did they last preach" to mean anything. */
const HISTORY_DAYS = 400;

/**
 * Reads everything the generator needs out of D1.
 *
 * Four deliberate exclusions, and they are not all excluded in the same way:
 *   * people flagged `needs_review` are left out entirely. The import cannot
 *     tell Matt R from Matt W, and a rota that guesses which one is meant is
 *     worse than one that says a place is empty.
 *   * people marked `on_break` are left out of the CANDIDATE POOL but kept in
 *     the people list. They are still one of us; they are simply not to be put
 *     on anything new until the box is unticked.
 *   * people marked `is_guest` likewise. A visiting preacher is put on a
 *     service by name, never drawn from the pool, and never counted as part of
 *     it when the system asks whether a pool is thin.
 *   * assignments already CONFIRMED inside the window become pins, not
 *     suggestions. The September rota is what the church is already running;
 *     regenerating must not quietly rewrite it.
 *
 * The distinction between the first exclusion and the middle two is the whole
 * reason there are two queries below rather than one. Read the comments on them
 * before moving a WHERE clause from one to the other.
 */
export async function loadGeneratorInput(
  db: D1Database,
  fromDate: string,
  toDate: string,
  runSeed: string,
): Promise<GeneratorInput> {
  const historyFrom = new Date((epochDay(fromDate) - HISTORY_DAYS) * 86_400_000)
    .toISOString().slice(0, 10);

  // d1.batch is typed as a sparse array, so pull the rows out through one helper
  // rather than eight non-null assertions.
  const batched = await db.batch([
      db.prepare(
        `SELECT s.id, s.service_date, s.service_time, COALESCE(s.title,'Worship') AS title,
                COALESCE(s.is_communion, st.is_communion, 0) AS is_communion,
                r.id AS role_id,
                COALESCE(o.min_needed,   r.min_needed)   AS min_needed,
                COALESCE(o.ideal_needed, r.ideal_needed) AS ideal_needed
           FROM services s
           LEFT JOIN service_types st ON st.id = s.service_type_id
           CROSS JOIN roles r
           LEFT JOIN service_role_overrides o ON o.service_id = s.id AND o.role_id = r.id
          WHERE s.is_cancelled = 0 AND r.is_active = 1
            AND COALESCE(o.applies, 1) = 1
            AND (r.communion_only = 0 OR COALESCE(s.is_communion, st.is_communion, 0) = 1)
            AND s.service_date BETWEEN ?1 AND ?2
          ORDER BY s.service_date, s.service_time, r.sort_order`,
      ).bind(fromDate, toDate),

      // Everybody the generator is allowed to KNOW ABOUT.
      //
      // Deliberately NOT filtered on on_break or is_guest, and this is
      // load-bearing rather than an oversight. generate.ts builds personById
      // from this list and skips any pin whose person is missing from it; a
      // dropped pin leaves its slot looking free, the slot is handed to somebody
      // else, and apply's INSERT OR REPLACE then overwrites the CONFIRMED row on
      // the unique (service_id, role_id, slot). Filtering here would quietly
      // delete arrangements the church has already made and printed.
      //
      // Absence from the ROTA is achieved by the next query instead.
      db.prepare(
        `SELECT id, display_name FROM people
          WHERE is_active = 1 AND needs_review = 0 ORDER BY id`,
      ),

      // What each person is available to be PICKED for.
      //
      // This is the single enforcement point for "do not put them on anything
      // new". It feeds capBy and eligible, which between them supply every
      // candidate pool, the fair-share denominator, the expected-load maths and
      // the capacity audit — so a person absent here is absent from all of it,
      // while their existing pins above still stand.
      //
      //   on_break — still one of us, just not at the moment
      //   is_guest — a visitor, put on by name or not at all
      //
      // Both are only ever excluded from work the generator INVENTS. Neither
      // stops a human putting them on a service deliberately.
      db.prepare(
        `SELECT pr.person_id, pr.role_id, pr.max_per_period, pr.period_days,
                pr.min_gap_days, pr.ask_any_time,
                r.default_min_gap_days, r.default_target_days
           FROM person_roles pr
           JOIN people p ON p.id = pr.person_id
           JOIN roles  r ON r.id = pr.role_id
          WHERE pr.can_do = 1 AND pr.willing = 1
            AND p.is_active = 1 AND p.needs_review = 0
            AND p.on_break = 0 AND p.is_guest = 0
          ORDER BY pr.person_id, pr.role_id`,
      ),

      db.prepare('SELECT role_a_id, role_b_id, verdict, reason FROM role_combinations'),

      db.prepare(
        `SELECT person_a_id, person_b_id, role_id, mode, strength, note FROM pairings`,
      ),

      db.prepare(
        'SELECT person_id, from_date, to_date FROM unavailability WHERE to_date >= ?1',
      ).bind(fromDate),

      db.prepare(
        `SELECT a.person_id, a.role_id, s.service_date
           FROM assignments a JOIN services s ON s.id = a.service_id
          WHERE a.person_id IS NOT NULL
            AND s.service_date >= ?1 AND s.service_date < ?2`,
      ).bind(historyFrom, fromDate),

      db.prepare(
        `SELECT a.id AS assignment_id, a.service_id, a.role_id, a.slot, a.person_id,
                a.reason, p.display_name, p.on_break, p.is_guest
           FROM assignments a
           JOIN services s ON s.id = a.service_id
           JOIN people   p ON p.id = a.person_id
          WHERE a.person_id IS NOT NULL AND a.status = 'confirmed'
            AND s.service_date BETWEEN ?1 AND ?2`,
      ).bind(fromDate, toDate),
    ]);

  const rows = <T,>(i: number): T[] => (batched[i]?.results ?? []) as T[];
  const svcRows = rows<any>(0);
  const peopleRows = rows<any>(1);
  const capRows = rows<any>(2);
  const comboRows = rows<any>(3);
  const pairRows = rows<any>(4);
  const unavailRows = rows<any>(5);
  const histRows = rows<any>(6);
  // Confirmed bookings are kept exactly as they are — EXCEPT two kinds, which a
  // new draft takes off and hands back as free places:
  //
  //   * anybody now on a break. The church asked for this directly: a draft that
  //     still shows somebody who has said they are stepping back is wrong, even
  //     when the booking came from the spreadsheet before the break began.
  //   * a guest the rota put on — the imported spreadsheet included. The one
  //     guest booking that stays is one a person made by hand from the service
  //     page ("Put on by ..."), because that is the only way a guest is meant to
  //     get on at all, and it was a deliberate act by somebody who knew.
  //
  // The preview lists every one of these by name before anything is saved.
  const allPins = rows<any>(7);
  const releases = (p: any): 'break' | 'guest' | null =>
    p.on_break ? 'break'
      : p.is_guest && !String(p.reason ?? '').startsWith('Put on by ') ? 'guest'
        : null;
  const pinRows = allPins.filter((p) => !releases(p));
  const released = allPins.filter((p) => releases(p)).map((p) => ({
    assignmentId: p.assignment_id, serviceId: p.service_id, roleId: p.role_id, slot: p.slot,
    personId: p.person_id, name: p.display_name, why: releases(p)!,
  }));

  // Read outside the batch rather than inside it: it is one tiny row, and
  // adding a ninth statement would renumber every rows<T>(i) index above.
  const rulesRow = await getRotaRules(db);

  // Every role, not just the active ones: a name is still needed to explain an
  // allocation made before a role was retired.
  const roleNameRows = (await db.prepare('SELECT id, name FROM roles')
    .all<{ id: number; name: string }>()).results;
  const roleNames = new Map(roleNameRows.map((r) => [r.id, r.name]));

  // ---- services, grouped from the flat requirement rows -------------------
  const services = new Map<number, GenService>();
  for (const r of svcRows) {
    let s = services.get(r.id);
    if (!s) {
      s = {
        id: r.id, date: r.service_date, day: epochDay(r.service_date),
        time: r.service_time, title: r.title, isCommunion: !!r.is_communion, roles: [],
      };
      services.set(r.id, s);
    }
    s.roles.push({ roleId: r.role_id, min: r.min_needed, ideal: r.ideal_needed });
  }

  // ---- capabilities -------------------------------------------------------
  // The schema stores a cap ("twice a month") and a floor ("every 3 months")
  // rather than an explicit target, so the target is derived: an explicit floor
  // IS the rhythm they asked for; a cap implies one of window/count. Where
  // neither is set the generator falls back to their fair share of the role.
  //
  // THE ORDER OF PRECEDENCE, which is the whole point of the settings page:
  //   1. what this person said for themselves
  //   2. what the church set for this role
  //   3. the fair share, worked out from the size of the team
  //
  // The role default is deliberately NOT routed into desiredEveryDays. Today a
  // person's own min_gap_days does double duty as the rhythm the debt score is
  // measured against; giving every preacher the role's floor as a target too
  // would push most of the pool past DEBT_CAP, collapse the ordering onto the
  // tie-break hash, and make the draft reach a newcomer later than it does now.
  // The target has its own setting instead.
  const capabilities: GenCapability[] = capRows.map((c) => ({
    personId: c.person_id,
    roleId: c.role_id,
    desiredEveryDays: c.min_gap_days
      ?? (c.max_per_period && c.period_days ? c.period_days / c.max_per_period : null)
      ?? c.default_target_days
      ?? null,
    minGapDays: c.min_gap_days ?? c.default_min_gap_days ?? null,
    askAnyTime: !!c.ask_any_time,
    maxPerWindow: c.max_per_period && c.period_days
      ? { count: c.max_per_period, windowDays: c.period_days }
      : null,
  }));

  const combinations = new Map<string, { verdict: Verdict; reason: string | null }>();
  for (const r of comboRows) {
    combinations.set(
      `${Math.min(r.role_a_id, r.role_b_id)}:${Math.max(r.role_a_id, r.role_b_id)}`,
      { verdict: r.verdict, reason: r.reason },
    );
  }

  const pairs: GenPair[] = pairRows.map((p) => ({
    aId: p.person_a_id, bId: p.person_b_id, roleId: p.role_id,
    mode: p.mode, strength: p.strength,
    // The seeded note carries the evidence count; use it as the weight so a pair
    // seen 8 times outranks one seen twice.
    weight: Number(/(\d+)\s+times/.exec(p.note ?? '')?.[1] ?? 3),
    note: p.note,
  }));

  // The settings page stores words; the generator wants numbers. Translating
  // here keeps the generator ignorant of where a figure came from — it is a pure
  // function and should stay one.
  //
  // The two hard gaps are 8 and 15, not 7 and 14. Consecutive Sundays are
  // exactly 7 days apart and the test is `sinceAny < hardDays`, so a 7 would
  // permit precisely what "never on two Sundays running" forbids.
  const GAPS: Record<string, { hard: number; soft: number }> = {
    none: { hard: 0, soft: 0 },
    week_prefer: { hard: 0, soft: 7 },
    fortnight_prefer: { hard: 0, soft: 14 },
    month_prefer: { hard: 0, soft: 30 },
    not_two_sundays: { hard: 8, soft: 14 },
    fortnight_rule: { hard: 15, soft: 14 },
  };
  const FAIRNESS: Record<string, number> = { even: 70, balanced: 40, best_fit: 15 };
  const gap = GAPS[rulesRow.any_role_gap] ?? GAPS.fortnight_prefer!;

  return {
    services: [...services.values()],
    rules: {
      anyRoleHardDays: gap.hard,
      anyRoleSoftDays: gap.soft,
      maxRolesPerService: rulesRow.max_roles_per_service,
      whenShort: (['leave_empty', 'bend_gap', 'bend_both'].includes(rulesRow.when_short)
        ? rulesRow.when_short
        : 'bend_both') as 'leave_empty' | 'bend_gap' | 'bend_both',
      fairWeight: FAIRNESS[rulesRow.fairness] ?? 40,
      listEveryEmptyPlace: !!rulesRow.list_every_empty_place,
    },
    people: peopleRows.map((p) => ({ id: p.id, name: p.display_name })),
    roleNames,
    capabilities,
    combinations,
    pairs,
    unavailable: unavailRows.map((u) => ({
      personId: u.person_id, fromDay: epochDay(u.from_date), toDay: epochDay(u.to_date),
    })),
    history: histRows.map((h) => ({
      personId: h.person_id, roleId: h.role_id, day: epochDay(h.service_date),
    })),
    pinned: pinRows.map((p) => ({
      serviceId: p.service_id, roleId: p.role_id, slot: p.slot, personId: p.person_id,
    })),
    released,
    runSeed,
  };
}
