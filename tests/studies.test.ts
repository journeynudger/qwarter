/**
 * The case studies hold together (lib/studies.ts): every study belongs to a project with pictures,
 * has the fields the page reads, names only pictures and recordings that exist, says where its words
 * come from, resolves every picture placeholder, and sends nobody to qwarter.com's WordPress or the
 * reference design's servers. Run: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import workJson from "@/content/work.json";
import type { Work } from "@/lib/content";
import type { Study } from "@/lib/studies";

const ROOT = path.join(import.meta.dirname, "..");
const DIR = path.join(ROOT, "content/studies");
const { projects } = workJson as unknown as Work;
const studies: Study[] = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"))) : [];
const FOREIGN = /(?:https?:)?\/\/(?:[\w-]+\.)*(?:qwarter\.com|synchronized\.studio|depoluxe\.xyz|vimeo\.com|vimeocdn\.com|cloudfront\.net)(?=[/"'?#\s)]|$)/i;

test("every study is a project's, complete, and sourced", () => {
  assert.ok(studies.length > 0, "there are case studies");
  for (const s of studies) {
    const where = `study ${s.slug}`;
    const project = projects.find((p) => p.slug === s.slug);
    assert.ok(project && project.media !== false, `${where}: no project with pictures has this slug`);
    for (const key of ["name", "shortName", "tagline", "client", "statement", "summary", "kind", "status", "address", "source"] as const) assert.equal(typeof s[key], "string", `${where}: ${key} should be a string`);
    assert.ok(s.source.length > 60, `${where}: source should say where every word comes from`);
    assert.ok(Array.isArray(s.role) && s.role.length > 0, `${where}: role`);
    assert.ok(Array.isArray(s.steps) && s.steps.length >= 2, `${where}: at least two steps (the lead and one note)`);
    assert.ok(s.identity.length <= 4, `${where}: at most four identity tiles`);
    assert.ok(s.figures.length <= 4, `${where}: at most four figures`);
    for (const st of s.steps) {
      assert.ok(st.title && st.body, `${where}: a step has a title and a body`);
      assert.ok(["desktop", "phone", "picture"].includes(st.device), `${where}: step "${st.title}" device`);
      if (st.recording) assert.ok(s.recordings[st.recording], `${where}: step "${st.title}" plays the ${st.recording} recording, which the study does not have`);
      else assert.equal(typeof st.image, "string", `${where}: step "${st.title}" shows nothing (no image, no recording)`);
    }
    if (s.url) assert.match(s.url, /^https:\/\//, `${where}: url`);
    const text = JSON.stringify(s);
    assert.ok(!FOREIGN.test(text), `${where}: links to or loads from a foreign origin`);
    assert.ok(!/"\$(pic|copy)"/.test(text), `${where}: an unresolved picture placeholder (run scripts/port/studies.mjs)`);
    assert.ok(!/\/wp-content\//.test(text), `${where}: a /wp-content/ path`);
  }
  assert.equal(new Set(studies.map((s) => s.slug)).size, studies.length, "one study per project");
});

test("every picture and recording a study names exists", () => {
  const missing: string[] = [];
  for (const s of studies) {
    const refs = new Set<string>();
    for (const m of JSON.stringify(s).matchAll(/"(\/media\/[^"]+)"/g)) refs.add(m[1]);
    for (const r of refs) if (!fs.existsSync(path.join(ROOT, "public", r))) missing.push(`${s.slug}: ${r}`);
  }
  assert.deepEqual(missing, []);
});

test("a study's folder holds only what the study, or its recordings, use", () => {
  const stray: string[] = [];
  for (const s of studies) {
    const dir = path.join(ROOT, "public/media/work", s.slug, "study");
    if (!fs.existsSync(dir)) continue;
    const text = JSON.stringify(s);
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(dir)) {
      const rel = `/media/work/${s.slug}/study/${path.relative(dir, f)}`;
      // the walkthrough writes every page's still and both recordings; a study may show a subset
      if (/\/(d|m)-[a-z0-9-]+\.jpg$|\/(desktop|phone)(-poster\.jpg|\.mp4|\.webm)$/.test(rel)) continue;
      if (!text.includes(`"${rel}"`)) stray.push(rel);
    }
  }
  assert.deepEqual(stray, [], "run scripts/port/studies.mjs");
});
