#!/usr/bin/env node
/**
 * The site itself, filmed: a real browser scrolls each page from its top to its foot, slowly, and every
 * frame is captured whole (1920×1080 by default, nothing cropped), so the film shows what a visitor sees:
 * the fixed header staying, the pinned sections pinning, the reveals revealing as they come into view.
 * The page strips prepare.mjs makes cannot do that (a pinned section photographs as a hole, a sticky hero
 * twice), which is why Beacon's first film read as black stretches.
 *
 * Two ways of filming, chosen per page:
 *   under Chromium's virtual time (the default): the clock advances one frame between screenshots and the
 *   scroll position is set for each frame (a smoothstep from the top to the foot: a hold, a glide of at most
 *   --max seconds, a hold), so the capture is deterministic and smooth however slow the machine, and what runs
 *   on the page's own timers (reveals, parallax, counters) runs in step. A <video> on the page does not advance
 *   with virtual time, so a film that should open on a site's own clip takes that clip itself (work.json
 *   film.scenes).
 *   in real time: the page is scrolled by its own animation frames over the same timeline and the screen is
 *   recorded as it plays, through CDP's screencast, at the rate the machine delivers; each frame keeps its
 *   moment, so the film plays at true speed. A page that must be filmed this way (an instrument playing, a
 *   meter moving to sound) takes `|live:<seconds>` after its route (it is clicked where the spec says, then
 *   recorded); and a page whose renderer stalls under virtual time (some do, once scrolled: no screenshot
 *   comes back) is filmed again this way on its own.
 *
 * Writes <out>/film-<name>.mp4 (H.264, 30 fps) per page and <out>/films.json (name, route, seconds,
 * height, how it was filmed). The project's film (scripts/work/video.mjs) cuts these into its scenes.
 *
 * Usage:
 *   node scripts/work/scrollfilm.mjs <slug> <base> [name=route[|click:selector][|live:seconds] …]
 *     [--out dir] [--width 1600 --height 900 --scale 1.2] [--fps 30] [--speed 110] [--max 18]
 *     [--hold 1.6] [--settle 3000] [--ua "<user agent>"] [--realtime]
 *   --width/--height is the browser's window (the page lays out as on a 1600px desktop); --scale makes the
 *   frames 1920×1080. --speed is the glide in page pixels a second, --max its longest run, --hold the seconds
 *   at the top and at the foot, --settle the milliseconds given to a page's own entrance before the first
 *   frame; --realtime films every page the second way from the start. Default out: public/media/work/<slug>/raw
 *   (where video.mjs looks).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { launch } from "../lib/browser.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = (k) => { const i = argv.indexOf(`--${k}`); if (i < 0) return false; argv.splice(i, 1); return true; };
const WIDTH = Number(take("width", 1600)), HEIGHT = Number(take("height", 900)), SCALE = Number(take("scale", 1.2));
const FPS = Number(take("fps", 30)), SPEED = Number(take("speed", 110)), MAX = Number(take("max", 18)), HOLD = Number(take("hold", 1.6));
const SETTLE = Number(take("settle", 3000)), OUT = take("out", null), REALTIME = flag("realtime");
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
const OUTW = Math.round(WIDTH * SCALE), OUTH = Math.round(HEIGHT * SCALE);
const smoothstep = (t) => t * t * (3 - 2 * t);
const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frameName = (n) => `f-${String(n).padStart(5, "0")}.jpg`;
class Stall extends Error {}

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });

/** Open the page in a fresh context: the clock paused when filming under virtual time, running otherwise. */
async function open(pg, virtual) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE, userAgent: UA, ignoreHTTPSErrors: true, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (virtual) await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
  const url = new URL(pg.route, base).href;
  await page.goto(url, { waitUntil: virtual ? "commit" : "load", timeout: 60000 }).catch((e) => console.error(`${slug}/${pg.name}: ${String(e.message).split("\n")[0]}`));
  await sleep(2500); // its files arrive (while the clock stands still, under virtual time)
  // the clock waits for the page's fetches, unless one never ends (a stream, a dev server's socket): after 2.5 s of
  // real time with no progress the page is given its time regardless, for the rest of this film
  let freeRunning = false;
  const advance = async (ms) => {
    if (!virtual) { await sleep(ms); return; }
    let done;
    const expired = new Promise((resolve) => { done = resolve; cdp.once("Emulation.virtualTimeBudgetExpired", resolve); });
    await cdp.send("Emulation.setVirtualTimePolicy", { policy: freeRunning ? "advance" : "pauseIfNetworkFetchesPending", budget: ms, maxVirtualTimeTaskStarvationCount: 100000 });
    const timer = setTimeout(async () => {
      if (freeRunning) return;
      freeRunning = true;
      console.error(`${slug}/${pg.name}: a fetch never finished; the clock runs on without it`);
      await cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: ms, maxVirtualTimeTaskStarvationCount: 100000 }).catch(() => done());
    }, 2500);
    await expired;
    clearTimeout(timer);
  };
  await advance(SETTLE);
  // what sits over the page (a cookie bar, a newsletter) is taken off: Escape, then the fixed layers that name themselves
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") continue;
      const id = `${el.className} ${el.id} ${el.getAttribute("role") || ""}`;
      if (/cookie|consent|gdpr|newsletter|popup|pop-up|modal|subscribe|promo-bar|announcement/i.test(id)) el.style.setProperty("display", "none", "important");
    }
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
  }).catch(() => {});
  if (pg.click) {
    await page.locator(pg.click).first().click({ timeout: 5000, force: true }).catch((e) => console.error(`${slug}/${pg.name}: click ${pg.click}: ${String(e.message).split("\n")[0]}`));
    await advance(SETTLE);
  }
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  return { context, page, cdp, advance, height };
}

/** The timeline of a page: a hold, the glide, a hold (in seconds). */
function timeline(height, scene) {
  const travel = Math.max(0, height - HEIGHT);
  const glide = travel ? Math.min(MAX, travel / SPEED) : 0;
  return { travel, glide, hold: HOLD, tail: travel ? HOLD : HOLD * 0.6, seconds: HOLD + glide + (travel ? HOLD : HOLD * 0.6) };
}

/** Under virtual time: scroll, advance one frame, capture; a screenshot that never comes back is a stall. */
async function filmVirtual(pg, tmp) {
  const { context, page, cdp, advance, height } = await open(pg, true);
  try {
    const tl = timeline(height);
    const total = Math.round(tl.seconds * FPS);
    let frames = 0;
    for (let i = 0; i < total; i++) {
      const t = i / FPS;
      const k = tl.travel ? Math.min(1, Math.max(0, (t - tl.hold) / tl.glide)) : 0;
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(tl.travel * smoothstep(k)));
      await advance(1000 / FPS);
      const shot = await Promise.race([cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, captureBeyondViewport: false }), sleep(4000).then(() => null)]);
      if (!shot) throw new Stall(`no frame after ${frames}`);
      fs.writeFileSync(path.join(tmp, frameName(frames++)), Buffer.from(shot.data, "base64"));
    }
    return { frames, seconds: tl.seconds, height, how: "virtual time" };
  } finally {
    await context.close().catch(() => {});
  }
}

/** In real time: the screencast records while the page plays (a demo) or scrolls itself over the timeline. */
async function filmRealTime(pg, tmp, live) {
  const { context, page, cdp, height } = await open(pg, false);
  try {
    const times = [];
    let frames = 0;
    const onFrame = async (ev) => {
      times.push(ev.metadata.timestamp);
      fs.writeFileSync(path.join(tmp, frameName(frames++)), Buffer.from(ev.data, "base64"));
      await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
    };
    cdp.on("Page.screencastFrame", onFrame);
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: OUTW, maxHeight: OUTH, everyNthFrame: 1 });
    let seconds;
    if (live) {
      await sleep(live * 1000);
      seconds = live;
    } else {
      const tl = timeline(height);
      seconds = tl.seconds;
      // the page scrolls itself, frame by frame of its own clock, along the same hold–glide–hold
      await page.evaluate(({ travel, hold, glide, seconds }) => new Promise((resolve) => {
        const t0 = performance.now();
        const step = (now) => {
          const t = (now - t0) / 1000;
          const k = travel ? Math.min(1, Math.max(0, (t - hold) / glide)) : 0;
          window.scrollTo(0, Math.round(travel * k * k * (3 - 2 * k)));
          if (t < seconds) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      }), tl);
    }
    await cdp.send("Page.stopScreencast").catch(() => {});
    cdp.off("Page.screencastFrame", onFrame);
    if (!times.length) throw new Error("the screencast delivered no frame");
    // a concat list with each frame's real duration, so uneven delivery still plays at true speed
    const list = times.map((t, i) => `file '${frameName(i)}'\nduration ${Math.max(1 / 120, (times[i + 1] ?? t + 1 / FPS) - t).toFixed(4)}`).join("\n");
    fs.writeFileSync(path.join(tmp, "list.txt"), list + `\nfile '${frameName(times.length - 1)}'\n`);
    return { frames, seconds, height, how: live ? "real time, playing" : "real time, scrolling" };
  } finally {
    await context.close().catch(() => {});
  }
}

const films = [];
for (const pg of pages) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `qw-film-${slug}-${pg.name}-`));
  try {
    let result;
    if (pg.live) result = await filmRealTime(pg, tmp, pg.live);
    else if (REALTIME) result = await filmRealTime(pg, tmp, 0);
    else {
      try { result = await filmVirtual(pg, tmp); }
      catch (e) {
        if (!(e instanceof Stall)) throw e;
        console.error(`${slug}/${pg.name}: the renderer stalled under virtual time (${e.message}); filmed in real time instead`);
        for (const f of fs.readdirSync(tmp)) fs.rmSync(path.join(tmp, f));
        result = await filmRealTime(pg, tmp, 0);
      }
    }
    const file = path.join(out, `film-${pg.name}.mp4`);
    const input = fs.existsSync(path.join(tmp, "list.txt")) ? ["-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt")] : ["-framerate", String(FPS), "-i", path.join(tmp, "f-%05d.jpg")];
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-vf", `scale=${OUTW}:${OUTH}:flags=lanczos,fps=${FPS},format=yuv420p`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-movflags", "+faststart", "-an", file]);
    films.push({ name: pg.name, route: pg.route, url: new URL(pg.route, base).href, seconds: Number(result.seconds.toFixed(2)), height: result.height, frames: result.frames, how: result.how });
    console.log(`${slug}/${pg.name}: ${result.frames} frames, ${result.seconds.toFixed(1)} s, page ${result.height}px, ${result.how} → ${path.basename(file)} ${kb(file)}`);
  } catch (e) {
    console.error(`${slug}/${pg.name}: ${String(e.message || e).split("\n")[0]}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
await browser.close();
const manifestFile = path.join(out, "films.json");
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : { films: [] };
const merged = [...previous.films.filter((f) => !films.some((g) => g.name === f.name)), ...films];
fs.writeFileSync(manifestFile, JSON.stringify({ slug, base, shot: new Date().toISOString(), width: OUTW, height: OUTH, fps: FPS, films: merged }, null, 2) + "\n");
if (!films.length) { console.error(`${slug}: nothing could be filmed`); process.exit(1); }
