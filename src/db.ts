/** Row shapes for the tables Stage 1 reads. Kept next to the queries that use
 *  them rather than in a generated file, so a schema change that breaks a query
 *  breaks the type-check too. */

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Event posters. Images are kept here rather than in D1 — a photo in a row
   *  would be read back by every query touching the event. */
  IMAGES: R2Bucket;
  /** Cloudflare Email Sending. Absent until a domain is onboarded, which is why
   *  every use of it is guarded rather than assumed. */
  EMAIL?: { send: (m: unknown) => Promise<unknown> };
  /** The address acknowledgements come from, e.g. 'bookings@send.stack66.com'. */
  ACK_FROM?: string;
  /** One-time ticket for /admin/setup. Set with `wrangler secret put`, deleted
   *  once the first admin exists. Absent in normal operation. */
  ADMIN_BOOTSTRAP_TOKEN?: string;
  /** Turnstile, guarding the one public form. The site key is rendered into the
   *  page and is meant to be visible; the secret is a Worker secret. Both are
   *  optional, and the booking form works without a challenge if either is
   *  missing — see src/turnstile.ts for why that is the right failure. */
  TURNSTILE_SITEKEY?: string;
  TURNSTILE_SECRET?: string;
}

export interface PersonRow {
  id: number;
  display_name: string;
  full_name: string | null;
  email: string | null;
  is_active: number;
  is_admin: number;
  needs_review: number;
  review_note: string | null;
  happy_with_anyone: number;
  /**
   * Still one of us, just not at the moment.
   *
   * Distinct from is_active, which means they have stopped. Somebody on a break
   * keeps their roles, their history and their place on the roster; the
   * generator simply does not pick them until it is unticked.
   */
  on_break: number;
  on_break_since: string | null;
  /**
   * A visiting preacher or worship leader.
   *
   * They can be put on a service by hand — that is the whole point of them —
   * but they are never drawn from the pool automatically, and never counted
   * when the system asks whether a pool is big enough.
   */
  is_guest: number;
}

export interface RoleRow {
  id: number;
  key: string;
  name: string;
  sheet_heading: string | null;
  sort_order: number;
  min_needed: number;
  ideal_needed: number;
  communion_only: number;
  is_active: number;
}

export interface SessionPerson {
  id: number;
  display_name: string;
  is_admin: number;
}

/** The signed-in person for a session id, or null. Also drops the row when it
 *  has expired, so the table does not grow without bound. */
export async function personForSession(
  db: D1Database,
  sessionId: string,
): Promise<SessionPerson | null> {
  const row = await db
    .prepare(
      `SELECT p.id, p.display_name, p.is_admin, s.expires_at
         FROM sessions s JOIN people p ON p.id = s.person_id
        WHERE s.id = ?1 AND p.is_active = 1`,
    )
    .bind(sessionId)
    .first<SessionPerson & { expires_at: string }>();

  if (!row) return null;
  if (row.expires_at <= new Date().toISOString()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?1').bind(sessionId).run();
    return null;
  }
  return { id: row.id, display_name: row.display_name, is_admin: row.is_admin };
}

export async function countAdmins(db: D1Database): Promise<number> {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM people p
         JOIN credentials c ON c.person_id = p.id
        WHERE p.is_admin = 1`,
    )
    .first<{ n: number }>();
  return r?.n ?? 0;
}

export async function listRoles(db: D1Database): Promise<RoleRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM roles WHERE is_active = 1 ORDER BY sort_order, name')
    .all<RoleRow>();
  return results;
}

export interface PersonWithRoles extends PersonRow {
  role_names: string | null;
  role_count: number;
}

export async function listPeople(db: D1Database): Promise<PersonWithRoles[]> {
  const { results } = await db
    .prepare(
      `SELECT p.*,
              GROUP_CONCAT(r.name, ', ') AS role_names,
              COUNT(r.id)                AS role_count
         FROM people p
         LEFT JOIN person_roles pr ON pr.person_id = p.id AND pr.can_do = 1
         LEFT JOIN roles r         ON r.id = pr.role_id AND r.is_active = 1
        WHERE p.is_active = 1
        GROUP BY p.id
        ORDER BY p.needs_review DESC, p.display_name`,
    )
    .all<PersonWithRoles>();
  return results;
}

export interface PersonForRole {
  id: number;
  display_name: string;
  needs_review: number;
  on_break: number;
  is_guest: number;
  can_do: number;
  max_per_period: number | null;
  period_days: number | null;
  min_gap_days: number | null;
  /** How many times they have actually done this role. */
  done: number;
}

/**
 * Everybody, against ONE role.
 *
 * The whole roster rather than only those who already do it, because the point
 * of the screen is to add people — "who could preach" is a question you answer
 * by looking down the list of everyone, not by looking at the four who already
 * do. Those who can do it float to the top so the current picture reads first.
 */
export async function listPeopleForRole(
  db: D1Database,
  roleId: number,
): Promise<PersonForRole[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.display_name, p.needs_review, p.on_break, p.is_guest,
              COALESCE(pr.can_do, 0) AS can_do,
              pr.max_per_period, pr.period_days, pr.min_gap_days,
              (SELECT COUNT(*) FROM assignments a
                WHERE a.person_id = p.id AND a.role_id = ?1) AS done
         FROM people p
         LEFT JOIN person_roles pr ON pr.person_id = p.id AND pr.role_id = ?1
        WHERE p.is_active = 1
        ORDER BY COALESCE(pr.can_do, 0) DESC, done DESC, p.display_name`,
    )
    .bind(roleId)
    .all<PersonForRole>();
  return results;
}

export interface Candidate {
  id: number;
  display_name: string;
  /** They are ticked as able to do this role. */
  can_do: number;
  on_break: number;
  is_guest: number;
  /** They are already on this service, in some role. */
  already_here: number;
  /** They have said they are away on this date. */
  away: number;
}

/**
 * Who could be put on this role at this service, by hand.
 *
 * Everybody active, not only those the generator would pick — that is the point
 * of doing it by hand. A guest preacher exists precisely to be chosen this way
 * and would never appear otherwise, and somebody on a break may still say yes
 * when asked directly.
 *
 * Nobody is excluded. What the list does instead is SAY things: who cannot
 * normally do this role, who is away that day, who is already on this service.
 * The person clicking is a churchwarden who knows more than the database does,
 * so the job here is to inform the decision rather than to overrule it.
 */
export async function listCandidatesForRole(
  db: D1Database,
  serviceId: number,
  roleId: number,
): Promise<Candidate[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.display_name, p.on_break, p.is_guest,
              COALESCE(pr.can_do, 0) AS can_do,
              EXISTS (SELECT 1 FROM assignments a
                       WHERE a.service_id = ?1 AND a.person_id = p.id) AS already_here,
              EXISTS (SELECT 1 FROM unavailability u
                       JOIN services s ON s.id = ?1
                      WHERE u.person_id = p.id
                        AND s.service_date BETWEEN u.from_date AND u.to_date) AS away
         FROM people p
         LEFT JOIN person_roles pr ON pr.person_id = p.id AND pr.role_id = ?2
        WHERE p.is_active = 1 AND p.needs_review = 0
        ORDER BY COALESCE(pr.can_do, 0) DESC, p.display_name`,
    )
    .bind(serviceId, roleId)
    .all<Candidate>();
  return results;
}

export interface CombinationRow {
  role_a_id: number;
  role_b_id: number;
  verdict: 'green' | 'amber' | 'red';
  reason: string | null;
}

export async function listCombinations(db: D1Database): Promise<CombinationRow[]> {
  const { results } = await db
    .prepare('SELECT role_a_id, role_b_id, verdict, reason FROM role_combinations')
    .all<CombinationRow>();
  return results;
}

export interface CombinationForRole {
  role_id: number;
  role_name: string;
  communion_only: number;
  /** Null where nothing has been decided, which the generator reads as allowed. */
  verdict: 'green' | 'amber' | 'red' | null;
  reason: string | null;
  /** How many times one person has actually held both at the same service. */
  observed: number;
}

/**
 * Every other role measured against one role.
 *
 * The stored table keeps each pair once with role_a_id < role_b_id, because a
 * combination has no direction — "preacher and service leader" is one fact, not
 * two. This reads it from one side, which is how the question gets asked out
 * loud: "what else can the preacher do?"
 *
 * `observed` counts what the church has actually done, from the imported rota.
 * It is evidence rather than policy: a combination done six times is probably
 * fine, but it is still for somebody to decide, not for the import to assert.
 */
export async function listCombinationsForRole(
  db: D1Database,
  roleId: number,
): Promise<CombinationForRole[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id AS role_id, r.name AS role_name, r.communion_only,
              c.verdict, c.reason,
              (SELECT COUNT(*)
                 FROM assignments a1
                 JOIN assignments a2
                   ON a2.service_id = a1.service_id
                  AND a2.person_id  = a1.person_id
                WHERE a1.role_id = ?1 AND a2.role_id = r.id) AS observed
         FROM roles r
         LEFT JOIN role_combinations c
                ON c.role_a_id = MIN(r.id, ?1)
               AND c.role_b_id = MAX(r.id, ?1)
        WHERE r.is_active = 1 AND r.id <> ?1
        ORDER BY r.name`,
    )
    .bind(roleId)
    .all<CombinationForRole>();
  return results;
}

/**
 * Save what one role may be combined with.
 *
 * A verdict of null means "not decided", which is stored by removing the row
 * rather than by writing a null — the generator treats a missing row and an
 * undecided row the same way, and keeping one representation means the matrix
 * count of "not yet decided" cannot disagree with what the generator does.
 */
export async function saveCombinationsForRole(
  db: D1Database,
  roleId: number,
  entries: { otherRoleId: number; verdict: 'green' | 'amber' | 'red' | null; reason: string | null }[],
): Promise<void> {
  const stmts: D1PreparedStatement[] = [];
  for (const e of entries) {
    if (e.otherRoleId === roleId) continue; // a role combined with itself is not a thing
    const a = Math.min(roleId, e.otherRoleId);
    const b = Math.max(roleId, e.otherRoleId);
    if (e.verdict === null) {
      stmts.push(db.prepare('DELETE FROM role_combinations WHERE role_a_id = ?1 AND role_b_id = ?2')
        .bind(a, b));
    } else {
      stmts.push(db.prepare(
        `INSERT INTO role_combinations (role_a_id, role_b_id, verdict, reason)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (role_a_id, role_b_id)
         DO UPDATE SET verdict = excluded.verdict, reason = excluded.reason`,
      ).bind(a, b, e.verdict, e.reason));
    }
  }
  // Chunked because D1 caps how many statements one batch may carry, and this
  // grows with the number of roles rather than being fixed.
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100));
  }
}

export interface PairingRow {
  id: number;
  role_id: number | null;
  a_name: string;
  b_name: string;
  role_name: string | null;
  mode: string;
  strength: string;
  note: string | null;
}

export async function listPairings(db: D1Database): Promise<PairingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT pr.id, pr.role_id, pa.display_name AS a_name, pb.display_name AS b_name,
              r.name AS role_name, pr.mode, pr.strength, pr.note
         FROM pairings pr
         JOIN people pa ON pa.id = pr.person_a_id
         JOIN people pb ON pb.id = pr.person_b_id
         LEFT JOIN roles r ON r.id = pr.role_id
        ORDER BY pa.display_name, pb.display_name`,
    )
    .all<PairingRow>();
  return results;
}

/**
 * Every (service, role) pair that a service actually needs, with how many people
 * are on it. This one query is the basis of the dashboard, the service page and
 * the gap warnings, because all three are asking the same question.
 *
 * Three things decide whether a role counts for a given service:
 *   * the role is active;
 *   * a communion-only role (preside, distribution) only exists when the service
 *     is communion — on an ordinary Sunday it is absent, not unfilled;
 *   * a per-service override can switch it off entirely ("no children's work on
 *     Christmas Eve") or change the numbers.
 *
 * An unfilled place is the ABSENCE of an assignment row, not a row with a NULL
 * person, so the requirement is computed from the roles table rather than from
 * placeholder rows written when the service was created. That way changing a
 * role from 2 to 4 immediately re-scores every existing service.
 */
const REQUIREMENTS_SQL = `
  SELECT s.id                                   AS service_id,
         s.service_date, s.service_time, s.title, s.location,
         s.readings, s.sermon_title,
         COALESCE(s.is_communion, st.is_communion, 0) AS is_communion,
         r.id                                   AS role_id,
         r.name                                 AS role_name,
         r.sort_order                           AS role_sort,
         COALESCE(o.min_needed,   r.min_needed)   AS min_needed,
         COALESCE(o.ideal_needed, r.ideal_needed) AS ideal_needed,
         COUNT(a.person_id)                     AS filled
    FROM services s
    LEFT JOIN service_types st ON st.id = s.service_type_id
    CROSS JOIN roles r
    LEFT JOIN service_role_overrides o ON o.service_id = s.id AND o.role_id = r.id
    LEFT JOIN assignments a
           ON a.service_id = s.id AND a.role_id = r.id AND a.person_id IS NOT NULL
   WHERE s.is_cancelled = 0
     AND r.is_active = 1
     AND COALESCE(o.applies, 1) = 1
     AND (r.communion_only = 0
          OR COALESCE(s.is_communion, st.is_communion, 0) = 1)
`;

export interface RequirementRow {
  service_id: number;
  service_date: string;
  service_time: string;
  title: string | null;
  location: string | null;
  readings: string | null;
  sermon_title: string | null;
  is_communion: number;
  role_id: number;
  role_name: string;
  role_sort: number;
  min_needed: number;
  ideal_needed: number;
  filled: number;
}

export interface ServiceSummary {
  id: number;
  service_date: string;
  service_time: string;
  title: string | null;
  location: string | null;
  is_communion: number;
  readings: string | null;
  sermon_title: string | null;
  /**
   * Roles with NOBODY on them. Only these count as unfilled.
   *
   * A role wanting two people and having one is not unfilled — somebody is
   * doing it, and calling that "unfilled" both overstates the problem and
   * buries the services where genuinely nobody is on. Those cases are `under`,
   * shown and highlighted but described for what they are.
   */
  gaps: string[];
  /** Roles with somebody on them but fewer than the minimum. */
  under: { role: string; filled: number; min: number }[];
  /** Roles at or above minimum but below ideal. */
  short: string[];
  filled: number;
  needed: number;
}

/** Upcoming services with their gaps worked out. `from` defaults to today. */
export async function listUpcomingServices(
  db: D1Database,
  from?: string,
  limit = 40,
): Promise<ServiceSummary[]> {
  const fromDate = from ?? new Date().toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `${REQUIREMENTS_SQL} AND s.service_date >= ?1
        GROUP BY s.id, r.id
        ORDER BY s.service_date, s.service_time, r.sort_order`,
    )
    .bind(fromDate)
    .all<RequirementRow>();

  const byService = new Map<number, ServiceSummary>();
  for (const row of results) {
    let s = byService.get(row.service_id);
    if (!s) {
      s = {
        id: row.service_id,
        service_date: row.service_date,
        service_time: row.service_time,
        title: row.title,
        location: row.location,
        is_communion: row.is_communion,
        readings: row.readings,
        sermon_title: row.sermon_title,
        gaps: [], under: [], short: [], filled: 0, needed: 0,
      };
      byService.set(row.service_id, s);
    }
    s.filled += row.filled;
    s.needed += row.min_needed;
    // Three states, not two. "Nobody at all" is the one that needs finding a
    // person; "one of the two we would like" is worth flagging but is not the
    // same problem, and lumping them together made a service with every role
    // covered look the same as one with none.
    if (row.filled === 0) s.gaps.push(row.role_name);
    else if (row.filled < row.min_needed) {
      s.under.push({ role: row.role_name, filled: row.filled, min: row.min_needed });
    } else if (row.filled < row.ideal_needed) s.short.push(row.role_name);
  }

  return [...byService.values()].slice(0, limit);
}

export async function countServicesWithGaps(db: D1Database): Promise<number> {
  const services = await listUpcomingServices(db, undefined, 500);
  return services.filter((s) => s.gaps.length > 0).length;
}

export interface ServiceRoleDetail {
  role_id: number;
  role_name: string;
  min_needed: number;
  ideal_needed: number;
  /**
   * Who is on it.
   *
   * Objects rather than names, because a name cannot be taken off again. Each
   * carries the assignment id that a remove button posts to, and the status so
   * the page can tell a confirmed arrangement from one the generator suggested
   * and would replace anyway.
   */
  people: ServiceAssignee[];
}

export interface ServiceAssignee {
  assignment_id: number;
  person_id: number;
  display_name: string;
  status: string;
  /** They are on this service despite being on a break or being a guest. */
  on_break: number;
  is_guest: number;
}

export interface ServiceDetail {
  id: number;
  service_date: string;
  service_time: string;
  title: string | null;
  location: string | null;
  is_communion: number;
  readings: string | null;
  sermon_title: string | null;
  roles: ServiceRoleDetail[];
  /** Roles switched off for this service, with the reason. */
  notApplicable: { role_id: number; role_name: string; note: string | null }[];
}

export async function getServiceDetail(
  db: D1Database,
  id: number,
): Promise<ServiceDetail | null> {
  const svc = await db
    .prepare(
      `SELECT s.id, s.service_date, s.service_time, s.title, s.location,
              COALESCE(s.is_communion, st.is_communion, 0) AS is_communion,
              s.readings, s.sermon_title
         FROM services s LEFT JOIN service_types st ON st.id = s.service_type_id
        WHERE s.id = ?1`,
    )
    .bind(id)
    .first<Omit<ServiceDetail, 'roles' | 'notApplicable'>>();
  if (!svc) return null;

  const { results } = await db
    .prepare(
      `${REQUIREMENTS_SQL} AND s.id = ?1
        GROUP BY s.id, r.id
        ORDER BY r.sort_order`,
    )
    .bind(id)
    .all<RequirementRow>();

  const { results: people } = await db
    .prepare(
      `SELECT a.id AS assignment_id, a.role_id, a.status,
              p.id AS person_id, p.display_name, p.on_break, p.is_guest
         FROM assignments a JOIN people p ON p.id = a.person_id
        WHERE a.service_id = ?1
        ORDER BY a.role_id, a.slot`,
    )
    .bind(id)
    .all<ServiceAssignee & { role_id: number }>();
  const byRole = new Map<number, ServiceAssignee[]>();
  for (const p of people) {
    const arr = byRole.get(p.role_id) ?? [];
    arr.push(p);
    byRole.set(p.role_id, arr);
  }

  const { results: na } = await db
    .prepare(
      `SELECT r.id AS role_id, r.name AS role_name, o.note
         FROM service_role_overrides o JOIN roles r ON r.id = o.role_id
        WHERE o.service_id = ?1 AND o.applies = 0
        ORDER BY r.sort_order`,
    )
    .bind(id)
    .all<{ role_id: number; role_name: string; note: string | null }>();

  return {
    ...svc,
    roles: results.map((r) => ({
      role_id: r.role_id,
      role_name: r.role_name,
      min_needed: r.min_needed,
      ideal_needed: r.ideal_needed,
      people: byRole.get(r.role_id) ?? [],
    })),
    notApplicable: na,
  };
}
