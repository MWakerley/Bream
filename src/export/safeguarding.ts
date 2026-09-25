import { formatDate } from '../views/rota.js';
import { reportCourses, STATE_LABEL, type ReportRow, type SafeguardingGrid } from '../safeguarding.js';
import { buildXlsx } from './xlsx.js';
import { buildPdf, type PdfTable } from './pdf.js';

/**
 * The safeguarding report, for the safeguarding officer or the PCC.
 *
 * Two views of the same facts, as on the page: everyone course by course, and
 * for each course who still has it to do.
 */

const cellFor = (r: ReportRow, courseId: number) => {
  const c = r.courses.find((x) => x.courseId === courseId);
  if (!c) return '—';
  return c.state === 'done' && c.doneAt
    ? `Done ${formatDate(c.doneAt.slice(0, 10))}`
    : STATE_LABEL[c.state];
};

const toDo = (grid: SafeguardingGrid, rows: ReportRow[]) =>
  reportCourses(grid, rows).flatMap((c) => rows.flatMap((r) => r.courses
    .filter((x) => x.courseId === c.id && x.state !== 'done')
    .map((x) => ({ course: c.name, name: r.name, roles: r.roles.join(', '), state: STATE_LABEL[x.state] }))));

export function safeguardingXlsx(grid: SafeguardingGrid, rows: ReportRow[], printed: string): Uint8Array {
  const courses = reportCourses(grid, rows);
  const todo = toDo(grid, rows);
  return buildXlsx([
    {
      name: 'Everyone',
      title: `Safeguarding — who has done what (${formatDate(printed)})`,
      columns: [
        { header: 'Person', width: 22 }, { header: 'Roles', width: 30 },
        ...courses.map((c) => ({ header: c.name, width: Math.max(14, Math.min(24, c.name.length + 2)) })),
      ],
      rows: rows.map((r) => [r.name, r.roles.join(', '), ...courses.map((c) => cellFor(r, c.id))]),
      highlight: new Set(rows.map((r, i) => (r.courses.some((c) => c.state !== 'done') ? i : -1)).filter((i) => i >= 0)),
    },
    {
      name: 'Still to do',
      title: `Safeguarding — still to do (${todo.length})`,
      columns: [
        { header: 'Course', width: 30 }, { header: 'Person', width: 22 },
        { header: 'Roles', width: 30 }, { header: 'Where it stands', width: 16 },
      ],
      rows: todo.map((t) => [t.course, t.name, t.roles, t.state]),
    },
  ]);
}

export async function safeguardingPdf(grid: SafeguardingGrid, rows: ReportRow[], printed: string): Promise<Uint8Array> {
  const courses = reportCourses(grid, rows);
  const todo = toDo(grid, rows);
  const everyone: PdfTable = {
    heading: 'Everyone, course by course',
    columns: [{ header: 'Person', weight: 1.7 }, ...courses.map((c) => ({ header: c.name, weight: 1 }))],
    bold: new Set([0]),
    rows: rows.map((r) => [`${r.name}\n${r.roles.join(', ')}`, ...courses.map((c) => cellFor(r, c.id))]),
    highlight: new Set(rows.map((r, i) => (r.courses.some((c) => c.state !== 'done') ? i : -1)).filter((i) => i >= 0)),
  };
  const still: PdfTable = {
    heading: `Still to do — ${todo.length}`,
    columns: [
      { header: 'Course', weight: 1.6 }, { header: 'Person', weight: 1.2 },
      { header: 'Roles', weight: 1.8 }, { header: 'Where it stands', weight: 0.9 },
    ],
    bold: new Set([0]),
    rows: todo.length ? todo.map((t) => [t.course, t.name, t.roles, t.state]) : [['Nothing — everyone is up to date', '', '', '']],
  };
  return buildPdf({
    title: 'Safeguarding — who has done what',
    subtitle: `${rows.length} people with a safeguarding role  ·  as at ${formatDate(printed)}`,
    landscape: courses.length > 4,
    tables: [everyone, still],
    footnote: 'A dash means the person\'s roles do not need that course. "Not answered" means '
      + 'nobody has recorded either way. Shaded rows have something still to do. This report '
      + 'names individuals — please keep it safe.',
  });
}
