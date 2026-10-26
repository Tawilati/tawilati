// Generates the Tawilati logo SVG set with the wordmark outlined to paths.
// usage: node gen-logos.mjs <fontpkg dir> <output dir>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const [PKG, OUT] = process.argv.slice(2);
const require = createRequire(path.join(PKG, 'package.json'));
const opentype = require('opentype.js');

const load = (rel) => {
  const b = fs.readFileSync(path.join(PKG, 'node_modules', rel));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const serif = load('@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff');
const sans = load('@fontsource/inter/files/inter-latin-500-normal.woff');

const C = {
  green: '#254D3B', sage: '#8BA88B', cream: '#F8F5EC', amber: '#E5A45B', charcoal: '#202B26', muted: '#5B6660'
};

// ---------- the mark (icon units; bounds below) ----------
// Visual bounds of the mark including stroke overhang. The small variant (favicon sizes)
// drops the inner arc and thickens strokes so it survives 16 px.
const ICON = { x: 9.75, y: 12.75, w: 84.5, h: 88.5 };
const ICON_SMALL = { x: 8.5, y: 13.5, w: 87, h: 90.5 };

function mark(cup, wifi, small = false) {
  const s = small ? 9 : 6.5;
  const arcs = small
    ? ['M27.02 28.72A30 30 0 0 1 72.98 28.72', 'M39.28 39A14 14 0 0 1 60.72 39']
    : ['M25.49 27.43A32 32 0 0 1 74.51 27.43', 'M34.3 34.82A20.5 20.5 0 0 1 65.7 34.82', 'M43.11 42.21A9 9 0 0 1 56.89 42.21'];
  const saucerY = small ? 99.5 : 98;
  const handle = small ? 'M77 59H81A9 9 0 0 1 81 77H72' : 'M77 59H82A9 9 0 0 1 82 77H72';
  return [
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${s}">`,
    ...arcs.map((d) => `<path stroke="${wifi}" d="${d}"/>`),
    `<path stroke="${cup}" d="M23 54H77V60C77 76 66 88 53 88H47C34 88 23 76 23 60Z"/>`,
    `<path stroke="${cup}" d="${handle}"/>`,
    `<path stroke="${cup}" d="M13 ${saucerY}H91"/>`,
    `</g>`,
    `<path fill="${cup}" d="M26.27 74.28H73.73C69.52 82.61 61.71 88 53 88H47C38.29 88 30.48 82.61 26.27 74.28Z"/>`
  ].join('');
}

// Place the mark so its visual bounds fill a target box (x, y, height), returns markup + width.
function placeMark(cup, wifi, x, y, h, small = false) {
  const b = small ? ICON_SMALL : ICON;
  const k = h / b.h;
  const tx = x - b.x * k, ty = y - b.y * k;
  return { svg: `<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(k, 4)})">${mark(cup, wifi, small)}</g>`, w: b.w * k };
}

// ---------- text to paths ----------
function run(font, str, x, y, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(str);
  const p = new opentype.Path();
  let cx = x;
  glyphs.forEach((g, i) => {
    p.extend(g.getPath(cx, y, size));
    cx += g.advanceWidth * scale;
    if (i < glyphs.length - 1) cx += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking;
  });
  const bb = p.getBoundingBox();
  return { d: p.toPathData(2), bb, advance: cx - x };
}

// Wordmark "tawilati." at font size F, baseline y=0, starting x=0. Period in accent colour.
function wordmark(F) {
  const word = run(serif, 'tawilati', 0, 0, F);
  const gI = serif.charToGlyph('i'), gDot = serif.charToGlyph('.');
  const dotX = word.advance + serif.getKerningValue(gI, gDot) * (F / serif.unitsPerEm) + 0.015 * F;
  const dot = run(serif, '.', dotX, 0, F);
  return {
    word, dot,
    x1: word.bb.x1, x2: dot.bb.x2, y1: Math.min(word.bb.y1, dot.bb.y1), y2: Math.max(word.bb.y2, dot.bb.y2)
  };
}

// Tagline justified to an exact width.
function tagline(str, x, y, size, width) {
  const nat = run(sans, str, 0, 0, size);
  const natW = nat.bb.x2 - nat.bb.x1;
  const tr = (width - natW) / (str.length - 1);
  const t = run(sans, str, x - nat.bb.x1, y, size, tr);
  return t;
}
function taglineCentered(str, cx, y, size, trackingEm) {
  const t0 = run(sans, str, 0, 0, size, trackingEm * size);
  const w = t0.bb.x2 - t0.bb.x1;
  return run(sans, str, cx - w / 2 - t0.bb.x1, y, size, trackingEm * size);
}

const r = (n, d = 2) => Number(n.toFixed(d));
const svgDoc = (vb, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((n) => r(n)).join(' ')}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const write = (name, s) => { fs.writeFileSync(path.join(OUT, name), s); console.log('wrote', name); };

fs.mkdirSync(OUT, { recursive: true });
const F = 100;
const TAG = 'GOOD FOOD, SMOOTHER SERVICE';

// ---------- icon ----------
for (const [name, cup, wifi, title] of [
  ['tawilati-icon.svg', C.green, C.amber, 'Tawilati'],
  ['tawilati-icon-reverse.svg', C.cream, C.amber, 'Tawilati'],
  ['tawilati-icon-mono.svg', C.green, C.green, 'Tawilati']
]) {
  write(name, svgDoc([ICON.x, ICON.y, ICON.w, ICON.h], mark(cup, wifi), title));
}

// ---------- wordmark ----------
{
  const wm = wordmark(F);
  for (const [name, ink] of [['tawilati-wordmark.svg', C.green], ['tawilati-wordmark-reverse.svg', C.cream]]) {
    write(name, svgDoc([wm.x1, wm.y1, wm.x2 - wm.x1, wm.y2 - wm.y1],
      `<path fill="${ink}" d="${wm.word.d}"/><path fill="${C.amber}" d="${wm.dot.d}"/>`, 'tawilati.'));
  }
}

// ---------- horizontal ----------
function horizontal({ ink, tagInk, withTag }) {
  const wm = wordmark(F);
  const iconH = 1.08 * F;
  const iconBottom = 0.03 * F;
  const gap = 0.22 * F;
  const icon = placeMark(ink, C.amber, 0, iconBottom - iconH, iconH);
  const shift = icon.w + gap - wm.x1;
  let body = icon.svg + `<g transform="translate(${r(shift)} 0)"><path fill="${ink}" d="${wm.word.d}"/><path fill="${C.amber}" d="${wm.dot.d}"/>`;
  let y2 = Math.max(iconBottom, wm.y2);
  if (withTag) {
    const T = 0.165 * F;
    const t = tagline(TAG, wm.x1, 0.36 * F + 0.727 * T, T, wm.x2 - wm.x1);
    body += `<path fill="${tagInk}" d="${t.d}"/>`;
    y2 = Math.max(y2, t.bb.y2);
  }
  body += '</g>';
  const y1 = iconBottom - iconH;
  const x2 = shift + wm.x2;
  return { body, vb: [0, y1, x2, y2 - y1] };
}
for (const [name, opts] of [
  ['tawilati-horizontal.svg', { ink: C.green, withTag: false }],
  ['tawilati-horizontal-tagline.svg', { ink: C.green, tagInk: C.muted, withTag: true }],
  ['tawilati-horizontal-reverse.svg', { ink: C.cream, withTag: false }],
  ['tawilati-horizontal-tagline-reverse.svg', { ink: C.cream, tagInk: C.cream, withTag: true }]
]) {
  const h = horizontal(opts);
  write(name, svgDoc(h.vb, h.body, 'tawilati. Good food, smoother service.'));
}

// ---------- stacked ----------
function stacked({ ink, tagInk, withTag }) {
  const wm = wordmark(F);
  const cx = (wm.x1 + wm.x2) / 2;
  const iconH = 1.45 * F;
  const iconBottom = wm.y1 - 0.18 * F;
  const icon = placeMark(ink, C.amber, 0, 0, iconH);
  const iconX = cx - icon.w / 2 - 0.02 * F;
  const iconSvg = placeMark(ink, C.amber, iconX, iconBottom - iconH, iconH).svg;
  let body = iconSvg + `<path fill="${ink}" d="${wm.word.d}"/><path fill="${C.amber}" d="${wm.dot.d}"/>`;
  let x1 = Math.min(wm.x1, iconX), x2 = Math.max(wm.x2, iconX + icon.w), y2 = wm.y2;
  if (withTag) {
    const T = 0.16 * F;
    const l1 = taglineCentered('GOOD FOOD,', cx, 0.34 * F + 0.727 * T, T, 0.3);
    const l2 = taglineCentered('SMOOTHER SERVICE', cx, 0.34 * F + 0.727 * T + 1.75 * T, T, 0.3);
    body += `<path fill="${tagInk}" d="${l1.d}${l2.d}"/>`;
    x1 = Math.min(x1, l1.bb.x1, l2.bb.x1); x2 = Math.max(x2, l1.bb.x2, l2.bb.x2); y2 = l2.bb.y2;
  }
  const y1 = iconBottom - iconH;
  return { body, vb: [x1, y1, x2 - x1, y2 - y1] };
}
for (const [name, opts] of [
  ['tawilati-stacked.svg', { ink: C.green, withTag: false }],
  ['tawilati-stacked-tagline.svg', { ink: C.green, tagInk: C.muted, withTag: true }],
  ['tawilati-stacked-tagline-reverse.svg', { ink: C.cream, tagInk: C.cream, withTag: true }]
]) {
  const s = stacked(opts);
  write(name, svgDoc(s.vb, s.body, 'tawilati. Good food, smoother service.'));
}

// ---------- app icons & favicon ----------
function tile(bg, cup, wifi, small, title, pad) {
  const size = 1024, rad = 230;
  const h = size * (1 - 2 * pad);
  const b = small ? ICON_SMALL : ICON;
  const w = b.w * (h / b.h);
  const m = placeMark(cup, wifi, (size - w) / 2, (size - h) / 2, h, small).svg;
  return svgDoc([0, 0, size, size], `<rect width="${size}" height="${size}" rx="${rad}" fill="${bg}"/>${m}`, title);
}
write('app-icon.svg', tile(C.green, C.cream, C.amber, false, 'Tawilati', 0.2));
write('app-icon-light.svg', tile(C.cream, C.green, C.amber, false, 'Tawilati', 0.2));
write('favicon.svg', tile(C.green, C.cream, C.amber, true, 'Tawilati', 0.12));
