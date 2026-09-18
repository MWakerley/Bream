// Produces a transparent-background version of the church logo.
//
// The supplied AVIF is fully opaque — the white is baked in — which forced every
// earlier placement onto a white surface. The church's own website works around
// it the same way, with a white box top-left. To use the mark on the navy brand
// colour it has to be keyed out properly.
//
// A naive luminance key is wrong here: the brand gold (#C0A860) is bright, so
// keying on brightness would make the wordmark half-transparent. Instead the
// distance from white is taken from the DARKEST channel, which separates gold
// (min channel 96, far from white) from the page (min channel 254) cleanly. The
// colour is then un-premultiplied — the observed pixel is the true colour
// composited over white, so the true colour is recovered rather than left milky
// at the edges.
//
//   NODE_PATH=<...>/node_modules node seed/make-logo-transparent.cjs
const sharp = require('sharp');

const SRC = 'C:/Users/waker/Downloads/Bream Logo Updated White.avif';
const OUT = __dirname + '/../public/assets';

/** Distance from white at which a pixel counts as fully part of the artwork.
 *  Low enough to keep thin anti-aliased strokes, high enough that JPEG-ish
 *  mottling in the near-white field does not become a grey haze. */
const SOLID_AT = 70;
/** The page is #FEFEFE, not #FFFFFF, so its distance from white is 1 rather than
 *  0. Without this offset the whole background keeps ~1% alpha and the mark
 *  arrives with a faint grey panel still attached. */
const WHITE_SLACK = 5;

(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);

  let keptFully = 0, keptPartly = 0, dropped = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const d = 255 - Math.min(r, g, b);
    const a = Math.min(1, Math.max(0, d - WHITE_SLACK) / (SOLID_AT - WHITE_SLACK));

    if (a <= 0) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      dropped++;
      continue;
    }
    a >= 0.999 ? keptFully++ : keptPartly++;

    // c_obs = c_true * a + 255 * (1 - a)  ->  c_true = (c_obs - 255(1-a)) / a
    const un = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a)));
    out[i] = un(r); out[i + 1] = un(g); out[i + 2] = un(b);
    out[i + 3] = Math.round(a * 255);
  }

  const img = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
  await img.clone().png({ compressionLevel: 9 }).toFile(OUT + '/logo-transparent.png');
  await img.clone().webp({ quality: 95, alphaQuality: 100 })
    .toFile(OUT + '/logo-transparent.webp');

  // Proof sheets: the mark composited on each brand ground it will actually sit on.
  const png = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(info.width * 2).png().toBuffer();
  for (const [name, bg] of [['navy', '#324158'], ['gold', '#E6D488'], ['offwhite', '#F9F9F9']]) {
    await sharp({
      create: { width: info.width * 2 + 80, height: info.height * 2 + 60, channels: 4, background: bg },
    }).composite([{ input: png, gravity: 'center' }]).png()
      .toFile(`${OUT}/../../seed/proof-${name}.png`);
  }

  const total = info.width * info.height;
  console.log(`opaque ${keptFully} | feathered ${keptPartly} | transparent ${dropped} of ${total}`);
  console.log(`background removed: ${((dropped / total) * 100).toFixed(1)}%`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
