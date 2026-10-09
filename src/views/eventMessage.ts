import { html } from 'hono/html';
import { layout, type ViewCtx } from './layout.js';
import { formatWhen, type BookingRow, type EventRow } from './events.js';
import { usableEmail } from '../email.js';

/**
 * Emailing the people booked on an event: write it, check it, send it.
 *
 * Three pages rather than one, on purpose. The second exists only to say
 * "are you sure?" with the message laid out as it will arrive and the number of
 * people it is about to reach — an email cannot be called back, and the person
 * pressing the button is the church office, not somebody who sends bulk mail
 * for a living.
 *
 * Every message is blind-copied (sendBlindCopies in src/email.ts). The pages
 * say so in plain words each step of the way, so nobody is left wondering
 * whether everyone will see everyone else's address.
 */

export interface MessageDraft {
  subject: string;
  body: string;
  replyTo: string;
  audience: 'all' | 'chosen';
  /** Bookings ticked, for 'chosen'. */
  chosen: number[];
}

export interface SentMessageRow {
  id: number;
  subject: string;
  audience: 'all' | 'chosen';
  sent_count: number;
  failed_count: number;
  no_email_count: number;
  sent_at: string;
  sent_by_name: string | null;
}

const hasEmail = (b: BookingRow) => usableEmail(b.email) != null;
const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;

/** '2026-10-09 14:05:00' (UTC, as SQLite writes it) -> 'Fri 9 Oct 2026 at 15:05', in Britain. */
export function sentWhen(sqliteUtc: string): string {
  const d = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return sqliteUtc;
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London',
  });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  return `${day} at ${time}`;
}

/** The box that says, every time, that nobody sees anybody else's address. */
const privacyNote = html`
  <div class="notice notice-ok" role="note"><p style="margin:0">
    <strong>Private by design.</strong> Everybody is sent a <strong>blind copy</strong>. Each
    person sees only Bream Church’s address and their own — never anybody else’s email address.
  </p></div>`;

export function messageComposePage(opts: {
  event: EventRow;
  /** Booked and waiting list, never cancelled. */
  bookings: BookingRow[];
  draft: MessageDraft;
  history: SentMessageRow[];
  emailReady: boolean;
  ctx: ViewCtx;
  error?: string;
}) {
  const { event: e, bookings, draft, history, emailReady, ctx, error } = opts;
  const booked = bookings.filter((b) => b.status === 'booked');
  const waiting = bookings.filter((b) => b.status === 'waitlist');
  const bookedWithEmail = booked.filter(hasEmail).length;
  const bookedWithout = booked.length - bookedWithEmail;
  const chosen = new Set(draft.chosen);

  const pick = (rows: BookingRow[], heading: string, note?: string, group = 'booked') => rows.length === 0 ? '' : html`
    <h3 style="margin:1.25rem 0 .25rem">${heading}</h3>
    ${note ? html`<p style="margin:0 0 .5rem;color:var(--ink-2);font-size:.9375rem">${note}</p>` : ''}
    <div class="checks">
      ${rows.map((b) => hasEmail(b)
        ? html`<label class="check">
            <input type="checkbox" name="booking_id" value="${b.id}" data-pick data-group="${group}"
                   ${chosen.has(b.id) ? 'checked' : ''}>
            <span><span class="check-label">${b.name}</span>
              <span class="check-note">${b.email}${b.party_size > 1 ? ` · ${b.party_size} places` : ''}</span></span>
          </label>`
        : html`<label class="check" style="opacity:.6;cursor:not-allowed">
            <input type="checkbox" disabled>
            <span><span class="check-label">${b.name}</span>
              <span class="check-note">No email address — cannot be emailed${b.phone ? html`. Phone: ${b.phone}` : ''}</span></span>
          </label>`)}
    </div>`;

  return layout(
    {
      title: `Message — ${e.title}`,
      eyebrow: e.title,
      heading: 'Communicate with participants',
      intro: 'Write an email to the people who have booked. Nothing is sent from this page — '
        + 'you will see the whole message once more, and be asked if you are sure, before it goes.',
      back: { href: `/app/events/${e.id}`, label: e.title },
      ...ctx,
    },
    html`
      ${!emailReady
        ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">
            <strong>Email sending is not set up yet</strong>, so nothing can be sent from here at the
            moment. You can still write the message and check it.
          </p></div>`
        : ''}
      ${error ? html`<div class="notice notice-bad" role="alert" id="message-error"><p style="margin:0">${error}</p></div>
          <script>document.getElementById('message-error').scrollIntoView({ block: 'center' });</script>` : ''}

      ${privacyNote}

      <form method="post" action="/app/events/${e.id}/message/check" id="message-form">
        <h2 class="section-h2">1. Write your message</h2>
        <div class="card">
          <div class="field">
            <label for="subject">Subject</label>
            <span class="hint">The line people see in their inbox before they open it.</span>
            <input id="subject" name="subject" type="text" maxlength="200" required
                   value="${draft.subject}">
          </div>
          <div class="field">
            <label for="body">Message</label>
            <span class="hint">
              Everybody gets exactly the same words, so start with something like
              “Dear all” rather than a name.
            </span>
            <textarea id="body" name="body" rows="14" required>${draft.body}</textarea>
          </div>
          <div class="field" style="margin-bottom:0">
            <label for="reply_to">If people reply, send their replies to</label>
            <span class="hint">
              Usually your own email address. Leave it empty and replies go to
              Bream Church’s booking address instead.
            </span>
            <input id="reply_to" name="reply_to" type="email" value="${draft.replyTo}"
                   style="max-width:28rem">
          </div>
        </div>

        <h2 class="section-h2">2. Who should get it?</h2>
        <div class="card">
          <div class="checks" style="grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))">
            <label class="check">
              <input type="radio" name="audience" value="all" ${draft.audience === 'all' ? 'checked' : ''}>
              <span><span class="check-label">Send to all participants</span>
                <span class="check-note">Everybody booked in —
                  ${people(bookedWithEmail)} with an email address.</span></span>
            </label>
            <label class="check">
              <input type="radio" name="audience" value="chosen" ${draft.audience === 'chosen' ? 'checked' : ''}>
              <span><span class="check-label">Send to selected participants</span>
                <span class="check-note">You tick who gets it.</span></span>
            </label>
          </div>

          ${bookedWithout > 0
            ? html`<p style="margin:1rem 0 0;color:var(--ink-2)">
                ${people(bookedWithout)} booked in ${bookedWithout === 1 ? 'has' : 'have'} no email
                address and will not get this. You will see who on the next page, in case you want
                to ring them.
              </p>`
            : ''}

          <div id="picker" style="margin-top:1.25rem">
            ${bookings.length === 0
              ? html`<p style="margin:0">Nobody has booked yet, so there is nobody to email.</p>`
              : html`
                <div class="btn-row">
                  <button type="button" class="btn-quiet" data-tick="all">Tick everyone booked in</button>
                  <button type="button" class="btn-quiet" data-tick="none">Untick everyone</button>
                </div>
                ${pick(booked, 'Booked in')}
                ${pick(waiting, 'Waiting list', 'Not ticked unless you tick them — they do not have a place yet.', 'waiting')}`}
          </div>
        </div>

        <p id="count-line" style="font-weight:700;font-size:1.125rem;margin:1.5rem 0 1rem" aria-live="polite"></p>
        <div class="btn-row">
          <button class="btn-primary" type="submit">Next: check it before sending</button>
          <a class="btn-secondary" href="/app/events/${e.id}">Cancel — go back to the event</a>
        </div>
      </form>

      ${history.length
        ? html`<h2 class="section-h2">Already sent for this event</h2>
            <div class="card">
              <ul style="margin:0;padding-left:1.2rem">
                ${history.map((m) => html`<li style="margin-bottom:.4rem">
                  <a href="/app/events/${e.id}/message/${m.id}"><strong>${m.subject}</strong></a>
                  <span style="color:var(--ink-2)"> — ${sentWhen(m.sent_at)}, to ${people(m.sent_count)}${m.sent_by_name ? `, by ${m.sent_by_name}` : ''}${m.failed_count ? html`, <span style="color:var(--bad)">${m.failed_count} could not be sent</span>` : ''}</span>
                </li>`)}
              </ul>
            </div>`
        : ''}

      <script>
      (function () {
        var form = document.getElementById('message-form');
        var picker = document.getElementById('picker');
        var line = document.getElementById('count-line');
        var all = ${bookedWithEmail};
        function audience() {
          var r = form.querySelector('input[name="audience"]:checked');
          return r ? r.value : 'all';
        }
        function update() {
          var chosen = audience() === 'chosen';
          picker.hidden = !chosen;
          var n = chosen ? form.querySelectorAll('input[data-pick]:checked').length : all;
          line.textContent = n === 0
            ? 'Nobody is chosen yet.'
            : 'This will go to ' + n + (n === 1 ? ' person.' : ' people.');
        }
        form.addEventListener('change', update);
        picker.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-tick]');
          if (!b) return;
          var on = b.getAttribute('data-tick') === 'all';
          picker.querySelectorAll(on ? 'input[data-group="booked"]' : 'input[data-pick]').forEach(function (i) { i.checked = on; });
          update();
        });
        update();
      })();
      </script>
    `,
  );
}

/**
 * "Are you sure?" — the message as it will arrive, and exactly who it reaches.
 *
 * The draft travels on in hidden fields to both buttons: "Yes, send it" posts
 * it to be sent, "No, go back" posts it back to the writing page so nothing
 * typed is lost.
 */
export function messageConfirmPage(opts: {
  event: EventRow;
  draft: MessageDraft;
  /** Who it will go to, with an address. */
  recipients: BookingRow[];
  /** Chosen or booked in, but nothing to send to. */
  noEmail: BookingRow[];
  from: string;
  emailReady: boolean;
  ctx: ViewCtx;
}) {
  const { event: e, draft, recipients, noEmail, from, emailReady, ctx } = opts;
  const addresses = new Set(recipients.map((b) => usableEmail(b.email)!.toLowerCase()));
  const n = addresses.size;

  const carry = html`
    <input type="hidden" name="subject" value="${draft.subject}">
    <textarea name="body" hidden>${draft.body}</textarea>
    <input type="hidden" name="reply_to" value="${draft.replyTo}">
    <input type="hidden" name="audience" value="${draft.audience}">
    ${draft.chosen.map((id) => html`<input type="hidden" name="booking_id" value="${id}">`)}`;

  return layout(
    {
      title: `Check the message — ${e.title}`,
      eyebrow: e.title,
      heading: 'Are you sure?',
      intro: 'Read it through one last time. Once it is sent it cannot be called back.',
      back: { href: `/app/events/${e.id}`, label: e.title },
      ...ctx,
    },
    html`
      <div class="card" style="border-left:6px solid var(--navy)">
        <p style="margin:0;font-size:1.25rem">
          This will email <strong>${people(n)}</strong>
          — ${draft.audience === 'all' ? 'all participants booked in' : 'the participants you selected'}.
        </p>
        <p style="margin:.75rem 0 0">
          🔒 Everybody is sent a <strong>blind copy</strong>. Each person sees only Bream Church’s
          address and their own. Nobody can see who else it went to.
        </p>
        <details style="margin-top:1rem">
          <summary style="cursor:pointer;font-weight:700">See who it goes to (${people(n)})</summary>
          <ul style="margin:.75rem 0 0;padding-left:1.2rem;columns:16rem">
            ${recipients.map((b) => html`<li>${b.name} <span style="color:var(--ink-2)">— ${b.email}</span></li>`)}
          </ul>
        </details>
      </div>

      ${noEmail.length
        ? html`<div class="notice notice-warn"><p style="margin:0 0 .5rem">
              <strong>${people(noEmail.length)} will not get this</strong>, because there is no
              email address for them. You may want to ring them instead:
            </p>
            <ul style="margin:0;padding-left:1.2rem">
              ${noEmail.map((b) => html`<li>${b.name}${b.phone ? html` — ${b.phone}` : ' — no phone number either'}</li>`)}
            </ul></div>`
        : ''}

      <h2 class="section-h2">How it will look</h2>
      <div class="card">
        <dl style="display:grid;grid-template-columns:max-content 1fr;gap:.35rem 1rem;margin:0 0 1rem">
          <dt style="color:var(--ink-2)">From</dt><dd style="margin:0">Bream Church &lt;${from}&gt;</dd>
          <dt style="color:var(--ink-2)">To</dt><dd style="margin:0">Bream Church &lt;${from}&gt;</dd>
          <dt style="color:var(--ink-2)">Blind copy</dt><dd style="margin:0">${people(n)} — hidden from each other</dd>
          ${draft.replyTo ? html`<dt style="color:var(--ink-2)">Replies to</dt><dd style="margin:0">${draft.replyTo}</dd>` : ''}
          <dt style="color:var(--ink-2)">Subject</dt><dd style="margin:0"><strong>${draft.subject}</strong></dd>
        </dl>
        <div style="border-top:1px solid var(--rule);padding-top:1rem;white-space:pre-wrap;overflow-wrap:anywhere">${draft.body}</div>
      </div>

      ${!emailReady
        ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">
            Email sending is not set up yet, so this cannot be sent. Nothing has gone out.
          </p></div>`
        : ''}

      <div class="btn-row" style="margin-top:1.5rem">
        <form method="post" action="/app/events/${e.id}/message/send" class="inline-form" id="send-form">
          ${carry}
          <button class="btn-primary" type="submit" id="send-button" ${!emailReady || n === 0 ? 'disabled' : ''}>
            Yes, send it to ${people(n)}
          </button>
        </form>
        <form method="post" action="/app/events/${e.id}/message" class="inline-form">
          ${carry}
          <button class="btn-secondary" type="submit">No — go back and change it</button>
        </form>
      </div>
      <script>
      // One press, one email: a second click while the first is still going
      // would send everything twice.
      document.getElementById('send-form').addEventListener('submit', function () {
        var b = document.getElementById('send-button');
        setTimeout(function () { b.disabled = true; b.textContent = 'Sending…'; }, 0);
      });
      </script>
    `,
  );
}

/** What happened to a message once it was sent. Reachable again from the
 *  "Already sent" list. */
export function messageSentPage(opts: {
  event: EventRow;
  message: SentMessageRow & { body: string };
  failed: { name: string; email: string | null; error: string | null }[];
  noEmail: { name: string; phone: string | null }[];
  ctx: ViewCtx;
  justSent: boolean;
}) {
  const { event: e, message: m, failed, noEmail, ctx, justSent } = opts;
  return layout(
    {
      title: `Sent — ${e.title}`,
      eyebrow: e.title,
      heading: justSent ? 'Your message has been sent' : m.subject,
      back: { href: `/app/events/${e.id}`, label: e.title },
      ...ctx,
    },
    html`
      ${m.sent_count > 0
        ? html`<div class="notice notice-ok" role="status"><p style="margin:0">
            <strong>Sent to ${people(m.sent_count)}</strong>, each as a blind copy, on
            ${sentWhen(m.sent_at)}${m.sent_by_name ? `, by ${m.sent_by_name}` : ''}.
          </p></div>`
        : ''}

      ${failed.length
        ? html`<div class="notice notice-bad" role="alert">
            <p style="margin:0 0 .5rem"><strong>${people(failed.length)} could not be sent to.</strong>
              The address may be wrong or no longer in use. Everybody else was sent it.</p>
            <ul style="margin:0;padding-left:1.2rem">
              ${failed.map((f) => html`<li>${f.name} — ${f.email ?? 'no address'}${f.error ? html` <span style="color:var(--ink-2)">(${f.error})</span>` : ''}</li>`)}
            </ul></div>`
        : ''}

      ${noEmail.length
        ? html`<div class="notice notice-warn"><p style="margin:0 0 .5rem">
              <strong>${people(noEmail.length)} had no email address</strong> and did not get it:
            </p>
            <ul style="margin:0;padding-left:1.2rem">
              ${noEmail.map((b) => html`<li>${b.name}${b.phone ? html` — ${b.phone}` : ''}</li>`)}
            </ul></div>`
        : ''}

      <h2 class="section-h2">What was sent</h2>
      <div class="card">
        <p style="margin-top:0"><strong>${m.subject}</strong></p>
        <div style="white-space:pre-wrap;overflow-wrap:anywhere">${m.body}</div>
      </div>

      <div class="btn-row" style="margin-top:1.5rem">
        <a class="btn-primary" href="/app/events/${e.id}">Back to ${e.title}</a>
        <a class="btn-secondary" href="/app/events/${e.id}/message">Write another message</a>
      </div>
    `,
  );
}

/** What the writing page starts with: a subject and an opening, ready to finish. */
export function starterDraft(e: EventRow, replyTo: string): MessageDraft {
  return {
    subject: `About ${e.title}`,
    body: `Dear all,\n\nThank you for booking for ${e.title} on ${formatWhen(e.starts_at, e.ends_at)}`
      + `${e.location ? `, at ${e.location}` : ''}.\n\n\n\nWith best wishes,\nBream Church`,
    replyTo,
    audience: 'all',
    chosen: [],
  };
}
