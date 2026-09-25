/**
 * Renders every view with fixture data and asserts the output looks right.
 *
 * This exists because the pages live behind an admin sign-in that only the
 * church has credentials for, so they cannot be walked through with curl from
 * here. A template that throws, or silently drops a section, would otherwise
 * only be discovered by the person using it.
 *
 *   npx esbuild seed/render-smoke.ts --bundle --platform=node --format=esm \
 *     --outfile=.smoke.mjs && node .smoke.mjs
 */
import { homePage } from '../src/views/home.js';
import { signInPage, setupPage } from '../src/views/signin.js';
import { combinationsPage, pairsPage, peoplePage, rolesPage, settingsHomePage,
         keyholdersPage } from '../src/views/settings.js';
import { gapsPage, readingsPage, rotaDashboard, servicePage, formatDate, formatSpan } from '../src/views/rota.js';
import { servicesPage } from '../src/views/services.js';
import { personPage, mergePage } from '../src/views/person.js';
import { roomsPage, editBookingPage, editSeriesPage, daysCovered, timeOnDay } from '../src/views/rooms.js';
import { eventsListPage, newEventPage, eventAdminPage, publicBookingPage, bookingDonePage,
         bookingEditPage, runsOver } from '../src/views/events.js';
import { roomsCalendarPage } from '../src/views/calendars.js';
import { myRotaPage, requestsPage } from '../src/views/me.js';
import { roomSettingsPage } from '../src/views/roomsettings.js';
import { profilesPage, addPersonPage, changePasswordPage } from '../src/views/profiles.js';
import { noAccessPage } from '../src/views/noaccess.js';
import { peopleByRolePage } from '../src/views/byrole.js';
import { combinationsByRolePage } from '../src/views/combinations.js';
import { draftRulesPage } from '../src/views/draftrules.js';
import { worshipPage } from '../src/views/worship.js';
import { safeguardingPage, safeguardingReportPage } from '../src/views/safeguarding.js';
import { readEventWhen } from '../src/events.js';
import { fillPlaceholders, DEFAULT_ACK_BODY } from '../src/email.js';
import { readKeys } from '../src/keyholders.js';
import type { ViewCtx } from '../src/views/layout.js';
import type { RoleRow, ServiceDetail, ServiceSummary } from '../src/db.js';

const role = (id: number, name: string, min = 1, ideal = 1, communion = 0): RoleRow => ({
  id, key: name.toLowerCase().replace(/\W+/g, '_'), name, sheet_heading: name,
  sort_order: id * 10, min_needed: min, ideal_needed: ideal,
  communion_only: communion, is_active: 1,
  default_min_gap_days: null, default_target_days: null,
});

const roles: RoleRow[] = [
  role(1, 'Preacher'), role(2, 'Service leader'), role(3, 'Reader', 2, 2),
  role(4, 'Prayer ministry', 2, 4), role(5, 'Children: Rec to Yr 5 (4-10yr)', 2, 2),
  role(6, 'Communion preside', 1, 1, 1),
];

const service = (over: Partial<ServiceSummary> = {}): ServiceSummary => ({
  id: 1, service_date: '2026-11-15', service_time: '10:30', title: 'Worship',
  location: null, is_communion: 0, readings: 'Gen 1:1-5', sermon_title: null,
  gaps: [], under: [], short: [], critical: [], filled: 10, needed: 12, ...over,
});

/** One assignee. seed/ is NOT type-checked (tsconfig includes only src/**), so
 *  a fixture that goes stale against a changed interface fails silently rather
 *  than at compile time. This helper is the only place the shape is written. */
const on = (id, name, over = {}) => ({
  assignment_id: id, person_id: id * 10, display_name: name,
  status: 'confirmed', on_break: 0, is_guest: 0, ...over,
});

const detail: ServiceDetail = {
  id: 1, service_date: '2026-11-15', service_time: '15:00', title: 'Remembrance',
  location: 'Bream Cenotaph', is_communion: 0, readings: null, sermon_title: null,
  roles: [
    { role_id: 1, role_name: 'Preacher', min_needed: 1, ideal_needed: 1,
      people: [on(1, 'Steve', { is_guest: 1 })] },
    { role_id: 4, role_name: 'Prayer ministry', min_needed: 2, ideal_needed: 4,
      people: [on(2, 'Don'), on(3, 'Christine', { on_break: 1 })] },
    { role_id: 2, role_name: 'Service leader', min_needed: 1, ideal_needed: 1, people: [] },
  ],
  notApplicable: [{ role_id: 5, role_name: 'Tea and coffee', note: 'Outdoor service' }],
};

/** Who could be put on a role by hand. */
const CANDIDATES = new Map([
  [1, [
    { id: 11, display_name: 'Sue Baker', can_do: 1, on_break: 0, is_guest: 0, already_here: 0, away: 0 },
    { id: 12, display_name: 'Roger Vane', can_do: 1, on_break: 0, is_guest: 1, already_here: 0, away: 0 },
    { id: 13, display_name: 'Pat Doyle', can_do: 1, on_break: 1, is_guest: 0, already_here: 0, away: 1 },
    { id: 14, display_name: 'Steve', can_do: 1, on_break: 0, is_guest: 0, already_here: 1, away: 0 },
  ]],
  [4, []],
  [2, []],
]);

const CTX: ViewCtx = { signedInAs: 'Matt', isAdmin: true, path: '/app' };

/** What each kind of person may open, for the tests that check the menu only
 *  offers pages the viewer can actually get into. */
const ADMIN_AREAS = new Set(['rota', 'rota.manage', 'rooms', 'rooms.manage', 'events',
  'events.manage', 'me', 'settings']);
const VOLUNTEER_AREAS = new Set(['rota', 'rooms', 'events', 'me']);

let failures = 0;
/**
 * Renders one view and asserts what the output must, and must not, contain.
 *
 * The negative list matters as much as the positive one: a page that offers a
 * volunteer a button they will be refused, or a Delete on a booking that does
 * not exist yet, is a fault no amount of "does it contain" would catch.
 */
async function check(
  name: string,
  render: () => unknown,
  mustContain: string[],
  mustNotContain: string[] = [],
) {
  try {
    const out = String(await render());
    const missing = mustContain.filter((m) => !out.includes(m));
    const present = mustNotContain.filter((m) => out.includes(m));
    if (missing.length) {
      console.log(`  FAIL ${name} — missing: ${missing.join(' | ')}`);
      failures++;
    } else if (present.length) {
      console.log(`  FAIL ${name} — should not be there: ${present.join(' | ')}`);
      failures++;
    } else if (/undefined|\[object Object\]|NaN|=&quot;/.test(out)) {
      // =&quot; is an attribute written as a plain string inside html``, which
      // escapes it — aria-current="page" arriving as aria-current=&quot;page&quot;.
      const m = out.match(/.{0,60}(undefined|\[object Object\]|NaN|=&quot;).{0,60}/);
      console.log(`  FAIL ${name} — leaked placeholder: ...${m?.[0]}...`);
      failures++;
    } else {
      console.log(`  ok   ${name} (${out.length} bytes)`);
    }
  } catch (e) {
    console.log(`  THREW ${name} — ${e instanceof Error ? e.message : e}`);
    failures++;
  }
}

console.log('date formatting:');
const fd = formatDate('2026-11-15');
console.log(`  2026-11-15 -> ${fd}`);
if (fd !== 'Sun 15 Nov 2026') { console.log('  FAIL wrong weekday'); failures++; }

console.log('\nviews:');
await check('home', () => homePage({ ctx: CTX, gapCount: 3, isAdmin: true }),
  ['Room booking', 'Events', '3', 'Setting things up', 'Merge duplicates']);
await check('home (no gaps, not admin)',
  () => homePage({ ctx: { ...CTX, signedInAs: 'Sue', isAdmin: false }, gapCount: 0, isAdmin: false }), ['Room booking']);
await check('sign in', () => signInPage({ error: 'Nope', next: '/app' }), ['Nope', 'password']);
await check('setup', () => setupPage('tok'), ['Create administrator']);
await check('people', () => peoplePage(
  [{ id: 1, display_name: 'Matt R', full_name: null, email: null, is_active: 1, is_admin: 0,
     needs_review: 1, review_note: 'may be Matt W', happy_with_anyone: 1,
     role_names: 'Preacher', role_count: 1 }], CTX),
  ['Matt R', 'Possible duplicate', 'may be Matt W', 'Merge duplicates']);
await check('roles', () => rolesPage(roles, CTX), ['Prayer ministry', 'Save all roles', 'Add this role']);
await check('roles can be marked critical', () => rolesPage([{ ...roles[0]!, is_critical: 1 }, roles[1]!], CTX),
  ['Critical to service', 'name="critical_1" value="1" checked', 'name="critical_2" value="1" ']);
await check('combinations', () => combinationsPage(roles, [
  { role_a_id: 1, role_b_id: 2, verdict: 'green', reason: 'Observed 8 times' },
  { role_a_id: 2, role_b_id: 3, verdict: 'amber', reason: 'Not ideal' },
  { role_a_id: 1, role_b_id: 5, verdict: 'red', reason: 'Cannot be in two places' },
], CTX), ['combo-green', 'combo-amber', 'combo-red', 'Children: Rec to Yr 5']);
await check('pairs', () => pairsPage(
  [{ id: 1, role_id: null, a_name: 'Sue', b_name: 'Sheila', role_name: null, mode: 'together',
     strength: 'must', note: 'Served together 8 times' }],
  [{ id: 1, display_name: 'Sue' }, { id: 2, display_name: 'Sheila' }],
  roles, CTX),
  ['Sue', 'Sheila', 'Any role', 'Must be together', 'cannot be separated', 'Add a pairing']);
await check('rota dashboard', () => rotaDashboard(
  [service(), service({ id: 2, gaps: ['Steward'], title: 'Holy Communion' })], CTX, detail),
  ['Sun 15 Nov 2026', 'Steward', 'Short-handed', 'Nobody on Steward', 'Next service',
   'nobody yet', 'Add a service', 'svc-under'], ['Key roles missing']);

// A critical role missing is a different order of problem from a minor one.
const critDetail = { ...detail, id: 2, roles: detail.roles.map((r) =>
  r.role_id === 2 ? { ...r, is_critical: 1 } : r) };
await check('a missing critical role is flagged in red', () => rotaDashboard(
  [service(), service({ id: 2, gaps: ['Service leader', 'Steward'], critical: ['Service leader'] })],
  CTX, null, new Map([[2, critDetail]])),
  ['Key roles missing', 'crit-dot', 'svc-critical', 'Still to book: Service leader',
   'also nobody on Steward', 'is-critical', 'nobody yet — critical']);
await check('every service can open out to show its roster', () => rotaDashboard(
  [service({ id: 1 }), service({ id: 2 })], CTX, null,
  new Map([[1, detail], [2, { ...detail, id: 2 }]])),
  ['<details class="svc-more">', 'Who is on what', 'Prayer ministry', 'Don, Christine']);
await check('the next service shows red only for a critical role', () => rotaDashboard(
  [service()], CTX, critDetail),
  ['Key roles missing', 'is-critical'], ['Everyone is in place']);

// A role wanting two people and having one is not unfilled. Somebody is doing
// it, and the whole point of this distinction is that the word never appears.
await check('one of two is short-handed, not unfilled', () => rotaDashboard(
  [service({ under: [{ role: 'Reader', filled: 1, min: 2 }] })], CTX, null),
  ['Short-handed', 'Reader 1 of 2', 'svc-under'],
  ['unfilled', 'with nobody', 'nobody at all']);
await check('rota dashboard (empty)', () => rotaDashboard([], CTX, null), ['No upcoming services']);
await check('gaps', () => gapsPage([service({ gaps: ['Steward', 'Computer'] })], CTX),
  ['Steward, Computer', 'Nobody on it']);
await check('gaps (none)', () => gapsPage([service()], CTX),
  ['Nothing unfilled', 'Nothing short-handed either']);
await check('the gaps page keeps the two apart', () => gapsPage(
  [service({ under: [{ role: 'Reader', filled: 1, min: 2 }] })], CTX),
  // Nothing is unfilled, so that half says so; the short-handed half names it.
  ['Nothing unfilled', 'Reader 1 of 2', 'Somebody is doing each of these']);
await check('service detail', () => servicePage(detail, CTX),
  ['Remembrance', 'Bream Cenotaph', 'nobody yet', 'Not needed here', 'Put it back',
   'Tea and coffee', 'Steve', 'Don', 'Christine'],
  // A viewer who may not change the rota is not offered a picker that would
  // refuse them. Nothing to add, nothing to take off.
  ['Put somebody on', 'Take off']);

// Putting somebody on by hand is how a GUEST preacher gets on a service at all
// — they are never drawn from the pool by definition — and how anybody on a
// break is overridden when they say yes after being asked directly.
await check('a coordinator can put somebody on', () => servicePage(detail, CTX, CANDIDATES), [
  'Take off',
  '/app/rota/service/1/assignment/1/remove',
  '/app/rota/service/1/role/1/add',
  'Put somebody on',
  // Nobody is hidden. The list SAYS what it knows and leaves the decision to
  // the person clicking, who rang round on Saturday night and knows more.
  'Sue Baker',
  'Roger Vane — guest',
  'Pat Doyle — on a break, away that day',
  // Existing assignees carry their own markers.
  'on a break', 'guest',
], [
  // Somebody already on this service is not offered again.
  'Steve — ',
  // Everyone offered can already do the role, so saying so would be noise.
  'does not normally do this',
]);

// A role nobody else is ticked for says where to go, rather than showing an
// empty dropdown that looks broken.
await check('an empty picker says how to fill it', () => servicePage(
  detail, CTX, new Map([[1, []], [4, []], [2, []]])),
  ['Nobody else is ticked for', '/app/settings/people/by-role?role=1']);
await check('readings', () => readingsPage([service()], CTX, '2026-11-15'),
  ['Gen 1:1-5', 'Sermon title', 'Saved']);
await check('services', () => servicesPage({
  services: [{ id: 1, service_date: '2026-11-15', service_time: '10:30', title: 'Worship',
    location: null, type_name: 'Worship', is_cancelled: 0 }],
  types: [{ id: 1, name: 'Worship', is_communion: 0, default_time: '10:30' }],
  ctx: CTX,
  notice: { tone: 'ok', text: '5 added' },
}), ['Create the Sundays', 'Add this service', '5 added']);

await check('settings has its own overview', () => settingsHomePage(CTX),
  ['/app/settings/people', '/app/settings/keyholders', 'Keyholders', 'Roles and numbers']);
await check('the people page is just people', () => peoplePage(
  [{ id: 1, display_name: 'Sue', full_name: null, email: null, is_active: 1, is_admin: 0,
     needs_review: 0, review_note: null, happy_with_anyone: 1, is_keyholder: 1,
     role_names: 'Reader', role_count: 1 }], CTX),
  ['Find a person', 'Sue', 'icon-key', 'keyholder'], ['Combination rules</a>']);
await check('the keyholder register', () => keyholdersPage([
  { id: 1, display_name: 'Sue', full_name: 'Sue Baker', email: 'sue@example.org', phone: null,
    is_active: 1, keyholder_since: '2026-09-25 10:00:00', keyholder_note: null,
    keyholder_keys: '["church","office"]' },
  { id: 2, display_name: 'Ron', full_name: null, email: null, phone: '01594 000000',
    is_active: 0, keyholder_since: null, keyholder_note: null, keyholder_keys: '["unknown"]' },
], CTX), ['Keyholder register', '2 people hold a key', 'Sue Baker', 'Church, Church Office', 'Not known',
  'Fri 25 Sep 2026', 'No longer serving', '1 keyholder has stopped serving']);
await check('"Not known" never sits beside a real key', () => {
  const f = (vals: string[]) => { const d = new FormData(); vals.forEach((v) => d.append('keyholder_keys', v)); return d; };
  return [
    readKeys(f(['unknown', 'church'])).join(','),
    readKeys(f([])).join(','),
    readKeys(f(['office', 'centre'])).join(','),
    readKeys(f(['bogus'])).join(','),
  ].join(' | ');
}, ['church | unknown | centre,office | unknown']);
await check('an empty register says so', () => keyholdersPage([], CTX),
  ['Nobody is marked as a keyholder yet']);
await check('a keyholder is ticked on their record', () => personPage({
  person: {
    id: 7, display_name: 'Sue', full_name: null, email: null, needs_review: 0, review_note: null,
    is_active: 1, is_admin: 0, on_break: 0, on_break_since: null, is_guest: 0,
    is_keyholder: 1, keyholder_since: '2026-09-01 09:00:00', keyholder_note: null,
    keyholder_keys: '["centre"]',
    settings: new Map(),
  },
  roles, ctx: CTX,
}), ['name="is_keyholder" value="1" checked', 'icon-key', 'keyholder register', 'Which keys',
     'value="centre" checked', 'Church Office', 'Not known'],
  ['id="keyholder-note" hidden']);
// ---- safeguarding ----------------------------------------------------------
const SG_GRID = {
  roles: [{ id: 1, name: 'PCC member' }, { id: 2, name: 'Churchwarden' }, { id: 4, name: 'Working with children or vulnerable adults' }],
  courses: [{ id: 1, name: 'Basic Awareness' }, { id: 2, name: 'Foundation' }, { id: 7, name: 'DBS Check' }],
  requires: new Set(['1:1', '2:1', '2:2', '4:7']),
};
await check('the safeguarding grid', () => safeguardingPage(SG_GRID, CTX),
  ['Safeguarding', 'Churchwarden', 'DBS Check', 'name="req_2_2" value="1"\n                         checked',
   'name="req_1_7" value="1"\n                         ']);
await check('a churchwarden is asked about the churchwarden\'s courses', () => personPage({
  person: {
    id: 7, display_name: 'Sue', full_name: null, email: null, needs_review: 0, review_note: null,
    is_active: 1, is_admin: 0, on_break: 0, on_break_since: null, is_guest: 0, settings: new Map(),
  },
  roles, ctx: CTX,
  safeguarding: { grid: SG_GRID, person: { roleIds: [2], courses: new Map([[1, { done: 1, done_at: '2026-09-01 10:00:00' }]]) } },
}), ['id="safeguarding"', 'name="sg_role_2" value="1" class="sg-role" data-role="2"\n                 checked',
     'Basic Awareness', 'Foundation', '1 of 2 courses done', 'marked done Tue 1 Sep 2026',
     'not answered', 'data-roles="4"\n                    hidden'],
  ['name="sg_role_1" value="1" class="sg-role" data-role="1"\n                 checked']);
await check('nobody with no safeguarding role is chased for courses', () => personPage({
  person: {
    id: 8, display_name: 'Ron', full_name: null, email: null, needs_review: 0, review_note: null,
    is_active: 1, is_admin: 0, on_break: 0, on_break_since: null, is_guest: 0, settings: new Map(),
  },
  roles, ctx: CTX,
  safeguarding: { grid: SG_GRID, person: { roleIds: [], courses: new Map() } },
}), ['None of the roles ticked above needs a course'], ['courses done']);

await check('person edit', () => personPage({
  person: {
    id: 7, display_name: 'Andy', full_name: null, email: null,
    needs_review: 1, review_note: 'may be the same person as: Andy E, Andy Ewens',
    is_active: 1, is_admin: 0,
    settings: new Map([[1, {
      role_id: 1, can_do: 1, willing: 1,
      max_per_period: 2, period_days: 30, min_gap_days: null, done: 4,
    }]]),
  },
  roles, ctx: CTX, saved: true,
}), ['Andy', 'What they can do', 'How often', 'Has done this 4 times',
     'Not recorded doing this yet', 'Save this person', 'Not a duplicate']);

await check('merge', () => mergePage({
  groups: [{
    suggestion: 'Andy — 3 records',
    people: [
      { id: 1, display_name: 'Andy', done: 7, needs_review: 1 },
      { id: 2, display_name: 'Andy E', done: 2, needs_review: 1 },
      { id: 3, display_name: 'Andy Ewens', done: 2, needs_review: 1 },
    ],
  }],
  all: [{ id: 1, display_name: 'Andy', done: 7 }, { id: 2, display_name: 'Andy E', done: 2 }],
  ctx: CTX,
  notice: { tone: 'ok', text: 'Merged 2 records into Andy Ewens.' },
}), ['Andy Ewens', 'Merge the ticked ones', 'keep_id', 'merge_ids', 'cannot be undone',
     'Not a duplicate', 'These are all different people', 'group_ids']);

await check('merge (nothing left)', () => mergePage({
  groups: [], all: [{ id: 1, display_name: 'Andy', done: 7 }], ctx: CTX,
}), ['No likely duplicates left']);

// ---- rooms ---------------------------------------------------------------
const ROOMS = [
  { id: 1, name: 'Main church', capacity: 200, notes: null },
  { id: 2, name: 'Church Centre', capacity: 60, notes: null },
];
const SERIES = [{ id: 1, room_id: 2, room_name: 'Church Centre', title: 'Home group',
  contact: null, notes: null, freq: 'weekly' as const, from_date: '2026-09-21',
  until_date: '2027-09-21', from_time: '19:00', to_time: '21:00', upcoming: 40, total: 52 }];
const BOOKING = {
  id: 1, room_id: 2, room_name: 'Church Centre', title: 'Home group',
  starts_at: '2026-11-20T19:00', ends_at: '2026-11-20T21:00',
  contact: 'Sue', notes: null, status: 'booked', booked_by_name: 'Matt',
};
await check('rooms', () => roomsPage({
  rooms: ROOMS, bookings: [BOOKING], series: SERIES, ctx: CTX, weekFrom: '2026-11-18',
  notice: { tone: 'ok', text: 'Booked: Home group.' },
}), ['Church Centre', 'Home group', '19:00–21:00', 'Book this room', 'Cancel']);
await check('rooms (nothing booked)', () => roomsPage({
  rooms: ROOMS, bookings: [], series: [], ctx: CTX, weekFrom: '2026-11-18',
}), ['Nothing booked in this period']);
await check('edit series', () => editSeriesPage({
  series: SERIES[0]!, rooms: ROOMS, ctx: CTX,
}), ['Home group', 'Every Monday', 'Save the whole series', 'Cancel the whole series',
     'already happened', 'changed on its own', 'cancelled']);
await check('edit booking', () => editBookingPage({
  booking: BOOKING, rooms: ROOMS, ctx: CTX,
}), ['Home group', 'Save changes', '19:00']);

// ---- events --------------------------------------------------------------
const EVENT = {
  id: 1, slug: 'harvest-supper', title: 'Harvest Supper',
  description: 'Bring a friend.', starts_at: '2026-10-11T19:00', ends_at: null,
  location: 'Church Centre', capacity: 60, booking_closes_at: null,
  is_published: 1, ask_email: 1, ask_phone: 0, poster_key: null,
  send_ack: 1, ack_subject: null, ack_body: null, booked: 48, bookings: 19,
};
const FIELDS = [
  { id: 5, event_id: 1, key: 'main_course', label: 'Main course', hint: null,
    kind: 'select' as const, options: JSON.stringify(['Beef', 'Vegetarian']), required: 1, sort_order: 10 },
  { id: 6, event_id: 1, key: 'allergies', label: 'Any allergies?', hint: null,
    kind: 'textarea' as const, options: null, required: 0, sort_order: 20 },
];
await check('events list', () => eventsListPage({ events: [EVENT], ctx: CTX }),
  ['Harvest Supper', 'Taking bookings', 'Add an event', '12']);
await check('events list (empty)', () => eventsListPage({ events: [], ctx: CTX }),
  ['No events yet']);
const EV_EXTRA = { rooms: ROOMS, roomIds: [] as number[], organisers: [] };
await check('new event', () => newEventPage({ ctx: CTX, rooms: ROOMS }),
  ['Create the event', 'How many can come', 'name="end_time"', 'Book rooms for it',
   'Church Centre', 'name="room_ids"', 'name="organiser_name"', 'Add another organiser',
   'Email the organisers each time somebody books']);
await check('a refused new event keeps what was ticked', () => newEventPage({
  ctx: CTX, rooms: ROOMS, roomIds: [2], notify: true,
  organisers: [{ name: 'Jan', email: 'jan@example.org' }, { name: 'Bob', email: '' }],
}), ['value="2" checked', 'value="Jan"', 'value="jan@example.org"', 'value="Bob"',
     'name="notify_organisers" value="1" checked']);
await check('the event page shows its rooms and organisers', () => eventAdminPage({
  event: { ...EVENT, ends_at: '2026-10-11T21:00', notify_organisers: 1 }, fields: FIELDS,
  bookings: [], ctx: CTX, origin: 'https://x.test',
  rooms: ROOMS, roomIds: [1], organisers: [{ name: 'Jan', email: 'jan@example.org' }],
}), ['value="21:00"', 'name="end_date" type="date" value="2026-10-11"', 'value="1" checked', 'Organisers', 'value="Jan"', 'Save organisers'],
  ['value="2" checked']);
await check('event admin', () => eventAdminPage({
  event: EVENT, fields: FIELDS,
  bookings: [{ id: 1, name: 'Sue', email: null, phone: null, party_size: 2,
    status: 'booked', created_at: '2026-09-18T10:00', answers: { '5': 'Beef' } }],
  ctx: CTX, origin: 'https://breamchurch.stack66.com', ...EV_EXTRA,
}), ['Harvest Supper', '48', '12', 'Main course', 'Any allergies?', 'Add this question',
     'https://breamchurch.stack66.com/events/harvest-supper']);
await check('public booking', () => publicBookingPage({ event: EVENT, fields: FIELDS }),
  ['Harvest Supper', 'Book my place', 'Main course', 'Beef', 'Vegetarian', 'Still spaces left']);
// The public page must never say how many. "3 places left" makes people
// hesitate over taking two, and it tells anybody looking exactly how the
// evening is selling. The admin page keeps the numbers.
await check('the public page never gives the count away', () => publicBookingPage({
  event: EVENT, fields: FIELDS,
  // The requirement is about NUMBERS, not the phrase: the sold-out branch may
  // well say 'no places left', which gives nothing away that 'Sold out' has not
  // already said. What must never appear is the count or the capacity.
  // Matched as whole words with their units, not as bare digits — '60' also
  // appears inside the Google Fonts URL (wght@600), which is not a capacity.
}), ['Still spaces left'], ['12 places', '48 of', 'of 60', '60 places', 'places left.']);

await check('but the event page still shows them', () => eventAdminPage({
  event: EVENT, fields: FIELDS, bookings: [], ctx: CTX, origin: 'https://x.test', ...EV_EXTRA,
}), ['48', '60', 'places left', 'How many can come', 'name="capacity"',
     'Save these details']);

await check('public booking (full)', () => publicBookingPage({
  event: { ...EVENT, booked: 60 }, fields: FIELDS,
}), ['Sold out', 'waiting list', 'Fully booked — add me to the waiting list',
     'name="waitlist" value="1"'], ['Book my place']);
await check('a booking is limited to the event\'s own maximum', () => publicBookingPage({
  event: { ...EVENT, max_per_booking: 6 }, fields: FIELDS,
}), ['max="6"', 'Up to 6 in one booking', 'Book my place'], ['name="waitlist"']);
await check('booking done', () => bookingDonePage(EVENT, 2), ['You are booked in', 'Harvest Supper']);
await check('the waiting list is not told it has a place', () => bookingDonePage(EVENT, 2, true),
  ['You are on the waiting list', 'This is not a place yet'], ['You are booked in']);
await check('new events default to ten per booking', () => newEventPage({ ctx: CTX, rooms: [] }),
  ['name="max_per_booking"', 'value="10"']);

// ---- self-service --------------------------------------------------------
await check('my rota', () => myRotaPage({
  duties: [{ assignment_id: 1, service_id: 1, service_date: '2026-11-15',
    service_time: '10:30', title: 'Worship', role_name: 'Reader',
    status: 'confirmed', request_status: null }],
  away: [{ id: 1, from_date: '2026-12-20', to_date: '2026-12-28', reason: 'Away' }],
  ctx: CTX,
}), ['Reader', 'I cannot do this', 'When you are away', 'Sun 20 Dec 2026']);
await check('my rota (nothing on)', () => myRotaPage({ duties: [], away: [], ctx: CTX }),
  ['not down for anything']);
await check('change requests', () => requestsPage({
  requests: [{ id: 1, person_name: 'Sue', role_name: 'Welcome team',
    service_date: '2026-11-15', service_time: '10:30', title: 'Worship',
    kind: 'cannot_do', message: 'Away that weekend', status: 'open',
    created_at: '2026-09-18' }],
  ctx: CTX,
}), ['Sue', 'Welcome team', 'Take them off', 'Away that weekend']);
await check('change requests (none)', () => requestsPage({ requests: [], ctx: CTX }),
  ['Nothing outstanding']);

await check('people by role', () => peopleByRolePage({
  roles, role: roles[0]!,
  people: [
    { id: 1, display_name: 'Steve', needs_review: 0, on_break: 0, is_guest: 0, can_do: 1,
      max_per_period: 2, period_days: 30, min_gap_days: null, done: 15 },
    { id: 2, display_name: 'Matt R', needs_review: 1, on_break: 1, is_guest: 0, can_do: 1,
      max_per_period: null, period_days: null, min_gap_days: 91, done: 2 },
    { id: 3, display_name: 'Sue', needs_review: 0, on_break: 0, is_guest: 1, can_do: 0,
      max_per_period: null, period_days: null, min_gap_days: null, done: 0 },
  ],
  ctx: CTX,
}), [
  'Who can do Preacher', 'Steve', 'Sue',
  // The hidden list of who was shown is what stops a filtered save wiping
  // everybody it did not display, so its absence must fail the test.
  'name="shown"',
  'Save who can do Preacher', 'possible duplicate', 'thin pool',
  // A tick says somebody COULD do it; the warning counts who the rota may
  // actually pick, and says why the two numbers differ.
  'taking a break', 'the rota can use now', 'are ticked, but',
]);

// --- searching ------------------------------------------------------------
// The filter runs in the browser, so what this can prove is that every row
// carries the text to match on and that the box points at the right container.
// A row with no data-search attribute is invisible to the search however it is
// typed, and that failure would be silent.
await check('people list has a search box', () => peoplePage([
  {
    id: 1, display_name: 'Andy E', full_name: 'Andy Ewens', email: 'andy@example.org',
    is_active: 1, is_admin: 0, needs_review: 0, review_note: null, happy_with_anyone: 1,
    role_names: 'Preacher, Reader', role_count: 2,
  },
], CTX), [
  'data-search-target="people-list"',
  'id="people-list"',
  'data-search="Andy E Andy Ewens andy@example.org Preacher, Reader"',
]);

// --- one role against every other ----------------------------------------
await check('combination rules by role', () => combinationsByRolePage({
  roles, role: roles[0]!,
  others: [
    { role_id: 2, role_name: 'Service leader', communion_only: 0,
      verdict: 'amber', reason: 'a lot for one person', observed: 6 },
    { role_id: 3, role_name: 'Reader', communion_only: 0,
      verdict: null, reason: null, observed: 0 },
    { role_id: 6, role_name: 'Communion preside', communion_only: 1,
      verdict: 'red', reason: null, observed: 0 },
  ],
  ctx: CTX,
}), [
  'What else can the Preacher do?',
  'Service leader', 'Already done 6 times', 'a lot for one person',
  'Not allowed', 'Not decided',
  // The same trap as the by-role people editor: a radio group with nothing
  // chosen submits nothing at all, so the list of what was on the page has to
  // travel with it or a save would look like "everything undecided".
  'name="shown"', 'name="v_2"', 'name="reason_2"',
  // That a blank means "allowed" is the single most important thing this page
  // has to say, because it is the opposite of what people assume.
  'Not decided</span>',
]);

// --- bookings the office changes by hand ---------------------------------
await check('amend a booking', () => bookingEditPage({
  event: EVENT, fields: FIELDS,
  booking: {
    id: 5, name: 'Sue Baker', email: 'sue@example.org', phone: '01594 000000',
    party_size: 3, status: 'booked', created_at: '2026-09-10 11:00:00',
    answers: { '5': 'Vegetarian', '6': 'No nuts' },
  },
  ctx: CTX,
}), [
  'Sue Baker', 'sue@example.org', '01594 000000',
  // The event's own questions have to appear here too, with the stored answer
  // already chosen. A question missing from the office form is a hole in the
  // caterer's list that nobody would notice until the day.
  'Main course', 'value="Vegetarian" selected', 'No nuts',
  'Delete this booking for good', 'name="status"',
]);

await check('take a booking by phone', () => bookingEditPage({
  event: EVENT, fields: FIELDS, ctx: CTX,
}), ['Take a booking over the phone', 'Add this booking', 'Main course'],
  // There is nothing to delete before it exists.
  ['Delete this booking for good']);

await check('a cancelled booking says so', () => bookingEditPage({
  event: EVENT, fields: FIELDS,
  booking: {
    id: 6, name: 'John Hale', email: null, phone: null, party_size: 2,
    status: 'cancelled', created_at: '2026-09-10 11:00:00', answers: {},
  },
  ctx: CTX,
}), ['This booking is cancelled', 'does not count towards the numbers']);

await check('the event page lists cancelled bookings too', () => eventAdminPage({
  event: EVENT, fields: FIELDS, ctx: CTX, origin: 'https://breamchurch.stack66.com', ...EV_EXTRA,
  bookings: [
    { id: 1, name: 'Sue Baker', email: 'sue@example.org', phone: null, party_size: 3,
      status: 'booked', created_at: '2026-09-10 11:00:00', answers: { '5': 'Beef' } },
    { id: 2, name: 'John Hale', email: null, phone: '01594 111111', party_size: 2,
      status: 'cancelled', created_at: '2026-09-11 11:00:00', answers: {} },
  ],
}), [
  'Take a booking by phone', 'row-cancelled', 'Cancelled', 'Put back',
  'data-search-target="bookings-list"',
  // Their own list, headed as such, with its own count — never mixed in.
  'bookings-h-cancelled', 'Kept as a record',
  'attendees.pdf', 'attendees.xlsx',
]);

// Three separate tables: the booked one must come first and must not contain
// the cancelled row. Checked by position rather than by "contains".
await check('booked, waiting and cancelled are three separate lists', async () => {
  const out = String(await eventAdminPage({
    event: EVENT, fields: FIELDS, ctx: CTX, origin: 'https://x.test', ...EV_EXTRA,
    bookings: [
      { id: 1, name: 'Sue Baker', email: null, phone: null, party_size: 3, status: 'booked', created_at: '2026-09-10 11:00:00', answers: {} },
      { id: 2, name: 'John Hale', email: null, phone: null, party_size: 2, status: 'cancelled', created_at: '2026-09-11 11:00:00', answers: {} },
      { id: 3, name: 'Wendy Wait', email: null, phone: null, party_size: 1, status: 'waitlist', created_at: '2026-09-12 11:00:00', answers: {} },
    ],
  }));
  const at = (s: string) => out.indexOf(s);
  const inOrder = at('bookings-h-booked') < at('Sue Baker')
    && at('Sue Baker') < at('bookings-h-waiting')
    && at('bookings-h-waiting') < at('Wendy Wait')
    && at('Wendy Wait') < at('bookings-h-cancelled')
    && at('bookings-h-cancelled') < at('John Hale');
  return inOrder ? out : 'OUT OF ORDER';
}, ['Give them a place', '3 people', 'Waiting list']);

// A booker chooses their own name on the public form. It must never become
// part of the JavaScript an administrator's browser runs.
await check('a booker\'s name cannot break out into script', () => eventAdminPage({
  event: EVENT, fields: FIELDS, ctx: CTX, origin: 'https://x.test', ...EV_EXTRA,
  bookings: [{ id: 9, name: "O'Brien');alert(1);//", email: null, phone: null, party_size: 1,
    status: 'booked', created_at: '2026-09-10 11:00:00', answers: {} }],
}), ['onsubmit="return confirm(this.dataset.confirm)"', 'data-confirm="Cancel O&#39;Brien&#39;);alert(1);//’s booking?'],
  ["confirm('Cancel", "alert(1);//')"]);

await check('a viewer is not offered the attendee download', () => eventAdminPage({
  event: EVENT, fields: FIELDS, ctx: { ...CTX, areas: VOLUNTEER_AREAS }, origin: 'https://x.test', ...EV_EXTRA,
  bookings: [{ id: 1, name: 'Sue', email: null, phone: null, party_size: 1, status: 'booked', created_at: '2026-09-10 11:00:00', answers: {} }],
}), ['Sue'], ['attendees.pdf']);

// --- a person's sign-in ---------------------------------------------------
const WITH_ACCOUNT = {
  id: 7, display_name: 'Sue Baker', full_name: null, email: null,
  needs_review: 0, review_note: null, is_active: 1, is_admin: 0,
  settings: new Map<number, never>(),
};

// The sixty-odd people imported from the spreadsheet are already here, so
// giving them a sign-in has to be possible from their own record. Sending an
// administrator to "Add a person" would make a second copy of somebody who
// already exists.
await check('person with no sign-in can be given one', () => personPage({
  person: {
    ...WITH_ACCOUNT, email: 'sue@example.org', account: null,
    profiles: [{ id: 1, name: 'Volunteer', is_default: 1 },
               { id: 2, name: 'Administrator', is_default: 0 }],
  },
  roles, ctx: CTX,
}), [
  'has no sign-in', 'Give them a sign-in',
  // The username is suggested from their name so nobody has to invent one.
  'value="suebaker"',
  'Volunteer', 'the usual one', 'Email it to sue@example.org',
], ['Last signed in']);

await check('somebody with no email is told to read it out', () => personPage({
  person: {
    ...WITH_ACCOUNT, account: null,
    profiles: [{ id: 1, name: 'Volunteer', is_default: 1 }],
  },
  roles, ctx: CTX,
}), ['No email address on file'], ['Email it to']);

await check('person who has never signed in', () => personPage({
  person: {
    ...WITH_ACCOUNT,
    account: { username: 'sue.baker', email: null, profile_name: 'Volunteer',
      last_sign_in_at: null, must_change: 1 },
  },
  roles, ctx: CTX,
}), ['Last signed in', 'Never', 'still on the temporary password',
     'read it out to them', 'Reset their password']);

await check('person who has signed in', () => personPage({
  person: {
    ...WITH_ACCOUNT,
    account: { username: 'sue.baker', email: 'sue@example.org', profile_name: 'Volunteer',
      last_sign_in_at: '2026-09-15 09:30:00', must_change: 0 },
  },
  roles, ctx: CTX, today: new Date('2026-09-18T12:00:00Z'),
}), [
  'Last signed in',
  // 09:30 UTC in mid-September is 10:30 in Britain. Slicing the string would
  // have printed 09:30, so this is the assertion that catches that.
  'Tue 15 Sep 2026 at 10:30',
  '3 days ago', 'Email it to sue@example.org',
]);

// --- the menu -------------------------------------------------------------
// Generating a rota was reachable only from the foot of the home page. It is
// one of the two or three things the system is for, so it belongs in the menu.
await check('the rota menu offers the generator', () => rotaDashboard(
  [], { ...CTX, path: '/app/rota', areas: ADMIN_AREAS },
), ['Generate a rota', 'Readings and sermons', 'subnav']);

await check('a volunteer is not offered the generator', () => rotaDashboard(
  [], { ...CTX, path: '/app/rota', areas: VOLUNTEER_AREAS },
), ['Calendar'], ['Generate a rota', 'Change requests']);



// --- the public booking page --------------------------------------------
await check('the booking page says what it is for', () => publicBookingPage({
  event: EVENT, fields: FIELDS,
}), ['Bream Church', 'Harvest Supper', 'Book your place']);

// The challenge appears only when a key exists. With no key the form must
// still take bookings — a mistyped key must never stop the church booking
// people in, which is why turnstile.ts fails open.
await check('a CAPTCHA appears when configured', () => publicBookingPage({
  event: EVENT, fields: FIELDS, turnstileSitekey: '0xTESTKEY',
}), [
  'cf-turnstile', 'data-sitekey="0xTESTKEY"',
  'challenges.cloudflare.com/turnstile/v0/api.js',
  'not a robot',
  // Somebody with scripting off has to be told, not left pressing a dead button.
  '<noscript>',
]);

await check('and not when it is not', () => publicBookingPage({
  event: EVENT, fields: FIELDS,
}), ['Book my place'], ['cf-turnstile', 'challenges.cloudflare.com']);

await check('the event page says whether the CAPTCHA is on', () => eventAdminPage({
  event: EVENT, fields: FIELDS, bookings: [], ctx: CTX, origin: 'https://x.test', ...EV_EXTRA,
  captchaReady: true,
}), ['not a robot']);

await check('and warns when it is off', () => eventAdminPage({
  event: EVENT, fields: FIELDS, bookings: [], ctx: CTX, origin: 'https://x.test', ...EV_EXTRA,
  captchaReady: false,
}), ['There is no', 'anything — can submit the form']);

// --- taking a break, and guests ------------------------------------------
// Three ways somebody can be off a rota and they mean three different things,
// so the page has to tell them apart at the moment of ticking.
await check('the three boxes sit together', () => personPage({
  person: { ...WITH_ACCOUNT, on_break: 0, on_break_since: null, is_guest: 0 },
  roles, ctx: CTX,
}), ['Still serving', 'Taking a break', 'Guest',
     'name="on_break"', 'name="is_guest"']);

// Ticking the box must say what it will and will not do. The half that says
// what is NOT cancelled is the half that stops somebody finding out in November.
await check('somebody on a break is told what still stands', () => personPage({
  person: {
    ...WITH_ACCOUNT, on_break: 1, is_guest: 0,
    on_break_since: '2026-09-15 09:00:00',
    upcoming: [
      { service_id: 4, service_date: '2026-10-11', role_name: 'Preacher', status: 'confirmed' },
      { service_id: 9, service_date: '2026-11-08', role_name: 'Reader', status: 'draft' },
    ],
  },
  roles, ctx: CTX,
}), [
  'is taking a break', 'since Tue 15 Sep 2026',
  'will not be put on anything',
  // The confirmed one needs a person; the draft one does not.
  'Sun 11 Oct 2026 (Preacher)', 'Take off',
  '1 more', 'drop off by', 'Nothing to do',
  '/app/rota/service/4',
]);

// An empty list must not render the paragraph at all — an empty fixture cannot
// otherwise tell "nothing arranged" from "never queried", which is exactly how
// this half of the notice shipped dead the first time.
await check('a break with nothing arranged says nothing extra', () => personPage({
  person: {
    ...WITH_ACCOUNT, on_break: 1, is_guest: 0, on_break_since: '2026-09-15 09:00:00',
    upcoming: [],
  },
  roles, ctx: CTX,
}), ['is taking a break'], ['still down for', 'Nothing to do']);

await check('a guest is explained', () => personPage({
  person: { ...WITH_ACCOUNT, on_break: 0, on_break_since: null, is_guest: 1 },
  roles, ctx: CTX,
}), ['is a guest', 'never picks them on its own']);

// The People list has to tell the three states apart at a glance too.
await check('the people list marks breaks and guests', () => peoplePage([
  { id: 1, display_name: 'Pat', full_name: null, email: null, is_active: 1, is_admin: 0,
    needs_review: 0, review_note: null, happy_with_anyone: 1,
    on_break: 1, on_break_since: '2026-09-15', is_guest: 0,
    role_names: 'Preacher', role_count: 1 },
  { id: 2, display_name: 'Roger', full_name: null, email: null, is_active: 1, is_admin: 0,
    needs_review: 0, review_note: null, happy_with_anyone: 1,
    on_break: 0, on_break_since: null, is_guest: 1,
    role_names: 'Preacher', role_count: 1 },
  { id: 3, display_name: 'Sue', full_name: null, email: null, is_active: 1, is_admin: 0,
    needs_review: 0, review_note: null, happy_with_anyone: 1,
    on_break: 0, on_break_since: null, is_guest: 0,
    role_names: 'Reader', role_count: 1 },
], CTX), ['Taking a break', 'Guest', 'OK',
  // Searchable by state, so "who is on a break" is one thing to type.
  'taking a break', 'guest']);

// --- the rules a draft is built to ---------------------------------------
// Every figure on this page already existed: the generator derived it from the
// size of a team and refused people on it without ever saying so. The page's
// job is to say that plainly, because somebody who thinks they are adding a
// new rule will set it differently from somebody who knows they are correcting
// one that has been running all along.
await check('the draft rules page', () => draftRulesPage({
  roles: [
    { ...role(1, 'Preacher'), default_min_gap_days: 21, default_target_days: null },
    { ...role(2, 'Service leader'), default_min_gap_days: 28, default_target_days: 91 },
    { ...role(3, 'Reader', 2, 2), default_min_gap_days: null, default_target_days: null },
  ],
  rules: {
    any_role_gap: 'fortnight_prefer', max_roles_per_service: null,
    when_short: 'bend_both', fairness: 'balanced', list_every_empty_place: 0,
  },
  ctx: CTX,
}), [
  'Rules for draft rotas',
  'Preacher', 'Service leader', 'Reader',
  // 21 days reads back as 3 weeks, and 91 as 1 quarter — the unit somebody
  // would actually have typed, which is what toUnits() exists for.
  'value="3"', 'value="1"',
  'name="gapn_1"', 'name="targetn_2"',
  'Before someone', 'Most jobs one person may have at a single service',
  'If a service would still be short', 'Spreading the work out',
  // The framing that makes the whole page make sense.
  'These figures are not new',
  // The firm option has to be described as firm.
  'Never on two Sundays running',
]);

// The churchwarden's own "unless of course someone is doing them frequently",
// asked at the moment a tightened figure would push somebody off.
await check('tightening a rule names back who it would push off', () => draftRulesPage({
  roles: [{ ...role(1, 'Preacher'), default_min_gap_days: 28, default_target_days: null }],
  rules: {
    any_role_gap: 'fortnight_prefer', max_roles_per_service: 2,
    when_short: 'leave_empty', fairness: 'even', list_every_empty_place: 1,
  },
  ctx: CTX,
  affected: [{ role_id: 1, role_name: 'Preacher', people: [
    { id: 5, name: 'Steve', every: 14 },
  ] }],
}), [
  'already do these jobs more often',
  'Ask Steve as often as needed', 'about every 14 days',
  'value="1:5"',
  // The whole-rota rules come back selected as they were saved.
  'value="2"', 'Save these exceptions',
]);

// --- the worship team's own roster ---------------------------------------
const BAND = [
  { id: 1, display_name: 'Nat Dix' },
  { id: 2, display_name: 'Stu Dix' },
  { id: 3, display_name: 'Owen Price' },
];

await check('the worship roster', () => worshipPage({
  sundays: [
    {
      service_id: 1, service_date: '2026-09-20', service_time: '10:30',
      title: 'Worship', is_communion: 0,
      plan_id: 7, kind: 'live', notes: 'Two new songs — run through at 9.30.',
      leaders: ['Nat Dix'],
      slots: [
        { position: 'drums', person_id: 2, name: null },
        { position: 'singer1', person_id: null, name: 'A friend of Stu' },
      ],
    },
    {
      service_id: 2, service_date: '2026-09-27', service_time: '10:30',
      title: 'Worship', is_communion: 0,
      plan_id: null, kind: null, notes: null, leaders: [], slots: [],
    },
  ],
  people: BAND,
  ctx: CTX,
  savedId: 1,
}), [
  'Worship', 'Sun 20 Sep 2026', 'led by', 'Nat Dix',
  'Live worship', 'Worship lyrics',
  // Every position is offered, and the singers-only ones too.
  'Drums', 'Bass', 'Guitar', 'Keyboards', 'Singer 1', 'Singer 2', 'Singer 3',
  // Somebody not on the church roster can still be written down — a visiting
  // musician should not have to be added to the roster first.
  'Somebody not on the list', 'A friend of Stu',
  'Two new songs',
  // A week with nothing down is normal and must not read as a problem.
  'Nothing down yet', 'no worship leader on the rota yet',
  'Saved',
]);

// Seeing who is playing is useful to the whole team; changing it is the
// worship leader's job.
await check('a viewer sees the band but no form', () => worshipPage({
  sundays: [{
    service_id: 1, service_date: '2026-09-20', service_time: '10:30',
    title: 'Worship', is_communion: 0, plan_id: 7, kind: 'lyrics', notes: null,
    leaders: ['Nat Dix'],
    slots: [{ position: 'singer1', person_id: 3, name: null }],
  }],
  people: BAND,
  ctx: CTX,
  canEdit: false,
}), ['Owen Price', 'Singer 1'],
  // On a lyrics week there is no band to ask about, so the band positions are
  // not shown at all in the read-only view.
  ['Save this week', 'Drums', 'Keyboards']);

// --- what has changed lately ---------------------------------------------
// The case this exists for, in the churchwarden's own words: somebody says on
// their own page that they cannot preach on the 20th, and nobody finds out
// until the gap is noticed. It has to name the person, say what and when, and
// link through to the service it affects.
await check('the home page shows what has changed', () => homePage({
  ctx: CTX, gapCount: 0, isAdmin: true,
  now: new Date('2026-09-18T12:00:00Z'),
  activity: [
    { when: '2026-09-18 09:00:00', icon: '⚠️', tone: 'bad', who: 'Matt Wakerley',
      what: 'cannot do Preacher on Sun 20 Sep 2026 — still needs somebody',
      href: '/app/rota/service/4', area: 'rota' },
    { when: '2026-09-16 10:00:00', icon: '🏖️', tone: 'warn', who: 'Sue Baker',
      what: 'is away from Sun 4 Oct 2026 to Sun 11 Oct 2026 — holiday',
      href: '/app/rota/calendar', area: 'rota' },
    { when: '2026-09-15 10:00:00', icon: '⏸️', tone: 'warn', who: 'Pat Doyle',
      what: 'is taking a break, so will not be put on anything new', area: 'rota' },
  ],
}), [
  'Lately',
  'Matt Wakerley', 'cannot do Preacher on Sun 20 Sep 2026',
  '/app/rota/service/4',
  // A distance reads better than a date for something that just happened.
  'hours ago', '2 days ago', '3 days ago',
  'Sue Baker', 'Pat Doyle',
  // Urgency shows in the edge AND the words, never the colour alone.
  'recent-bad', 'recent-warn',
]);

// The panel is for things somebody has to DO something about. The church has
// some 760 room bookings, every one imported from Google Calendar in the same
// second, and when they were in here they buried every genuine change under a
// wall of "the main church is booked". An event EXISTING is news; sixty people
// booking a place at it is not.
await check('a room booking is not news', () => homePage({
  ctx: CTX, gapCount: 0, isAdmin: true,
  now: new Date('2026-09-18T12:00:00Z'),
  activity: [
    { when: '2026-09-18 09:00:00', icon: '⚠️', tone: 'bad', who: 'Don Ellie',
      what: 'cannot do Preacher on Sun 20 Sep 2026 — still needs somebody',
      href: '/app/rota/service/4', area: 'rota' },
    { when: '2026-09-17 09:00:00', icon: '🎟️', tone: 'ok', who: 'Harvest Supper',
      what: 'is on Sun 11 Oct 2026 and taking bookings',
      href: '/app/events/1', area: 'events' },
  ],
}), ['Don Ellie', 'cannot do Preacher', 'Harvest Supper', 'taking bookings'],
  // What must never come back. Chosen because each appears ONLY in a
  // room-booking row — 'Church Centre' and 'bookings' are both in the static
  // area tiles further down the page, so they would pass whatever happened.
  ['booked the', '/app/rooms/', '🚪']);

// A quiet week must not leave an empty box sitting there looking broken.
await check('and nothing at all on a quiet week', () => homePage({
  ctx: CTX, gapCount: 0, isAdmin: true, activity: [],
}), ['Welcome'], ['Lately', 'recent-list']);

// --- every kind of question renders its own control ----------------------
//
// This is the shape of a real bug: the renderer tested textarea, number,
// select and radio, and everything else fell off the end into a "Yes" tick.
// 'text' has no branch of its own, so "Do you have any food allergies?" — a
// REQUIRED short answer on a live event — was a checkbox, and the answer the
// question asked for could not be given at all.
//
// So every kind is asserted, and each one also asserts that it is NOT the
// control the bug produced. A test that only checked "does a text field render
// an input" would have passed while the checkbox sat there beside it.
{
  const field = (kind: string, over = {}) => ({
    id: 9, event_id: 1, key: 'q', label: 'The question', hint: null,
    kind: kind as any, options: JSON.stringify(['Beef', 'Vegetarian']),
    required: 1, sort_order: 0, ...over,
  });
  const render = (kind: string) => () => publicBookingPage({
    event: EVENT, fields: [field(kind)],
  });

  await check('a short answer is a text box', render('text'),
    ['type="text"', 'name="f_9"', 'required'],
    // The bug, named so it cannot come back quietly.
    ['type="checkbox"', 'check-label">Yes']);

  await check('a long answer is a textarea', render('textarea'),
    ['<textarea', 'name="f_9"'], ['type="checkbox"']);

  await check('a number is a number box', render('number'),
    ['type="number"', 'name="f_9"'], ['type="checkbox"']);

  await check('a list is a dropdown', render('select'),
    ['<select', 'Please choose', 'Beef', 'Vegetarian'], ['type="checkbox"']);

  await check('choose-one is radio buttons', render('radio'),
    ['type="radio"', 'Beef', 'Vegetarian'], ['type="checkbox"']);

  await check('and a tickbox really is a tickbox', render('checkbox'),
    ['type="checkbox"', 'Yes']);

  // A kind nobody recognises is a bug either way, but a text box still
  // captures what the person came to say. A checkbox throws it away and
  // stores the word "Yes".
  await check('an unknown kind falls back to a text box, not a tick',
    render('something-new'), ['type="text"'], ['type="checkbox"']);
}
// ---- events that run over a day -------------------------------------------
{
  const form = (o: Record<string, string>) => {
    const d = new FormData(); for (const [k, v] of Object.entries(o)) d.set(k, v); return d;
  };
  const when = (o: Record<string, string>, req = true) => JSON.stringify(readEventWhen(form(o), req));
  await check('a finish with no date is the same day', () =>
    when({ on_date: '2026-10-10', start_time: '19:00', end_time: '21:00' }),
    ['"endsAt":"2026-10-10T21:00"']);
  await check('an event can run into the next day', () =>
    when({ on_date: '2026-10-10', start_time: '19:00', end_date: '2026-10-11', end_time: '16:00' }),
    ['"startsAt":"2026-10-10T19:00"', '"endsAt":"2026-10-11T16:00"']);
  await check('an evening past midnight is told to move the finish date', () =>
    when({ on_date: '2026-10-10', start_time: '22:00', end_date: '2026-10-10', end_time: '01:00' }),
    ['set the finish date to the next day']);
  await check('a finish date before the start is refused', () =>
    when({ on_date: '2026-10-10', start_time: '19:00', end_date: '2026-10-09', end_time: '21:00' }),
    ['before the start date']);
  await check('a mistyped year is caught', () =>
    when({ on_date: '2026-10-10', start_time: '19:00', end_date: '2027-10-10', end_time: '21:00' }),
    ['check the year']);
  await check('an older event may still have no finish', () =>
    when({ on_date: '2026-10-10', start_time: '19:00', end_date: '2026-10-10', end_time: '' }, false),
    ['"endsAt":null']);
  await check('a finish date moved without a time is not silently dropped', () =>
    when({ on_date: '2026-10-10', start_time: '19:00', end_date: '2026-10-11', end_time: '' }, false),
    ['Give the time it finishes on that day']);
  await check('fourteen days is the most, counted Saturday-to-Sunday as two', () => [
    JSON.parse(when({ on_date: '2026-10-10', start_time: '09:00', end_date: '2026-10-23', end_time: '17:00' })).ok,
    JSON.parse(when({ on_date: '2026-10-10', start_time: '09:00', end_date: '2026-10-24', end_time: '17:00' })).ok,
  ].join(','), ['true,false']);
  await check('fourteen days ending at midnight is still fourteen days', () =>
    String(JSON.parse(when({ on_date: '2026-10-01', start_time: '09:00', end_date: '2026-10-15', end_time: '00:00' })).ok),
    ['true']);
  await check('an evening that ends at midnight is still one evening', () => [
    formatSpan('2026-10-10T19:00', '2026-10-11T00:00'),
    String(runsOver({ starts_at: '2026-10-10T19:00', ends_at: '2026-10-11T00:00' })),
    String(runsOver({ starts_at: '2026-10-10T19:00', ends_at: '2026-10-11T16:00' })),
  ].join(' | '), ['Sat 10 Oct 2026, 19:00–midnight | false | true']);
  await check('but a new one must', () =>
    when({ on_date: '2026-10-10', start_time: '19:00' }), ['Give the time it finishes']);

  await check('the span reads naturally', () => [
    formatSpan('2026-10-10T19:00', '2026-10-10T21:00'),
    formatSpan('2026-10-10T19:00', '2026-10-11T16:00'),
    formatSpan('2026-10-10T19:00', null),
  ].join(' | '), ['Sat 10 Oct 2026, 19:00–21:00 | Sat 10 Oct 2026 19:00 to Sun 11 Oct 2026 16:00 | Sat 10 Oct 2026 at 19:00']);

  const hold = { starts_at: '2026-10-10T19:00', ends_at: '2026-10-12T16:00' };
  await check('a three-day hold covers three days', () => [
    daysCovered(hold).join(','),
    timeOnDay(hold, '2026-10-10'), timeOnDay(hold, '2026-10-11'), timeOnDay(hold, '2026-10-12'),
    daysCovered({ starts_at: '2026-10-10T19:00', ends_at: '2026-10-11T00:00' }).join(','),
  ].join(' | '), ['2026-10-10,2026-10-11,2026-10-12 | from 19:00 | all day | until 16:00 | 2026-10-10']);

  const WEEKEND = { ...BOOKING, id: 77, title: 'Weekend away', starts_at: '2026-11-20T19:00',
    ends_at: '2026-11-22T16:00', event_id: 5 };
  await check('the diary shows a held room on every day it covers', async () => {
    const out = String(await roomsPage({ rooms: ROOMS, bookings: [WEEKEND], series: [], ctx: CTX, weekFrom: '2026-11-18' }));
    const days = ['Fri 20 Nov 2026', 'Sat 21 Nov 2026', 'Sun 22 Nov 2026'].filter((d) => out.includes(d)).length;
    return days === 3 ? out : `only ${days} days`;
  }, ['from 19:00', 'all day', 'until 16:00', 'Fri 20 Nov 2026 19:00 to Sun 22 Nov 2026 16:00']);
  await check('a hold that began before the window still shows on the days inside it', () =>
    roomsPage({ rooms: ROOMS, bookings: [WEEKEND], series: [], ctx: CTX, weekFrom: '2026-11-21' }),
    ['Sat 21 Nov 2026', 'Sun 22 Nov 2026', 'until 16:00'], ['Fri 20 Nov 2026</h3>']);
  await check('a held room is never cancelled from the diary', () =>
    roomsPage({ rooms: ROOMS, bookings: [WEEKEND], series: [], ctx: CTX, weekFrom: '2026-11-18' }),
    ['Held for an event', 'href="/app/events/5"'], ['/app/rooms/77/cancel']);
  await check('the room calendar puts a held room on each of its days', async () => {
    const out = String(await roomsCalendarPage({ rooms: ROOMS, roomId: null, bookings: [WEEKEND],
      counts: new Map(), month: '2026-11', ctx: CTX }));
    return (out.match(/Weekend away/g) ?? []).length >= 3 ? out : 'fewer than three days';
  }, ['from 19:00', 'all day', 'until 16:00']);
  await check('a room the event has let go says so, and offers no form', () =>
    editBookingPage({ booking: { ...WEEKEND, status: 'cancelled' }, rooms: ROOMS, ctx: CTX }),
    ['has since been let go', 'href="/app/events/5"'], ['name="to_time"', 'is held for the event']);
  await check('a room held for an event is changed on the event', () =>
    editBookingPage({ booking: WEEKEND, rooms: ROOMS, ctx: CTX }),
    ['held for the event', 'href="/app/events/5"', 'Fri 20 Nov 2026 19:00 to Sun 22 Nov 2026 16:00'],
    ['name="to_time"']);
  await check('the event form asks for a finish date, defaulting to the start', () => newEventPage({
    ctx: CTX, rooms: [], form: { on_date: '2026-10-10' },
  }), ['name="end_date"', 'id="n_end_date" name="end_date" type="date" value="2026-10-10"', 'Finishes on']);
  await check('an event running over says so on its booking page', () => publicBookingPage({
    event: { ...EVENT, starts_at: '2026-10-10T19:00', ends_at: '2026-10-11T16:00' }, fields: [],
  }), ['Sat 10 Oct 2026 19:00 to Sun 11 Oct 2026 16:00']);

  const ctxFor = { name: 'Sue', eventTitle: 'Weekend away', eventDate: 'Sat 10 Oct 2026 to Sun 11 Oct 2026',
    eventTime: '19:00', eventWhen: 'Sat 10 Oct 2026 19:00 to Sun 11 Oct 2026 16:00', location: 'Church Centre', partySize: 2 };
  await check('the old stock email wording gives the whole span', () =>
    fillPlaceholders('It is on {date} at {time}, at {where}.', ctxFor),
    ['It is on Sat 10 Oct 2026 19:00 to Sun 11 Oct 2026 16:00, at Church Centre.']);
  await check('and the new default uses it too', () => fillPlaceholders(DEFAULT_ACK_BODY, ctxFor),
    ['It is on Sat 10 Oct 2026 19:00 to Sun 11 Oct 2026 16:00, at Church Centre.']);
}

// ---- the safeguarding report ----------------------------------------------
{
  const REPORT = [
    { personId: 1, name: 'Sue Baker', roles: ['Churchwarden'], courses: [
      { courseId: 1, name: 'Basic Awareness', state: 'done' as const, doneAt: '2026-09-01 10:00:00' },
      { courseId: 2, name: 'Foundation', state: 'not_yet' as const, doneAt: null }] },
    { personId: 2, name: 'Ron Hale', roles: ['PCC member'], courses: [
      { courseId: 1, name: 'Basic Awareness', state: 'unanswered' as const, doneAt: null }] },
    { personId: 3, name: 'Ann Lee', roles: ['PCC member'], courses: [
      { courseId: 1, name: 'Basic Awareness', state: 'done' as const, doneAt: '2026-08-01 10:00:00' }] },
  ];
  await check('the safeguarding report', () => safeguardingReportPage(SG_GRID, REPORT, CTX),
    ['Who has done what', 'aria-current="page"', 'Sue Baker', 'Tue 1 Sep 2026', 'Not yet', 'Not answered',
     'Still to do', '1 to do', 'Download PDF', 'report.xlsx', 'their roles do not need that course'],
    ['DBS Check']);
  await check('the report tab, not the menu, is the one marked current', async () => {
    const out = String(await safeguardingReportPage(SG_GRID, REPORT, { ...CTX, path: '/app/settings/safeguarding/report' }));
    return /href="\/app\/settings\/safeguarding\/report"\s+aria-current="page"/.test(out) ? out : 'report tab not marked';
  }, ['Who has done what']);
  await check('the grid has the report tab too', () => safeguardingPage(SG_GRID, CTX),
    ['Courses each role needs', 'href="/app/settings/safeguarding/report"']);
  await check('a report with nobody in it says how to start', () => safeguardingReportPage(SG_GRID, [], CTX),
    ['Nobody has a safeguarding role yet']);
}

console.log(failures === 0 ? '\nAll views rendered.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
