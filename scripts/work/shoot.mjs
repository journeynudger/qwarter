#!/usr/bin/env node
/**
 * Photograph a site Qwarter built, for the Work pages.
 *
 * For each route: a viewport frame (1440×900 at 2×) and the whole page (a full-page capture after a
 * scroll pass, so lazy images and reveals have happened), saved as PNG under
 * public/media/work/<slug>/raw/. scripts/work/prepare.mjs then makes the delivered sizes.
 *
 * Usage:
 *   node scripts/work/shoot.mjs <slug> <base> <name=route|click:selector> …
 *     node scripts/work/shoot.mjs journey http://localhost:3100 home=/ universities=/universities/
 *     node scripts/work/shoot.mjs serein http://localhost:3101 home=/ "product=/|click:text=Product"
 *   --width 1440 --height 900 --scale 2 --settle 1500
 */
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";
import { sleep } from "../lib/probes.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const WIDTH = Number(take("width", 1440)), HEIGHT = Number(take("height", 900)), SCALE = Number(take("scale", 2)), SETTLE = Number(take("settle", 1500));
const [slug, base, ...specs] = argv;
if (!slug || !base || !specs.length) {
  console.error("Usage: node scripts/work/shoot.mjs <slug> <base> name=route[|click:selector] …");
  process.exit(2);
}
const out = path.join("public/media/work", slug, "raw");
fs.mkdirSync(out, { recursive: true });

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
for (const spec of specs) {
  const eq = spec.indexOf("=");
  const name = spec.slice(0, eq), rest = spec.slice(eq + 1);
  const [route, ...steps] = rest.split("|");
  const page = await context.newPage();
  await page.goto(base + route, { waitUntil: "load", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  for (const step of steps) {
    const [kind, ...arg] = step.split(":");
    const sel = arg.join(":"); // "click:text=Product" — the selector may itself contain ":"
    if (kind === "click") {
      await page.locator(sel).first().click({ timeout: 5000 });
      await sleep(1200);
    }
  }
  await sleep(SETTLE);
  // a scroll pass, so lazy images and scroll reveals are in the full capture, then back to the top
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await sleep(1200);
  await page.evaluate(() => document.fonts.ready);
  const frame = path.join(out, `${name}.png`);
  const full = path.join(out, `${name}-full.png`);
  await page.screenshot({ path: frame });
  await page.screenshot({ path: full, fullPage: true, timeout: 120000 }).catch((e) => console.error(`${name}: full page: ${String(e).split("\n")[0]}`));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`${slug}/${name}: ${route} viewport ${WIDTH}×${HEIGHT}@${SCALE}, page ${height}px`);
  await page.close();
}
await browser.close();
