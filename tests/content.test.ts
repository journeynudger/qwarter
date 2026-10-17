/**
 * The content model holds together: every record has the fields its interface
 * promises, every page has its markup, every link inside it goes somewhere this
 * site serves, nothing is loaded from the WordPress site or the reference design's
 * servers, and every file in public/media is one a page actually uses (and vice versa).
 *
 * Run: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import pagesJson from "@/content/pages.json";
import redirectsJson from "@/content/redirects.json";
import site from "@/content/site.json";
import workJson from "@/content/work.json";
import type { Page, Redirects, Work } from "@/lib/content";
import { splitTopLevel } from "@/lib/html";

const pages = pagesJson as unknown as Page[];
const redirects = redirectsJson as Redirects;
const work = workJson as unknown as Work;
const KINDS = ["html", "featured", "archive", "work", "approach", "contact"];
const featuredWork = work.projects.filter((p) => p.media !== false);

const ROOT = path.join(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

// The two origins this site replaces and borrows from. After the port, neither is contacted.
const FOREIGN = /(?:https?:)?\/\/(?:[\w-]+\.)*(?:qwarter\.com|synchronized\.studio)(?=[/"'?#\s)]|$)/i;

function hasKeys(obj: Record<string, unknown>, keys: Record<string, string>, where: string) {
  for (const [key, type] of Object.entries(keys)) {
    const actual = obj[key] === null ? "null" : Array.isArray(obj[key]) ? "array" : typeof obj[key];
    assert.ok(type.split("|").includes(actual), `${where}: "${key}" should be ${type}, is ${actual}`);
  }
}

type AnyAsset = { kind: string; href?: string; src?: string; css?: string; code?: string };
const ASSET_KINDS = ["stylesheet", "style", "script", "preload", "meta"];

function checkAssets(list: unknown, where: string) {
  assert.ok(Array.isArray(list), `${where}: should be an array`);
  for (const a of list as AnyAsset[]) {
    assert.ok(ASSET_KINDS.includes(a.kind), `${where}: unknown asset kind ${a.kind}`);
    if (a.kind === "stylesheet" || a.kind === "preload") assert.equal(typeof a.href, "string", `${where}: ${a.kind} without href`);
    if (a.kind === "script") assert.ok(typeof a.src === "string" || typeof a.code === "string", `${where}: script without src or code`);
    if (a.kind === "style") assert.equal(typeof a.css, "string", `${where}: style without css`);
  }
}

test("site.json is complete", () => {
  hasKeys(site as Record<string, unknown>, { name: "string", origin: "string", lang: "string", icons: "array", head: "array", scripts: "array", chrome: "object" }, "site");
  checkAssets(site.head, "site.head");
  checkAssets(site.scripts, "site.scripts");
  const chrome = site.chrome as Record<string, unknown>;
  hasKeys(chrome, { brand: "object", nav: "array", footer: "string", statement: "array", facts: "array", contact: "object" }, "site.chrome");
  hasKeys(chrome.brand as Record<string, unknown>, { left: "string", right: "string", tagline: "string" }, "site.chrome.brand");
  hasKeys(chrome.contact as Record<string, unknown>, { email: "string", place: "string" }, "site.chrome.contact");
  for (const item of chrome.nav as Record<string, unknown>[]) hasKeys(item, { label: "string", href: "string" }, "site.chrome.nav");
  for (const fact of chrome.facts as Record<string, unknown>[]) hasKeys(fact, { label: "string", value: "string" }, "site.chrome.facts");
  assert.match((chrome.contact as { email: string }).email, /^[^@\s]+@[^@\s]+\.[a-z]+$/, "contact email");
});

test("pages.json records are complete, and each page's markup splits cleanly", () => {
  for (const p of pages) {
    const where = `page ${p.slug}`;
    hasKeys(p as unknown as Record<string, unknown>, {
      slug: "string", path: "string", kind: "string", title: "string", description: "string|null",
      html: "object", body: "object", head: "array", scripts: "array", image: "string|null", modified: "string|null",
    }, where);
    assert.ok(KINDS.includes(p.kind), `${where}: kind ${p.kind} is not one of ${KINDS.join(", ")}`);
    assert.ok(p.path === "/" || /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/$/.test(p.path), `${where}: path ${p.path} should be lowercase with a trailing slash`);
    checkAssets(p.head, `${where} head`);
    checkAssets(p.scripts, `${where} scripts`);
    if (p.kind === "html") {
      assert.equal(typeof p.template, "string", `${where}: a carried page names the reference route it was built on`);
      const file = path.join(ROOT, "content/pages", `${p.slug}.html`);
      assert.ok(fs.existsSync(file), `${where}: content/pages/${p.slug}.html is missing`);
      assert.doesNotThrow(() => splitTopLevel(fs.readFileSync(file, "utf8")), `${where}: markup does not split`);
    }
  }
  assert.equal(pages.filter((p) => p.kind === "featured").length, 1, "one featured page");
  assert.equal(pages.filter((p) => p.kind === "archive").length, 1, "one work index");
  assert.equal(new Set(pages.map((p) => p.path)).size, pages.length, "page paths are unique");
  assert.equal(new Set(pages.map((p) => p.slug)).size, pages.length, "page slugs are unique");
  const orphans = fs.readdirSync(path.join(ROOT, "content/pages")).filter((f) => f.endsWith(".html") && !pages.some((p) => `${p.slug}.html` === f));
  assert.deepEqual(orphans, [], "every file in content/pages belongs to a page");
});

// ---------------------------------------------------------------- links and assets

const routes = new Set<string>([...pages.map((p) => p.path), ...featuredWork.map((p) => `/work/${p.slug}/`)]);
const redirected = new Set(redirects.paths.map((r) => r.source));

function sources(): { file: string; text: string }[] {
  const files = fs
    .readdirSync(path.join(ROOT, "content/pages"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => `content/pages/${f}`);
  if (fs.existsSync(path.join(ROOT, "content/not-found.html"))) files.push("content/not-found.html");
  files.push("content/pages.json", "content/site.json", "content/work.json");
  const texts = files.map((file) => ({ file, text: read(file) }));
  // the views (components/site/) link the chrome's nav and each project's pages and pictures
  texts.push({ file: "components/site", text: [...(site.chrome.nav as { href: string }[]).map((n) => `href="${n.href}"`), ...workLinks()].join("\n") });
  return texts;
}

/** What the Work views reference per project (lib/content.ts workMedia + the project links). */
function workLinks(): string[] {
  return featuredWork.flatMap((p) => [
    `href="/work/${p.slug}/"`,
    `src="/media/work/${p.slug}/cover.jpg"`,
    `src="/media/work/${p.slug}/cover@2x.jpg"`,
    `src="/media/work/${p.slug}/tile.jpg"`,
    `src="/media/work/${p.slug}/tile@2x.jpg"`,
    `src="/media/work/${p.slug}/blur.jpg"`,
    `src="/media/work/${p.slug}/scroll.mp4"`,
    `src="/media/work/${p.slug}/scroll.webm"`,
    ...p.pages.map((pg) => `src="/media/work/${p.slug}/page-${pg.name}.jpg"`),
  ]);
}

test("nothing is loaded from or links to qwarter.com's WordPress or the reference design's servers", () => {
  const offenders: string[] = [];
  for (const { file, text } of sources()) {
    for (const m of text.matchAll(/(?:href|src|srcset|poster|action|data-src|data-srcset|data-bg|content)\s*=\s*\\?["']([^"'\\]+)/gi)) {
      if (FOREIGN.test(m[1]) && !m[1].startsWith("mailto:")) offenders.push(`${file}: ${m[1].slice(0, 100)}`);
    }
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)/gi)) if (FOREIGN.test(m[1])) offenders.push(`${file}: url(${m[1].slice(0, 100)})`);
    if (/\/wp-content\/|\/wp-includes\//.test(text)) offenders.push(`${file}: a /wp-content/ or /wp-includes/ path`);
  }
  assert.deepEqual(offenders, []);
});

test("every internal link lands on a page or a redirect", () => {
  const dead: string[] = [];
  for (const { file, text } of sources()) {
    if (file.endsWith(".json")) continue;
    for (const m of text.matchAll(/href\s*=\s*["'](\/(?!\/)[^"'#?]*)/g)) {
      const p = m[1];
      if (/^\/(media|design|_next)\//.test(p) || /\.\w{2,5}$/.test(p)) continue;
      if (routes.has(p) || redirected.has(p)) continue;
      dead.push(`${file}: ${p}`);
    }
  }
  assert.deepEqual(dead, []);
});

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

function referenced(prefix: "media" | "design"): Set<string> {
  const refs = new Set<string>();
  const texts = sources().map((s) => s.text);
  // the design's stylesheets point at its fonts and images with url()
  for (const f of walk(path.join(ROOT, "public/design")).filter((f) => f.endsWith(".css"))) texts.push(fs.readFileSync(f, "utf8"));
  const re = new RegExp(`/${prefix}/([^"'()<>,\\\\\\n?#]+?)(?=[?#"'()<>,\\\\\\n]| \\d+(?:\\.\\d+)?[wx]|$)`, "g");
  for (const text of texts) for (const m of text.matchAll(re)) refs.add(decodeURIComponent(m[1].trim()));
  return refs;
}

test("every referenced media and design file exists", () => {
  const missing = [
    ...[...referenced("media")].filter((rel) => !fs.existsSync(path.join(ROOT, "public/media", rel))).map((r) => `/media/${r}`),
    ...[...referenced("design")].filter((rel) => !fs.existsSync(path.join(ROOT, "public/design", rel))).map((r) => `/design/${r}`),
  ];
  assert.deepEqual(missing, []);
});

test("public/media holds only files a page uses", () => {
  const refs = referenced("media");
  const base = path.join(ROOT, "public/media");
  // raw captures (public/media/work/<slug>/raw/) are not committed and never served by a page
  const unused = walk(base)
    .map((f) => path.relative(base, f))
    .filter((rel) => !refs.has(rel) && !rel.endsWith(".DS_Store") && !/^work\/[^/]+\/raw\//.test(rel));
  assert.deepEqual(unused, []);
});

test("public/design holds only files a page, or the design's own stylesheets and scripts, use", () => {
  // a file in public/ is served whether a page links it or not: the reference studio's own work must not stay
  const base = path.join(ROOT, "public/design");
  const refsIn = (text: string) => [...text.matchAll(/\/design\/([^"'()\s?#,<>\\]+)/g)].map((m) => decodeURIComponent(m[1]));
  const used = new Set<string>();
  const queue: string[] = [];
  const use = (r: string) => {
    if (used.has(r)) return;
    used.add(r);
    queue.push(r);
  };
  for (const { text } of sources()) refsIn(text).forEach(use);
  while (queue.length) {
    const rel = queue.shift()!;
    const file = path.join(base, rel);
    if (!/\.(css|js|mjs|json)$/i.test(rel) || !fs.existsSync(file)) continue;
    refsIn(fs.readFileSync(file, "utf8")).forEach(use);
  }
  const unused = walk(base)
    .map((f) => path.relative(base, f))
    .filter((rel) => !rel.startsWith("qwarter/") && !used.has(rel));
  assert.deepEqual(unused, [], "run scripts/design/prune.mjs");
});
