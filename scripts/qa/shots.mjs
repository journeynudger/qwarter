#!/usr/bin/env node
/**
 * Stills of this site, for looking at it: each route at desktop and phone width, the loader
 * mid-way, the cascade after the loader and after a step, the Work frame after it has slid,
 * the Approach page scrolled. Writes qa-out/shots/<name>.png and prints console errors.
 *
 * Usage: node scripts/qa/shots.mjs [--base http://localhost:3102] [--out qa-out/shots]
 */
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";
import { sleep } from "../lib/probes.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const BASE = take("base", "http://localhost:3102"), OUT = take("out", "qa-out/shots");
fs.mkdirSync(OUT, { recursive: true });

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
async function shoot(name, { width, height, route, before, wait = 1200 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("requestfailed", (r) => errors.push(`${name}: request failed ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${name}: ${r.status()} ${r.url()}`); });
  await page.goto(BASE + route, { waitUntil: "load" });
  if (before) await before(page);
  await sleep(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) errors.push(`${name}: page ${overflow}px wider than the viewport`);
  await context.close();
  console.log(name);
}
const D = { width: 1440, height: 900 }, M = { width: 390, height: 844 };
await shoot("home-loader-mark", { ...D, route: "/", wait: 0, before: () => sleep(900) });
await shoot("home-loader-word", { ...D, route: "/", wait: 0, before: () => sleep(1900) });
await shoot("home", { ...D, route: "/", wait: 0, before: () => sleep(5200) });
await shoot("home-step", { ...D, route: "/", wait: 0, before: async (p) => { await sleep(5000); await p.keyboard.press("ArrowDown"); await sleep(1500); } });
await shoot("home-step2", { ...D, route: "/", wait: 0, before: async (p) => { await sleep(5000); await p.keyboard.press("ArrowDown"); await sleep(1200); await p.keyboard.press("ArrowDown"); await sleep(1500); } });
await shoot("home-m", { ...M, route: "/", wait: 0, before: () => sleep(5200) });
await shoot("work", { ...D, route: "/work/", wait: 1500 });
await shoot("work-slid", { ...D, route: "/work/journey/", wait: 0, before: () => sleep(9000) });
await shoot("work-serein-m", { ...M, route: "/work/serein/", wait: 2500 });
await shoot("approach", { ...D, route: "/approach/", wait: 2500 });
await shoot("approach-scrolled", { ...D, route: "/approach/", wait: 1200, before: async (p) => { await p.evaluate(() => window.scrollTo(0, 700)); await sleep(800); } });
await shoot("approach-m", { ...M, route: "/approach/", wait: 2500 });
await shoot("contact", { ...D, route: "/contact/", wait: 2500 });
await shoot("contact-m", { ...M, route: "/contact/", wait: 2000 });
await shoot("404", { ...D, route: "/nothing-here/", wait: 1500 });
await browser.close();
if (errors.length) { console.log("\nProblems:\n  " + [...new Set(errors)].join("\n  ")); process.exit(1); }
console.log("\nno console errors, no failed requests, no overflow");
