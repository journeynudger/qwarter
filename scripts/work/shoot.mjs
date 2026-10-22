#!/usr/bin/env node
/**
 * Photograph a site Qwarter built, for the Work pages and the case studies.
 *
 * For each route: a viewport frame (1440×900 at 2×) and the whole page (a full-page capture after a
 * scroll pass, so lazy images and reveals have happened), saved as PNG under
 * public/media/work/<slug>/raw/ (or --out). scripts/work/prepare.mjs then makes the delivered sizes.
 * Beside them, manifest.json: each page's route, the title the site gives it, its height, and the
 * films it plays; every <video> the pages play (an mp4 or webm, not a stream) is saved as
 * video-NN.<ext>, so a site's own motion can open its film (scripts/work/video.mjs).
 *
 * With --phone the same pages are photographed again on a phone (390×844 at 3×): m-<name>.png and
 * m-<name>-full.png, recorded under each page's `phone`. With --assets the pictures the pages show
 * are kept too (assets/NN-<file>: the logo in the header, the icons, every image drawn larger than a
 * thumbnail, the backgrounds, an inline SVG logo), listed under `assets` with where each sat and
 * whether it reads as the logo. Every page also records its own words (`text`: headings, paragraphs
 * and captions in order) and what it is set in (`design`: the typefaces of its headings, body and
 * navigation, the colours its surfaces and words use, by area and by length). All of it is observed
 * from the site itself; nothing is written here.
 *
 * Usage:
 *   node scripts/work/shoot.mjs <slug> <base> [<name=route|click:selector> …] [--discover N] [--out dir] [--phone] [--assets]
 *     node scripts/work/shoot.mjs journey http://localhost:3100 home=/ universities=/universities/
 *     node scripts/work/shoot.mjs serein http://localhost:3101 home=/ "product=/|click:text=Product"
 *     node scripts/work/shoot.mjs butter https://butterspreads.com --discover 4 --phone --assets
 *   --discover N   with no routes given (or after them): the home page, then the first N−1 pages its own
 *                  navigation links to (same origin, in document order; carts, accounts, policies and
 *                  files left out), named after their paths
 *   --width 1440 --height 900 --scale 2 --settle 1500 --timeout 60000
 *   --ua "<user agent>"   the browser's name as sites see it (a current desktop Chrome by default: a headless
 *                         build's own name is refused by some firewalls with "Access Denied")
 */
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";
import { dismissOverlays, sleep } from "../lib/probes.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = (k) => { const i = argv.indexOf(`--${k}`); if (i < 0) return false; argv.splice(i, 1); return true; };
const WIDTH = Number(take("width", 1440)), HEIGHT = Number(take("height", 900)), SCALE = Number(take("scale", 2)), SETTLE = Number(take("settle", 1500));
const TIMEOUT = Number(take("timeout", 60000));
const DISCOVER = Number(take("discover", 0));
const OUT = take("out", null);
const UA = take("ua", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
const PHONE = flag("phone");
const ASSETS = flag("assets");
const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const PW = 390, PH = 844, PS = 3;
const MAX_VIDEO = 95 * 1024 * 1024; // GitHub's limit, with room
const MAX_ASSET = 15 * 1024 * 1024;
const [slug, base, ...specs] = argv;
if (!slug || !base || (!specs.length && !DISCOVER)) {
  console.error("Usage: node scripts/work/shoot.mjs <slug> <base> [name=route[|click:selector] …] [--discover N] [--out dir] [--phone] [--assets]");
  process.exit(2);
}
const out = OUT ? path.resolve(OUT) : path.join("public/media/work", slug, "raw");
fs.mkdirSync(out, { recursive: true });
if (ASSETS) fs.mkdirSync(path.join(out, "assets"), { recursive: true });
const origin = new URL(base).origin;

const SKIP_PATH = /\/(cart|checkout|account|login|log-in|sign-?in|register|search|wp-admin|wp-login|feed|policies|privacy|terms|refund|shipping|cookie|legal|tag|category|author|page\/\d+)(\/|$)|\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mov|xml)$/i;
const slugify = (p) => (p.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "home").slice(0, 40);

const browser = await launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE, ignoreHTTPSErrors: true, userAgent: UA, locale: "en-US" });
const phoneContext = PHONE ? await browser.newContext({ viewport: { width: PW, height: PH }, deviceScaleFactor: PS, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, userAgent: PHONE_UA, locale: "en-US" }) : null;
const manifest = { slug, base, shot: new Date().toISOString(), viewport: { width: WIDTH, height: HEIGHT, scale: SCALE }, phone: PHONE ? { width: PW, height: PH, scale: PS } : null, pages: [], videos: [], assets: [] };
const savedVideos = new Map(); // src → file
const savedAssets = new Map(); // url → file
const used = new Set();
const queue = specs.length ? specs.slice() : ["home=/"];

/**
 * Close what sits over the page: the probes' dismissal (buttons that say accept, close, got it…), then a
 * close button that only shows a cross (×, ✕, an aria-label), Escape, and last, a fixed layer that covers
 * most of the window and is not the site's header is hidden (a newsletter popup with no button we can read),
 * unless the page itself does not scroll: a site drawn in fixed layers (Bambino's wall) keeps them.
 */
async function closePopups(page) {
  await dismissOverlays(page);
  const crosses = page.locator('button, a, [role=button], [aria-label]').filter({ has: page.locator(':scope') }).filter({ hasText: /^\s*[×✕✖xX]\s*$/ });
  const labelled = page.locator('[aria-label*="close" i], [aria-label*="dismiss" i], [class*="close" i]:not([class*="closed" i]), [data-dismiss], .mfp-close, .pum-close');
  for (const loc of [crosses, labelled]) {
    const n = Math.min(await loc.count().catch(() => 0), 3);
    for (let i = 0; i < n; i++) await loc.nth(i).click({ timeout: 800, force: true }).catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(300);
  const hidden = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, gone = [];
    // a page that does not scroll and is drawn in fixed layers (a wall, a stage, a canvas) is the page: only a layer
    // that names itself a popup is taken off it
    const stage = (document.scrollingElement || document.documentElement).scrollHeight <= vh + 4;
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      const covers = (Math.min(r.right, vw) - Math.max(r.left, 0)) * (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / (vw * vh);
      const header = r.top <= 2 && r.height < vh * 0.25; // a fixed header or announcement bar stays
      const modal = /modal|popup|pop-up|overlay|lightbox|newsletter|subscribe|backdrop|dialog/i.test(el.className + " " + el.id + " " + (el.getAttribute("role") || ""));
      if (!header && ((covers > 0.35 && !stage) || (modal && covers > 0.08))) { el.style.setProperty("display", "none", "important"); gone.push((el.className || el.tagName).toString().slice(0, 60)); }
    }
    return gone;
  }).catch(() => []);
  if (hidden.length) console.log(`${slug}: hid ${hidden.length} fixed layer(s) over the page: ${hidden.join(", ")}`);
}

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

/** The page's own words, in order: headings, paragraphs, quotes, captions; the navigation left out. */
async function readText(page) {
  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const visible = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    for (const el of document.querySelectorAll("h1, h2, h3, h4, p, blockquote, figcaption, li")) {
      if (!visible(el) || el.closest("nav, [role=navigation], script, style, noscript, [aria-hidden=true]")) continue;
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const tag = el.tagName.toLowerCase();
      if ((tag === "p" || tag === "li" || tag === "figcaption") && text.length < 24) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      out.push({ tag, text: text.slice(0, 700), where: el.closest("header, [role=banner]") ? "header" : el.closest("footer, [role=contentinfo]") ? "footer" : "main" });
      if (out.length >= 160) break;
    }
    return out;
  }).catch(() => []);
}

/** What the page is set in: its typefaces by role, and its colours by the area and the words they carry. */
async function readDesign(page) {
  return page.evaluate(() => {
    const hex = (c) => {
      const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
      return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    };
    const first = (sel) => [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && (e.textContent || "").trim());
    const face = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim() : null);
    const weight = (el) => (el ? getComputedStyle(el).fontWeight : null);
    const h1 = first("h1"), h2 = first("h2, h3"), p = first("main p, article p, section p, p"), nav = first("header a, nav a"), button = first("button, a.btn, a[class*=button], .button, input[type=submit], a[class*=cta]");
    const fonts = {
      headings: face(h1) || face(h2), headingsWeight: weight(h1) || weight(h2),
      body: face(p) || face(document.body), bodyWeight: weight(p) || weight(document.body),
      nav: face(nav), buttons: face(button),
    };
    const faces = [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))].slice(0, 14);
    const backgrounds = new Map(), inks = new Map();
    for (const el of document.querySelectorAll("body, body *")) {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const bg = hex(cs.backgroundColor);
      if (bg) backgrounds.set(bg, (backgrounds.get(bg) || 0) + r.width * r.height);
      if (/^(H1|H2|H3|H4|P|A|LI|SPAN|BUTTON|BLOCKQUOTE|FIGCAPTION)$/.test(el.tagName) && (el.textContent || "").trim()) {
        const ink = hex(cs.color);
        if (ink) inks.set(ink, (inks.get(ink) || 0) + Math.min((el.textContent || "").trim().length, 400));
      }
    }
    const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([hex, weight]) => ({ hex, weight: Math.round(weight) }));
    const body = hex(getComputedStyle(document.body).backgroundColor) || hex(getComputedStyle(document.documentElement).backgroundColor) || null;
    const link = first("main a, article a, p a");
    return { fonts, faces, page: body, backgrounds: top(backgrounds, 8), inks: top(inks, 6), link: link ? hex(getComputedStyle(link).color) : null };
  }).catch(() => null);
}

/** The pictures a page shows, worth keeping: the logo and icons, images larger than a thumbnail, backgrounds, inline SVG marks. */
async function saveAssets(page, name) {
  const found = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const where = (el) => (el.closest("header, [role=banner]") ? "header" : el.closest("nav, [role=navigation]") ? "nav" : el.closest("footer, [role=contentinfo]") ? "footer" : "main");
    const add = (url, kind, el, extra = {}) => {
      try { url = new URL(url, location.href).href; } catch { return; }
      if (!/^https?:/.test(url) || seen.has(url)) return;
      seen.add(url);
      out.push({ url, kind, where: el ? where(el) : "head", ...extra });
    };
    for (const l of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')) add(l.href, "icon", null, { logo: true });
    const og = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
    if (og?.content) add(og.content, "og", null);
    for (const img of document.querySelectorAll("img")) {
      const r = img.getBoundingClientRect();
      const tags = [img.alt, img.className, img.id, img.getAttribute("src"), img.closest("a")?.className || "", img.closest("[class*=logo], [id*=logo]")?.className || ""].join(" ");
      const logo = /logo|brand|wordmark/i.test(tags) || !!img.closest("header a[href='/'], header a[href='./'], a[class*=logo], a[aria-label*='home' i]");
      if (r.width < 120 && r.height < 48 && !logo) continue;
      let src = img.currentSrc || img.src;
      const srcset = img.getAttribute("srcset") || img.closest("picture")?.querySelector("source")?.getAttribute("srcset");
      if (srcset) {
        const best = srcset.split(",").map((s) => s.trim().split(/\s+/)).map(([u, d]) => [u, parseFloat(d) || 1]).sort((a, b) => b[1] - a[1])[0];
        if (best && best[0]) src = best[0];
      }
      add(src, "img", img, { alt: img.alt || "", width: Math.round(r.width), height: Math.round(r.height), natural: [img.naturalWidth, img.naturalHeight], logo });
    }
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.height < 120) continue;
      const m = (getComputedStyle(el).backgroundImage || "").match(/url\(["']?([^"')]+)["']?\)/);
      if (m) add(m[1], "background", el, { width: Math.round(r.width), height: Math.round(r.height) });
    }
    let n = 0;
    for (const svg of document.querySelectorAll("header svg, nav svg, a[href='/'] svg, [class*=logo] svg, [id*=logo] svg, footer svg")) {
      const r = svg.getBoundingClientRect();
      if (r.width < 24 || r.height < 12 || n >= 6 || svg.closest("svg") !== svg) continue;
      n++;
      const logo = /logo|brand|wordmark/i.test([svg.getAttribute("class"), svg.id, svg.closest("a")?.className, svg.closest("[class*=logo]")?.className].join(" ")) || !!svg.closest("a[href='/']");
      out.push({ url: null, kind: "svg", where: where(svg), width: Math.round(r.width), height: Math.round(r.height), logo, markup: svg.outerHTML.slice(0, 300000) });
    }
    return out.slice(0, 70);
  }).catch(() => []);
  for (const a of found) {
    const entry = { file: null, url: a.url, page: name, kind: a.kind, where: a.where, logo: Boolean(a.logo), alt: a.alt || "", width: a.width || null, height: a.height || null, natural: a.natural || null };
    if (a.kind === "svg") {
      const file = `assets/${String(savedAssets.size + 1).padStart(2, "0")}-inline-${a.logo ? "logo" : "mark"}.svg`;
      let markup = a.markup;
      if (!/xmlns=/.test(markup)) markup = markup.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      fs.writeFileSync(path.join(out, file), markup);
      savedAssets.set(file, file);
      manifest.assets.push({ ...entry, file });
      continue;
    }
    if (savedAssets.has(a.url)) { manifest.assets.push({ ...entry, file: savedAssets.get(a.url) }); continue; }
    try {
      const res = await context.request.get(a.url, { timeout: 60000 });
      const body = res.ok() ? await res.body() : null;
      const type = (res.headers()["content-type"] || "").split(";")[0].trim();
      if (!body || !body.length || body.length > MAX_ASSET || !/^image\//.test(type)) { console.log(`${slug}: not kept ${a.url} (${type || "no type"}, ${body ? body.length : "no"} bytes)`); continue; }
      const ext = ({ "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico" })[type] || "img";
      const stem = (path.basename(new URL(a.url).pathname).replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || a.kind).slice(0, 48);
      const file = `assets/${String(savedAssets.size + 1).padStart(2, "0")}-${stem}.${ext}`;
      fs.writeFileSync(path.join(out, file), body);
      savedAssets.set(a.url, file);
      manifest.assets.push({ ...entry, file, bytes: body.length, type });
    } catch (e) { console.log(`${slug}: ${a.url}: ${String(e.message).split("\n")[0]}`); }
  }
}

/** The scroll pass: lazy images and reveals happen, then the page is back at its top. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const h = Math.min(document.documentElement.scrollHeight, 30000);
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo({ top: 0, behavior: "instant" });
    // a site that animates its scrolling (Lenis, Locomotive) takes its time coming back: wait until it has
    for (let i = 0; i < 40 && (window.scrollY > 2 || document.documentElement.scrollTop > 2); i++) { window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 100)); }
  }).catch(() => {});
}

async function act(page, steps, name) {
  for (const step of steps) {
    const [kind, ...arg] = step.split(":");
    const sel = arg.join(":"); // "click:text=Product" — the selector may itself contain ":"
    if (kind === "click") {
      await page.locator(sel).first().click({ timeout: 5000 }).catch((e) => console.error(`${name}: ${step}: ${String(e.message).split("\n")[0]}`));
      await sleep(1200);
    }
  }
}

/** The same page on a phone: its frame and its whole length, for the phone recording and stills. */
async function shootPhone(name, route, steps) {
  const page = await phoneContext.newPage();
  try {
    await page.goto(/^https?:/.test(route) ? route : base.replace(/\/+$/, "") + route, { waitUntil: "load", timeout: TIMEOUT });
  } catch (e) {
    console.error(`${slug}/${name} (phone): ${route}: ${String(e.message).split("\n")[0]}`);
    await page.close();
    return null;
  }
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await closePopups(page);
  await act(page, steps, `${name} (phone)`);
  await sleep(SETTLE);
  await scrollThrough(page);
  await closePopups(page);
  await sleep(800);
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  const frame = path.join(out, `m-${name}.png`);
  const full = path.join(out, `m-${name}-full.png`);
  await page.screenshot({ path: frame }).catch((e) => console.error(`${name} (phone): frame: ${String(e).split("\n")[0]}`));
  await page.screenshot({ path: full, fullPage: true, timeout: 120000 }).catch((e) => console.error(`${name} (phone): full page: ${String(e).split("\n")[0]}`));
  const height = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => null);
  await page.close();
  return { frame: fs.existsSync(frame) ? path.basename(frame) : null, full: fs.existsSync(full) ? path.basename(full) : null, height };
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
  await closePopups(page); // a cookie banner or a newsletter popup would sit over every frame
  await act(page, steps, name);
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
  await scrollThrough(page); // a scroll pass, so lazy images and scroll reveals are in the full capture, then back to the top
  await closePopups(page); // one that opened on scroll
  await sleep(1200);
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  const frame = path.join(out, `${name}.png`);
  const full = path.join(out, `${name}-full.png`);
  await page.screenshot({ path: frame }).catch((e) => console.error(`${name}: frame: ${String(e).split("\n")[0]}`));
  await page.screenshot({ path: full, fullPage: true, timeout: 120000 }).catch((e) => console.error(`${name}: full page: ${String(e).split("\n")[0]}`));
  const info = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, title: document.title, url: location.href, description: document.querySelector('meta[name="description"]')?.content || null })).catch(() => ({}));
  const videos = await saveVideos(page, route);
  const text = await readText(page);
  const design = await readDesign(page);
  if (ASSETS) await saveAssets(page, name);
  await page.close();
  const phone = PHONE ? await shootPhone(name, route, steps) : null;
  manifest.pages.push({ name, route, url: info.url, title: info.title, description: info.description, height: info.height, frame: fs.existsSync(frame) ? path.basename(frame) : null, full: fs.existsSync(full) ? path.basename(full) : null, videos: videos.map((v) => v.file || v.src).filter(Boolean), phone, text, design });
  console.log(`${slug}/${name}: ${route} viewport ${WIDTH}×${HEIGHT}@${SCALE}, page ${info.height}px, "${info.title}"${videos.length ? `, ${videos.length} video(s)` : ""}${phone ? `, phone ${phone.height}px` : ""}${text.length ? `, ${text.length} lines` : ""}`);
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
if (ASSETS) console.log(`${slug}: ${manifest.assets.length} picture(s) kept, ${manifest.assets.filter((a) => a.logo).length} read as the logo`);
await browser.close();
if (!manifest.pages.length) { console.error(`${slug}: nothing could be photographed`); process.exit(1); }
