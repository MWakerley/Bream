import type { RoleRow, ServiceDetail } from '../db.js';
import { formatDate } from '../views/rota.js';
import { buildXlsx } from './xlsx.js';
import { buildPdf, type PdfTable } from './pdf.js';

/**
 * The rota for sending out: every future service, one row each, a column per
 * role — the same shape as the spreadsheet the church has always used, so
 * nobody has to learn to read it.
 *
 * A role that does not apply to a service (communion roles on a non-communion
 * Sunday, or one switched off for the day) shows a dash, so a blank always
 * means "nobody yet" and never "not needed".
 */

interface RotaGrid {
  roles: { id: number; name: string }[];
  rows: {
    date: string; time: string; title: string; readings: string;
    /** Per role, in `roles` order: names, '—' for not needed, '' for nobody yet. */
    cells: string[];
  }[];
}

function grid(services: ServiceDetail[], roles: RoleRow[]): RotaGrid {
  // Only roles that appear somewhere in the range. A role switched on but used
  // by no service in these months is a column of dashes, and a wasted one.
  const used = roles.filter((r) => services.some((s) => s.roles.some((x) => x.role_id === r.id)));
  return {
    roles: used.map((r) => ({ id: r.id, name: r.name })),
    rows: services.map((s) => ({
      date: formatDate(s.service_date),
      time: s.service_time,
      title: s.title ?? 'Worship',
      readings: [s.sermon_title, s.readings].filter(Boolean).join('\n'),
      cells: used.map((r) => {
        const here = s.roles.find((x) => x.role_id === r.id);
        if (!here) return '—';
        return here.people.map((p) => p.display_name).join('\n');
      }),
    })),
  };
}

const rangeLabel = (services: ServiceDetail[]) => services.length
  ? `${formatDate(services[0]!.service_date)} to ${formatDate(services[services.length - 1]!.service_date)}`
  : 'No services';

/** A draft is laid out exactly like the rota, and says DRAFT wherever it is
 *  looked at, so a printed copy is never mistaken for the confirmed one. */
export interface RotaExportOptions { draft?: boolean }

export function rotaXlsx(services: ServiceDetail[], roles: RoleRow[], opts: RotaExportOptions = {}): Uint8Array {
  const g = grid(services, roles);
  return buildXlsx([{
    name: opts.draft ? 'Draft rota' : 'Rota',
    title: opts.draft
      ? `DRAFT — Bream Church rota — ${rangeLabel(services)} — not yet confirmed`
      : `Bream Church rota — ${rangeLabel(services)}`,
    columns: [
      { header: 'Date', width: 16 }, { header: 'Time', width: 7 },
      { header: 'Service', width: 20 }, { header: 'Readings', width: 24 },
      ...g.roles.map((r) => ({ header: r.name, width: Math.max(12, Math.min(22, r.name.length + 2)) })),
    ],
    rows: g.rows.map((r) => [r.date, r.time, r.title, r.readings, ...r.cells]),
  }]);
}

/** Roles per printed table. Past about eight the names get too narrow to read
 *  on A4, so a long list of roles becomes two tables over the same services. */
const PER_TABLE = 8;

export async function rotaPdf(services: ServiceDetail[], roles: RoleRow[], opts: RotaExportOptions = {}): Promise<Uint8Array> {
  const g = grid(services, roles);
  const chunks: { id: number; name: string }[][] = [];
  for (let i = 0; i < g.roles.length; i += PER_TABLE) chunks.push(g.roles.slice(i, i + PER_TABLE));
  if (!chunks.length) chunks.push([]);

  const tables: PdfTable[] = chunks.map((chunk, n) => {
    const offset = n * PER_TABLE;
    const withReadings = n === 0;
    return {
      heading: chunks.length > 1 ? `Part ${n + 1} of ${chunks.length}` : undefined,
      columns: [
        { header: 'Date', weight: 1.25 },
        { header: 'Service', weight: 1.3 },
        ...(withReadings ? [{ header: 'Readings', weight: 1.5 }] : []),
        ...chunk.map((r) => ({ header: r.name, weight: 1 })),
      ],
      bold: new Set([0]),
      rows: g.rows.map((r) => [
        `${r.date}\n${r.time}`,
        r.title,
        ...(withReadings ? [r.readings] : []),
        ...chunk.map((_, i) => r.cells[offset + i] ?? ''),
      ]),
    };
  });

  return buildPdf({
    title: opts.draft ? 'DRAFT — Bream Church rota' : 'Bream Church rota',
    subtitle: opts.draft ? `${rangeLabel(services)}  ·  a draft, not yet confirmed` : rangeLabel(services),
    landscape: true,
    tables,
    footnote: (opts.draft ? 'THIS IS A DRAFT. Nothing on it is confirmed until the rota is applied. ' : '')
      + 'A dash means the role is not needed at that service; a blank means nobody is '
      + 'on it yet. If you cannot make a date, say so on the "My dates" page or tell whoever '
      + 'builds the rota as soon as you can.',
  });
}
