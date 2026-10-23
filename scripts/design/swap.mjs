#!/usr/bin/env node
/**
 * Put Qwarter's content into the reference design's pages.
 *
 * content/pages/<slug>.html starts as the reference page itself (scripts/design/extract.mjs keeps an
 * untouched copy in content/reference/<slug>.html). content/swaps/<slug>.json says what of it becomes
 * Qwarter's, and where each piece came from on qwarter.com. This script applies the swaps to the
 * reference copy and writes the page, so extracting the design again never loses the content, and every
 * word on the site can be traced to qwarter.com (tests/swaps.test.ts checks the quotes against the snapshot).
 *
 * content/swaps/<slug>.json:
 * {
 *   "swaps": [
 *     { "select": ".hero h1", "text": "We build …", "source": "qwarter.com/ h1" },
 *     { "select": ".hero p", "html": "Line one<br>line two", "source": "qwarter.com/ hero paragraph" },
 *     { "select": ".nav a.contact", "attr": { "href": "/contact/" } },
 *     { "select": ".intro img", "attr": { "src": "wp:2025/03/team.jpg", "alt": "…" }, "width": 1600, "source": "media 412" },
 *     { "select": ".awards", "remove": true, "reason": "Qwarter has no awards on qwarter.com" },
 *     { "select": ".work-grid", "repeat": ".work-card", "items": [
 *         { ".work-card__title": { "text": "Journey" }, "img": { "attr": { "src": "wp:2025/01/journey.jpg", "alt": "…" } },
 *           "a": { "attr": { "href": "/clients/journey/" } }, "source": "qwarter.com/clients/ card 1" } ] }
 *   ]
 * }
 *
 * - `head` (beside `swaps`): changes to the page record in content/pages.json: `{ "remove": { "href": "/api/x" } }`
 *   or `{ "remove": { "codeIncludes": "__videosDataReady" } }` drops a <head> asset, `{ "meta": "apple-mobile-web-app-title",
 *   "content": "Qwarter" }` rewrites a meta; `title`, `description` and `image` set the record's own.
 * - `prepend` puts markup first inside the matched element (a page heading the reference has none of).
 * - `select` is a CSS selector in the reference page; it must match (all matches are changed), or the run fails.
 * - `repeat` clones the first `repeat` element inside `select` once per item, fills it, and removes the
 *   originals: the cards keep their markup, classes, image treatment and animation; the content is Qwarter's.
 * - `wp:<path>` is a file from qwarter.com's media library (.port-cache/qwarter/uploads/<path>); it is copied
 *   to public/media/<path>, downscaled to `width` pixels wide when given (sharp), and the URL points there.
 *
 * Usage: node scripts/design/swap.mjs [--only home,about]
 */
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, ".port-cache/qwarter/uploads");
const SWAPS = path.join(ROOT, "content/swaps");
const REFERENCE = path.join(ROOT, "content/reference");

let slugs = fs.existsSync(SWAPS) ? fs.readdirSync(SWAPS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)) : [];
if (opt("only")) slugs = slugs.filter((s) => opt("only").split(",").includes(s));

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  /* without sharp, media is copied at its own size */
}

/** wp:<path> → /media/<path>, copying (and downscaling) the file on the way. */
async function media(value, width) {
  if (typeof value !== "string" || !value.startsWith("wp:")) return value;
  const rel = value.slice(3).replace(/^\/+/, "");
  const from = path.join(UPLOADS, rel);
  if (!fs.existsSync(from)) throw new Error(`${value}: not in .port-cache/qwarter/uploads (run scripts/port/fetch.py)`);
  const to = path.join(ROOT, "public/media", rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (sharp && width && /\.(jpe?g|png|webp|avif)$/i.test(rel)) {
    const img = sharp(from, { failOn: "none" });
    const meta = await img.metadata();
    if (meta.width && meta.width > width) await img.resize({ width }).toFile(to);
    else fs.copyFileSync(from, to);
  } else {
    fs.copyFileSync(from, to);
  }
  return `/media/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

async function resolveMedia(swap) {
  const out = structuredClone(swap);
  const fix = async (attr, width) => {
    if (!attr) return;
    for (const k of ["src", "poster", "data-src", "href"]) if (attr[k]) attr[k] = await media(attr[k], width);
    for (const k of ["srcset", "data-srcset"]) {
      if (!attr[k]) continue;
      const parts = [];
      for (const c of attr[k].split(",")) {
        const [u, d] = c.trim().split(/\s+/);
        parts.push([await media(u, d && d.endsWith("w") ? Number.parseInt(d, 10) : width), d].filter(Boolean).join(" "));
      }
      attr[k] = parts.join(", ");
    }
  };
  await fix(out.attr, out.width);
  for (const item of out.items ?? []) for (const [sel, v] of Object.entries(item)) if (sel !== "source" && v && typeof v === "object") await fix(v.attr, v.width ?? out.width);
  return out;
}

/** Runs in the browser: apply the swaps to the reference markup, return the new markup or the failures. */
function applySwaps({ markup, swaps }, Parser = DOMParser) {
  const doc = new Parser().parseFromString(`<!doctype html><html><head></head><body>${markup}</body></html>`, "text/html");
  const errors = [];
  const fill = (el, change) => {
    if (change.remove) { el.remove(); return; }
    if ("prepend" in change) el.insertAdjacentHTML("afterbegin", change.prepend);
    if ("text" in change) el.textContent = change.text;
    if ("html" in change) el.innerHTML = change.html;
    for (const [k, v] of Object.entries(change.attr ?? {})) {
      if (v === null) el.removeAttribute(k);
      else el.setAttribute(k, v);
    }
  };
  for (const s of swaps) {
    const targets = [...doc.body.querySelectorAll(s.select)];
    if (!targets.length) {
      errors.push(`"${s.select}" matches nothing`);
      continue;
    }
    if (s.remove) {
      targets.forEach((t) => t.remove());
      continue;
    }
    if (s.repeat) {
      for (const container of targets) {
        const originals = [...container.querySelectorAll(s.repeat)];
        if (!originals.length) {
          errors.push(`"${s.select}" has no "${s.repeat}" to repeat`);
          continue;
        }
        const template = originals[0];
        const anchor = doc.createComment("swap");
        template.before(anchor);
        for (const item of s.items) {
          const card = template.cloneNode(true);
          for (const [sel, change] of Object.entries(item)) {
            if (sel === "source") continue;
            const hits = sel === ":scope" ? [card] : [...card.querySelectorAll(sel)];
            if (card.matches(sel)) hits.unshift(card);
            if (!hits.length) errors.push(`"${s.repeat}" has no "${sel}"`);
            hits.forEach((h) => fill(h, change));
          }
          anchor.before(card);
        }
        anchor.remove();
        originals.forEach((o) => o.remove());
      }
      continue;
    }
    targets.forEach((t) => fill(t, s));
  }
  return { markup: doc.body.innerHTML, errors };
}

if (!slugs.length) {
  console.log("no content/swaps/*.json yet");
  process.exit(0);
}
const offline = argv.includes("--static");
let browser = null;
let page = null;
let StaticDOMParser;
if (offline) ({ DOMParser: StaticDOMParser } = await import("linkedom"));
else { browser = await launch(); page = await browser.newPage(); }
let failed = 0;
for (const slug of slugs) {
  const refFile = path.join(REFERENCE, `${slug}.html`);
  if (!fs.existsSync(refFile)) {
    console.error(`${slug}: content/reference/${slug}.html is missing (run scripts/design/extract.mjs for its route)`);
    failed++;
    continue;
  }
  const spec = JSON.parse(fs.readFileSync(path.join(SWAPS, `${slug}.json`), "utf8"));
  const swaps = [];
  for (const s of spec.swaps) swaps.push(await resolveMedia(s));
  const input = { markup: fs.readFileSync(refFile, "utf8"), swaps };
  const { markup, errors } = offline ? applySwaps(input, StaticDOMParser) : await page.evaluate(applySwaps, input);
  if (errors.length) {
    failed++;
    console.error(`${slug}: ${errors.length} swap(s) failed\n  ${errors.join("\n  ")}`);
    continue;
  }
  fs.writeFileSync(path.join(ROOT, "content/pages", `${slug}.html`), markup.trim() + "\n");
  // the page record: its <head> assets (a preload or script of the reference's that must not run here,
  // a meta that names the reference) and its title and description
  const pagesFile = path.join(ROOT, "content/pages.json");
  const pages = JSON.parse(fs.readFileSync(pagesFile, "utf8"));
  const record = pages.find((p) => p.slug === slug);
  if (record) {
    for (const h of spec.head ?? []) {
      if (h.remove) record.head = record.head.filter((asset) => !Object.entries(h.remove).every(([k, v]) => (k === "codeIncludes" ? (asset.code || "").includes(v) : asset[k] === v || asset.attrs?.[k] === v)));
      if (h.meta) for (const asset of record.head) if (asset.kind === "meta" && (asset.attrs.name === h.meta || asset.attrs.property === h.meta)) asset.attrs.content = h.content;
    }
    if (spec.title) record.title = spec.title;
    if (spec.description !== undefined) record.description = spec.description;
    if (spec.image !== undefined) record.image = spec.image;
    fs.writeFileSync(pagesFile, JSON.stringify(pages, null, 2) + "\n");
  }
  console.log(`${slug}: ${spec.swaps.length} swaps applied${spec.head ? `, ${spec.head.length} head change(s)` : ""}`);
}
if (browser) await browser.close();
process.exit(failed ? 1 : 0);
