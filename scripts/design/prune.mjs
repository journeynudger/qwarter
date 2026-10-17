#!/usr/bin/env node
/**
 * Remove from public/design every file no page uses.
 *
 * extract.mjs copies everything a reference page loads, including the reference studio's own pictures
 * and videos. Once Qwarter's content is swapped in, those are no longer on any page, but a file in
 * public/ is served whether a page links it or not: left there, Synchronized Studio's work would be
 * downloadable from qwarter.com/design/…. This deletes every file under public/design/<host>/ that is
 * not referenced by a page (content/pages/*.html, content/pages.json, content/site.json) or by a
 * stylesheet or script that is itself referenced. public/design/qwarter/ is ours and always kept.
 *
 * Usage: node scripts/design/prune.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DESIGN = path.join(ROOT, "public/design");
const dry = process.argv.includes("--dry");

const walk = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])) : [];

const refsIn = (text) => {
  const out = new Set();
  for (const m of text.matchAll(/\/design\/([^"'()\s?#,<>\\]+)/g)) {
    try {
      out.add(decodeURIComponent(m[1]));
    } catch {
      out.add(m[1]);
    }
  }
  return out;
};

const seeds = [
  ...walk(path.join(ROOT, "content/pages")).filter((f) => f.endsWith(".html")),
  path.join(ROOT, "content/pages.json"),
  path.join(ROOT, "content/site.json"),
  ...(fs.existsSync(path.join(ROOT, "content/not-found.html")) ? [path.join(ROOT, "content/not-found.html")] : []),
];
const used = new Set();
const queue = [];
const use = (r) => {
  if (used.has(r)) return;
  used.add(r);
  queue.push(r);
};
for (const f of seeds) refsIn(fs.readFileSync(f, "utf8")).forEach(use);
// stylesheets and scripts point at more files (fonts, background images, chunks)
while (queue.length) {
  const rel = queue.shift();
  const file = path.join(DESIGN, rel);
  if (!/\.(css|js|mjs|json)$/i.test(rel) || !fs.existsSync(file)) continue;
  refsIn(fs.readFileSync(file, "utf8")).forEach(use);
}

let removed = 0;
let bytes = 0;
for (const file of walk(DESIGN)) {
  const rel = path.relative(DESIGN, file);
  if (rel.startsWith("qwarter/") || used.has(rel)) continue;
  bytes += fs.statSync(file).size;
  removed++;
  if (!dry) fs.rmSync(file);
  else console.log(`would remove ${rel}`);
}
// folders left empty, deepest first
const dirs = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => [...dirs(path.join(dir, d.name)), path.join(dir, d.name)]) : [];
if (!dry) for (const d of dirs(DESIGN)) if (!fs.readdirSync(d).length) fs.rmdirSync(d);
console.log(`${dry ? "would remove" : "removed"} ${removed} unused files (${(bytes / 1e6).toFixed(1)} MB); ${used.size} referenced`);
