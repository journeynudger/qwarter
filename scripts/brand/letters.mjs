#!/usr/bin/env node
/**
 * The two pictures the carried design's preloader reveals path by path (its own are the DEPO and LUXE
 * wordmarks, four <path>s each, one per letter; its script reveals exactly four, in turn): Qwarter's pixel
 * mark, its squares gathered into four paths in the order they light up, and the word "Qwarter" set in
 * EB Garamond italic (the site's own face, self-hosted), its letters gathered into four paths (Q · wa · rt ·
 * er), both on the preloader's 400×400 canvas. The footer's logo is the same mark (the script reveals its
 * four paths the same way). Written to public/design/qwarter/loader-mark.svg and loader-word.svg.
 *
 * Usage: node scripts/brand/letters.mjs
 */
import fs from "node:fs";
import path from "node:path";

import { openSync } from "fontkit";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "public/design/qwarter");
const SIZE = 400;

// 1. the mark: public/design/qwarter/q-mark.svg's squares (a 14×14 grid), as paths, centred at 72% of the canvas
const mark = fs.readFileSync(path.join(OUT, "q-mark.svg"), "utf8");
const rects = [...mark.matchAll(/<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g)].map((m) => m.slice(1, 5).map(Number));
const grid = Number((mark.match(/viewBox="0 0 (\d+) \d+"/) || [])[1] || 14);
const unit = (SIZE * 0.72) / grid, off = (SIZE - unit * grid) / 2;
const r2 = (n) => Math.round(n * 100) / 100;
const square = ([x, y, w, h]) => `M${r2(off + x * unit)} ${r2(off + y * unit)}h${r2(w * unit)}v${r2(h * unit)}h-${r2(w * unit)}z`;
const GROUPS = 4, per = Math.ceil(rects.length / GROUPS);
const markPaths = Array.from({ length: GROUPS }, (_, g) => `<path d="${rects.slice(g * per, (g + 1) * per).map(square).join("")}"/>`);
fs.writeFileSync(path.join(OUT, "loader-mark.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${markPaths.join("")}</svg>\n`);

// 2. the word, one path per letter, baked into canvas coordinates (the preloader's script animates the paths'
//    own properties, so nothing here relies on a transform attribute)
const font = openSync(path.join(OUT, "fonts/ebgaramond-italic-400-800-latin.woff2"));
const word = "Qwarter";
const run = font.layout(word);
const upm = font.unitsPerEm;
const advance = run.advanceWidth; // font units
const scale = (SIZE * 0.88) / advance; // the word spans 88% of the canvas
const x0 = (SIZE - advance * scale) / 2;
const baseline = SIZE / 2 + ((font.capHeight || upm * 0.65) * scale) / 2; // capitals centred on the canvas
let x = x0;
const letters = [];
for (let i = 0; i < run.glyphs.length; i++) {
  const g = run.glyphs[i], pos = run.positions[i];
  const p = g.path.scale(scale, -scale).translate(x + pos.xOffset * scale, baseline - pos.yOffset * scale);
  letters.push(p.toSVG());
  x += pos.xAdvance * scale;
}
const WORD_GROUPS = [[0], [1, 2], [3, 4], [5, 6]]; // Q · wa · rt · er
const wordPaths = WORD_GROUPS.map((idx) => `<path d="${idx.map((i) => letters[i]).join("")}"/>`);
fs.writeFileSync(path.join(OUT, "loader-word.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${wordPaths.join("")}</svg>\n`);
console.log(`loader-mark.svg: ${rects.length} squares in ${markPaths.length} paths; loader-word.svg: "${word}" in ${font.familyName} ${font.subfamilyName}, ${letters.length} letters in ${wordPaths.length} paths, ${upm} upm, cap height ${font.capHeight}`);
