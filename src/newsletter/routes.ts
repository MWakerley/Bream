import type { Context, Hono } from 'hono';
import type { Env, SessionPerson } from '../db.js';
import type { ViewCtx } from '../views/layout.js';
import { usableEmail } from '../email.js';
import { newSessionId } from '../auth.js';
import { verifyTurnstile } from '../turnstile.js';
import { londonToday } from '../views/calendar.js';
import {
  newsletterHomePage, newsletterEditPage, newsletterFinalisePage, newsletterSendingPage,
  newsletterArchivedPage, subscribersPage, signupPage, signupDonePage, confirmPage, unsubscribePage,
} from '../views/newsletter.js';
import {
  addByOffice, addDays, confirmSubscriber, countActive, diaryWeek, getNewsletter,
  listNewsletters, listSubscribers, newId, parseSubscriberList, saveNewsletter, signUp, starterBlocks,
  subscriberByToken, unsubscribe, weekFor, weekShown, WEEK_DAYS,
  type Block, type ExtraItem, type Newsletter,
} from './store.js';
import { newsletterHtml, newsletterText, esc } from './render.js';
import { newsletterPdf, type PdfImageSource } from './pdf.js';
import { newsletterSender, testSender, SEND_BATCH } from './send.js';

/**
 * The newsletter's routes: the Admin Centre pages under /app/settings/newsletter
 * (behind sign-in and the Admin Centre right, like everything under
 * /app/settings), and the public ones under /newsletter.
 */

type AppEnv = { Bindings: Env; Variables: { person: SessionPerson; areas: Set<string> } };
type C = Context<AppEnv>;

const BASE = '/app/settings/newsletter';
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const IMAGE_MAX = 4 * 1024 * 1024;
/** Pictures are kept under the newsletter they were added to. A copy of an
 *  old newsletter points at the same files, so pictures are never deleted
 *  when a draft changes — they may be in the archive too. */
const IMAGE_KEY = /^newsletters\/\d+\/[A-Za-z0-9_-]+\.(jpg|png)$/;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const origin = (c: C) => new URL(c.req.url).origin;

/** The coming Sunday, or today if it is one: where a church week starts. */
function nextSunday(): string {
  const today = londonToday();
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, dow === 0 ? 0 : 7 - dow);
}

/** Notices carried across a redirect, so a reload never repeats an action. */
const NOTICES: Record<string, { tone: 'ok' | 'bad' | 'warn'; text: string }> = {
  saved: { tone: 'ok', text: 'Saved.' },
  test: { tone: 'ok', text: 'Test copy sent. Have a look in your inbox — it may take a minute.' },
  sent: { tone: 'ok', text: 'Sent, and filed in the archive.' },
  deleted: { tone: 'ok', text: 'Draft deleted.' },
  removed: { tone: 'ok', text: 'Removed, and their details deleted.' },
};
function noticeFrom(c: C) {
  const e = c.req.query('e');
  if (e) return { tone: 'bad' as const, text: e.slice(0, 500) };
  return NOTICES[c.req.query('n') ?? ''];
}
const back = (path: string, n?: string, e?: string, anchor = '') => {
  const q = new URLSearchParams();
  if (n) q.set('n', n);
  if (e) q.set('e', e);
  const qs = q.toString();
  return `${path}${qs ? `?${qs}` : ''}${anchor}`;
};

async function myEmail(c: C): Promise<string> {
  const r = await c.env.DB.prepare('SELECT email FROM people WHERE id = ?1')
    .bind(c.get('person').id).first<{ email: string | null }>();
  return r?.email ?? '';
}

/** The email and its PDF, for one newsletter. The HTML is made per reader,
 *  because each has their own unsubscribe link; the PDF once. */
async function buildPieces(c: C, n: Newsletter) {
  const week = await weekShown(c.env.DB, n);
  const base = { title: n.row.title, weekFrom: n.row.week_from, blocks: n.blocks, week, origin: origin(c) };

  let logo: Uint8Array | null = null;
  try {
    const r = await c.env.ASSETS.fetch(new Request(`${origin(c)}/assets/logo-transparent.png`));
    if (r.ok) logo = new Uint8Array(await r.arrayBuffer());
  } catch { logo = null; }
  const images = new Map<string, PdfImageSource>();
  for (const b of n.blocks) {
    if (b.type !== 'image' || !b.key || images.has(b.key)) continue;
    const obj = await c.env.IMAGES.get(b.key);
    if (obj) images.set(b.key, { bytes: new Uint8Array(await obj.arrayBuffer()), type: b.key.endsWith('.png') ? 'image/png' : 'image/jpeg' });
  }
  const pdf = await newsletterPdf({ ...base, logo, images });
  const filename = `bream-church-newsletter-${n.row.week_from}.pdf`;
  return { base, week, pdf, filename };
}

export function registerNewsletter(app: Hono<AppEnv>, viewCtx: (c: C) => ViewCtx) {
  const senderReady = (c: C) => newsletterSender(c.env) != null;
  const signupUrl = (c: C) => `${origin(c)}/newsletter`;

  // ---- the Admin Centre --------------------------------------------------------------

  app.get(BASE, async (c) => {
    const subs = await listSubscribers(c.env.DB);
    return c.html(newsletterHomePage({
      newsletters: await listNewsletters(c.env.DB),
      active: subs.filter((s) => s.status === 'active').length,
      pending: subs.filter((s) => s.status === 'pending').length,
      signupUrl: signupUrl(c), senderReady: senderReady(c), ctx: viewCtx(c), notice: noticeFrom(c),
    }));
  });

  app.post(`${BASE}/new`, async (c) => {
    const r = await c.env.DB.prepare(
      `INSERT INTO newsletters (title, week_from, blocks, created_by) VALUES (?1, ?2, ?3, ?4)`,
    ).bind('This week at Bream Church', nextSunday(), JSON.stringify(starterBlocks()), c.get('person').id).run();
    return c.redirect(`${BASE}/${r.meta.last_row_id}`, 303);
  });

  // Subscribers before /:id, so 'subscribers' is never read as an id.
  app.get(`${BASE}/subscribers`, async (c) => c.html(subscribersPage({
    rows: await listSubscribers(c.env.DB), signupUrl: signupUrl(c), ctx: viewCtx(c), notice: noticeFrom(c),
  })));

  app.post(`${BASE}/subscribers/add`, async (c) => {
    const form = await c.req.formData();
    const typed = String(form.get('list') ?? '');
    const redo = async (text: string) => c.html(subscribersPage({
      rows: await listSubscribers(c.env.DB), signupUrl: signupUrl(c), ctx: viewCtx(c), typed,
      notice: { tone: 'bad', text },
    }), 400);
    if (!form.get('consent')) return redo('Tick the box to confirm these people have asked for the newsletter.');
    const list = parseSubscriberList(typed);
    if (!list.length) return redo('No email addresses found. Put one person on each line.');
    const r = await addByOffice(c.env.DB, list, c.get('person').id);
    const text = `${r.added} added to the list.${r.already ? ` ${r.already} ${r.already === 1 ? 'was' : 'were'} already on it.` : ''}`;
    return c.html(subscribersPage({
      rows: await listSubscribers(c.env.DB), signupUrl: signupUrl(c), ctx: viewCtx(c), notice: { tone: 'ok', text },
    }));
  });

  app.post(`${BASE}/subscribers/:sid/remove`, async (c) => {
    const sid = Number(c.req.param('sid'));
    if (Number.isInteger(sid)) await c.env.DB.prepare('DELETE FROM newsletter_subscribers WHERE id = ?1').bind(sid).run();
    return c.redirect(back(`${BASE}/subscribers`, 'removed'), 303);
  });

  const load = async (c: C) => {
    const id = Number(c.req.param('id'));
    return Number.isInteger(id) ? getNewsletter(c.env.DB, id) : null;
  };

  app.get(`${BASE}/:id`, async (c) => {
    const n = await load(c);
    if (!n) return c.notFound();
    if (n.row.status !== 'draft') {
      const counts = await c.env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM newsletter_deliveries WHERE newsletter_id = ?1 AND status = 'failed') AS failed,
           (SELECT COUNT(*) FROM newsletter_subscribers s WHERE s.status = 'active' AND NOT EXISTS
              (SELECT 1 FROM newsletter_deliveries d WHERE d.newsletter_id = ?1 AND d.subscriber_id = s.id)) AS remaining`,
      ).bind(n.row.id).first<{ failed: number; remaining: number }>();
      return c.html(newsletterArchivedPage({
        n, ctx: viewCtx(c), notice: noticeFrom(c), failed: counts?.failed ?? 0, remaining: counts?.remaining ?? 0,
      }));
    }
    return c.html(newsletterEditPage({
      n, diary: await diaryWeek(c.env.DB, n.row.week_from), origin: origin(c),
      active: await countActive(c.env.DB), defaultTestTo: await myEmail(c),
      senderReady: senderReady(c), ctx: viewCtx(c), notice: noticeFrom(c),
    }));
  });

  /**
   * Every button on the writing page comes here. Whatever was typed is saved
   * first, then the button's own job is done — so moving a section, adding a
   * picture or sending a test never loses an edit.
   */
  app.post(`${BASE}/:id/save`, async (c) => {
    const n = await load(c);
    if (!n) return c.notFound();
    const id = n.row.id;
    if (n.row.status !== 'draft') return c.redirect(`${BASE}/${id}`, 303);
    const form = await c.req.formData();
    const act = String(form.get('do') ?? 'save');
    const problems: string[] = [];

    // The sections, in the order the page has them.
    const ids = form.getAll('block_id').map(String);
    let blocks: Block[] = ids.length ? [] : n.blocks;
    for (const bid of ids) {
      const v = (k: string) => String(form.get(`b_${bid}_${k}`) ?? '').replace(/\r\n/g, '\n');
      switch (v('type')) {
        case 'heading': blocks.push({ id: bid, type: 'heading', text: v('text').trim().slice(0, 160) }); break;
        case 'text': blocks.push({ id: bid, type: 'text', text: v('text').trim().slice(0, 20000) }); break;
        case 'quote': blocks.push({ id: bid, type: 'quote', text: v('text').trim().slice(0, 1000), cite: v('cite').trim().slice(0, 160) }); break;
        case 'week': blocks.push({ id: bid, type: 'week' }); break;
        case 'image': {
          let key: string | null = IMAGE_KEY.test(v('key')) ? v('key') : null;
          const file = form.get(`b_${bid}_file`);
          if (file && typeof file !== 'string' && file.size > 0) {
            const ext = IMAGE_TYPES[file.type];
            if (!ext) problems.push(`“${file.name}” is not a JPEG or PNG photo, so it was not added.`);
            else if (file.size > IMAGE_MAX) problems.push(`“${file.name}” is larger than 4MB, so it was not added. Try a smaller copy.`);
            else {
              key = `newsletters/${id}/${newSessionId().slice(0, 16)}.${ext}`;
              await c.env.IMAGES.put(key, file.stream(), {
                httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
              });
            }
          }
          blocks.push({ id: bid, type: 'image', key, caption: v('caption').trim().slice(0, 300) });
          break;
        }
      }
    }

    const titleIn = String(form.get('title') ?? '').trim().slice(0, 120);
    const title = titleIn || n.row.title;
    const weekIn = String(form.get('week_from') ?? '');
    const week_from = isDate(weekIn) ? weekIn : n.row.week_from;

    // Diary items unticked on the page join those taken out before.
    const diaryKeys = form.getAll('diary_key').map(String);
    const shown = new Set(form.getAll('show').map(String));
    const hidden = [...n.hidden.filter((k) => !diaryKeys.includes(k)), ...diaryKeys.filter((k) => !shown.has(k))];
    let extra: ExtraItem[] = n.extra;

    // The button's own job.
    let anchor = '';
    const [verb, arg] = act.split(/:(.*)/s) as [string, string | undefined];
    const at = blocks.findIndex((b) => b.id === arg);
    if (verb === 'add' && arg) {
      const nb: Block | null = arg === 'heading' ? { id: newId(), type: 'heading', text: '' }
        : arg === 'text' ? { id: newId(), type: 'text', text: '' }
        : arg === 'quote' ? { id: newId(), type: 'quote', text: '', cite: '' }
        : arg === 'image' ? { id: newId(), type: 'image', key: null, caption: '' }
        : arg === 'week' && !blocks.some((b) => b.type === 'week') ? { id: newId(), type: 'week' } : null;
      if (nb) { blocks.push(nb); anchor = `#b-${nb.id}`; }
    } else if ((verb === 'up' || verb === 'down') && at >= 0) {
      const to = verb === 'up' ? at - 1 : at + 1;
      if (to >= 0 && to < blocks.length) {
        [blocks[at], blocks[to]] = [blocks[to]!, blocks[at]!];
        anchor = `#b-${arg}`;
      }
    } else if (verb === 'remove' && at >= 0) {
      blocks = blocks.filter((b) => b.id !== arg);
    } else if (verb === 'add-item') {
      const t = String(form.get('new_title') ?? '').trim().slice(0, 160);
      const d = String(form.get('new_date') ?? '');
      const time = String(form.get('new_time') ?? '');
      if (!t) problems.push('Say what is on before pressing “Add to the week”.');
      else if (!isDate(d) || d < week_from || d >= addDays(week_from, WEEK_DAYS)) {
        problems.push(`Choose a day in the week ahead — between ${week_from} and ${addDays(week_from, WEEK_DAYS - 1)}.`);
      } else {
        extra = [...extra, { id: newId(), date: d, time: /^\d{2}:\d{2}$/.test(time) ? time : '', title: t,
          note: String(form.get('new_note') ?? '').trim().slice(0, 200) }];
      }
      const wk = blocks.find((b) => b.type === 'week');
      if (wk) anchor = `#b-${wk.id}`;
    } else if (verb === 'remove-item' && arg) {
      extra = extra.filter((x) => x.id !== arg);
      const wk = blocks.find((b) => b.type === 'week');
      if (wk) anchor = `#b-${wk.id}`;
    }

    await saveNewsletter(c.env.DB, id, { title, week_from, blocks, extra, hidden });
    const err = problems.join(' ') || undefined;

    if (act === 'preview') return c.redirect(`${BASE}/${id}/preview`, 303);
    if (act === 'pdf') return c.redirect(`${BASE}/${id}/newsletter.pdf`, 303);
    if (act === 'finalise' && !err) return c.redirect(`${BASE}/${id}/finalise`, 303);
    if (act === 'test') {
      const to = usableEmail(String(form.get('test_to') ?? ''));
      if (!to) return c.redirect(back(`${BASE}/${id}`, undefined, 'Put in the email address to send the test copy to.', '#test_to'), 303);
      const sender = testSender(c.env);
      if (!sender) return c.redirect(back(`${BASE}/${id}`, undefined, 'Email sending is not set up, so no test copy can be sent.'), 303);
      const saved = (await getNewsletter(c.env.DB, id))!;
      const p = await buildPieces(c, saved);
      try {
        await sender.send({
          to, subject: `[Test] ${saved.row.title}`,
          html: newsletterHtml(p.base), text: newsletterText(p.base),
          pdf: { bytes: p.pdf, filename: p.filename },
        });
      } catch (e) {
        return c.redirect(back(`${BASE}/${id}`, undefined, `The test copy could not be sent: ${e instanceof Error ? e.message : String(e)}`), 303);
      }
      await c.env.DB.prepare(`UPDATE newsletters SET test_sent_at = datetime('now'), test_sent_to = ?2 WHERE id = ?1`)
        .bind(id, to).run();
      return c.redirect(back(`${BASE}/${id}`, err ? undefined : 'test', err), 303);
    }
    return c.redirect(back(`${BASE}/${id}`, err ? undefined : 'saved', err, anchor), 303);
  });

  app.get(`${BASE}/:id/preview`, async (c) => {
    const n = await load(c);
    if (!n) return c.notFound();
    const p = await buildPieces(c, n);
    const editing = n.row.status === 'draft';
    const banner = `<div style="position:sticky;top:0;z-index:10;background:#232f42;color:#fff;font:15px/1.4 'Segoe UI',Helvetica,Arial,sans-serif;padding:12px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center">
      <strong>${editing ? 'Preview — this is how it will look in an inbox.' : 'As it was sent.'}</strong>
      <a href="${BASE}/${n.row.id}" style="color:#c9a94a;font-weight:700">${editing ? 'Back to editing' : 'Back'}</a>
      <a href="${BASE}/${n.row.id}/newsletter.pdf" style="color:#c9a94a;font-weight:700">Download PDF</a></div>`;
    return c.html(newsletterHtml({ ...p.base, banner }));
  });

  app.get(`${BASE}/:id/newsletter.pdf`, async (c) => {
    const n = await load(c);
    if (!n) return c.notFound();
    const p = await buildPieces(c, n);
    return new Response(p.pdf, { headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${p.filename}"`,
      'cache-control': 'no-store',
    } });
  });

  app.get(`${BASE}/:id/finalise`, async (c) => {
    const n = await load(c);
    if (!n) return c.notFound();
    if (n.row.status !== 'draft') return c.redirect(`${BASE}/${n.row.id}`, 303);
    return c.html(newsletterFinalisePage({
      n, week: await weekShown(c.env.DB, n), active: await countActive(c.env.DB),
      senderLabel: newsletterSender(c.env)?.label ?? null, ctx: viewCtx(c),
    }));
  });

  /**
   * Finalise, then send. The first press freezes the week ahead as it stands
   * and marks the newsletter as going out, so it can no longer be changed.
   * Each press then sends up to SEND_BATCH copies — one per person, to them
   * alone — and the page presses again by itself until everyone has theirs.
   */
  app.post(`${BASE}/:id/send`, async (c) => {
    let n = await load(c);
    if (!n) return c.notFound();
    const id = n.row.id;
    if (n.row.status === 'sent') return c.redirect(`${BASE}/${id}`, 303);
    const sender = newsletterSender(c.env);
    if (!sender) return c.redirect(`${BASE}/${id}/finalise`, 303);

    if (n.row.status === 'draft') {
      if ((await countActive(c.env.DB)) === 0) return c.redirect(`${BASE}/${id}/finalise`, 303);
      const week = weekFor(n, await diaryWeek(c.env.DB, n.row.week_from));
      await c.env.DB.prepare(
        `UPDATE newsletters SET status = 'sending', week_snapshot = ?2, sent_at = datetime('now'), sent_by = ?3
          WHERE id = ?1 AND status = 'draft'`,
      ).bind(id, JSON.stringify(week), c.get('person').id).run();
      n = (await getNewsletter(c.env.DB, id))!;
    }

    const finish = async () => {
      await c.env.DB.prepare(
        `UPDATE newsletters SET status = 'sent',
           sent_count = (SELECT COUNT(*) FROM newsletter_deliveries WHERE newsletter_id = ?1 AND status = 'sent'),
           failed_count = (SELECT COUNT(*) FROM newsletter_deliveries WHERE newsletter_id = ?1 AND status = 'failed')
         WHERE id = ?1`,
      ).bind(id).run();
      return c.redirect(back(`${BASE}/${id}`, 'sent'), 303);
    };
    const notYet = async (limit: number) => (await c.env.DB.prepare(
      `SELECT s.id, s.email, s.token FROM newsletter_subscribers s
        WHERE s.status = 'active' AND NOT EXISTS
          (SELECT 1 FROM newsletter_deliveries d WHERE d.newsletter_id = ?1 AND d.subscriber_id = s.id)
        ORDER BY s.id LIMIT ?2`,
    ).bind(id, limit).all<{ id: number; email: string; token: string }>()).results;

    const batch = await notYet(SEND_BATCH);
    if (!batch.length) return finish();

    const p = await buildPieces(c, n);
    for (const s of batch) {
      const unsubscribeUrl = `${origin(c)}/newsletter/unsubscribe/${s.token}`;
      const o = { ...p.base, unsubscribeUrl };
      let status = 'sent';
      let error: string | null = null;
      try {
        await sender.send({ to: s.email, subject: n.row.title, html: newsletterHtml(o), text: newsletterText(o),
          unsubscribeUrl, pdf: { bytes: p.pdf, filename: p.filename } });
      } catch (e) {
        status = 'failed';
        error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        console.error('newsletter copy not sent', { newsletter: id, subscriber: s.id, error });
      }
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO newsletter_deliveries (newsletter_id, subscriber_id, status, error) VALUES (?1, ?2, ?3, ?4)`,
      ).bind(id, s.id, status, error).run();
    }

    const left = (await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM newsletter_subscribers s WHERE s.status = 'active' AND NOT EXISTS
         (SELECT 1 FROM newsletter_deliveries d WHERE d.newsletter_id = ?1 AND d.subscriber_id = s.id)`,
    ).bind(id).first<{ n: number }>())?.n ?? 0;
    if (left === 0) return finish();
    const done = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM newsletter_deliveries WHERE newsletter_id = ?1')
      .bind(id).first<{ n: number }>())?.n ?? 0;
    return c.html(newsletterSendingPage({ n, done, total: done + left, ctx: viewCtx(c) }));
  });

  app.post(`${BASE}/:id/copy`, async (c) => {
    const n = await load(c);
    if (!n) return c.notFound();
    const blocks = n.blocks.map((b) => ({ ...b, id: newId() }));
    const r = await c.env.DB.prepare(
      `INSERT INTO newsletters (title, week_from, blocks, created_by) VALUES (?1, ?2, ?3, ?4)`,
    ).bind(n.row.title, nextSunday(), JSON.stringify(blocks), c.get('person').id).run();
    return c.redirect(`${BASE}/${r.meta.last_row_id}`, 303);
  });

  app.post(`${BASE}/:id/delete`, async (c) => {
    const id = Number(c.req.param('id'));
    if (Number.isInteger(id)) await c.env.DB.prepare(`DELETE FROM newsletters WHERE id = ?1 AND status = 'draft'`).bind(id).run();
    return c.redirect(back(BASE, 'deleted'), 303);
  });

  // ---- public ---------------------------------------------------------------------

  app.get('/newsletter', (c) => c.html(signupPage({ turnstileSitekey: c.env.TURNSTILE_SITEKEY })));

  app.post('/newsletter', async (c) => {
    const form = await c.req.formData();
    const name = String(form.get('name') ?? '').trim().slice(0, 100);
    const emailIn = String(form.get('email') ?? '').trim().slice(0, 200);
    const values = { name, email: emailIn };
    const refuse = (error: string) => c.html(signupPage({ error, values, turnstileSitekey: c.env.TURNSTILE_SITEKEY }), 400);
    if (!name) return refuse('Please put in your name.');
    const email = usableEmail(emailIn);
    if (!email) return refuse('That does not look like an email address. Please check it.');
    if (!form.get('consent')) return refuse('Please tick the box to say you would like the newsletter.');
    const human = await verifyTurnstile(c.env, String(form.get('cf-turnstile-response') ?? ''),
      c.req.header('CF-Connecting-IP'), 'Sign me up');
    if (!human.ok) return refuse(human.error);
    if (!c.env.EMAIL || !c.env.ACK_FROM) {
      return refuse('Sorry — signing up is not working at the moment. Please try again later, or ask at church.');
    }

    const outcome = await signUp(c.env.DB, email, name);
    if (outcome.kind === 'confirm') {
      const link = `${origin(c)}/newsletter/confirm/${outcome.token}`;
      try {
        await c.env.EMAIL.send({
          to: email,
          from: { email: c.env.ACK_FROM, name: 'Bream Church' },
          subject: 'Please confirm: Bream Church newsletter',
          text: `Dear ${name},\n\nThank you for signing up for the Bream Church newsletter. To confirm, open this link:\n\n${link}\n\nIf you did not ask for this, ignore this email and nothing more will happen; your details will be deleted within a week.\n\nBream Church`,
          html: `<div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#242a34;max-width:520px">
            <p>Dear ${esc(name)},</p>
            <p>Thank you for signing up for the Bream Church newsletter. Please press the button to confirm.</p>
            <p style="margin:28px 0"><a href="${esc(link)}" style="background:#324158;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:6px;display:inline-block">Confirm my subscription</a></p>
            <p style="color:#586072;font-size:14px">If you did not ask for this, ignore this email and nothing more will happen; your details will be deleted within a week.</p>
            <p>Bream Church</p></div>`,
        });
      } catch (e) {
        console.error('newsletter confirm email not sent', { error: String(e) });
      }
    }
    // The same page whatever happened, so the form says nothing about who is on the list.
    return c.html(signupDonePage());
  });

  // A link opened by a mail program's scanner must not confirm or unsubscribe
  // anybody, so the link shows a page and the button on it does the work.
  app.get('/newsletter/confirm/:token', async (c) => {
    const s = await subscriberByToken(c.env.DB, c.req.param('token'));
    return c.html(confirmPage(!s ? 'unknown' : s.status === 'active' ? 'already' : 'ask', c.req.param('token')));
  });
  app.post('/newsletter/confirm/:token', async (c) => {
    const s = await subscriberByToken(c.env.DB, c.req.param('token'));
    if (!s) return c.html(confirmPage('unknown'), 404);
    if (s.status === 'active') return c.html(confirmPage('already'));
    await confirmSubscriber(c.env.DB, c.req.param('token'));
    return c.html(confirmPage('done'));
  });

  app.get('/newsletter/unsubscribe/:token', async (c) => {
    const s = await subscriberByToken(c.env.DB, c.req.param('token'));
    // Somebody already gone is told they are gone, not that the link is bad.
    return c.html(s ? unsubscribePage('ask', c.req.param('token'), s.email) : unsubscribePage('done'));
  });
  // The page's button, and the one-click Unsubscribe that Gmail and Apple Mail
  // post to straight from the inbox (List-Unsubscribe-Post). Either way: gone.
  app.post('/newsletter/unsubscribe/:token', async (c) => {
    await unsubscribe(c.env.DB, c.req.param('token'));
    return c.html(unsubscribePage('done'));
  });

  // Pictures in newsletters, for the email to load. Public, as the newsletter is.
  app.get('/newsletter/image/:nid/:file', async (c) => {
    const key = `newsletters/${c.req.param('nid')}/${c.req.param('file')}`;
    if (!IMAGE_KEY.test(key)) return c.notFound();
    const obj = await c.env.IMAGES.get(key);
    if (!obj) return c.notFound();
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(obj.body, { headers });
  });

}
