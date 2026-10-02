import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  clearSessionCookie,
  hashPassword,
  newSessionId,
  sessionCookie,
  sessionExpiry,
  verifyPassword,
} from './auth.js';
import {
  countAdmins,
  countServicesWithGaps,
  getServiceDetail, getServiceDetails,
  listUpcomingServices,
  getRotaRules,
  listCandidatesForRole,
  saveRotaRules,
  listCombinations,
  type Candidate,
  listCombinationsForRole,
  saveCombinationsForRole,
  listPairings,
  listPeople,
  listPeopleForRole,
  listRoles,
  personForSession,
  type Env,
  type ServiceDetail,
  type SessionPerson,
} from './db.js';
import { homePage } from './views/home.js';
import { setupPage, signInPage } from './views/signin.js';
import { combinationsPage, pairsPage, peoplePage, rolesPage, settingsHomePage, keyholdersPage,
         type KeyholderRow } from './views/settings.js';
import { combinationsByRolePage } from './views/combinations.js';
import { draftRulesPage } from './views/draftrules.js';
import { worshipPage } from './views/worship.js';
import { recentActivity } from './activity.js';
import { listWorshipSundays, saveWorshipPlan, POSITIONS } from './worship.js';
import { gapsPage, readingsPage, rotaDashboard, servicePage } from './views/rota.js';
import { servicesPage, type ServiceListRow, type ServiceTypeOption } from './views/services.js';
import { generateFormPage, previewPage, type PreviewService } from './views/generate.js';
import { personPage, mergePage } from './views/person.js';
import { profilesPage, addPersonPage, changePasswordPage } from './views/profiles.js';
import { peopleByRolePage } from './views/byrole.js';
import { noAccessPage } from './views/noaccess.js';
import { AREA_KEYS, areaForPath, areasForPerson, listProfiles, mayAccess,
         suggestUsername, temporaryPassword } from './access.js';
import { readUnitPair } from './frequency.js';
import { roomsPage, editBookingPage, editSeriesPage, clashNotice } from './views/rooms.js';
import { roomSettingsPage, type RoomSettingRow } from './views/roomsettings.js';
import { listRooms, listBookings, getBooking, findClashes, readBooking, instants,
         listSeries, planSeries, getSeries, applySeriesEdit, type BookingInput } from './rooms.js';
import { FREQUENCIES, describeSeries, type Frequency } from './recurrence.js';
import { eventsListPage, newEventPage, eventAdminPage, publicBookingPage, bookingDonePage,
         bookingEditPage, formatWhen, runsOver } from './views/events.js';
import { myRotaPage, requestsPage, type MyDuty, type AwayRow, type ChangeRequestRow } from './views/me.js';
import { roomsCalendarPage, rotaCalendarPage } from './views/calendars.js';
import { thisMonth } from './views/calendar.js';
import { verifyTurnstile, turnstileReady } from './turnstile.js';
import { listEvents, getEvent, getEventBySlug, listFields, listBookings as listEventBookings,
         makeSlug, fieldKey, readBookingForm, hasRoom,
         getBooking as getEventBooking, saveBooking, type BookingAttempt,
         listOrganisers, readOrganisers, saveOrganisers, eventRoomIds, readRoomIds,
         eventRoomClashes, describeClashes, syncEventRooms, readEventWhen } from './events.js';
import { sendAcknowledgement, sendEmail, notifyOrganisers, DEFAULT_ACK_SUBJECT, DEFAULT_ACK_BODY } from './email.js';
import { formatDate, lastDay } from './views/rota.js';
import { generateRota } from './rota/generate.js';
import { loadGeneratorInput } from './rota/load.js';
import { rotaXlsx, rotaPdf } from './export/rota.js';
import { loadGrid as loadSgGrid, saveGrid as saveSgGrid, loadPerson as loadSgPerson,
         savePerson as saveSgPerson, loadReport as loadSgReport } from './safeguarding.js';
import { safeguardingXlsx, safeguardingPdf } from './export/safeguarding.js';
import { safeguardingPage, safeguardingReportPage } from './views/safeguarding.js';
import { readKeys } from './keyholders.js';
import { loadFormSettings, listPublicRooms, busyBetween, readRequest, createRequest, approveRequest,
         declineRequest, listPendingRequests, receivedEmail, officeEmail, decisionEmail, hashAddress,
         getRequestByReceipt, type RequestRow } from './roomRequests.js';
import { publicRoomRequestPage, requestClosedPage, requestReceivedPage,
         bookingFormSettingsPage } from './views/roomRequests.js';
import { attendeesXlsx, attendeesPdf } from './export/attendees.js';
import { sundaysBetween, createSundays, provisionalSundays, chunked,
         type SundayPlan } from './services.js';

type Vars = { person: SessionPerson; areas: Set<string> };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

/** A capability URL must not escape via the Referer header, and none of this is
 *  for search engines. */
app.use('*', async (c, next) => {
  await next();
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Content-Type-Options', 'nosniff');
  if (c.req.path.startsWith('/app') || c.req.path.startsWith('/admin')) {
    c.header('X-Robots-Tag', 'noindex');
    c.header('Cache-Control', 'no-store');
  }
});

function readCookie(c: Context, name: string): string | null {
  const raw = c.req.header('Cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/** Populates c.var.person, or redirects to sign-in keeping the intended path. */
async function requireSignIn(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  const sid = readCookie(c, SESSION_COOKIE);
  const person = sid ? await personForSession(c.env.DB, sid) : null;
  if (!person) {
    const next_ = encodeURIComponent(c.req.path);
    return c.redirect(`/auth/sign-in?next=${next_}`, 302);
  }
  c.set('person', person);

  // Somebody signed in with a temporary password can reach nothing but the form
  // that changes it. A temporary password must not quietly become a permanent
  // one just because its owner never visited their settings.
  const temp = await c.env.DB.prepare(
    'SELECT must_change FROM credentials WHERE person_id = ?1',
  ).bind(person.id).first<{ must_change: number }>();
  if (temp?.must_change && !c.req.path.startsWith('/auth/')) {
    return c.redirect('/auth/change-password', 302);
  }

  const areas = await areasForPerson(c.env.DB, person.id);
  c.set('areas', areas);

  // One check for every page, rather than a gate remembered per route. A route
  // added later is covered by default — and covered CLOSED, since a path with no
  // rule needs only a sign-in while anything under a known prefix needs its area.
  if (!mayAccess(areas, c.req.path, c.req.method)) {
    return c.html(noAccessPage(viewCtx(c), areaForPath(c.req.path)), 403);
  }

  await next();
  return undefined;
}

async function requireAdmin(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  // Kept as a belt-and-braces second check on the settings routes; the profile
  // check in requireSignIn is what does the real work.
  if (!(c.get('areas') ?? new Set()).has('settings')) {
    return c.html(noAccessPage(viewCtx(c), 'settings'), 403);
  }
  await next();
  return undefined;
}

/** The chrome context every signed-in page needs. Built per request. */
function viewCtx(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const p = c.get('person');
  const areas = c.get('areas') ?? new Set<string>();
  return {
    signedInAs: p.display_name,
    // "Admin" for the menu's purposes means being able to reach Settings.
    isAdmin: areas.has('settings'),
    path: c.req.path,
    areas,
  };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/api/health', async (c) => {
  // Touch D1 so the check fails if the binding or the database is wrong, rather
  // than reporting healthy while every real page 500s.
  let db = 'ok';
  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch (e) {
    db = e instanceof Error ? e.message : 'error';
  }
  return c.json({ ok: db === 'ok', service: 'bream-church-rota', db, time: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// First-run bootstrap
// ---------------------------------------------------------------------------

/**
 * Creates the first administrator. Two independent conditions must both hold:
 * there is no administrator yet, AND the caller presents the bootstrap secret.
 * The "no admin yet" test comes first, so leaving the secret set after setup
 * cannot be used to quietly add a second administrator.
 */
async function bootstrapAllowed(env: Env, presented: string | undefined) {
  if ((await countAdmins(env.DB)) > 0) return false;
  const secret = env.ADMIN_BOOTSTRAP_TOKEN;
  if (!secret || !presented) return false;
  // Constant-time-ish: compare full length regardless of where they differ.
  if (secret.length !== presented.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ presented.charCodeAt(i);
  return diff === 0;
}

app.get('/admin/setup', async (c) => {
  const token = c.req.query('token');
  if (!(await bootstrapAllowed(c.env, token))) return c.notFound();
  return c.html(setupPage(token!));
});

app.post('/admin/setup', async (c) => {
  const form = await c.req.formData();
  const token = String(form.get('token') ?? '');
  if (!(await bootstrapAllowed(c.env, token))) return c.notFound();

  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const password2 = String(form.get('password2') ?? '');

  if (!name || !email) return c.html(setupPage(token, 'Name and email are both needed.'), 400);
  if (password !== password2) return c.html(setupPage(token, 'The two passwords did not match.'), 400);

  let stored;
  try {
    stored = await hashPassword(password);
  } catch (e) {
    return c.html(setupPage(token, e instanceof Error ? e.message : 'That password was rejected.'), 400);
  }

  // Reuse an imported person of the same name if there is one, so the vicar does
  // not end up in the roster twice.
  const existing = await c.env.DB.prepare(
    'SELECT id FROM people WHERE lower(display_name) = lower(?1) AND email IS NULL LIMIT 1',
  ).bind(name).first<{ id: number }>();

  let personId: number;
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE people SET full_name=?2, email=?3, is_admin=1, needs_review=0, review_note=NULL,
              updated_at=datetime('now') WHERE id=?1`,
    ).bind(existing.id, name, email).run();
    personId = existing.id;
  } else {
    const ins = await c.env.DB.prepare(
      `INSERT INTO people (display_name, full_name, email, is_admin) VALUES (?1, ?1, ?2, 1)`,
    ).bind(name, email).run();
    personId = Number(ins.meta.last_row_id);
  }

  await c.env.DB.prepare(
    `INSERT INTO credentials (person_id, password_hash, salt, iterations)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(person_id) DO UPDATE SET
       password_hash=excluded.password_hash, salt=excluded.salt,
       iterations=excluded.iterations, updated_at=datetime('now')`,
  ).bind(personId, stored.password_hash, stored.salt, stored.iterations).run();

  const sid = newSessionId();
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, person_id, expires_at) VALUES (?1, ?2, ?3)',
  ).bind(sid, personId, sessionExpiry()).run();

  c.header('Set-Cookie', sessionCookie(sid, SESSION_MAX_AGE_SECONDS));
  return c.redirect('/app', 303);
});

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

app.get('/auth/sign-in', (c) => c.html(signInPage({ next: c.req.query('next') })));

app.post('/auth/sign-in', async (c) => {
  const form = await c.req.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/app');

  // Either a username or an email address. Volunteers are given a username
  // because most of them have no email on file; administrators set themselves up
  // with an address. Accepting both means nobody has to remember which they have.
  const row = await c.env.DB.prepare(
    `SELECT p.id, c.password_hash, c.salt, c.iterations
       FROM people p JOIN credentials c ON c.person_id = p.id
      WHERE (lower(p.email) = ?1 OR lower(p.username) = ?1) AND p.is_active = 1`,
  ).bind(email).first<{ id: number; password_hash: string; salt: string; iterations: number }>();

  // Same message and broadly the same work either way, so the form cannot be
  // used to find out which addresses exist.
  const ok = row ? await verifyPassword(password, row) : false;
  if (!row || !ok) {
    return c.html(signInPage({ error: 'That email and password did not match.', next }), 401);
  }

  const sid = newSessionId();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO sessions (id, person_id, expires_at) VALUES (?1, ?2, ?3)')
      .bind(sid, row.id, sessionExpiry()),
    // Stamped here rather than on every request: the person page wants "last
    // signed in", not "last clicked something", and a write per page view would
    // be a lot of writes for a number nobody reads that often.
    c.env.DB.prepare("UPDATE credentials SET last_sign_in_at = datetime('now') WHERE person_id = ?1")
      .bind(row.id),
  ]);

  c.header('Set-Cookie', sessionCookie(sid, SESSION_MAX_AGE_SECONDS));
  // Only ever redirect within this site.
  return c.redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/app', 303);
});

app.post('/auth/sign-out', async (c) => {
  const sid = readCookie(c, SESSION_COOKIE);
  if (sid) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(sid).run();
  c.header('Set-Cookie', clearSessionCookie());
  return c.redirect('/', 303);
});

/**
 * Choosing a password.
 *
 * This is where requireSignIn sends anybody still holding the temporary
 * password they were given, so it deliberately sits OUTSIDE that middleware —
 * it is the one page such a person is allowed to reach, and putting it behind
 * the gate that redirects here would be a loop.
 */
async function personFromCookie(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const sid = readCookie(c, SESSION_COOKIE);
  return sid ? await personForSession(c.env.DB, sid) : null;
}

async function mustChange(db: D1Database, personId: number): Promise<boolean> {
  const row = await db.prepare('SELECT must_change FROM credentials WHERE person_id = ?1')
    .bind(personId).first<{ must_change: number }>();
  return Boolean(row?.must_change);
}

app.get('/auth/change-password', async (c) => {
  const person = await personFromCookie(c);
  if (!person) return c.redirect('/auth/sign-in?next=%2Fauth%2Fchange-password', 302);
  return c.html(changePasswordPage({ forced: await mustChange(c.env.DB, person.id) }));
});

app.post('/auth/change-password', async (c) => {
  const person = await personFromCookie(c);
  if (!person) return c.redirect('/auth/sign-in?next=%2Fauth%2Fchange-password', 302);

  const forced = await mustChange(c.env.DB, person.id);
  const form = await c.req.formData();
  const current = String(form.get('current') ?? '');
  const password = String(form.get('password') ?? '');
  const password2 = String(form.get('password2') ?? '');

  const fail = (error: string, status: 400 | 401 = 400) =>
    c.html(changePasswordPage({ forced, error }), status);

  const stored = await c.env.DB.prepare(
    'SELECT password_hash, salt, iterations FROM credentials WHERE person_id = ?1',
  ).bind(person.id).first<{ password_hash: string; salt: string; iterations: number }>();
  if (!stored) return fail('This account has no password set. Ask an administrator to reset it.');

  if (!await verifyPassword(current, stored)) {
    return fail('That is not your current password. Check it and try again.', 401);
  }
  // Length is checked here as well as by minlength on the input, because the
  // browser attribute is a convenience and not a control.
  if (password.length < 12) return fail('Your new password needs to be at least 12 characters.');
  if (password !== password2) return fail('The two new passwords do not match. Type them again.');
  if (password === current) return fail('That is the password you already have. Pick a different one.');

  const hashed = await hashPassword(password);
  await c.env.DB.prepare(
    `UPDATE credentials
        SET password_hash = ?2, salt = ?3, iterations = ?4, must_change = 0
      WHERE person_id = ?1`,
  ).bind(person.id, hashed.password_hash, hashed.salt, hashed.iterations).run();

  // Every other sign-in for this person is ended. A temporary password gets read
  // out over the phone, and whoever overheard it must not still be signed in
  // after the real owner has changed it.
  const sid = readCookie(c, SESSION_COOKIE);
  await c.env.DB.prepare('DELETE FROM sessions WHERE person_id = ?1 AND id IS NOT ?2')
    .bind(person.id, sid).run();

  return c.redirect('/app?password=changed', 303);
});

// ---------------------------------------------------------------------------
// The app
// ---------------------------------------------------------------------------

app.use('/app/*', requireSignIn);
app.use('/app', requireSignIn);

app.get('/app', async (c) => {
  const person = c.get('person');
  const [gaps, activity] = await Promise.all([
    countServicesWithGaps(c.env.DB),
    // Filtered by what this person may open, so nobody is shown a change they
    // cannot act on or a link that would refuse them.
    recentActivity(c.env.DB, c.get('areas') ?? new Set()),
  ]);
  return c.html(
    homePage({ ctx: viewCtx(c), gapCount: gaps, isAdmin: !!person.is_admin, activity }),
  );
});

app.use('/app/settings', requireAdmin);
app.use('/app/settings/*', requireAdmin);

// Building the rota, and the settings behind it, are administrator jobs. Without
// these any signed-in volunteer could generate and apply a whole new rota over
// the top of the real one.
app.use('/app/rota/generate', requireAdmin);
app.use('/app/rota/generate/*', requireAdmin);
app.use('/app/rota/readings', requireAdmin);
app.use('/app/rota/requests', requireAdmin);
app.use('/app/rota/requests/*', requireAdmin);
app.use('/app/rota/service/:id/role/*', requireAdmin);

app.get('/app/settings', (c) => c.html(settingsHomePage(viewCtx(c))));

app.get('/app/settings/people', async (c) =>
  c.html(peoplePage(await listPeople(c.env.DB), viewCtx(c))));

app.get('/app/settings/safeguarding', async (c) =>
  c.html(safeguardingPage(await loadSgGrid(c.env.DB), viewCtx(c))));

app.get('/app/settings/safeguarding/report', async (c) => {
  const grid = await loadSgGrid(c.env.DB);
  return c.html(safeguardingReportPage(grid, await loadSgReport(c.env.DB, grid), viewCtx(c)));
});

app.get('/app/settings/safeguarding/report.xlsx', async (c) => {
  const grid = await loadSgGrid(c.env.DB);
  const today = new Date().toISOString().slice(0, 10);
  return download(safeguardingXlsx(grid, await loadSgReport(c.env.DB, grid), today),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `safeguarding-report-${today}.xlsx`);
});

app.get('/app/settings/safeguarding/report.pdf', async (c) => {
  const grid = await loadSgGrid(c.env.DB);
  const today = new Date().toISOString().slice(0, 10);
  return download(await safeguardingPdf(grid, await loadSgReport(c.env.DB, grid), today),
    'application/pdf', `safeguarding-report-${today}.pdf`);
});

app.post('/app/settings/safeguarding', async (c) => {
  const grid = await loadSgGrid(c.env.DB);
  const n = await saveSgGrid(c.env.DB, grid, await c.req.formData());
  return c.html(safeguardingPage(await loadSgGrid(c.env.DB), viewCtx(c), {
    tone: 'ok', text: `Saved. ${n} course${n === 1 ? " is" : "s are"} now required across the roles.`,
  }));
});

app.get('/app/settings/keyholders', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, display_name, full_name, email, phone, is_active, keyholder_since, keyholder_note,
            keyholder_keys
       FROM people WHERE is_keyholder = 1
      ORDER BY is_active DESC, display_name`,
  ).all<KeyholderRow>();
  return c.html(keyholdersPage(results, viewCtx(c)));
});

// ---- merge duplicates -----------------------------------------------------

/** Groups of people the import thinks may be the same person, built from the
 *  review notes written when the roster was extracted. */
async function mergeGroups(db: D1Database) {
  const { results } = await db.prepare(
    `SELECT p.id, p.display_name, p.needs_review, p.review_note,
            (SELECT COUNT(*) FROM assignments a WHERE a.person_id = p.id) AS done
       FROM people p WHERE p.is_active = 1
      ORDER BY p.display_name`,
  ).all<{ id: number; display_name: string; needs_review: number; review_note: string | null; done: number }>();

  // A person is grouped with anyone whose name is a prefix of theirs, which is
  // exactly the shape of the real duplicates: Andy / Andy E / Andy Ewens.
  const byRoot = new Map<string, typeof results>();
  for (const p of results) {
    if (!p.needs_review) continue;
    const root = p.display_name.split(/\s+/)[0]!.toLowerCase();
    byRoot.set(root, [...(byRoot.get(root) ?? []), p]);
  }
  return [...byRoot.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([root, list]) => ({
      suggestion: `${root.charAt(0).toUpperCase()}${root.slice(1)} — ${list.length} records`,
      people: list.sort((a, b) => b.done - a.done),
    }));
}

async function mergeView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const [groups, all] = await Promise.all([
    mergeGroups(c.env.DB),
    c.env.DB.prepare(
      `SELECT p.id, p.display_name,
              (SELECT COUNT(*) FROM assignments a WHERE a.person_id = p.id) AS done
         FROM people p WHERE p.is_active = 1 ORDER BY p.display_name`,
    ).all<{ id: number; display_name: string; done: number }>(),
  ]);
  return c.html(mergePage({ groups, all: all.results, ctx: viewCtx(c), notice }));
}

app.get('/app/settings/people/merge', (c) => mergeView(c));

/**
 * "Not a duplicate" — clears the flag and leaves the person alone.
 *
 * The import flags anyone whose name could be somebody else's, but plenty of
 * those really are different people: Chris L and Chris B, Sally C and Sally H.
 * Without this the only way to stop the warning was to merge two people who are
 * not the same, which is worse than the warning.
 *
 * Clearing the flag also lets the generator use them again — it skips anyone
 * still flagged, because it cannot tell which person a first name means.
 */
app.post('/app/settings/people/:id/not-duplicate', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const person = await c.env.DB.prepare('SELECT display_name FROM people WHERE id = ?1')
    .bind(id).first<{ display_name: string }>();
  if (!person) return c.notFound();

  await c.env.DB.prepare(
    'UPDATE people SET needs_review = 0, review_note = NULL WHERE id = ?1',
  ).bind(id).run();

  return mergeView(c, {
    tone: 'ok',
    text: `${person.display_name} is their own person. They will be used when a rota is generated.`,
  });
});

app.post('/app/settings/people/not-duplicates', async (c) => {
  const form = await c.req.formData();
  const ids = form.getAll('group_ids').map(Number).filter(Number.isInteger);
  if (!ids.length) return mergeView(c, { tone: 'bad', text: 'Nothing was selected.' });

  const qs = ids.map((_, i) => `?${i + 1}`).join(',');
  await c.env.DB.prepare(
    `UPDATE people SET needs_review = 0, review_note = NULL WHERE id IN (${qs})`,
  ).bind(...ids).run();

  return mergeView(c, {
    tone: 'ok',
    text: `${ids.length} people marked as separate. They will all be used when a rota is generated.`,
  });
});


/**
 * Folds one or more duplicate person records into the one being kept.
 *
 * Shared between Settings → Merge duplicates and the "this is me" button on My
 * dates, because they are the same operation reached from two places — somebody
 * whose sign-in name does not match their rota name has exactly the duplicate
 * problem the merge tool exists for.
 *
 * EVERY placeholder is numbered and none is left bare. Mixing the two forms is
 * what broke this the first time: SQLite gives a bare `?` the next index ABOVE
 * the highest already seen, so `SET person_id = ?3 WHERE person_id IN (?,?)`
 * wants five parameters while the code binds three.
 */
async function mergePeople(db: D1Database, keepId: number, mergeIds: number[]) {
  const ids = mergeIds.map((_, i) => `?${i + 1}`).join(',');
  const keepP = `?${mergeIds.length + 1}`;
  const params = [...mergeIds, keepId];

  await db.batch([
    // Where the kept person is already on the same role at the same service,
    // moving the duplicate across would put one person in a role twice.
    db.prepare(
      `DELETE FROM assignments
        WHERE person_id IN (${ids})
          AND EXISTS (SELECT 1 FROM assignments k
                       WHERE k.service_id = assignments.service_id
                         AND k.role_id    = assignments.role_id
                         AND k.person_id  = ${keepP})`,
    ).bind(...params),
    db.prepare(
      `UPDATE assignments SET person_id = ${keepP} WHERE person_id IN (${ids})`,
    ).bind(...params),
    db.prepare(
      `INSERT OR IGNORE INTO person_roles (person_id, role_id, can_do, willing,
              max_per_period, period_days, min_gap_days)
       SELECT ${keepP}, role_id, MAX(can_do), MAX(willing),
              MAX(max_per_period), MAX(period_days), MIN(min_gap_days)
         FROM person_roles WHERE person_id IN (${ids}) GROUP BY role_id`,
    ).bind(...params),
    db.prepare(
      `UPDATE unavailability SET person_id = ${keepP} WHERE person_id IN (${ids})`,
    ).bind(...params),
    // Pairings are normalised (lower id first) and unique, so repointing one can
    // collide with an existing row or pair somebody with themselves. Dropping
    // them is the honest option; they are quick to set again.
    db.prepare(
      `DELETE FROM pairings WHERE person_a_id IN (${ids}) OR person_b_id IN (${ids})`,
    ).bind(...mergeIds),
    db.prepare(`DELETE FROM people WHERE id IN (${ids})`).bind(...mergeIds),
    db.prepare(
      'UPDATE people SET needs_review = 0, review_note = NULL WHERE id = ?1',
    ).bind(keepId),
  ]);
}

app.post('/app/settings/people/merge', async (c) => {
  const form = await c.req.formData();
  const keepId = Number(form.get('keep_id'));
  const mergeIds = form.getAll('merge_ids').map(Number)
    .filter((n) => Number.isInteger(n) && n !== keepId);

  const render = (tone: 'ok' | 'bad', text: string) => mergeView(c, { tone, text });

  if (!Number.isInteger(keepId) || !mergeIds.length) {
    return render('bad', 'Choose one person to keep and at least one other to merge into them.');
  }

  const keep = await c.env.DB.prepare('SELECT display_name FROM people WHERE id = ?1')
    .bind(keepId).first<{ display_name: string }>();
  if (!keep) return render('bad', 'That person no longer exists.');

  // EVERY placeholder here is numbered, and none is left bare.
  //
  // Mixing the two forms is what broke this the first time round: SQLite gives a
  // bare `?` the next index ABOVE the highest already seen, so in
  // `SET person_id = ?3 WHERE person_id IN (?,?)` the two bare marks become ?4
  // and ?5 — the statement then wants five parameters while the code binds
  // three, and the whole merge fails. Numbering them explicitly also means the
  // same value can be referenced twice without binding it twice.
  const ids = mergeIds.map((_, i) => `?${i + 1}`).join(',');
  const keepP = `?${mergeIds.length + 1}`;
  const params = [...mergeIds, keepId];

  // Order matters. Assignments move first; capabilities are unioned so the kept
  // record ends up able to do everything any of the duplicates could; pairings
  // are dropped rather than repointed. Deleting the duplicates last lets the
  // foreign keys clean up anything missed.
  const steps: { label: string; stmt: D1PreparedStatement }[] = [
    {
      // Where the kept person is ALREADY on the same role at the same service,
      // moving the duplicate across would put one person in a role twice.
      label: 'removing duplicate assignments',
      stmt: c.env.DB.prepare(
        `DELETE FROM assignments
          WHERE person_id IN (${ids})
            AND EXISTS (SELECT 1 FROM assignments k
                         WHERE k.service_id = assignments.service_id
                           AND k.role_id    = assignments.role_id
                           AND k.person_id  = ${keepP})`,
      ).bind(...params),
    },
    {
      label: 'moving their history across',
      stmt: c.env.DB.prepare(
        `UPDATE assignments SET person_id = ${keepP} WHERE person_id IN (${ids})`,
      ).bind(...params),
    },
    {
      label: 'combining what they can do',
      stmt: c.env.DB.prepare(
        `INSERT OR IGNORE INTO person_roles (person_id, role_id, can_do, willing,
                max_per_period, period_days, min_gap_days)
         SELECT ${keepP}, role_id, MAX(can_do), MAX(willing),
                MAX(max_per_period), MAX(period_days), MIN(min_gap_days)
           FROM person_roles WHERE person_id IN (${ids}) GROUP BY role_id`,
      ).bind(...params),
    },
    {
      label: 'moving their away dates',
      stmt: c.env.DB.prepare(
        `UPDATE unavailability SET person_id = ${keepP} WHERE person_id IN (${ids})`,
      ).bind(...params),
    },
    {
      // Pairings are normalised (lower id first) and unique, so repointing one
      // can collide with an existing row or create a pairing of somebody with
      // themselves. Dropping them is the honest option — the evidence for them
      // is being merged away regardless, and they are easy to set again.
      label: 'clearing their pairings',
      stmt: c.env.DB.prepare(
        `DELETE FROM pairings WHERE person_a_id IN (${ids}) OR person_b_id IN (${ids})`,
      ).bind(...mergeIds),
    },
    {
      label: 'removing the duplicate records',
      stmt: c.env.DB.prepare(`DELETE FROM people WHERE id IN (${ids})`).bind(...mergeIds),
    },
    {
      label: 'clearing the duplicate flag',
      stmt: c.env.DB.prepare(
        'UPDATE people SET needs_review = 0, review_note = NULL WHERE id = ?1',
      ).bind(keepId),
    },
  ];

  try {
    await c.env.DB.batch(steps.map((s) => s.stmt));
  } catch (err) {
    // Say which step failed and what the database said. "Something went wrong"
    // leaves the person no way forward and no way to report it usefully.
    const message = err instanceof Error ? err.message : String(err);
    console.error('merge failed', { keepId, mergeIds, message });
    return render('bad', `The merge did not complete — nothing has been changed. The database said: ${message}`);
  }

  return render('ok',
    `Merged ${mergeIds.length} record${mergeIds.length === 1 ? '' : 's'} into ${keep.display_name}. `
    + 'Their history moved across and the flag has been cleared.');
});

// ---- edit one person ------------------------------------------------------


// ---------------------------------------------------------------------------
// Profiles: what people can see
// ---------------------------------------------------------------------------

async function profilesView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  return c.html(profilesPage({ profiles: await listProfiles(c.env.DB), ctx: viewCtx(c), notice }));
}

app.get('/app/settings/profiles', (c) => profilesView(c));

app.post('/app/settings/profiles/new', async (c) => {
  const form = await c.req.formData();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return profilesView(c, { tone: 'bad', text: 'Give the profile a name.' });

  const areas = form.getAll('area').map(String).filter((a) => (AREA_KEYS as string[]).includes(a));
  try {
    const res = await c.env.DB.prepare(
      'INSERT INTO profiles (name, description) VALUES (?1, ?2)',
    ).bind(name, String(form.get('description') ?? '').trim() || null).run();
    const id = Number(res.meta.last_row_id);
    if (areas.length) {
      const stmt = c.env.DB.prepare('INSERT INTO profile_areas (profile_id, area) VALUES (?1, ?2)');
      await c.env.DB.batch(areas.map((a) => stmt.bind(id, a)));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return profilesView(c, {
      tone: 'bad',
      text: /UNIQUE/i.test(message)
        ? `There is already a profile called "${name}".`
        : `It could not be added. The database said: ${message}`,
    });
  }
  return profilesView(c, { tone: 'ok', text: `Added the "${name}" profile.` });
});

app.post('/app/settings/profiles/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return profilesView(c, { tone: 'bad', text: 'A profile needs a name.' });

  const areas = form.getAll('area').map(String).filter((a) => (AREA_KEYS as string[]).includes(a));

  // Refuse to remove the last way in. Somebody has to be able to reach Settings,
  // or the system locks everybody out with no route back except the database.
  if (!areas.includes('settings')) {
    const others = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM profile_areas a
         JOIN profiles p ON p.id = a.profile_id
        WHERE a.area = 'settings' AND a.profile_id <> ?1
          AND EXISTS (SELECT 1 FROM people x WHERE x.profile_id = p.id AND x.is_active = 1)`,
    ).bind(id).first<{ n: number }>();
    if ((others?.n ?? 0) === 0) {
      return profilesView(c, {
        tone: 'bad',
        text: 'Nothing was changed. This is the only profile with Settings that anybody is '
          + 'using, so removing it would lock everyone out.',
      });
    }
  }

  const isDefault = form.get('is_default') ? 1 : 0;
  const stmts = [
    c.env.DB.prepare('UPDATE profiles SET name = ?2, description = ?3 WHERE id = ?1')
      .bind(id, name, String(form.get('description') ?? '').trim() || null),
    c.env.DB.prepare('DELETE FROM profile_areas WHERE profile_id = ?1').bind(id),
  ];
  const areaStmt = c.env.DB.prepare('INSERT INTO profile_areas (profile_id, area) VALUES (?1, ?2)');
  for (const a of areas) stmts.push(areaStmt.bind(id, a));
  // Only one profile can be the default, so setting one clears the rest.
  if (isDefault) {
    stmts.push(c.env.DB.prepare('UPDATE profiles SET is_default = 0'));
    stmts.push(c.env.DB.prepare('UPDATE profiles SET is_default = 1 WHERE id = ?1').bind(id));
  }
  await c.env.DB.batch(stmts);

  return profilesView(c, {
    tone: 'ok',
    text: `Saved "${name}" — ${areas.length} area${areas.length === 1 ? '' : 's'}. Anyone on it `
      + 'sees the change the next time they load a page.',
  });
});

app.post('/app/settings/profiles/:id/delete', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const p = await c.env.DB.prepare(
    `SELECT name, is_admin,
            (SELECT COUNT(*) FROM people x WHERE x.profile_id = profiles.id AND x.is_active = 1) AS people
       FROM profiles WHERE id = ?1`,
  ).bind(id).first<{ name: string; is_admin: number; people: number }>();
  if (!p) return c.notFound();
  if (p.is_admin) return profilesView(c, { tone: 'bad', text: 'The full-access profile cannot be deleted.' });
  if (p.people > 0) {
    return profilesView(c, {
      tone: 'bad',
      text: `${p.people} ${p.people === 1 ? 'person is' : 'people are'} on "${p.name}". Move them to `
        + 'another profile first.',
    });
  }
  await c.env.DB.prepare('DELETE FROM profiles WHERE id = ?1').bind(id).run();
  return profilesView(c, { tone: 'ok', text: `Deleted the "${p.name}" profile.` });
});

// ---------------------------------------------------------------------------
// Adding a person, with or without a sign-in
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Everybody, against one role
// ---------------------------------------------------------------------------

async function byRoleView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  roleId: number,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const roles = await listRoles(c.env.DB);
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  if (!role) return c.html(peoplePage([], viewCtx(c)));
  const people = await listPeopleForRole(c.env.DB, role.id);
  return c.html(peopleByRolePage({ roles, role, people, ctx: viewCtx(c), notice }));
}

app.get('/app/settings/people/by-role', async (c) => {
  const asked = Number(c.req.query('role'));
  const roles = await listRoles(c.env.DB);
  const roleId = Number.isInteger(asked) ? asked : (roles[0]?.id ?? 0);
  return byRoleView(c, roleId);
});

app.post('/app/settings/people/by-role', async (c) => {
  const form = await c.req.formData();
  const roleId = Number(form.get('role_id'));
  if (!Number.isInteger(roleId)) return c.notFound();

  // Only the people the form actually showed are touched.
  //
  // An unticked checkbox is not submitted at all, so "can" alone cannot tell
  // somebody who was unticked from somebody who was never on the page. Without
  // the explicit list of who was shown, a filtered view would wipe the role from
  // everybody it did not display.
  const shown = form.getAll('shown').map(Number).filter(Number.isInteger);
  const ticked = new Set(form.getAll('can').map(Number).filter(Number.isInteger));
  if (!shown.length) return byRoleView(c, roleId, { tone: 'bad', text: 'Nothing was submitted.' });

  const num = (k: string) => {
    const v = Number(form.get(k));
    return Number.isInteger(v) && v > 0 ? v : null;
  };

  const stmts = shown.map((personId) => {
    const canDo = ticked.has(personId) ? 1 : 0;
    const max = num(`max_${personId}`);
    const period = readUnitPair(form, `periodn_${personId}`, `periodu_${personId}`);
    // A cap needs both halves to mean anything; half of one is treated as unset.
    const capOk = max !== null && period !== null;
    // Safe to read an absent box as "no": every row the page draws carries one,
    // and only the people it drew are in `shown`.
    const anyTime = form.get(`anytime_${personId}`) ? 1 : 0;
    return c.env.DB.prepare(
      `INSERT INTO person_roles (person_id, role_id, can_do, willing,
                                 max_per_period, period_days, min_gap_days, ask_any_time)
       VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7)
       ON CONFLICT(person_id, role_id) DO UPDATE SET
         can_do = excluded.can_do,
         max_per_period = excluded.max_per_period,
         period_days = excluded.period_days,
         min_gap_days = excluded.min_gap_days,
         ask_any_time = excluded.ask_any_time`,
    ).bind(personId, roleId, canDo, capOk ? max : null, capOk ? period : null,
      readUnitPair(form, `gapn_${personId}`, `gapu_${personId}`), anyTime);
  });

  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));

  const role = (await listRoles(c.env.DB)).find((r) => r.id === roleId);
  return byRoleView(c, roleId, {
    tone: 'ok',
    text: `Saved. ${ticked.size} ${ticked.size === 1 ? 'person' : 'people'} can now do `
      + `${role?.name ?? 'this role'}.`,
  });
});

app.get('/app/settings/people/new', async (c) =>
  c.html(addPersonPage({ profiles: await listProfiles(c.env.DB), ctx: viewCtx(c) })));

app.post('/app/settings/people/new', async (c) => {
  const form = await c.req.formData();
  const str = (k: string) => String(form.get(k) ?? '').trim();
  const echo = Object.fromEntries(
    ['display_name', 'full_name', 'email', 'username', 'give_login'].map((k) => [k, str(k)]));

  const displayName = str('display_name');
  const email = str('email').toLowerCase() || null;
  const giveLogin = form.get('give_login') !== null;

  const fail = async (text: string) => c.html(addPersonPage({
    profiles: await listProfiles(c.env.DB), ctx: viewCtx(c), error: text, form: echo,
  }), 400);

  if (!displayName) return fail('Give them a name.');
  if (giveLogin && !email && form.get('send_email')) {
    return fail('An email address is needed to send them their sign-in, or untick that box.');
  }

  const profileId = Number(form.get('profile_id'));
  const username = giveLogin ? (str('username').toLowerCase() || suggestUsername(displayName)) : null;

  // Everything that can fail on a constraint happens before the password is
  // generated, so a rejected form never leaves a half-made account.
  let personId: number;
  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO people (display_name, full_name, email, username, profile_id, is_admin)
       VALUES (?1, ?2, ?3, ?4, ?5, 0)`,
    ).bind(displayName, str('full_name') || null, email, username,
      giveLogin && Number.isInteger(profileId) ? profileId : null).run();
    personId = Number(res.meta.last_row_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(/username/i.test(message)
      ? `The username "${username}" is already taken.`
      : /email/i.test(message)
        ? `Somebody already has the email address ${email}.`
        : `They could not be added. The database said: ${message}`);
  }

  if (!giveLogin) {
    return c.redirect(`/app/settings/people/${personId}?saved=1`, 303);
  }

  const password = temporaryPassword();
  const hashed = await hashPassword(password);
  await c.env.DB.prepare(
    `INSERT INTO credentials (person_id, password_hash, salt, iterations, must_change)
     VALUES (?1, ?2, ?3, ?4, 1)`,
  ).bind(personId, hashed.password_hash, hashed.salt, hashed.iterations).run();

  // Told, not sent silently: if the email fails the password is still on screen,
  // so the account is never created with no way to hand it over.
  let emailed: string | null = null;
  let emailError: string | null = null;
  if (email && form.get('send_email')) {
    const origin = new URL(c.req.url).origin;
    const result = await sendAcknowledgement(
      c.env.EMAIL, c.env.ACK_FROM, email,
      'Your sign-in for the Bream Church system',
      `Dear ${displayName},

You have been given a sign-in for the Bream Church rota and diary system.

  Address:  ${origin}
  Username: ${username}
  Password: ${password}

That password is temporary — you will be asked to choose your own the first time
you sign in.

Bream Church`,
      {
        name: displayName, eventTitle: 'your sign-in', eventDate: '', eventTime: '',
        location: null, partySize: 1,
      },
    );
    if (result.status === 'sent') emailed = email;
    else emailError = result.error ?? result.status;
  }

  return c.html(addPersonPage({
    profiles: await listProfiles(c.env.DB), ctx: viewCtx(c),
    created: { name: displayName, username: username!, password, emailed, emailError },
  }));
});

/** Draws one person's page. Shared by the GET and by anything that changes them
 *  and wants to show the result rather than bounce through a redirect. */
async function personView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  id: number,
  extra: {
    saved?: boolean;
    reset?: { password: string; emailed: string | null; emailError: string | null };
    notice?: { tone: 'ok' | 'bad'; text: string };
  } = {},
) {
  const [person, roles, settings] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, display_name, full_name, email, needs_review, review_note, is_active, is_admin,
              on_break, on_break_since, is_guest, is_keyholder, keyholder_since, keyholder_note,
              keyholder_keys
         FROM people WHERE id = ?1`,
    ).bind(id).first<any>(),
    listRoles(c.env.DB),
    c.env.DB.prepare(
      `SELECT r.id AS role_id,
              COALESCE(pr.can_do, 0)  AS can_do,
              COALESCE(pr.willing, 1) AS willing,
              pr.max_per_period, pr.period_days, pr.min_gap_days,
              COALESCE(pr.ask_any_time, 0) AS ask_any_time,
              (SELECT COUNT(*) FROM assignments a
                WHERE a.person_id = ?1 AND a.role_id = r.id) AS done
         FROM roles r
         LEFT JOIN person_roles pr ON pr.role_id = r.id AND pr.person_id = ?1
        WHERE r.is_active = 1`,
    ).bind(id).all<any>(),
  ]);
  if (!person) return c.notFound();

  // Left-joined from credentials, so this comes back null for the great majority
  // of the roster who have no sign-in at all — which the page reports as a
  // different thing from having one and never using it.
  const account = await c.env.DB.prepare(
    `SELECT p.username, p.email, pr.name AS profile_name,
            c.last_sign_in_at, c.must_change
       FROM people p
       JOIN credentials c ON c.person_id = p.id
       LEFT JOIN profiles pr ON pr.id = p.profile_id
      WHERE p.id = ?1`,
  ).bind(id).first<any>();

  // Only fetched when there is a form that needs them: somebody with a sign-in
  // already has a profile, and the page does not offer to pick one again.
  const profiles = account ? [] : await listProfiles(c.env.DB);

  // What a person on a break is still down for.
  //
  // Going on a break stops them being put on anything NEW; it does not cancel
  // what was already arranged, which the three independent reviews of this
  // agreed on unanimously. But leaving that silent is the real risk — somebody
  // ticks the box in September believing it is handled and finds out in
  // November. So the arrangements are listed, and the status comes with them:
  // a confirmed place needs a human decision, a draft one will clear itself the
  // next time a rota is generated.
  const upcoming = person.on_break
    ? (await c.env.DB.prepare(
        `SELECT a.id AS assignment_id, a.service_id, a.status,
                s.service_date, s.service_time, r.name AS role_name
           FROM assignments a
           JOIN services s ON s.id = a.service_id
           JOIN roles r    ON r.id = a.role_id
          WHERE a.person_id = ?1
            AND s.is_cancelled = 0
            AND s.service_date >= date('now')
          ORDER BY s.service_date, s.service_time`,
      ).bind(id).all<any>()).results
    : [];

  const [sgGrid, sgPerson] = await Promise.all([loadSgGrid(c.env.DB), loadSgPerson(c.env.DB, id)]);

  return c.html(personPage({
    person: {
      ...person,
      settings: new Map(settings.results.map((s: any) => [s.role_id, s])),
      account,
      profiles,
      upcoming,
    },
    roles,
    ctx: viewCtx(c),
    safeguarding: { grid: sgGrid, person: sgPerson },
    ...extra,
  }));
}

app.get('/app/settings/people/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  return personView(c, id, { saved: c.req.query('saved') === '1' });
});

/**
 * Give somebody already on the roster a sign-in.
 *
 * "Add a person" creates a new person WITH a login, which is no use for the
 * sixty-odd who were imported from the spreadsheet and are already here — using
 * it for them would make a second copy of somebody who already exists. This is
 * the same job done to a person who is already in the system.
 */
app.post('/app/settings/people/:id/give-login', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();

  const form = await c.req.formData();
  const person = await c.env.DB.prepare(
    'SELECT id, display_name, email FROM people WHERE id = ?1',
  ).bind(id).first<{ id: number; display_name: string; email: string | null }>();
  if (!person) return c.notFound();

  const already = await c.env.DB.prepare('SELECT 1 FROM credentials WHERE person_id = ?1')
    .bind(id).first();
  if (already) {
    return personView(c, id, {
      notice: { tone: 'bad', text: 'They already have a sign-in. Reset their password instead.' },
    });
  }

  const username = (String(form.get('username') ?? '').trim().toLowerCase())
    || suggestUsername(person.display_name);
  const profileId = Number(form.get('profile_id'));

  try {
    await c.env.DB.prepare('UPDATE people SET username = ?2, profile_id = ?3 WHERE id = ?1')
      .bind(id, username, Number.isInteger(profileId) ? profileId : null).run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return personView(c, id, {
      notice: {
        tone: 'bad',
        text: /username/i.test(message)
          ? `The username "${username}" is already taken. Try another.`
          : `That could not be saved. The database said: ${message}`,
      },
    });
  }

  // Only once the username is safely in does the password get made, so a clash
  // never leaves an account half-created with a password nobody was shown.
  const password = temporaryPassword();
  const hashed = await hashPassword(password);
  await c.env.DB.prepare(
    `INSERT INTO credentials (person_id, password_hash, salt, iterations, must_change)
     VALUES (?1, ?2, ?3, ?4, 1)`,
  ).bind(id, hashed.password_hash, hashed.salt, hashed.iterations).run();

  let emailed: string | null = null;
  let emailError: string | null = null;
  if (person.email && form.get('send_email')) {
    const origin = new URL(c.req.url).origin;
    const result = await sendAcknowledgement(
      c.env.EMAIL, c.env.ACK_FROM, person.email,
      'Your sign-in for the Bream Church system',
      `Dear ${person.display_name},

You have been given a sign-in for the Bream Church rota and diary system.

  Address:  ${origin}
  Username: ${username}
  Password: ${password}

That password is temporary — you will be asked to choose your own the first time
you sign in.

Bream Church`,
      {
        name: person.display_name, eventTitle: 'your sign-in', eventDate: '', eventTime: '',
        location: null, partySize: 1,
      },
    );
    if (result.status === 'sent') emailed = person.email;
    else emailError = result.error ?? result.status;
  }

  return personView(c, id, { reset: { password, emailed, emailError } });
});

/**
 * An administrator reissues a temporary password.
 *
 * There is no self-service reset, and deliberately so: most of the roster has no
 * email address on file, so a "forgot my password" link would work for a handful
 * of people and silently fail for everyone else. Somebody rings the office
 * instead, and the office does this.
 */
app.post('/app/settings/people/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();

  const form = await c.req.formData();
  const person = await c.env.DB.prepare(
    `SELECT p.id, p.display_name, p.email, p.username
       FROM people p JOIN credentials c ON c.person_id = p.id
      WHERE p.id = ?1`,
  ).bind(id).first<{ id: number; display_name: string; email: string | null; username: string | null }>();
  if (!person) return c.notFound();

  const password = temporaryPassword();
  const hashed = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE credentials
          SET password_hash = ?2, salt = ?3, iterations = ?4, must_change = 1
        WHERE person_id = ?1`,
    ).bind(id, hashed.password_hash, hashed.salt, hashed.iterations),
    // Anyone signed in as them is signed out. If the reason for the reset is
    // that somebody else knows the old password, leaving their session alive
    // would defeat the whole exercise.
    c.env.DB.prepare('DELETE FROM sessions WHERE person_id = ?1').bind(id),
  ]);

  let emailed: string | null = null;
  let emailError: string | null = null;
  if (person.email && form.get('send_email')) {
    const origin = new URL(c.req.url).origin;
    const result = await sendAcknowledgement(
      c.env.EMAIL, c.env.ACK_FROM, person.email,
      'Your new password for the Bream Church system',
      `Dear ${person.display_name},

Your password for the Bream Church rota and diary system has been reset.

  Address:  ${origin}
  Username: ${person.username ?? person.email}
  Password: ${password}

That password is temporary — you will be asked to choose your own the first time
you sign in with it.

If you did not ask for this, please tell the church office.

Bream Church`,
      {
        name: person.display_name, eventTitle: 'your password', eventDate: '', eventTime: '',
        location: null, partySize: 1,
      },
    );
    if (result.status === 'sent') emailed = person.email;
    else emailError = result.error ?? result.status;
  }

  return personView(c, id, { reset: { password, emailed, emailError } });
});

app.post('/app/settings/people/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();

  const str = (k: string) => {
    const v = String(form.get(k) ?? '').trim();
    return v.length ? v : null;
  };
  const num = (k: string) => {
    const v = Number(form.get(k));
    return Number.isInteger(v) && v > 0 ? v : null;
  };

  await c.env.DB.prepare(
    `UPDATE people
        SET display_name = ?2, full_name = ?3, email = ?4, is_active = ?5,
            needs_review = CASE WHEN ?6 = 1 THEN 0 ELSE needs_review END,
            review_note  = CASE WHEN ?6 = 1 THEN NULL ELSE review_note END,
            on_break = ?7,
            -- Stamped from the row's own current value rather than from one read
            -- a moment ago, so saving the page twice does not restart the break
            -- and two administrators saving at once cannot lose the date.
            on_break_since = CASE
              WHEN ?7 = 1 AND on_break = 0 THEN datetime('now')
              WHEN ?7 = 0 THEN NULL
              ELSE on_break_since
            END,
            is_guest = ?8,
            is_keyholder = ?9,
            -- Stamped the same way as on_break_since, for the same reasons.
            keyholder_since = CASE
              WHEN ?9 = 1 AND is_keyholder = 0 THEN datetime('now')
              WHEN ?9 = 0 THEN NULL
              ELSE keyholder_since
            END,
            keyholder_keys = CASE WHEN ?9 = 1 THEN ?10 ELSE NULL END,
            -- No longer asked for, but an old note still goes when the tick does.
            keyholder_note = CASE WHEN ?9 = 1 THEN keyholder_note ELSE NULL END,
            updated_at = datetime('now')
      WHERE id = ?1`,
  ).bind(
    id, str('display_name') ?? 'Unnamed', str('full_name'), str('email'),
    form.get('is_active') ? 1 : 0, form.get('clear_review') ? 1 : 0,
    form.get('on_break') ? 1 : 0, form.get('is_guest') ? 1 : 0,
    form.get('is_keyholder') ? 1 : 0, JSON.stringify(readKeys(form)),
  ).run();

  const roles = await listRoles(c.env.DB);
  const stmts = roles.map((r) => {
    const canDo = form.get(`role_${r.id}`) ? 1 : 0;
    // A cap only means anything with both halves; half of one is treated as not
    // set rather than silently becoming "2 times every null days".
    const max = num(`max_${r.id}`);
    // The form asks in weeks, months or quarters, because nobody says "every 90
    // days" — they say "once a quarter". Stored as days, which is what the
    // generator does arithmetic on.
    const period = readUnitPair(form, `periodn_${r.id}`, `periodu_${r.id}`);
    const pairOk = max !== null && period !== null;
    // "As often as needed". The page draws a row for every role, ticked or not,
    // so a missing box here means unticked. That holds only because the person
    // page is the one form that posts here: a form without the table would
    // clear every tick, so it would need its own handler.
    const anyTime = form.get(`anytime_${r.id}`) ? 1 : 0;
    return c.env.DB.prepare(
      `INSERT INTO person_roles (person_id, role_id, can_do, willing,
                                 max_per_period, period_days, min_gap_days, ask_any_time)
       VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7)
       ON CONFLICT(person_id, role_id) DO UPDATE SET
         can_do = excluded.can_do,
         max_per_period = excluded.max_per_period,
         period_days = excluded.period_days,
         min_gap_days = excluded.min_gap_days,
         ask_any_time = excluded.ask_any_time`,
    ).bind(id, r.id, canDo, pairOk ? max : null, pairOk ? period : null,
      readUnitPair(form, `gapn_${r.id}`, `gapu_${r.id}`), anyTime);
  });
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));

  await saveSgPerson(c.env.DB, id, await loadSgGrid(c.env.DB), form);

  return c.redirect(`/app/settings/people/${id}?saved=1`, 303);
});

/** Every role, including ones switched off — the settings page must be able to
 *  switch them back on. */
async function allRoles(db: D1Database) {
  const { results } = await db
    .prepare('SELECT * FROM roles ORDER BY sort_order, name')
    .all<Awaited<ReturnType<typeof listRoles>>[number]>();
  return results;
}

app.get('/app/settings/roles', async (c) =>
  c.html(rolesPage(await allRoles(c.env.DB), viewCtx(c))));

app.post('/app/settings/roles', async (c) => {
  const form = await c.req.formData();
  const roles = await allRoles(c.env.DB);

  const num = (k: string, fallback: number) => {
    const v = Number(form.get(k));
    return Number.isInteger(v) && v >= 0 && v <= 20 ? v : fallback;
  };

  const problems: string[] = [];
  const stmts = [];
  for (const r of roles) {
    const name = String(form.get(`name_${r.id}`) ?? '').trim();
    if (!name) { problems.push(`"${r.name}" cannot have an empty name`); continue; }
    const min = num(`min_${r.id}`, r.min_needed);
    const ideal = num(`ideal_${r.id}`, r.ideal_needed);
    // The table CHECKs this, so catching it here gives a sentence instead of a
    // database error.
    if (ideal < min) {
      problems.push(`${name}: ideal (${ideal}) cannot be below the minimum (${min})`);
      continue;
    }
    const sheet = String(form.get(`sheet_${r.id}`) ?? '').trim() || null;
    stmts.push(c.env.DB.prepare(
      `UPDATE roles SET name = ?2, min_needed = ?3, ideal_needed = ?4,
              communion_only = ?5, sheet_heading = ?6, is_active = ?7, is_critical = ?8
        WHERE id = ?1`,
    ).bind(r.id, name, min, ideal,
      String(form.get(`communion_${r.id}`)) === '1' ? 1 : 0,
      sheet, form.get(`active_${r.id}`) ? 1 : 0, form.get(`critical_${r.id}`) ? 1 : 0));
  }

  if (problems.length) {
    return c.html(rolesPage(roles, viewCtx(c), {
      tone: 'bad', text: `Nothing was saved. ${problems.join('. ')}.`,
    }), 400);
  }
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));

  return c.html(rolesPage(await allRoles(c.env.DB), viewCtx(c), {
    tone: 'ok', text: `Saved ${stmts.length} roles.`,
  }));
});

app.post('/app/settings/roles/new', async (c) => {
  const form = await c.req.formData();
  const name = String(form.get('name') ?? '').trim();
  const min = Number(form.get('min_needed'));
  const ideal = Number(form.get('ideal_needed'));

  const fail = async (text: string) =>
    c.html(rolesPage(await allRoles(c.env.DB), viewCtx(c), { tone: 'bad', text }), 400);

  if (!name) return fail('Give the role a name.');
  if (!Number.isInteger(min) || !Number.isInteger(ideal) || min < 0 || ideal < min) {
    return fail('The ideal number has to be at least the minimum.');
  }

  // A stable key derived from the name, so imports and code can refer to it.
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'role';
  const existing = new Set((await allRoles(c.env.DB)).map((r) => r.key));
  let key = base;
  for (let n = 2; existing.has(key); n++) key = `${base}_${n}`;

  const maxOrder = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM roles')
    .first<{ m: number }>();

  await c.env.DB.prepare(
    `INSERT INTO roles (key, name, min_needed, ideal_needed, communion_only, sort_order)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(key, name, min, ideal,
    String(form.get('communion_only')) === '1' ? 1 : 0, (maxOrder?.m ?? 0) + 10).run();

  return c.html(rolesPage(await allRoles(c.env.DB), viewCtx(c), {
    tone: 'ok',
    text: `Added "${name}". Nobody is marked as able to do it yet — set that on each person.`,
  }));
});

/**
 * The rules the draft rota is built to.
 *
 * Only the rules for the whole rota now. This page also used to set, per role,
 * how often one person may do the same job — but that answered the same
 * question as each person's own record, and a team-wide figure could hold back
 * a preacher who had asked to preach more without anything on their record
 * saying why. How often somebody does a job is now said in one place only: on
 * their own record, or a whole team at once on People > Edit by role.
 */
async function draftRulesView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const rules = await getRotaRules(c.env.DB);
  return c.html(draftRulesPage({ rules, ctx: viewCtx(c), notice }));
}

app.get('/app/settings/draft-rules', (c) => draftRulesView(c));

app.post('/app/settings/draft-rules', async (c) => {
  const form = await c.req.formData();
  const maxRoles = Number(form.get('max_roles'));
  await saveRotaRules(c.env.DB, {
    any_role_gap: String(form.get('any_role_gap') ?? 'fortnight_prefer'),
    max_roles_per_service: Number.isInteger(maxRoles) && maxRoles > 0 ? maxRoles : null,
    when_short: String(form.get('when_short') ?? 'bend_both'),
    fairness: String(form.get('fairness') ?? 'balanced'),
    list_every_empty_place: form.get('list_every_empty_place') ? 1 : 0,
  });

  return draftRulesView(c, {
    tone: 'ok',
    text: 'Saved. The next draft you generate will follow these rules.',
  });
});

app.get('/app/settings/combinations', async (c) => {
  const [roles, combos] = await Promise.all([listRoles(c.env.DB), listCombinations(c.env.DB)]);
  return c.html(combinationsPage(roles, combos, viewCtx(c)));
});

/** One role against every other, which is how the question is actually asked. */
async function combinationsByRoleView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  roleId: number | null,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const roles = await listRoles(c.env.DB);
  const active = roles.filter((r) => r.is_active);
  if (!active.length) return c.redirect('/app/settings/roles', 302);
  const role = active.find((r) => r.id === roleId) ?? active[0]!;
  return c.html(combinationsByRolePage({
    roles: active,
    role,
    others: await listCombinationsForRole(c.env.DB, role.id),
    ctx: viewCtx(c),
    notice,
  }));
}

app.get('/app/settings/combinations/by-role', (c) => {
  const asked = Number(c.req.query('role'));
  return combinationsByRoleView(c, Number.isInteger(asked) ? asked : null);
});

app.post('/app/settings/combinations/by-role', async (c) => {
  const form = await c.req.formData();
  const roleId = Number(form.get('role_id'));
  if (!Number.isInteger(roleId)) return c.notFound();

  // Every role on the page is listed in `shown`, whatever was picked for it.
  // A radio group with nothing selected submits nothing at all, so without this
  // the save could not tell "left undecided" from "was not on the page".
  const shown = form.getAll('shown').map(Number).filter(Number.isInteger);

  const entries = shown.map((otherRoleId) => {
    const raw = String(form.get(`v_${otherRoleId}`) ?? '');
    // Narrowed against the literal union rather than cast, so a value the form
    // should never send is treated as "not decided" instead of reaching a CHECK
    // constraint and failing the whole save.
    const verdict: 'green' | 'amber' | 'red' | null =
      raw === 'green' || raw === 'amber' || raw === 'red' ? raw : null;
    const reason = String(form.get(`reason_${otherRoleId}`) ?? '').trim();
    // A reason with no verdict has nothing to explain, so it is not kept.
    return { otherRoleId, verdict, reason: verdict && reason ? reason : null };
  });

  await saveCombinationsForRole(c.env.DB, roleId, entries);

  const blocked = entries.filter((e) => e.verdict === 'red').length;
  const roles = await listRoles(c.env.DB);
  const name = roles.find((r) => r.id === roleId)?.name ?? 'that role';
  return combinationsByRoleView(c, roleId, {
    tone: 'ok',
    text: `Saved. The next rota you generate will obey this — ${name} `
      + (blocked === 0
        ? 'is not blocked from any other job.'
        : `cannot also be ${blocked === 1 ? 'one other role' : `any of ${blocked} other roles`} at the same service.`),
  });
});

async function pairsView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const [pairs, people, roles] = await Promise.all([
    listPairings(c.env.DB),
    c.env.DB.prepare(
      'SELECT id, display_name FROM people WHERE is_active = 1 ORDER BY display_name',
    ).all<{ id: number; display_name: string }>(),
    listRoles(c.env.DB),
  ]);
  return c.html(pairsPage(pairs, people.results, roles, viewCtx(c), notice));
}

app.get('/app/settings/pairs', (c) => pairsView(c));

app.post('/app/settings/pairs', async (c) => {
  const form = await c.req.formData();
  const remove = form.getAll('remove').map(Number).filter(Number.isInteger);
  const pairs = await listPairings(c.env.DB);

  const stmts = [];
  for (const p of pairs) {
    if (remove.includes(p.id)) {
      stmts.push(c.env.DB.prepare('DELETE FROM pairings WHERE id = ?1').bind(p.id));
      continue;
    }
    // One control covers both columns: "keep apart" is mode=avoid, the other two
    // are mode=together with the strength that was picked.
    const choice = String(form.get(`strength_${p.id}`) ?? 'prefer');
    const mode = choice === 'avoid' ? 'avoid' : 'together';
    const strength = choice === 'must' ? 'must' : 'prefer';
    const roleRaw = String(form.get(`role_${p.id}`) ?? '');
    const roleId = roleRaw === '' ? null : Number(roleRaw);
    stmts.push(c.env.DB.prepare(
      'UPDATE pairings SET mode = ?2, strength = ?3, role_id = ?4 WHERE id = ?1',
    ).bind(p.id, mode, strength, Number.isInteger(roleId) ? roleId : null));
  }
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));

  return pairsView(c, {
    tone: 'ok',
    text: remove.length
      ? `Saved. ${remove.length} pairing${remove.length === 1 ? '' : 's'} removed.`
      : 'Saved.',
  });
});

app.post('/app/settings/pairs/new', async (c) => {
  const form = await c.req.formData();
  const a = Number(form.get('person_a'));
  const b = Number(form.get('person_b'));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
    return pairsView(c, { tone: 'bad', text: 'Choose two different people.' });
  }
  const choice = String(form.get('strength') ?? 'prefer');
  const roleRaw = String(form.get('role_id') ?? '');
  const roleId = roleRaw === '' ? null : Number(roleRaw);

  // The table CHECKs that the lower id comes first and the unique index treats a
  // NULL role as -1, so normalise before inserting rather than catching a
  // constraint error afterwards.
  const [lo, hi] = a < b ? [a, b] : [b, a];
  try {
    await c.env.DB.prepare(
      `INSERT INTO pairings (person_a_id, person_b_id, role_id, mode, strength, note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(lo, hi, Number.isInteger(roleId) ? roleId : null,
      choice === 'avoid' ? 'avoid' : 'together',
      choice === 'must' ? 'must' : 'prefer',
      `Added by ${c.get('person').display_name}`).run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return pairsView(c, {
      tone: 'bad',
      text: /UNIQUE/i.test(message)
        ? 'Those two already have a pairing for that role — edit the existing one instead.'
        : `It could not be added. The database said: ${message}`,
    });
  }
  return pairsView(c, { tone: 'ok', text: 'Pairing added.' });
});

// ---------------------------------------------------------------------------
// The rota
// ---------------------------------------------------------------------------

app.get('/app/rota', async (c) => {
  const services = await listUpcomingServices(c.env.DB);
  // Every service in full: the first is shown open at the top, and each of the
  // rest can be opened out to the same view. One batch, however many there are.
  const full = await getServiceDetails(c.env.DB, services.map((s) => s.id));
  const details = new Map(full.map((d) => [d.id, d]));
  const next = services.length ? details.get(services[0]!.id) ?? null : null;
  return c.html(rotaDashboard(services, viewCtx(c), next, details));
});

/**
 * Every future service, for sending to the people who are not online. Open to
 * anybody who can see the rota, since it shows nothing the rota page does not.
 */
async function rotaForExport(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const services = await listUpcomingServices(c.env.DB, undefined, 500);
  const [details, roles] = await Promise.all([
    getServiceDetails(c.env.DB, services.map((s) => s.id)), listRoles(c.env.DB),
  ]);
  return { details, roles };
}

const download = (body: Uint8Array, type: string, filename: string) =>
  new Response(body, {
    headers: {
      'content-type': type,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });

app.get('/app/rota/export.xlsx', async (c) => {
  const { details, roles } = await rotaForExport(c);
  return download(rotaXlsx(details, roles),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `bream-rota-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

app.get('/app/rota/export.pdf', async (c) => {
  const { details, roles } = await rotaForExport(c);
  return download(await rotaPdf(details, roles), 'application/pdf',
    `bream-rota-${new Date().toISOString().slice(0, 10)}.pdf`);
});

app.get('/app/rota/gaps', async (c) =>
  c.html(gapsPage(await listUpcomingServices(c.env.DB, undefined, 500), viewCtx(c))));

app.get('/app/rota/service/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const detail = await getServiceDetail(c.env.DB, id);
  if (!detail) return c.notFound();

  // The pickers are only drawn for somebody who may actually change the rota.
  // Offering a control that will refuse you is worse than not offering it.
  const mayEdit = c.get('areas')?.has('rota.manage') ?? false;
  const candidates = mayEdit ? new Map<number, Candidate[]>() : undefined;
  if (candidates) {
    // One query per role rather than one big one: each needs its own "can they
    // do THIS role" and "are they already on THIS service" columns, and a dozen
    // small queries is well inside what D1 is happy with.
    for (const r of detail.roles) {
      candidates.set(r.role_id, await listCandidatesForRole(c.env.DB, id, r.role_id));
    }
  }
  return c.html(servicePage(detail, viewCtx(c), candidates));
});

/**
 * Put somebody on a role by hand.
 *
 * This is how a guest preacher gets on a service at all — they are never drawn
 * from the pool, by definition — and how a coordinator overrides anything the
 * generator decided. Nobody is refused here: the page says who is on a break,
 * who is away and who does not normally do the role, and then the person
 * clicking decides. They rang round on Saturday night; they know more than the
 * roster does.
 */
app.post('/app/rota/service/:id/role/:roleId/add', async (c) => {
  const id = Number(c.req.param('id'));
  const roleId = Number(c.req.param('roleId'));
  const personId = Number((await c.req.formData()).get('person_id'));
  if (!Number.isInteger(id) || !Number.isInteger(roleId)) return c.notFound();
  if (!Number.isInteger(personId) || personId <= 0) {
    return c.redirect(`/app/rota/service/${id}`, 303);
  }

  const person = await c.env.DB.prepare(
    'SELECT display_name FROM people WHERE id = ?1 AND is_active = 1',
  ).bind(personId).first<{ display_name: string }>();
  if (!person) return c.notFound();

  // The lowest free slot, worked out from the slots actually taken rather than
  // from a count — the same rule the generator uses, so a pin at slot 3 does not
  // collide with a new slot 1.
  const { results: taken } = await c.env.DB.prepare(
    'SELECT slot FROM assignments WHERE service_id = ?1 AND role_id = ?2',
  ).bind(id, roleId).all<{ slot: number }>();
  const used = new Set(taken.map((t) => t.slot));
  let slot = 1;
  while (used.has(slot)) slot++;

  // 'confirmed' and generated = 0: a human put this here deliberately, so the
  // next generation must treat it as a pin and leave it exactly alone.
  await c.env.DB.prepare(
    `INSERT INTO assignments (service_id, role_id, slot, person_id, status, generated, reason)
     VALUES (?1, ?2, ?3, ?4, 'confirmed', 0, ?5)`,
  ).bind(id, roleId, slot, personId, `Put on by ${c.get('person').display_name}`).run();

  return c.redirect(`/app/rota/service/${id}`, 303);
});

/** Take somebody off a role at one service. The person stays on the roster. */
app.post('/app/rota/service/:id/assignment/:assignmentId/remove', async (c) => {
  const id = Number(c.req.param('id'));
  const assignmentId = Number(c.req.param('assignmentId'));
  if (!Number.isInteger(id) || !Number.isInteger(assignmentId)) return c.notFound();

  // Scoped to the service in the path, so a stray id cannot reach into another.
  await c.env.DB.prepare('DELETE FROM assignments WHERE id = ?1 AND service_id = ?2')
    .bind(assignmentId, id).run();
  return c.redirect(`/app/rota/service/${id}`, 303);
});

/**
 * Switch a role off for one service, or put it back.
 *
 * Without this, a one-off service inherits all fourteen roles — so the
 * Remembrance act at the Cenotaph reports thirteen unfilled roles including a
 * tea rota and a sound desk. A warning system that cries wolf gets ignored, and
 * then the real gaps get ignored with it.
 */
app.post('/app/rota/service/:id/role/:roleId/:state{on|off}', async (c) => {
  const id = Number(c.req.param('id'));
  const roleId = Number(c.req.param('roleId'));
  const applies = c.req.param('state') === 'on' ? 1 : 0;
  if (!Number.isInteger(id) || !Number.isInteger(roleId)) return c.notFound();

  if (applies === 1) {
    await c.env.DB.prepare(
      'DELETE FROM service_role_overrides WHERE service_id = ?1 AND role_id = ?2',
    ).bind(id, roleId).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO service_role_overrides (service_id, role_id, applies, note)
       VALUES (?1, ?2, 0, ?3)
       ON CONFLICT(service_id, role_id) DO UPDATE SET applies = 0, note = excluded.note`,
    ).bind(id, roleId, `Switched off by ${c.get('person').display_name}`).run();
  }
  return c.redirect(`/app/rota/service/${id}`, 303);
});

// ---------------------------------------------------------------------------
// The worship team's own roster.
//
// Kept apart from the main rota deliberately: the worship leader decides who is
// playing what, and that is a different job from deciding who preaches. Under
// the rota area because it is about Sundays, but on its own tab.
// ---------------------------------------------------------------------------

async function worshipView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
  savedId?: number,
) {
  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 10);
  const [sundays, people] = await Promise.all([
    listWorshipSundays(c.env.DB, from),
    c.env.DB.prepare(
      'SELECT id, display_name FROM people WHERE is_active = 1 ORDER BY display_name',
    ).all<{ id: number; display_name: string }>(),
  ]);
  return c.html(worshipPage({
    sundays,
    people: people.results,
    ctx: viewCtx(c),
    notice,
    savedId,
    // Seeing who is playing is useful to the whole team; changing it is the
    // worship leader's job, and goes with the rest of rota management.
    canEdit: c.get('areas')?.has('rota.manage') ?? false,
  }));
}

app.get('/app/rota/worship', (c) => worshipView(c));

app.post('/app/rota/worship/:serviceId', async (c) => {
  const serviceId = Number(c.req.param('serviceId'));
  if (!Number.isInteger(serviceId)) return c.notFound();

  const form = await c.req.formData();
  const kindRaw = String(form.get('kind') ?? 'live');
  const kind: 'live' | 'lyrics' = kindRaw === 'lyrics' ? 'lyrics' : 'live';

  // Every position comes back from the form, whether anybody is on it or not,
  // so a position just cleared can go back to empty. "other" means the name was
  // typed rather than picked — a visiting musician, or somebody's son who plays
  // drums once and should not have to be added to the church roster first.
  const slots = POSITIONS.map((pos) => {
    const picked = String(form.get(`p_${pos.key}`) ?? '');
    const typed = String(form.get(`n_${pos.key}`) ?? '').trim();
    if (picked === 'other') return { position: pos.key, personId: null, name: typed || null };
    const id = Number(picked);
    if (Number.isInteger(id) && id > 0) return { position: pos.key, personId: id, name: null };
    return { position: pos.key, personId: null, name: null };
  });

  const notes = String(form.get('notes') ?? '').trim() || null;
  await saveWorshipPlan(c.env.DB, serviceId, kind, notes, slots);

  const named = slots.filter((x) => x.personId != null || x.name).length;
  return worshipView(c, {
    tone: 'ok',
    text: named
      ? `Saved — ${named} ${named === 1 ? 'person' : 'people'} down for that week.`
      : 'Saved. Nobody is down for that week yet, which is fine.',
  }, serviceId);
});

app.get('/app/rota/readings', async (c) =>
  c.html(readingsPage(
    await listUpcomingServices(c.env.DB, undefined, 30),
    viewCtx(c),
    c.req.query('saved') ?? undefined,
  )));

app.post('/app/rota/readings', async (c) => {
  const form = await c.req.formData();
  const id = Number(form.get('service_id'));
  if (!Number.isInteger(id)) return c.redirect('/app/rota/readings', 303);

  // An empty box means "not set", not an empty string — so the views can keep
  // showing "not set yet" rather than a blank that looks like a bug.
  const blankToNull = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  };
  await c.env.DB.prepare('UPDATE services SET readings = ?2, sermon_title = ?3 WHERE id = ?1')
    .bind(id, blankToNull(form.get('readings')), blankToNull(form.get('sermon_title')))
    .run();

  const svc = await c.env.DB.prepare(
    'SELECT service_date FROM services WHERE id = ?1',
  ).bind(id).first<{ service_date: string }>();
  return c.redirect(`/app/rota/readings?saved=${encodeURIComponent(svc?.service_date ?? '')}`, 303);
});

// ---------------------------------------------------------------------------
// Services (the pattern, and the one-offs around it)
// ---------------------------------------------------------------------------

async function servicesView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const [{ results: services }, { results: types }] = await Promise.all([
    c.env.DB.prepare(
      `SELECT s.id, s.service_date, s.service_time, s.title, s.location, s.is_cancelled,
              st.name AS type_name
         FROM services s LEFT JOIN service_types st ON st.id = s.service_type_id
        ORDER BY s.service_date DESC, s.service_time`,
    ).all<ServiceListRow>(),
    c.env.DB.prepare(
      'SELECT id, name, is_communion, default_time FROM service_types WHERE is_active = 1 ORDER BY id',
    ).all<ServiceTypeOption>(),
  ]);
  return c.html(servicesPage({ services, types, ctx: viewCtx(c), notice }));
}

app.get('/app/settings/services', (c) => servicesView(c));

app.post('/app/settings/services/generate', async (c) => {
  const form = await c.req.formData();
  const plan = sundaysBetween(String(form.get('from') ?? ''), String(form.get('to') ?? ''));
  if (!plan.ok) return servicesView(c, { tone: 'bad', text: plan.error });
  if (!plan.sundays.length) {
    return servicesView(c, { tone: 'bad', text: 'There are no Sundays in that range.' });
  }

  const { added, total } = await createSundays(c.env.DB, plan.sundays);
  return servicesView(c, {
    tone: 'ok',
    text: `${added} Sunday service${added === 1 ? '' : 's'} added`
      + (added < total
        ? ` — the other ${total - added} already existed and were left alone.`
        : '.'),
  });
});

app.post('/app/settings/services/add', async (c) => {
  const form = await c.req.formData();
  const date = String(form.get('date') ?? '');
  const time = String(form.get('time') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const location = String(form.get('location') ?? '').trim() || null;
  const typeId = Number(form.get('service_type_id'));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !title) {
    return servicesView(c, { tone: 'bad', text: 'A date, a time and a title are all needed.' });
  }

  const type = await c.env.DB.prepare(
    'SELECT id, is_communion FROM service_types WHERE id = ?1',
  ).bind(typeId).first<{ id: number; is_communion: number }>();

  const res = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO services (service_date, service_time, service_type_id, title, location, is_communion)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(date, time, type?.id ?? null, title, location, type?.is_communion ?? 0).run();

  return servicesView(c, (res.meta?.changes ?? 0) > 0
    ? { tone: 'ok', text: `Added "${title}".` }
    : { tone: 'bad', text: `There is already a service at ${date} ${time}.` });
});

// ---------------------------------------------------------------------------
// Draft rota generation
// ---------------------------------------------------------------------------

/** Nothing is written until the admin presses Apply, so the draft is held in a
 *  short-lived row rather than recomputed (which could drift if data changed
 *  between the preview and the press). */
app.get('/app/settings/generate', (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  return c.html(generateFormPage({
    ctx: viewCtx(c), defaultFrom: today, defaultTo: to,
  }));
});

app.post('/app/settings/generate', async (c) => {
  const form = await c.req.formData();
  const from = String(form.get('from') ?? '');
  const to = String(form.get('to') ?? '');
  const today = new Date().toISOString().slice(0, 10);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(from) || !iso.test(to) || to < from) {
    return c.html(generateFormPage({
      ctx: viewCtx(c), defaultFrom: today, defaultTo: to || today,
      notice: { tone: 'bad', text: 'Give a start date and an end date after it.' },
    }), 400);
  }

  const input = await loadGeneratorInput(c.env.DB, from, to, `${from}|${to}`);

  // Plan the ordinary Sundays, but do not write them.
  //
  // They happen every week whatever anybody does, so making somebody set them up
  // as a separate step before asking for a rota is busywork — but a draft that
  // is looked at and rejected must leave nothing behind. So they are imagined
  // here with provisional ids and only created if the draft is accepted.
  // Existing services are never touched: a Sunday already renamed to "Harvest",
  // or moved to communion, keeps exactly what it has.
  let planned: SundayPlan[] = [];
  if (form.get('skip_sundays') === null) {
    // Never invent a service for a date that has already gone. A rota cannot be
    // built for last month.
    const plan = sundaysBetween(from < today ? today : from, to);
    if (!plan.ok) {
      return c.html(generateFormPage({
        ctx: viewCtx(c), defaultFrom: from, defaultTo: to,
        notice: { tone: 'bad', text: plan.error },
      }), 400);
    }
    const taken = new Set(input.services.map((s) => s.date));
    planned = plan.sundays.filter((s) => !taken.has(s.date));
    input.services.push(
      ...provisionalSundays(plan.sundays, taken, await listRoles(c.env.DB)),
    );
  }
  // The generator reads services in order in places, and a provisional Sunday
  // can fall between two real services.
  input.services.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

  const created = planned.length;
  if (!input.services.length) {
    return c.html(generateFormPage({
      ctx: viewCtx(c), defaultFrom: from, defaultTo: to,
      notice: {
        tone: 'bad',
        text: 'There are no services in that range, and no Sundays either. Check the dates, '
          + 'or add a one-off service under Services.',
      },
    }), 400);
  }
  const result = generateRota(input);

  // Shape the result for display, grouped the way a rota is read.
  const nameOf = new Map(input.people.map((p) => [p.id, p.name]));
  const services: PreviewService[] = input.services
    .slice()
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    .map((s) => ({
      id: s.id, date: s.date, time: s.time, title: s.title,
      // A negative id is one of the Sundays we have only imagined so far.
      isNew: s.id < 0,
      rows: s.roles.map((r) => {
        const here = result.allocations.filter((a) => a.serviceId === s.id && a.roleId === r.roleId);
        const gap = result.gaps.find((g) => g.serviceId === s.id && g.roleId === r.roleId);
        return {
          roleId: r.roleId,
          roleName: input.roleNames.get(r.roleId) ?? 'Role',
          people: here.map((a) => ({
            name: nameOf.get(a.personId) ?? `#${a.personId}`,
            reason: a.reason, amber: a.amber, pinned: a.pinned,
          })),
          missing: Math.max(0, r.min - here.length),
          message: gap?.message ?? null,
        };
      }),
    }));

  // Park the draft so Apply writes exactly what was shown.
  //
  // The provisional Sundays travel with it. Apply creates them, learns their
  // real ids and rewrites the allocations before anything is inserted — which is
  // why the draft has to carry the plan rather than working it out again, since
  // "which Sundays were missing" can have changed in between.
  const token = newSessionId();
  await c.env.DB.prepare(
    `INSERT INTO draft_rotas (token, person_id, from_date, to_date, payload)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(token, c.get('person').id, from, to, JSON.stringify({
    allocations: result.allocations.filter((a) => !a.pinned),
    sundays: planned,
    // Which provisional id stood for which date, so Apply can map them back.
    provisional: input.services.filter((s) => s.id < 0).map((s) => ({ id: s.id, date: s.date })),
    // Bookings this draft takes off. Deleted explicitly on apply: a place the
    // generator could not refill has no new row to overwrite the old one.
    released: (input.released ?? []).map((r) => r.assignmentId),
    // The whole grid as shown — kept and new places together, Sundays not in
    // the diary yet included — so the draft can be downloaded exactly as it
    // was previewed, without generating it again.
    grid: services.map((s) => ({
      id: s.id, date: s.date, time: s.time, title: s.title,
      rows: s.rows.map((r) => ({ roleId: r.roleId, names: r.people.map((p) => p.name) })),
    })),
  })).run();

  const dateOf = new Map(input.services.map((s) => [s.id, s.date]));
  return c.html(previewPage({
    ctx: viewCtx(c), from, to, result, services, token, createdSundays: created,
    released: (input.released ?? []).map((r) => ({
      name: r.name, why: r.why, date: dateOf.get(r.serviceId) ?? '',
      roleName: input.roleNames.get(r.roleId) ?? 'a role',
    })),
  }));
});

/**
 * A parked draft, laid out as the rota download is. Only the person who made
 * the draft can fetch it, as only they can apply it; once applied (or
 * replaced) it is gone, and the rota's own download takes over.
 */
async function draftForExport(c: Context<{ Bindings: Env; Variables: Vars }>) {
  const token = c.req.param('token') ?? '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = await c.env.DB.prepare(
    'SELECT payload FROM draft_rotas WHERE token = ?1 AND person_id = ?2',
  ).bind(token, c.get('person').id).first<{ payload: string }>();
  if (!row) return null;
  const parsed = JSON.parse(row.payload) as {
    grid?: { id: number; date: string; time: string; title: string; rows: { roleId?: number; names: string[] }[] }[];
  };
  if (!Array.isArray(parsed.grid)) return null;

  // Readings and sermon titles for the services already in the diary; a
  // Sunday the draft would add has none yet.
  const ids = parsed.grid.map((s) => s.id).filter((id) => id > 0);
  const readings = new Map<number, { readings: string | null; sermon_title: string | null }>();
  if (ids.length) {
    const { results } = await c.env.DB.prepare(
      'SELECT id, readings, sermon_title FROM services WHERE id IN (SELECT value FROM json_each(?1))',
    ).bind(JSON.stringify(ids)).all<{ id: number; readings: string | null; sermon_title: string | null }>();
    for (const r of results) readings.set(r.id, r);
  }
  const roles = await listRoles(c.env.DB);
  const nameOf = new Map(roles.map((r) => [r.id, r.name]));
  const details: ServiceDetail[] = parsed.grid.map((s) => ({
    id: s.id, service_date: s.date, service_time: s.time, title: s.title, location: null, is_communion: 0,
    readings: readings.get(s.id)?.readings ?? null, sermon_title: readings.get(s.id)?.sermon_title ?? null,
    notApplicable: [],
    roles: s.rows.filter((r) => r.roleId != null).map((r) => ({
      role_id: r.roleId!, role_name: nameOf.get(r.roleId!) ?? 'Role', min_needed: 0, ideal_needed: 0,
      people: r.names.map((n) => ({
        assignment_id: 0, person_id: 0, display_name: n, status: 'draft', on_break: 0, is_guest: 0,
      })),
    })),
  }));
  return { details, roles };
}

const draftGone = (c: Context<{ Bindings: Env; Variables: Vars }>) =>
  c.html(generateFormPage({
    ctx: viewCtx(c),
    defaultFrom: new Date().toISOString().slice(0, 10),
    defaultTo: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
    notice: { tone: 'bad', text: 'That draft is no longer available to download — it has been applied or replaced. Generate it again, or download the rota itself.' },
  }), 404);

app.get('/app/settings/generate/draft/:token/rota.xlsx', async (c) => {
  const d = await draftForExport(c);
  if (!d) return draftGone(c);
  return download(rotaXlsx(d.details, d.roles, { draft: true }),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `bream-rota-DRAFT-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

app.get('/app/settings/generate/draft/:token/rota.pdf', async (c) => {
  const d = await draftForExport(c);
  if (!d) return draftGone(c);
  return download(await rotaPdf(d.details, d.roles, { draft: true }), 'application/pdf',
    `bream-rota-DRAFT-${new Date().toISOString().slice(0, 10)}.pdf`);
});

// Generating moved from Rota to Settings. The old address still works — a
// bookmark, or a draft page left open in a tab — by sending it on.
app.all('/app/rota/generate', (c) =>
  c.redirect('/app/settings/generate', c.req.method === 'GET' ? 301 : 307));
app.all('/app/rota/generate/*', (c) => {
  const rest = c.req.path.slice('/app/rota/generate'.length);
  const q = new URL(c.req.url).search;
  return c.redirect(`/app/settings/generate${rest}${q}`, c.req.method === 'GET' ? 301 : 307);
});

app.post('/app/settings/generate/apply', async (c) => {
  const form = await c.req.formData();
  const token = String(form.get('token') ?? '');
  const row = await c.env.DB.prepare(
    `SELECT payload, from_date, to_date FROM draft_rotas
      WHERE token = ?1 AND person_id = ?2`,
  ).bind(token, c.get('person').id).first<{ payload: string; from_date: string; to_date: string }>();

  if (!row) {
    return c.html(generateFormPage({
      ctx: viewCtx(c),
      defaultFrom: new Date().toISOString().slice(0, 10),
      defaultTo: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
      notice: { tone: 'bad', text: 'That draft has expired. Generate it again.' },
    }), 400);
  }

  interface DraftAllocation {
    serviceId: number; roleId: number; slot: number; personId: number; reason: string;
  }
  const parsed = JSON.parse(row.payload) as
    | DraftAllocation[]
    | { allocations: DraftAllocation[]; sundays: SundayPlan[]; provisional: { id: number; date: string }[];
        released?: number[] };

  // A draft parked before provisional Sundays existed is a bare array. Accepting
  // one of those must still work, so the old shape is read rather than rejected.
  const legacy = Array.isArray(parsed);
  const allocations = legacy ? parsed : parsed.allocations;
  const sundays = legacy ? [] : parsed.sundays;
  const provisional = legacy ? [] : parsed.provisional;

  // NOW the Sundays get written — this is the moment the draft was accepted, and
  // nothing has been left behind by the drafts that were not.
  if (sundays.length) await createSundays(c.env.DB, sundays);

  // Provisional ids are swapped for the real ones. Looked up by date rather than
  // trusted from createSundays, because a Sunday may have been created by
  // somebody else between the draft being made and being accepted, in which case
  // OR IGNORE added nothing and the existing row is the right one to use.
  if (provisional.length) {
    const byDate = new Map<string, number>();
    for (const chunk of chunked(provisional.map((p) => p.date), 50)) {
      const { results } = await c.env.DB.prepare(
        `SELECT id, service_date FROM services
          WHERE service_time = '10:30' AND service_date IN (${chunk.map(() => '?').join(',')})`,
      ).bind(...chunk).all<{ id: number; service_date: string }>();
      for (const r of results) byDate.set(r.service_date, r.id);
    }

    const realFor = new Map<number, number>();
    for (const p of provisional) {
      const real = byDate.get(p.date);
      if (real != null) realFor.set(p.id, real);
    }
    for (const a of allocations) {
      if (a.serviceId < 0) {
        const real = realFor.get(a.serviceId);
        // Dropped rather than written with a negative id. A service that could
        // not be created is a service nobody can be put on, and a foreign key
        // error here would throw the whole rota away.
        a.serviceId = real ?? 0;
      }
    }
  }
  const writable = allocations.filter((a) => a.serviceId > 0);

  // Replace only previously GENERATED drafts in the window; confirmed rows were
  // pins and are never touched.
  await c.env.DB.prepare(
    `DELETE FROM assignments
      WHERE generated = 1 AND status = 'draft'
        AND service_id IN (SELECT id FROM services WHERE service_date BETWEEN ?1 AND ?2)`,
  ).bind(row.from_date, row.to_date).run();

  // The bookings the preview said would come off. Re-checked against the person
  // as they are NOW, so somebody who came back from their break between the
  // draft and the click is not taken off for a reason that no longer applies.
  const released = legacy ? [] : (parsed.released ?? []);
  for (const chunk of chunked(released, 50)) {
    await c.env.DB.prepare(
      `DELETE FROM assignments
        WHERE status = 'confirmed' AND id IN (${chunk.map(() => '?').join(',')})
          AND person_id IN (SELECT id FROM people WHERE on_break = 1 OR is_guest = 1)`,
    ).bind(...chunk).run();
  }

  const stmt = c.env.DB.prepare(
    `INSERT OR REPLACE INTO assignments
       (service_id, role_id, slot, person_id, status, generated, reason)
     VALUES (?1, ?2, ?3, ?4, 'draft', 1, ?5)`,
  );
  const batch = writable.map((a) =>
    stmt.bind(a.serviceId, a.roleId, a.slot, a.personId, a.reason));
  for (let i = 0; i < batch.length; i += 100) {
    await c.env.DB.batch(batch.slice(i, i + 100));
  }
  await c.env.DB.prepare('DELETE FROM draft_rotas WHERE token = ?1').bind(token).run();

  return c.redirect('/app/rota', 303);
});

// ---------------------------------------------------------------------------
// Room booking
// ---------------------------------------------------------------------------

async function roomsView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
  form?: Record<string, string>,
) {
  // An emptied or mistyped date box sends ?from= with nothing usable in it,
  // which used to reach new Date(NaN) and fail the whole page.
  const asked = c.req.query('from') ?? '';
  const weekFrom = /^\d{4}-\d{2}-\d{2}$/.test(asked) && !Number.isNaN(Date.parse(asked))
    ? asked : new Date().toISOString().slice(0, 10);
  const [rooms, bookings, series, requests] = await Promise.all([
    listRooms(c.env.DB),
    listBookings(c.env.DB, weekFrom),
    listSeries(c.env.DB),
    listPendingRequests(c.env.DB),
  ]);
  return c.html(roomsPage({ rooms, bookings, series, requests, ctx: viewCtx(c), weekFrom, notice, form }));
}

app.get('/app/rooms', (c) => {
  // Arriving from a day in the calendar: ?on=YYYY-MM-DD&room=N. Both are
  // prefilled rather than assumed, so the form still shows what it is about to
  // do and can still be changed before anything is saved.
  const on = c.req.query('on');
  const room = c.req.query('room');
  const prefill: Record<string, string> = {};
  if (on && /^\d{4}-\d{2}-\d{2}$/.test(on)) prefill.on_date = on;
  if (room && /^\d+$/.test(room)) prefill.room_id = room;
  return roomsView(
    c,
    prefill.on_date
      ? { tone: 'ok', text: `Making a booking for ${formatDate(prefill.on_date)}. Fill in the rest below.` }
      : undefined,
    Object.keys(prefill).length ? prefill : undefined,
  );
});

app.post('/app/rooms/book', async (c) => {
  const form = await c.req.formData();
  const parsed = readBooking(form);
  const echo = Object.fromEntries(
    ['room_id', 'on_date', 'from_time', 'to_time', 'title', 'contact', 'notes']
      .map((k) => [k, String(form.get(k) ?? '')]),
  );
  if (!parsed.ok) return roomsView(c, { tone: 'bad', text: parsed.error }, echo);

  const repeat = String(form.get('repeat') ?? '');
  if (repeat) {
    return bookSeries(c, parsed.value, repeat, String(form.get('until') ?? ''), echo);
  }

  const { startsAt, endsAt } = instants(parsed.value);
  const clashes = await findClashes(c.env.DB, parsed.value.roomId, startsAt, endsAt);
  if (clashes.length) return roomsView(c, { tone: 'bad', text: clashNotice(clashes) }, echo);

  await c.env.DB.prepare(
    `INSERT INTO room_bookings (room_id, title, starts_at, ends_at, booked_by, contact, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(parsed.value.roomId, parsed.value.title, startsAt, endsAt,
    c.get('person').id, parsed.value.contact, parsed.value.notes).run();

  return roomsView(c, { tone: 'ok', text: `Booked: ${parsed.value.title}.` });
});


/**
 * Creates a repeating booking.
 *
 * A clash takes out that ONE date rather than failing the whole series: a
 * year-long weekly booking should not be refused because of one carol concert.
 * The dates it could not take are named in the result, because silently booking
 * 50 of 52 and saying "done" is how somebody turns up to an occupied room.
 */
async function bookSeries(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  v: BookingInput,
  repeat: string,
  until: string,
  echo: Record<string, string>,
) {
  const freqs = FREQUENCIES.map((f) => f.value) as string[];
  if (!freqs.includes(repeat)) {
    return roomsView(c, { tone: 'bad', text: 'That repeat pattern was not recognised.' }, echo);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < v.onDate) {
    return roomsView(c, {
      tone: 'bad', text: 'Give a date to carry on until, after the first booking.',
    }, echo);
  }

  const plan = await planSeries(
    c.env.DB, v.roomId, v.onDate, until, repeat as Frequency, v.fromTime, v.toTime);

  if (!plan.dates.length) {
    return roomsView(c, {
      tone: 'bad',
      text: plan.clashes.length
        ? `Every date in that pattern is already booked — ${plan.clashes.length} clash${plan.clashes.length === 1 ? '' : 'es'}. Nothing was booked.`
        : 'That pattern produces no dates. Check the dates and try again.',
    }, echo);
  }

  const res = await c.env.DB.prepare(
    `INSERT INTO room_booking_series
       (room_id, title, contact, notes, freq, from_date, until_date, from_time, to_time, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  ).bind(v.roomId, v.title, v.contact, v.notes, repeat, v.onDate, until,
    v.fromTime, v.toTime, c.get('person').id).run();
  const seriesId = Number(res.meta.last_row_id);

  const stmt = c.env.DB.prepare(
    `INSERT INTO room_bookings
       (room_id, title, starts_at, ends_at, booked_by, contact, notes, series_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  );
  const rows = plan.dates.map((d) => stmt.bind(
    v.roomId, v.title, `${d}T${v.fromTime}`, `${d}T${v.toTime}`,
    c.get('person').id, v.contact, v.notes, seriesId));
  for (let i = 0; i < rows.length; i += 100) await c.env.DB.batch(rows.slice(i, i + 100));

  // Everything the run could not do, said plainly.
  const asides: string[] = [];
  if (plan.clashes.length) {
    const shown = plan.clashes.slice(0, 5).map((x) => `${x.date} (${x.with})`).join(', ');
    asides.push(
      `${plan.clashes.length} date${plan.clashes.length === 1 ? ' was' : 's were'} skipped because the room was already taken: ${shown}${plan.clashes.length > 5 ? ', and more' : ''}`);
  }
  if (plan.skipped.length) {
    asides.push(`${plan.skipped.length} month${plan.skipped.length === 1 ? '' : 's'} had no such date (${plan.skipped[0]?.why})`);
  }
  if (plan.truncated) asides.push('the run was capped at 260 bookings');

  return roomsView(c, {
    tone: plan.clashes.length ? 'bad' : 'ok',
    text: `Booked ${plan.dates.length} × "${v.title}" — ${describeSeries(v.onDate, repeat as Frequency, until)}.`
      + (asides.length ? ` Note: ${asides.join('; ')}.` : ''),
  });
}

app.post('/app/rooms/series/:id/cancel', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const today = new Date().toISOString().slice(0, 10);

  const series = await c.env.DB.prepare(
    'SELECT title FROM room_booking_series WHERE id = ?1',
  ).bind(id).first<{ title: string }>();
  if (!series) return roomsView(c, { tone: 'bad', text: 'That series no longer exists.' });

  // Only what is still to come. Bookings that already happened are history and
  // deleting them would rewrite the diary.
  const res = await c.env.DB.prepare(
    `UPDATE room_bookings SET status = 'cancelled'
      WHERE series_id = ?1 AND starts_at >= ?2 AND status = 'booked'`,
  ).bind(id, `${today}T00:00`).run();

  const n = res.meta?.changes ?? 0;
  return roomsView(c, {
    tone: 'ok',
    text: `Cancelled ${n} remaining booking${n === 1 ? '' : 's'} for "${series.title}". `
      + 'Anything already past has been left alone.',
  });
});


app.get('/app/rooms/calendar', async (c) => {
  const month = /^\d{4}-\d{2}$/.test(c.req.query('month') ?? '')
    ? c.req.query('month')! : thisMonth();
  const roomParam = Number(c.req.query('room'));
  const roomId = Number.isInteger(roomParam) && roomParam > 0 ? roomParam : null;

  // The grid shows whole weeks, so it reaches a few days either side of the
  // month; fetch that wider span or bookings vanish from the leading and
  // trailing cells.
  const from = `${month}-01`;
  const start = new Date(`${from}T00:00:00Z`);
  const fetchFrom = new Date(start.getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const [rooms, all] = await Promise.all([listRooms(c.env.DB), listBookings(c.env.DB, fetchFrom, 49)]);
  const counts = new Map<number, number>();
  for (const b of all) {
    // Counted if it touches the month at all, so a hold that starts on the 31st
    // still counts for the 1st.
    if (b.starts_at.slice(0, 7) <= month && lastDay(b.starts_at, b.ends_at).slice(0, 7) >= month) {
      counts.set(b.room_id, (counts.get(b.room_id) ?? 0) + 1);
    }
  }
  const bookings = roomId ? all.filter((b) => b.room_id === roomId) : all;
  return c.html(roomsCalendarPage({ rooms, roomId, bookings, counts, month, ctx: viewCtx(c) }));
});

app.get('/app/rooms/series/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const [series, rooms] = await Promise.all([getSeries(c.env.DB, id), listRooms(c.env.DB)]);
  if (!series) return c.notFound();
  return c.html(editSeriesPage({ series, rooms, ctx: viewCtx(c) }));
});

app.post('/app/rooms/series/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();
  const [series, rooms] = await Promise.all([getSeries(c.env.DB, id), listRooms(c.env.DB)]);
  if (!series) return c.notFound();

  const str = (k: string) => String(form.get(k) ?? '').trim();
  const bad = (text: string) =>
    c.html(editSeriesPage({ series, rooms, ctx: viewCtx(c), notice: { tone: 'bad', text } }), 400);

  const roomId = Number(form.get('room_id'));
  const freq = str('freq');
  const until = str('until');
  const fromTime = str('from_time');
  const toTime = str('to_time');
  const title = str('title');

  if (!Number.isInteger(roomId)) return bad('Choose a room.');
  if (!title) return bad('Say what the booking is for.');
  if (!/^\d{2}:\d{2}$/.test(fromTime) || !/^\d{2}:\d{2}$/.test(toTime)) {
    return bad('Give a start and an end time.');
  }
  if (toTime <= fromTime) return bad('The end time has to be after the start time.');
  if (!(FREQUENCIES.map((f) => f.value) as string[]).includes(freq)) {
    return bad('That repeat pattern was not recognised.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return bad('Give a date to carry on until.');
  if (until < new Date().toISOString().slice(0, 10)) {
    return bad('That end date is in the past. To stop the series, cancel it instead.');
  }

  let result;
  try {
    result = await applySeriesEdit(c.env.DB, id, {
      roomId, title, contact: str('contact') || null, notes: str('notes') || null,
      freq: freq as Frequency, untilDate: until, fromTime, toTime,
    }, c.get('person').id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('series edit failed', { id, message });
    return bad(`Nothing was changed. The database said: ${message}`);
  }

  // Everything the rebuild could not do, said plainly rather than left to be
  // discovered by somebody turning up to the wrong room.
  const asides: string[] = [];
  if (result.clashes.length) {
    const shown = result.clashes.slice(0, 4).map((x) => `${x.date} (${x.with})`).join(', ');
    asides.push(
      `${result.clashes.length} date${result.clashes.length === 1 ? '' : 's'} could not be taken because the room was busy: ${shown}${result.clashes.length > 4 ? ', and more' : ''}`);
  }
  if (result.protectedDates.length) {
    asides.push(
      `${result.protectedDates.length} week${result.protectedDates.length === 1 ? ' was' : 's were'} left as you had already set ${result.protectedDates.length === 1 ? 'it' : 'them'}`);
  }
  if (result.skipped.length) {
    asides.push(`${result.skipped.length} month${result.skipped.length === 1 ? '' : 's'} had no such date (${result.skipped[0]?.why})`);
  }
  if (result.truncated) asides.push('the run was capped at 260 bookings');

  return roomsView(c, {
    tone: result.clashes.length ? 'bad' : 'ok',
    text: `Updated "${title}" — ${result.written} booking${result.written === 1 ? '' : 's'} still to come.`
      + (asides.length ? ` Note: ${asides.join('; ')}.` : ''),
  });
});

// ---- requests to book, and the public form's settings ---------------------
//
// Registered before /app/rooms/:id, which would otherwise take "booking-form"
// for a booking id.

async function bookingFormView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const [settings, { results: rooms }] = await Promise.all([
    loadFormSettings(c.env.DB),
    c.env.DB.prepare(
      'SELECT id, name, public_booking FROM rooms WHERE is_active = 1 ORDER BY sort_order, name',
    ).all<{ id: number; name: string; public_booking: number }>(),
  ]);
  return c.html(bookingFormSettingsPage({
    settings, rooms, link: `${new URL(c.req.url).origin}/rooms/book`,
    emailReady: Boolean(c.env.EMAIL && c.env.ACK_FROM), captchaReady: turnstileReady(c.env),
    ctx: viewCtx(c), notice,
  }));
}

app.get('/app/rooms/booking-form', (c) => bookingFormView(c));

app.post('/app/rooms/booking-form', async (c) => {
  const form = await c.req.formData();
  const n = (k: string, lo: number, hi: number) => {
    const raw = String(form.get(k) ?? '').trim();
    const v = Number(raw);
    return raw !== '' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
  };
  const minNotice = n('min_days_notice', 0, 60);
  const maxAhead = n('max_days_ahead', 7, 730);
  if (minNotice == null || maxAhead == null) {
    return bookingFormView(c, { tone: 'bad', text: 'Give the least notice as 0 to 60 days and the furthest ahead as 7 to 730 days. Nothing was saved.' });
  }
  if (minNotice >= maxAhead) {
    return bookingFormView(c, { tone: 'bad', text: 'The least notice has to be shorter than how far ahead people can ask, or no date could be chosen. Nothing was saved.' });
  }
  const email = String(form.get('notify_email') ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bookingFormView(c, { tone: 'bad', text: `"${email}" does not look like an email address. Nothing was saved.` });
  }
  const publicRooms = new Set(form.getAll('public_rooms').map(Number));
  const { results: rooms } = await c.env.DB.prepare('SELECT id FROM rooms').all<{ id: number }>();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE room_form_settings
          SET is_open = ?1, intro = ?2, notify_email = ?3, min_days_notice = ?4,
              max_days_ahead = ?5, allow_repeating = ?6, updated_at = datetime('now')
        WHERE id = 1`,
    ).bind(form.get('is_open') ? 1 : 0, String(form.get('intro') ?? '').trim().slice(0, 2000) || null,
      email || null, minNotice, maxAhead,
      form.get('allow_repeating') ? 1 : 0),
    ...rooms.map((r) => c.env.DB.prepare('UPDATE rooms SET public_booking = ?2 WHERE id = ?1')
      .bind(r.id, publicRooms.has(r.id) ? 1 : 0)),
  ]);
  return bookingFormView(c, { tone: 'ok', text: 'Saved.' });
});

/** Emails the person who asked, once somebody has decided. Never throws. */
async function tellRequester(c: Context<{ Bindings: Env; Variables: Vars }>, r: RequestRow, approved: boolean, note: string | null) {
  try {
    const m = decisionEmail(r, approved, note);
    const res = await sendEmail(c.env.EMAIL, c.env.ACK_FROM, m.to, m.subject, m.body);
    if (res.status !== 'sent') console.error('room request decision not emailed', { id: r.id, ...res });
    return res.status === 'sent';
  } catch (err) {
    console.error('room request decision email failed', { id: r.id, err: String(err) });
    return false;
  }
}

app.post('/app/rooms/requests/:id/approve', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const anyway = (await c.req.formData()).get('anyway') === '1';
  const d = await approveRequest(c.env.DB, id, c.get('person').id, anyway);
  if (!d.ok) {
    return roomsView(c, {
      tone: 'bad',
      text: d.why === 'clashes'
        ? `Not approved: something else has been booked over ${d.clashes} of its dates since it was asked for. `
          + 'Look at the diary, then use "Approve anyway" if both should go ahead.'
        : 'That request has already been decided.',
    });
  }
  const r = d.request;
  const emailed = await tellRequester(c, r, true, null);
  return roomsView(c, {
    tone: 'ok',
    text: `Approved: ${r.purpose} in the ${r.room_name}. It is now booked on the diary`
      + (emailed ? ` and ${r.name} has been emailed.` : ` — ${r.name} could not be emailed, so please let them know.`),
  });
});

app.post('/app/rooms/requests/:id/decline', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const note = String((await c.req.formData()).get('note') ?? '').trim().slice(0, 1000) || null;
  const d = await declineRequest(c.env.DB, id, c.get('person').id, note);
  if (!d.ok) return roomsView(c, { tone: 'bad', text: 'That request has already been decided.' });
  const r = d.request;
  const emailed = await tellRequester(c, r, false, note);
  return roomsView(c, {
    tone: 'ok',
    text: `Declined, and the time is free again.`
      + (emailed ? ` ${r.name} has been emailed.` : ` ${r.name} could not be emailed, so please let them know.`),
  });
});

app.get('/app/rooms/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const [booking, rooms] = await Promise.all([getBooking(c.env.DB, id), listRooms(c.env.DB)]);
  if (!booking) return c.notFound();
  return c.html(editBookingPage({ booking, rooms, ctx: viewCtx(c) }));
});

app.post('/app/rooms/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();
  const parsed = readBooking(form);
  const [booking, rooms] = await Promise.all([getBooking(c.env.DB, id), listRooms(c.env.DB)]);
  if (!booking) return c.notFound();
  // A room held for an event is changed through the event. The page no longer
  // offers a form for one, but an old tab could still post here, and this form
  // would cut a hold that runs over a weekend down to one day.
  if (booking.event_id) {
    return c.html(editBookingPage({
      booking, rooms, ctx: viewCtx(c),
      notice: { tone: 'bad', text: 'Not saved: this room is held for an event. Change it on the event.' },
    }), 409);
  }
  if (booking.is_tentative && booking.request_id) {
    return c.html(editBookingPage({
      booking, rooms, ctx: viewCtx(c),
      notice: { tone: 'bad', text: 'Not saved: this is a request still waiting to be decided. Approve or decline it on the Rooms page.' },
    }), 409);
  }

  if (!parsed.ok) {
    return c.html(editBookingPage({ booking, rooms, ctx: viewCtx(c), notice: { tone: 'bad', text: parsed.error } }));
  }
  const { startsAt, endsAt } = instants(parsed.value);
  // Exclude itself, or moving a booking by ten minutes would clash with itself.
  const clashes = await findClashes(c.env.DB, parsed.value.roomId, startsAt, endsAt, id);
  if (clashes.length) {
    return c.html(editBookingPage({ booking, rooms, ctx: viewCtx(c), notice: { tone: 'bad', text: clashNotice(clashes) } }));
  }

  await c.env.DB.prepare(
    `UPDATE room_bookings
        SET room_id = ?2, title = ?3, starts_at = ?4, ends_at = ?5,
            contact = ?6, notes = ?7, status = 'booked',
            series_detached = CASE WHEN series_id IS NULL THEN 0 ELSE 1 END
      WHERE id = ?1`,
  ).bind(id, parsed.value.roomId, parsed.value.title, startsAt, endsAt,
    parsed.value.contact, parsed.value.notes).run();

  return roomsView(c, { tone: 'ok', text: `Updated: ${parsed.value.title}.` });
});

app.post('/app/rooms/:id/cancel', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  // A room held for an event is let go by unticking it on the event, so the
  // event and the diary cannot disagree about whether it has the room.
  const held = await c.env.DB.prepare(
    'SELECT event_id, is_tentative, request_id FROM room_bookings WHERE id = ?1',
  ).bind(id).first<{ event_id: number | null; is_tentative: number; request_id: number | null }>();
  if (held?.is_tentative && held.request_id) {
    return roomsView(c, {
      tone: 'bad',
      text: 'Not cancelled: that is a request still waiting to be decided. Decline it instead, above.',
    });
  }
  if (held?.event_id) {
    return roomsView(c, {
      tone: 'bad',
      text: 'Not cancelled: that room is held for an event. Untick it on the event to let it go.',
    });
  }
  // Cancelled, not deleted: a booking somebody made and someone else cancelled
  // is worth still being able to look up.
  await c.env.DB.prepare("UPDATE room_bookings SET status = 'cancelled' WHERE id = ?1")
    .bind(id).run();
  return roomsView(c, { tone: 'ok', text: 'Booking cancelled.' });
});


// ---- calendar views -------------------------------------------------------

app.get('/app/rota/calendar', async (c) => {
  const month = /^\d{4}-\d{2}$/.test(c.req.query('month') ?? '')
    ? c.req.query('month')! : thisMonth();
  const from = `${month}-01`;
  const start = new Date(`${from}T00:00:00Z`);
  const fetchFrom = new Date(start.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const fetchTo = new Date(start.getTime() + 45 * 86400000).toISOString().slice(0, 10);

  const services = (await listUpcomingServices(c.env.DB, fetchFrom, 300))
    .filter((s) => s.service_date <= fetchTo);
  return c.html(rotaCalendarPage({ services, month, ctx: viewCtx(c) }));
});


// ---------------------------------------------------------------------------
// Rooms, as settings
// ---------------------------------------------------------------------------

async function roomSettingsView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const today = new Date().toISOString().slice(0, 10);
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.name, r.capacity, r.notes, r.sort_order, r.is_active,
            (SELECT COUNT(*) FROM room_bookings b
              WHERE b.room_id = r.id AND b.status = 'booked') AS total,
            (SELECT COUNT(*) FROM room_bookings b
              WHERE b.room_id = r.id AND b.status = 'booked' AND b.ends_at > ?1) AS upcoming
       FROM rooms r ORDER BY r.sort_order, r.name`,
  ).bind(`${today}T00:00`).all<RoomSettingRow>();
  return c.html(roomSettingsPage({ rooms: results, ctx: viewCtx(c), notice }));
}

app.get('/app/settings/rooms', (c) => roomSettingsView(c));

app.post('/app/settings/rooms', async (c) => {
  const form = await c.req.formData();
  const { results: rooms } = await c.env.DB.prepare('SELECT id, name FROM rooms')
    .all<{ id: number; name: string }>();

  const stmts = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const r of rooms) {
    const name = String(form.get(`name_${r.id}`) ?? '').trim();
    if (!name) { problems.push(`"${r.name}" cannot have an empty name`); continue; }
    // Two rooms with the same name would make the diary unreadable, and the
    // table has a UNIQUE index that would throw anyway.
    const key = name.toLowerCase();
    if (seen.has(key)) { problems.push(`more than one room is called "${name}"`); continue; }
    seen.add(key);

    const cap = Number(form.get(`capacity_${r.id}`));
    stmts.push(c.env.DB.prepare(
      'UPDATE rooms SET name = ?2, capacity = ?3, notes = ?4, is_active = ?5 WHERE id = ?1',
    ).bind(r.id, name,
      Number.isInteger(cap) && cap > 0 ? cap : null,
      String(form.get(`notes_${r.id}`) ?? '').trim() || null,
      form.get(`active_${r.id}`) ? 1 : 0));
  }

  if (problems.length) {
    return roomSettingsView(c, { tone: 'bad', text: `Nothing was saved. ${problems.join('. ')}.` });
  }
  try {
    for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return roomSettingsView(c, { tone: 'bad', text: `Nothing was saved. The database said: ${message}` });
  }
  return roomSettingsView(c, {
    tone: 'ok',
    text: `Saved ${stmts.length} room${stmts.length === 1 ? '' : 's'}. Existing bookings follow the new names.`,
  });
});

app.post('/app/settings/rooms/new', async (c) => {
  const form = await c.req.formData();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return roomSettingsView(c, { tone: 'bad', text: 'Give the room a name.' });

  const cap = Number(form.get('capacity'));
  const maxOrder = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM rooms')
    .first<{ m: number }>();

  try {
    await c.env.DB.prepare(
      'INSERT INTO rooms (name, capacity, notes, sort_order) VALUES (?1, ?2, ?3, ?4)',
    ).bind(name,
      Number.isInteger(cap) && cap > 0 ? cap : null,
      String(form.get('notes') ?? '').trim() || null,
      (maxOrder?.m ?? 0) + 10).run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return roomSettingsView(c, {
      tone: 'bad',
      text: /UNIQUE/i.test(message)
        ? `There is already a room called "${name}".`
        : `It could not be added. The database said: ${message}`,
    });
  }
  return roomSettingsView(c, { tone: 'ok', text: `Added "${name}". It can be booked straight away.` });
});

// ---------------------------------------------------------------------------
// Events (admin)
// ---------------------------------------------------------------------------

app.get('/app/events', async (c) =>
  c.html(eventsListPage({ events: await listEvents(c.env.DB), ctx: viewCtx(c) })));

app.get('/app/events/new', async (c) =>
  c.html(newEventPage({ ctx: viewCtx(c), rooms: await listRooms(c.env.DB) })));

/** The per-booking limit from a form: 1 to 50, and 10 if it is missing or
 *  nonsense rather than refusing the whole save over it. */
const perBooking = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : 10;
};

app.post('/app/events/new', async (c) => {
  const form = await c.req.formData();
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const echo = Object.fromEntries(
    ['title', 'description', 'on_date', 'start_time', 'end_date', 'end_time', 'location', 'capacity',
      'max_per_booking', 'closes']
      .map((k) => [k, s(k)]));
  const rooms = await listRooms(c.env.DB);
  const roomIds = readRoomIds(form).filter((id) => rooms.some((r) => r.id === id));
  const notify = !!form.get('notify_organisers');
  const refuse = (error: string, status: 400 | 409 = 400, offerOverride = false) => c.html(newEventPage({
    ctx: viewCtx(c), rooms, error, form: echo, roomIds, notify, offerOverride,
    organisers: form.getAll('organiser_name').map((n, i) => ({
      name: String(n), email: String(form.getAll('organiser_email')[i] ?? ''),
    })),
  }), status);

  const title = s('title');
  if (!title) return refuse('Give the event a name.');
  const when = readEventWhen(form, true);
  if (!when.ok) return refuse(when.error);
  const { startsAt } = when;
  // Required above, so always present here.
  const endsAt = when.endsAt!;

  const organisers = readOrganisers(form, notify);
  if (!organisers.ok) return refuse(organisers.error);

  // Checked before the event is written, so a clash never leaves behind an
  // event that looks as though it has its rooms when it does not — unless the
  // person has ticked to hold the rooms anyway, alongside what is there.
  if (!form.get('allow_clash')) {
    const clashes = await eventRoomClashes(c.env.DB, roomIds, startsAt, endsAt);
    if (clashes.length) return refuse(describeClashes(clashes), 409, true);
  }

  const capacity = Number(form.get('capacity'));
  const slug = await makeSlug(c.env.DB, title);

  const res = await c.env.DB.prepare(
    `INSERT INTO events (slug, title, description, starts_at, ends_at, location, capacity,
                          booking_closes_at, ask_email, ask_phone, notify_organisers, max_per_booking)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  ).bind(slug, title, s('description') || null, startsAt, endsAt,
    s('location') || null, Number.isInteger(capacity) && capacity > 0 ? capacity : null,
    s('closes') || null, form.get('ask_email') ? 1 : 0, form.get('ask_phone') ? 1 : 0,
    notify ? 1 : 0, perBooking(form.get('max_per_booking'))).run();
  const eventId = Number(res.meta.last_row_id);

  await saveOrganisers(c.env.DB, eventId, organisers.value);
  await syncEventRooms(c.env.DB, {
    eventId, roomIds, title, startsAt, endsAt, bookedBy: c.get('person').id,
  });

  return c.redirect(`/app/events/${eventId}`, 303);
});

async function eventAdminView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  id: number,
  notice?: { tone: 'ok' | 'bad'; text: string },
  details?: { values: Record<string, string>; roomIds: number[]; error: string; offerOverride: boolean },
) {
  const [event, fields, bookings, rooms, roomIds, organisers] = await Promise.all([
    getEvent(c.env.DB, id), listFields(c.env.DB, id), listEventBookings(c.env.DB, id),
    listRooms(c.env.DB), eventRoomIds(c.env.DB, id), listOrganisers(c.env.DB, id),
  ]);
  if (!event) return c.notFound();
  return c.html(eventAdminPage({
    event, fields, bookings, rooms, roomIds, organisers, details,
    ctx: viewCtx(c), origin: new URL(c.req.url).origin, notice,
    emailReady: Boolean(c.env.EMAIL && c.env.ACK_FROM),
    captchaReady: turnstileReady(c.env),
  }));
}

app.get('/app/events/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  return eventAdminView(c, id);
});

/**
 * Change an event after it exists.
 *
 * Capacity above all: numbers change once people start replying, and having to
 * delete an event and start again because twelve more want to come is not a
 * thing to make anybody do.
 */
app.post('/app/events/:id/details', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();

  const form = await c.req.formData();
  const str = (k: string) => {
    const v = String(form.get(k) ?? '').trim();
    return v.length ? v : null;
  };

  // A refused save is drawn again from what was typed, with the reason by the
  // Save button. It used to redraw the saved event with the reason at the top
  // of the page, so a refusal looked exactly like the save being ignored.
  const values = Object.fromEntries(
    ['title', 'description', 'on_date', 'start_time', 'end_date', 'end_time', 'location', 'capacity',
      'max_per_booking', 'closes'].map((k) => [k, String(form.get(k) ?? '')]));
  const rooms = await listRooms(c.env.DB);
  const roomIds = readRoomIds(form).filter((r) => rooms.some((x) => x.id === r));
  const refuse = (error: string, offerOverride = false) =>
    eventAdminView(c, id, undefined, { values, roomIds, error, offerOverride });

  const title = str('title');
  if (!title) return refuse('Give the event a name.');
  // The finish is optional here only because events from before it was asked
  // for have none; rooms need one, which is checked below.
  const when = readEventWhen(form, false);
  if (!when.ok) return refuse(when.error);
  const { startsAt, endsAt } = when;

  const rawCapacity = String(form.get('capacity') ?? '').trim();
  const capacity = rawCapacity === '' ? null : Number(rawCapacity);
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 2000)) {
    return refuse('How many can come has to be a number from 1 to 2000, or blank for no limit.');
  }

  if (roomIds.length && !endsAt) return refuse('Give a finish time, so the rooms can be booked until then.');
  // Checked before anything is saved. Moving the event onto a time when one of
  // its rooms is taken must not leave the event moved and its room behind.
  //
  // An administrator may hold the rooms anyway: a weekend event in the church
  // naturally includes the Sunday service, and refusing it helps nobody. The
  // other bookings stand; both show on the diary.
  if (endsAt && !form.get('allow_clash')) {
    const clashes = await eventRoomClashes(c.env.DB, roomIds, startsAt, endsAt, id);
    if (clashes.length) return refuse(describeClashes(clashes), true);
  }

  // Lowering the capacity below what is already booked is ALLOWED and nobody is
  // thrown off — the bookings were made in good faith. It simply means no more
  // are taken until the numbers come back under it, and the page says so rather
  // than refusing an edit somebody had a reason for.
  const booked = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(party_size), 0) AS n FROM event_bookings
      WHERE event_id = ?1 AND status = 'booked'`,
  ).bind(id).first<{ n: number }>();

  await c.env.DB.prepare(
    `UPDATE events
        SET title = ?2, description = ?3, starts_at = ?4, location = ?5,
            capacity = ?6, booking_closes_at = ?7, ends_at = ?8, max_per_booking = ?9
      WHERE id = ?1`,
  ).bind(id, title, str('description'), startsAt, str('location'),
    capacity, str('closes'), endsAt, perBooking(form.get('max_per_booking'))).run();

  await syncEventRooms(c.env.DB, {
    eventId: id, roomIds, title, startsAt, endsAt: endsAt ?? startsAt, bookedBy: c.get('person').id,
  });

  const over = capacity != null && (booked?.n ?? 0) > capacity;
  // Say what is now held, so nobody has to open the diary to find out whether
  // the rooms took.
  const heldNames = rooms.filter((r) => roomIds.includes(r.id)).map((r) => r.name);
  const held = heldNames.length && endsAt
    ? ` ${heldNames.join(' and ')} ${heldNames.length === 1 ? 'is' : 'are'} held ${formatWhen(startsAt, endsAt)}.`
    : '';
  return eventAdminView(c, id, {
    tone: over ? 'bad' : 'ok',
    text: over
      ? `Saved — but ${booked?.n} places are already booked and you have set the limit to `
        + `${capacity}. Nobody has been thrown off; no further bookings will be taken until `
        + `the numbers come back under it.${held}`
      : `Saved.${held}`,
  });
});

app.post('/app/events/:id/publish', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const publish = String((await c.req.formData()).get('publish')) === '1';
  await c.env.DB.prepare('UPDATE events SET is_published = ?2 WHERE id = ?1')
    .bind(id, publish ? 1 : 0).run();
  return eventAdminView(c, id, {
    tone: 'ok',
    text: publish ? 'Published. The booking link now works.' : 'Bookings closed.',
  });
});

/**
 * An event's bookings, for the download. Needs the right to manage events, not
 * just to see them: a file of everybody's email and phone number travels much
 * further than a page does.
 */
async function attendeesFor(c: Context<{ Bindings: Env; Variables: Vars }>) {
  if (!(c.get('areas') ?? new Set()).has('events.manage')) return null;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return null;
  const [event, fields, bookings] = await Promise.all([
    getEvent(c.env.DB, id), listFields(c.env.DB, id), listEventBookings(c.env.DB, id),
  ]);
  return event ? { event, fields, bookings } : null;
}

/** 'Harvest Supper' -> 'harvest-supper', for a filename. */
const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';

app.get('/app/events/:id/attendees.xlsx', async (c) => {
  const a = await attendeesFor(c);
  if (!a) return c.notFound();
  return download(attendeesXlsx(a.event, a.fields, a.bookings),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `${fileSlug(a.event.title)}-attendees.xlsx`);
});

app.get('/app/events/:id/attendees.pdf', async (c) => {
  const a = await attendeesFor(c);
  if (!a) return c.notFound();
  return download(await attendeesPdf(a.event, a.fields, a.bookings), 'application/pdf',
    `${fileSlug(a.event.title)}-attendees.pdf`);
});

app.post('/app/events/:id/organisers', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();
  const notify = !!form.get('notify_organisers');
  const organisers = readOrganisers(form, notify);
  if (!organisers.ok) return eventAdminView(c, id, { tone: 'bad', text: organisers.error });

  await saveOrganisers(c.env.DB, id, organisers.value);
  await c.env.DB.prepare('UPDATE events SET notify_organisers = ?2 WHERE id = ?1')
    .bind(id, notify ? 1 : 0).run();

  const ready = Boolean(c.env.EMAIL && c.env.ACK_FROM);
  return eventAdminView(c, id, {
    tone: notify && !ready ? 'bad' : 'ok',
    text: notify
      ? (ready
        ? 'Saved. The organisers will be emailed each time somebody books.'
        : 'Saved, but nothing will actually be sent yet: email sending is not set up on this '
          + 'Cloudflare account.')
      : 'Saved.',
  });
});

/**
 * Tells the organisers about a new booking, if the event asks for that.
 *
 * Only ever called after the booking is committed, and never throws: a mail
 * failure is logged and the person booking still sees their booking confirmed.
 */
async function tellOrganisers(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  eventId: number,
  booking: BookingAttempt,
  byOffice: boolean,
  waitlist = false,
) {
  try {
    const event = await getEvent(c.env.DB, eventId);
    if (!event?.notify_organisers) return;
    const [organisers, fields] = await Promise.all([
      listOrganisers(c.env.DB, eventId), listFields(c.env.DB, eventId),
    ]);
    const sent = await notifyOrganisers(c.env.EMAIL, c.env.ACK_FROM, organisers, {
      eventTitle: event.title,
      eventWhen: formatWhen(event.starts_at, event.ends_at),
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      partySize: booking.partySize,
      answers: booking.answers.map((a) => ({
        label: fields.find((f) => f.id === a.fieldId)?.label ?? 'Answer', value: a.value,
      })),
      booked: event.booked,
      capacity: event.capacity,
      adminUrl: `${new URL(c.req.url).origin}/app/events/${eventId}`,
      byOffice,
      waitlist,
    });
    for (const s of sent) {
      if (s.result.status !== 'sent') {
        console.error('organiser not emailed', { eventId, to: s.to, ...s.result });
      }
    }
  } catch (err) {
    console.error('organiser notice failed', { eventId, err: String(err) });
  }
}


/** What an event poster may be. Anything else is refused rather than stored and
 *  served back to whoever opens the booking page. */
const POSTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const POSTER_MAX_BYTES = 5 * 1024 * 1024;

app.post('/app/events/:id/contact', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();
  const sendAck = form.get('send_ack') ? 1 : 0;
  const subject = String(form.get('ack_subject') ?? '').trim();
  const body = String(form.get('ack_body') ?? '').trim();

  if (sendAck && (!subject || !body)) {
    return eventAdminView(c, id, {
      tone: 'bad',
      text: 'An acknowledgement needs both a subject and something to say.',
    });
  }

  // An acknowledgement with nowhere to send it is not an acknowledgement, so
  // asking for the address stops being optional.
  const askEmail = sendAck ? 1 : (form.get('ask_email') ? 1 : 0);

  await c.env.DB.prepare(
    `UPDATE events SET ask_email = ?2, ask_phone = ?3,
            send_ack = ?4, ack_subject = ?5, ack_body = ?6
      WHERE id = ?1`,
  ).bind(id, askEmail, form.get('ask_phone') ? 1 : 0,
    sendAck, sendAck ? subject : null, sendAck ? body : null).run();

  const ready = Boolean(c.env.EMAIL && c.env.ACK_FROM);
  return eventAdminView(c, id, {
    tone: sendAck && !ready ? 'bad' : 'ok',
    text: sendAck
      ? (ready
        ? 'Saved. Everyone who books will get an acknowledgement, and an email address is now compulsory.'
        : 'Saved, but nothing will actually be sent yet: email sending is not set up on this '
          + 'Cloudflare account. Bookings still work and an email address is now compulsory.')
      : 'Saved.',
  });
});

app.post('/app/events/:id/poster', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();
  const file = form.get('poster');

  if (!(file instanceof File) || file.size === 0) {
    return eventAdminView(c, id, { tone: 'bad', text: 'Choose an image to upload.' });
  }
  if (!POSTER_TYPES.has(file.type)) {
    return eventAdminView(c, id, {
      tone: 'bad', text: 'That has to be a JPEG, PNG or WebP image.',
    });
  }
  if (file.size > POSTER_MAX_BYTES) {
    return eventAdminView(c, id, {
      tone: 'bad',
      text: `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 5MB.`,
    });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  // The key carries the event id and a random part, so replacing a poster cannot
  // be cached as the old one and a key cannot be guessed from the slug.
  const key = `events/${id}/${newSessionId().slice(0, 16)}.${ext}`;

  const previous = await c.env.DB.prepare('SELECT poster_key FROM events WHERE id = ?1')
    .bind(id).first<{ poster_key: string | null }>();

  await c.env.IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=86400' },
  });
  await c.env.DB.prepare('UPDATE events SET poster_key = ?2 WHERE id = ?1').bind(id, key).run();
  // Only after the new one is safely recorded.
  if (previous?.poster_key) await c.env.IMAGES.delete(previous.poster_key).catch(() => {});

  return eventAdminView(c, id, { tone: 'ok', text: 'Poster uploaded.' });
});

app.post('/app/events/:id/poster/delete', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const row = await c.env.DB.prepare('SELECT poster_key FROM events WHERE id = ?1')
    .bind(id).first<{ poster_key: string | null }>();
  await c.env.DB.prepare('UPDATE events SET poster_key = NULL WHERE id = ?1').bind(id).run();
  if (row?.poster_key) await c.env.IMAGES.delete(row.poster_key).catch(() => {});
  return eventAdminView(c, id, { tone: 'ok', text: 'Poster removed.' });
});

app.post('/app/events/:id/fields', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const form = await c.req.formData();
  const label = String(form.get('label') ?? '').trim();
  const kind = String(form.get('kind') ?? 'text');
  if (!label) return eventAdminView(c, id, { tone: 'bad', text: 'Give the question a name.' });

  const choices = String(form.get('options') ?? '')
    .split('\n').map((x) => x.trim()).filter(Boolean);
  if ((kind === 'select' || kind === 'radio') && choices.length < 2) {
    return eventAdminView(c, id, {
      tone: 'bad', text: 'A list needs at least two choices, one per line.',
    });
  }

  const existing = await listFields(c.env.DB, id);
  const key = fieldKey(label, new Set(existing.map((f) => f.key)));
  await c.env.DB.prepare(
    `INSERT INTO event_fields (event_id, key, label, kind, options, required, sort_order)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(id, key, label, kind,
    choices.length ? JSON.stringify(choices) : null,
    form.get('required') ? 1 : 0, (existing.length + 1) * 10).run();

  return eventAdminView(c, id, { tone: 'ok', text: `Added "${label}".` });
});

app.post('/app/events/:id/fields/:fieldId/delete', async (c) => {
  const id = Number(c.req.param('id'));
  const fieldId = Number(c.req.param('fieldId'));
  if (!Number.isInteger(id) || !Number.isInteger(fieldId)) return c.notFound();
  // Answers already given go with it. Keeping orphaned answers to a question
  // nobody can see is worse than losing them.
  await c.env.DB.prepare('DELETE FROM event_fields WHERE id = ?1 AND event_id = ?2')
    .bind(fieldId, id).run();
  return eventAdminView(c, id, { tone: 'ok', text: 'Question removed.' });
});

// ---------------------------------------------------------------------------
// Bookings the office takes and changes by hand.
//
// Most bookings arrive through the public link, but people ring up — to book, to
// pull out, to add a grandchild, to say they got their own email address wrong.
// All of that has to be doable from this side, or the list stops matching what
// the office actually knows.
// ---------------------------------------------------------------------------

const BOOKING_STATUSES = new Set(['booked', 'cancelled', 'waitlist']);

/** The event and its questions, or null when the id in the path is nonsense. */
async function eventForBooking(c: Context<{ Bindings: Env; Variables: Vars }>, eventId: number) {
  if (!Number.isInteger(eventId)) return null;
  const event = await getEvent(c.env.DB, eventId);
  if (!event) return null;
  return { event, fields: await listFields(c.env.DB, eventId) };
}

app.get('/app/events/:id/bookings/new', async (c) => {
  const found = await eventForBooking(c, Number(c.req.param('id')));
  if (!found) return c.notFound();
  return c.html(bookingEditPage({ ...found, ctx: viewCtx(c) }));
});

app.post('/app/events/:id/bookings/new', async (c) => {
  const eventId = Number(c.req.param('id'));
  const found = await eventForBooking(c, eventId);
  if (!found) return c.notFound();
  const form = await c.req.formData();
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) values[k] = String(v);

  const parsed = readBookingForm(form, found.fields, 'office');
  if (!parsed.ok) {
    return c.html(bookingEditPage({ ...found, ctx: viewCtx(c), values, error: parsed.error }), 400);
  }

  const status = String(form.get('status') ?? 'booked');
  if (!BOOKING_STATUSES.has(status)) {
    return c.html(bookingEditPage({
      ...found, ctx: viewCtx(c), values, error: 'Choose where this booking stands.',
    }), 400);
  }

  // Only a real booking is measured against the capacity. Putting somebody on
  // the waiting list is precisely the thing to do when there is no room, so it
  // must not be refused for there being no room.
  if (status === 'booked') {
    const room = await hasRoom(c.env.DB, eventId, parsed.value.partySize);
    if (!room.ok) {
      return c.html(bookingEditPage({
        ...found, ctx: viewCtx(c), values,
        error: room.left === 0
          ? 'The event is full. Put them on the waiting list, or raise the capacity first.'
          : `Only ${room.left} place${room.left === 1 ? '' : 's'} left — this booking is for ${parsed.value.partySize}.`,
      }), 409);
    }
  }

  await saveBooking(c.env.DB, {
    eventId, booking: parsed.value, status: status as 'booked' | 'cancelled' | 'waitlist',
  });
  // Somebody coming, or somebody waiting for a place, is news. A booking typed
  // in already cancelled is only a record.
  if (status !== 'cancelled') {
    await tellOrganisers(c, eventId, parsed.value, true, status === 'waitlist');
  }
  return eventAdminView(c, eventId, {
    tone: 'ok',
    text: `${parsed.value.name} added — ${parsed.value.partySize} ${parsed.value.partySize === 1 ? 'place' : 'places'}.`,
  });
});

app.get('/app/events/:id/bookings/:bookingId', async (c) => {
  const eventId = Number(c.req.param('id'));
  const bookingId = Number(c.req.param('bookingId'));
  const found = await eventForBooking(c, eventId);
  if (!found || !Number.isInteger(bookingId)) return c.notFound();
  const booking = await getEventBooking(c.env.DB, eventId, bookingId);
  if (!booking) return c.notFound();
  return c.html(bookingEditPage({ ...found, booking, ctx: viewCtx(c) }));
});

app.post('/app/events/:id/bookings/:bookingId', async (c) => {
  const eventId = Number(c.req.param('id'));
  const bookingId = Number(c.req.param('bookingId'));
  const found = await eventForBooking(c, eventId);
  if (!found || !Number.isInteger(bookingId)) return c.notFound();
  const booking = await getEventBooking(c.env.DB, eventId, bookingId);
  if (!booking) return c.notFound();

  const form = await c.req.formData();
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) values[k] = String(v);

  const parsed = readBookingForm(form, found.fields, 'office');
  if (!parsed.ok) {
    return c.html(bookingEditPage({
      ...found, booking, ctx: viewCtx(c), values, error: parsed.error,
    }), 400);
  }

  const status = String(form.get('status') ?? booking.status);
  if (!BOOKING_STATUSES.has(status)) {
    return c.html(bookingEditPage({
      ...found, booking, ctx: viewCtx(c), values, error: 'Choose where this booking stands.',
    }), 400);
  }

  // The booking's own places are discounted, so raising a party of two to three
  // is measured as one more person rather than three more.
  if (status === 'booked') {
    const room = await hasRoom(c.env.DB, eventId, parsed.value.partySize, bookingId);
    if (!room.ok) {
      return c.html(bookingEditPage({
        ...found, booking, ctx: viewCtx(c), values,
        error: room.left === 0
          ? 'There is no room to put them back — the event is full.'
          : `Only ${room.left} place${room.left === 1 ? '' : 's'} can be spared for this booking.`,
      }), 409);
    }
  }

  await saveBooking(c.env.DB, {
    eventId, bookingId, booking: parsed.value,
    status: status as 'booked' | 'cancelled' | 'waitlist',
  });
  return eventAdminView(c, eventId, {
    tone: 'ok',
    text: status === 'cancelled'
      ? `${parsed.value.name}'s booking is now marked cancelled.`
      : `${parsed.value.name}'s booking has been updated.`,
  });
});

/** The one-click version of setting the status, from the list. */
async function setBookingStatus(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  status: 'booked' | 'cancelled',
) {
  const eventId = Number(c.req.param('id'));
  const bookingId = Number(c.req.param('bookingId'));
  if (!Number.isInteger(eventId) || !Number.isInteger(bookingId)) return c.notFound();
  const booking = await getEventBooking(c.env.DB, eventId, bookingId);
  if (!booking) return c.notFound();

  if (status === 'booked') {
    const room = await hasRoom(c.env.DB, eventId, booking.party_size, bookingId);
    if (!room.ok) {
      return eventAdminView(c, eventId, {
        tone: 'bad',
        text: `${booking.name} cannot go back on — that would need ${booking.party_size} `
          + `place${booking.party_size === 1 ? '' : 's'} and there ${room.left === 1 ? 'is' : 'are'} `
          + `${room.left}. Raise the capacity, or open the booking and use the waiting list.`,
      });
    }
  }

  await c.env.DB.prepare('UPDATE event_bookings SET status = ?3 WHERE id = ?1 AND event_id = ?2')
    .bind(bookingId, eventId, status).run();
  return eventAdminView(c, eventId, {
    tone: 'ok',
    text: status === 'cancelled'
      ? `${booking.name}'s booking is cancelled. It stays on the list as a record.`
      : `${booking.name} is booked in again.`,
  });
}

app.post('/app/events/:id/bookings/:bookingId/cancel', (c) => setBookingStatus(c, 'cancelled'));
app.post('/app/events/:id/bookings/:bookingId/restore', (c) => setBookingStatus(c, 'booked'));

app.post('/app/events/:id/bookings/:bookingId/delete', async (c) => {
  const eventId = Number(c.req.param('id'));
  const bookingId = Number(c.req.param('bookingId'));
  if (!Number.isInteger(eventId) || !Number.isInteger(bookingId)) return c.notFound();
  const booking = await getEventBooking(c.env.DB, eventId, bookingId);
  if (!booking) return c.notFound();

  // The answers go too, by ON DELETE CASCADE. This is the one irreversible thing
  // on the page, which is why cancelling is offered first and everywhere.
  await c.env.DB.prepare('DELETE FROM event_bookings WHERE id = ?1 AND event_id = ?2')
    .bind(bookingId, eventId).run();
  return eventAdminView(c, eventId, {
    tone: 'ok', text: `${booking.name}'s booking has been deleted.`,
  });
});


// ---------------------------------------------------------------------------
// Self-service: your own dates and when you are away
// ---------------------------------------------------------------------------

async function myView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const me = c.get('person').id;
  const today = new Date().toISOString().slice(0, 10);
  const [duties, away] = await Promise.all([
    c.env.DB.prepare(
      `SELECT a.id AS assignment_id, s.id AS service_id, s.service_date, s.service_time,
              s.title, r.name AS role_name, a.status,
              (SELECT cr.status FROM change_requests cr
                WHERE cr.assignment_id = a.id ORDER BY cr.id DESC LIMIT 1) AS request_status
         FROM assignments a
         JOIN services s ON s.id = a.service_id
         JOIN roles    r ON r.id = a.role_id
        WHERE a.person_id = ?1 AND s.service_date >= ?2 AND s.is_cancelled = 0
        ORDER BY s.service_date, s.service_time, r.sort_order`,
    ).bind(me, today).all<MyDuty>(),
    c.env.DB.prepare(
      `SELECT id, from_date, to_date, reason FROM unavailability
        WHERE person_id = ?1 AND to_date >= ?2 ORDER BY from_date`,
    ).bind(me, today).all<AwayRow>(),
  ]);
  // Only look when there is nothing to show — "where are my dates?" only arises
  // then. Candidates share a first name with the account and have no login of
  // their own, so this cannot be used to claim somebody else's sign-in.
  let candidates: { id: number; display_name: string; duties: number }[] = [];
  if (duties.results.length === 0) {
    const first = c.get('person').display_name.split(/\s+/)[0] ?? '';
    if (first.length >= 2) {
      const { results } = await c.env.DB.prepare(
        `SELECT p.id, p.display_name,
                (SELECT COUNT(*) FROM assignments a WHERE a.person_id = p.id) AS duties
           FROM people p
          WHERE p.id <> ?1 AND p.is_active = 1
            AND lower(p.display_name) LIKE lower(?2) || '%'
            AND NOT EXISTS (SELECT 1 FROM credentials x WHERE x.person_id = p.id)
          ORDER BY duties DESC LIMIT 8`,
      ).bind(me, first).all<{ id: number; display_name: string; duties: number }>();
      candidates = results.filter((r) => r.duties > 0);
    }
  }
  return c.html(myRotaPage({ duties: duties.results, away: away.results, ctx: viewCtx(c), candidates, notice }));
}

app.get('/app/me', (c) => myView(c));

app.post('/app/me/cannot-do', async (c) => {
  const form = await c.req.formData();
  const assignmentId = Number(form.get('assignment_id'));
  if (!Number.isInteger(assignmentId)) return myView(c, { tone: 'bad', text: 'Could not find that date.' });

  // Only ever your own — a posted id for somebody else's duty must not work.
  const mine = await c.env.DB.prepare(
    'SELECT 1 FROM assignments WHERE id = ?1 AND person_id = ?2',
  ).bind(assignmentId, c.get('person').id).first();
  if (!mine) return myView(c, { tone: 'bad', text: 'That is not one of your dates.' });

  await c.env.DB.prepare(
    `INSERT INTO change_requests (assignment_id, person_id, kind, message)
     VALUES (?1, ?2, 'cannot_do', ?3)`,
  ).bind(assignmentId, c.get('person').id, 'Cannot do this date').run();

  return myView(c, {
    tone: 'ok',
    text: 'Thank you — whoever builds the rota has been told. You are still shown as on it '
      + 'until they have found a replacement.',
  });
});


/**
 * "This is me" — joins a rota record to the signed-in account.
 *
 * The setup form creates an account under whatever name somebody types, and the
 * rota was imported from a spreadsheet of short names, so "Matt Wakerley" and
 * "Matt W" end up as two separate records and My dates looks empty.
 *
 * Only records with NO login of their own can be claimed. Without that check any
 * signed-in volunteer could absorb somebody else's account.
 */
app.post('/app/me/link', async (c) => {
  const form = await c.req.formData();
  const otherId = Number(form.get('person_id'));
  const me = c.get('person').id;
  if (!Number.isInteger(otherId) || otherId === me) {
    return myView(c, { tone: 'bad', text: 'That record could not be found.' });
  }

  const other = await c.env.DB.prepare(
    `SELECT p.id, p.display_name, p.email,
            (SELECT COUNT(*) FROM credentials x WHERE x.person_id = p.id) AS has_login
       FROM people p WHERE p.id = ?1`,
  ).bind(otherId).first<{ display_name: string; email: string | null; has_login: number }>();

  if (!other) return myView(c, { tone: 'bad', text: 'That record no longer exists.' });
  if (other.has_login > 0) {
    return myView(c, {
      tone: 'bad',
      text: `${other.display_name} already has their own sign-in, so it cannot be joined to yours. `
        + 'An administrator can merge them under Settings.',
    });
  }

  try {
    await mergePeople(c.env.DB, me, [otherId]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('link failed', { me, otherId, message });
    return myView(c, { tone: 'bad', text: `Nothing was changed. The database said: ${message}` });
  }

  return myView(c, {
    tone: 'ok',
    text: `Joined "${other.display_name}" to your account — their dates are now yours.`,
  });
});

app.post('/app/me/away', async (c) => {
  const form = await c.req.formData();
  const from = String(form.get('from_date') ?? '');
  const to = String(form.get('to_date') ?? '');
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(from) || !iso.test(to) || to < from) {
    return myView(c, { tone: 'bad', text: 'Give a first day and a last day after it.' });
  }
  await c.env.DB.prepare(
    'INSERT INTO unavailability (person_id, from_date, to_date, reason) VALUES (?1, ?2, ?3, ?4)',
  ).bind(c.get('person').id, from, to, String(form.get('reason') ?? '').trim() || null).run();
  return myView(c, { tone: 'ok', text: 'Added. You will not be put on the rota for those dates.' });
});

app.post('/app/me/away/:id/delete', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  await c.env.DB.prepare('DELETE FROM unavailability WHERE id = ?1 AND person_id = ?2')
    .bind(id, c.get('person').id).run();
  return myView(c, { tone: 'ok', text: 'Removed.' });
});

// ---- the admin side of the same thing -------------------------------------

async function requestsView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  const { results } = await c.env.DB.prepare(
    `SELECT cr.id, p.display_name AS person_name, r.name AS role_name,
            s.service_date, s.service_time, s.title, cr.kind, cr.message, cr.status, cr.created_at
       FROM change_requests cr
       JOIN people      p ON p.id = cr.person_id
       JOIN assignments a ON a.id = cr.assignment_id
       JOIN services    s ON s.id = a.service_id
       JOIN roles       r ON r.id = a.role_id
      ORDER BY CASE cr.status WHEN 'open' THEN 0 ELSE 1 END, s.service_date`,
  ).all<ChangeRequestRow>();
  return c.html(requestsPage({ requests: results, ctx: viewCtx(c), notice }));
}

app.get('/app/rota/requests', (c) => requestsView(c));

app.post('/app/rota/requests/:id/accept', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  const req = await c.env.DB.prepare(
    'SELECT assignment_id FROM change_requests WHERE id = ?1',
  ).bind(id).first<{ assignment_id: number }>();
  if (!req) return c.notFound();

  // Taking somebody off leaves the place EMPTY rather than guessing a
  // replacement, so it shows up as a gap and gets filled deliberately.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM assignments WHERE id = ?1').bind(req.assignment_id),
    c.env.DB.prepare(
      `UPDATE change_requests SET status = 'accepted', resolved_at = datetime('now'),
              resolved_by = ?2 WHERE id = ?1`,
    ).bind(id, c.get('person').id),
  ]);
  return requestsView(c, {
    tone: 'ok',
    text: 'Taken off. That place is now empty and will show on the rota as a gap.',
  });
});

app.post('/app/rota/requests/:id/decline', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();
  await c.env.DB.prepare(
    `UPDATE change_requests SET status = 'declined', resolved_at = datetime('now'),
            resolved_by = ?2 WHERE id = ?1`,
  ).bind(id, c.get('person').id).run();
  return requestsView(c, { tone: 'ok', text: 'Left as it was.' });
});

// ---------------------------------------------------------------------------
// Public event booking
// ---------------------------------------------------------------------------
//
// Deliberately OUTSIDE /app and outside the sign-in wall. People reach this from
// a link on the noticeboard or in a WhatsApp group; requiring an account would
// mean nobody books. An unpublished event is a 404 rather than a "not published"
// page, so a guessed slug reveals nothing.


/** The poster, served to anyone who can open the booking page. Public on
 *  purpose: the booking page itself is. */
// ---------------------------------------------------------------------------
// Asking to book a room — public, no sign-in
// ---------------------------------------------------------------------------
//
// The only public way into the room diary. It sees when rooms are taken and
// nothing else, and everything it writes is tentative until somebody inside
// approves it. Closed until opened on Rooms → Booking form.

async function publicRequestContext(db: D1Database) {
  const [settings, rooms] = await Promise.all([loadFormSettings(db), listPublicRooms(db)]);
  const open = !!settings.is_open && rooms.length > 0;
  const today = new Date().toISOString().slice(0, 10);
  const plus = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  return { settings, rooms, open, today, earliest: plus(settings.min_days_notice), latest: plus(settings.max_days_ahead) };
}

async function publicRequestView(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  ctx: Awaited<ReturnType<typeof publicRequestContext>>,
  opts: { roomId?: number; month?: string; values?: Record<string, string>; error?: string; status?: 200 | 400 | 409 },
) {
  const roomId = ctx.rooms.some((r) => r.id === opts.roomId) ? opts.roomId! : ctx.rooms[0]!.id;
  // A real month, kept between this month and the last one that can be asked
  // for: the page is not a way to read the church's past diary, and a month
  // of 13 used to reach new Date(NaN) and fail the page.
  const asked = opts.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(opts.month) ? opts.month : thisMonth();
  const month = asked < thisMonth() ? thisMonth() : asked > ctx.latest.slice(0, 7) ? ctx.latest.slice(0, 7) : asked;
  // The grid shows whole weeks, so reach a week either side of the month.
  const from = new Date(Date.parse(`${month}-01T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(`${month}-01T00:00:00Z`) + 45 * 86_400_000).toISOString().slice(0, 10);
  const busy = await busyBetween(c.env.DB, roomId, `${from}T00:00`, `${to}T00:00`);
  const res = c.html(publicRoomRequestPage({
    settings: ctx.settings, rooms: ctx.rooms, roomId, month, busy, values: opts.values, error: opts.error,
    turnstileSitekey: c.env.TURNSTILE_SITEKEY, earliest: ctx.earliest, latest: ctx.latest,
  }), opts.status ?? 200);
  return res;
}

app.get('/rooms/book', async (c) => {
  const ctx = await publicRequestContext(c.env.DB);
  if (!ctx.open) return c.html(requestClosedPage());
  const roomId = Number(c.req.query('room'));
  const on = c.req.query('on') ?? '';
  const values: Record<string, string> = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(on)) values.on_date = on;
  if (Number.isInteger(roomId)) values.room_id = String(roomId);
  return publicRequestView(c, ctx, { roomId, month: c.req.query('month'), values });
});

/**
 * What is taken in one room on one day, for the form's live check.
 *
 * Times only, clipped to the day asked about, and no titles — the same as the
 * calendar above it. Refuses rooms that are not open to the public, so it
 * cannot be used to read the rest of the diary.
 */
app.get('/rooms/book/busy', async (c) => {
  const ctx = await publicRequestContext(c.env.DB);
  const roomId = Number(c.req.query('room'));
  const date = c.req.query('date') ?? '';
  // Only dates that could be asked for: this is not a way to read the past.
  if (!ctx.open || !ctx.rooms.some((r) => r.id === roomId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || Number.isNaN(Date.parse(date)) || date < ctx.today || date > ctx.latest) {
    return c.json({ busy: [] }, 404);
  }
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const rows = await busyBetween(c.env.DB, roomId, `${date}T00:00`, `${next}T00:00`);
  c.header('cache-control', 'no-store');
  return c.json({
    busy: rows.map((b) => ({
      from: b.starts_at.slice(0, 10) < date ? '00:00' : b.starts_at.slice(11, 16),
      to: b.ends_at.slice(0, 10) > date ? '24:00' : b.ends_at.slice(11, 16),
      held: !!b.tentative,
    })),
  });
});

app.post('/rooms/book', async (c) => {
  const ctx = await publicRequestContext(c.env.DB);
  if (!ctx.open) return c.html(requestClosedPage(), 403);
  const form = await c.req.formData();
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string' && k !== 'cf-turnstile-response') values[k] = v;
  const roomId = Number(values.room_id);
  const again = (error: string, status: 400 | 409 = 400) =>
    publicRequestView(c, ctx, { roomId, month: (values.on_date ?? '').slice(0, 7) || undefined, values, error, status });

  // Before anything else, so a bot never reaches the clash check or the insert.
  const human = await verifyTurnstile(c.env, String(form.get('cf-turnstile-response') ?? ''),
    c.req.header('CF-Connecting-IP'), 'Request to book');
  if (!human.ok) return again(human.error);

  const parsed = readRequest(form, ctx.settings, ctx.rooms, ctx.today);
  if (!parsed.ok) return again(parsed.error);
  const made = await createRequest(c.env.DB, parsed.value, await hashAddress(c.req.header('CF-Connecting-IP')));
  if (!made.ok) return again(made.error, 409);

  const room = ctx.rooms.find((r) => r.id === parsed.value.roomId)!;
  // The request is made and held. Emails are sent after and never undo it.
  try {
    const mine = receivedEmail(parsed.value, room.name, made.held, made.clashDates);
    const sentToThem = await sendEmail(c.env.EMAIL, c.env.ACK_FROM, mine.to, mine.subject, mine.body);
    if (sentToThem.status !== 'sent') console.error('room request acknowledgement not sent', { id: made.requestId, ...sentToThem });
    if (ctx.settings.notify_email) {
      const office = officeEmail(parsed.value, room.name, made.held,
        `${new URL(c.req.url).origin}/app/rooms#request-${made.requestId}`, ctx.settings.notify_email);
      const sentToOffice = await sendEmail(c.env.EMAIL, c.env.ACK_FROM, office.to, office.subject, office.body);
      if (sentToOffice.status !== 'sent') console.error('room request office email not sent', { id: made.requestId, ...sentToOffice });
    }
  } catch (err) {
    console.error('room request emails failed', { id: made.requestId, err: String(err) });
  }

  // Post, then redirect, then get: refreshing the thank-you page shows it
  // again rather than sending the request a second time (which would then be
  // refused as clashing with its own hold).
  return c.redirect(`/rooms/book/received/${made.receipt}`, 303);
});

/** "We have your request", reached by the unguessable receipt it was given. */
app.get('/rooms/book/received/:receipt', async (c) => {
  const receipt = c.req.param('receipt');
  if (!/^[0-9a-f]{32}$/.test(receipt)) return c.notFound();
  const r = await getRequestByReceipt(c.env.DB, receipt);
  if (!r) return c.notFound();
  const { results } = await c.env.DB.prepare(
    `SELECT substr(starts_at, 1, 10) AS d FROM room_bookings
      WHERE request_id = ?1 AND status = 'booked' ORDER BY starts_at`,
  ).bind(r.id).all<{ d: string }>();
  return c.html(requestReceivedPage({
    roomName: r.room_name, purpose: r.purpose, held: results.map((x) => x.d),
    clashDates: r.clash_dates ? JSON.parse(r.clash_dates) : [], status: r.status,
    fromTime: r.starts_at.slice(11, 16), toTime: r.ends_at.slice(11, 16), email: r.email,
  }));
});

app.get('/events/:slug/poster', async (c) => {
  const event = await getEventBySlug(c.env.DB, c.req.param('slug'));
  if (!event?.poster_key) return c.notFound();
  const object = await c.env.IMAGES.get(event.poster_key);
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(object.body, { headers });
});

app.get('/events/:slug', async (c) => {
  const event = await getEventBySlug(c.env.DB, c.req.param('slug'));
  if (!event || !event.is_published) return c.notFound();
  const fields = await listFields(c.env.DB, event.id);
  return c.html(publicBookingPage({ event, fields, turnstileSitekey: c.env.TURNSTILE_SITEKEY }));
});

app.post('/events/:slug', async (c) => {
  const event = await getEventBySlug(c.env.DB, c.req.param('slug'));
  if (!event || !event.is_published) return c.notFound();
  const fields = await listFields(c.env.DB, event.id);
  const form = await c.req.formData();

  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) values[k] = String(v);

  // Checked before anything else, so a bot never reaches the capacity query or
  // the insert. Everything typed is handed back on the redrawn page, because
  // failing this check is usually a human who left the tab open, not a bot.
  const human = await verifyTurnstile(
    c.env,
    String(form.get('cf-turnstile-response') ?? ''),
    c.req.header('CF-Connecting-IP'),
  );
  if (!human.ok) {
    return c.html(publicBookingPage({
      event, fields, values, error: human.error,
      turnstileSitekey: c.env.TURNSTILE_SITEKEY,
    }), 400);
  }

  if (event.booking_closes_at && new Date().toISOString().slice(0, 10) > event.booking_closes_at) {
    return c.html(publicBookingPage({
      event, fields, values, turnstileSitekey: c.env.TURNSTILE_SITEKEY, error: 'Bookings for this event have closed.',
    }), 400);
  }

  const parsed = readBookingForm(form, fields, 'self', event.max_per_booking ?? 10);
  if (!parsed.ok) {
    return c.html(publicBookingPage({ event, fields, values, error: parsed.error, turnstileSitekey: c.env.TURNSTILE_SITEKEY }), 400);
  }
  if (event.send_ack && !parsed.value.email) {
    return c.html(publicBookingPage({
      event, fields, values, turnstileSitekey: c.env.TURNSTILE_SITEKEY,
      error: 'Please give an email address — we send a confirmation to it.',
    }), 400);
  }

  // Checked again here, not just on the page that was drawn: two people can open
  // the last place at the same moment, and the second has to be told rather than
  // quietly overbooking the caterer.
  //
  // Somebody who asked for the waiting list and finds a place has come back is
  // simply booked in: nobody wants to be told they are waiting for something
  // that is there.
  const room = await hasRoom(c.env.DB, event.id, parsed.value.partySize);
  const askedToWait = form.get('waitlist') === '1';
  if (!room.ok && !askedToWait) {
    // Redrawn from the event as it is now, so a page that has just sold out
    // offers the waiting list rather than a form that will refuse them again.
    const now = (await getEventBySlug(c.env.DB, event.slug)) ?? event;
    return c.html(publicBookingPage({
      event: now, fields, values, turnstileSitekey: c.env.TURNSTILE_SITEKEY,
      error: room.left === 0
        ? 'Sorry — the last places went while you were filling this in. You can join the waiting list below.'
        : `Sorry — there ${room.left === 1 ? 'is' : 'are'} only ${room.left} place${room.left === 1 ? '' : 's'} left.`,
    }), 409);
  }
  const status = room.ok ? 'booked' : 'waitlist';

  const res = await c.env.DB.prepare(
    `INSERT INTO event_bookings (event_id, name, email, phone, party_size, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(event.id, parsed.value.name, parsed.value.email, parsed.value.phone,
    parsed.value.partySize, status).run();

  const bookingId = Number(res.meta.last_row_id);
  if (parsed.value.answers.length) {
    const stmt = c.env.DB.prepare(
      'INSERT INTO event_booking_answers (booking_id, field_id, value) VALUES (?1, ?2, ?3)',
    );
    await c.env.DB.batch(
      parsed.value.answers.map((a) => stmt.bind(bookingId, a.fieldId, a.value)),
    );
  }

  // The booking is already committed. Sending happens after, and its outcome is
  // recorded rather than thrown: somebody who booked a place has booked it
  // whether or not our mail provider was reachable.
  //
  // Not sent for the waiting list: the acknowledgement thanks them for booking,
  // and somebody who has not got a place must not be told they have.
  if (event.send_ack && parsed.value.email && status === 'booked') {
    const result = await sendAcknowledgement(
      c.env.EMAIL, c.env.ACK_FROM, parsed.value.email,
      event.ack_subject ?? DEFAULT_ACK_SUBJECT,
      event.ack_body ?? DEFAULT_ACK_BODY,
      {
        name: parsed.value.name,
        eventTitle: event.title,
        // {date} names both days for an event that runs over, so older saved
        // wording ("It is on {date} at {time}") still tells the truth.
        eventDate: runsOver(event)
          ? `${formatDate(event.starts_at.slice(0, 10))} to ${formatDate(lastDay(event.starts_at, event.ends_at!))}`
          : formatDate(event.starts_at.slice(0, 10)),
        eventTime: event.starts_at.slice(11, 16),
        eventWhen: formatWhen(event.starts_at, event.ends_at),
        location: event.location,
        partySize: parsed.value.partySize,
      },
    );
    if (result.status !== 'sent') {
      console.error('acknowledgement not sent', { bookingId, status: result.status, error: result.error });
    }
    await c.env.DB.prepare(
      'UPDATE event_bookings SET ack_status = ?2, ack_error = ?3 WHERE id = ?1',
    ).bind(bookingId, result.status, result.error ?? null).run();
  }

  await tellOrganisers(c, event.id, parsed.value, false, status === 'waitlist');

  return c.html(bookingDonePage(event, parsed.value.partySize, status === 'waitlist'));
});

app.notFound((c) =>
  c.req.path.startsWith('/api/')
    ? c.json({ ok: false, error: 'Not found' }, 404)
    : c.redirect('/', 302));

app.onError((err, c) => {
  // A generic 500 tells nobody anything; log the real error so `wrangler tail`
  // shows it rather than leaving a production fault to be guessed at.
  console.error('Unhandled error on', c.req.method, c.req.path, '-', err?.stack ?? err);
  return c.req.path.startsWith('/api/')
    ? c.json({ ok: false, error: 'Internal error' }, 500)
    : c.text('Something went wrong. It has been logged.', 500);
});

export default app;
