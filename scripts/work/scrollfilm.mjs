#!/usr/bin/env node
/**
 * The site itself, filmed: a real browser scrolls each page from its top to its foot, slowly, and every
 * frame is captured whole (1920×1080 by default, nothing cropped), so the film shows what a visitor sees:
 * the fixed header staying, the pinned sections pinning, the reveals revealing as they come into view.
 * The page strips prepare.mjs makes cannot do that (a pinned section photographs as a hole, a sticky hero
 * twice), which is why Beacon's first film read as black stretches.
 *
 * Under Chromium's virtual time, so the capture is deterministic and smooth however slow the machine: the
 * clock advances one frame between screenshots, the scroll position is set for each frame (a smoothstep
 * from the top to the foot: a hold, a glide of at most --max seconds, a hold). What runs on the page's own
 * timers (reveals, parallax, counters) runs in step; a <video> on the page does not advance with virtual
 * time, so a film that should open on a site's own clip takes that clip itself (content/work.json film.scenes).
 *
 * A page that must be filmed in real time (an instrument playing, a meter moving to sound) takes
 * `|live:<seconds>` after its route: the page is clicked where the spec says and the screen is then
 * recorded as it plays, through CDP's screencast, at the rate the machine delivers.
 *
 * Writes <out>/film-<name>.mp4 (H.264, 30 fps) per page and <out>/films.json (name, route, seconds,
 * height). The home film (scripts/work/video.mjs) cuts these into the project's film.
 *
 * Usage:
 *   node scripts/work/scrollfilm.mjs <slug> <base> [name=route[|click:selector][|live:seconds] …]
 *     [--out dir] [--width 1600 --height 900 --scale 1.2] [--fps 30] [--speed 110] [--max 18]
 *     [--hold 1.6] [--settle 3000] [--ua "<user agent>"]
 *   --width/--height is the browser's window (the page lays out as on a 1600px desktop); --scale makes the
 *   frames 1920×1080. --speed is the glide in page pixels a second, --max its longest run, --hold the seconds
 *   at the top and at the foot, --settle the virtual milliseconds given to a page's own entrance before the
 *   first frame. Default out: public/media/work/<slug>/raw (where video.mjs looks).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { launch } from "../lib/browser.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const WIDTH = Number(take("width", 1600)), HEIGHT = Number(take("height", 900)), SCALE = Number(take("scale", 1.2));
const FPS = Number(take("fps", 30)), SPEED = Number(take("speed", 110)), MAX = Number(take("max", 18)), HOLD = Number(take("hold", 1.6));
const SETTLE = Number(take("settle", 3000)), OUT = take("out", null);
const UA = take("ua", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
const [slug, base, ...specs] = argv;
if (!slug || !base) { console.error("Usage: node scripts/work/scrollfilm.mjs <slug> <base> [name=route[|click:selector][|live:seconds] …] [--out dir]"); process.exit(2); }
const out = OUT ? path.resolve(OUT) : path.join("public/media/work", slug, "raw");
fs.mkdirSync(out, { recursive: true });
const pages = (specs.length ? specs : ["home=/"]).map((s) => {
  const [name, rest] = s.split("=");
  const parts = (rest || "/").split("|");
  const page = { name, route: parts[0] };
  for (const p of parts.slice(1)) { const [k, v] = [p.slice(0, p.indexOf(":")), p.slice(p.indexOf(":") + 1)]; if (k === "click") page.click = v; if (k === "live") page.live = Number(v); }
  return page;
});
const smoothstep = (t) => t * t * (3 - 2 * t);
const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
const films = [];
for (const pg of pages) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE, userAgent: UA, ignoreHTTPSErrors: true, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `qw-film-${slug}-${pg.name}-`));
  const url = new URL(pg.route, base).href;
  let frames = 0, seconds = 0, height = 0;
  try {
    if (!pg.live) await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
    await page.goto(url, { waitUntil: pg.live ? "load" : "commit", timeout: 60000 }).catch((e) => console.error(`${slug}/${pg.name}: ${String(e.message).split("\n")[0]}`));
    // the page's own clock stands still while its files arrive; then its entrance is given its time
    await new Promise((r) => setTimeout(r, 2500));
    // the clock waits for the page's fetches, unless one never ends (a stream, a dev server's socket): after 2.5 s of
    // real time with no progress the page is given its time regardless, for the rest of this film
    let freeRunning = false;
    const advance = async (ms) => {
      const policy = freeRunning ? "advance" : "pauseIfNetworkFetchesPending";
      let done;
      const expired = new Promise((resolve) => { done = resolve; cdp.once("Emulation.virtualTimeBudgetExpired", resolve); });
      await cdp.send("Emulation.setVirtualTimePolicy", { policy, budget: ms, maxVirtualTimeTaskStarvationCount: 100000 });
      const timer = setTimeout(async () => {
        if (freeRunning) return;
        freeRunning = true;
        console.error(`${slug}/${pg.name}: a fetch never finished; the clock runs on without it`);
        await cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: ms, maxVirtualTimeTaskStarvationCount: 100000 }).catch(() => done());
      }, 2500);
      await expired;
      clearTimeout(timer);
    };
    if (!pg.live) await advance(SETTLE);
    // what sits over the page (a cookie bar, a newsletter) is taken off: Escape, then the fixed layers that name themselves
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") continue;
        const id = `${el.className} ${el.id} ${el.getAttribute("role") || ""}`;
        if (/cookie|consent|gdpr|newsletter|popup|pop-up|modal|subscribe|promo-bar|announcement/i.test(id) && cs.position === "fixed") el.style.setProperty("display", "none", "important");
      }
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
    }).catch(() => {});
    if (pg.click) {
      await page.locator(pg.click).first().click({ timeout: 5000, force: true }).catch((e) => console.error(`${slug}/${pg.name}: click ${pg.click}: ${String(e.message).split("\n")[0]}`));
      if (!pg.live) await advance(SETTLE);
    }
    const shot = async () => { const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, captureBeyondViewport: false }); fs.writeFileSync(path.join(tmp, `f-${String(frames++).padStart(5, "0")}.jpg`), Buffer.from(data, "base64")); };
    if (pg.live) {
      // real time: the screen as it plays, each frame kept with its moment, then laid at the film's rate
      await new Promise((r) => setTimeout(r, 1500));
      const times = [];
      const onFrame = async (ev) => { times.push(ev.metadata.timestamp); fs.writeFileSync(path.join(tmp, `f-${String(frames++).padStart(5, "0")}.jpg`), Buffer.from(ev.data, "base64")); await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {}); };
      cdp.on("Page.screencastFrame", onFrame);
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: Math.round(WIDTH * SCALE), maxHeight: Math.round(HEIGHT * SCALE), everyNthFrame: 1 });
      await new Promise((r) => setTimeout(r, pg.live * 1000));
      await cdp.send("Page.stopScreencast").catch(() => {});
      cdp.off("Page.screencastFrame", onFrame);
      // a concat list with each frame's real duration, so uneven delivery still plays at true speed
      const list = times.map((t, i) => `file 'f-${String(i).padStart(5, "0")}.jpg'\nduration ${Math.max(1 / 120, (times[i + 1] ?? t + 1 / FPS) - t).toFixed(4)}`).join("\n");
      fs.writeFileSync(path.join(tmp, "list.txt"), list + `\nfile 'f-${String(times.length - 1).padStart(5, "0")}.jpg'\n`);
      seconds = times.length > 1 ? times[times.length - 1] - times[0] : frames / FPS;
      height = HEIGHT;
    } else {
      height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      const travel = Math.max(0, height - HEIGHT);
      const glide = travel ? Math.min(MAX, travel / SPEED) : 0;
      seconds = HOLD + glide + (travel ? HOLD : HOLD * 0.6);
      const total = Math.round(seconds * FPS);
      for (let i = 0; i < total; i++) {
        const t = i / FPS;
        const k = travel ? Math.min(1, Math.max(0, (t - HOLD) / glide)) : 0;
        const y = Math.round(travel * smoothstep(k));
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await advance(1000 / FPS);
        await shot();
      }
    }
    const file = path.join(out, `film-${pg.name}.mp4`);
    const input = pg.live ? ["-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt")] : ["-framerate", String(FPS), "-i", path.join(tmp, "f-%05d.jpg")];
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-vf", `scale=${Math.round(WIDTH * SCALE)}:${Math.round(HEIGHT * SCALE)}:flags=lanczos,fps=${FPS},format=yuv420p`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-movflags", "+faststart", "-an", file]);
    films.push({ name: pg.name, route: pg.route, url, seconds: Number(seconds.toFixed(2)), height, live: !!pg.live, frames });
    console.log(`${slug}/${pg.name}: ${pg.live ? "live, " : ""}${frames} frames, ${seconds.toFixed(1)} s, page ${height}px → ${path.basename(file)} ${kb(file)}`);
  } catch (e) {
    console.error(`${slug}/${pg.name}: ${String(e.message || e).split("\n")[0]}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    await context.close().catch(() => {});
  }
}
await browser.close();
const manifestFile = path.join(out, "films.json");
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : { films: [] };
const merged = [...previous.films.filter((f) => !films.some((g) => g.name === f.name)), ...films];
fs.writeFileSync(manifestFile, JSON.stringify({ slug, base, shot: new Date().toISOString(), width: Math.round(WIDTH * SCALE), height: Math.round(HEIGHT * SCALE), fps: FPS, films: merged }, null, 2) + "\n");
if (!films.length) { console.error(`${slug}: nothing could be filmed`); process.exit(1); }
