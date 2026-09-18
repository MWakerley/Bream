// Generates migrations/0004_import_rota.sql — the church's actual September to
// November 2026 rota, lifted out of the spreadsheet.
//
//   node seed/build-rota-import.cjs
//
// Why the year is 2026 and not what the tab says: the tab is labelled
// "January-March 2025" but its dates are text without a year ("6th Sept"), and
// all thirteen of them fall on a Sunday in 2026 and on a Saturday in 2025. The
// filename agrees. The tab name is simply stale.
const ExcelJS = require('exceljs');
const fs = require('fs');

const SRC = 'C:/Users/waker/Downloads/September-November 2026.xlsx';
const OUT = __dirname + '/../migrations/0004_import_rota.sql';
const YEAR = 2026;

const ROLE_MAP = {
  Preside: 'communion_preside', Preacher: 'preacher', Leader: 'service_leader',
  'Communion distribution': 'communion_distribution', Steward: 'steward', Readers: 'reader',
  Music: 'worship_leader', Laptop: 'computer', Sound: 'sound_desk',
  'Kids Church': 'children_rec_yr5', 'Rec - Yr 5 (4yr-10yr)': 'children_rec_yr5',
  'Younger Youth': 'children_yr6_14', 'Yr 6 + 10-14yrs': 'children_yr6_14',
  'Prayer Ministry': 'prayer_ministry', 'Tea/Coffee': 'tea_coffee', Welcome: 'welcome_team',
};

// Cells that describe an arrangement rather than naming anyone. Each maps to a
// service_role_override rather than being silently dropped, so "no children's
// work on Christmas Eve" is recorded as a fact instead of showing up forever as
// an unfilled role.
const NOT_APPLICABLE = [/^n\/?a$/i, /^none$/i, /kids in service/i, /half term/i];
const SELF_SERVE = [/self.?serve/i, /^ad hoc$/i];
const NOT_A_PERSON = [
  /worship lyrics/i, /^sheets$/i, /mulled/i, /silver band/i, /^tbc$/i, /^`$/,
  // The Remembrance row puts the VENUE in the Preside column, which otherwise
  // parses as two people called "Bream" and "Cenotaph". They would match nobody
  // and insert nothing, but the import count would quietly overstate itself.
  /cenotaph/i, /whitemead/i,
  ...NOT_APPLICABLE, ...SELF_SERVE,
];
const STOP = new Set(['in', 'the', 'and', '&', 'service', 'half', 'term', 'kids', 'worship',
  'lyrics', 'sheets', 'wine', 'drinks', 'pies', 'silver', 'band', 'mulled', 'parkend',
  'whitemead', 'na', 'none', 'ad', 'hoc', 'tbc', 'self', 'serve', 'n/a']);
const KNOWN_SURNAMES = new Set(['Ewens', 'Pembry']);

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const q = (x) => (x == null ? 'NULL' : "'" + String(x).replace(/'/g, "''") + "'");

function parsePeople(cell) {
  if (NOT_A_PERSON.some((re) => re.test(cell))) return [];
  const toks = cell.replace(/[?,]/g, '').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    let n = toks[i].replace(/\/$/, '');
    if (STOP.has(n.toLowerCase())) continue;
    const nxt = toks[i + 1];
    if (nxt && ((/^[A-Z]\.?$/.test(nxt) && nxt.length <= 2) || KNOWN_SURNAMES.has(nxt.replace(/\/$/, '')))) {
      n += ' ' + nxt.replace(/\/$/, ''); i++;
    }
    if (n.length >= 2 && /^[A-Z]/.test(n)) out.push(n);
  }
  return out;
}

/** '6th Sept' / '13th Sept' -> '2026-09-06'. Returns null for anything else. */
function parseDate(text) {
  const m = String(text).match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*([A-Za-z]{3,})/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mon || !day) return null;
  return `${YEAR}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** '10:30', '18.00', '3.00' -> 'HH:MM'. The sheet mixes separators and, for the
 *  afternoon Remembrance service, drops the 24-hour convention entirely. */
function parseTime(text) {
  const s = String(text).trim();
  const m = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = m[2];
  // '3.00' for the Remembrance service means 15:00 — nothing at this church
  // happens at 3am, and a lone 1-2 digit hour below 8 is always an afternoon.
  if (h < 8) h += 12;
  return `${String(h).padStart(2, '0')}:${mi}`;
}

function serviceTypeFor(title) {
  const t = title.toLowerCase();
  if (t.includes('holy communion') || t.includes('communion')) return 'Holy Communion';
  if (t.includes('lift')) return 'LIFT';
  if (t.includes('messy')) return 'Messy Church';
  if (t.includes('carol')) return 'Carol service';
  if (t.includes('worship')) return 'Worship';
  return 'Other';
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);

  // The Sept-Nov rota is the sheet whose date column is TEXT ('6th Sept'); the
  // other sheets carry real Date values and are older material.
  const sheet = wb.worksheets.find((ws) => {
    for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
      const v = ws.getRow(r).getCell(1).value;
      if (typeof v === 'string' && parseDate(v)) return true;
    }
    return false;
  });
  if (!sheet) throw new Error('Could not find the Sept-Nov sheet');

  const services = [];
  let hdr = null;
  let lastDate = null;

  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      let v = row.getCell(c).value;
      if (v && typeof v === 'object') {
        v = v.text ?? v.result ?? (v.richText ? v.richText.map((t) => t.text).join('') : '');
      }
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      cells.push(v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
    }
    if (cells[0] === 'Date' && cells[1] === 'Time') { hdr = cells; continue; }
    if (!hdr) continue;

    const d = parseDate(cells[0]);
    if (d) lastDate = d;
    const time = parseTime(cells[1]);
    // A row with no usable time is a spacer, not a service.
    if (!lastDate || !time) continue;

    const title = cells[2] || 'Worship';
    const type = serviceTypeFor(title);
    const svc = {
      date: lastDate, time, type, title,
      isCommunion: type === 'Holy Communion' ? 1 : 0,
      readings: null, location: null,
      assignments: [], overrides: [],
    };
    // The Remembrance service is not in the church building.
    if (/cenotaph/i.test(cells.join(' '))) svc.location = 'Bream Cenotaph';

    for (let c = 0; c < cells.length; c++) {
      const heading = hdr[c];
      const cell = cells[c];
      if (!cell) continue;
      if (heading === 'Readings') { svc.readings = cell; continue; }
      const roleKey = ROLE_MAP[heading];
      if (!roleKey) continue;

      if (NOT_APPLICABLE.some((re) => re.test(cell))) {
        svc.overrides.push({ roleKey, applies: 0, note: cell });
        continue;
      }
      if (SELF_SERVE.some((re) => re.test(cell))) {
        svc.overrides.push({ roleKey, applies: 0, note: cell });
        continue;
      }
      const people = parsePeople(cell);
      people.forEach((name, i) => svc.assignments.push({ roleKey, name, slot: i + 1 }));
    }
    services.push(svc);
  }

  // ---- emit SQL ----------------------------------------------------------
  const L = [];
  L.push('-- The church\'s actual rota for September to November 2026, imported from');
  L.push('-- "September-November 2026.xlsx" by seed/build-rota-import.cjs.');
  L.push('--');
  L.push('-- Assignments are inserted as CONFIRMED: this is the rota the church is already');
  L.push('-- running, not a draft the system produced. Any name the importer could not match');
  L.push('-- to a person is simply not inserted, which shows up as a gap on the dashboard —');
  L.push('-- honest, and visible, rather than quietly dropped.');
  L.push('');

  for (const s of services) {
    L.push(`-- ${s.date} ${s.time} — ${s.title}`);
    L.push(
      'INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion, readings)\n' +
      `SELECT ${q(s.date)}, ${q(s.time)}, st.id, ${q(s.title)}, ${q(s.location)}, ${s.isCommunion}, ${q(s.readings)}\n` +
      `  FROM service_types st WHERE st.name = ${q(s.type)};`);

    for (const o of s.overrides) {
      L.push(
        'INSERT OR IGNORE INTO service_role_overrides (service_id, role_id, applies, note)\n' +
        `SELECT s.id, r.id, ${o.applies}, ${q(o.note)}\n` +
        `  FROM services s, roles r\n` +
        ` WHERE s.service_date = ${q(s.date)} AND s.service_time = ${q(s.time)} AND r.key = ${q(o.roleKey)};`);
    }
    for (const a of s.assignments) {
      L.push(
        'INSERT OR IGNORE INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)\n' +
        `SELECT s.id, r.id, ${a.slot}, p.id, 'confirmed', 0, 'Imported from the Sept-Nov 2026 spreadsheet'\n` +
        `  FROM services s, roles r, people p\n` +
        ` WHERE s.service_date = ${q(s.date)} AND s.service_time = ${q(s.time)}\n` +
        `   AND r.key = ${q(a.roleKey)} AND p.display_name = ${q(a.name)};`);
    }
    L.push('');
  }

  fs.writeFileSync(OUT, L.join('\n'));

  const nAssign = services.reduce((n, s) => n + s.assignments.length, 0);
  const nOver = services.reduce((n, s) => n + s.overrides.length, 0);
  console.log(`sheet: "${sheet.name}"`);
  console.log(`services ${services.length} | assignments ${nAssign} | overrides ${nOver}`);
  console.log('\ndates:');
  for (const s of services) {
    console.log(`  ${s.date} ${s.time}  ${String(s.title).padEnd(34)} ${s.assignments.length} people` +
      (s.overrides.length ? `, ${s.overrides.length} n/a` : '') +
      (s.location ? `  @${s.location}` : ''));
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
