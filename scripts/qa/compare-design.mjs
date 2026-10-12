#!/usr/bin/env node
/**
 * How close is each Qwarter page to the reference design page it is built on?
 *
 * The reference side is the capture (scripts/design/capture.mjs), not the live site, so this
 * runs offline and always against the same frozen design. Each page's `template` in
 * content/pages.json names its reference route. For each page and width it measures the local
 * build exactly as the capture measured the reference (scripts/lib/probes.mjs), then reports:
 *
 *   layout   elements matched by their place in the document (tag and classes, not their words),
 *            and how far each one moved or resized, and every difference in font, size, weight,
 *            line height, letter spacing, colour, background or radius
 *   frames   the share of pixels that differ, frame by frame through the same scroll
 *            (Qwarter's words and pictures differ on purpose; the frames show everything else)
 *   cursor   the elements that follow the pointer, and their size over links, buttons and cards
 *   hover    which properties change on hover, for each link, button and card
 *
 * Usage: node scripts/qa/compare-design.mjs [--base http://localhost:3100] [--ref .design-cache/synchronized]
 *          [--only home,about] [--widths 1440,390] [--out qa-out/compare] [--frames 40]
 * Needs a running build (npm run build && npm start -- -p 3100).
 */
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";
import { diffPng } from "../lib/pixels.mjs";
import { cursorProbe, hoverProbe, layoutOf, scrollThrough, scrollToTop, sleep } from "../lib/probes.mjs";
import { slugOf } from "../lib/routes.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const BASE = opt("base", "http://localhost:3100");
const REF = opt("ref", ".design-cache/synchronized");
const OUT = opt("out", "qa-out/compare");
const WIDTHS = opt("widths", "1440,390").split(",").map(Number);
const MAX_FRAMES = Number(opt("frames", 40));

let pages = JSON.parse(fs.readFileSync("content/pages.json", "utf8"));
if (opt("only")) {
  const only = new Set(opt("only").split(","));
  pages = pages.filter((p) => only.has(p.slug));
}
if (!fs.existsSync(path.join(REF, "manifest.json"))) {
  console.error(`No capture at ${REF}. Run scripts/design/capture.mjs first.`);
  process.exit(2);
}

const STYLE = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "color", "backgroundColor", "borderRadius", "opacity", "mixBlendMode"];

function compareLayout(ref, local) {
  // the n-th element at the same document path is the same element, whatever it says
  const key = (items) => {
    const seen = new Map();
    return items.map((i) => {
      const n = seen.get(i.path) ?? 0;
      seen.set(i.path, n + 1);
      return [`${i.path}#${n}`, i];
    });
  };
  const localByKey = new Map(key(local.items));
  const moved = [];
  const styled = [];
  let missing = 0;
  const missingPaths = [];
  for (const [k, a] of key(ref.items)) {
    const b = localByKey.get(k);
    if (!b) {
      missing++;
      if (missingPaths.length < 15) missingPaths.push(k);
      continue;
    }
    localByKey.delete(k);
    const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
    if (d > 2) moved.push({ path: k, d, ref: [a.x, a.y, a.w, a.h], local: [b.x, b.y, b.w, b.h] });
    const diffs = STYLE.filter((p) => (a[p] ?? "") !== (b[p] ?? "")).map((p) => `${p}: ${a[p] ?? "-"} → ${b[p] ?? "-"}`);
    if (diffs.length) styled.push({ path: k, diffs });
  }
  return {
    ref: ref.items.length,
    local: local.items.length,
    matched: ref.items.length - missing,
    missing,
    missingPaths,
    extra: localByKey.size,
    extraPaths: [...localByKey.keys()].slice(0, 15),
    height: { ref: ref.scrollHeight, local: local.scrollHeight },
    movedCount: moved.length,
    moved: moved.sort((a, b) => b.d - a.d).slice(0, 20),
    styledCount: styled.length,
    styled: styled.slice(0, 20),
  };
}

function compareCursor(ref, local) {
  const sizes = (c) => Object.fromEntries((c?.states || []).map((s) => [s.over, (s.followers || []).filter(Boolean).map((f) => `${f.style.width}×${f.style.height} ${f.style.mixBlendMode} ${f.style.backgroundColor}`)]));
  const a = sizes(ref);
  const b = sizes(local);
  const states = [...new Set([...Object.keys(a), ...Object.keys(b)])].map((over) => ({ over, ref: a[over] ?? null, local: b[over] ?? null, same: JSON.stringify(a[over]) === JSON.stringify(b[over]) }));
  return { followers: { ref: ref?.followers?.length ?? 0, local: local?.followers?.length ?? 0 }, states };
}

function compareHover(ref, local) {
  const props = (list) => (list || []).map((h) => ({ what: `${h.tag}.${String(h.className).split(" ")[0]}`, changes: [...new Set(h.changes.map((c) => c.prop))].sort().join(",") }));
  const a = props(ref);
  const b = props(local);
  const byWhat = (l) => l.reduce((m, h) => m.set(h.what, [...(m.get(h.what) || []), h.changes]), new Map());
  const ma = byWhat(a);
  const mb = byWhat(b);
  const rows = [...new Set([...ma.keys(), ...mb.keys()])].map((what) => ({ what, ref: [...new Set(ma.get(what) || [])], local: [...new Set(mb.get(what) || [])] }));
  return rows.filter((r) => JSON.stringify(r.ref) !== JSON.stringify(r.local));
}

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const report = [];
fs.mkdirSync(OUT, { recursive: true });

for (const p of pages) {
  const refDir = path.join(REF, "routes", slugOf(p.template));
  if (!fs.existsSync(refDir)) {
    report.push({ page: p.path, error: `reference route ${p.template} is not in the capture` });
    console.log(`${p.path.padEnd(28)} reference ${p.template} not captured`);
    continue;
  }
  for (const width of WIDTHS) {
    const phone = width < 700;
    const dir = path.join(OUT, `${p.slug}@${width}`);
    fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
    const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
    const page = await context.newPage();
    const row = { page: p.path, template: p.template, width };
    try {
      await page.goto(BASE + p.path, { waitUntil: "load", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const frames = await scrollThrough(page, path.join(dir, "frames"), width, MAX_FRAMES);
      await scrollToTop(page);
      const local = await page.evaluate(layoutOf);
      const refLayoutFile = path.join(refDir, `layout-${width}.json`);
      if (fs.existsSync(refLayoutFile)) row.layout = compareLayout(JSON.parse(fs.readFileSync(refLayoutFile, "utf8")), local);
      // frame by frame through the same scroll
      row.frames = [];
      for (let i = 0; i < frames; i++) {
        const name = `${width}-${String(i).padStart(3, "0")}.png`;
        const a = path.join(refDir, "frames", name);
        const b = path.join(dir, "frames", name);
        if (!fs.existsSync(a) || !fs.existsSync(b)) break;
        const d = await diffPng(browser, a, b, i < 4 ? path.join(dir, `diff-${name}`) : null);
        row.frames.push(Number((d.ratio * 100).toFixed(2)));
      }
      if (!phone) {
        await cursorProbe(page, path.join(dir, "cursor"));
        await scrollToTop(page);
        await hoverProbe(page, path.join(dir, "hover"));
        const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
        row.cursor = compareCursor(read(path.join(refDir, "cursor.json")), read(path.join(dir, "cursor.json")));
        row.hover = compareHover(read(path.join(refDir, "hover.json")), read(path.join(dir, "hover.json")));
      }
    } catch (err) {
      row.error = String(err).split("\n")[0];
    }
    await context.close();
    report.push(row);
    const L = row.layout;
    const avg = row.frames?.length ? (row.frames.reduce((a, b) => a + b, 0) / row.frames.length).toFixed(1) : "-";
    console.log(
      `${p.path.padEnd(28)} ${String(width).padStart(4)}  ` +
        (L ? `matched ${L.matched}/${L.ref}  missing ${L.missing}  extra ${L.extra}  moved ${L.movedCount}  styled ${L.styledCount}  h ${L.height.ref}/${L.height.local}  ` : "") +
        `px ${avg}%` +
        (row.cursor ? `  cursor ${row.cursor.states.filter((s) => s.same).length}/${row.cursor.states.length}` : "") +
        (row.hover ? `  hover-diffs ${row.hover.length}` : "") +
        (row.error ? `  ERROR ${row.error}` : ""),
    );
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nreport: ${path.join(OUT, "report.json")}`);
