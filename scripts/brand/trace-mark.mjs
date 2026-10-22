#!/usr/bin/env node
/**
 * Trace the pixel grid of the Qwarter icon mark (a white pixel "Q" on a black disc) into an SVG of
 * individual squares, so the loader can light the mark up square by square.
 *
 * Usage: node scripts/brand/trace-mark.mjs <icon.png> <out.svg>
 * Prints the grid as text so the trace can be checked by eye.
 */
import fs from "node:fs";
import sharp from "sharp";

const [src, out] = process.argv.slice(2);
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y) => { const i = (y * W + x) * 4; return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }; };

// the disc is the opaque dark area; the Q is what is light or transparent inside it
let minX = W, maxX = 0, minY = H, maxY = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px(x, y).a > 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, R = (maxX - minX) / 2;
const isQ = (x, y) => { const p = px(x, y); return Math.hypot(x - cx, y - cy) < R - 2 && (p.a < 128 || (p.r + p.g + p.b) / 3 > 170); };

// the Q's bounding box and the cell size (the shortest horizontal and vertical runs of Q)
let qMinX = W, qMaxX = 0, qMinY = H, qMaxY = 0;
const runs = [];
for (let y = 0; y < H; y++) {
  let run = 0;
  for (let x = 0; x <= W; x++) {
    const q = x < W && isQ(x, y);
    if (q) { run++; qMinX = Math.min(qMinX, x); qMaxX = Math.max(qMaxX, x); qMinY = Math.min(qMinY, y); qMaxY = Math.max(qMaxY, y); }
    else { if (run > 3) runs.push(run); run = 0; }
  }
}
for (let x = 0; x < W; x++) {
  let run = 0;
  for (let y = 0; y <= H; y++) {
    const q = y < H && isQ(x, y);
    if (q) run++; else { if (run > 3) runs.push(run); run = 0; }
  }
}
runs.sort((a, b) => a - b);
const cell = runs[Math.floor(runs.length * 0.08)]; // near the shortest, past the anti-aliasing noise
const cols = Math.round((qMaxX - qMinX + 1) / cell), rows = Math.round((qMaxY - qMinY + 1) / cell);
const cw = (qMaxX - qMinX + 1) / cols, ch = (qMaxY - qMinY + 1) / rows;
console.log(`disc ${Math.round(2 * R)}px, Q bbox ${qMinX},${qMinY}-${qMaxX},${qMaxY}, cell ≈ ${cell}px → grid ${cols}×${rows}`);

const grid = [];
for (let r = 0; r < rows; r++) {
  let line = "";
  for (let c = 0; c < cols; c++) {
    // sample the centre of the cell
    const x = Math.round(qMinX + (c + 0.5) * cw), y = Math.round(qMinY + (r + 0.5) * ch);
    const on = isQ(x, y);
    line += on ? "█" : "·";
    if (on) grid.push([c, r]);
  }
  console.log(line);
}
// SVG in grid units, centred in a square viewBox with the disc's proportions kept (the disc is not drawn)
const size = Math.max(cols, rows) + 2;
const ox = (size - cols) / 2, oy = (size - rows) / 2;
const rects = grid.map(([c, r], i) => `<rect class="q" data-i="${i}" x="${(ox + c).toFixed(2)}" y="${(oy + r).toFixed(2)}" width="1.02" height="1.02"/>`).join("\n  ");
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="currentColor" aria-hidden="true">\n  ${rects}\n</svg>\n`);
console.log(`${grid.length} squares → ${out}`);
