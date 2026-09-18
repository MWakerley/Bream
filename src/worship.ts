/**
 * The worship team's own roster.
 *
 * Separate from the main rota on purpose. The worship leader works out who is
 * playing what, week by week; the churchwarden works out who is preaching.
 * Different person, different time, different rules — and a drummer has no
 * business appearing in a gap warning about communion stewards.
 *
 * Nothing here is compulsory. A Sunday with no plan is normal, and so is a plan
 * with two singers and nothing else.
 */

/** The positions, in the order they are asked about. */
export const POSITIONS = [
  { key: 'drums', label: 'Drums', live: true },
  { key: 'bass', label: 'Bass', live: true },
  { key: 'guitar', label: 'Guitar', live: true },
  { key: 'keys', label: 'Keyboards', live: true },
  { key: 'singer1', label: 'Singer 1', live: false },
  { key: 'singer2', label: 'Singer 2', live: false },
  { key: 'singer3', label: 'Singer 3', live: false },
] as const;

export type PositionKey = (typeof POSITIONS)[number]['key'];

/**
 * Which positions a kind of service asks about.
 *
 * Sung to recorded music, there is no band — only voices. Showing a drummer box
 * on a lyrics week is asking a question with no answer.
 */
export function positionsFor(kind: string) {
  return kind === 'lyrics' ? POSITIONS.filter((p) => !p.live) : POSITIONS;
}

export const KINDS = [
  { value: 'live', label: 'Live worship', note: 'A band — drums, bass, guitar, keys and singers' },
  { value: 'lyrics', label: 'Worship lyrics', note: 'Sung to recorded music — singers only' },
] as const;

export interface WorshipSlot {
  position: string;
  person_id: number | null;
  name: string | null;
}

export interface WorshipSunday {
  service_id: number;
  service_date: string;
  service_time: string;
  title: string | null;
  is_communion: number;
  /** Null where no plan has been made yet, which is most of them. */
  plan_id: number | null;
  kind: string | null;
  notes: string | null;
  /** Whoever the main rota has down as worship leader, for reference. */
  leaders: string[];
  slots: WorshipSlot[];
}

/** How a slot reads: the person's name, or the typed one. */
export function slotName(s: WorshipSlot, nameOf: Map<number, string>): string {
  if (s.person_id != null) return nameOf.get(s.person_id) ?? s.name ?? '—';
  return s.name ?? '—';
}

/**
 * Every upcoming service with its worship plan, if it has one.
 *
 * The worship leader from the MAIN rota comes along for the ride, because the
 * first question on this page is "whose week is it?" and the answer already
 * exists one table over. It is shown, not edited here — changing who leads
 * worship is a rota decision and belongs on the service page.
 */
export async function listWorshipSundays(
  db: D1Database,
  from: string,
  limit = 20,
): Promise<WorshipSunday[]> {
  const { results: services } = await db
    .prepare(
      `SELECT s.id AS service_id, s.service_date, s.service_time, s.title,
              COALESCE(s.is_communion, st.is_communion, 0) AS is_communion,
              w.id AS plan_id, w.kind, w.notes
         FROM services s
         LEFT JOIN service_types st ON st.id = s.service_type_id
         LEFT JOIN worship_plans w  ON w.service_id = s.id
        WHERE s.is_cancelled = 0 AND s.service_date >= ?1
        ORDER BY s.service_date, s.service_time
        LIMIT ?2`,
    )
    .bind(from, limit)
    .all<Omit<WorshipSunday, 'leaders' | 'slots'>>();
  if (!services.length) return [];

  // Two follow-up queries rather than one big join: a join would multiply the
  // service rows by slots by leaders and need untangling afterwards, and D1 is
  // happier with three small statements than one wide one.
  const ids = services.map((s) => s.service_id);
  const marks = ids.map(() => '?').join(',');

  const [slotRows, leaderRows] = await Promise.all([
    db.prepare(
      `SELECT w.service_id, x.position, x.person_id, x.name
         FROM worship_slots x
         JOIN worship_plans w ON w.id = x.plan_id
        WHERE w.service_id IN (${marks})`,
    ).bind(...ids).all<WorshipSlot & { service_id: number }>(),
    db.prepare(
      `SELECT a.service_id, p.display_name
         FROM assignments a
         JOIN people p ON p.id = a.person_id
         JOIN roles  r ON r.id = a.role_id
        WHERE a.service_id IN (${marks})
          AND r.key = 'worship_leader'`,
    ).bind(...ids).all<{ service_id: number; display_name: string }>(),
  ]);

  const slotsBy = new Map<number, WorshipSlot[]>();
  for (const r of slotRows.results) {
    slotsBy.set(r.service_id, [...(slotsBy.get(r.service_id) ?? []), r]);
  }
  const leadersBy = new Map<number, string[]>();
  for (const r of leaderRows.results) {
    leadersBy.set(r.service_id, [...(leadersBy.get(r.service_id) ?? []), r.display_name]);
  }

  return services.map((s) => ({
    ...s,
    slots: slotsBy.get(s.service_id) ?? [],
    leaders: leadersBy.get(s.service_id) ?? [],
  }));
}

export interface SlotInput {
  position: string;
  personId: number | null;
  name: string | null;
}

/**
 * Write one Sunday's plan.
 *
 * The slots are replaced wholesale rather than merged, because the form always
 * sends every position — so a position somebody has just cleared has to be able
 * to go back to empty, and a merge could never do that.
 */
export async function saveWorshipPlan(
  db: D1Database,
  serviceId: number,
  kind: 'live' | 'lyrics',
  notes: string | null,
  slots: SlotInput[],
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO worship_plans (service_id, kind, notes)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(service_id)
       DO UPDATE SET kind = excluded.kind, notes = excluded.notes,
                     updated_at = datetime('now')`,
    )
    .bind(serviceId, kind, notes)
    .run();

  const plan = await db
    .prepare('SELECT id FROM worship_plans WHERE service_id = ?1')
    .bind(serviceId)
    .first<{ id: number }>();
  if (!plan) return;

  await db.prepare('DELETE FROM worship_slots WHERE plan_id = ?1').bind(plan.id).run();

  // Only positions this kind of service actually has. Switching a week from a
  // band to lyrics must not leave a drummer behind in a row nothing displays.
  const allowed = new Set(positionsFor(kind).map((p) => p.key as string));
  const filled = slots.filter(
    (s) => allowed.has(s.position) && (s.personId != null || (s.name && s.name.trim())),
  );
  if (!filled.length) return;

  const stmt = db.prepare(
    'INSERT INTO worship_slots (plan_id, position, person_id, name) VALUES (?1, ?2, ?3, ?4)',
  );
  await db.batch(filled.map((s) => stmt.bind(
    plan.id, s.position, s.personId, s.personId == null ? s.name!.trim() : null,
  )));
}
