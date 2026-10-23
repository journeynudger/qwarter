#!/usr/bin/env node
/**
 * The site itself, filmed: a real browser scrolls each page from its top to its foot, slowly, and every
 * frame is captured whole (1920×1080 by default, nothing cropped), so the film shows what a visitor sees:
 * the fixed header staying, the pinned sections pinning, the reveals revealing as they come into view.
 * The page strips prepare.mjs makes cannot do that (a pinned section photographs as a hole, a sticky hero
 * twice), which is why Beacon's first film read as black stretches.
 *
 * Two ways of filming, chosen per page:
 *   frame by frame (the default), in Chromium's headless shell under BeginFrame control and virtual time: for
 *   each frame the scroll position is set (a smoothstep down the page: a hold, a glide at --speed px/s for at most
 *   --max seconds, so a tall page is not scrolled to its foot, a hold), the page's clock is advanced by one frame, and one composited frame is asked for
 *   and taken as the picture (HeadlessExperimental.beginFrame), so the capture is deterministic and smooth
 *   however slow the machine, and what runs on the page's own clock and animation frames (reveals, parallax,
 *   counters, a canvas drawing itself) runs in step. Plain screenshots under paused virtual time could not do
 *   this: on any page that animates, the compositor waits for a frame the paused clock never drives and the
 *   second screenshot never comes back (2026-10-23). A <video> on the page does not advance with virtual time,
 *   so a film that should open on a site's own clip takes that clip itself (work.json film.scenes).
 *   in real time, in the full browser: the page is scrolled by its own animation frames over the same timeline
 *   and the screen is recorded as it plays, through CDP's screencast, at the rate the machine delivers; each
 *   frame keeps its moment, so the film plays at true speed. A page that must be filmed this way (an instrument
 *   playing, a meter moving to sound) takes `|live:<seconds>` after its route (it is clicked where the spec
 *   says, then recorded; `|play:C4,E4,G4` presses those keys in turn while it records, by their accessible
 *   names, as a hand would); --realtime films every page this way; and a page that still gives no frame the
 *   first way within 15 s is filmed again this way on its own.
 * Before either, the page is warmed: a pass down to its foot and back, so what loads as it comes into view is there
 * before the film starts; `|cold` after a route films the first visit instead, placeholders, reveals and all.
 *
 * Writes <out>/film-<name>.mp4 (H.264, 30 fps) per page and <out>/films.json (name, route, seconds,
 * height, how it was filmed). The project's film (scripts/work/video.mjs) cuts these into its scenes.
 *
 * Usage:
 *   node scripts/work/scrollfilm.mjs <slug> <base> [name=route[|click:selector][|live:seconds][|play:keys][|cold] …]
 *     [--out dir] [--width 1600 --height 900 --scale 1.2] [--fps 30] [--speed 110] [--max 18]
 *     [--hold 1.6] [--settle 3000] [--ua "<user agent>"] [--realtime] [--page-timeout 420] [--trace]
 *   --width/--height is the browser's window (the page lays out as on a 1600px desktop); --scale makes the
 *   frames 1920×1080. --speed is the glide in page pixels a second, --max its longest run, --hold the seconds
 *   at the top and at the foot, --settle the milliseconds given to a page's own entrance before the first
 *   frame; --page-timeout the seconds an attempt at a page may take before it is given up (every step answers within
 *   seconds or the page is filmed the other way; a page that will not be filmed either way is skipped, not waited
 *   for); --trace prints each step with its time, for a runner's log. Default out: public/media/work/<slug>/raw
 *   (where video.mjs looks).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { launch, launchHeadlessShell } from "../lib/browser.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = (k) => { const i = argv.indexOf(`--${k}`); if (i < 0) return false; argv.splice(i, 1); return true; };
const WIDTH = Number(take("width", 1600)), HEIGHT = Number(take("height", 900)), SCALE = Number(take("scale", 1.2));
const FPS = Number(take("fps", 30)), SPEED = Number(take("speed", 110)), MAX = Number(take("max", 18)), HOLD = Number(take("hold", 1.6));
const SETTLE = Number(take("settle", 3000)), OUT = take("out", null), REALTIME = flag("realtime");
const PAGE_TIMEOUT = Number(take("page-timeout", 420)) * 1000, TRACE = flag("trace");
const UA = take("ua", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
const [slug, base, ...specs] = argv;
if (!slug || !base) { console.error("Usage: node scripts/work/scrollfilm.mjs <slug> <base> [name=route[|click:selector][|live:seconds][|play:keys][|cold] …] [--out dir]"); process.exit(2); }
const out = OUT ? path.resolve(OUT) : path.join("public/media/work", slug, "raw");
fs.mkdirSync(out, { recursive: true });
const pages = (specs.length ? specs : ["home=/"]).map((s) => {
  const [name, rest] = s.split("=");
  const parts = (rest || "/").split("|");
  const page = { name, route: parts[0] };
  for (const p of parts.slice(1)) {
    const i = p.indexOf(":");
    const [k, v] = i < 0 ? [p, ""] : [p.slice(0, i), p.slice(i + 1)];
    if (k === "click") page.click = v;
    if (k === "cold") page.cold = true; // filmed as a first visit: nothing loaded or revealed before the film starts
    if (k === "live") page.live = Number(v);
    if (k === "play") page.play = v.split(",").filter(Boolean); // the keys to press in turn while it plays, by their accessible names
  }
  return page;
});
const OUTW = Math.round(WIDTH * SCALE), OUTH = Math.round(HEIGHT * SCALE);
const smoothstep = (t) => t * t * (3 - 2 * t);
const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frameName = (n) => `f-${String(n).padStart(5, "0")}.jpg`;
class Stall extends Error {}
const started = Date.now();
const trace = (msg) => { if (TRACE) console.error(`  [${((Date.now() - started) / 1000).toFixed(1)} s] ${msg}`); };
/**
 * A step that must answer within ms, else the page is stalled (filmed the other way, or given up). The first films on
 * the runner hung a whole site in one page.evaluate for the step's 25 minutes; nothing waits without a limit now.
 */
const within = (ms, what, promise) => {
  promise.catch(() => {}); // an abandoned step's late failure is not an unhandled rejection
  return Promise.race([promise, sleep(ms).then(() => { throw new Stall(`${what} did not answer within ${ms / 1000} s`); })]);
};
let current = null; // the context being filmed, closed by the watchdog when its page is given up

const FRAME = 1000 / FPS;
const MEDIA = ["--autoplay-policy=no-user-gesture-required", "--mute-audio"];
// Chromium's deterministic mode: frames only when asked for, every stage of a frame finished before it is drawn,
// animation and scrolling on the main thread, so a frame is exactly the page at that moment
const DETERMINISTIC = ["--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-new-content-rendering-timeout",
  "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging", "--disable-image-animation-resync"];
// two browsers, each started when first needed: the headless shell for frame-by-frame filming (the only build with
// BeginFrame control), the full browser for real time (its compositor runs on its own, as the screencast needs)
const browsers = {};
const browserFor = async (virtual) => (browsers[virtual ? "shell" : "full"] ??= await (virtual ? launchHeadlessShell({ args: [...DETERMINISTIC, ...MEDIA] }) : launch({ args: MEDIA })));

/**
 * Open the page in a fresh context: under virtual time (the shell, the clock paused, frames on request) or in real
 * time (the full browser). Gives back advance(ms), the page's clock moved on by ms, and frame(shot), one composited
 * frame at the clock's moment (its picture when shot is true; nothing when nothing changed).
 */
async function open(pg, virtual) {
  const browser = await browserFor(virtual);
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE, userAgent: UA, ignoreHTTPSErrors: true, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  current = { context };
  trace(`${pg.name}: context open (${virtual ? "frame by frame" : "real time"})`);
  // the frame clock keeps to the page's own: BeginFrame times are the renderer's ticks, which virtual time counts
  // from the moment it was enabled, so every animation frame reads the time performance.now() reads
  let ticks = 0, elapsed = 0;
  if (virtual) ticks = (await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" })).virtualTimeTicksBase;
  const url = new URL(pg.route, base).href;
  await page.goto(url, { waitUntil: virtual ? "commit" : "load", timeout: 60000 }).catch((e) => console.error(`${slug}/${pg.name}: ${String(e.message).split("\n")[0]}`));
  trace(`${pg.name}: navigated`);
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
    try { await within(20000, "the page's clock", expired); } finally { clearTimeout(timer); }
    elapsed += ms;
  };
  let lastFrameAt = -1;
  const frame = async (shot) => {
    if (!virtual) return {};
    // a frame needs a moment of its own: asked for twice at one time, the second never comes (and every frame after
    // it answers "another frame is pending"), so when the clock has not moved since the last one it moves one frame
    if (elapsed <= lastFrameAt) await advance(FRAME);
    lastFrameAt = elapsed;
    const r = await Promise.race([
      cdp.send("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks + elapsed, interval: FRAME, noDisplayUpdates: false, ...(shot ? { screenshot: { format: "jpeg", quality: 92 } } : {}) }),
      sleep(15000).then(() => null),
    ]);
    if (!r) throw new Stall("no frame within 15 s");
    return r;
  };
  // the page's first frames: its first paint, then what that paint asks for (lazy pictures, fonts) and its entrance
  await frame(false);
  await advance(SETTLE);
  await frame(false);
  trace(`${pg.name}: settled`);
  // what sits over the page (a cookie bar, a newsletter) is taken off: Escape, then the fixed layers that name themselves
  await Promise.race([page.keyboard.press("Escape"), sleep(2000)]).catch(() => {});
  await within(10000, "the page (clearing what sits over it)", page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") continue;
      const id = `${el.className} ${el.id} ${el.getAttribute("role") || ""}`;
      if (/cookie|consent|gdpr|newsletter|popup|pop-up|modal|subscribe|promo-bar|announcement/i.test(id)) el.style.setProperty("display", "none", "important");
    }
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
  })).catch((e) => { if (e instanceof Stall) throw e; });
  trace(`${pg.name}: cleared`);
  if (pg.click) {
    // under virtual time the element is clicked by the page itself (the mouse would wait on frames the paused clock
    // does not give); in real time, by the mouse
    const target = page.locator(pg.click).first();
    await within(8000, "the click", virtual ? target.evaluate((el) => el.click(), undefined, { timeout: 5000 }) : target.click({ timeout: 5000, force: true }))
      .catch((e) => { if (e instanceof Stall) throw e; console.error(`${slug}/${pg.name}: click ${pg.click}: ${String(e.message).split("\n")[0]}`); });
    await frame(false);
    await advance(SETTLE);
    await frame(false);
    trace(`${pg.name}: clicked ${pg.click}`);
  }
  // the page warmed: a pass down to its foot and back, so what loads as it comes into view (lazy pictures, fonts,
  // a reveal that runs once) is there before the film starts and nothing is filmed as a placeholder (The Room's wall
  // filmed cold showed ovals of initials where its busts were still loading); `|cold` films the first visit instead
  const measure = () => within(10000, "the page (measuring it)", page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
  const scrollTo = (y) => within(10000, "the page (scrolling it)", page.evaluate((y) => window.scrollTo(0, y), y));
  if (!pg.cold && !pg.live) { // a live page is recorded where its click left it
    for (let y = 0, h = await measure(); y < h && y < 40000; y += Math.round(HEIGHT * 0.75)) {
      await scrollTo(y);
      await advance(virtual ? 200 : 400);
      await frame(false);
      h = await measure();
    }
    await scrollTo(0);
    await advance(SETTLE);
    await frame(false);
    trace(`${pg.name}: warmed`);
  }
  const height = await measure();
  trace(`${pg.name}: ${height}px`);
  return { context, page, cdp, advance, frame, scrollTo, height };
}

/** The timeline of a page: a hold, the glide, a hold (in seconds). */
function timeline(height) {
  // at the pace, for at most MAX seconds: a tall page is not scrolled to its foot (the first films covered the whole
  // page within the time, so a tall home went at 400 px/s; the pace is the point, Lorenzo, 2026-10-23: "much slower")
  const travel = Math.min(Math.max(0, height - HEIGHT), SPEED * MAX);
  const glide = travel / SPEED;
  return { travel, glide, hold: HOLD, tail: travel ? HOLD : HOLD * 0.6, seconds: HOLD + glide + (travel ? HOLD : HOLD * 0.6) };
}

/** Frame by frame: scroll, move the clock on by one frame, ask for that frame; a frame that never comes is a stall. */
async function filmVirtual(pg, tmp) {
  const { context, advance, frame, scrollTo, height } = await open(pg, true);
  try {
    const tl = timeline(height);
    const total = Math.round(tl.seconds * FPS);
    let frames = 0, last = null;
    for (let i = 0; i < total; i++) {
      const t = i / FPS;
      const k = tl.travel ? Math.min(1, Math.max(0, (t - tl.hold) / tl.glide)) : 0;
      await scrollTo(Math.round(tl.travel * smoothstep(k)));
      await advance(FRAME);
      if (i % 100 === 0) trace(`${pg.name}: frame ${i} of ${total}`);
      let r = await frame(true).catch((e) => { throw new Stall(`${e.message} after ${frames}`); });
      if (!r.screenshotData && !last) r = await frame(true); // nothing drawn yet: once more
      if (r.screenshotData) last = Buffer.from(r.screenshotData, "base64"); // else the page did not change: the last picture again
      if (!last) throw new Stall(`no picture after ${frames}`);
      fs.writeFileSync(path.join(tmp, frameName(frames++)), last);
    }
    return { frames, seconds: tl.seconds, height, how: "frame by frame" };
  } finally {
    await Promise.race([context.close(), sleep(5000)]).catch(() => {});
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
      const end = Date.now() + live * 1000;
      if (pg.play?.length) {
        // a hand on the keys: each pressed with the mouse for a beat, the phrase over and over while the film runs
        await sleep(1500);
        for (let i = 0; Date.now() < end - 900; i++) {
          const name = pg.play[i % pg.play.length];
          await page.locator(`[aria-label="${name}"]`).first().hover({ timeout: 2000 })
            .then(async () => { await page.mouse.down(); await sleep(420); await page.mouse.up(); })
            .catch((e) => console.error(`${slug}/${pg.name}: key ${name}: ${String(e.message).split("\n")[0]}`));
          await sleep(330);
        }
      }
      await sleep(Math.max(0, end - Date.now()));
      seconds = live;
    } else {
      const tl = timeline(height);
      seconds = tl.seconds;
      // the page scrolls itself, frame by frame of its own clock, along the same hold–glide–hold
      await within((tl.seconds + 10) * 1000, "the page's own scroll", page.evaluate(({ travel, hold, glide, seconds }) => new Promise((resolve) => {
        const t0 = performance.now();
        const step = (now) => {
          const t = (now - t0) / 1000;
          const k = travel ? Math.min(1, Math.max(0, (t - hold) / glide)) : 0;
          window.scrollTo(0, Math.round(travel * k * k * (3 - 2 * k)));
          if (t < seconds) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      }), tl)).catch((e) => { if (!(e instanceof Stall)) throw e; console.error(`${slug}/${pg.name}: ${e.message}; the film ends with what was recorded`); });
    }
    trace(`${pg.name}: recorded ${frames} frames`);
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
    // each attempt has the page's whole time budget; a stalled attempt's context is closed and its browser let go
    const attempt = async (how, run) => {
      try { return await within(PAGE_TIMEOUT, `${how}: the page`, run()); }
      catch (e) {
        if (!(e instanceof Stall)) throw e;
        await Promise.race([current?.context.close(), sleep(5000)]).catch(() => {});
        const key = how === "frame by frame" ? "shell" : "full";
        await Promise.race([browsers[key]?.close(), sleep(5000)]).catch(() => {});
        browsers[key] = null;
        throw e;
      }
    };
    if (pg.live) result = await attempt("real time", () => filmRealTime(pg, tmp, pg.live));
    else if (REALTIME) result = await attempt("real time", () => filmRealTime(pg, tmp, 0));
    else {
      try { result = await attempt("frame by frame", () => filmVirtual(pg, tmp)); }
      catch (e) {
        if (!(e instanceof Stall)) throw e;
        console.error(`${slug}/${pg.name}: no frame came frame by frame (${e.message}); filmed in real time instead`);
        for (const f of fs.readdirSync(tmp)) fs.rmSync(path.join(tmp, f));
        result = await attempt("real time", () => filmRealTime(pg, tmp, 0));
      }
    }
    const file = path.join(out, `film-${pg.name}.mp4`);
    const input = fs.existsSync(path.join(tmp, "list.txt")) ? ["-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt")] : ["-framerate", String(FPS), "-i", path.join(tmp, "f-%05d.jpg")];
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-vf", `scale=${OUTW}:${OUTH}:flags=lanczos,fps=${FPS},format=yuv420p`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-movflags", "+faststart", "-an", file]);
    films.push({ name: pg.name, route: pg.route, url: new URL(pg.route, base).href, seconds: Number(result.seconds.toFixed(2)), height: result.height, frames: result.frames, how: result.how });
    console.log(`${slug}/${pg.name}: ${result.frames} frames, ${result.seconds.toFixed(1)} s, page ${result.height}px, ${result.how} → ${path.basename(file)} ${kb(file)}`);
  } catch (e) {
    console.error(`${slug}/${pg.name}: ${e instanceof Stall ? `given up: ${e.message}` : String(e.message || e).split("\n")[0]}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
for (const b of Object.values(browsers)) if (b) await Promise.race([b.close(), sleep(5000)]).catch(() => {});
const manifestFile = path.join(out, "films.json");
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : { films: [] };
const merged = [...previous.films.filter((f) => !films.some((g) => g.name === f.name)), ...films];
fs.writeFileSync(manifestFile, JSON.stringify({ slug, base, shot: new Date().toISOString(), width: OUTW, height: OUTH, fps: FPS, films: merged }, null, 2) + "\n");
if (!films.length) { console.error(`${slug}: nothing could be filmed`); process.exit(1); }
