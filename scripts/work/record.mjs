#!/usr/bin/env node
/**
 * Record a page's own motion at a steady 60 frames a second, deterministically: between two frames the
 * browser's clock is advanced by exactly one frame (Chromium's virtual time), so timers, CSS transitions
 * and requestAnimationFrame land on frame boundaries whatever the capture's own speed, and nothing is
 * dropped or doubled. For the splash a site plays on arrival (JR Pugh's monogram), a reveal, a hover.
 *
 * Usage: node scripts/work/record.mjs <url> <out.mp4> [--seconds 6] [--until <selector>] [--after <selector>]
 *                                     [--width 1440 --height 900 --scale 2 --fps 60] [--font-css <file>]
 *   --until <selector>   stop as soon as nothing matches the selector any more (the splash removed itself)
 *   --after <selector>   stop one second after nothing matches it
 *   --font-css <file>    a stylesheet added to the page before it renders (fonts served from here when the
 *                        page's own font host cannot be reached)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { launch } from "../lib/browser.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const SECONDS = Number(take("seconds", 6)), UNTIL = take("until", null), AFTER = take("after", null);
const WIDTH = Number(take("width", 1440)), HEIGHT = Number(take("height", 900)), SCALE = Number(take("scale", 2)), FPS = Number(take("fps", 60));
const FONT_CSS = take("font-css", null);
const [url, outFile] = argv;
if (!url || !outFile) { console.error("Usage: node scripts/work/record.mjs <url> <out.mp4> [--seconds 6] [--until <selector>]"); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qw-record-"));
const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE, ignoreHTTPSErrors: true });
const page = await context.newPage();
if (FONT_CSS) await page.addInitScript({ content: `document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(fs.readFileSync(FONT_CSS, "utf8"))}; document.head.appendChild(s); });` });
const cdp = await context.newCDPSession(page);
// the clock stops before the page runs a line of script: its first frame is its first frame
await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
// "commit": with the clock stopped, a page that waits on a film or a font would never report "load"
await page.goto(url, { waitUntil: "commit", timeout: 30000 }).catch((e) => console.error(String(e.message).split("\n")[0]));
await new Promise((r) => setTimeout(r, 1500)); // its stylesheets and fonts arrive while the clock stands still

const step = 1000 / FPS;
const frames = Math.round(SECONDS * FPS);
let n = 0, stopAt = null;
for (let i = 0; i < frames; i++) {
  const expired = new Promise((resolve) => cdp.once("Emulation.virtualTimeBudgetExpired", resolve));
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pauseIfNetworkFetchesPending", budget: step, maxVirtualTimeTaskStarvationCount: 100000 });
  await expired;
  // a plain CDP screenshot: nothing here waits on the page's own frame clock, which is stopped
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 93, captureBeyondViewport: false });
  fs.writeFileSync(path.join(tmp, `f-${String(n++).padStart(5, "0")}.jpg`), Buffer.from(data, "base64"));
  if ((UNTIL || AFTER) && stopAt === null) {
    const gone = await page.evaluate((sel) => !document.querySelector(sel), UNTIL || AFTER).catch(() => false);
    if (gone) stopAt = UNTIL ? i : i + FPS;
  }
  if (stopAt !== null && i >= stopAt) break;
}
await browser.close();
fs.mkdirSync(path.dirname(outFile), { recursive: true });
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f-%05d.jpg"),
  "-vf", `scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-movflags", "+faststart", "-an", outFile]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${outFile}: ${n} frames, ${(n / FPS).toFixed(2)} s at ${FPS} fps, ${Math.round(fs.statSync(outFile).size / 1024)} KB`);
