import { html, raw } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate, formatSpan, lastDay } from './rota.js';
import { PLACEHOLDERS, DEFAULT_ACK_SUBJECT, DEFAULT_ACK_BODY } from '../email.js';
import { searchBox } from './search.js';
import type { RoomRow } from './rooms.js';

export interface EventRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  capacity: number | null;
  booking_closes_at: string | null;
  is_published: number;
  ask_email: number;
  ask_phone: number;
  poster_key: string | null;
  send_ack: number;
  ack_subject: string | null;
  ack_body: string | null;
  notify_organisers: number;
  /** The most places one booking may take on the public page. */
  max_per_booking: number;
  booked: number; // sum of party_size
  bookings: number; // number of bookings
}

export interface FieldRow {
  id: number;
  event_id: number;
  key: string;
  label: string;
  hint: string | null;
  kind: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox';
  options: string | null;
  required: number;
  sort_order: number;
}

export interface BookingRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  status: string;
  created_at: string;
  answers: Record<string, string>;
}

const BACK = { href: '/app', label: 'All areas' };
const dateOf = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => iso.slice(11, 16);

/** When an event runs, in words — see formatSpan. */
export const formatWhen = formatSpan;

/** True when an event finishes on a later day than it starts. */
export const runsOver = (e: { starts_at: string; ends_at: string | null }) =>
  !!e.ends_at && lastDay(e.starts_at, e.ends_at) !== e.starts_at.slice(0, 10);

function placesLeft(e: EventRow) {
  return e.capacity == null ? null : Math.max(0, e.capacity - e.booked);
}

export function eventsListPage(opts: {
  events: EventRow[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { events, ctx, notice } = opts;
  return layout(
    {
      title: 'Events',
      eyebrow: 'Events',
      heading: 'Events',
      intro: 'Put on an event, take bookings for it, and watch the numbers.',
      back: BACK,
      ...ctx,
    },
    html`
      ${notice ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>` : ''}

      <div class="btn-row" style="margin-bottom:1.5rem">
        <a class="btn-primary" href="/app/events/new">Add an event</a>
      </div>

      ${events.length === 0
        ? html`<div class="card"><p style="margin:0">
            No events yet. <a href="/app/events/new">Add the first one</a>.</p></div>`
        : html`<div class="table-scroll">
            <table class="grid stack">
              <thead><tr><th>Event</th><th>When</th><th class="num">Booked</th><th>Places left</th><th>Status</th></tr></thead>
              <tbody>
                ${events.map((e) => {
                  const left = placesLeft(e);
                  return html`<tr class="${left === 0 ? 'row-gap' : ''}">
                    <td class="stack-title">
                      <a href="/app/events/${e.id}"><strong>${e.title}</strong></a>
                      ${/* Light under the heavy card heading this cell becomes on
                           a phone; on a computer it is the cell's own weight. */ ''}
                      ${e.location ? html`<div style="font-size:.9375rem;font-weight:400;color:var(--ink-2)">${e.location}</div>` : ''}
                    </td>
                    <td data-label="When">${formatDate(dateOf(e.starts_at))}
                      <div class="num" style="font-size:.9375rem;color:var(--ink-2)">${timeOf(e.starts_at)}${runsOver(e)
                        ? ` · until ${formatDate(lastDay(e.starts_at, e.ends_at!))}` : ''}</div></td>
                    <td class="num" data-label="Booked">${e.booked}${e.capacity ? ` / ${e.capacity}` : ''}
                      <div style="font-size:.9375rem;color:var(--ink-2)">${e.bookings} booking${e.bookings === 1 ? '' : 's'}</div></td>
                    <td data-label="Places left">${left == null
                      ? html`<span style="color:var(--ink-2)">no limit</span>`
                      : left === 0 ? chip('red', 'Full') : html`<strong>${left}</strong>`}</td>
                    <td>${e.is_published ? chip('green', 'Taking bookings') : chip('neutral', 'Not published')}</td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>`}
    `,
  );
}

/**
 * When an event starts and finishes.
 *
 * The finish has its own date because some events run over a day or two — a
 * weekend away, a two-day holiday club. It starts as the same day as the start
 * and moves with the start date, keeping the event's length, so the ordinary
 * one-evening event is still just a date and two times; only somebody who
 * means "Sunday" has to change it.
 */
function whenFields(o: {
  idPrefix: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** Required on a new event. An older event may still have no finish at all. */
  endRequired: boolean;
  endHint?: string;
}) {
  const id = (k: string) => `${o.idPrefix}${k}`;
  return html`
    <div class="field">
      <label for="${id('date')}">Starts on</label>
      <input id="${id('date')}" name="on_date" type="date" value="${o.startDate}" required>
    </div>
    <div class="field">
      <label for="${id('time')}">at</label>
      <input id="${id('time')}" name="start_time" type="time" value="${o.startTime}" required
             aria-label="Start time">
    </div>
    <div class="field">
      <label for="${id('end_date')}">Finishes on</label>
      <span class="hint">${o.endHint ?? 'The same day, unless it runs over.'}</span>
      <input id="${id('end_date')}" name="end_date" type="date" value="${o.endDate}"
             ${o.endRequired ? 'required' : ''}>
    </div>
    <div class="field">
      <label for="${id('end')}">at</label>
      <input id="${id('end')}" name="end_time" type="time" value="${o.endTime}"
             ${o.endRequired ? 'required' : ''} aria-label="Finish time">
    </div>
    <script>
      (function () {
        var start = document.getElementById('${id('date')}');
        var end = document.getElementById('${id('end_date')}');
        var was = start.value;
        end.min = start.value;
        function addDays(d, n) {
          return new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
        }
        start.addEventListener('change', function () {
          // Half-typed or cleared: wait for a whole date, or the finish would
          // snap to the start and the event's extra days would be lost.
          if (!start.value) return;
          // Moving the start moves the finish with it, by the same number of
          // days, so a weekend moved a week later is still a weekend — not
          // cut to one day, and not stretched to eight. A finish that was blank
          // (or somehow before the start) simply takes the start date.
          if (was && end.value && end.value >= was && start.value) {
            var shift = Math.round((Date.parse(start.value) - Date.parse(was)) / 864e5);
            end.value = addDays(end.value, shift);
          } else {
            end.value = start.value;
          }
          end.min = start.value;
          was = start.value;
        });
      }());
    </script>`;
}

/** The rooms, each one a tick. Ticked rooms are held for the event's times. */
function roomChecks(rooms: RoomRow[], ticked: number[]) {
  if (!rooms.length) return '';
  return html`
    <h3 style="margin-bottom:.5rem">Book rooms for it</h3>
    <p class="hint" style="margin-top:0">
      Tick any rooms this event needs. They are booked on the room diary from when it starts
      until when it finishes — overnight too, if it runs over more than one day — and move
      with it if the time changes.
    </p>
    <div class="checks">
      ${rooms.map((r) => html`<label class="check">
        <input type="checkbox" name="room_ids" value="${r.id}" ${ticked.includes(r.id) ? 'checked' : ''}>
        <span><span class="check-label">${r.name}</span>
          ${r.notes ? html`<span class="check-note">${r.notes}</span>` : ''}</span>
      </label>`)}
    </div>`;
}

/**
 * Organiser rows, with a button to add another. There is always at least one
 * row to type into; a row left blank is ignored when saved.
 */
function organiserFields(organisers: { name: string; email: string | null }[], notify: boolean) {
  const rows = organisers.length ? organisers : [{ name: '', email: '' }];
  const row = (o: { name: string; email: string | null }) => html`<div class="grid-fields organiser-row">
      <div class="field">
        <label>Organiser's name</label>
        <input name="organiser_name" type="text" aria-label="Organiser's name" value="${o.name}" autocomplete="off">
      </div>
      <div class="field">
        <label>Their email</label>
        <input name="organiser_email" type="email" aria-label="Organiser's email" value="${o.email ?? ''}" autocomplete="off">
      </div>
    </div>`;
  return html`
    <h3 style="margin-bottom:.5rem">Who is organising it</h3>
    <p class="hint" style="margin-top:0">The person running it, not necessarily whoever typed it in.</p>
    <div class="organisers">${rows.map(row)}</div>
    <p style="margin-top:0">
      <button type="button" class="btn-quiet add-organiser">Add another organiser</button>
    </p>
    <label class="check" style="max-width:32rem">
      <input type="checkbox" name="notify_organisers" value="1" ${notify ? 'checked' : ''}>
      <span><span class="check-label">Email the organisers each time somebody books</span>
        <span class="check-note">Sent to every organiser with an email address.</span></span>
    </label>
    <script>
      (function () {
        var btn = document.currentScript.parentNode.querySelector('.add-organiser');
        btn.addEventListener('click', function () {
          var list = btn.closest('form').querySelector('.organisers');
          var last = list.lastElementChild;
          var copy = last.cloneNode(true);
          copy.querySelectorAll('input').forEach(function (i) { i.value = ''; });
          list.appendChild(copy);
          copy.querySelector('input').focus();
        });
      }());
    </script>`;
}


export function newEventPage(opts: {
  ctx: ViewCtx;
  rooms: RoomRow[];
  error?: string;
  form?: Record<string, string>;
  roomIds?: number[];
  organisers?: { name: string; email: string | null }[];
  notify?: boolean;
  /** The refusal was a room clash, which an administrator may overrule. */
  offerOverride?: boolean;
}) {
  const f = opts.form ?? {};
  return layout(
    {
      title: 'Add an event',
      eyebrow: 'Events',
      heading: 'Add an event',
      intro: 'The basics first. You can add the booking form questions once it exists.',
      back: { href: '/app/events', label: 'Events' },
      ...opts.ctx,
    },
    html`
      ${opts.error
        ? html`<div class="notice notice-bad"><p style="margin:0">
            Not created yet — the reason is by the button at the bottom. Everything you typed is
            still here.</p></div>`
        : ''}
      <form method="post" action="/app/events/new" class="card">
        <div class="field">
          <label for="title">What is it called</label>
          <input id="title" name="title" type="text" value="${f.title ?? ''}"
                 placeholder="e.g. Harvest Supper" required>
        </div>
        <div class="field">
          <label for="description">Tell people about it</label>
          <span class="hint">This shows on the booking page.</span>
          <textarea id="description" name="description" rows="4">${f.description ?? ''}</textarea>
        </div>
        <div class="grid-fields">
          ${whenFields({
            idPrefix: 'n_',
            startDate: f.on_date ?? '',
            startTime: f.start_time ?? '19:00',
            endDate: f.end_date || f.on_date || '',
            endTime: f.end_time ?? '21:00',
            endRequired: true,
          })}
          <div class="field">
            <label for="location">Where</label>
            <input id="location" name="location" type="text" value="${f.location ?? ''}" placeholder="Church Centre">
          </div>
          <div class="field">
            <label for="capacity">How many can come</label>
            <span class="hint">Leave blank for no limit.</span>
            <input id="capacity" name="capacity" type="number" min="1" value="${f.capacity ?? ''}">
          </div>
          <div class="field">
            <label for="max_per_booking">Most places in one booking</label>
            <span class="hint">Stops one person taking every place.</span>
            <input id="max_per_booking" name="max_per_booking" type="number" min="1" max="50"
                   value="${f.max_per_booking ?? '10'}" required>
          </div>
          <div class="field">
            <label for="closes">Bookings close</label>
            <span class="hint">Optional.</span>
            <input id="closes" name="closes" type="date" value="${f.closes ?? ''}">
          </div>
        </div>

        ${roomChecks(opts.rooms, opts.roomIds ?? [])}

        ${organiserFields(opts.organisers ?? [], opts.notify ?? false)}

        <h3 style="margin-bottom:.5rem">What to ask people booking</h3>
        <p class="hint" style="margin-top:0">
          Their name and how many are coming are always asked. Only ask for contact details
          if this event actually needs them.
        </p>
        <div class="checks">
          <label class="check">
            <input type="checkbox" name="ask_email" value="1" checked>
            <span><span class="check-label">Their email</span>
              <span class="check-note">So you can tell them if anything changes.</span></span>
          </label>
          <label class="check">
            <input type="checkbox" name="ask_phone" value="1">
            <span><span class="check-label">Their phone number</span>
              <span class="check-note">Only worth asking if somebody will actually ring them.</span></span>
          </label>
        </div>

        ${opts.error
          ? html`<div class="notice notice-bad" role="alert" style="margin-top:1.25rem">
              <p style="margin:0"><strong>Not created yet.</strong> ${opts.error}</p>
              ${opts.offerOverride
                ? html`<label class="check" style="margin-top:.75rem;background:var(--paper)">
                    <input type="checkbox" name="allow_clash" value="1">
                    <span><span class="check-label">Hold the rooms anyway</span>
                      <span class="check-note">Those bookings go ahead as well. Both will show
                        on the room diary.</span></span>
                  </label>`
                : ''}
            </div>`
          : ''}
        <button class="btn-primary" type="submit" style="margin-top:1.25rem">Create the event</button>
      </form>
    `,
  );
}

/** One of the three booking lists on an event's page. */
function bookingTable(opts: {
  heading: string;
  note?: string;
  empty?: string;
  rows: BookingRow[];
  e: EventRow;
  fields: FieldRow[];
  /** May change bookings. Without it the delete controls are not drawn, since
   *  the post would only be refused. */
  manage?: boolean;
}) {
  const { heading, note, rows, e, fields, manage } = opts;
  const people = rows.reduce((n, b) => n + b.party_size, 0);
  const tone = heading === 'Cancelled' ? 'cancelled' : heading === 'Waiting list' ? 'waiting' : 'booked';
  return html`
    <h3 class="bookings-h bookings-h-${tone}">${heading}
      <span class="bookings-count">${rows.length} booking${rows.length === 1 ? '' : 's'} ·
        ${people} ${people === 1 ? 'person' : 'people'}</span></h3>
    ${note ? html`<p style="color:var(--ink-2);font-size:.9375rem;margin-top:0">${note}</p>` : ''}
    ${rows.length === 0
      ? html`<div class="card"><p style="margin:0">${opts.empty ?? 'None.'}</p></div>`
      : html`<div class="table-scroll" style="margin-bottom:1.5rem">
          <table class="grid stack">
            <thead>
              <tr>
                <th>Name</th><th class="num">Places</th><th>Contact</th>
                ${fields.map((fl) => html`<th>${fl.label}</th>`)}
                <th>Booked</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((b) => html`<tr class="${b.status === 'cancelled' ? 'row-cancelled' : ''}"
                    data-search="${[b.name, b.email, b.phone].filter(Boolean).join(' ')}">
                  <td class="stack-title"><a href="/app/events/${e.id}/bookings/${b.id}"><strong>${b.name}</strong></a></td>
                  <td class="num" data-label="Places">${b.party_size}</td>
                  <td data-label="Contact" style="color:var(--ink-2)">${b.email ?? b.phone ?? '—'}
                    ${b.email && b.phone ? html`<div>${b.phone}</div>` : ''}
                  </td>
                  ${fields.map((fl) => html`<td data-label="${fl.label}">${b.answers[String(fl.id)] ?? '—'}</td>`)}
                  <td data-label="Booked" style="color:var(--ink-2)">${b.created_at.slice(0, 10)}</td>
                  <td class="stack-actions">
                    <a class="linkish" href="/app/events/${e.id}/bookings/${b.id}">Change</a>
                    ${b.status === 'booked'
                      ? html`<form method="post" action="/app/events/${e.id}/bookings/${b.id}/cancel"
                                class="inline-form"
                                data-confirm="Cancel ${b.name}’s booking? It moves to the cancelled list."
                                onsubmit="return confirm(this.dataset.confirm)">
                          <button class="linkish" type="submit" style="color:var(--bad)">Cancel</button>
                        </form>`
                      : html`<form method="post" action="/app/events/${e.id}/bookings/${b.id}/restore"
                                class="inline-form">
                          <button class="linkish" type="submit">${b.status === 'waitlist' ? 'Give them a place' : 'Put back'}</button>
                        </form>`}
                    ${b.status === 'cancelled' && manage
                      ? html`<form method="post" action="/app/events/${e.id}/bookings/${b.id}/delete"
                                class="inline-form"
                                data-confirm="Delete ${b.name}’s cancelled booking for good? It goes from this page and cannot be got back."
                                onsubmit="return confirm(this.dataset.confirm)">
                          <!-- So a page left open cannot delete a booking that
                               has been put back since it was drawn. -->
                          <input type="hidden" name="only_cancelled" value="1">
                          <button class="linkish" type="submit" style="color:var(--bad)">Delete</button>
                        </form>`
                      : ''}
                    ${b.status === 'waitlist'
                      ? html`<form method="post" action="/app/events/${e.id}/bookings/${b.id}/cancel"
                                class="inline-form">
                          <button class="linkish" type="submit" style="color:var(--bad)">Remove</button>
                        </form>`
                      : ''}
                  </td>
                </tr>`)}
            </tbody>
          </table>
        </div>`}`;
}

const KINDS: { value: FieldRow['kind']; label: string; note: string }[] = [
  { value: 'text', label: 'Short answer', note: 'A line of text' },
  { value: 'textarea', label: 'Long answer', note: 'A paragraph — allergies, dietary needs' },
  { value: 'number', label: 'A number', note: 'How many of something' },
  { value: 'select', label: 'Choose one from a list', note: 'You give the choices' },
  { value: 'radio', label: 'Choose one (all shown)', note: 'Good for two or three choices' },
  { value: 'checkbox', label: 'A yes/no tick', note: 'e.g. needs a lift' },
];

export function eventAdminPage(opts: {
  event: EventRow;
  fields: FieldRow[];
  bookings: BookingRow[];
  ctx: ViewCtx;
  origin: string;
  /** False when no Email Sending domain is onboarded yet. */
  emailReady?: boolean;
  /** Whether the public form is showing a 'not a robot' check. */
  captchaReady?: boolean;
  rooms: RoomRow[];
  /** Rooms the event holds now. */
  roomIds: number[];
  organisers: { name: string; email: string | null }[];
  notice?: { tone: 'ok' | 'bad'; text: string };
  /**
   * A details save that was refused: what was typed, and why. The form is
   * drawn from these rather than from the event, so nothing typed is lost, and
   * the reason sits by the Save button rather than at the top of the page,
   * where it was being missed.
   */
  details?: {
    values: Record<string, string>;
    roomIds: number[];
    error: string;
    /** The refusal was a room clash, which an administrator may overrule. */
    offerOverride: boolean;
  };
}) {
  const { event: e, fields, bookings, ctx, origin, notice, emailReady, captchaReady,
          rooms, roomIds, organisers, details } = opts;
  // What the details form shows: what was just typed, if a save was refused.
  const dv = details?.values;
  const val = (k: string, saved: string) => (dv ? dv[k] ?? '' : saved);
  const left = placesLeft(e);
  const waiting = bookings.filter((b) => b.status === 'waitlist');
  const cancelled = bookings.filter((b) => b.status === 'cancelled');
  const manage = !ctx.areas || ctx.areas.has('events.manage');
  const bookingUrl = `${origin}/events/${e.slug}`;

  return layout(
    {
      title: e.title,
      eyebrow: 'Event',
      heading: e.title,
      back: { href: '/app/events', label: 'Events' },
      ...ctx,
    },
    html`
      ${notice ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>` : ''}

      <div class="stat-row">
        <div class="stat"><span class="stat-n">${e.booked}</span><span class="stat-l">people coming</span></div>
        <div class="stat"><span class="stat-n">${e.bookings}</span><span class="stat-l">bookings made</span></div>
        <div class="stat ${left === 0 ? 'stat-full' : ''}">
          <span class="stat-n">${left == null ? '∞' : left}</span>
          <span class="stat-l">${left == null ? 'no limit set' : 'places left'}</span>
        </div>
      </div>

      <h2 class="section-h2">The details</h2>
      <div class="card" id="details">
        <p style="margin-top:0;color:var(--ink-2)">
          Everything here can be changed after the event exists. Raising the number who can come
          reopens booking if it had sold out; lowering it below the number already booked is
          allowed — nobody is thrown off — but no more will be taken until the numbers come back
          under it.
        </p>
        <form method="post" action="/app/events/${e.id}/details">
          <div class="field">
            <label for="d_title">What it is called</label>
            <input id="d_title" name="title" type="text" value="${val('title', e.title)}" required>
          </div>
          <div class="field">
            <label for="d_description">Tell people about it</label>
            <span class="hint">This shows on the booking page.</span>
            <textarea id="d_description" name="description" rows="4">${val('description', e.description ?? '')}</textarea>
          </div>
          <div class="grid-fields">
            ${whenFields({
              idPrefix: 'd_',
              startDate: val('on_date', dateOf(e.starts_at)),
              startTime: val('start_time', timeOf(e.starts_at)),
              // An event from before finish times existed still has no end; its
              // date is offered as the start date so only the time is to fill in.
              endDate: val('end_date', e.ends_at ? dateOf(e.ends_at) : dateOf(e.starts_at)),
              endTime: val('end_time', e.ends_at ? timeOf(e.ends_at) : ''),
              endRequired: false,
              endHint: e.ends_at ? undefined : 'Needed before any rooms can be booked for it.',
            })}
            <div class="field">
              <label for="d_location">Where</label>
              <input id="d_location" name="location" type="text" value="${val('location', e.location ?? '')}">
            </div>
            <div class="field">
              <label for="d_capacity">How many can come</label>
              <span class="hint">
                ${e.capacity == null
                  ? 'No limit at the moment. Put a number here to set one.'
                  : `${e.booked} of ${e.capacity} taken. Blank means no limit.`}
              </span>
              <input id="d_capacity" name="capacity" type="number" min="1" max="2000"
                     value="${val('capacity', e.capacity == null ? '' : String(e.capacity))}">
            </div>
            <div class="field">
              <label for="d_max">Most places in one booking</label>
              <span class="hint">On the booking page. The office can take more by phone.</span>
              <input id="d_max" name="max_per_booking" type="number" min="1" max="50"
                     value="${val('max_per_booking', String(e.max_per_booking ?? 10))}" required>
            </div>
            <div class="field">
              <label for="d_closes">Bookings close</label>
              <span class="hint">Optional.</span>
              <input id="d_closes" name="closes" type="date" value="${val('closes', e.booking_closes_at ?? '')}">
            </div>
          </div>
          ${roomChecks(rooms, details ? details.roomIds : roomIds)}
          ${details
            ? html`<div class="notice notice-bad" role="alert" id="details-error" style="margin-top:1.25rem">
                <p style="margin:0"><strong>Not saved.</strong> ${details.error}</p>
                ${details.offerOverride
                  ? html`<label class="check" style="margin-top:.75rem;background:var(--paper)">
                      <input type="checkbox" name="allow_clash" value="1">
                      <span><span class="check-label">Hold the rooms anyway</span>
                        <span class="check-note">Those bookings go ahead as well — for a weekend
                          event that includes the Sunday service, say. Both will show on the
                          room diary.</span></span>
                    </label>`
                  : ''}
              </div>
              <script>document.getElementById('details-error').scrollIntoView({ block: 'center' });</script>`
            : ''}
          <p style="margin-bottom:0;margin-top:1.25rem">
            <button class="btn-primary" type="submit">Save these details</button>
          </p>
        </form>
      </div>

      <h2 class="section-h2">Organisers</h2>
      <div class="card">
        ${emailReady === false && e.notify_organisers
          ? html`<div class="notice notice-warn"><p style="margin:0">
              <strong>Organisers are not being emailed yet.</strong> Email sending has not been
              set up on this Cloudflare account, so bookings are recorded but nobody is told.
            </p></div>`
          : ''}
        <form method="post" action="/app/events/${e.id}/organisers">
          ${organiserFields(organisers, !!e.notify_organisers)}
          <p style="margin-bottom:0;margin-top:1rem">
            <button class="btn-primary" type="submit">Save organisers</button>
          </p>
        </form>
      </div>

      <div class="card">
        <h2>The booking page</h2>
        ${e.is_published
          ? html`<p>Anyone with this link can book — they do not need to sign in.
              ${captchaReady
                ? html`They are asked a quick <strong>"not a robot"</strong> check first, so the
                    list does not fill up with junk.`
                : html`<strong>There is no "not a robot" check on it</strong>, so anybody — or
                    anything — can submit the form. Worth switching on if this link is going
                    anywhere public.`}
            </p>
              <p><a href="${bookingUrl}" class="btn-secondary">${bookingUrl}</a></p>
              <form method="post" action="/app/events/${e.id}/publish" class="inline-form">
                <input type="hidden" name="publish" value="0">
                <button class="btn-quiet" type="submit">Stop taking bookings</button>
              </form>`
          : html`<p>This event is not published yet, so the link does not work and nobody can book.</p>
              <form method="post" action="/app/events/${e.id}/publish" class="inline-form">
                <input type="hidden" name="publish" value="1">
                <button class="btn-primary" type="submit">Publish and take bookings</button>
              </form>`}
      </div>

      <h2 class="section-h2">Poster</h2>
      <div class="card">
        ${e.poster_key
          ? html`<p style="margin-top:0">This appears at the top of the booking page.</p>
              <!-- min(), because 22rem is wider than this card on a phone, and
                   an inline max-width overrides img's own max-width:100%. -->
              <p><img src="/events/${e.slug}/poster" alt="Poster for ${e.title}"
                      style="max-width:min(22rem, 100%);border-radius:var(--radius);box-shadow:var(--shadow)"></p>
              <form method="post" action="/app/events/${e.id}/poster/delete" class="inline-form"
                    onsubmit="return confirm('Remove the poster?')">
                <button class="btn-quiet" type="submit">Remove it</button>
              </form>`
          : html`<p style="margin-top:0;color:var(--ink-2)">
              Optional. A poster makes the booking page look like something worth coming to.
            </p>`}
        <form method="post" action="/app/events/${e.id}/poster" enctype="multipart/form-data"
              style="margin-top:1rem">
          <div class="field">
            <label for="poster">${e.poster_key ? 'Replace it' : 'Add a poster'}</label>
            <span class="hint">A JPEG, PNG or WebP, up to 5MB.</span>
            <input id="poster" name="poster" type="file"
                   accept="image/jpeg,image/png,image/webp" required>
          </div>
          <button class="btn-primary" type="submit">Upload</button>
        </form>
      </div>

      <h2 class="section-h2">Contact details and acknowledgement</h2>
      <div class="card">
        ${emailReady === false && e.send_ack
          ? html`<div class="notice notice-warn">
              <p style="margin:0"><strong>Acknowledgements are not going out yet.</strong>
                Email sending has not been set up on this Cloudflare account, so bookings are
                still recorded but no email is sent. Everything else works; see the README for
                the one command that switches it on.</p>
            </div>`
          : ''}

        <form method="post" action="/app/events/${e.id}/contact">
          <p style="margin-top:0;color:var(--ink-2)">
            Name and numbers coming are always asked. These are up to you.
          </p>
          <div class="checks">
            <label class="check">
              <input type="checkbox" id="ask_email" name="ask_email" value="1" ${e.ask_email ? 'checked' : ''}>
              <span><span class="check-label">Ask for an email</span>
                <span class="check-note" id="email-note">So you can tell them if anything changes.</span></span>
            </label>
            <label class="check">
              <input type="checkbox" name="ask_phone" value="1" ${e.ask_phone ? 'checked' : ''}>
              <span><span class="check-label">Ask for a phone number</span></span>
            </label>
            <label class="check">
              <input type="checkbox" id="send_ack" name="send_ack" value="1" ${e.send_ack ? 'checked' : ''}>
              <span><span class="check-label">Send them an acknowledgement email</span>
                <span class="check-note">Their email address then becomes compulsory.</span></span>
            </label>
          </div>

          <div id="ack-fields" ${e.send_ack ? '' : 'hidden'} style="margin-top:1.25rem">
            <div class="field">
              <label for="ack_subject">Subject</label>
              <input id="ack_subject" name="ack_subject" type="text"
                     value="${e.ack_subject ?? DEFAULT_ACK_SUBJECT}">
            </div>
            <div class="field">
              <label for="ack_body">What the email says</label>
              <span class="hint">
                You can use ${PLACEHOLDERS.map((p) => p.token).join(', ')} and they will be
                filled in for each person.
              </span>
              <textarea id="ack_body" name="ack_body" rows="10">${e.ack_body ?? DEFAULT_ACK_BODY}</textarea>
            </div>
            <details>
              <summary style="cursor:pointer;font-weight:700">What each one means</summary>
              <ul style="color:var(--ink-2)">
                ${PLACEHOLDERS.map((p) => html`<li><code>${p.token}</code> — ${p.means}</li>`)}
              </ul>
            </details>
          </div>

          <p style="margin-bottom:0;margin-top:1rem">
            <button class="btn-primary" type="submit">Save</button>
          </p>
        </form>
      </div>

      <script>
        // Ticking the acknowledgement forces the email address on, because there
        // would otherwise be nowhere to send it.
        (function () {
          var ack = document.getElementById('send_ack');
          var email = document.getElementById('ask_email');
          var fields = document.getElementById('ack-fields');
          var note = document.getElementById('email-note');
          function sync() {
            if (fields) fields.hidden = !ack.checked;
            if (ack.checked && email) {
              email.checked = true;
              email.disabled = true;
              if (note) note.textContent = 'Required, because an acknowledgement is being sent.';
            } else if (email) {
              email.disabled = false;
              if (note) note.textContent = 'So you can tell them if anything changes.';
            }
          }
          ack.addEventListener('change', sync);
          sync();
          // A disabled box is not submitted, so re-enable it as the form goes.
          var form = ack.closest('form');
          if (form) form.addEventListener('submit', function () { if (email) email.disabled = false; });
        }());
      </script>

      <h2 class="section-h2">What else to ask people</h2>
      <div class="card">
        <p style="margin-top:0;color:var(--ink-2)">
          Everyone is always asked their name and how many are coming. Add anything else this
          event needs — food choices, allergies, whether they need a lift.
        </p>
        ${fields.length === 0
          ? html`<p><em>Nothing extra asked yet.</em></p>`
          : html`<div class="table-scroll" style="margin-bottom:1.25rem">
              <table class="grid stack">
                <thead><tr><th>Question</th><th>Kind</th><th>Must answer</th><th></th></tr></thead>
                <tbody>
                  ${fields.map(
                    (fl) => html`<tr>
                      <td class="stack-title"><strong>${fl.label}</strong>
                        ${/* The weight is the cell's own on a computer; it is set
                             so these stay light under the heavy card heading that
                             the question becomes on a phone. */ ''}
                        ${fl.hint ? html`<div style="font-size:.9375rem;font-weight:400;color:var(--ink-2)">${fl.hint}</div>` : ''}
                        ${fl.options ? html`<div style="font-size:.9375rem;font-weight:400;color:var(--ink-2)">Choices: ${(JSON.parse(fl.options) as string[]).join(', ')}</div>` : ''}
                      </td>
                      <td data-label="Kind">${KINDS.find((k) => k.value === fl.kind)?.label ?? fl.kind}</td>
                      <td data-label="Must answer">${fl.required ? chip('navy', 'Yes') : chip('neutral', 'No')}</td>
                      <td class="stack-actions">
                        <form method="post" action="/app/events/${e.id}/fields/${fl.id}/delete"
                              class="inline-form" onsubmit="return confirm('Remove this question?')">
                          <button class="linkish" type="submit" style="color:var(--bad)">Remove</button>
                        </form>
                      </td>
                    </tr>`,
                  )}
                </tbody>
              </table>
            </div>`}

        <form method="post" action="/app/events/${e.id}/fields">
          <div class="grid-fields">
            <div class="field">
              <label for="label">The question</label>
              <input id="label" name="label" type="text" placeholder="e.g. Any allergies?" required>
            </div>
            <div class="field">
              <label for="kind">What kind of answer</label>
              <select id="kind" name="kind">
                ${KINDS.map((k) => html`<option value="${k.value}">${k.label} — ${k.note}</option>`)}
              </select>
            </div>
          </div>
          <div class="field">
            <label for="options">Choices, if it is a list</label>
            <span class="hint">One per line. Ignored for the other kinds.</span>
            <textarea id="options" name="options" rows="3" placeholder="Beef&#10;Vegetarian&#10;Vegan"></textarea>
          </div>
          <label class="check" style="max-width:24rem">
            <input type="checkbox" name="required" value="1">
            <span><span class="check-label">They must answer this</span></span>
          </label>
          <p style="margin-bottom:0;margin-top:1rem">
            <button class="btn-primary" type="submit">Add this question</button>
          </p>
        </form>
      </div>

      <h2 class="section-h2">Who has booked</h2>
      <div class="btn-row" style="margin-bottom:1.25rem">
        <a class="btn-primary" href="/app/events/${e.id}/bookings/new">Take a booking by phone</a>
        ${bookings.length && (!ctx.areas || ctx.areas.has('events.manage'))
          ? html`<a class="btn-quiet" href="/app/events/${e.id}/attendees.pdf">Download PDF</a>
              <a class="btn-quiet" href="/app/events/${e.id}/attendees.xlsx">Download for Excel</a>`
          : ''}
      </div>

      ${bookings.length === 0
        ? html`<div class="card"><p style="margin:0">
            Nobody yet. If someone rings the office, use
            <a href="/app/events/${e.id}/bookings/new">Take a booking by phone</a> to put them on
            the list yourself.
          </p></div>`
        : html`
            ${searchBox({
              target: 'bookings-list',
              label: 'Find a booking',
              placeholder: 'Start typing a name…',
              noun: 'bookings',
              hint: 'Searches all three lists, by name, email address and phone number — useful '
                + 'when somebody rings up to change theirs.',
            })}
            <!-- Three lists, never one. A cancelled booking sat among the real ones
                 is how somebody gets a place set for them who is not coming. -->
            <div id="bookings-list">
              ${bookingTable({
                heading: 'Booked',
                rows: bookings.filter((b) => b.status === 'booked'),
                empty: 'Nobody is booked in at the moment.',
                e, fields,
              })}
              ${waiting.length
                ? bookingTable({
                    heading: 'Waiting list',
                    note: 'In the order they asked. "Give them a place" books them in if there '
                      + 'is room.',
                    rows: waiting, e, fields,
                  })
                : ''}
              ${cancelled.length
                ? html`${bookingTable({
                    heading: 'Cancelled',
                    note: 'Kept as a record until you delete them. None of these count towards '
                      + 'the numbers, so deleting them changes nothing but this list.',
                    rows: cancelled, e, fields, manage,
                  })}
                  ${/* Only for two or more: with one, its own Delete is right beside it,
                       and "Delete all 1" just says the same thing twice. */
                    manage && cancelled.length > 1
                    ? html`<form method="post" action="/app/events/${e.id}/cancelled/delete"
                          class="inline-form"
                          data-confirm="Delete all ${cancelled.length} cancelled bookings for good? They go from this page and cannot be got back. Nobody booked or on the waiting list is touched."
                          onsubmit="return confirm(this.dataset.confirm)">
                        <button class="btn-danger" type="submit">Delete all ${cancelled.length} cancelled bookings</button>
                      </form>`
                    : ''}`
                : ''}
            </div>`}
    `,
  );
}

/**
 * One booking, as the office sees it on the phone.
 *
 * Used both for taking a new booking and for amending one, because the two jobs
 * are the same form — somebody rings, and what they say has to end up in the
 * row. The only difference is whether a row exists yet.
 *
 * Every box the event asks for is editable here, including the email address:
 * people ring precisely because they got something wrong on the website.
 */
export function bookingEditPage(opts: {
  event: EventRow;
  fields: FieldRow[];
  /** Absent when taking a new booking over the phone. */
  booking?: BookingRow;
  ctx: ViewCtx;
  error?: string;
  /** What was typed, when a save was rejected. Falls back to the stored row. */
  values?: Record<string, string>;
}) {
  const { event: e, fields, booking: b, ctx, error } = opts;
  const isNew = !b;
  const left = placesLeft(e);

  // What to put in each box: whatever was last typed, else the stored booking,
  // else empty. Without the first of those a rejected save would throw away
  // everything the office had just keyed in.
  const typed = opts.values;
  const v = (k: string, stored: string | number | null | undefined) =>
    typed ? (typed[k] ?? '') : (stored == null ? '' : String(stored));
  const answerValues: Record<string, string> = typed
    ?? Object.fromEntries(Object.entries(b?.answers ?? {}).map(([id, val]) => [`f_${id}`, val]));

  const action = isNew
    ? `/app/events/${e.id}/bookings/new`
    : `/app/events/${e.id}/bookings/${b.id}`;

  return layout(
    {
      title: isNew ? 'Take a booking' : `Booking — ${b.name}`,
      eyebrow: e.title,
      heading: isNew ? 'Take a booking over the phone' : `Amend ${b.name}’s booking`,
      intro: isNew
        ? 'For someone who has rung the office rather than used the booking link. It is '
          + 'recorded exactly as if they had booked it themselves.'
        : 'Change anything here and press Save. Nothing is sent to them automatically, so if '
          + 'they need telling, ring or email them yourself.',
      back: { href: `/app/events/${e.id}`, label: e.title },
      ...ctx,
    },
    html`
      ${error ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">${error}</p></div>` : ''}

      ${b && b.status === 'cancelled'
        ? html`<div class="notice notice-warn"><p style="margin:0">
            <strong>This booking is cancelled.</strong> It is kept so there is a record of it,
            but it does not count towards the numbers. Put it back with
            <strong>Booked</strong> below if they ring again.
          </p></div>`
        : ''}

      ${left === 0 && (isNew || b.status === 'cancelled')
        ? html`<div class="notice notice-warn"><p style="margin:0">
            This event is <strong>full</strong>. You can still put somebody down as
            <strong>Waiting list</strong> — that does not take a place.
          </p></div>`
        : ''}

      <form method="post" action="${action}" class="card">
        <div class="field">
          <label for="name">Name</label>
          <span class="hint">Whoever the booking is under.</span>
          <input id="name" name="name" type="text" value="${v('name', b?.name)}" required
                 ${isNew ? 'autofocus' : ''}>
        </div>

        <div class="grid-fields">
          <div class="field">
            <label for="party_size">How many people</label>
            <span class="hint">Including them.</span>
            <input id="party_size" name="party_size" type="number" min="1" max="50"
                   value="${v('party_size', b?.party_size ?? 1)}" required>
          </div>
          <div class="field">
            <label for="email">Email</label>
            <span class="hint">Optional — leave it blank if they did not give one.</span>
            <input id="email" name="email" type="email" value="${v('email', b?.email)}">
          </div>
          <div class="field">
            <label for="phone">Phone</label>
            <span class="hint">Worth having for a booking taken by phone.</span>
            <input id="phone" name="phone" type="tel" value="${v('phone', b?.phone)}">
          </div>
        </div>

        ${customQuestions(fields, answerValues)}

        <div class="field">
          <label for="status">Where they stand</label>
          <span class="hint">
            Only <strong>Booked</strong> counts towards the numbers and the places left.
          </span>
          <select id="status" name="status">
            ${STATUSES.map(
              (s) => html`<option value="${s.value}"
                ${v('status', b?.status ?? 'booked') === s.value ? 'selected' : ''}>${s.label}</option>`,
            )}
          </select>
        </div>

        <div class="btn-row" style="margin-top:1.25rem">
          <button class="btn-primary" type="submit">
            ${isNew ? 'Add this booking' : 'Save the changes'}
          </button>
          <a class="btn-secondary" href="/app/events/${e.id}">Cancel — go back without saving</a>
        </div>
      </form>

      ${b
        ? html`<h2 class="section-h2">Remove it altogether</h2>
            <div class="card">
              <p style="margin-top:0">
                Setting it to <strong>Cancelled</strong> above is almost always what you want:
                the booking stops counting but stays on the list, so there is a record if they
                ring back. Deleting wipes it out completely and cannot be undone — keep that
                for a test booking or one entered by mistake.
              </p>
              <form method="post" action="/app/events/${e.id}/bookings/${b.id}/delete"
                    data-confirm="Delete ${b.name}’s booking for good? This cannot be undone."
                    onsubmit="return confirm(this.dataset.confirm)">
                <button class="btn-danger" type="submit">Delete this booking for good</button>
              </form>
            </div>`
        : ''}
    `,
  );
}

/** Where a booking stands. Matches the CHECK on event_bookings.status. */
const STATUSES = [
  { value: 'booked', label: 'Booked — they are coming' },
  { value: 'waitlist', label: 'Waiting list — only if a place frees up' },
  { value: 'cancelled', label: 'Cancelled — they have pulled out' },
] as const;

/**
 * The event's own questions, as form controls.
 *
 * Shared by the public booking page and the one the office uses on the phone.
 * They have to ask exactly the same things: a question missing from the office
 * form is a hole in the caterer's list that nobody would notice until the day.
 *
 * Values are keyed by field NAME (`f_12`), which is what a submitted form gives
 * back, so a rejected form can be redrawn with what was typed still in it.
 */
export function customQuestions(fields: FieldRow[], v: Record<string, string>) {
  return fields.map((fl) => {
    const name = `f_${fl.id}`;
    const val = v[name] ?? '';
    const choices = fl.options ? (JSON.parse(fl.options) as string[]) : [];
    return html`<div class="field">
      <label for="${name}">${fl.label}</label>
      ${fl.hint ? html`<span class="hint">${fl.hint}</span>` : ''}
      ${control(fl, name, val, choices)}
    </div>`;
  });
}

/**
 * One question's control.
 *
 * Written as early returns rather than a chain of nested ternaries, because a
 * chain is exactly how this went wrong: every kind was tested except 'text',
 * which fell off the end into the final else and rendered a "Yes" tick. Somebody
 * asking for a line of text got a checkbox, and the answer they wanted was
 * impossible to give.
 *
 * The fallback is now a TEXT BOX, not a checkbox. A kind nobody recognises is a
 * bug either way, but a text box still captures whatever the person came to say;
 * a checkbox silently throws it away and stores the word "Yes".
 */
function control(
  fl: FieldRow,
  name: string,
  val: string,
  choices: string[],
) {
  const required = fl.required ? 'required' : '';

  if (fl.kind === 'textarea') {
    return html`<textarea id="${name}" name="${name}" rows="3" ${required}>${val}</textarea>`;
  }
  if (fl.kind === 'number') {
    return html`<input id="${name}" name="${name}" type="number" value="${val}" ${required}>`;
  }
  if (fl.kind === 'select') {
    return html`<select id="${name}" name="${name}" ${required}>
      <option value="">Please choose…</option>
      ${choices.map((o) => html`<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`)}
    </select>`;
  }
  if (fl.kind === 'radio') {
    return html`<div class="checks">
      ${choices.map((o) => html`<label class="check">
        <input type="radio" name="${name}" value="${o}" ${val === o ? 'checked' : ''} ${required}>
        <span class="check-label">${o}</span>
      </label>`)}
    </div>`;
  }
  if (fl.kind === 'checkbox') {
    return html`<label class="check" style="max-width:24rem">
      <input type="checkbox" name="${name}" value="Yes" ${val ? 'checked' : ''} ${required}>
      <span class="check-label">Yes</span>
    </label>`;
  }
  // 'text', and anything unrecognised.
  return html`<input id="${name}" name="${name}" type="text" value="${val}" ${required}>`;
}

/** The public booking form. No sign-in, no chrome, no menu — it is for people
 *  who have followed a link from a noticeboard or a WhatsApp group. */
export function publicBookingPage(opts: {
  event: EventRow;
  fields: FieldRow[];
  error?: string;
  values?: Record<string, string>;
  /** Turnstile site key. Absent means no challenge is shown at all, which is
   *  what happens when the keys are not configured. */
  turnstileSitekey?: string;
}) {
  const { event: e, fields, error } = opts;
  const v = opts.values ?? {};
  const left = placesLeft(e);
  const full = left === 0;

  return layout(
    {
      title: e.title,
      chrome: false,
      heading: e.title,
      eyebrow: 'Bream Church',
      // The heading is the event's NAME. Somebody arriving from a poster needs
      // telling what this page is, and 'Harvest Supper' alone does not do it.
      headingAside: 'Book your place',
    },
    html`
      <div style="max-width:40rem;margin-inline:auto">
        ${e.poster_key
          ? html`<img src="/events/${e.slug}/poster" alt="Poster for ${e.title}"
                      style="width:100%;border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:1.25rem">`
          : ''}
        <div class="card">
          <p style="margin-top:0"><strong>${formatWhen(e.starts_at, e.ends_at)}</strong>${e.location
            ? `, ${e.location}` : ''}</p>
          ${e.description ? html`<p>${raw(e.description.replace(/\n/g, '<br>'))}</p>` : ''}
          <!-- Whether there is room, never how much of it. "3 places left"
               makes people hesitate over whether to take two, and it tells
               anybody who looks exactly how the evening is selling. -->
          ${left != null
            ? html`<p style="margin-bottom:0">
                ${full
                  ? html`<strong style="color:var(--bad)">Sold out.</strong>
                      There are no places left for this one.`
                  : html`<strong style="color:var(--ok)">Still spaces left.</strong>`}
              </p>`
            : ''}
        </div>

        ${error ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">${error}</p></div>` : ''}

        ${full
          ? html`<div class="notice notice-warn"><p style="margin:0">
              <strong>Fully booked.</strong> You can still add yourself to the waiting list
              below — places do sometimes come back, and if one does we will be in touch.
            </p></div>`
          : ''}
        ${html`<form method="post" class="card">
              ${full ? html`<input type="hidden" name="waitlist" value="1">` : ''}
              <div class="field">
                <label for="name">Your name</label>
                <input id="name" name="name" type="text" value="${v.name ?? ''}" required autofocus>
              </div>
              <!-- Only the boxes this event actually asks for. Collecting a phone
                   number nobody will ring is a thing not to do by default. -->
              <div class="grid-fields">
                <div class="field">
                  <label for="party_size">How many of you ${full ? 'would like to come' : 'are coming'}</label>
                  <span class="hint">Including yourself. Up to ${e.max_per_booking ?? 10} in one booking.</span>
                  <input id="party_size" name="party_size" type="number" min="1"
                         max="${e.max_per_booking ?? 10}" value="${v.party_size ?? '1'}" required>
                </div>
                ${e.ask_email
                  ? html`<div class="field">
                      <label for="email">Email</label>
                      <span class="hint">So we can let you know if anything changes.</span>
                      <input id="email" name="email" type="email" value="${v.email ?? ''}">
                    </div>`
                  : ''}
                ${e.ask_phone
                  ? html`<div class="field">
                      <label for="phone">Phone</label>
                      <span class="hint">In case we need to reach you on the day.</span>
                      <input id="phone" name="phone" type="tel" value="${v.phone ?? ''}">
                    </div>`
                  : ''}
              </div>

              ${customQuestions(fields, v)}

              ${opts.turnstileSitekey
                ? html`<div class="field">
                    <label for="robot-hint">Just checking you are not a robot</label>
                    <span class="hint" id="robot-hint">
                      This keeps the list honest. Most of the time it passes on its own and
                      there is nothing for you to do.
                    </span>
                    <div class="cf-turnstile" data-sitekey="${opts.turnstileSitekey}"
                         data-theme="light" data-action="event-booking"
                         aria-describedby="robot-hint"></div>
                    <noscript>
                      <p class="notice notice-warn" style="margin-top:.75rem">
                        This check needs JavaScript switched on. If you cannot, ring the
                        church office and they will book you in.
                      </p>
                    </noscript>
                    <!-- Loaded only on the page that has a widget, and only when
                         a key exists. It finds .cf-turnstile itself. -->
                    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                            async defer></script>
                  </div>`
                : ''}

              <button class="btn-primary" type="submit">${full
                ? 'Fully booked — add me to the waiting list' : 'Book my place'}</button>
            </form>`}
      </div>
    `,
  );
}

export function bookingDonePage(e: EventRow, partySize: number, waitlist = false) {
  if (waitlist) {
    return layout(
      { title: 'On the waiting list', chrome: false, heading: 'You are on the waiting list', eyebrow: 'Bream Church' },
      html`
        <div style="max-width:40rem;margin-inline:auto">
          <div class="notice notice-warn">
            <p style="margin:0">
              Thank you. <strong>${e.title}</strong> is fully booked at the moment, so we have
              put you on the waiting list for <strong>${partySize}</strong>
              ${partySize === 1 ? 'place' : 'places'}.
            </p>
          </div>
          <div class="card">
            <p style="margin:0">
              This is not a place yet. If one comes back we will be in touch — please do not
              come along unless we have told you there is room.
            </p>
          </div>
        </div>
      `,
    );
  }
  return layout(
    { title: 'Booked', chrome: false, heading: 'You are booked in', eyebrow: 'Bream Church' },
    html`
      <div style="max-width:40rem;margin-inline:auto">
        <div class="notice notice-ok">
          <p style="margin:0">
            Thank you. We have you down for
            <strong>${partySize}</strong> ${partySize === 1 ? 'place' : 'places'} at
            <strong>${e.title}</strong>, ${formatWhen(e.starts_at, e.ends_at)}.
          </p>
        </div>
        <div class="card">
          <p style="margin:0">
            If you need to change or cancel, please speak to the church office — there is no
            need to book again.
          </p>
        </div>
      </div>
    `,
  );
}
