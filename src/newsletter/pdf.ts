import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from 'pdf-lib';
import { printable, wrap } from '../export/pdf.js';
import { byDay, itemTime, weekLabel } from './render.js';
import type { Block, WeekItem } from './store.js';

/**
 * The newsletter as an A4 PDF: attached to every email, for printing, for
 * the noticeboard, and for forwarding to somebody without email at all.
 *
 * Laid out to match the email — logo, navy masthead with a gold rule, the
 * blocks in order, the week ahead day by day — so the two read as one thing.
 */

const NAVY = rgb(0x32 / 255, 0x41 / 255, 0x58 / 255);
const NAVY_DEEP = rgb(0x23 / 255, 0x2f / 255, 0x42 / 255);
const GOLD = rgb(0xc9 / 255, 0xa9 / 255, 0x4a / 255);
const GOLD_WASH = rgb(0xf7 / 255, 0xf1 / 255, 0xdf / 255);
const GOLD_LINE = rgb(0xe8 / 255, 0xdc / 255, 0xb8 / 255);
const INK = rgb(0x24 / 255, 0x2a / 255, 0x34 / 255);
const INK_2 = rgb(0x58 / 255, 0x60 / 255, 0x72 / 255);
const WHITE = rgb(1, 1, 1);

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
      let top = H - 30;
      if (logo) {
        const lw = 150;
        const lh = (logo.height / logo.width) * lw;
        page.drawImage(logo, { x: (W - lw) / 2, y: top - lh, width: lw, height: lh });
        top -= lh + 18;
      }
      const bandH = 96;
      page.drawRectangle({ x: 0, y: top - bandH, width: W, height: bandH, color: NAVY });
      const eyebrow = 'BREAM CHURCH NEWSLETTER';
      page.drawText(eyebrow, { x: (W - sansBold.widthOfTextAtSize(eyebrow, 8.5)) / 2, y: top - 24, size: 8.5, font: sansBold, color: GOLD });
      let size = 26;
      const title = t(o.title);
      while (size > 14 && serifBold.widthOfTextAtSize(title, size) > CW) size -= 1;
      page.drawText(title, { x: (W - serifBold.widthOfTextAtSize(title, size)) / 2, y: top - 56, size, font: serifBold, color: WHITE });
      const sub = t(weekLabel(o.weekFrom));
      page.drawText(sub, { x: (W - sans.widthOfTextAtSize(sub, 10.5)) / 2, y: top - 80, size: 10.5, font: sans, color: rgb(0.85, 0.87, 0.91) });
      page.drawRectangle({ x: 0, y: top - bandH - 4, width: W, height: 4, color: GOLD });
      y = top - bandH - 4 - 26;
    } else {
      page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: NAVY });
      page.drawRectangle({ x: 0, y: H - 33, width: W, height: 3, color: GOLD });
      page.drawText(t(o.title), { x: M, y: H - 20, size: 10, font: sansBold, color: WHITE });
      y = H - 33 - 28;
    }
  };
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
      y -= 8;
      page.drawRectangle({ x: M, y: y - 3, width: 34, height: 2.5, color: GOLD });
      y -= 14;
      for (const l of wrap(b.text, serifBold, 19, CW)) {
        need(24);
        page.drawText(l, { x: M, y: y - 19, size: 19, font: serifBold, color: NAVY });
        y -= 24;
      }
      y -= 6;
    } else if (b.type === 'text' && b.text.trim()) {
      lines(b.text);
    } else if (b.type === 'quote' && b.text.trim()) {
      const ql = wrap(`"${b.text.trim()}"`, serifItalic, 15, CW - 44);
      const cite = b.cite.trim() ? t(`- ${b.cite.trim()}`) : '';
      const h = ql.length * 21 + (cite ? 22 : 0) + 30;
      need(Math.min(h, H / 2));
      y -= 6;
      page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: GOLD_WASH });
      page.drawRectangle({ x: M, y: y - h, width: 4, height: h, color: GOLD });
      let qy = y - 16;
      for (const l of ql) { page.drawText(l, { x: M + 22, y: qy - 15, size: 15, font: serifItalic, color: NAVY_DEEP }); qy -= 21; }
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
      page.drawRectangle({ x: M, y: y - 2, width: CW, height: 2, color: GOLD });
      y -= 18;
      page.drawText("WHAT'S ON", { x: M, y: y - 8.5, size: 8.5, font: sansBold, color: GOLD });
      y -= 16;
      page.drawText('The week ahead', { x: M, y: y - 20, size: 20, font: serifBold, color: NAVY });
      y -= 26;
      page.drawText(t(weekLabel(o.weekFrom)), { x: M, y: y - 10.5, size: 10.5, font: sans, color: INK_2 });
      y -= 24;
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
        page.drawRectangle({ x: M, y: y - 22, width: CW, height: 22, color: NAVY });
        page.drawText(t(d.label.toUpperCase()), { x: M + 12, y: y - 15, size: 9.5, font: sansBold, color: WHITE });
        y -= 22;
        rows.forEach((r, n) => {
          const h = rowH(r);
          if (y - h < BOTTOM) {
            newPage(false);
            page.drawRectangle({ x: M, y: y - 22, width: CW, height: 22, color: NAVY });
            page.drawText(t(`${d.label.toUpperCase()} (CONTINUED)`), { x: M + 12, y: y - 15, size: 9.5, font: sansBold, color: WHITE });
            y -= 22;
          }
          page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: GOLD_WASH });
          if (n > 0) page.drawRectangle({ x: M + 12, y: y - 0.5, width: CW - 24, height: 0.75, color: GOLD_LINE });
          page.drawText(r.time, { x: M + 12, y: y - 16, size: 10.5, font: sansBold, color: NAVY });
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
    p.drawRectangle({ x: M, y: 38, width: W - M * 2, height: 0.75, color: GOLD_LINE });
    p.drawText('Bream Church - making a difference', { x: M, y: 24, size: 8.5, font: sans, color: INK_2 });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - sans.widthOfTextAtSize(n, 8.5), y: 24, size: 8.5, font: sans, color: INK_2 });
  });

  return pdf.save();
}
