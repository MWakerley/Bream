// Checks the UTC -> Europe/London conversion the import depends on.
//
// 874 of the calendar's events are stored in UTC. If the conversion used a fixed
// offset instead of the tz database, every booking between late March and late
// October would be an hour out — the sort of error nobody spots until somebody
// turns up to a locked building.
const fs = require('fs');

const F = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function conv(s) {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const p = Object.fromEntries(F.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

let fails = 0;
function expect(utc, local, why) {
  const got = conv(utc);
  const ok = got === local;
  if (!ok) fails++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${utc} -> ${got}${ok ? '' : ` (expected ${local})`}   ${why}`);
}

console.log('DST boundaries (BST runs from the last Sunday in March to the last in October):');
// 2026: BST starts 29 March 01:00 UTC, ends 25 October 01:00 UTC.
expect('20260328T120000Z', '2026-03-28T12:00', 'day before BST starts — GMT, no shift');
expect('20260330T120000Z', '2026-03-30T13:00', 'day after BST starts — +1');
expect('20261024T120000Z', '2026-10-24T13:00', 'day before BST ends — still +1');
expect('20261026T120000Z', '2026-10-26T12:00', 'day after BST ends — back to GMT');
expect('20261225T100000Z', '2026-12-25T10:00', 'Christmas Day — GMT');
expect('20260701T183000Z', '2026-07-01T19:30', 'midsummer evening — +1');

console.log('\nMidnight rendering (en-GB renders 00:00 as 24, which must not leak):');
expect('20261225T000000Z', '2026-12-25T00:00', 'midnight GMT');

const SRC = process.argv[2];
if (SRC && fs.existsSync(SRC)) {
  console.log('\nReal events from the file, spot-checked:');
  const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
  let cur = null;
  const found = [];
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = {};
    else if (l === 'END:VEVENT') { if (cur && cur.z && cur.s) found.push(cur); cur = null; }
    else if (cur) {
      const m = l.match(/^DTSTART:(\d{8}T\d{6}Z)$/);
      if (m) cur.z = m[1];
      if (l.startsWith('SUMMARY:')) cur.s = l.slice(8);
    }
  }
  const summer = found.filter((e) => /^\d{4}0[678]/.test(e.z)).slice(0, 3);
  const winter = found.filter((e) => /^\d{4}(01|12)/.test(e.z)).slice(0, 3);
  for (const e of [...summer, ...winter]) {
    const local = conv(e.z);
    const shifted = local.slice(11) !== `${e.z.slice(9, 11)}:${e.z.slice(11, 13)}`;
    const isSummer = /^\d{4}0[678]/.test(e.z);
    const right = isSummer ? shifted : !shifted;
    if (!right) fails++;
    console.log(`  ${right ? 'ok  ' : 'FAIL'} ${e.z} -> ${local}  ${isSummer ? '(BST)' : '(GMT)'}  ${e.s}`);
  }
}

console.log(fails === 0 ? '\nTime zone handling OK.' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
