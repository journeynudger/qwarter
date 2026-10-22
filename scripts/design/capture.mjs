#!/usr/bin/env node
/**
 * Capture a live website completely enough to study it and carry it across offline.
 *
 * Built for the reference design (synchronized.studio) and reused for qwarter.com's
 * rendered pages. Nothing here writes into the site: everything lands in --out, and
 * scripts/design/extract.mjs (or a person) decides what crosses into public/ and content/.
 *
 * For every route it finds (links in the rendered pages, sitemap.xml, robots.txt):
 *   routes/<slug>/server.html        the document exactly as the server sent it
 *   routes/<slug>/initial.html       the DOM right after load, before any scrolling
 *   routes/<slug>/rendered.html      the DOM after a full scroll pass (lazy content loaded, reveals run)
 *   routes/<slug>/head.json          <head> and end-of-body assets, in document order (from server.html)
 *   routes/<slug>/layout-<w>.json    every visible element: box, and the computed styles that make the look
 *   routes/<slug>/frames/<w>-NNN.png the viewport, step by step through the page, scrolled the way a visitor
 *                                    scrolls (wheel events, so smooth-scroll libraries move as they do for people)
 *   routes/<slug>/intro/NNN.png      the first seconds after load (preloaders, intro animations)
 *   routes/<slug>/full-<w>.png       one full-page screenshot (may be imperfect under smooth scrolling)
 *   routes/<slug>/hover.json + hover/NNN-{before,after}.png
 *                                    each link, button and card: what changes when the pointer is on it
 *   routes/<slug>/cursor.json + cursor/NNN.png
 *                                    elements that follow the pointer (a custom cursor), and how they change
 *                                    over links, buttons, cards and media
 *   routes/<slug>/menu-<w>.png        the menu, opened
 *   files/<host>/<path>              every response: CSS, JS, fonts, images, video, JSON
 *   urls.json                        URL → saved file, status, type, size, which routes used it
 *   manifest.json                    routes, detected stack (Webflow, Next, GSAP, Lenis…), fonts, tokens
 *   report.md                        the same, for people
 *
 * Usage:
 *   node scripts/design/capture.mjs --origin https://synchronized.studio [--out .design-cache/synchronized]
 *     [--max 200] [--widths 1440,390] [--only /,/work/] [--frames 40] [--force] [--video]
 *     [--budget 1500] (seconds for the whole run; it stops taking routes and fetching media when spent, and
 *     still writes the manifest, URL index and report; a SIGTERM does the same) [--media-max 95] (MB)
 *     [--lean]   the documents, assets, layout and scroll frames only: no intro frames, no pointer,
 *                hover or menu probes (a first pass in minutes; the full capture can follow)
 * Re-running skips routes already captured unless --force.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";
import {
  assetsOf, breakpointsOf, cursorProbe, detectStack, dismissOverlays, fontsOf, hoverProbe, layoutOf, menuProbe, scrollThrough, scrollToTop,
  sleep, writeJson,
} from "../lib/probes.mjs";
import { slugOf } from "../lib/routes.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

const ORIGIN = (opt("origin", "https://synchronized.studio") || "").replace(/\/$/, "");
const ORIGIN_URL = new URL(ORIGIN);
const OUT = opt("out", path.join(".design-cache", ORIGIN_URL.hostname.replace(/^www\./, "").split(".")[0]));
const MAX = Number(opt("max", 200));
const WIDTHS = opt("widths", "1440,390").split(",").map(Number);
const MAX_FRAMES = Number(opt("frames", 40));
const LEAN = flag("lean");
const BUDGET = Number(opt("budget", 0)); // seconds for the whole run; 0 = no limit
const MEDIA_MAX = Number(opt("media-max", 95)) * 1e6; // a file fetched whole is dropped above this (GitHub refuses 100 MB)
const DEADLINE = BUDGET ? Date.now() + BUDGET * 1000 : Infinity;
const timeLeft = () => Math.max(0, DEADLINE - Date.now());
const ONLY = opt("only") ? opt("only").split(",") : null;
const FORCE = flag("force");
const UA_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const UA_PHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ------------------------------------------------------------------ URLs and files

const sameSite = (u) => u.hostname.replace(/^www\./, "") === ORIGIN_URL.hostname.replace(/^www\./, "");
const SKIP_EXT = /\.(pdf|zip|jpe?g|png|gif|webp|avif|svg|mp4|webm|mov|mp3|wav|ics|xml|txt|json|css|js|woff2?|ttf|otf)$/i;

function normalizeRoute(href, base) {
  let u;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !sameSite(u)) return null;
  if (SKIP_EXT.test(u.pathname)) return null;
  // one spelling per page: no hash, no tracking query
  return u.pathname + (u.search && !/utm_|fbclid|gclid/.test(u.search) ? u.search : "");
}

/** Where a response body is saved: files/<host>/<path>, with a short hash for a query string. */
function fileFor(url) {
  const u = new URL(url);
  let p;
  try {
    p = decodeURIComponent(u.pathname);
  } catch {
    p = u.pathname;
  }
  // a name without an extension is always a folder here, so /work and /work/alpha can both be saved
  if (p.endsWith("/")) p += "index.html";
  else if (!path.extname(p)) p += "/__index";
  if (u.search) {
    const h = crypto.createHash("sha1").update(u.search).digest("hex").slice(0, 8);
    const ext = path.extname(p);
    p = ext ? `${p.slice(0, -ext.length)}__q${h}${ext}` : `${p}__q${h}`;
  }
  p = p.replace(/[^a-zA-Z0-9/_.\-@%+~]/g, "_").replace(/\/\.\.?(?=\/|$)/g, "/_");
  return path.join("files", u.hostname, p);
}

const urls = fs.existsSync(path.join(OUT, "urls.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "urls.json"), "utf8")) : {};
const partial = new Set(); // media that streamed (206) and must be fetched whole afterwards

function record(url, status, type, body, route) {
  const entry = (urls[url] ||= { file: null, status, type, bytes: 0, routes: [] });
  if (!entry.routes.includes(route)) entry.routes.push(route);
  entry.status = status;
  entry.type = type;
  if (body) {
    const rel = fileFor(url);
    try {
      const abs = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
      entry.file = rel;
      entry.bytes = body.length;
    } catch (err) {
      // never let one odd URL stop the crawl; it is listed in urls.json without a file
      console.error(`could not save ${url}: ${String(err).split("\n")[0]}`);
    }
  }
}

// ------------------------------------------------------------------ the crawl

async function sitemapRoutes(context) {
  const found = new Set();
  const get = async (u) => {
    const res = await context.request.get(u, { timeout: 30000 }).catch(() => null);
    return res && res.ok() ? res.text() : "";
  };
  const robots = await get(`${ORIGIN}/robots.txt`);
  const maps = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  if (!maps.length) maps.push(`${ORIGIN}/sitemap.xml`, `${ORIGIN}/sitemap_index.xml`);
  const seen = new Set();
  while (maps.length && seen.size < 30) {
    const m = maps.shift();
    if (seen.has(m)) continue;
    seen.add(m);
    const xml = await get(m);
    for (const loc of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const u = loc[1].replace(/&amp;/g, "&");
      if (/\.xml(\?|$)/.test(u)) maps.push(u);
      else {
        const r = normalizeRoute(u, ORIGIN);
        if (r) found.add(r);
      }
    }
  }
  return [...found];
}

async function captureRoute(browser, route, manifest) {
  const slug = slugOf(route);
  const dir = path.join(OUT, "routes", slug);
  if (!FORCE && fs.existsSync(path.join(dir, "done.json"))) {
    log("skip (captured)", route);
    return JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8")).links || [];
  }
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  fs.mkdirSync(path.join(dir, "intro"), { recursive: true });
  const url = ORIGIN + route;
  const summary = { route, slug, url, widths: {} };
  let links = [];

  for (const width of WIDTHS) {
    const phone = width < 700;
    const context = await browser.newContext({
      viewport: { width, height: phone ? 844 : 900 },
      deviceScaleFactor: phone ? 2 : 1,
      isMobile: phone,
      hasTouch: phone,
      userAgent: phone ? UA_PHONE : UA_DESKTOP,
      recordVideo: flag("video") ? { dir: path.join(dir, `video-${width}`), size: { width, height: phone ? 844 : 900 } } : undefined,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
    page.on("response", async (res) => {
      const u = res.url();
      if (!/^https?:/.test(u)) return;
      const status = res.status();
      const type = (res.headers()["content-type"] || "").split(";")[0];
      if (status === 206) {
        partial.add(u);
        record(u, status, type, null, route);
        return;
      }
      if (status >= 300 && status < 400) {
        record(u, status, type, null, route);
        return;
      }
      const body = await res.body().catch(() => null);
      record(u, status, type, body, route);
    });

    // 1. load, and the first seconds of it (preloaders and intro animations), desktop only
    const started = Date.now();
    const response = await page.goto(url, { waitUntil: "commit", timeout: 90000 }).catch((e) => {
      errors.push(`goto: ${e}`);
      return null;
    });
    if (!phone && !LEAN) {
      for (let k = 0; k < 16; k++) {
        await page.screenshot({ path: path.join(dir, "intro", `${String(k).padStart(3, "0")}.png`) }).catch(() => {});
        await sleep(250);
      }
    }
    await page.waitForLoadState("load", { timeout: 60000 }).catch(() => {});
    // a page that streams video never goes idle: a short wait, then on
    await page.waitForLoadState("networkidle", { timeout: LEAN ? 3000 : 15000 }).catch(() => {});
    await sleep(1500);
    await dismissOverlays(page);
    const status = response?.status() ?? 0;

    if (width === WIDTHS[0]) {
      // the document as served, and the assets in the order it lists them
      const serverHtml = response ? await response.text().catch(() => "") : "";
      fs.writeFileSync(path.join(dir, "server.html"), serverHtml);
      if (serverHtml) writeJson(path.join(dir, "head.json"), await page.evaluate(assetsOf, serverHtml));
      fs.writeFileSync(path.join(dir, "initial.html"), await page.content());
      summary.stack = await page.evaluate(detectStack);
      summary.title = await page.title();
      summary.status = status;
      summary.loadMs = Date.now() - started;
    }

    // 2. the scroll-through, frame by frame
    const frames = await scrollThrough(page, path.join(dir, "frames"), width, MAX_FRAMES);
    if (width === WIDTHS[0]) {
      fs.writeFileSync(path.join(dir, "rendered.html"), await page.content());
      links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
    }
    await scrollToTop(page);

    // 3. measurements at the top of the page, everything revealed
    writeJson(path.join(dir, `layout-${width}.json`), await page.evaluate(layoutOf));
    await page.screenshot({ path: path.join(dir, `full-${width}.png`), fullPage: true, timeout: 60000 }).catch((e) => errors.push(`full: ${e}`));

    // 4. pointer and menu (the pointer only where there is one)
    if (!phone) {
      if (!LEAN) {
        summary.cursorFollowers = await cursorProbe(page, path.join(dir, "cursor")).catch((e) => (errors.push(`cursor: ${e}`), 0));
        await scrollToTop(page);
        summary.hovers = await hoverProbe(page, path.join(dir, "hover")).catch((e) => (errors.push(`hover: ${e}`), 0));
        await scrollToTop(page);
      }
      if (route === "/") {
        summary.fonts = await page.evaluate(fontsOf);
        summary.breakpoints = await page.evaluate(breakpointsOf);
      }
    }
    summary.widths[width] = { frames, menu: LEAN ? false : await menuProbe(page, path.join(dir, `menu-${width}.png`)).catch(() => false), errors };
    await context.close();
  }

  const resolved = [...new Set(links.map((h) => normalizeRoute(h, url)).filter(Boolean))];
  writeJson(path.join(dir, "done.json"), { ...summary, links: resolved });
  manifest.routes[route] = summary;
  log(`captured ${route}  ${summary.status}  "${summary.title}"  frames ${Object.values(summary.widths).map((w) => w.frames).join("/")}  followers ${summary.cursorFollowers ?? "-"}  hovers ${summary.hovers ?? "-"}`);
  return resolved;
}

async function fetchWhole(browser) {
  // media that only ever streamed in ranges (video), fetched whole for the archive: each within two
  // minutes and the run's budget, and only kept under MEDIA_MAX (a site that plays a film on every page
  // can hold hours of this; what matters is on the branch either way)
  if (!partial.size) return;
  const context = await browser.newContext({ userAgent: UA_DESKTOP });
  for (const u of partial) {
    if (urls[u]?.file) continue;
    if (timeLeft() < 15000) { log(`budget spent: ${partial.size} ranged media left unfetched`); break; }
    const res = await context.request.get(u, { timeout: Math.min(120000, timeLeft()) }).catch(() => null);
    if (res && res.ok()) {
      const body = await res.body().catch(() => null);
      if (!body) continue;
      if (body.length > MEDIA_MAX) { log(`not kept ${u}: ${(body.length / 1e6).toFixed(0)} MB`); continue; }
      record(u, res.status(), (res.headers()["content-type"] || "").split(";")[0], body, urls[u]?.routes?.[0] ?? "/");
      log(`fetched whole ${u} (${(body.length / 1e6).toFixed(1)} MB)`);
    }
  }
  await context.close();
}

/** Assets a stylesheet points at (fonts, background images) that no page view happened to request. */
async function fetchCssReferences(browser) {
  const context = await browser.newContext({ userAgent: UA_DESKTOP });
  for (const [u, entry] of Object.entries(urls)) {
    if (!entry.file || !/css/.test(entry.type)) continue;
    const css = fs.readFileSync(path.join(OUT, entry.file), "utf8");
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (m[1].startsWith("data:")) continue;
      let abs;
      try {
        abs = new URL(m[1], u).href;
      } catch {
        continue;
      }
      if (urls[abs]?.file) continue;
      if (timeLeft() < 5000) break;
      const res = await context.request.get(abs, { timeout: Math.min(60000, timeLeft()) }).catch(() => null);
      if (res && res.ok()) record(abs, res.status(), (res.headers()["content-type"] || "").split(";")[0], await res.body(), entry.routes[0]);
    }
  }
  await context.close();
}

function report(manifest) {
  const routes = Object.values(manifest.routes);
  const home = manifest.routes["/"] || routes[0] || {};
  const stack = Object.entries(home.stack || {})
    .filter(([k, v]) => v && k !== "scripts")
    .map(([k, v]) => (v === true ? k : `${k} ${v}`));
  const byType = {};
  for (const e of Object.values(urls)) {
    const t = (e.type || "other").split("/")[0] + (e.type?.includes("css") ? " (css)" : e.type?.includes("javascript") ? " (js)" : "");
    byType[t] = byType[t] || { n: 0, bytes: 0 };
    byType[t].n++;
    byType[t].bytes += e.bytes || 0;
  }
  const lines = [
    `# Capture of ${ORIGIN}`,
    "",
    `Captured ${manifest.captured} · ${routes.length} routes · widths ${WIDTHS.join(", ")}`,
    "",
    `**Built with:** ${stack.join(", ") || "nothing recognised"}`,
    "",
    "## Routes",
    "",
    "| Route | Status | Title | Frames | Cursor followers | Hovers |",
    "|---|---|---|---|---|---|",
    ...routes.map((r) => `| ${r.route} | ${r.status} | ${(r.title || "").replace(/\|/g, "/")} | ${Object.values(r.widths || {}).map((w) => w.frames).join(" / ")} | ${r.cursorFollowers ?? "-"} | ${r.hovers ?? "-"} |`),
    "",
    "## Files",
    "",
    "| Type | Files | MB |",
    "|---|---|---|",
    ...Object.entries(byType).map(([t, v]) => `| ${t} | ${v.n} | ${(v.bytes / 1e6).toFixed(2)} |`),
    "",
    "## Fonts",
    "",
    ...((home.fonts?.faces || []).filter((f) => f.family).map((f) => `- ${f.family} ${f.weight || ""} ${f.style || ""}: ${(f.src || "").slice(0, 140)}`)),
    "",
    "## Breakpoints",
    "",
    ...((home.breakpoints || []).map((b) => `- ${b}`)),
    "",
  ];
  fs.writeFileSync(path.join(OUT, "report.md"), lines.join("\n"));
}

// ------------------------------------------------------------------ main

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const manifestFile = path.join(OUT, "manifest.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : { origin: ORIGIN, routes: {} };
manifest.origin = ORIGIN;
manifest.captured = new Date().toISOString();

const probe = await browser.newContext({ userAgent: UA_DESKTOP });
const first = await probe.request.get(ORIGIN + "/", { timeout: 60000, maxRedirects: 5 }).catch((e) => e);
if (first instanceof Error) {
  console.error(`Cannot reach ${ORIGIN}: ${String(first).split("\n")[0]}`);
  console.error("If this is a cloud session, the environment's network access must allow this host.");
  process.exit(2);
}
const queue = ONLY ? [...ONLY] : ["/", ...(await sitemapRoutes(probe))];
await probe.close();
const done = new Set();
// whatever has been taken is written when the process is told to stop (a step's time limit): the manifest,
// the URL index and the report, so a capture cut short is still a capture
let finishing = false;
const finish = (why) => {
  if (finishing) return;
  finishing = true;
  writeJson(manifestFile, manifest);
  writeJson(path.join(OUT, "urls.json"), urls);
  try { report(manifest); } catch { /* the report is a courtesy */ }
  log(`${why}: ${Object.keys(manifest.routes).length} routes, ${Object.keys(urls).length} URLs → ${OUT}`);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(sig, () => { finish(`stopped (${sig})`); process.exit(0); });
while (queue.length && done.size < MAX) {
  if (timeLeft() < 20000) { log(`budget of ${BUDGET}s spent after ${done.size} routes; ${queue.length} left`); break; }
  const route = queue.shift();
  if (done.has(route)) continue;
  done.add(route);
  try {
    const found = await captureRoute(browser, route, manifest);
    if (!ONLY) for (const r of found) if (!done.has(r) && !queue.includes(r)) queue.push(r);
  } catch (err) {
    log(`FAILED ${route}: ${String(err).split("\n")[0]}`);
    manifest.routes[route] = { route, error: String(err).slice(0, 500) };
  }
  writeJson(manifestFile, manifest);
  writeJson(path.join(OUT, "urls.json"), urls);
}
await fetchWhole(browser);
await fetchCssReferences(browser);
await browser.close();
finish("done");
