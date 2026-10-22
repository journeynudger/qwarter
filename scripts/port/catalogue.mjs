#!/usr/bin/env node
/**
 * Qwarter's catalogue from its own WordPress: every case study in the snapshot
 * (scripts/port/fetch.py → .port-cache/qwarter/) becomes a project with pictures.
 *
 * For each record of a case-study post type (work, portfolio, project, case-study, client…), in
 * date order newest first, after the projects already photographed from their own sites:
 *   public/media/work/<slug>/raw/img-NN.png   its pictures, 1440 wide: the featured image first, then every
 *                                             picture in its content (from uploads/, never fetched)
 *   content/work.json                         the project: name (its title), line (its excerpt or first
 *                                             paragraph), made (its categories/terms if any, else what the
 *                                             text says), year (its date), url (an off-site link in its
 *                                             content, if one), cover img-01, pages = its pictures, source
 * Then scripts/work/prepare.mjs and video.mjs deliver the tiles, the echo, the strips and the film, as for a
 * photographed site. Nothing is written for a record without a usable picture: it is listed as a catalogue
 * entry (media: false) with its words, and named in the output.
 *
 * Usage: node scripts/port/catalogue.mjs [--cache .port-cache/qwarter] [--dry]
 */
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; return argv[i + 1]; };
const CACHE = path.resolve(ROOT, take("cache", ".port-cache/qwarter"));
const DRY = argv.includes("--dry");
const WORK = path.join(ROOT, "public/media/work");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"];

const load = (name, d = null) => { const f = path.join(CACHE, name); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d; };
const rendered = (v) => (v && typeof v === "object" ? v.rendered || "" : v || "");
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘").replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”").replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&hellip;/g, "…");
const plain = (html) => decode(html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const firstSentence = (text) => { const m = text.match(/^.{20,180}?[.!?](?=\s|$)/); return (m ? m[0] : text.slice(0, 160)).trim(); };

const types = load("types.json", {}) || {};
const CASE_STUDY = /work|portfolio|project|case|client|study/i;
const typeNames = Object.entries(types).filter(([name]) => !["page", "post", "attachment", "nav_menu_item", "wp_block", "wp_template", "wp_template_part", "wp_navigation", "wp_font_family", "wp_font_face", "wp_global_styles"].includes(name) && CASE_STUDY.test(name)).map(([name]) => name);
const records = [];
for (const name of typeNames) for (const r of load(`${name}.json`, []) || []) if (r && r.slug && r.status !== "draft") records.push({ ...r, _type: name });
// qwarter.com's own site also kept some case studies as posts in a category: those count too
for (const r of load("posts.json", []) || []) if (r && r.slug && /work|portfolio|project|case/i.test(JSON.stringify(r.categories_names || r.class_list || ""))) records.push({ ...r, _type: "post" });

const media = new Map((load("media.json", []) || []).filter((m) => m && m.id).map((m) => [m.id, m]));
const uploadsDir = path.join(CACHE, "uploads");
const uploadPath = (url) => { const i = (url || "").indexOf("/wp-content/uploads/"); if (i < 0) return null; const rel = decodeURIComponent(url.slice(i + "/wp-content/uploads/".length).split(/[?#]/)[0]); const f = path.join(uploadsDir, rel); return fs.existsSync(f) ? f : null; };
const unsized = (url) => url.replace(/-\d{2,4}x\d{2,4}(?=\.\w{3,4}(?:$|\?))/, "");

const work = JSON.parse(fs.readFileSync(path.join(ROOT, "content/work.json"), "utf8"));
const photographed = work.projects.filter((p) => p.media !== false && !p.fromWordPress);
const known = new Set(photographed.flatMap((p) => [p.slug, p.name.toLowerCase()]));

const seen = new Set();
const out = [];
const skipped = [];
records.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
for (const r of records) {
  const slug = r.slug.toLowerCase();
  const name = plain(rendered(r.title));
  if (seen.has(slug) || known.has(slug) || known.has(name.toLowerCase())) { if (!seen.has(slug)) skipped.push(`${slug}: already photographed from its own site`); seen.add(slug); continue; }
  seen.add(slug);
  const content = rendered(r.content);
  const excerpt = plain(rendered(r.excerpt)).replace(/\s*\[&hellip;\]|\s*\[…\]|\s*…$/g, "");
  const paragraphs = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => plain(m[1])).filter((t) => t.length > 30);
  const line = firstSentence(excerpt || paragraphs[0] || name);
  const year = (r.date || "").slice(0, 4) || null;
  const terms = [].concat(r.acf?.services || [], r.class_list || []).filter((t) => typeof t === "string" && /^(services?|category|work_category|project_type)-/.test(t)).map((t) => t.replace(/^[a-z_]+-/, "").replace(/-/g, " "));
  const made = terms.length ? terms.map((t) => t[0].toUpperCase() + t.slice(1)).join(", ") : "Case study";
  const links = [...content.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !/qwarter\.com|wp-content|instagram|facebook|linkedin|twitter|x\.com|youtube|vimeo|google|apple/i.test(u));
  const url = links.length ? links[0].replace(/\/+$/, "").replace(/^(https?:\/\/[^/]+).*$/, "$1") : null;

  const pictures = [];
  const featured = media.get(r.featured_media);
  if (featured?.source_url) pictures.push(featured.source_url);
  for (const m of content.matchAll(/<img[^>]+(?:data-src|src)="([^"]+)"/gi)) pictures.push(m[1]);
  const files = [];
  for (const u of pictures) { const f = uploadPath(unsized(u)) || uploadPath(u); if (f && !files.includes(f) && /\.(jpe?g|png|webp|gif)$/i.test(f)) files.push(f); }
  if (!files.length) { skipped.push(`${slug}: no picture in the snapshot`); out.push({ slug, name, url, line, made, year, media: false, cover: null, pages: [], fromWordPress: true, source: `qwarter.com ${r.link} (WordPress snapshot, ${r._type} ${r.id}, modified ${r.modified}); no usable picture in its content` }); continue; }

  const dir = path.join(WORK, slug, "raw");
  const pages = [];
  if (!DRY) fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < Math.min(files.length, 8); i++) {
    const nm = `img-${String(i + 1).padStart(2, "0")}`;
    const title = i === 0 && featured ? plain(featured.alt_text || "") || "Cover" : plain((media.get(r.featured_media) || {}).caption?.rendered || "") || `Picture ${i + 1}`;
    pages.push({ name: nm, title: title.slice(0, 60) });
    if (!DRY) {
      try {
        await sharp(files[i], { animated: false }).rotate().resize({ width: 1440, withoutEnlargement: false }).png().toFile(path.join(dir, `${nm}.png`));
      } catch (e) { skipped.push(`${slug}: ${path.basename(files[i])} could not be read (${String(e.message).split("\n")[0]})`); pages.pop(); }
    }
  }
  if (!pages.length) { skipped.push(`${slug}: no readable picture`); continue; }
  out.push({ slug, name, url, line, made, year, cover: pages[0].name, pages, fromWordPress: true, source: `qwarter.com ${r.link} (WordPress snapshot, ${r._type} ${r.id}, modified ${r.modified}); pictures from its media library` });
}

const projects = [...photographed, ...out].map((p, i) => ({ ...p, numeral: ROMAN[i] }));
if (!DRY) {
  fs.writeFileSync(path.join(ROOT, "content/work.json"), JSON.stringify({ ...work, projects }, null, 2) + "\n");
  // folders of projects that are no longer in the list (earlier catalogue placeholders had none)
  for (const d of fs.readdirSync(WORK)) if (!projects.some((p) => p.slug === d && p.media !== false)) fs.rmSync(path.join(WORK, d), { recursive: true, force: true });
}
console.log(`${typeNames.join(", ") || "no case-study post type"}: ${records.length} records → ${out.filter((p) => p.media !== false).length} projects with pictures, ${out.filter((p) => p.media === false).length} without; ${projects.length} in all`);
for (const s of skipped) console.log(`  - ${s}`);
