import type { BookingRow, EventRow, FieldRow } from '../views/events.js';
import { formatDate } from '../views/rota.js';
import { buildXlsx, type Sheet } from './xlsx.js';
import { buildPdf, type PdfTable } from './pdf.js';

/**
 * An event's list of who is coming, for sending to the organisers.
 *
 * The PDF is the list somebody holds at the door, so it has the people coming
 * and the waiting list and nothing else. The Excel file is for working with,
 * so it also carries the cancellations on a sheet of their own — the "were
 * they ever on the list?" question gets asked of the spreadsheet, not the door.
 */

const LISTS = [
  { status: 'booked', label: 'Coming' },
  { status: 'waitlist', label: 'Waiting list' },
  { status: 'cancelled', label: 'Cancelled' },
] as const;

function headline(e: EventRow): string {
  return [
    `${formatDate(e.starts_at.slice(0, 10))} at ${e.starts_at.slice(11, 16)}`
      + (e.ends_at ? `–${e.ends_at.slice(11, 16)}` : ''),
    e.location,
    `${e.booked} coming${e.capacity != null ? ` of ${e.capacity}` : ''}`,
  ].filter(Boolean).join('  ·  ');
}

const rowFor = (b: BookingRow, fields: FieldRow[]) => [
  b.name, String(b.party_size), b.email ?? '', b.phone ?? '',
  ...fields.map((f) => b.answers[String(f.id)] ?? ''),
  b.created_at.slice(0, 10),
];

export function attendeesXlsx(e: EventRow, fields: FieldRow[], bookings: BookingRow[]): Uint8Array {
  const sheets: Sheet[] = LISTS.map((l) => {
    const rows = bookings.filter((b) => b.status === l.status);
    return {
      name: l.label,
      title: `${e.title} — ${l.label.toLowerCase()} (${rows.reduce((n, b) => n + b.party_size, 0)} people)`,
      columns: [
        { header: 'Name', width: 24 }, { header: 'Places', width: 8 },
        { header: 'Email', width: 28 }, { header: 'Phone', width: 16 },
        ...fields.map((f) => ({ header: f.label, width: Math.max(14, Math.min(40, f.label.length + 4)) })),
        { header: 'Booked on', width: 12 },
      ],
      rows: rows.map((b) => rowFor(b, fields)),
    };
  });
  return buildXlsx(sheets);
}

export async function attendeesPdf(e: EventRow, fields: FieldRow[], bookings: BookingRow[]): Promise<Uint8Array> {
  const tables: PdfTable[] = [];
  for (const l of LISTS.slice(0, 2)) {
    const rows = bookings.filter((b) => b.status === l.status);
    if (!rows.length && l.status !== 'booked') continue;
    const people = rows.reduce((n, b) => n + b.party_size, 0);
    tables.push({
      heading: `${l.label} — ${rows.length} booking${rows.length === 1 ? '' : 's'}, ${people} ${people === 1 ? 'person' : 'people'}`,
      columns: [
        { header: 'Name', weight: 1.6 }, { header: 'Places', weight: 0.55 },
        { header: 'Contact', weight: 1.9 },
        ...fields.map((f) => ({ header: f.label, weight: 1.3 })),
      ],
      bold: new Set([0]),
      rows: rows.length
        ? rows.map((b) => [
            b.name, String(b.party_size), [b.email, b.phone].filter(Boolean).join('\n'),
            ...fields.map((f) => b.answers[String(f.id)] ?? ''),
          ])
        : [['Nobody yet', '', '', ...fields.map(() => '')]],
    });
  }
  return buildPdf({
    title: e.title,
    subtitle: headline(e),
    landscape: fields.length > 2,
    tables,
    footnote: 'This list contains people\'s contact details. Please keep it safe, and '
      + 'dispose of it once the event is over.',
  });
}
