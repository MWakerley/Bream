import { epochDay } from './generate.js';
import type { GenCapability, GeneratorInput, GenPair, GenService, Verdict } from './types.js';

/** How far back to look for cadence. A quarter's rota needs roughly a year of
 *  history for "when did they last preach" to mean anything. */
const HISTORY_DAYS = 400;

/**
 * Reads everything the generator needs out of D1.
 *
 * Two deliberate exclusions:
 *   * people flagged `needs_review` are left out entirely. The import cannot
 *     tell Matt R from Matt W, and a rota that guesses which one is meant is
 *     worse than one that says a place is empty.
 *   * assignments already CONFIRMED inside the window become pins, not
 *     suggestions. The September rota is what the church is already running;
 *     regenerating must not quietly rewrite it.
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

      db.prepare(
        `SELECT id, display_name FROM people
          WHERE is_active = 1 AND needs_review = 0 ORDER BY id`,
      ),

      db.prepare(
        `SELECT pr.person_id, pr.role_id, pr.max_per_period, pr.period_days, pr.min_gap_days
           FROM person_roles pr
           JOIN people p ON p.id = pr.person_id
          WHERE pr.can_do = 1 AND pr.willing = 1
            AND p.is_active = 1 AND p.needs_review = 0
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
        `SELECT a.service_id, a.role_id, a.slot, a.person_id
           FROM assignments a JOIN services s ON s.id = a.service_id
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
  const pinRows = rows<any>(7);

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
  const capabilities: GenCapability[] = capRows.map((c) => ({
    personId: c.person_id,
    roleId: c.role_id,
    desiredEveryDays: c.min_gap_days ?? (c.max_per_period && c.period_days
      ? c.period_days / c.max_per_period
      : null),
    minGapDays: c.min_gap_days ?? null,
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

  return {
    services: [...services.values()],
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
    runSeed,
  };
}
