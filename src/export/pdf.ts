import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * A table as a PDF, for printing or attaching to an email.
 *
 * Built for two jobs — the rota and an event's attendee list — which are the
 * same shape: a title, a header row, and rows of short text that sometimes wrap.
 * The header repeats on every page and each page is numbered, because these get
 * printed and one loose sheet has to make sense on its own.
 *
 * The standard PDF fonts are used, so there is nothing to embed and the file
 * stays small. They only cover Western European characters; anything outside
 * that is swapped for its nearest plain letter rather than failing the export.
 */

export interface PdfColumn {
  header: string;
  /** Relative width. The columns share the page in proportion. */
  weight: number;
}

export interface PdfTable {
  /** Shown above the table, e.g. "Leading the service". Optional. */
  heading?: string;
  columns: PdfColumn[];
  /** Cells as text. A newline inside a cell starts a new line. */
  rows: string[][];
  /** Row indexes to wash red, e.g. services missing a critical role. */
  highlight?: Set<number>;
  /** Column indexes to print bold — the date, usually. */
  bold?: Set<number>;
}

export interface PdfDoc {
  title: string;
  subtitle?: string;
  /** A line of small print under the tables, e.g. how to ask for a swap. */
  footnote?: string;
  tables: PdfTable[];
  landscape?: boolean;
}

const NAVY = rgb(0x32 / 255, 0x41 / 255, 0x58 / 255);
const INK = rgb(0x24 / 255, 0x2a / 255, 0x34 / 255);
const INK_2 = rgb(0x58 / 255, 0x60 / 255, 0x72 / 255);
const RULE = rgb(0xdf / 255, 0xe3 / 255, 0xea / 255);
const ZEBRA = rgb(0xf4 / 255, 0xf5 / 255, 0xf7 / 255);
const GOLD = rgb(0xd8 / 255, 0xc0 / 255, 0x5f / 255);
const BAD_WASH = rgb(0xfb / 255, 0xec / 255, 0xea / 255);
const BAD = rgb(0xa3 / 255, 0x2a / 255, 0x1c / 255);

/**
 * Only what WinAnsi can draw. Accents that it has (é, ü, ñ) survive; anything
 * else is decomposed to its base letter, and failing that dropped — a name
 * printed as "Zoe" is better than an export that will not open.
 */
function printable(s: string): string {
  return s
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...')
    .normalize('NFC')
    .split('')
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255)) return ch;
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return /^[\x20-\x7e]$/.test(base) ? base : '';
    })
    .join('');
}

/** Breaks text into lines that fit, on words where it can and mid-word where
 *  a single word is wider than the column. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of printable(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(tryLine, size) <= width) { line = tryLine; continue; }
      if (line) out.push(line);
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export async function buildPdf(doc: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(printable(doc.title));
  pdf.setCreator('Bream Church');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const [W, H] = doc.landscape ? [841.89, 595.28] : [595.28, 841.89];
  const M = 32;
  const SIZE = 8.5;
  const LEAD = 10.5;
  const PAD = 5;
  const printed = new Date().toISOString().slice(0, 10);

  let page!: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];

  const newPage = (first: boolean) => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    // A navy band with a gold rule: recognisably the church's, and it prints
    // cleanly in black and white too.
    page.drawRectangle({ x: 0, y: H - (first ? 64 : 34), width: W, height: first ? 64 : 34, color: NAVY });
    page.drawRectangle({ x: 0, y: H - (first ? 67 : 37), width: W, height: 3, color: GOLD });
    if (first) {
      page.drawText(printable(doc.title), { x: M, y: H - 34, size: 17, font: bold, color: rgb(1, 1, 1) });
      if (doc.subtitle) {
        page.drawText(printable(doc.subtitle), { x: M, y: H - 52, size: 9.5, font: regular, color: rgb(0.9, 0.92, 0.95) });
      }
      y = H - 67 - 18;
    } else {
      page.drawText(printable(doc.title), { x: M, y: H - 22, size: 10, font: bold, color: rgb(1, 1, 1) });
      y = H - 37 - 14;
    }
  };

  const drawHeader = (t: PdfTable, xs: number[], widths: number[]) => {
    const lines = t.columns.map((c, i) => wrap(c.header, bold, SIZE, widths[i]! - PAD * 2));
    const h = Math.max(...lines.map((l) => l.length)) * LEAD + PAD * 2;
    page.drawRectangle({ x: M, y: y - h, width: W - M * 2, height: h, color: NAVY });
    lines.forEach((ls, i) => ls.forEach((l, j) => page.drawText(l, {
      x: xs[i]! + PAD, y: y - PAD - SIZE - j * LEAD + 1, size: SIZE, font: bold, color: rgb(1, 1, 1),
    })));
    y -= h;
  };

  newPage(true);

  for (const t of doc.tables) {
    const total = t.columns.reduce((n, c) => n + c.weight, 0);
    const widths = t.columns.map((c) => ((W - M * 2) * c.weight) / total);
    const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0));

    // A table heading never sits alone at the foot of a page.
    if (y < M + 90) newPage(false);
    if (t.heading) {
      page.drawText(printable(t.heading), { x: M, y: y - 12, size: 11.5, font: bold, color: NAVY });
      y -= 20;
    }
    drawHeader(t, xs, widths);

    t.rows.forEach((row, r) => {
      const cells = t.columns.map((_, i) =>
        wrap(row[i] ?? '', t.bold?.has(i) ? bold : regular, SIZE, widths[i]! - PAD * 2));
      const h = Math.max(1, ...cells.map((c) => c.length)) * LEAD + PAD * 2;
      if (y - h < M + 20) {
        newPage(false);
        drawHeader(t, xs, widths);
      }
      const hot = t.highlight?.has(r);
      if (hot || r % 2) {
        page.drawRectangle({ x: M, y: y - h, width: W - M * 2, height: h, color: hot ? BAD_WASH : ZEBRA });
      }
      if (hot) page.drawRectangle({ x: M, y: y - h, width: 3, height: h, color: BAD });
      cells.forEach((ls, i) => ls.forEach((l, j) => page.drawText(l, {
        x: xs[i]! + PAD, y: y - PAD - SIZE - j * LEAD + 1, size: SIZE,
        font: t.bold?.has(i) ? bold : regular, color: INK,
      })));
      page.drawLine({ start: { x: M, y: y - h }, end: { x: W - M, y: y - h }, thickness: 0.5, color: RULE });
      y -= h;
    });
    y -= 18;
  }

  if (doc.footnote) {
    const lines = wrap(doc.footnote, regular, 8.5, W - M * 2);
    if (y - lines.length * 11 < M + 20) newPage(false);
    lines.forEach((l, i) => page.drawText(l, { x: M, y: y - 10 - i * 11, size: 8.5, font: regular, color: INK_2 }));
  }

  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}  ·  printed ${printed}`;
    p.drawText(printable(label), {
      x: W - M - regular.widthOfTextAtSize(printable(label), 7.5), y: M - 14, size: 7.5, font: regular, color: INK_2,
    });
    p.drawText('Bream Church', { x: M, y: M - 14, size: 7.5, font: bold, color: INK_2 });
  });

  return pdf.save();
}
