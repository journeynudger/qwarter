/**
 * content/work.json holds together: every project has the fields the Work pages read, every
 * frame it names was delivered by scripts/work/prepare.mjs, nothing delivered is unnamed, each
 * fact carries its source, and the numerals run I, II, III… in order.
 *
 * Run: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import workJson from "@/content/work.json";
import type { Work } from "@/lib/content";

const { projects } = workJson as unknown as Work;
const ROOT = path.join(import.meta.dirname, "..");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

const featured = projects.filter((p) => p.media !== false);
const catalogue = projects.filter((p) => p.media === false);

test("every project is complete and sourced", () => {
  assert.ok(featured.length > 0, "there is work to show");
  for (const p of projects) {
    const where = `project ${p.slug}`;
    for (const key of ["slug", "numeral", "name", "line", "made", "source"] as const) {
      assert.equal(typeof p[key], "string", `${where}: ${key} should be a string`);
      assert.ok(p[key].trim(), `${where}: ${key} is empty`);
    }
    assert.match(p.slug, /^[a-z0-9-]+$/, `${where}: slug`);
    if (p.url !== null) assert.match(p.url, /^https:\/\/[a-z0-9.-]+\.[a-z]+(\/[a-z0-9-]+)*$/, `${where}: url should be the site's https address, no trailing slash`);
    if (p.year !== null) assert.match(p.year, /^20\d\d$/, `${where}: year`);
    assert.ok(p.source.length > 40, `${where}: source should say where the facts come from`);
    assert.ok(Array.isArray(p.pages), `${where}: pages`);
    for (const pg of p.pages) {
      assert.match(pg.name, /^[a-z0-9-]+$/, `${where}: page name ${pg.name}`);
      assert.ok(pg.title.trim(), `${where}: page ${pg.name} has no title`);
    }
    assert.equal(new Set(p.pages.map((pg) => pg.name)).size, p.pages.length, `${where}: page names are unique`);
    if (p.media === false) {
      // a catalogue entry: no pictures yet, so nothing that needs them
      assert.equal(p.cover, null, `${where}: a catalogue entry has no cover`);
      assert.equal(p.pages.length, 0, `${where}: a catalogue entry has no pages`);
    } else {
      // a site photographed from its own build has an address and a year; one from qwarter.com's catalogue has them when qwarter.com states them
      if (!p.fromWordPress) {
        assert.equal(typeof p.url, "string", `${where}: a photographed site has an address`);
        assert.equal(typeof p.year, "string", `${where}: a photographed site has a year`);
      }
      if (p.film) {
        assert.match(p.film.intro, /^intro\.(mp4|webm)$/, `${where}: film.intro names raw/intro.mp4 or .webm`);
        assert.ok(p.film.from.length > 20, `${where}: film.from says where the clip came from`);
      }
      assert.ok(p.pages.length > 0, `${where}: pages`);
      assert.ok(p.pages.some((pg) => pg.name === p.cover), `${where}: cover "${p.cover}" is not one of its pages`);
    }
  }
  assert.equal(new Set(projects.map((p) => p.slug)).size, projects.length, "slugs are unique");
  assert.deepEqual(projects.map((p) => p.numeral), ROMAN.slice(0, projects.length), "numerals run in order");
  assert.ok(catalogue.every((p) => /qwarter\.com/.test(p.source)), "a catalogue entry names its qwarter.com page");
});

test("every frame a project names was delivered, and nothing delivered is unnamed", () => {
  for (const p of featured) {
    const dir = path.join(ROOT, "public/media/work", p.slug);
    const expected = new Set(["cover.jpg", "cover@2x.jpg", "tile.jpg", "tile@2x.jpg", "blur.jpg", "scroll.mp4", "scroll.webm", ...p.pages.map((pg) => `page-${pg.name}.jpg`)]);
    const actual = new Set(fs.readdirSync(dir).filter((f) => f !== "raw" && f !== ".DS_Store"));
    assert.deepEqual([...actual].sort(), [...expected].sort(), `public/media/work/${p.slug}: run scripts/work/prepare.mjs and video.mjs`);
  }
  const dirs = fs.readdirSync(path.join(ROOT, "public/media/work")).filter((f) => !f.startsWith("."));
  assert.deepEqual(dirs.sort(), featured.map((p) => p.slug).sort(), "a folder per photographed project, none for a catalogue entry");
});
