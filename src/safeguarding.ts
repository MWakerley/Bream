/**
 * Safeguarding roles, the courses each one needs, and who has done what.
 *
 * The grid (role x course) is the single source of which courses a person
 * needs: tick "Churchwarden" on somebody's record and whatever the grid says a
 * churchwarden needs is what their record asks about.
 */

export interface SafeguardingGrid {
  roles: { id: number; name: string }[];
  courses: { id: number; name: string }[];
  /** 'roleId:courseId' for every tick on the grid. */
  requires: Set<string>;
}

export interface PersonSafeguarding {
  roleIds: number[];
  /** What has been said about each course; absent means nobody has said. */
  courses: Map<number, { done: number; done_at: string | null }>;
}

export async function loadGrid(db: D1Database): Promise<SafeguardingGrid> {
  const [roles, courses, reqs] = await db.batch([
    db.prepare('SELECT id, name FROM safeguarding_roles ORDER BY sort_order, name'),
    db.prepare('SELECT id, name FROM safeguarding_courses ORDER BY sort_order, name'),
    db.prepare('SELECT role_id, course_id FROM safeguarding_requirements'),
  ]);
  return {
    roles: (roles?.results ?? []) as SafeguardingGrid['roles'],
    courses: (courses?.results ?? []) as SafeguardingGrid['courses'],
    requires: new Set(((reqs?.results ?? []) as { role_id: number; course_id: number }[])
      .map((r) => `${r.role_id}:${r.course_id}`)),
  };
}

/** The whole grid is rewritten from the form: every box is on the page, so an
 *  unticked box is a deliberate no, not a missing answer. */
export async function saveGrid(db: D1Database, grid: SafeguardingGrid, form: FormData): Promise<number> {
  const insert = db.prepare(
    'INSERT INTO safeguarding_requirements (role_id, course_id) VALUES (?1, ?2)');
  const rows: D1PreparedStatement[] = [];
  for (const r of grid.roles) {
    for (const c of grid.courses) {
      if (form.get(`req_${r.id}_${c.id}`)) rows.push(insert.bind(r.id, c.id));
    }
  }
  await db.batch([db.prepare('DELETE FROM safeguarding_requirements'), ...rows]);
  return rows.length;
}

/** The courses somebody holding these roles needs, in the grid's order. */
export function coursesFor(grid: SafeguardingGrid, roleIds: number[]) {
  return grid.courses.filter((c) => roleIds.some((r) => grid.requires.has(`${r}:${c.id}`)));
}

export async function loadPerson(db: D1Database, personId: number): Promise<PersonSafeguarding> {
  const [roles, courses] = await db.batch([
    db.prepare('SELECT role_id FROM person_safeguarding_roles WHERE person_id = ?1').bind(personId),
    db.prepare('SELECT course_id, done, done_at FROM person_courses WHERE person_id = ?1').bind(personId),
  ]);
  return {
    roleIds: ((roles?.results ?? []) as { role_id: number }[]).map((r) => r.role_id),
    courses: new Map(((courses?.results ?? []) as { course_id: number; done: number; done_at: string | null }[])
      .map((c) => [c.course_id, { done: c.done, done_at: c.done_at }])),
  };
}

/**
 * Saves the Safeguarding box on a person's record.
 *
 * Only courses actually answered are written — a Yes/No left untouched stays
 * "nobody has said", which is different from "no" and matters when somebody
 * asks who still needs chasing.
 */
export async function savePerson(
  db: D1Database,
  personId: number,
  grid: SafeguardingGrid,
  form: FormData,
): Promise<void> {
  const roleIds = grid.roles.filter((r) => form.get(`sg_role_${r.id}`)).map((r) => r.id);
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM person_safeguarding_roles WHERE person_id = ?1').bind(personId),
    ...roleIds.map((r) => db.prepare(
      'INSERT INTO person_safeguarding_roles (person_id, role_id) VALUES (?1, ?2)').bind(personId, r)),
  ];
  for (const c of grid.courses) {
    const v = String(form.get(`sg_course_${c.id}`) ?? '');
    if (v !== '1' && v !== '0') continue;
    stmts.push(db.prepare(
      `INSERT INTO person_courses (person_id, course_id, done, done_at, updated_at)
       VALUES (?1, ?2, ?3, CASE WHEN ?3 = 1 THEN datetime('now') END, datetime('now'))
       ON CONFLICT (person_id, course_id) DO UPDATE SET
         done = excluded.done,
         -- Kept from the first yes, so saving the page again does not move it.
         done_at = CASE
           WHEN excluded.done = 0 THEN NULL
           WHEN person_courses.done = 1 THEN person_courses.done_at
           ELSE datetime('now')
         END,
         updated_at = datetime('now')`,
    ).bind(personId, c.id, Number(v)));
  }
  await db.batch(stmts);
}

// ---------------------------------------------------------------------------
// The report: who has done what
// ---------------------------------------------------------------------------

export type CourseState = 'done' | 'not_yet' | 'unanswered';

export interface ReportRow {
  personId: number;
  name: string;
  roles: string[];
  /** Only the courses this person's roles need, in the grid's order. */
  courses: { courseId: number; name: string; state: CourseState; doneAt: string | null }[];
}

/**
 * Everybody currently serving who holds a safeguarding role, with each course
 * their roles need and where it stands.
 *
 * "Not yet" and "not answered" are kept apart on purpose: one is a known gap,
 * the other is a question nobody has asked them. Both are still to do, but
 * they are chased differently.
 */
export async function loadReport(db: D1Database, grid: SafeguardingGrid): Promise<ReportRow[]> {
  const [holders, done] = await db.batch([
    db.prepare(
      `SELECT p.id, p.display_name, psr.role_id
         FROM person_safeguarding_roles psr JOIN people p ON p.id = psr.person_id
        WHERE p.is_active = 1
        ORDER BY p.display_name`,
    ),
    db.prepare(
      `SELECT pc.person_id, pc.course_id, pc.done, pc.done_at
         FROM person_courses pc JOIN people p ON p.id = pc.person_id
        WHERE p.is_active = 1`,
    ),
  ]);

  const people = new Map<number, { name: string; roleIds: number[] }>();
  for (const h of (holders?.results ?? []) as { id: number; display_name: string; role_id: number }[]) {
    const p = people.get(h.id) ?? { name: h.display_name, roleIds: [] };
    p.roleIds.push(h.role_id);
    people.set(h.id, p);
  }
  const answers = new Map<string, { done: number; done_at: string | null }>();
  for (const d of (done?.results ?? []) as { person_id: number; course_id: number; done: number; done_at: string | null }[]) {
    answers.set(`${d.person_id}:${d.course_id}`, { done: d.done, done_at: d.done_at });
  }

  return [...people.entries()].map(([personId, p]) => ({
    personId,
    name: p.name,
    roles: grid.roles.filter((r) => p.roleIds.includes(r.id)).map((r) => r.name),
    courses: coursesFor(grid, p.roleIds).map((c) => {
      const a = answers.get(`${personId}:${c.id}`);
      return {
        courseId: c.id,
        name: c.name,
        state: !a ? 'unanswered' as const : a.done ? 'done' as const : 'not_yet' as const,
        doneAt: a?.done ? a.done_at : null,
      };
    }),
  }));
}

/** The courses anybody in the report needs, in the grid's order — the report's
 *  columns. A course no role needs is left off rather than shown as a column
 *  of dashes. */
export function reportCourses(grid: SafeguardingGrid, rows: ReportRow[]) {
  const used = new Set(rows.flatMap((r) => r.courses.map((c) => c.courseId)));
  return grid.courses.filter((c) => used.has(c.id));
}

export const STATE_LABEL: Record<CourseState, string> = {
  done: 'Done',
  not_yet: 'Not yet',
  unanswered: 'Not answered',
};
