/**
 * Qwarter's content, swapped into the reference design (scripts/design/swap.mjs), is Qwarter's:
 * every swap says where it came from, every page with swaps has its untouched reference copy, and,
 * when the qwarter.com snapshot is on disk (.port-cache/qwarter, after scripts/port/fetch.py), every
 * word put on a page is found verbatim on qwarter.com, or in content/work.json and content/site.json (whose
 * every word is sourced in turn: the sites' own titles, qwarter.com's pages). A {{token}} the project
 * template fills from content/work.json at render time is not a word. Nothing invented can pass.
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

type Change = { text?: string; html?: string; prepend?: string; attr?: Record<string, string | null>; width?: number; remove?: boolean };
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
      if (s.text !== undefined || s.html !== undefined || s.prepend !== undefined) assert.ok(s.source, `${where}: a text swap names its source`);
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

/** Our own content files, whose words are sourced there: a swap may quote them too. */
function contentText(): string {
  return normalise(["content/work.json", "content/site.json"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join(" ").replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))).replace(/\\[nrt"\\/]/g, " "));
}

test("every word swapped in is found on qwarter.com or in the content files (when the snapshot is on disk)", (t) => {
  const corpus = snapshotText();
  if (!corpus) {
    t.skip("no .port-cache/qwarter snapshot here (scripts/port/fetch.py)");
    return;
  }
  const own = contentText();
  const notFound: string[] = [];
  const check = (value: string | undefined, where: string, source?: string) => {
    if (!value) return;
    if (source?.startsWith("UI copy")) { assert.ok(value.length < 80, `${where}: UI copy stays short`); return; } // a label, not a fact (CLAUDE.md)
    // a template token is filled at render time from content/work.json; the words around it are checked,
    // and html is checked paragraph by paragraph (each is one quote)
    for (const piece of value.split(/\{\{\s*[a-zA-Z0-9]+\s*\}\}|<\/p>|<\/li>|<br\s*\/?>/)) {
      const quote = normalise(piece).replace(/^[\s"“”'.,:;()\-–—]+|[\s"“”'.,:;()\-–—]+$/g, "");
      if (quote && !corpus.includes(quote) && !own.includes(quote)) notFound.push(`${where}: "${piece.slice(0, 80)}"`);
    }
  };
  for (const { slug, swaps } of specs) {
    for (const s of swaps) {
      check(s.text ?? s.html ?? s.prepend, `${slug} ${s.select}`, s.source);
      for (const item of s.items ?? []) {
        for (const [sel, change] of Object.entries(item)) if (sel !== "source" && typeof change === "object") check(change.text ?? change.html, `${slug} ${s.select} ${sel}`, typeof item.source === "string" ? item.source : undefined);
      }
    }
  }
  assert.deepEqual(notFound, []);
});
