#!/usr/bin/env node
/**
 * Turn captured reference pages (scripts/design/capture.mjs) into pages this site serves.
 *
 * For each route asked for, it writes:
 *   content/reference/<slug>.html the reference page's <body> markup, every asset URL pointed at our copy
 *   content/pages/<slug>.html     the same, until scripts/design/swap.mjs puts Qwarter's content into it
 *   content/pages.json            the page record: <html>/<body> attributes, <head> assets in their order,
 *                                 title, description, and `template` = the reference route it came from
 *   public/design/<host>/<path>   every stylesheet, script, font, image and video those pages load,
 *                                 byte for byte, except that URLs inside CSS and JS point at our copies
 *
 * Two modes:
 *   --mode server     (default) the document as the server sent it, scripts and all: the page's own
 *                     JavaScript runs again here and does what it did there (Webflow, GSAP, Lenis, …)
 *   --mode rendered   the DOM after the page's scripts ran, with its scripts removed: for sites whose
 *                     JavaScript cannot run from another origin (a Next.js or Nuxt build); motion is
 *                     then rebuilt by hand
 *
 * The result is the reference page itself, under our URLs. Qwarter's words and pictures go in
 * afterwards, by editing content/pages/<slug>.html (see CLAUDE.md).
 *
 * Usage: node scripts/design/extract.mjs [--ref .design-cache/synchronized] [--routes /=home,/work/=work]
 *          [--mode server|rendered] [--dry]
 *   --routes  reference route = our slug, comma separated; default: every captured route that answered 200,
 *             with its own path ("/" becomes "home")
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { launch } from "../lib/browser.mjs";
import { slugOf } from "../lib/routes.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const REF = opt("ref", ".design-cache/synchronized");
const MODE = opt("mode", "server");
const DRY = argv.includes("--dry");
const ROOT = process.cwd();

const manifest = JSON.parse(fs.readFileSync(path.join(REF, "manifest.json"), "utf8"));
const urls = JSON.parse(fs.readFileSync(path.join(REF, "urls.json"), "utf8"));
const ORIGIN = manifest.origin;
const ORIGIN_HOST = new URL(ORIGIN).hostname.replace(/^www\./, "");

let routes;
if (opt("routes")) {
  routes = opt("routes").split(",").map((pair) => {
    const [ref, slug] = pair.split("=");
    return { ref, slug: slug || slugOf(ref) };
  });
} else {
  routes = Object.values(manifest.routes)
    .filter((r) => r.status === 200)
    .map((r) => ({ ref: r.route, slug: slugOf(r.route) }));
}

// ------------------------------------------------------------------ the URL map

const EXT_BY_TYPE = {
  "text/css": ".css", "text/javascript": ".js", "application/javascript": ".js", "application/x-javascript": ".js",
  "font/woff2": ".woff2", "font/woff": ".woff", "font/ttf": ".ttf", "font/otf": ".otf", "application/font-woff": ".woff",
  "application/font-woff2": ".woff2", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/avif": ".avif",
  "image/gif": ".gif", "image/svg+xml": ".svg", "video/mp4": ".mp4", "video/webm": ".webm", "application/json": ".json",
};

/** Our public path for a captured URL: /design/<host>/<path>?v=<hash of the bytes>. */
const local = new Map();
const hashes = new Map();
// only what the chosen pages load (and what their stylesheets point at), not the whole capture
const chosen = new Set(routes.map((r) => r.ref));
function publicPathFor(url) {
  if (local.has(url)) return local.get(url);
  const entry = urls[url];
  if (!entry?.file || entry.status >= 400) return null;
  if (!entry.routes.some((r) => chosen.has(r))) return null;
  if (/text\/html/.test(entry.type)) return null; // pages are routes, not files
  let rel = entry.file.replace(/^files\//, "");
  // served by type from its extension: a stylesheet without one would arrive as octet-stream and be refused
  if (!path.extname(rel.replace(/__q[0-9a-f]{8}$/, "")) || rel.includes("/__index")) {
    const ext = EXT_BY_TYPE[entry.type];
    if (ext && !rel.endsWith(ext)) rel += ext;
  }
  const bytes = fs.readFileSync(path.join(REF, entry.file));
  const hash = crypto.createHash("sha1").update(bytes).digest("hex").slice(0, 10);
  hashes.set(rel, { bytes, entry, url });
  const p = `/design/${rel.split("/").map(encodeURIComponent).join("/")}?v=${hash}`;
  local.set(url, p);
  return p;
}

/** Any URL (absolute, root-relative or relative to `base`) → our copy, or our route for a reference page. */
function rewriteUrl(raw, base) {
  const value = raw.trim();
  if (!value || /^(data:|blob:|mailto:|tel:|javascript:|#|about:)/i.test(value)) return raw;
  let abs;
  try {
    abs = new URL(value, base);
  } catch {
    return raw;
  }
  const mine = publicPathFor(abs.href) ?? publicPathFor(abs.href.replace(/#.*$/, ""));
  if (mine) return mine + (abs.hash || "");
  if (abs.hostname.replace(/^www\./, "") === ORIGIN_HOST) {
    // a page of the reference site: the same path here
    return abs.pathname + abs.search + abs.hash;
  }
  return raw;
}

const missing = new Map(); // URLs a page or stylesheet asks for that the capture does not have

function rewriteCss(css, base) {
  return css
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (whole, q, u) => {
      if (u.startsWith("data:")) return whole;
      const next = rewriteUrl(u, base);
      if (next === u) {
        try {
          const abs = new URL(u, base);
          if (/^https?:$/.test(abs.protocol)) missing.set(abs.href, base);
        } catch {
          /* not a URL */
        }
      }
      return `url(${q}${next}${q})`;
    })
    .replace(/@import\s+(["'])([^"']+)\1/g, (whole, q, u) => `@import ${q}${rewriteUrl(u, base)}${q}`);
}

function rewriteJs(js) {
  // only exact absolute URLs of captured files: anything cleverer would be guessing at the code
  let out = js;
  for (const url of Object.keys(urls)) {
    if (out.includes(url)) {
      const mine = publicPathFor(url);
      if (mine) out = out.split(url).join(mine);
    }
  }
  return out;
}

// ------------------------------------------------------------------ pages

/** Runs in the browser: parse the document, rewrite every URL-bearing attribute, return the parts. */
function rewriteDocument({ html, base, map, mode }) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const resolve = (v) => {
    const t = v.trim();
    if (!t || /^(data:|blob:|mailto:|tel:|javascript:|#|about:)/i.test(t)) return v;
    try {
      const u = new URL(t, base);
      const hit = map[u.href] ?? map[u.href.replace(/#.*$/, "")];
      if (hit) return hit + (u.hash || "");
      if (u.hostname.replace(/^www\./, "") === new URL(base).hostname.replace(/^www\./, "")) return u.pathname + u.search + u.hash;
      return v;
    } catch {
      return v;
    }
  };
  const srcset = (v) =>
    v
      .split(",")
      .map((c) => {
        const [u, ...d] = c.trim().split(/\s+/);
        return [resolve(u), ...d].join(" ");
      })
      .join(", ");
  const ATTRS = ["href", "src", "poster", "action", "data-src", "data-bg", "data-background", "data-poster", "data-video", "data-href", "data-url", "content"];
  for (const el of doc.querySelectorAll("*")) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      if (a === "content" && !(el.tagName === "META" && /image|url/i.test(el.getAttribute("property") || el.getAttribute("name") || ""))) continue;
      el.setAttribute(a, resolve(el.getAttribute(a)));
    }
    for (const a of ["srcset", "data-srcset", "imagesrcset"]) if (el.hasAttribute(a)) el.setAttribute(a, srcset(el.getAttribute(a)));
    if (el.hasAttribute("style")) {
      el.setAttribute("style", el.getAttribute("style").replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (w, q, u) => `url(${q}${resolve(u)}${q})`));
    }
  }
  for (const st of doc.querySelectorAll("style")) {
    st.textContent = st.textContent.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (w, q, u) => (u.startsWith("data:") ? w : `url(${q}${resolve(u)}${q})`));
  }
  if (mode === "rendered") for (const s of doc.querySelectorAll("script")) s.remove();

  const attrs = (el) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
  const head = [];
  const icons = [];
  let title = doc.title;
  let description = null;
  let image = null;
  for (const el of doc.head.children) {
    const tag = el.tagName.toLowerCase();
    const a = attrs(el);
    if (tag === "title") continue;
    if (tag === "meta") {
      const name = (a.name || a.property || "").toLowerCase();
      if (name === "description") description = a.content;
      if (name === "og:image" && !image) image = a.content;
      // Next.js prints charset, viewport, description, robots and the social tags itself
      if (a.charset || /^(viewport|description|robots|generator|og:|twitter:|google-site-verification|msapplication)/.test(name) || a["http-equiv"]) continue;
      head.push({ kind: "meta", attrs: a });
      continue;
    }
    if (tag === "link") {
      const rel = (a.rel || "").toLowerCase();
      if (rel === "stylesheet") head.push({ kind: "stylesheet", href: a.href, ...(a.media ? { media: a.media } : {}) });
      else if (rel === "preload" || rel === "modulepreload") head.push({ kind: "preload", href: a.href, as: a.as || "script", ...(a.type ? { type: a.type } : {}), ...(a.crossorigin !== undefined ? { crossOrigin: "anonymous" } : {}) });
      else if (/icon/.test(rel)) icons.push({ rel: a.rel, href: a.href, ...(a.sizes ? { sizes: a.sizes } : {}), ...(a.type ? { type: a.type } : {}) });
      // canonical, alternate, preconnect, dns-prefetch: ours are printed by Next.js or not needed
      continue;
    }
    if (tag === "style") {
      const { ...rest } = a;
      head.push({ kind: "style", css: el.textContent, ...(Object.keys(rest).length ? { attrs: rest } : {}) });
      continue;
    }
    if (tag === "script") {
      if (mode === "rendered") continue;
      const { src, ...rest } = a;
      head.push(src ? { kind: "script", src, ...(Object.keys(rest).length ? { attrs: rest } : {}) } : { kind: "script", code: el.textContent, ...(Object.keys(rest).length ? { attrs: rest } : {}) });
    }
  }
  return {
    html: attrs(doc.documentElement),
    body: attrs(doc.body),
    head,
    icons,
    title,
    description,
    image,
    markup: doc.body.innerHTML,
  };
}

const browser = await launch();
const page = await browser.newPage();
const records = [];
const allIcons = [];
for (const r of routes) {
  const dir = path.join(REF, "routes", slugOf(r.ref));
  const file = path.join(dir, MODE === "rendered" ? "rendered.html" : "server.html");
  if (!fs.existsSync(file)) {
    console.error(`skip ${r.ref}: ${file} is missing`);
    continue;
  }
  const base = ORIGIN + r.ref;
  // every URL the capture holds, mapped once, so the browser-side rewrite is a lookup
  const map = {};
  for (const u of Object.keys(urls)) {
    const mine = publicPathFor(u);
    if (mine) map[u] = mine;
  }
  const doc = await page.evaluate(rewriteDocument, { html: fs.readFileSync(file, "utf8"), base, map, mode: MODE });
  for (const a of doc.head) {
    if (a.kind === "style") a.css = rewriteCss(a.css, base);
    if (a.kind === "script" && a.code) a.code = rewriteJs(a.code);
  }
  allIcons.push(...doc.icons);
  const pagePath = r.slug === "home" ? "/" : `/${r.slug.replace(/__/g, "/")}/`;
  records.push({
    slug: r.slug,
    path: pagePath,
    title: doc.title,
    description: doc.description,
    kind: "html", // a carried page: served as its markup, with the design's own assets (app/[[...path]]/page.tsx)
    template: r.ref,
    html: doc.html,
    body: doc.body,
    head: doc.head,
    scripts: [],
    image: doc.image && doc.image.startsWith("/") ? doc.image : null,
    modified: null,
  });
  if (!DRY) {
    // the untouched reference page (what content/swaps/<slug>.json applies to) and, until swaps exist, the page itself
    for (const dirName of ["content/reference", "content/pages"]) {
      fs.mkdirSync(path.join(ROOT, dirName), { recursive: true });
      fs.writeFileSync(path.join(ROOT, dirName, `${r.slug}.html`), doc.markup.trim() + "\n");
    }
  }
  console.log(`${r.ref} → ${pagePath}  head ${doc.head.length}  markup ${(doc.markup.length / 1024).toFixed(0)} KB`);
}
await browser.close();

// the files those pages load, with URLs inside CSS and JS pointed at our copies
let copied = 0;
let bytes = 0;
for (const [rel, { bytes: raw, entry, url }] of hashes) {
  let out = raw;
  if (/css/.test(entry.type)) out = Buffer.from(rewriteCss(raw.toString("utf8"), url));
  else if (/javascript|ecmascript/.test(entry.type)) out = Buffer.from(rewriteJs(raw.toString("utf8")));
  if (!DRY) {
    const target = path.join(ROOT, "public/design", rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, out);
  }
  copied++;
  bytes += out.length;
}

if (!DRY) {
  const pagesFile = path.join(ROOT, "content/pages.json");
  const existing = fs.existsSync(pagesFile) ? JSON.parse(fs.readFileSync(pagesFile, "utf8")) : [];
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  for (const rec of records) bySlug.set(rec.slug, rec);
  fs.writeFileSync(pagesFile, JSON.stringify([...bySlug.values()], null, 2) + "\n");
  const siteFile = path.join(ROOT, "content/site.json");
  const site = JSON.parse(fs.readFileSync(siteFile, "utf8"));
  if (!site.icons.length && allIcons.length) {
    site.icons = [...new Map(allIcons.map((i) => [i.href, i])).values()];
    fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + "\n");
  }
}
console.log(`${records.length} pages, ${copied} files (${(bytes / 1e6).toFixed(1)} MB) into public/design/${DRY ? " (dry run: nothing written)" : ""}`);
if (missing.size) {
  console.log(`\n${missing.size} URLs referenced by stylesheets are not in the capture:`);
  for (const [u, from] of [...missing].slice(0, 30)) console.log(`  ${u}  (from ${from})`);
}
