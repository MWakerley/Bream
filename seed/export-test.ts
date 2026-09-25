/**
 * Builds the rota exports from fixture data and writes them out, so the files
 * can be opened and checked by eye as well as by the assertions here.
 *
 *   npm run test:export  [outDir]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { rotaXlsx, rotaPdf } from '../src/export/rota.js';
import { zipStored } from '../src/export/xlsx.js';
import { attendeesXlsx, attendeesPdf } from '../src/export/attendees.js';

const out = process.argv[2] ?? '.export-test';
mkdirSync(out, { recursive: true });

const ROLE_NAMES = ['Preacher', 'Service leader', 'Reader', 'Worship leader', 'Welcome team',
  'Communion preside', 'Communion distribution', 'Steward', 'Tea and coffee', 'Prayer ministry',
  'Computer', 'Sound desk', 'Children: Rec to Yr 5 (4-10yr)', 'Children: Yr 6+ (10-14yr)'];
const roles = ROLE_NAMES.map((name, i) => ({
  id: i + 1, key: name, name, sheet_heading: name, sort_order: i, min_needed: 1, ideal_needed: 1,
  communion_only: name.startsWith('Communion') ? 1 : 0, is_active: 1, is_critical: i < 2 ? 1 : 0,
  default_min_gap_days: null, default_target_days: null,
}));
const NAMES = ['Sue N', 'Robert', 'Dave', 'Steve', 'Andy', 'Don', 'Jean', 'Lou', 'Barry', 'Annie',
  'Iain', 'Shirley D', 'Glenn', 'Matt W', 'Chris L', 'Zoë', 'Seán'];

const services = Array.from({ length: 14 }, (_, n) => {
  const d = new Date(Date.UTC(2026, 9, 4 + n * 7)).toISOString().slice(0, 10);
  const communion = n % 2 === 0;
  return {
    id: n + 1, service_date: d, service_time: '10:30',
    title: communion ? 'Holy Communion' : 'Worship', location: null, is_communion: communion ? 1 : 0,
    readings: n % 3 ? 'Luke 15:1-10; 1 Timothy 1:12-17' : null,
    sermon_title: n % 4 ? null : 'The lost sheep',
    notApplicable: [],
    roles: roles.filter((r) => communion || !r.communion_only).map((r) => ({
      role_id: r.id, role_name: r.name, min_needed: 1, ideal_needed: 1, is_critical: r.is_critical,
      people: (n + r.id) % 7 === 0 ? [] : Array.from({ length: r.id === 3 ? 2 : 1 }, (_, k) => ({
        assignment_id: 0, person_id: 0, status: 'confirmed', on_break: 0, is_guest: 0,
        display_name: NAMES[(n * 3 + r.id + k) % NAMES.length]!,
      })),
    })),
  };
});

let failures = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}`);
  if (!cond) failures++;
};

const xlsx = rotaXlsx(services, roles);
writeFileSync(`${out}/rota.xlsx`, xlsx);
ok('the xlsx is a zip', xlsx[0] === 0x50 && xlsx[1] === 0x4b);
const text = new TextDecoder().decode(xlsx);
ok('with a sheet in it', text.includes('xl/worksheets/sheet1.xml'));
ok('naming the roles as columns', text.includes('Service leader') && text.includes('Prayer ministry'));
ok('and a dash where a role is not needed', text.includes('>—<'));
ok('and accented names intact', text.includes('Zoë'));

const pdf = await rotaPdf(services, roles);
writeFileSync(`${out}/rota.pdf`, pdf);
ok('the pdf is a pdf', new TextDecoder().decode(pdf.slice(0, 5)) === '%PDF-');
ok('of a sensible size', pdf.length > 2000 && pdf.length < 500_000);

const empty = await rotaPdf([], roles);
ok('an empty range still makes a pdf', new TextDecoder().decode(empty.slice(0, 5)) === '%PDF-');

// ---- an event's attendees -------------------------------------------------
const EVENT = {
  id: 1, slug: 'harvest-supper', title: 'Harvest Supper', description: null,
  starts_at: '2026-10-10T19:00', ends_at: '2026-10-10T21:30', location: 'Church Centre',
  capacity: 60, booking_closes_at: null, is_published: 1, ask_email: 1, ask_phone: 1,
  poster_key: null, send_ack: 0, ack_subject: null, ack_body: null, notify_organisers: 0,
  max_per_booking: 10, booked: 7, bookings: 3,
};
const FIELDS = [
  { id: 5, event_id: 1, key: 'main', label: 'Main course', hint: null, kind: 'select' as const,
    options: '["Beef","Vegetarian"]', required: 1, sort_order: 10 },
  { id: 6, event_id: 1, key: 'allergies', label: 'Any allergies?', hint: null, kind: 'textarea' as const,
    options: null, required: 0, sort_order: 20 },
];
const BOOKINGS = [
  { id: 1, name: 'Sue Baker', email: 'sue@example.org', phone: '01594 111111', party_size: 4,
    status: 'booked', created_at: '2026-09-10 11:00:00', answers: { '5': 'Beef', '6': 'Nuts' } },
  { id: 2, name: 'Seán Ó Briain', email: null, phone: '01594 222222', party_size: 3,
    status: 'booked', created_at: '2026-09-11 11:00:00', answers: { '5': 'Vegetarian' } },
  { id: 3, name: 'John Hale', email: 'john@example.org', phone: null, party_size: 2,
    status: 'cancelled', created_at: '2026-09-12 11:00:00', answers: {} },
  { id: 4, name: 'Wendy Wait', email: 'wendy@example.org', phone: null, party_size: 2,
    status: 'waitlist', created_at: '2026-09-13 11:00:00', answers: { '5': 'Beef' } },
];
const ax = attendeesXlsx(EVENT, FIELDS, BOOKINGS);
writeFileSync(`${out}/attendees.xlsx`, ax);
const axText = new TextDecoder().decode(ax);
ok('the attendee workbook has three sheets', axText.includes('xl/worksheets/sheet3.xml'));
ok('with the answers as columns', axText.includes('Any allergies?') && axText.includes('Nuts'));
const ap = await attendeesPdf(EVENT, FIELDS, BOOKINGS);
writeFileSync(`${out}/attendees.pdf`, ap);
ok('the attendee pdf is a pdf', new TextDecoder().decode(ap.slice(0, 5)) === '%PDF-');

// The zip must be readable by something other than itself.
const z = zipStored([['a.txt', new TextEncoder().encode('hello')]]);
writeFileSync(`${out}/probe.zip`, z);
ok('zip end record present', new DataView(z.buffer).getUint32(z.length - 22, true) === 0x06054b50);

console.log(failures ? `\n${failures} FAILURES` : '\nExports OK.');
if (failures) process.exit(1);
