import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { linkRow } from './roomRequests.js';
import { searchBox } from './search.js';
import { sentWhen } from './eventMessage.js';
import { byDay, itemTime, weekLabel, imageUrl } from '../newsletter/render.js';
import { CONSENT_TEXT, PENDING_DAYS, type Newsletter, type NewsletterRow, type SubscriberRow,
         type WeekItem } from '../newsletter/store.js';

/**
 * The newsletter, in the Admin Centre: write it, preview it, test it, send
 * it, and keep it. And the three public pages a subscriber ever sees: sign up,
 * confirm, unsubscribe.
 */

const HOME = { href: '/app/settings/newsletter', label: 'Newsletter' };
const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
type Notice = { tone: 'ok' | 'bad' | 'warn'; text: string };
const noticeBox = (n?: Notice) => n
  ? html`<div class="notice notice-${n.tone}" role="${n.tone === 'bad' ? 'alert' : 'status'}"><p style="margin:0">${n.text}</p></div>`
  : '';

/** Why the final Send is not there yet, in words for the office. */
const NOT_SWITCHED_ON = 'Sending newsletters to subscribers is not switched on yet. The church’s '
  + 'current email service is only for booking confirmations, so a newsletter service has to be '
  + 'chosen first. Everything else works: write it, preview it, download the PDF and send yourself '
  + 'a test copy.';

// ---- the newsletter's home ------------------------------------------------------

export function newsletterHomePage(opts: {
  newsletters: NewsletterRow[];
  active: number;
  pending: number;
  signupUrl: string;
  senderReady: boolean;
  ctx: ViewCtx;
  notice?: Notice;
}) {
  const { newsletters, active, pending, signupUrl, senderReady, ctx, notice } = opts;
  const drafts = newsletters.filter((n) => n.status !== 'sent');
  const sent = newsletters.filter((n) => n.status === 'sent');
  return layout(
    {
      title: 'Newsletter', eyebrow: 'Admin Centre', heading: 'Newsletter',
      intro: 'Write the church newsletter, with the week ahead filled in from the diary, and send '
        + 'it to everyone who has signed up.',
      back: { href: '/app/settings', label: 'Admin Centre' }, ...ctx,
    },
    html`
      ${noticeBox(notice)}
      ${!senderReady ? html`<div class="notice notice-warn"><p style="margin:0">${NOT_SWITCHED_ON}</p></div>` : ''}

      <div class="stat-row">
        <div class="stat"><span class="stat-n">${active}</span><span class="stat-l">subscribers</span></div>
        <div class="stat"><span class="stat-n">${drafts.length}</span><span class="stat-l">being written</span></div>
        <div class="stat"><span class="stat-n">${sent.length}</span><span class="stat-l">sent</span></div>
      </div>

      <form method="post" action="/app/settings/newsletter/new" class="btn-row" style="margin-bottom:2rem">
        <button class="btn-primary" type="submit" style="font-size:1.05rem">＋ Create a newsletter</button>
        <a class="btn-secondary" href="/app/settings/newsletter/subscribers">Subscribers (${active})</a>
      </form>

      <h2 class="section-h2">Being written</h2>
      ${drafts.length === 0
        ? html`<div class="card"><p style="margin:0">Nothing in progress. Press <strong>Create a newsletter</strong> to start one.</p></div>`
        : html`<div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))">
            ${drafts.map((n) => html`<a class="card" href="/app/settings/newsletter/${n.id}"
                  style="display:block;text-decoration:none;color:inherit;margin:0">
                <p style="margin:0 0 .35rem">${n.status === 'sending' ? chip('amber', 'Sending — not finished') : chip('navy', 'Draft')}</p>
                <h3 style="margin:0 0 .25rem;text-transform:none;letter-spacing:0;font-size:1.2rem">${n.title}</h3>
                <p style="margin:0;color:var(--ink-2)">Week of ${weekLabel(n.week_from)}<br>
                  Last changed ${sentWhen(n.updated_at)}${n.test_sent_at ? html` · test sent` : ''}</p>
              </a>`)}
          </div>`}

      <h2 class="section-h2">Archive</h2>
      ${sent.length === 0
        ? html`<div class="card"><p style="margin:0">Newsletters appear here once they have been sent.</p></div>`
        : html`<div class="table-scroll"><table class="grid stack">
            <thead><tr><th>Newsletter</th><th>Week</th><th>Sent</th><th class="num">To</th><th></th></tr></thead>
            <tbody>${sent.map((n) => html`<tr>
              <td class="stack-title"><a href="/app/settings/newsletter/${n.id}"><strong>${n.title}</strong></a></td>
              <td data-label="Week">${weekLabel(n.week_from)}</td>
              <td data-label="Sent">${n.sent_at ? sentWhen(n.sent_at) : ''}${n.sent_by_name ? `, by ${n.sent_by_name}` : ''}</td>
              <td class="num" data-label="To">${n.sent_count}</td>
              <td class="stack-actions">
                <a class="linkish" href="/app/settings/newsletter/${n.id}/preview" target="_blank" rel="noopener">View</a>
                <a class="linkish" href="/app/settings/newsletter/${n.id}/newsletter.pdf">PDF</a>
              </td>
            </tr>`)}</tbody>
          </table></div>`}

      <h2 class="section-h2">Sign-up link for the website</h2>
      <div class="card">
        <p style="margin-top:0">
          Put this link on the church website, in the parish magazine or on a poster. People give
          their name and email, agree to the GDPR wording, and then confirm by pressing a button
          in an email we send them — so nobody can be signed up by somebody else.
        </p>
        ${linkRow(signupUrl)}
        ${pending
          ? html`<p style="margin-bottom:0;color:var(--ink-2)">${people(pending)} signed up but ${pending === 1 ? 'has' : 'have'}
              not confirmed yet. Unconfirmed sign-ups are deleted after ${PENDING_DAYS} days.</p>`
          : ''}
      </div>
    `,
  );
}

// ---- writing one -----------------------------------------------------------------

const BLOCK_LABEL: Record<string, string> = {
  heading: 'Headline', text: 'Text', quote: 'Quote or Bible verse', image: 'Picture', week: 'The week ahead',
};

export function newsletterEditPage(opts: {
  n: Newsletter;
  /** The diary's own items for the week, for the Show ticks. */
  diary: WeekItem[];
  origin: string;
  active: number;
  defaultTestTo: string;
  senderReady: boolean;
  ctx: ViewCtx;
  notice?: Notice;
}) {
  const { n, diary, origin, active, defaultTestTo, senderReady, ctx, notice } = opts;
  const id = n.row.id;
  const hidden = new Set(n.hidden);
  const hasWeek = n.blocks.some((b) => b.type === 'week');
  const last = n.blocks.length - 1;

  const controls = (bid: string, i: number) => html`
    <div class="btn-row" style="gap:.4rem">
      <button class="btn-quiet" type="submit" name="do" value="up:${bid}" formnovalidate ${i === 0 ? 'disabled' : ''}
              title="Move up" aria-label="Move up">↑ Up</button>
      <button class="btn-quiet" type="submit" name="do" value="down:${bid}" formnovalidate ${i === last ? 'disabled' : ''}
              title="Move down" aria-label="Move down">↓ Down</button>
      <button class="btn-quiet" type="submit" name="do" value="remove:${bid}" formnovalidate
              style="color:var(--bad)" onclick="return confirm('Take this section out of the newsletter?')">Remove</button>
    </div>`;

  const weekEditor = () => {
    const days = byDay(diary, n.row.week_from);
    return html`
      <p style="margin-top:0;color:var(--ink-2)">
        Filled in from the diary for <strong>${weekLabel(n.row.week_from)}</strong> — services,
        events and room bookings, without saying which room. It keeps itself up to date until the
        newsletter is sent. Private bookings and ones not yet confirmed are never included.
        Untick anything you would rather leave out.
      </p>
      ${days.length === 0
        ? html`<p><em>Nothing in the diary for that week yet.</em></p>`
        : days.map((d) => html`
            <h4 style="margin:1rem 0 .4rem;color:var(--navy)">${d.label}</h4>
            <div class="checks">
              ${d.items.map((it) => html`<label class="check">
                <input type="hidden" name="diary_key" value="${it.key}">
                <input type="checkbox" name="show" value="${it.key}" ${hidden.has(it.key) ? '' : 'checked'}>
                <span><span class="check-label">${it.title}</span>
                  <span class="check-note">${itemTime(it) || 'No set time'}${it.note ? ` · ${it.note}` : ''}</span></span>
              </label>`)}
            </div>`)}

      <h4 style="margin:1.5rem 0 .4rem;color:var(--navy)">Added by you</h4>
      ${n.extra.length === 0
        ? html`<p style="margin-top:0;color:var(--ink-2)">Nothing yet. Add anything that is not in the diary below.</p>`
        : html`<ul style="margin:0 0 1rem;padding-left:1.2rem">
            ${n.extra.map((x) => html`<li style="margin-bottom:.35rem">
              <strong>${x.title}</strong> — ${new Date(`${x.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}${x.time ? `, ${x.time}` : ''}${x.note ? ` · ${x.note}` : ''}
              <button class="linkish" type="submit" name="do" value="remove-item:${x.id}" formnovalidate style="color:var(--bad)">Remove</button>
            </li>`)}
          </ul>`}
      <div class="grid-fields" style="background:var(--navy-wash);padding:1rem;border-radius:var(--radius)">
        <div class="field"><label for="new_title">What is on</label>
          <input id="new_title" name="new_title" type="text" placeholder="e.g. Coffee morning"></div>
        <div class="field"><label for="new_date">Day</label>
          <input id="new_date" name="new_date" type="date" min="${n.row.week_from}"></div>
        <div class="field"><label for="new_time">Time <span style="font-weight:400">(optional)</span></label>
          <input id="new_time" name="new_time" type="time"></div>
        <div class="field"><label for="new_note">A few words <span style="font-weight:400">(optional)</span></label>
          <input id="new_note" name="new_note" type="text" placeholder="e.g. All welcome"></div>
        <div class="field" style="align-self:end">
          <button class="btn-secondary" type="submit" name="do" value="add-item" formnovalidate>Add to the week</button>
        </div>
      </div>`;
  };

  return layout(
    {
      title: `Newsletter — ${n.row.title}`, eyebrow: 'Newsletter', heading: n.row.title,
      headingAside: n.row.status === 'sending' ? 'Sending' : 'Draft',
      back: HOME, ...ctx,
    },
    html`
      ${noticeBox(notice)}

      <form method="post" action="/app/settings/newsletter/${id}/save" enctype="multipart/form-data" id="nl-form">
        <div class="card" style="position:sticky;top:.5rem;z-index:5;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;padding:.75rem 1rem">
          <button class="btn-primary" type="submit" name="do" value="save">Save</button>
          <button class="btn-secondary" type="submit" name="do" value="preview" formtarget="_blank">Preview ↗</button>
          <button class="btn-secondary" type="submit" name="do" value="pdf" formtarget="_blank">Download PDF</button>
          <span style="color:var(--ink-2);font-size:.9375rem">Last saved ${sentWhen(n.row.updated_at)}</span>
        </div>

        <h2 class="section-h2">1. The basics</h2>
        <div class="card">
          <div class="grid-fields">
            <div class="field">
              <label for="title">Title</label>
              <span class="hint">The big heading at the top, and the email’s subject line.</span>
              <input id="title" name="title" type="text" maxlength="120" required value="${n.row.title}">
            </div>
            <div class="field">
              <label for="week_from">The week ahead starts on</label>
              <span class="hint">“The week ahead” shows the seven days from this date.</span>
              <input id="week_from" name="week_from" type="date" required value="${n.row.week_from}">
            </div>
          </div>
        </div>

        <h2 class="section-h2">2. What it says</h2>
        <p style="margin-top:-.5rem;color:var(--ink-2)">
          The logo and title are always at the top. Below them, the sections run in this order —
          move them with ↑ and ↓.
        </p>
        ${n.blocks.map((b, i) => html`
          <div class="card" id="b-${b.id}" style="border-left:5px solid ${b.type === 'week' ? 'var(--gold)' : 'var(--navy)'}">
            <input type="hidden" name="block_id" value="${b.id}">
            <input type="hidden" name="b_${b.id}_type" value="${b.type}">
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem;align-items:center;margin-bottom:.75rem">
              <h3 style="margin:0">${BLOCK_LABEL[b.type]}</h3>
              ${controls(b.id, i)}
            </div>
            ${b.type === 'heading'
              ? html`<input name="b_${b.id}_text" type="text" maxlength="160" value="${b.text}"
                            aria-label="Headline" style="font-size:1.25rem;font-weight:700">`
              : ''}
            ${b.type === 'text'
              ? html`<textarea name="b_${b.id}_text" rows="7" aria-label="Text">${b.text}</textarea>
                  <span class="hint" style="display:block;margin-top:.35rem">Leave a blank line between paragraphs. Web addresses become links.</span>`
              : ''}
            ${b.type === 'quote'
              ? html`<textarea name="b_${b.id}_text" rows="3" aria-label="Quote">${b.text}</textarea>
                  <div class="field" style="margin:.75rem 0 0"><label for="cite-${b.id}">Who said it, or the reference</label>
                    <input id="cite-${b.id}" name="b_${b.id}_cite" type="text" value="${b.cite}" placeholder="e.g. Psalm 23:1"></div>`
              : ''}
            ${b.type === 'image'
              ? html`<input type="hidden" name="b_${b.id}_key" value="${b.key ?? ''}">
                  ${b.key
                    ? html`<img src="${imageUrl(origin, b.key)}" alt="" style="display:block;max-width:100%;max-height:22rem;border-radius:var(--radius);margin-bottom:.75rem">`
                    : html`<p style="margin-top:0" class="notice notice-warn">No picture chosen yet.</p>`}
                  <div class="field"><label for="file-${b.id}">${b.key ? 'Choose a different picture' : 'Choose a picture'}</label>
                    <span class="hint">A JPEG or PNG photo, up to 4MB. It is added when you press Save.</span>
                    <input id="file-${b.id}" name="b_${b.id}_file" type="file" accept="image/jpeg,image/png"></div>
                  <div class="field" style="margin-bottom:0"><label for="cap-${b.id}">Caption <span style="font-weight:400">(optional)</span></label>
                    <input id="cap-${b.id}" name="b_${b.id}_caption" type="text" value="${b.caption}"></div>`
              : ''}
            ${b.type === 'week' ? weekEditor() : ''}
          </div>`)}

        <div class="card" style="background:var(--navy-wash)">
          <h3 style="margin-top:0">Add a section</h3>
          <div class="btn-row">
            <button class="btn-secondary" type="submit" name="do" value="add:heading" formnovalidate>＋ Headline</button>
            <button class="btn-secondary" type="submit" name="do" value="add:text" formnovalidate>＋ Text</button>
            <button class="btn-secondary" type="submit" name="do" value="add:image" formnovalidate>＋ Picture</button>
            <button class="btn-secondary" type="submit" name="do" value="add:quote" formnovalidate>＋ Quote or verse</button>
            ${hasWeek ? '' : html`<button class="btn-secondary" type="submit" name="do" value="add:week" formnovalidate>＋ The week ahead</button>`}
          </div>
        </div>

        <h2 class="section-h2">3. Check it</h2>
        <div class="card">
          <p style="margin-top:0">
            Send yourself a copy to see it exactly as subscribers will, PDF and all. Nobody else
            gets it.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:end">
            <div class="field" style="margin:0;flex:1 1 16rem">
              <label for="test_to">Send a test copy to</label>
              <input id="test_to" name="test_to" type="email" value="${defaultTestTo}">
            </div>
            <button class="btn-secondary" type="submit" name="do" value="test">Send test copy</button>
          </div>
          ${n.row.test_sent_at
            ? html`<p style="margin-bottom:0;color:var(--ink-2)">Last test copy sent to ${n.row.test_sent_to} on ${sentWhen(n.row.test_sent_at)}.</p>`
            : ''}
        </div>

        <h2 class="section-h2">4. Send it</h2>
        <div class="card">
          <p style="margin-top:0">
            When you are happy with it, finalise it. You will be asked once more if you are sure,
            then each of the <strong>${people(active)}</strong> on the list gets their own copy —
            nobody can see anybody else’s address — and the newsletter moves to the archive.
          </p>
          ${!senderReady ? html`<p class="notice notice-warn">${NOT_SWITCHED_ON}</p>` : ''}
          <button class="btn-primary" type="submit" name="do" value="finalise">Finalise and send…</button>
        </div>
      </form>

      <form method="post" action="/app/settings/newsletter/${id}/delete" style="margin-top:2rem"
            onsubmit="return confirm('Delete this draft newsletter? This cannot be undone.')">
        <button class="btn-danger" type="submit">Delete this draft</button>
      </form>
    `,
  );
}

// ---- are you sure? -----------------------------------------------------------------

export function newsletterFinalisePage(opts: {
  n: Newsletter;
  week: WeekItem[];
  active: number;
  senderLabel: string | null;
  ctx: ViewCtx;
}) {
  const { n, week, active, senderLabel, ctx } = opts;
  const id = n.row.id;
  const pictures = n.blocks.filter((b) => b.type === 'image');
  const missing = pictures.filter((b) => b.type === 'image' && !b.key).length;
  const ready = senderLabel != null && active > 0;
  return layout(
    {
      title: `Finalise — ${n.row.title}`, eyebrow: n.row.title, heading: 'Are you sure?',
      intro: 'Once it has gone it cannot be called back. Read it through one last time.',
      back: { href: `/app/settings/newsletter/${id}`, label: 'Back to editing' }, ...ctx,
    },
    html`
      <div class="card" style="border-left:6px solid var(--navy)">
        <p style="margin:0;font-size:1.25rem">This will send <strong>${n.row.title}</strong> to
          <strong>${people(active)}</strong>.</p>
        <p style="margin:.75rem 0 0">🔒 Each person gets their own copy, addressed only to them, with
          their own unsubscribe button. Nobody can see anybody else’s email address.</p>
        <p style="margin:.75rem 0 0">📎 The newsletter is in the email itself, with a PDF copy attached.</p>
      </div>

      <h2 class="section-h2">Checklist</h2>
      <div class="card">
        <ul style="margin:0;padding-left:1.2rem;line-height:1.9">
          <li>${n.row.test_sent_at
            ? html`✅ Test copy sent to ${n.row.test_sent_to}, ${sentWhen(n.row.test_sent_at)}.`
            : html`⚠️ <strong>You have not sent yourself a test copy.</strong> It is worth doing — <a href="/app/settings/newsletter/${id}#test_to">send one first</a>.`}</li>
          <li>📅 The week ahead: ${week.length} ${week.length === 1 ? 'thing' : 'things'} on, ${weekLabel(n.row.week_from)}.</li>
          ${missing ? html`<li>⚠️ ${missing} picture ${missing === 1 ? 'section has' : 'sections have'} no picture chosen, and will be left out.</li>` : ''}
          <li>👀 <a href="/app/settings/newsletter/${id}/preview" target="_blank" rel="noopener">Look at it once more</a>
            or <a href="/app/settings/newsletter/${id}/newsletter.pdf">open the PDF</a>.</li>
        </ul>
      </div>

      ${senderLabel == null ? html`<div class="notice notice-warn" role="alert"><p style="margin:0">${NOT_SWITCHED_ON}</p></div>` : ''}
      ${active === 0 ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">
          There is nobody on the list yet. <a href="/app/settings/newsletter/subscribers">Add subscribers</a> first.</p></div>` : ''}

      <div class="btn-row" style="margin-top:1.5rem">
        <form method="post" action="/app/settings/newsletter/${id}/send" class="inline-form" id="send-form">
          <button class="btn-primary" type="submit" id="send-button" ${ready ? '' : 'disabled'}>
            Yes — finalise and send to ${people(active)}
          </button>
        </form>
        <a class="btn-secondary" href="/app/settings/newsletter/${id}">No — go back and change it</a>
      </div>
      <script>
      document.getElementById('send-form').addEventListener('submit', function () {
        var b = document.getElementById('send-button');
        setTimeout(function () { b.disabled = true; b.textContent = 'Sending…'; }, 0);
      });
      </script>
    `,
  );
}

/** Part-way through: says how far it has got, and carries on by itself. */
export function newsletterSendingPage(opts: { n: Newsletter; done: number; total: number; ctx: ViewCtx }) {
  const { n, done, total, ctx } = opts;
  const pct = total ? Math.round((done / total) * 100) : 100;
  return layout(
    { title: `Sending — ${n.row.title}`, eyebrow: n.row.title, heading: 'Sending…', back: HOME, ...ctx },
    html`
      <div class="card">
        <p style="margin-top:0;font-size:1.2rem"><strong>${done}</strong> of <strong>${total}</strong> sent.
          Please leave this page open until it says it has finished.</p>
        <div style="background:var(--rule);border-radius:99px;height:14px;overflow:hidden">
          <div style="background:var(--navy);height:100%;width:${pct}%"></div>
        </div>
        <form method="post" action="/app/settings/newsletter/${n.row.id}/send" id="go-on" style="margin-top:1rem">
          <button class="btn-secondary" type="submit">Carry on sending</button>
        </form>
      </div>
      <script>setTimeout(function () { document.getElementById('go-on').submit(); }, 800);</script>
    `,
  );
}

/** A sent newsletter, in the archive. */
export function newsletterArchivedPage(opts: {
  n: Newsletter; ctx: ViewCtx; notice?: Notice; remaining: number; failed: number;
}) {
  const { n, ctx, notice, remaining, failed } = opts;
  const id = n.row.id;
  return layout(
    {
      title: `Newsletter — ${n.row.title}`, eyebrow: 'Newsletter archive', heading: n.row.title,
      headingAside: `Week of ${weekLabel(n.row.week_from)}`, back: HOME, ...ctx,
    },
    html`
      ${noticeBox(notice)}
      ${n.row.status === 'sending'
        ? html`<div class="notice notice-warn"><p style="margin:0 0 .5rem">
              Sending stopped part-way: ${remaining} still to go.</p>
            <form method="post" action="/app/settings/newsletter/${id}/send">
              <button class="btn-primary" type="submit">Carry on sending</button></form></div>`
        : ''}
      <div class="stat-row">
        <div class="stat"><span class="stat-n">${n.row.sent_count}</span><span class="stat-l">sent</span></div>
        <div class="stat ${failed ? 'stat-full' : ''}"><span class="stat-n">${failed}</span><span class="stat-l">could not be sent</span></div>
      </div>
      <div class="card">
        <p style="margin-top:0">${n.row.sent_at ? html`Sent ${sentWhen(n.row.sent_at)}${n.row.sent_by_name ? `, by ${n.row.sent_by_name}` : ''}.` : ''}
          It is kept here exactly as it went out.</p>
        <div class="btn-row">
          <a class="btn-primary" href="/app/settings/newsletter/${id}/preview" target="_blank" rel="noopener">View it ↗</a>
          <a class="btn-secondary" href="/app/settings/newsletter/${id}/newsletter.pdf">Download PDF</a>
          <form method="post" action="/app/settings/newsletter/${id}/copy" class="inline-form">
            <button class="btn-secondary" type="submit">Start a new one from this</button>
          </form>
        </div>
      </div>
    `,
  );
}

// ---- subscribers -------------------------------------------------------------------

export function subscribersPage(opts: { rows: SubscriberRow[]; signupUrl: string; ctx: ViewCtx; notice?: Notice; typed?: string }) {
  const { rows, signupUrl, ctx, notice, typed } = opts;
  const active = rows.filter((r) => r.status === 'active');
  const pending = rows.filter((r) => r.status === 'pending');
  const how = (r: SubscriberRow) => r.source === 'form'
    ? `Signed up on the website, ${sentWhen(r.consent_at)}${r.confirmed_at ? `; confirmed ${sentWhen(r.confirmed_at)}` : ''}`
    : `Added by ${r.added_by_name ?? 'the office'}, ${sentWhen(r.consent_at)}`;
  return layout(
    {
      title: 'Newsletter subscribers', eyebrow: 'Newsletter', heading: 'Subscribers',
      intro: 'Everyone the newsletter goes to. Anybody who unsubscribes is deleted from this list straight away.',
      back: HOME, ...ctx,
    },
    html`
      ${noticeBox(notice)}
      <div class="stat-row">
        <div class="stat"><span class="stat-n">${active.length}</span><span class="stat-l">subscribed</span></div>
        <div class="stat"><span class="stat-n">${pending.length}</span><span class="stat-l">not yet confirmed</span></div>
      </div>

      <h2 class="section-h2">Add people</h2>
      <form method="post" action="/app/settings/newsletter/subscribers/add" class="card">
        <div class="field">
          <label for="list">Names and email addresses</label>
          <span class="hint">One person per line, like <code>Jane Smith, jane@example.com</code> — or just
            the email address. You can paste a whole column from a spreadsheet.</span>
          <textarea id="list" name="list" rows="8" required>${typed ?? ''}</textarea>
        </div>
        <label class="check" style="max-width:40rem">
          <input type="checkbox" name="consent" value="1" required>
          <span><span class="check-label">Each of these people has asked to receive the church newsletter</span>
            <span class="check-note">GDPR needs their agreement. This is recorded against each of them, with your name and today’s date.
              For anybody who has not asked, send them the sign-up link instead.</span></span>
        </label>
        <p style="margin-bottom:0;margin-top:1rem"><button class="btn-primary" type="submit">Add to the list</button></p>
      </form>

      <h2 class="section-h2">Or let them sign up themselves</h2>
      <div class="card">${linkRow(signupUrl)}</div>

      <h2 class="section-h2">The list</h2>
      ${rows.length === 0
        ? html`<div class="card"><p style="margin:0">Nobody yet.</p></div>`
        : html`
          ${searchBox({ target: 'subs', label: 'Find somebody', placeholder: 'Name or email…', noun: 'subscribers' })}
          <div class="table-scroll" id="subs"><table class="grid stack">
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>How they joined</th><th></th></tr></thead>
            <tbody>${rows.map((r) => html`<tr data-search="${[r.name, r.email].filter(Boolean).join(' ')}">
              <td class="stack-title"><strong>${r.name ?? '—'}</strong></td>
              <td data-label="Email">${r.email}</td>
              <td data-label="Status">${r.status === 'active' ? chip('green', 'Subscribed') : chip('amber', 'Not confirmed yet')}</td>
              <td data-label="How they joined" style="color:var(--ink-2);font-size:.9375rem">${how(r)}</td>
              <td class="stack-actions">
                <form method="post" action="/app/settings/newsletter/subscribers/${r.id}/remove" class="inline-form"
                      data-confirm="Take ${r.email} off the list? Their details are deleted."
                      onsubmit="return confirm(this.dataset.confirm)">
                  <button class="linkish" type="submit" style="color:var(--bad)">Remove</button>
                </form>
              </td>
            </tr>`)}</tbody>
          </table></div>`}
    `,
  );
}

// ---- the public pages ---------------------------------------------------------------

const publicPage = (heading: string, aside: string, body: ReturnType<typeof html>) => layout(
  { title: 'Bream Church newsletter', chrome: false, eyebrow: 'Bream Church', heading, headingAside: aside },
  html`<div style="max-width:38rem;margin-inline:auto">${body}</div>`,
);

export function signupPage(opts: { error?: string; values?: { name?: string; email?: string }; turnstileSitekey?: string }) {
  const v = opts.values ?? {};
  return publicPage('Our church newsletter', 'Sign up', html`
    ${opts.error ? html`<div class="notice notice-bad" role="alert"><p style="margin:0">${opts.error}</p></div>` : ''}
    <div class="card">
      <p style="margin-top:0;font-size:1.1rem">
        What is on at church, news from our community, and stories to encourage you — straight
        to your inbox, with a printable copy attached.
      </p>
      <form method="post" action="/newsletter">
        <div class="field">
          <label for="name">Your name</label>
          <input id="name" name="name" type="text" autocomplete="name" required maxlength="100" value="${v.name ?? ''}">
        </div>
        <div class="field">
          <label for="email">Your email address</label>
          <input id="email" name="email" type="email" autocomplete="email" required maxlength="200" value="${v.email ?? ''}">
        </div>
        <label class="check" style="margin-bottom:1.15rem">
          <input type="checkbox" name="consent" value="1" required>
          <span><span class="check-label">Yes, please sign me up</span>
            <span class="check-note" style="font-size:.9375rem">${CONSENT_TEXT}</span></span>
        </label>
        ${opts.turnstileSitekey
          ? html`<div class="field">
              <div class="cf-turnstile" data-sitekey="${opts.turnstileSitekey}" data-theme="light" data-action="newsletter"></div>
              <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
            </div>`
          : ''}
        <button class="btn-primary" type="submit">Sign me up</button>
      </form>
    </div>
    <p style="color:var(--ink-2);font-size:.9375rem">
      We will email you a link to confirm. Bream Church never shares your details, and every
      newsletter has a one-click unsubscribe.
    </p>`);
}

export function signupDonePage() {
  return publicPage('Nearly there', 'Check your inbox', html`
    <div class="card">
      <p style="margin-top:0;font-size:1.15rem">
        We have sent you an email. <strong>Press the button in it</strong> to confirm, and you
        will be on the list.
      </p>
      <p style="margin-bottom:0;color:var(--ink-2)">
        Nothing there after a few minutes? Have a look in your junk or spam folder. The link works
        for ${PENDING_DAYS} days.
      </p>
    </div>`);
}

export function confirmPage(state: 'ask' | 'done' | 'already' | 'unknown', token = '') {
  const body = {
    ask: html`<form method="post" action="/newsletter/confirm/${token}" class="card">
        <p style="margin-top:0;font-size:1.15rem">One last step: press the button to confirm you
          would like the Bream Church newsletter.</p>
        <button class="btn-primary" type="submit">Confirm my subscription</button>
      </form>`,
    done: html`<div class="card"><p style="margin:0;font-size:1.15rem">
        <strong>Thank you — you are subscribed.</strong> Your first newsletter will arrive with the next issue.</p></div>`,
    already: html`<div class="card"><p style="margin:0;font-size:1.15rem">You are already subscribed. Thank you!</p></div>`,
    unknown: html`<div class="card"><p style="margin-top:0;font-size:1.15rem">This link has expired or has already been used.</p>
        <p style="margin-bottom:0"><a class="btn-primary" href="/newsletter">Sign up again</a></p></div>`,
  }[state];
  return publicPage('Our church newsletter', state === 'done' ? 'Welcome' : 'Confirm', body);
}

export function unsubscribePage(state: 'ask' | 'done', token = '', email = '') {
  return publicPage('Our church newsletter', 'Unsubscribe', state === 'ask'
    ? html`<form method="post" action="/newsletter/unsubscribe/${token}" class="card">
        <p style="margin-top:0;font-size:1.15rem">Stop sending the Bream Church newsletter to
          <strong>${email}</strong>?</p>
        <p style="color:var(--ink-2)">Your name and email address will be deleted from our list.</p>
        <button class="btn-primary" type="submit">Unsubscribe me</button>
      </form>`
    : html`<div class="card"><p style="margin-top:0;font-size:1.15rem"><strong>You have been unsubscribed</strong>
        and your details deleted from our list.</p>
        <p style="margin-bottom:0;color:var(--ink-2)">Changed your mind? You are always welcome to
          <a href="/newsletter">sign up again</a>.</p></div>`);
}
