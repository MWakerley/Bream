// Imports the church's Google Calendar export into the room booking diary.
//
//   node seed/import-ical.cjs <path-to.ics> [--months 12] [--all-day] [--write]
//
// Without --write it only reports; nothing is generated until you ask for it.
//
// THREE THINGS THIS HAS TO GET RIGHT, each of which silently corrupts the diary
// if fudged:
//
//  1. TIME ZONES. 874 of the events are stored in UTC and 285 carry
//     TZID=Europe/London. The diary holds local wall-clock time, because a class
//     at 14:00 is at 14:00 whether or not British Summer Time is in force. So
//     the UTC ones must be converted through Europe/London — not by adding a
//     fixed offset, which would put every summer booking an hour out.
//
//  2. RECURRENCE. 199 events repeat. EXDATE removes single occurrences (493 of
//     them) and a separate VEVENT carrying RECURRENCE-ID replaces one (93).
//     Ignoring either produces bookings for meetings that were cancelled or
//     moved years ago.
//
//  3. WHAT IS ACTUALLY A BOOKING. The all-day entries are mostly staff notes —
//     "Claire back", "Steve away", "Claire Annual Leave". Loading those as
//     bookings would mark a room unavailable for the whole day and invent
//     clashes. They are skipped unless --all-day is passed, and reported either
//     way so the decision is visible rather than silent.
const fs = require('fs');

const args = process.argv.slice(2);
const SRC = args.find((a) => !a.startsWith('--'));
const MONTHS = Number((args.find((a) => a.startsWith('--months')) ?? '--months=12').split('=')[1] ?? 12);
const INCLUDE_ALL_DAY = args.includes('--all-day');
const WRITE = args.includes('--write');
const JSON_OUT = args.includes('--json');
const FROM = (args.find((a) => a.startsWith('--from')) ?? '').split('=')[1]
  ?? new Date().toISOString().slice(0, 10);

if (!SRC) { console.error('usage: import-ical.cjs <file.ics> [--months 12] [--all-day] [--write]'); process.exit(1); }

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const LONDON = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

/** A UTC instant rendered as Europe/London wall-clock 'YYYY-MM-DDTHH:MM'.
 *  Uses the platform's own tz database rather than a hand-rolled BST rule. */
function utcToLondon(d) {
  const p = Object.fromEntries(LONDON.formatToParts(d).map((x) => [x.type, x.value]));
  const hh = p.hour === '24' ? '00' : p.hour; // en-GB renders midnight as 24
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}`;
}

/** Parses an iCalendar date-time into local wall-clock plus a kind. */
function parseDt(prop, value) {
  if (/VALUE=DATE(?!-)/.test(prop)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    return m ? { kind: 'date', local: `${m[1]}-${m[2]}-${m[3]}` } : null;
  }
  const z = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (z) {
    const d = new Date(Date.UTC(+z[1], +z[2] - 1, +z[3], +z[4], +z[5], +z[6]));
    return { kind: 'time', local: utcToLondon(d) };
  }
  const l = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (l) {
    // TZID=Europe/London, or floating. Either way it is already the local time
    // somebody typed into the calendar.
    return { kind: 'time', local: `${l[1]}-${l[2]}-${l[3]}T${l[4]}:${l[5]}` };
  }
  return null;
}

const dayOf = (local) => local.slice(0, 10);
const timeOf = (local) => local.slice(11, 16);
const toUTCDate = (day) => new Date(`${day}T00:00:00Z`);
const addDays = (day, n) => new Date(toUTCDate(day).getTime() + n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** RFC 5545 line unfolding: a leading space or tab continues the previous line. */
function unfold(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    if (/^[ \t]/.test(raw) && out.length) out[out.length - 1] += raw.slice(1);
    else out.push(raw);
  }
  return out;
}

const unescape_ = (s) => s.replace(/\\n/gi, ' ').replace(/\\,/g, ',')
  .replace(/\\;/g, ';').replace(/\\\\/g, '\\').replace(/\s+/g, ' ').trim();

function parseEvents(lines) {
  const events = [];
  let cur = null;
  let depth = null; // which BEGIN block we are inside

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; depth = 'VEVENT'; continue; }
    if (line === 'BEGIN:VTIMEZONE') { depth = 'VTIMEZONE'; continue; }
    if (line === 'END:VTIMEZONE') { depth = null; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; depth = null; continue; }
    if (depth !== 'VEVENT' || !cur) continue;

    const i = line.indexOf(':');
    if (i < 0) continue;
    const prop = line.slice(0, i);
    const value = line.slice(i + 1);
    const name = prop.split(';')[0];

    switch (name) {
      case 'UID': cur.uid = value; break;
      case 'SUMMARY': cur.summary = unescape_(value); break;
      case 'LOCATION': cur.location = unescape_(value); break;
      case 'DESCRIPTION': cur.description = unescape_(value); break;
      case 'STATUS': cur.status = value; break;
      case 'DTSTART': cur.start = parseDt(prop, value); break;
      case 'DTEND': cur.end = parseDt(prop, value); break;
      case 'RRULE': cur.rrule = value; break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDt(prop, value); break;
      case 'EXDATE':
        // One EXDATE line can carry several comma-separated values.
        for (const v of value.split(',')) {
          const p = parseDt(prop, v);
          if (p) cur.exdates.push(p.local);
        }
        break;
      default: break;
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRule(rrule) {
  const r = {};
  for (const part of rrule.split(';')) {
    const [k, v] = part.split('=');
    r[k] = v;
  }
  return r;
}

/**
 * Expands one recurring event into its occurrence dates within [from, to].
 *
 * Handles the two frequencies the calendar actually uses (WEEKLY and MONTHLY)
 * with INTERVAL, BYDAY, BYMONTHDAY, UNTIL and COUNT. Anything it cannot expand
 * is reported rather than silently dropped.
 */
function expand(ev, from, to) {
  const r = parseRule(ev.rrule);
  const startDay = dayOf(ev.start.local);
  const interval = Number(r.INTERVAL ?? 1) || 1;
  const count = r.COUNT ? Number(r.COUNT) : null;
  const until = r.UNTIL ? (parseDt('', r.UNTIL) ?? parseDt('VALUE=DATE', r.UNTIL))?.local?.slice(0, 10) : null;

  const limit = until && until < to ? until : to;
  const out = [];
  let produced = 0;
  // A hard ceiling so a malformed rule cannot spin.
  const MAX = 2000;

  if (r.FREQ === 'WEEKLY') {
    const byday = (r.BYDAY ? r.BYDAY.split(',') : []).map((d) => DAYS[d.slice(-2)]).filter((n) => n != null);
    const wanted = byday.length ? byday : [toUTCDate(startDay).getUTCDay()];
    // Walk week by week from the start week, stepping INTERVAL weeks.
    const first = toUTCDate(startDay);
    const weekStart = addDays(startDay, -((first.getUTCDay() + 6) % 7)); // Monday of that week
    for (let w = 0; out.length < MAX; w++) {
      const base = addDays(weekStart, w * interval * 7);
      if (base > limit) break;
      for (const dow of wanted.slice().sort()) {
        const d = addDays(base, (dow + 6) % 7);
        if (d < startDay || d > limit) continue;
        if (count != null && produced >= count) break;
        produced++;
        if (d >= from) out.push(d);
      }
      if (count != null && produced >= count) break;
      if (w > 600) break;
    }
  } else if (r.FREQ === 'MONTHLY') {
    const nth = r.BYDAY ? r.BYDAY.match(/^(-?\d)?([A-Z]{2})$/) : null;
    const monthday = r.BYMONTHDAY ? Number(r.BYMONTHDAY) : null;
    const s = toUTCDate(startDay);
    for (let m = 0; out.length < MAX && m < 400; m++) {
      const y = s.getUTCFullYear();
      const mo = s.getUTCMonth() + m * interval;
      const year = y + Math.floor(mo / 12);
      const month = ((mo % 12) + 12) % 12;
      let d = null;
      if (monthday) {
        const dt = new Date(Date.UTC(year, month, monthday));
        if (dt.getUTCMonth() === month) d = dt.toISOString().slice(0, 10);
      } else if (nth) {
        const n = Number(nth[1] ?? 1);
        const dow = DAYS[nth[2]];
        if (n > 0) {
          const firstOfMonth = new Date(Date.UTC(year, month, 1));
          const shift = (dow - firstOfMonth.getUTCDay() + 7) % 7;
          const dt = new Date(Date.UTC(year, month, 1 + shift + (n - 1) * 7));
          if (dt.getUTCMonth() === month) d = dt.toISOString().slice(0, 10);
        } else {
          const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
          const shift = (lastOfMonth.getUTCDay() - dow + 7) % 7;
          const dt = new Date(Date.UTC(year, month + 1, 0 - shift + (n + 1) * 7));
          if (dt.getUTCMonth() === month) d = dt.toISOString().slice(0, 10);
        }
      } else {
        const dt = new Date(Date.UTC(year, month, s.getUTCDate()));
        if (dt.getUTCMonth() === month) d = dt.toISOString().slice(0, 10);
      }
      if (!d) continue;
      if (d > limit) break;
      if (d < startDay) continue;
      if (count != null && produced >= count) break;
      produced++;
      if (d >= from) out.push(d);
    }
  } else {
    return { dates: [], unsupported: r.FREQ ?? 'unknown' };
  }
  return { dates: out, unsupported: null };
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/**
 * Pulls a time out of an all-day entry's title.
 *
 * Whoever keeps this calendar often creates an all-day entry and writes the time
 * into the title instead — "Carols at Whitemead 6pm", "School Harvest Festival
 * 9.30", "10.30am Family Nativity & Christingle". Taking that at face value and
 * booking the room for the whole day would be wrong twice over: it blocks the
 * room for twelve hours it does not need, and it hides the time somebody
 * actually wrote down.
 *
 * Returns 'HH:MM' or null. Deliberately conservative — a bare number with no
 * am/pm and no minutes is ignored, because "Alpha 3" is a course week, not 3pm.
 */
function timeFromTitle(title) {
  const t = (title ?? '').toLowerCase();
  // 6pm · 7.30pm · 9:30am · 10.30 am
  let m = t.match(/\b(\d{1,2})[.:]?(\d{2})?\s*(am|pm)\b/);
  if (m) {
    let h = Number(m[1]);
    const mins = m[2] ?? '00';
    if (h === 12) h = m[3] === 'am' ? 0 : 12;
    else if (m[3] === 'pm') h += 12;
    if (h < 24 && Number(mins) < 60) return `${String(h).padStart(2, '0')}:${mins}`;
  }
  // 9.30 · 12.00 · 14:00 — minutes required, so a bare "3" is not a time
  m = t.match(/\b(\d{1,2})[.:](\d{2})\b/);
  if (m) {
    const h = Number(m[1]);
    const mins = Number(m[2]);
    if (h < 24 && mins < 60) {
      // A church event written as "9.30" means the morning; "6.30" in the
      // evening would have been written "6.30pm". Below 8 with no am/pm is
      // ambiguous, so leave it alone rather than guess.
      if (h >= 8) return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Which room an entry belongs to.
 *
 * The building, as the church describes it: the Church Centre has a downstairs
 * hall, and UPSTAIRS IN THE CHURCH CENTRE IS THE SOFA ROOM AND THE PRAYER ROOM.
 * So "upstairs" is not the Centre's hall — it is one of those two — which also
 * explains why the calendar happily runs two things at the same time.
 *
 * A named room in the title wins. "Downstairs" is the Centre's hall. A bare
 * "upstairs" is genuinely ambiguous between the two upstairs rooms, so it is
 * NOT guessed: it returns the Centre with a flag, and the import reports it for
 * a human to place. Guessing would put a booking in a room that is then shown as
 * free when it is not.
 */
function roomFor(text) {
  const t = (text ?? '').toLowerCase();
  if (/\bprayer\s*room\b/.test(t)) return { room: 'Prayer room', ambiguous: false };
  if (/\bsofa\s*room\b/.test(t)) return { room: 'Sofa room', ambiguous: false };
  if (/\bupstairs\b/.test(t)) return { room: 'Church Centre', ambiguous: true };
  if (/\bdownstairs\b/.test(t)) return { room: 'Church Centre', ambiguous: false };
  if (/\b(in|at)\s+church\b|\bmain church\b|\bchurchyard\b/.test(t)) {
    return { room: 'Main church', ambiguous: false };
  }
  return { room: 'Church Centre', ambiguous: false };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const lines = unfold(fs.readFileSync(SRC, 'utf8'));
const all = parseEvents(lines);
const TO = addDays(FROM, Math.round(MONTHS * 30.44));

const base = all.filter((e) => !e.recurrenceId);
const overrides = all.filter((e) => e.recurrenceId);

// An override replaces one occurrence of its series, keyed by uid + original day.
const overrideBy = new Map();
for (const o of overrides) overrideBy.set(`${o.uid}|${dayOf(o.recurrenceId.local)}`, o);

const bookings = [];
const skipped = { allDay: [], timedFromTitle: [], upstairs: [], cancelled: 0, noTime: 0, past: 0, unsupported: [] };

function durationMinutes(ev) {
  if (!ev.end || ev.start.kind !== 'time' || ev.end.kind !== 'time') return 60;
  const a = new Date(`${ev.start.local}:00Z`).getTime();
  const b = new Date(`${ev.end.local}:00Z`).getTime();
  const mins = Math.round((b - a) / 60000);
  return mins > 0 ? mins : 60;
}

function emit(ev, day, sourceEv) {
  const e = sourceEv ?? ev;
  const startTime = timeOf(e.start.local);
  const mins = durationMinutes(e);
  const startMs = new Date(`${day}T${startTime}:00Z`).getTime();
  const endDt = new Date(startMs + mins * 60000);
  const endDay = endDt.toISOString().slice(0, 10);
  const endTime = endDt.toISOString().slice(11, 16);
  // A booking that runs past midnight is clamped: the diary is a day-grid and a
  // 23:00-01:00 row would vanish from both days.
  const ends = endDay === day ? `${day}T${endTime}` : `${day}T23:59`;
  const place = roomFor(`${e.summary ?? ''} ${e.location ?? ''}`);
  if (place.ambiguous) skipped.upstairs.push({ day, summary: e.summary });
  bookings.push({
    room: place.room,
    title: e.summary || '(no title)',
    starts_at: `${day}T${startTime}`,
    ends_at: ends,
    notes: [
      place.ambiguous ? 'says "upstairs" — sofa room or prayer room, needs picking' : null,
      e.location && !/church cent/i.test(e.location) ? e.location : null,
    ].filter(Boolean).join('; ') || null,
    uid: e.uid,
  });
}

for (const ev of base) {
  if (!ev.start) { skipped.noTime++; continue; }
  if (ev.status === 'CANCELLED') { skipped.cancelled++; continue; }

  if (ev.start.kind === 'date') {
    const day = dayOf(ev.start.local);
    if (day < FROM || day > TO) { skipped.past++; continue; }

    // Many of these are real events with the time written into the title. Use it
    // where it is there; only fall back to a whole-day block when it is not.
    const t = timeFromTitle(ev.summary);
    if (t) {
      const endMs = new Date(`${day}T${t}:00Z`).getTime() + 90 * 60000;
      const endDt = new Date(endMs);
      const ends = endDt.toISOString().slice(0, 10) === day
        ? `${day}T${endDt.toISOString().slice(11, 16)}`
        : `${day}T23:59`;
      bookings.push({
        room: roomFor(`${ev.summary ?? ''} ${ev.location ?? ''}`).room,
        title: ev.summary || '(no title)',
        starts_at: `${day}T${t}`,
        ends_at: ends,
        notes: 'time read from the title; length assumed 90 minutes',
        uid: ev.uid,
      });
      skipped.timedFromTitle.push({ day, summary: ev.summary, time: t });
      continue;
    }

    skipped.allDay.push({ day, summary: ev.summary });
    if (INCLUDE_ALL_DAY) {
      bookings.push({
        room: roomFor(`${ev.summary ?? ''} ${ev.location ?? ''}`).room,
        title: ev.summary || '(no title)',
        starts_at: `${day}T00:00`,
        ends_at: `${day}T23:59`,
        notes: 'all-day entry from the calendar',
        uid: ev.uid,
      });
    }
    continue;
  }

  if (ev.rrule) {
    const { dates, unsupported } = expand(ev, FROM, TO);
    if (unsupported) { skipped.unsupported.push(`${ev.summary}: FREQ=${unsupported}`); continue; }
    for (const day of dates) {
      if (ev.exdates.some((x) => dayOf(x) === day)) continue; // cancelled occurrence
      const ov = overrideBy.get(`${ev.uid}|${day}`);
      if (ov) {
        if (ov.status === 'CANCELLED' || !ov.start) continue;
        emit(ev, dayOf(ov.start.local), ov); // moved occurrence
      } else {
        emit(ev, day);
      }
    }
  } else {
    const day = dayOf(ev.start.local);
    if (day < FROM || day > TO) { skipped.past++; continue; }
    emit(ev, day);
  }
}

// Overrides whose series starts before the window still produce occurrences in it.
for (const ov of overrides) {
  if (!ov.start || ov.start.kind !== 'time' || ov.status === 'CANCELLED') continue;
  const day = dayOf(ov.start.local);
  if (day < FROM || day > TO) continue;
  const seriesInWindow = base.find((b) => b.uid === ov.uid && b.rrule);
  if (seriesInWindow) continue; // already handled above
  emit(ov, day);
}

bookings.sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.room.localeCompare(b.room));

// Machine-readable output, so the checks can assert on the actual rows.
if (JSON_OUT) { console.log(JSON.stringify(bookings)); process.exit(0); }

// ---- report ---------------------------------------------------------------
const byRoom = {};
for (const b of bookings) byRoom[b.room] = (byRoom[b.room] ?? 0) + 1;

console.log(`window: ${FROM} to ${TO}  (${MONTHS} months)`);
console.log(`events in file: ${all.length}  (${base.length} series/singles, ${overrides.length} changed occurrences)`);
console.log(`\nbookings to import: ${bookings.length}`);
for (const [r, n] of Object.entries(byRoom).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${r}`);
}
console.log(`\nskipped:`);
console.log(`  ${String(skipped.allDay.length).padStart(4)}  all-day entries ${INCLUDE_ALL_DAY ? '(INCLUDED via --all-day)' : '(mostly staff notes — pass --all-day to include)'}`);
console.log(`  ${String(skipped.past).padStart(4)}  outside the window`);
console.log(`  ${String(skipped.cancelled).padStart(4)}  cancelled`);
console.log(`  ${String(skipped.noTime).padStart(4)}  no start date`);
if (skipped.unsupported.length) {
  console.log(`  ${String(skipped.unsupported.length).padStart(4)}  unsupported recurrence:`);
  for (const u of skipped.unsupported.slice(0, 10)) console.log(`        ${u}`);
}

if (skipped.allDay.length && !INCLUDE_ALL_DAY) {
  console.log(`\nall-day entries in the window (these are what --all-day would add):`);
  for (const a of skipped.allDay.sort((x, y) => x.day.localeCompare(y.day)).slice(0, 25)) {
    console.log(`  ${a.day}  ${a.summary}`);
  }
  if (skipped.allDay.length > 25) console.log(`  ... and ${skipped.allDay.length - 25} more`);
}

console.log(`\nfirst 12 bookings:`);
for (const b of bookings.slice(0, 12)) {
  console.log(`  ${b.starts_at.replace('T', ' ')}–${b.ends_at.slice(11)}  ${b.room.padEnd(14)} ${b.title}`);
}

// ---- SQL ------------------------------------------------------------------
if (WRITE) {
  const q = (x) => (x == null ? 'NULL' : `'${String(x).replace(/'/g, "''")}'`);
  const L = [
    '-- Room bookings imported from the church Google Calendar export',
    `-- ("Church Center"), covering ${FROM} to ${TO}.`,
    '--',
    '-- Times are Europe/London wall-clock. 874 of the source events were stored in',
    '-- UTC and were converted through the tz database, not by a fixed offset, so',
    '-- summer bookings keep the hour somebody actually booked.',
    '--',
    '-- Recurring events are expanded here rather than stored as a rule, because the',
    '-- diary has no concept of a repeat. EXDATE cancellations and RECURRENCE-ID',
    '-- moves were applied first.',
    '--',
    `-- All-day entries were ${INCLUDE_ALL_DAY ? 'INCLUDED' : 'EXCLUDED'}: most are staff notes`,
    '-- ("Claire back", "Steve away") rather than room bookings, and importing them',
    '-- would mark a room unavailable all day and invent clashes.',
    '',
    '-- Idempotent: re-running replaces the imported set rather than doubling it.',
    '--',
    '-- The calendar reference goes in external_ref, NOT in notes. It lived in notes',
    '-- once and every imported booking then showed a line of machine noise on the',
    '-- room diary — "ical:11ntir29rs6j40dj7h8bdgodqp@google.com" under Parish',
    '-- Breakfast. notes is read by people; external_ref is read by this script.',
    'DELETE FROM room_bookings WHERE external_ref IS NOT NULL;',
    '',
  ];
  for (const b of bookings) {
    L.push(
      'INSERT INTO room_bookings (room_id, title, starts_at, ends_at, contact, notes, external_ref, status)\n' +
      `SELECT r.id, ${q(b.title)}, ${q(b.starts_at)}, ${q(b.ends_at)}, NULL, ` +
      `${q(b.notes)}, ${q(b.uid)}, 'booked'\n` +
      `  FROM rooms r WHERE r.name = ${q(b.room)};`,
    );
  }
  const out = __dirname + '/../migrations/0008_import_room_bookings.sql';
  fs.writeFileSync(out, L.join('\n') + '\n');
  console.log(`\nwrote ${out} (${bookings.length} inserts)`);
}
