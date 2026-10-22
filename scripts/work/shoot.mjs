#!/usr/bin/env node
/**
 * Photograph a site Qwarter built, for the Work pages.
 *
 * For each route: a viewport frame (1440×900 at 2×) and the whole page (a full-page capture after a
 * scroll pass, so lazy images and reveals have happened), saved as PNG under
 * public/media/work/<slug>/raw/ (or --out). scripts/work/prepare.mjs then makes the delivered sizes.
 * Beside them, manifest.json: each page's route, the title the site gives it, its height, and the
 * films it plays; every <video> the pages play (an mp4 or webm, not a stream) is saved as
 * video-NN.<ext>, so a site's own motion can open its film (scripts/work/video.mjs).
 *
 * Usage:
 *   node scripts/work/shoot.mjs <slug> <base> [<name=route|click:selector> …] [--discover N] [--out dir]
 *     node scripts/work/shoot.mjs journey http://localhost:3100 home=/ universities=/universities/
 *     node scripts/work/shoot.mjs serein http://localhost:3101 home=/ "product=/|click:text=Product"
 *     node scripts/work/shoot.mjs butter https://butterspreads.com --discover 4
 *   --discover N   with no routes given (or after them): the home page, then the first N−1 pages its own
 *                  navigation links to (same origin, in document order; carts, accounts, policies and
 *                  files left out), named after their paths
 *   --width 1440 --height 900 --scale 2 --settle 1500 --timeout 60000
 */
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";
import { sleep } from "../lib/probes.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const WIDTH = Number(take("width", 1440)), HEIGHT = Number(take("height", 900)), SCALE = Number(take("scale", 2)), SETTLE = Number(take("settle", 1500));
const TIMEOUT = Number(take("timeout", 60000));
const DISCOVER = Number(take("discover", 0));
const OUT = take("out", null);
const MAX_VIDEO = 95 * 1024 * 1024; // GitHub's limit, with room
const [slug, base, ...specs] = argv;
if (!slug || !base || (!specs.length && !DISCOVER)) {
  console.error("Usage: node scripts/work/shoot.mjs <slug> <base> [name=route[|click:selector] …] [--discover N] [--out dir]");
  process.exit(2);
}
const out = OUT ? path.resolve(OUT) : path.join("public/media/work", slug, "raw");
fs.mkdirSync(out, { recursive: true });
const origin = new URL(base).origin;

const SKIP_PATH = /\/(cart|checkout|account|login|log-in|sign-?in|register|search|wp-admin|wp-login|feed|policies|privacy|terms|refund|shipping|cookie|legal|tag|category|author|page\/\d+)(\/|$)|\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mov|xml)$/i;
const slugify = (p) => (p.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "home").slice(0, 40);

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE, ignoreHTTPSErrors: true });
const manifest = { slug, base, shot: new Date().toISOString(), viewport: { width: WIDTH, height: HEIGHT, scale: SCALE }, pages: [], videos: [] };
const savedVideos = new Map(); // src → file
const used = new Set();
const queue = specs.length ? specs.slice() : ["home=/"];

async function saveVideos(page, route) {
  const found = await page.evaluate(() => [...document.querySelectorAll("video")].map((v) => {
    const sources = [v.currentSrc, v.getAttribute("src"), ...[...v.querySelectorAll("source")].map((s) => s.getAttribute("src"))].filter(Boolean).map((s) => new URL(s, location.href).href);
    return { sources: [...new Set(sources)], poster: v.poster || null, width: v.videoWidth, height: v.videoHeight, autoplay: v.autoplay, loop: v.loop };
  })).catch(() => []);
  const list = [];
  for (const v of found) {
    const src = v.sources.find((s) => /\.(mp4|m4v|webm)(\?|$)/i.test(s) && !/^blob:/.test(s)) || v.sources.find((s) => !/^blob:|\.m3u8|\.mpd/i.test(s)) || v.sources[0] || null;
    const entry = { route, src, sources: v.sources, poster: v.poster, width: v.width, height: v.height, autoplay: v.autoplay, loop: v.loop, file: null };
    if (src && !/^blob:|\.m3u8|\.mpd/i.test(src)) {
      if (savedVideos.has(src)) entry.file = savedVideos.get(src);
      else {
        try {
          const res = await context.request.get(src, { timeout: 120000 });
          const body = res.ok() ? await res.body() : null;
          const type = (res.headers()["content-type"] || "").split(";")[0];
          if (body && body.length && body.length <= MAX_VIDEO && (/video\//.test(type) || /\.(mp4|m4v|webm)(\?|$)/i.test(src))) {
            const ext = /webm/.test(type) || /\.webm(\?|$)/i.test(src) ? "webm" : "mp4";
            const file = `video-${String(savedVideos.size + 1).padStart(2, "0")}.${ext}`;
            fs.writeFileSync(path.join(out, file), body);
            savedVideos.set(src, file); entry.file = file; entry.bytes = body.length;
            console.log(`${slug}: ${file} ← ${src} (${(body.length / 1e6).toFixed(1)} MB)`);
          } else console.log(`${slug}: not kept ${src} (${type || "no type"}, ${body ? body.length : "no"} bytes)`);
        } catch (e) { console.log(`${slug}: ${src}: ${String(e.message).split("\n")[0]}`); }
      }
    }
    list.push(entry);
    if (!manifest.videos.some((x) => x.src === src && x.route === route)) manifest.videos.push(entry);
  }
  return list;
}

while (queue.length) {
  const spec = queue.shift();
  const eq = spec.indexOf("=");
  let name = spec.slice(0, eq), rest = spec.slice(eq + 1);
  const [route, ...steps] = rest.split("|");
  if (used.has(name)) name = `${name}-${used.size + 1}`;
  used.add(name);
  const page = await context.newPage();
  try {
    await page.goto(/^https?:/.test(route) ? route : base.replace(/\/+$/, "") + route, { waitUntil: "load", timeout: TIMEOUT });
  } catch (e) {
    console.error(`${slug}/${name}: ${route}: ${String(e.message).split("\n")[0]}`);
    await page.close();
    continue;
  }
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  for (const step of steps) {
    const [kind, ...arg] = step.split(":");
    const sel = arg.join(":"); // "click:text=Product" — the selector may itself contain ":"
    if (kind === "click") {
      await page.locator(sel).first().click({ timeout: 5000 }).catch((e) => console.error(`${name}: ${step}: ${String(e.message).split("\n")[0]}`));
      await sleep(1200);
    }
  }
  // the first page's navigation, when asked to find the others
  if (DISCOVER && manifest.pages.length === 0) {
    const links = await page.evaluate(() => {
      const pick = (sel) => [...document.querySelectorAll(sel)].map((a) => a.getAttribute("href")).filter(Boolean);
      return [...pick("header a[href], nav a[href], [role=navigation] a[href], [class*=nav] a[href], [class*=menu] a[href]"), ...pick("main a[href], footer a[href], a[href]")];
    }).catch(() => []);
    const seen = new Set([new URL(page.url()).pathname.replace(/\/+$/, "") || "/"]);
    for (const href of links) {
      let u; try { u = new URL(href, page.url()); } catch { continue; }
      if (u.origin !== origin && u.origin.replace("://www.", "://") !== origin.replace("://www.", "://")) continue;
      if (!/^https?:$/.test(u.protocol)) continue;
      const p = u.pathname.replace(/\/+$/, "") || "/";
      if (p === "/" || seen.has(p) || SKIP_PATH.test(p)) continue;
      seen.add(p);
      queue.push(`${slugify(p)}=${u.pathname}${u.search}`);
      if (seen.size >= DISCOVER) break;
    }
    if (queue.length) console.log(`${slug}: ${queue.length} more page(s) from its navigation: ${queue.map((q) => q.split("=")[1]).join(" ")}`);
  }
  await sleep(SETTLE);
  // a scroll pass, so lazy images and scroll reveals are in the full capture, then back to the top
  await page.evaluate(async () => {
    const h = Math.min(document.documentElement.scrollHeight, 30000);
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  }).catch(() => {});
  await sleep(1200);
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  const frame = path.join(out, `${name}.png`);
  const full = path.join(out, `${name}-full.png`);
  await page.screenshot({ path: frame }).catch((e) => console.error(`${name}: frame: ${String(e).split("\n")[0]}`));
  await page.screenshot({ path: full, fullPage: true, timeout: 120000 }).catch((e) => console.error(`${name}: full page: ${String(e).split("\n")[0]}`));
  const info = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, title: document.title, url: location.href, description: document.querySelector('meta[name="description"]')?.content || null })).catch(() => ({}));
  const videos = await saveVideos(page, route);
  manifest.pages.push({ name, route, url: info.url, title: info.title, description: info.description, height: info.height, frame: fs.existsSync(frame) ? path.basename(frame) : null, full: fs.existsSync(full) ? path.basename(full) : null, videos: videos.map((v) => v.file || v.src).filter(Boolean) });
  console.log(`${slug}/${name}: ${route} viewport ${WIDTH}×${HEIGHT}@${SCALE}, page ${info.height}px, "${info.title}"${videos.length ? `, ${videos.length} video(s)` : ""}`);
  await page.close();
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await browser.close();
if (!manifest.pages.length) { console.error(`${slug}: nothing could be photographed`); process.exit(1); }
