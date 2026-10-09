import { addDays, WEEK_DAYS, type Block, type WeekItem } from './store.js';

/**
 * The newsletter as an email: the same HTML is the preview in the office, the
 * test copy, and what goes to every subscriber.
 *
 * Written the way email has to be — tables for layout, every style inline,
 * nothing that needs a stylesheet or a script — because Outlook and Gmail each
 * ignore a different half of modern CSS. 600 pixels wide, the width every
 * mail program handles, and it narrows to fit a phone.
 */

const NAVY = '#324158';
const NAVY_DEEP = '#232f42';
const GOLD = '#c9a94a';
const GOLD_WASH = '#f7f1df';
const INK = '#242a34';
const INK_2 = '#586072';
const PAPER = '#ffffff';
const GROUND = '#f3f1ea';
const FONT = `Georgia, 'Times New Roman', serif`;
const SANS = `'Segoe UI', Helvetica, Arial, sans-serif`;

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Paragraphs from plain text: a blank line starts a new one, a single
 *  newline is a line break, and web addresses become links. */
function paragraphs(text: string, style: string): string {
  return text.trim().split(/\n\s*\n/).filter(Boolean).map((p) => {
    const body = esc(p).replace(/\n/g, '<br>')
      .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:${NAVY}">${u}</a>`);
    return `<p style="${style}">${body}</p>`;
  }).join('\n');
}

const longDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

/** 'Sun 12 – Sat 18 October 2026', for the masthead; the month and year
 *  only once where the week does not need them twice. */
export function weekLabel(from: string): string {
  const to = addDays(from, WEEK_DAYS - 1);
  const part = (d: string, o: Intl.DateTimeFormatOptions) => longDate(d, o);
  const day = (d: string) => `${part(d, { weekday: 'short' })} ${part(d, { day: 'numeric' })}`;
  const month = (d: string) => part(d, { month: 'long' });
  const year = (d: string) => part(d, { year: 'numeric' });
  const end = `${day(to)} ${month(to)} ${year(to)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from)} – ${end}`;
  if (from.slice(0, 4) === to.slice(0, 4)) return `${day(from)} ${month(from)} – ${end}`;
  return `${day(from)} ${month(from)} ${year(from)} – ${end}`;
}

/** '19:00' -> '7pm', '19:30' -> '7.30pm' — how a church noticeboard writes it. */
export function friendlyTime(t: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const mins = m[2];
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (h === 12 && mins === '00') return 'Noon';
  return `${h12}${mins === '00' ? '' : `.${mins}`}${h < 12 ? 'am' : 'pm'}`;
}

export function itemTime(i: WeekItem): string {
  if (!i.time) return '';
  return i.endTime ? `${friendlyTime(i.time)} – ${friendlyTime(i.endTime)}` : friendlyTime(i.time);
}

/** The days of the week ahead that have something on, each with its items. */
export function byDay(items: WeekItem[], from: string): { date: string; label: string; items: WeekItem[] }[] {
  const days: { date: string; label: string; items: WeekItem[] }[] = [];
  for (let n = 0; n < WEEK_DAYS; n++) {
    const date = addDays(from, n);
    const on = items.filter((i) => i.date === date);
    if (on.length) days.push({ date, label: longDate(date, { weekday: 'long', day: 'numeric', month: 'long' }), items: on });
  }
  return days;
}

export interface RenderOpts {
  title: string;
  weekFrom: string;
  blocks: Block[];
  week: WeekItem[];
  /** Where pictures and the logo are fetched from, e.g. 'https://breamchurch.stack66.com'. */
  origin: string;
  /** The reader's own unsubscribe link. Absent in the office preview. */
  unsubscribeUrl?: string;
  /** Shown across the top in the office, never in a sent email. */
  banner?: string;
}

export const imageUrl = (origin: string, key: string) => `${origin}/newsletter/image/${key.replace(/^newsletters\//, '')}`;

function weekHtml(items: WeekItem[], from: string): string {
  const days = byDay(items, from);
  const head = `
    <tr><td style="padding:12px 40px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="border-top:2px solid ${GOLD};padding-top:18px">
          <p style="margin:0;font:700 12px/1 ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${GOLD}">What’s on</p>
          <h2 style="margin:6px 0 4px;font:700 26px/1.2 ${FONT};color:${NAVY}">The week ahead</h2>
          <p style="margin:0 0 6px;font:15px/1.5 ${SANS};color:${INK_2}">${esc(weekLabel(from))}</p>
        </td>
      </tr></table>
    </td></tr>`;
  if (!days.length) {
    return `${head}<tr><td style="padding:8px 40px 20px;font:16px/1.6 ${SANS};color:${INK_2}">
      A quieter week in the diary — do come and join us on Sunday.</td></tr>`;
  }
  return head + days.map((d) => `
    <tr><td style="padding:12px 40px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate">
        <tr><td style="background:${NAVY};border-radius:6px 6px 0 0;padding:9px 16px;font:700 14px/1.2 ${SANS};letter-spacing:.06em;text-transform:uppercase;color:#ffffff">
          ${esc(d.label)}
        </td></tr>
        <tr><td style="background:${GOLD_WASH};border-radius:0 0 6px 6px;padding:6px 16px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${d.items.map((i, n) => `<tr>
              <td valign="top" width="118" style="padding:9px 10px 9px 0;font:700 15px/1.4 ${SANS};color:${NAVY};white-space:nowrap;${n ? `border-top:1px solid #e8dcb8;` : ''}">${esc(itemTime(i)) || '&nbsp;'}</td>
              <td valign="top" style="padding:9px 0;font:16px/1.4 ${SANS};color:${INK};${n ? `border-top:1px solid #e8dcb8;` : ''}">
                <strong>${esc(i.title)}</strong>${i.note ? `<br><span style="font-size:14px;color:${INK_2}">${esc(i.note)}</span>` : ''}
              </td>
            </tr>`).join('')}
          </table>
        </td></tr>
      </table>
    </td></tr>`).join('') + `<tr><td style="height:16px"></td></tr>`;
}

function blockHtml(b: Block, o: RenderOpts): string {
  switch (b.type) {
    case 'heading':
      return b.text.trim() ? `<tr><td style="padding:22px 40px 0">
        <div style="width:44px;height:3px;background:${GOLD};margin:0 0 12px"></div>
        <h2 style="margin:0;font:700 26px/1.25 ${FONT};color:${NAVY}">${esc(b.text)}</h2>
      </td></tr>` : '';
    case 'text':
      return b.text.trim() ? `<tr><td style="padding:10px 40px 4px">
        ${paragraphs(b.text, `margin:0 0 14px;font:17px/1.65 ${SANS};color:${INK}`)}
      </td></tr>` : '';
    case 'quote':
      return b.text.trim() ? `<tr><td style="padding:14px 40px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${GOLD_WASH};border-left:5px solid ${GOLD};border-radius:4px;padding:20px 24px">
            <p style="margin:0;font:italic 21px/1.5 ${FONT};color:${NAVY_DEEP}">“${esc(b.text.trim())}”</p>
            ${b.cite.trim() ? `<p style="margin:10px 0 0;font:700 14px/1.4 ${SANS};letter-spacing:.04em;color:${INK_2}">— ${esc(b.cite.trim())}</p>` : ''}
          </td>
        </tr></table>
      </td></tr>` : '';
    case 'image':
      return b.key ? `<tr><td style="padding:14px 40px 6px">
        <img src="${esc(imageUrl(o.origin, b.key))}" width="520" alt="${esc(b.caption || 'Photograph')}"
             style="display:block;width:100%;max-width:520px;height:auto;border-radius:8px;border:0">
        ${b.caption.trim() ? `<p style="margin:8px 0 0;font:italic 14px/1.5 ${SANS};color:${INK_2};text-align:center">${esc(b.caption)}</p>` : ''}
      </td></tr>` : '';
    case 'week':
      return weekHtml(o.week, o.weekFrom);
  }
}

export function newsletterHtml(o: RenderOpts): string {
  const footer = o.unsubscribeUrl
    ? `You are receiving this because you asked for the Bream Church newsletter.<br>
       <a href="${esc(o.unsubscribeUrl)}" style="color:#ffffff;font-weight:700">Unsubscribe</a> — one click, and your details are deleted.`
    : `Each subscriber’s copy has their own <strong>Unsubscribe</strong> link here.`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${GROUND}">
${o.banner ?? ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${PAPER};border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(36,42,52,.08)">
    <tr><td align="center" style="padding:28px 40px 22px;background:${PAPER}">
      <img src="${esc(o.origin)}/assets/logo-transparent.png" width="190" alt="Bream Church" style="display:block;width:190px;height:auto;border:0">
    </td></tr>
    <tr><td style="background:${NAVY};padding:30px 40px 28px;text-align:center">
      <p style="margin:0;font:700 12px/1 ${SANS};letter-spacing:.24em;text-transform:uppercase;color:${GOLD}">Bream Church newsletter</p>
      <h1 style="margin:12px 0 10px;font:700 34px/1.2 ${FONT};color:#ffffff">${esc(o.title)}</h1>
      <p style="margin:0;font:15px/1.4 ${SANS};color:#d9dfe8">${esc(weekLabel(o.weekFrom))}</p>
    </td></tr>
    <tr><td style="height:5px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr>
    ${o.blocks.map((b) => blockHtml(b, o)).join('\n')}
    <tr><td style="height:26px"></td></tr>
    <tr><td style="background:${NAVY_DEEP};padding:24px 40px;text-align:center;font:13px/1.6 ${SANS};color:#c4ccd8">
      <p style="margin:0 0 6px;font:700 15px/1.4 ${FONT};color:#ffffff">Bream Church — making a difference</p>
      <p style="margin:0">${footer}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** The plain-text part, for mail programs that show only text. */
export function newsletterText(o: RenderOpts): string {
  const lines: string[] = [`BREAM CHURCH NEWSLETTER`, o.title, weekLabel(o.weekFrom), ''];
  for (const b of o.blocks) {
    if (b.type === 'heading' && b.text.trim()) lines.push(b.text.toUpperCase(), '');
    if (b.type === 'text' && b.text.trim()) lines.push(b.text.trim(), '');
    if (b.type === 'quote' && b.text.trim()) lines.push(`"${b.text.trim()}"${b.cite.trim() ? ` — ${b.cite.trim()}` : ''}`, '');
    if (b.type === 'image' && b.key && b.caption.trim()) lines.push(`[Picture: ${b.caption.trim()}]`, '');
    if (b.type === 'week') {
      lines.push('THE WEEK AHEAD', '');
      const days = byDay(o.week, o.weekFrom);
      if (!days.length) lines.push('A quieter week in the diary.', '');
      for (const d of days) {
        lines.push(d.label);
        for (const i of d.items) lines.push(`  ${itemTime(i) ? `${itemTime(i)}  ` : ''}${i.title}${i.note ? ` (${i.note})` : ''}`);
        lines.push('');
      }
    }
  }
  lines.push('A copy is attached as a PDF, for printing.', '');
  if (o.unsubscribeUrl) lines.push(`To unsubscribe and have your details deleted: ${o.unsubscribeUrl}`);
  return lines.join('\n');
}
