import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from 'pdf-lib';
import { printable, wrap } from '../export/pdf.js';
import { byDay, itemTime, weekLabel } from './render.js';
import type { Block, WeekItem } from './store.js';

/**
 * The newsletter as an A4 PDF: attached to every email, for printing, for
 * the noticeboard, and for forwarding to somebody without email at all.
 *
 * Laid out to match the email — a butter-gold rule, the logo, a quiet white
 * masthead, the blocks in order, the week ahead day by day — so the two read as
 * one thing. Gentle on purpose, after breamchurch.org.uk.
 */

const NAVY = rgb(0x32 / 255, 0x41 / 255, 0x58 / 255);
const NAVY_SOFT = rgb(0x47 / 255, 0x58 / 255, 0x7a / 255);
const BUTTER = rgb(0xe8 / 255, 0xd7 / 255, 0x8a / 255);
const BUTTER_WASH = rgb(0xfb / 255, 0xf8 / 255, 0xec / 255);
const BUTTER_LINE = rgb(0xef / 255, 0xe6 / 255, 0xc4 / 255);
const MIST = rgb(0x8b / 255, 0x90 / 255, 0x9a / 255);
const INK = rgb(0x2f / 255, 0x35 / 255, 0x40 / 255);
const INK_2 = rgb(0x5f / 255, 0x66 / 255, 0x75 / 255);

export interface PdfImageSource { bytes: Uint8Array; type: string }

export async function newsletterPdf(o: {
  title: string;
  weekFrom: string;
  blocks: Block[];
  week: WeekItem[];
  logo: Uint8Array | null;
  /** Picture bytes by R2 key. A picture missing here is simply left out. */
  images: Map<string, PdfImageSource>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(printable(o.title));
  pdf.setCreator('Bream Church');
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sansItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const W = 595.28;
  const H = 841.89;
  const M = 50;
  const CW = W - M * 2;
  const BOTTOM = 56;

  let logo: PDFImage | null = null;
  if (o.logo) {
    try { logo = await pdf.embedPng(o.logo); } catch { logo = null; }
  }
  const pictures = new Map<string, PDFImage>();
  for (const b of o.blocks) {
    if (b.type !== 'image' || !b.key) continue;
    const src = o.images.get(b.key);
    if (!src) continue;
    try {
      pictures.set(b.key, src.type === 'image/png' ? await pdf.embedPng(src.bytes) : await pdf.embedJpg(src.bytes));
    } catch { /* a picture that will not embed is left out rather than losing the PDF */ }
  }

  let page!: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];
  const t = (s: string) => printable(s);

  const newPage = (first: boolean) => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    if (first) {
      page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: BUTTER });
      let top = H - 34;
      if (logo) {
        const lw = 150;
        const lh = (logo.height / logo.width) * lw;
        page.drawImage(logo, { x: (W - lw) / 2, y: top - lh, width: lw, height: lh });
        top -= lh + 18;
      }
      centred('NEWSLETTER', top - 10, 8.5, MIST, 2);
      let size = 18;
      const title = t(o.title).toUpperCase();
      while (size > 11 && trackedWidth(title, size, size * 0.12) > CW) size -= 1;
      centred(title, top - 38, size, NAVY, size * 0.12);
      const sub = t(weekLabel(o.weekFrom));
      page.drawText(sub, { x: (W - sans.widthOfTextAtSize(sub, 10.5)) / 2, y: top - 60, size: 10.5, font: sans, color: INK_2 });
      page.drawRectangle({ x: M, y: top - 78, width: CW, height: 0.75, color: BUTTER_LINE });
      y = top - 78 - 22;
    } else {
      page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: BUTTER });
      tracked(t(o.title).toUpperCase(), M, H - 24, 8.5, NAVY, 1.3);
      page.drawRectangle({ x: M, y: H - 32, width: CW, height: 0.75, color: BUTTER_LINE });
      y = H - 32 - 24;
    }
  };
  /** Widely spaced capitals, like the headings on the church website.
   *  pdf-lib has no letter-spacing, so each letter is placed by hand. */
  const trackedWidth = (text: string, size: number, gap: number) =>
    [...text].reduce((w, ch) => w + sansBold.widthOfTextAtSize(ch, size), 0) + gap * (text.length - 1);
  const tracked = (text: string, x: number, yy: number, size: number, color: typeof INK, gap = size * 0.16) => {
    let cx = x;
    for (const ch of text) {
      page.drawText(ch, { x: cx, y: yy, size, font: sansBold, color });
      cx += sansBold.widthOfTextAtSize(ch, size) + gap;
    }
  };
  const centred = (text: string, yy: number, size: number, color: typeof INK, gap = size * 0.16) =>
    tracked(text, (W - trackedWidth(text, size, gap)) / 2, yy, size, color, gap);
  /** Room for `h` more points on this page, or a new page. */
  const need = (h: number) => { if (y - h < BOTTOM) newPage(false); };

  const lines = (text: string, font = sans, size = 11.5, lead = 17, color = INK, width = CW, x = M) => {
    for (const para of text.trim().split(/\n\s*\n/)) {
      for (const l of wrap(para, font, size, width)) {
        need(lead);
        page.drawText(l, { x, y: y - size, size, font, color });
        y -= lead;
      }
      y -= 8;
    }
  };

  newPage(true);

  for (const b of o.blocks) {
    if (b.type === 'heading' && b.text.trim()) {
      need(60);
      y -= 10;
      page.drawRectangle({ x: (W - 34) / 2, y: y - 3, width: 34, height: 2.5, color: BUTTER });
      y -= 16;
      for (const l of wrap(t(b.text).toUpperCase(), sansBold, 14, CW - 60)) {
        need(22);
        centred(l, y - 14, 14, NAVY, 2);
        y -= 22;
      }
      y -= 8;
    } else if (b.type === 'text' && b.text.trim()) {
      lines(b.text);
    } else if (b.type === 'quote' && b.text.trim()) {
      const ql = wrap(`"${b.text.trim()}"`, serifItalic, 15, CW - 44);
      const cite = b.cite.trim() ? t(`- ${b.cite.trim()}`) : '';
      const h = ql.length * 21 + (cite ? 22 : 0) + 30;
      need(Math.min(h, H / 2));
      y -= 6;
      page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: BUTTER_WASH });
      page.drawRectangle({ x: M, y: y - h, width: 3, height: h, color: BUTTER });
      let qy = y - 16;
      for (const l of ql) { page.drawText(l, { x: M + 22, y: qy - 15, size: 15, font: serifItalic, color: NAVY_SOFT }); qy -= 21; }
      if (cite) page.drawText(cite, { x: M + 22, y: qy - 14, size: 10, font: sansBold, color: INK_2 });
      y -= h + 16;
    } else if (b.type === 'image' && b.key && pictures.has(b.key)) {
      const img = pictures.get(b.key)!;
      let w = CW;
      let h = (img.height / img.width) * w;
      const maxH = H * 0.42;
      if (h > maxH) { h = maxH; w = (img.width / img.height) * h; }
      const capLines = b.caption.trim() ? wrap(b.caption, sansItalic, 10, CW) : [];
      need(h + 14 + capLines.length * 14);
      y -= 4;
      page.drawImage(img, { x: M + (CW - w) / 2, y: y - h, width: w, height: h });
      y -= h + 8;
      for (const l of capLines) {
        page.drawText(l, { x: M + (CW - sansItalic.widthOfTextAtSize(l, 10)) / 2, y: y - 10, size: 10, font: sansItalic, color: INK_2 });
        y -= 14;
      }
      y -= 12;
    } else if (b.type === 'week') {
      need(90);
      y -= 4;
      page.drawRectangle({ x: (W - 34) / 2, y: y - 3, width: 34, height: 2.5, color: BUTTER });
      y -= 18;
      centred("WHAT'S ON", y - 8.5, 8.5, MIST, 1.6);
      y -= 18;
      centred('THE WEEK AHEAD', y - 14, 14, NAVY, 2);
      y -= 22;
      const wk = t(weekLabel(o.weekFrom));
      page.drawText(wk, { x: (W - sans.widthOfTextAtSize(wk, 10.5)) / 2, y: y - 10.5, size: 10.5, font: sans, color: INK_2 });
      y -= 26;
      const days = byDay(o.week, o.weekFrom);
      if (!days.length) {
        lines('A quieter week in the diary - do come and join us on Sunday.', sans, 11.5, 17, INK_2);
      }
      const TIME_W = 92;
      for (const d of days) {
        const rows = d.items.map((i) => ({
          time: t(itemTime(i)),
          title: wrap(i.title, sansBold, 11, CW - TIME_W - 28),
          note: i.note ? wrap(i.note, sans, 9.5, CW - TIME_W - 28) : [],
        }));
        const rowH = (r: typeof rows[number]) => r.title.length * 14 + r.note.length * 12.5 + 10;
        // The day's bar and at least its first item together, never a bar
        // stranded at the foot of a page.
        need(24 + (rows[0] ? rowH(rows[0]) : 0) + 8);
        page.drawRectangle({ x: M, y: y - 22, width: CW, height: 22, color: BUTTER_WASH });
        page.drawRectangle({ x: M, y: y - 22, width: CW, height: 1.5, color: BUTTER });
        tracked(t(d.label.toUpperCase()), M + 12, y - 15, 8.5, NAVY, 1.2);
        y -= 22;
        rows.forEach((r, n) => {
          const h = rowH(r);
          if (y - h < BOTTOM) {
            newPage(false);
            page.drawRectangle({ x: M, y: y - 22, width: CW, height: 22, color: BUTTER_WASH });
            page.drawRectangle({ x: M, y: y - 22, width: CW, height: 1.5, color: BUTTER });
            tracked(t(`${d.label.toUpperCase()} (CONTINUED)`), M + 12, y - 15, 8.5, NAVY, 1.2);
            y -= 22;
          }
          if (n > 0) page.drawRectangle({ x: M + 12, y: y - 0.5, width: CW - 24, height: 0.75, color: BUTTER_LINE });
          page.drawText(r.time, { x: M + 12, y: y - 16, size: 10.5, font: sansBold, color: NAVY_SOFT });
          let ry = y - 5;
          for (const l of r.title) { page.drawText(l, { x: M + 12 + TIME_W, y: ry - 11, size: 11, font: sansBold, color: INK }); ry -= 14; }
          for (const l of r.note) { page.drawText(l, { x: M + 12 + TIME_W, y: ry - 10, size: 9.5, font: sans, color: INK_2 }); ry -= 12.5; }
          y -= h;
        });
        y -= 12;
      }
    }
  }

  pages.forEach((p, i) => {
    p.drawRectangle({ x: M, y: 38, width: W - M * 2, height: 0.75, color: BUTTER_LINE });
    p.drawText('Bream Church - making a difference', { x: M, y: 24, size: 8.5, font: sans, color: INK_2 });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - sans.widthOfTextAtSize(n, 8.5), y: 24, size: 8.5, font: sans, color: INK_2 });
  });

  return pdf.save();
}
