/**
 * Qwarter's content, swapped into the reference design (scripts/design/swap.mjs), is Qwarter's:
 * every swap says where it came from, every page with swaps has its untouched reference copy, and,
 * when the qwarter.com snapshot is on disk (.port-cache/qwarter, after scripts/port/fetch.py), every
 * word put on a page is found verbatim on qwarter.com. Nothing invented can pass.
 *
 * Run: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { decodeEntities } from "@/lib/html";

const ROOT = path.join(import.meta.dirname, "..");
const SWAPS = path.join(ROOT, "content/swaps");
const SNAPSHOT = path.join(ROOT, ".port-cache/qwarter");

type Change = { text?: string; html?: string; attr?: Record<string, string | null>; width?: number };
type Swap = Change & { select: string; source?: string; remove?: boolean; reason?: string; repeat?: string; items?: Record<string, Change | string>[] };

const specs = (fs.existsSync(SWAPS) ? fs.readdirSync(SWAPS).filter((f) => f.endsWith(".json")) : []).map((f) => ({
  slug: f.slice(0, -5),
  swaps: (JSON.parse(fs.readFileSync(path.join(SWAPS, f), "utf8")) as { swaps: Swap[] }).swaps,
}));

test("every swap is well formed and says where its content came from", () => {
  for (const { slug, swaps } of specs) {
    assert.ok(Array.isArray(swaps), `${slug}: "swaps" should be an array`);
    assert.ok(fs.existsSync(path.join(ROOT, "content/reference", `${slug}.html`)), `${slug}: content/reference/${slug}.html is missing`);
    for (const s of swaps) {
      const where = `${slug}: ${s.select}`;
      assert.equal(typeof s.select, "string", `${where}: select`);
      if (s.remove) {
        assert.ok(s.reason, `${where}: a removal says why`);
        continue;
      }
      if (s.repeat) {
        assert.ok(Array.isArray(s.items) && s.items.length, `${where}: repeat needs items`);
        for (const item of s.items!) assert.ok(typeof item.source === "string" && item.source, `${where}: every repeated item names its source`);
        continue;
      }
      if (s.text !== undefined || s.html !== undefined) assert.ok(s.source, `${where}: a text swap names its source`);
    }
  }
});

/** Every visible word of the qwarter.com snapshot, normalised, to look quotes up in. */
function snapshotText(): string | null {
  if (!fs.existsSync(SNAPSHOT)) return null;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (d.name !== "uploads" && d.name !== "sitemaps") walk(p);
      } else if (/\.(html|json)$/.test(d.name)) files.push(p);
    }
  };
  walk(SNAPSHOT);
  return normalise(files.map((f) => fs.readFileSync(f, "utf8")).join(" ").replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))).replace(/\\[nrt"\\/]/g, " "));
}

function normalise(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, " "))
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

test("every word swapped in is found on qwarter.com (when the snapshot is on disk)", (t) => {
  const corpus = snapshotText();
  if (!corpus) {
    t.skip("no .port-cache/qwarter snapshot here (scripts/port/fetch.py)");
    return;
  }
  const notFound: string[] = [];
  const check = (value: string | undefined, where: string) => {
    if (!value) return;
    const quote = normalise(value);
    if (quote && !corpus.includes(quote)) notFound.push(`${where}: "${value.slice(0, 80)}"`);
  };
  for (const { slug, swaps } of specs) {
    for (const s of swaps) {
      check(s.text ?? s.html, `${slug} ${s.select}`);
      for (const item of s.items ?? []) {
        for (const [sel, change] of Object.entries(item)) if (sel !== "source" && typeof change === "object") check(change.text ?? change.html, `${slug} ${s.select} ${sel}`);
      }
    }
  }
  assert.deepEqual(notFound, []);
});
