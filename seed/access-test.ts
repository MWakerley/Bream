/**
 * Tests for who can open what.
 *
 * This is the one piece of logic where a mistake is a security hole rather than
 * an inconvenience, so it is checked as a table: for each profile, every path is
 * asserted allowed or refused rather than spot-checked.
 */
import { areaForPath, mayAccess, suggestUsername, temporaryPassword } from '../src/access.js';

let failures = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

const VOLUNTEER = new Set(['rota', 'rooms', 'events', 'me']);
const ROOMS = new Set(['rota', 'rooms', 'rooms.manage', 'events', 'events.manage', 'me']);
const COORD = new Set(['rota', 'rota.manage', 'rooms', 'events', 'me']);
const ADMIN = new Set(['rota', 'rota.manage', 'rooms', 'rooms.manage', 'events', 'events.manage', 'me', 'settings']);
const NOBODY = new Set<string>();

console.log('which area each path needs:');
const PATHS: [string, string | null][] = [
  ['/app', null],
  ['/app/rota', 'rota'],
  ['/app/rota/calendar', 'rota'],
  ['/app/rota/service/12', 'rota'],
  ['/app/rota/generate', 'rota.manage'],
  ['/app/rota/readings', 'rota.manage'],
  ['/app/rota/requests', 'rota.manage'],
  ['/app/rooms', 'rooms'],
  ['/app/rooms/calendar', 'rooms'],
  ['/app/rooms/book', 'rooms.manage'],
  ['/app/rooms/series/3', 'rooms.manage'],
  ['/app/events', 'events'],
  ['/app/events/new', 'events.manage'],
  ['/app/me', 'me'],
  ['/app/settings/people', 'settings'],
  ['/app/settings/profiles', 'settings'],
  ['/app/settings/combinations/by-role', 'settings'],
  ['/app/events/12/bookings/new', 'events'],
  ['/app/events/12/bookings/5', 'events'],
  ['/app/rota/service/3/role/2/add', 'rota'],
  ['/app/rota/service/3/assignment/9/remove', 'rota'],
  ['/app/rota/worship', 'rota'],
  ['/app/rota/worship/12', 'rota'],
];
for (const [path, want] of PATHS) {
  const got = areaForPath(path);
  ok(`${path} -> ${want ?? 'sign-in only'}`, got === want, `got ${got}`);
}

console.log('\nreading:');
ok('a volunteer can see the rota', mayAccess(VOLUNTEER, '/app/rota', 'GET'));
ok('a volunteer can see the room diary', mayAccess(VOLUNTEER, '/app/rooms', 'GET'));
ok('a volunteer can see their own dates', mayAccess(VOLUNTEER, '/app/me', 'GET'));
ok('a volunteer CANNOT open settings', !mayAccess(VOLUNTEER, '/app/settings/people', 'GET'));
ok('a volunteer CANNOT open the generator', !mayAccess(VOLUNTEER, '/app/rota/generate', 'GET'));
ok('a volunteer CANNOT see the swap queue', !mayAccess(VOLUNTEER, '/app/rota/requests', 'GET'));

console.log('\nwriting — the part that matters:');
ok('a volunteer cannot book a room', !mayAccess(VOLUNTEER, '/app/rooms/book', 'POST'));
ok('a volunteer cannot change a booking they can see',
  !mayAccess(VOLUNTEER, '/app/rooms/42', 'POST'),
  'reading the diary must not imply editing it');
ok('a volunteer cannot cancel a booking',
  !mayAccess(VOLUNTEER, '/app/rooms/42/cancel', 'POST'));
ok('a volunteer cannot switch a role off for a service',
  !mayAccess(VOLUNTEER, '/app/rota/service/1/role/2/off', 'POST'));
ok('a volunteer CAN still record being away',
  mayAccess(VOLUNTEER, '/app/me/away', 'POST'),
  'their own dates are theirs to change');

ok('a volunteer cannot put somebody on a service',
  !mayAccess(VOLUNTEER, '/app/rota/service/3/role/2/add', 'POST'),
  'seeing the rota must not mean being able to change it');
ok('nor take somebody off',
  !mayAccess(VOLUNTEER, '/app/rota/service/3/assignment/9/remove', 'POST'));
ok('a coordinator can put somebody on', mayAccess(COORD, '/app/rota/service/3/role/2/add', 'POST'),
  'this is the only way a guest preacher ever reaches a service');
ok('and take somebody off', mayAccess(COORD, '/app/rota/service/3/assignment/9/remove', 'POST'));

ok('a volunteer can SEE the worship roster', mayAccess(VOLUNTEER, '/app/rota/worship', 'GET'),
  'the whole team wants to know who is playing');
ok('but cannot change it', !mayAccess(VOLUNTEER, '/app/rota/worship/12', 'POST'));
ok('the worship leader can, through rota.manage',
  mayAccess(COORD, '/app/rota/worship/12', 'POST'));

ok('the room profile can book', mayAccess(ROOMS, '/app/rooms/book', 'POST'));
ok('the room profile can change a booking', mayAccess(ROOMS, '/app/rooms/42', 'POST'));
ok('the room profile cannot build the rota', !mayAccess(ROOMS, '/app/rota/generate', 'GET'));
ok('the room profile cannot reach settings', !mayAccess(ROOMS, '/app/settings/roles', 'GET'));

console.log('\nevent bookings the office changes by hand:');
ok('somebody who can only SEE events cannot amend a booking',
  !mayAccess(VOLUNTEER, '/app/events/12/bookings/5', 'POST'),
  'the list carries phone numbers and allergies; reading it is not editing it');
ok('nor cancel one', !mayAccess(VOLUNTEER, '/app/events/12/bookings/5/cancel', 'POST'));
ok('nor delete one', !mayAccess(VOLUNTEER, '/app/events/12/bookings/5/delete', 'POST'));
ok('nor take one over the phone', !mayAccess(VOLUNTEER, '/app/events/12/bookings/new', 'POST'));
ok('the events profile can amend a booking', mayAccess(ROOMS, '/app/events/12/bookings/5', 'POST'));
ok('and delete one', mayAccess(ROOMS, '/app/events/12/bookings/5/delete', 'POST'));

console.log('\nsetting the combination rules:');
ok('a coordinator cannot change what a preacher may also do',
  !mayAccess(COORD, '/app/settings/combinations/by-role', 'POST'),
  'these rules bind the generator, so they sit behind settings');
ok('an administrator can', mayAccess(ADMIN, '/app/settings/combinations/by-role', 'POST'));

ok('the coordinator can generate', mayAccess(COORD, '/app/rota/generate', 'POST'));
// Generating moved under Settings; it still needs the right to build the rota
// on top of Settings, exactly as before.
ok('generating under Settings still needs the rota right',
  !mayAccess(new Set(['settings', 'rota']), '/app/settings/generate', 'POST'));
ok('an administrator can generate from Settings', mayAccess(ADMIN, '/app/settings/generate', 'POST'));
ok('a volunteer cannot', !mayAccess(VOLUNTEER, '/app/settings/generate/apply', 'POST'));
ok('the coordinator can edit readings', mayAccess(COORD, '/app/rota/readings', 'POST'));
ok('the coordinator cannot book a room', !mayAccess(COORD, '/app/rooms/book', 'POST'));
ok('the coordinator cannot reach settings', !mayAccess(COORD, '/app/settings/profiles', 'GET'));

ok('an administrator can do everything', [
  '/app/rota/generate', '/app/rooms/book', '/app/events/new', '/app/settings/profiles', '/app/me',
].every((p) => mayAccess(ADMIN, p, 'POST')));

console.log('\na profile with nothing ticked:');
ok('opens the home page', mayAccess(NOBODY, '/app', 'GET'), 'there is nothing secret on it');
for (const p of ['/app/rota', '/app/rooms', '/app/events', '/app/me', '/app/settings/people']) {
  ok(`is refused ${p}`, !mayAccess(NOBODY, p, 'GET'));
}

console.log('\nhelpers:');
ok('a username is the name with the spaces taken out',
  suggestUsername('Andy Ewens') === 'andyewens', suggestUsername('Andy Ewens'));
ok('punctuation and case are dropped', suggestUsername("  Sue  O'Neill-Smith ") === 'sueoneillsmith',
  suggestUsername("  Sue  O'Neill-Smith "));
ok('and it is never an address', !suggestUsername('Matt Wakerley').includes('@'),
  'signing in should use their name, not the address a browser will autofill');
ok('an empty name still gives something', suggestUsername('!!!') === 'user');
{
  const pw = temporaryPassword();
  ok('a temporary password clears the 12-character minimum', pw.length >= 12, pw);
  ok('and is readable enough to dictate', /^[a-z]+-[a-z]+-\d{4}$/.test(pw), pw);
  const many = new Set(Array.from({ length: 200 }, () => temporaryPassword()));
  ok('and is not the same every time', many.size > 190, `${many.size} distinct of 200`);
}

console.log(failures === 0 ? '\nAccess control OK.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
