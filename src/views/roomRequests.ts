import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate, formatDateTime } from './rota.js';
import { monthCalendar, type CalendarEntry } from './calendar.js';
import { daysCovered, timeOnDay } from './rooms.js';
import { FREQUENCIES } from '../recurrence.js';
import { describeRequestWhen, type FormSettings, type PublicRoom, type RequestRow } from '../roomRequests.js';

// ---------------------------------------------------------------------------
// The public page
// ---------------------------------------------------------------------------

/**
 * Asking to book a room, for somebody who is not signed in.
 *
 * The calendar shows only whether a stretch is booked or held — never what for
 * or by whom — and the form under it checks the chosen time against the same
 * information as it is typed, so nobody sends a request for a time that is
 * already gone. The server checks again when it arrives.
 */
export function publicRoomRequestPage(opts: {
  settings: FormSettings;
  rooms: PublicRoom[];
  roomId: number;
  month: string;
  busy: { starts_at: string; ends_at: string; tentative: number }[];
  values?: Record<string, string>;
  error?: string;
  turnstileSitekey?: string;
  earliest: string;
  latest: string;
}) {
  const { settings, rooms, roomId, month, busy, earliest, latest } = opts;
  const v = opts.values ?? {};
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0]!;

  const entries: CalendarEntry[] = busy.flatMap((b) => daysCovered(b).map((day) => ({
    date: day,
    href: '',
    lead: timeOnDay(b, day),
    label: b.tentative ? 'Held' : 'Booked',
    tone: b.tentative ? 'gold' as const : 'navy' as const,
    title: b.tentative ? 'Held for a request still being decided' : 'Booked',
  })));

  const radio = (name: string, value: string, label: string) => html`<label class="key-option">
      <input type="radio" name="${name}" value="${value}" ${v[name] === value ? 'checked' : ''} required> ${label}
    </label>`;

  return layout(
    {
      title: 'Book a room',
      chrome: false,
      eyebrow: 'Bream Church',
      heading: 'Book a room',
      headingAside: 'Ask for a room, and we will confirm by email',
    },
    html`
      <div style="max-width:62rem;margin-inline:auto">
        ${settings.intro ? html`<div class="card"><p style="margin:0">${settings.intro}</p></div>` : ''}

        <h2 class="section-h2">When is it free?</h2>
        <nav class="pills" aria-label="Rooms">
          ${rooms.map((r) => html`<a class="pill ${r.id === room.id ? 'is-on' : ''}"
               href="/rooms/book?room=${r.id}&month=${month}"
               ${r.id === room.id ? html`aria-current="page"` : ''}>${r.name}</a>`)}
        </nav>
        <p style="color:var(--ink-2);margin-top:0">
          ${room.notes ?? ''}${room.capacity ? ` Holds up to ${room.capacity}.` : ''}
          Times marked <strong>Booked</strong> are taken; <strong>Held</strong> means somebody
          else has asked and is waiting to hear. Press <strong>+</strong> on a day to ask for it.
        </p>
        ${monthCalendar({
          month, entries, baseHref: '/rooms/book', extraQuery: `room=${room.id}`,
          // No #ask here: the calendar appends &on=DATE, which must stay in the query.
          addDay: { href: `/rooms/book?room=${room.id}&month=${month}`, label: 'Ask for this room',
                    from: earliest, until: latest },
        })}

        <h2 class="section-h2" id="ask">Ask to book</h2>
        ${opts.error ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">${opts.error}</p></div>` : ''}
        <form method="post" action="/rooms/book#ask" class="card" id="request-form">
          <div class="grid-fields">
            <div class="field">
              <label for="room_id">Which room</label>
              <select id="room_id" name="room_id" required>
                ${rooms.map((r) => html`<option value="${r.id}"
                    ${String(v.room_id ?? room.id) === String(r.id) ? 'selected' : ''}>${r.name}</option>`)}
              </select>
            </div>
            <div class="field">
              <label for="on_date">Date</label>
              <input id="on_date" name="on_date" type="date" required min="${earliest}" max="${latest}"
                     value="${v.on_date ?? ''}">
            </div>
            <div class="field">
              <label for="from_time">From</label>
              <input id="from_time" name="from_time" type="time" required value="${v.from_time ?? '19:00'}">
            </div>
            <div class="field">
              <label for="to_time">Until</label>
              <input id="to_time" name="to_time" type="time" required value="${v.to_time ?? '21:00'}">
            </div>
          </div>
          <p class="avail" id="avail" role="status" aria-live="polite" hidden></p>

          ${settings.allow_repeating
            ? html`<div class="grid-fields">
                <div class="field">
                  <label for="repeat">Does it repeat?</label>
                  <select id="repeat" name="repeat">
                    <option value="">Just once</option>
                    ${FREQUENCIES.map((f) => html`<option value="${f.value}" ${v.repeat === f.value ? 'selected' : ''}>
                      ${f.label} — ${f.note}</option>`)}
                  </select>
                </div>
                <div class="field" id="until-field" ${v.repeat ? '' : 'hidden'}>
                  <label for="until">Until</label>
                  <span class="hint">Any dates already taken are left out, and we will tell you which.</span>
                  <input id="until" name="until" type="date" max="${latest}" value="${v.until ?? ''}"
                         ${v.repeat ? 'required' : ''}>
                </div>
              </div>`
            : ''}

          <h3 style="margin-bottom:.5rem">About you</h3>
          <div class="grid-fields">
            <div class="field">
              <label for="name">Your name</label>
              <input id="name" name="name" type="text" required autocomplete="name" value="${v.name ?? ''}">
            </div>
            <div class="field">
              <label for="email">Email</label>
              <span class="hint">We reply to this.</span>
              <input id="email" name="email" type="email" required autocomplete="email" value="${v.email ?? ''}">
            </div>
            <div class="field">
              <label for="phone">Phone</label>
              <span class="hint">Optional.</span>
              <input id="phone" name="phone" type="tel" autocomplete="tel" value="${v.phone ?? ''}">
            </div>
            <div class="field">
              <label for="organisation">Group or organisation</label>
              <span class="hint">Optional.</span>
              <input id="organisation" name="organisation" type="text" value="${v.organisation ?? ''}">
            </div>
          </div>
          <div class="grid-fields">
            <div class="field">
              <label for="purpose">What is it for</label>
              <input id="purpose" name="purpose" type="text" required value="${v.purpose ?? ''}"
                     placeholder="e.g. Toddler group, birthday party, committee meeting">
            </div>
            <div class="field">
              <label for="people">How many people</label>
              <input id="people" name="people" type="number" min="1" max="1000" required value="${v.people ?? ''}">
            </div>
          </div>

          <fieldset class="field key-choice" style="grid-column:auto">
            <legend>Are you a member of Bream Church?</legend>
            <div class="key-options">${radio('is_member', '1', 'Yes')}${radio('is_member', '0', 'No')}</div>
          </fieldset>
          <fieldset class="field key-choice" id="insurance" style="grid-column:auto;margin-top:.75rem"
                    ${v.is_member === '0' ? '' : 'hidden'}>
            <legend>Do you have public liability insurance?</legend>
            <span class="hint">Groups from outside the church need their own cover. Members are covered by the church's.</span>
            <div class="key-options">
              <label class="key-option"><input type="radio" name="has_insurance" value="1" ${v.has_insurance === '1' ? 'checked' : ''}> Yes</label>
              <label class="key-option"><input type="radio" name="has_insurance" value="0" ${v.has_insurance === '0' ? 'checked' : ''}> No</label>
            </div>
          </fieldset>

          <div class="field" style="margin-top:1rem">
            <label for="notes">Anything else we should know</label>
            <span class="hint">Optional — setting up early, needing the kitchen, access needs.</span>
            <textarea id="notes" name="notes" rows="3">${v.notes ?? ''}</textarea>
          </div>

          ${opts.turnstileSitekey
            ? html`<div class="field">
                <label for="robot-hint">Just checking you are not a robot</label>
                <span class="hint" id="robot-hint">Most of the time it passes on its own.</span>
                <div class="cf-turnstile" data-sitekey="${opts.turnstileSitekey}" data-theme="light"
                     data-action="room-request" aria-describedby="robot-hint"></div>
                <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
              </div>`
            : ''}

          <p class="hint">Nothing is booked until we confirm by email. Your time is held for you while we decide.</p>
          <button class="btn-primary" type="submit">Request to book</button>
        </form>
      </div>

      <script>
        (function () {
          var form = document.getElementById('request-form');
          var room = document.getElementById('room_id');
          var date = document.getElementById('on_date');
          var from = document.getElementById('from_time');
          var to = document.getElementById('to_time');
          var out = document.getElementById('avail');
          var repeat = document.getElementById('repeat');
          var untilField = document.getElementById('until-field');
          var until = document.getElementById('until');

          // A day picked from the calendar arrives as ?on=YYYY-MM-DD, already
          // filled in by the server; take the reader straight to the form.
          if (new URLSearchParams(location.search).get('on')) {
            document.getElementById('ask').scrollIntoView();
          }

          // Members are covered by the church; only others are asked.
          var ins = document.getElementById('insurance');
          form.querySelectorAll('input[name=is_member]').forEach(function (r) {
            r.addEventListener('change', function () {
              var outsider = form.querySelector('input[name=is_member]:checked').value === '0';
              ins.hidden = !outsider;
              ins.querySelectorAll('input').forEach(function (i) { i.required = outsider; });
            });
          });

          if (repeat) repeat.addEventListener('change', function () {
            untilField.hidden = !repeat.value;
            until.required = !!repeat.value;
          });

          // Checks the chosen time against what is taken, as it is chosen. The
          // server checks again on submit; this is only so nobody fills in the
          // whole form for a time that is gone.
          var seq = 0;
          function check() {
            var mine = ++seq;
            if (!date.value || !from.value || !to.value) { out.hidden = true; return; }
            if ((date.min && date.value < date.min) || (date.max && date.value > date.max)) {
              out.hidden = false; out.className = 'avail avail-bad';
              out.textContent = 'We take requests for dates from ' + date.min + ' to ' + date.max + '.';
              return;
            }
            if (to.value <= from.value) {
              out.hidden = false; out.className = 'avail avail-bad';
              out.textContent = 'The finish time needs to be after the start time.';
              return;
            }
            fetch('/rooms/book/busy?room=' + encodeURIComponent(room.value) + '&date=' + encodeURIComponent(date.value))
              .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
              .then(function (d) {
                if (mine !== seq) return;
                var hit = (d.busy || []).filter(function (b) { return b.from < to.value && b.to > from.value; });
                out.hidden = false;
                if (hit.length) {
                  out.className = 'avail avail-bad';
                  out.textContent = 'Not free: ' + hit.map(function (b) {
                    return b.from + '–' + b.to + (b.held ? ' (held)' : '');
                  }).join(', ') + '. Please choose another time.';
                } else {
                  out.className = 'avail avail-ok';
                  out.textContent = d.busy && d.busy.length
                    ? 'Free at that time. Also booked that day: ' + d.busy.map(function (b) { return b.from + '–' + b.to; }).join(', ') + '.'
                    : 'Free at that time.';
                }
              })
              .catch(function () { out.hidden = true; });
          }
          [room, date, from, to].forEach(function (el) { el.addEventListener('change', check); });
          check();
        }());
      </script>
    `,
  );
}

export function requestClosedPage() {
  return layout(
    { title: 'Book a room', chrome: false, eyebrow: 'Bream Church', heading: 'Book a room' },
    html`<div style="max-width:40rem;margin-inline:auto"><div class="card"><p style="margin:0">
      We are not taking room requests online at the moment. Please get in touch with the church
      office and we will be glad to help.</p></div></div>`,
  );
}

export function requestReceivedPage(o: {
  roomName: string;
  purpose: string;
  held: string[];
  clashDates: string[];
  fromTime: string;
  toTime: string;
  email: string;
  /** Where it stands now, for somebody coming back to this page later. */
  status?: 'pending' | 'approved' | 'declined';
}) {
  if (o.status === 'approved' || o.status === 'declined') {
    return layout(
      { title: 'Your request', chrome: false, eyebrow: 'Bream Church', heading: 'Your request' },
      html`<div style="max-width:40rem;margin-inline:auto">
        <div class="notice notice-${o.status === 'approved' ? 'ok' : 'warn'}"><p style="margin:0">
          ${o.status === 'approved'
            ? html`Your booking of the <strong>${o.roomName}</strong> for ${o.purpose} is <strong>confirmed</strong>.`
            : html`We were not able to take your booking of the <strong>${o.roomName}</strong> for ${o.purpose}, and the time is no longer held.`}
        </p></div></div>`,
    );
  }
  const many = o.held.length > 1;
  return layout(
    { title: 'Request received', chrome: false, eyebrow: 'Bream Church', heading: 'Thank you — we have your request' },
    html`
      <div style="max-width:40rem;margin-inline:auto">
        <div class="notice notice-warn"><p style="margin:0">
          <strong>This is not confirmed yet.</strong> We have held
          ${many ? `${o.held.length} dates` : formatDate(o.held[0]!)} in the <strong>${o.roomName}</strong>,
          ${o.fromTime}–${o.toTime}, for ${o.purpose}, while we decide. We will email
          <strong>${o.email}</strong> to confirm.
        </p></div>
        ${many
          ? html`<div class="card"><h3 style="margin-top:0">The dates we are holding</h3>
              <p style="margin:0">${o.held.map((d) => formatDate(d)).join(', ')}</p></div>`
          : ''}
        ${o.clashDates.length
          ? html`<div class="card"><h3 style="margin-top:0">Dates we could not hold</h3>
              <p style="margin-top:0">These were already taken, so they are not part of your request:</p>
              <p style="margin:0">${o.clashDates.map((d) => formatDate(d)).join(', ')}</p></div>`
          : ''}
      </div>`,
  );
}

// ---------------------------------------------------------------------------
// Inside the system
// ---------------------------------------------------------------------------

const when = (r: RequestRow) => describeRequestWhen(r, r.held);

/** One request, as a card with everything needed to decide on it. */
function requestCard(r: RequestRow) {
  const w = when(r);
  const clashes: string[] = r.clash_dates ? JSON.parse(r.clash_dates) : [];
  const overCapacity = r.room_capacity != null && r.people > r.room_capacity;
  const uninsured = !r.is_member && r.has_insurance === 0;
  return html`<li class="req ${uninsured ? 'req-flag' : ''}" id="request-${r.id}">
    <div class="req-main">
      <p class="req-when">
        <strong>${r.room_name}</strong> · ${formatDate(w.first)}, ${w.times}
        ${w.pattern ? html`<span class="req-pattern">${w.pattern} — ${r.held} date${r.held === 1 ? '' : 's'} held</span>` : ''}
      </p>
      <p class="req-what"><strong>${r.purpose}</strong>${r.organisation ? ` · ${r.organisation}` : ''}
        · ${r.people} ${r.people === 1 ? 'person' : 'people'}</p>
      <p class="req-who">${r.name} · <a href="mailto:${r.email}">${r.email}</a>${r.phone ? ` · ${r.phone}` : ''}</p>
      <div class="req-chips">
        ${r.is_member ? chip('green', 'Church member') : chip('neutral', 'Not a member')}
        ${r.is_member ? '' : r.has_insurance ? chip('green', 'Has insurance') : chip('red', 'No insurance')}
        ${overCapacity ? chip('red', `Over capacity (${r.room_capacity})`) : ''}
        ${clashes.length ? chip('amber', `${clashes.length} date${clashes.length === 1 ? '' : 's'} already taken`) : ''}
        ${r.clashes_now ? chip('red', `Now clashes with ${r.clashes_now} booking${r.clashes_now === 1 ? '' : 's'}`) : ''}
        <span class="req-age">asked ${formatDateTime(r.created_at)}</span>
      </div>
      ${r.notes ? html`<p class="req-notes">${r.notes}</p>` : ''}
    </div>
    <div class="req-actions">
      <form method="post" action="/app/rooms/requests/${r.id}/approve" class="inline-form">
        ${r.clashes_now
          // Something has been booked over its dates since it was asked for —
          // an event holding the room anyway, say. Approving double-books, so
          // it says so on the button.
          ? html`<input type="hidden" name="anyway" value="1">
              <button class="btn-danger" type="submit">Approve anyway</button>`
          : html`<button class="btn-primary" type="submit">Approve</button>`}
      </form>
      <details class="req-decline">
        <summary class="btn-quiet">Decline</summary>
        <form method="post" action="/app/rooms/requests/${r.id}/decline">
          <label for="why-${r.id}" class="hint">A line for them, if you like (sent in the email)</label>
          <textarea id="why-${r.id}" name="note" rows="2"></textarea>
          <button class="btn-danger" type="submit">Decline and let the time go</button>
        </form>
      </details>
    </div>
  </li>`;
}

/** The dashboard at the top of the Rooms page. Nothing at all when there are
 *  no requests: an empty box every day is a box people learn to ignore. */
export function requestsDashboard(requests: RequestRow[], canDecide: boolean) {
  if (!requests.length) return '';
  return html`
    <section class="req-dash" id="requests" aria-labelledby="req-h">
      <h2 class="section-h2" id="req-h">Requests to book
        <span class="bookings-count">${requests.length} waiting</span></h2>
      <p style="color:var(--ink-2);margin-top:0">
        Each one is held on the diary as <strong>tentative</strong> until it is approved or declined.
      </p>
      ${canDecide
        ? html`<ul class="req-list">${requests.map(requestCard)}</ul>`
        : html`<p>${requests.length} request${requests.length === 1 ? ' is' : 's are'} waiting for somebody who manages rooms.</p>`}
    </section>`;
}

/** Rooms → Booking form: whether the public form is open, and its rules. */
export function bookingFormSettingsPage(opts: {
  settings: FormSettings;
  rooms: { id: number; name: string; public_booking: number }[];
  link: string;
  emailReady: boolean;
  captchaReady: boolean;
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { settings: s, rooms, link, ctx, notice } = opts;
  const anyRoom = rooms.some((r) => r.public_booking);
  const open = !!s.is_open && anyRoom;
  return layout(
    {
      title: 'Booking form',
      eyebrow: 'Rooms',
      heading: 'Booking form',
      intro: 'A page outside the system where anybody can ask to book a room, without signing in.',
      back: { href: '/app/rooms', label: 'Room booking' },
      ...ctx,
    },
    html`
      ${notice ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>` : ''}

      <div class="card">
        <h2 style="margin-top:0;display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center">
          The booking page
          ${open ? chip('green', 'Taking requests') : chip('neutral', 'Closed')}
        </h2>
        <!-- The link is always shown, open or not, so it can be put on the
             website or in a newsletter ahead of opening. -->
        <p>${open
          ? 'Anyone with this link can ask to book a room — they do not need to sign in. Share it on the website or in an email:'
          : 'This is the page people will use. Until it is open, anyone following the link is asked to contact the office instead.'}</p>
        <p class="link-row">
          <a class="btn-secondary" href="${link}" target="_blank" rel="noopener">${link}</a>
          <button type="button" class="btn-quiet" data-link="${link}"
                  onclick="var b = this; if (navigator.clipboard) { navigator.clipboard.writeText(b.dataset.link).then(function () { b.textContent = 'Copied'; }); } else { window.prompt('Copy this link:', b.dataset.link); }">Copy link</button>
        </p>
        ${open
          ? ''
          : html`<p class="notice notice-warn" style="margin-bottom:0">
              <strong>Not working yet:</strong>
              ${!s.is_open && !anyRoom
                ? 'tick "Take requests online" and at least one room below, then save.'
                : !s.is_open
                  ? 'tick "Take requests online" below, then save.'
                  : 'tick at least one room people may ask for below, then save.'}
            </p>`}
        ${opts.captchaReady ? '' : html`<p class="notice notice-warn" style="margin-bottom:0">
            There is no "not a robot" check on the form, so anything can submit it. Worth switching
            on before the link goes anywhere public.</p>`}
      </div>

      <form method="post" action="/app/rooms/booking-form" class="card">
        <label class="check" style="max-width:34rem">
          <input type="checkbox" name="is_open" value="1" ${s.is_open ? 'checked' : ''}>
          <span><span class="check-label">Take requests online</span>
            <span class="check-note">Untick to close the form without losing these settings.</span></span>
        </label>

        <h3 style="margin-bottom:.5rem">Which rooms can be asked for</h3>
        <div class="checks">
          ${rooms.map((r) => html`<label class="check">
            <input type="checkbox" name="public_rooms" value="${r.id}" ${r.public_booking ? 'checked' : ''}>
            <span><span class="check-label">${r.name}</span></span>
          </label>`)}
        </div>

        <div class="grid-fields" style="margin-top:1rem">
          <div class="field">
            <label for="min_days_notice">Least notice, in days</label>
            <span class="hint">0 lets people ask for today.</span>
            <input id="min_days_notice" name="min_days_notice" type="number" min="0" max="60" value="${s.min_days_notice}">
          </div>
          <div class="field">
            <label for="max_days_ahead">Furthest ahead, in days</label>
            <input id="max_days_ahead" name="max_days_ahead" type="number" min="7" max="730" value="${s.max_days_ahead}">
          </div>
          <div class="field">
            <label for="notify_email">Tell this address about new requests</label>
            <span class="hint">${opts.emailReady ? 'Optional.' : 'Email sending is not set up yet, so nothing will be sent.'}</span>
            <input id="notify_email" name="notify_email" type="email" value="${s.notify_email ?? ''}">
          </div>
        </div>
        <label class="check" style="max-width:34rem">
          <input type="checkbox" name="allow_repeating" value="1" ${s.allow_repeating ? 'checked' : ''}>
          <span><span class="check-label">Let people ask for a repeating booking</span>
            <span class="check-note">Weekly, fortnightly or monthly, up to a year of dates.</span></span>
        </label>
        <div class="field" style="margin-top:1rem">
          <label for="intro">What the page says at the top</label>
          <textarea id="intro" name="intro" rows="3">${s.intro ?? ''}</textarea>
        </div>
        <button class="btn-primary" type="submit">Save</button>
      </form>
    `,
  );
}

