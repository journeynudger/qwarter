#!/usr/bin/env node
/**
 * The site's icons and social card, from the brand's own marks:
 *   public/design/qwarter/icon.svg              the pixel Q (q-mark.svg) in cream on the site's black
 *   public/design/qwarter/apple-touch-icon.png  the same, 180×180
 *   public/media/og.jpg                         1200×630: the wordmark (the brand's own logo PNG) on black
 *
 * Usage: node scripts/brand/icons.mjs <Qwarter-Logo-Mark-Transparent-White.png>
 */
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DESIGN = path.join(ROOT, "public/design/qwarter");
const [logo] = process.argv.slice(2);
if (!logo) {
  console.error("Usage: node scripts/brand/icons.mjs <white wordmark png>");
  process.exit(2);
}

const mark = fs.readFileSync(path.join(DESIGN, "q-mark.svg"), "utf8");
const squares = mark.match(/<rect[^>]*\/>/g).map((r) => r.replace(/ class="q"| data-i="\d+"/g, "")).join("");
// the mark fills its 14-unit box; the icon gives it a margin of 2 units on a 18-unit sheet
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><rect width="18" height="18" fill="#0b0b0c"/><g fill="#f2ede3" transform="translate(2 2)">${squares}</g></svg>`;
fs.writeFileSync(path.join(DESIGN, "icon.svg"), icon + "\n");

await sharp(Buffer.from(icon), { density: 400 }).resize(180, 180, { kernel: "nearest" }).png({ compressionLevel: 9 }).toFile(path.join(DESIGN, "apple-touch-icon.png"));

const W = 1200, H = 630;
const word = await sharp(logo).resize({ width: 520, withoutEnlargement: true }).png().toBuffer();
const { width: ww, height: wh } = await sharp(word).metadata();
await sharp({ create: { width: W, height: H, channels: 3, background: "#0b0b0c" } })
  .composite([{ input: word, left: Math.round((W - ww) / 2), top: Math.round((H - wh) / 2) }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path.join(ROOT, "public/media/og.jpg"));
console.log(`icon.svg, apple-touch-icon.png, og.jpg (${ww}×${wh} wordmark)`);
