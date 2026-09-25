/**
 * Builds the rota exports from fixture data and writes them out, so the files
 * can be opened and checked by eye as well as by the assertions here.
 *
 *   npm run test:export  [outDir]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { rotaXlsx, rotaPdf } from '../src/export/rota.js';
import { zipStored } from '../src/export/xlsx.js';

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

// The zip must be readable by something other than itself.
const z = zipStored([['a.txt', new TextEncoder().encode('hello')]]);
writeFileSync(`${out}/probe.zip`, z);
ok('zip end record present', new DataView(z.buffer).getUint32(z.length - 22, true) === 0x06054b50);

console.log(failures ? `\n${failures} FAILURES` : '\nExports OK.');
if (failures) process.exit(1);
