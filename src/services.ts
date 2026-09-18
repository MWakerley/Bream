/**
 * Creating the ordinary Sunday services.
 *
 * Pulled out of the settings route so that generating a rota can do it too.
 * Having to create the Sundays as a separate step before asking for a rota was
 * busywork: they happen every week regardless, and nobody wants to be told
 * "there are no services in that range" when the answer is obviously "then make
 * them".
 */

/** ~2 years. A typo of 2026 -> 2206 should not create sixty thousand rows. */
export const MAX_RANGE_DAYS = 800;

/** Splits a list into runs of at most `size`. D1 caps both the statements in one
 *  batch and the parameters bound to one statement, and both caps are reached by
 *  perfectly ordinary church-sized data. */
export function* chunked<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

export interface SundayPlan {
  date: string;
  communion: boolean;
}

export type SundayError =
  | { ok: false; error: string }
  | { ok: true; sundays: SundayPlan[] };

/**
 * Every Sunday in the range, and whether it is a communion service.
 *
 * Walked in UTC throughout, so a British Summer Time boundary inside the range
 * cannot shift a Sunday onto the Saturday.
 */
export function sundaysBetween(from: string, to: string): SundayError {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(from) || !iso.test(to)) return { ok: false, error: 'Those dates could not be read.' };
  if (to < from) return { ok: false, error: 'The end date has to be after the start date.' };

  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: 'Those dates could not be read.' };
  }
  if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    return { ok: false, error: 'That range is longer than two years.' };
  }

  const sundays: SundayPlan[] = [];
  const d = new Date(start);
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
    // The SECOND Sunday of the month is communion, which is what the church's own
    // rota does: 13 Sep, 11 Oct, 8 Nov. The second Sunday is by definition the
    // one falling on the 8th to the 14th, whatever weekday the month starts on.
    const dayOfMonth = d.getUTCDate();
    sundays.push({
      date: d.toISOString().slice(0, 10),
      communion: dayOfMonth >= 8 && dayOfMonth <= 14,
    });
  }
  return { ok: true, sundays };
}

/**
 * The Sundays in a range that do not exist yet, as services the generator can
 * plan against WITHOUT anything being written down.
 *
 * Generating a draft used to create the Sundays first, because the generator
 * needs a service to assign to. That left a mess behind whenever somebody
 * generated a draft to see what it looked like and then thought better of it:
 * the services stayed, and had to be deleted one at a time. So the Sundays are
 * now imagined here, and only written when the draft is accepted.
 *
 * Their ids are NEGATIVE and count downwards, which is what makes this safe: no
 * real row can collide with them, and anything that reaches the database still
 * holding one is a bug that fails loudly on a foreign key rather than quietly
 * writing against the wrong service.
 */
export function provisionalSundays(
  sundays: SundayPlan[],
  /** Dates that already have a service, which are left alone. */
  taken: Set<string>,
  roles: { id: number; min_needed: number; ideal_needed: number; communion_only: number; is_active: number }[],
): { id: number; date: string; day: number; time: string; title: string; isCommunion: boolean;
     roles: { roleId: number; min: number; ideal: number }[] }[] {
  const active = roles.filter((r) => r.is_active);
  let nextId = -1;
  const out = [];
  for (const s of sundays) {
    if (taken.has(s.date)) continue;
    out.push({
      id: nextId--,
      date: s.date,
      day: Math.floor(Date.parse(`${s.date}T00:00:00Z`) / 86_400_000),
      time: '10:30',
      title: s.communion ? 'Holy Communion' : 'Worship',
      isCommunion: s.communion,
      // The same rule the loader's query applies to a real service: a role that
      // only happens at communion is absent from an ordinary Sunday rather than
      // being counted as an unfilled place.
      roles: active
        .filter((r) => !r.communion_only || s.communion)
        .map((r) => ({ roleId: r.id, min: r.min_needed, ideal: r.ideal_needed })),
    });
  }
  return out;
}

export interface CreateResult {
  /** How many were actually written. */
  added: number;
  /** How many the range contained, including ones that already existed. */
  total: number;
}

/**
 * Writes the 10:30 Sunday services for a range, skipping any that already exist.
 *
 * OR IGNORE against the (service_date, service_time) unique index is what makes
 * this safe to run repeatedly: a Sunday somebody has already set up — perhaps
 * renamed to "Harvest" or switched to communion — is left exactly as it is.
 */
export async function createSundays(
  db: D1Database,
  sundays: SundayPlan[],
): Promise<CreateResult> {
  if (!sundays.length) return { added: 0, total: 0 };

  const types = await db.prepare(
    "SELECT id, name FROM service_types WHERE name IN ('Worship','Holy Communion')",
  ).all<{ id: number; name: string }>();
  const worship = types.results.find((t) => t.name === 'Worship')?.id ?? null;
  const communionType = types.results.find((t) => t.name === 'Holy Communion')?.id ?? null;

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, is_communion)
     VALUES (?1, '10:30', ?2, ?3, ?4)`,
  );
  const batch = sundays.map((s) =>
    stmt.bind(s.date, s.communion ? communionType : worship,
      s.communion ? 'Holy Communion' : 'Worship', s.communion ? 1 : 0));

  // D1 caps statements per batch; 100 at a time is comfortably inside it.
  let added = 0;
  for (let i = 0; i < batch.length; i += 100) {
    const res = await db.batch(batch.slice(i, i + 100));
    added += res.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
  }
  return { added, total: sundays.length };
}
