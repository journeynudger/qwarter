#!/usr/bin/env node
/**
 * The case studies qwarter.com already tells, retold here: for every project without a hand-written
 * study, content/studies/<slug>.json is written from what exists about it and nothing else:
 *
 *   - qwarter.com's own case study (the WordPress snapshot, .port-cache/qwarter/html/portfolio__*.html):
 *     the service line, the facts, the description, the Style & Imagery block (five colours and the type
 *     samples), the Deliverables / Services / Strategy lists, "Project Info <year>", the challenge, the
 *     solution and the design strategy, the sentence it quotes from the client, and its pictures. A
 *     paragraph that appears word for word on two case studies was pasted from one to the other and is
 *     left out (the catalogue's rule), so nothing here is said of a client that was written for another.
 *   - the site's own shoot (scripts/work/shoot.mjs, --phone --assets): each page's title and first words,
 *     the typefaces and colours it is set in, its logo and pictures, the phone frames.
 *
 * Pictures the study shows are copied under public/media/work/<slug>/study/ (the stills and recordings
 * there are scripts/work/walkthrough.mjs's); content/studies/_pictures/<slug>.json says which file each
 * came from. A study written by hand (no `generated: true`) is never touched. What is written by hand
 * about a generated study goes in content/studies/_overrides/<slug>.json and is laid over the generated
 * record on every run: a key given there replaces the generated one (an array whole); inside it,
 * {"$pic": "<source file name>"} becomes the delivered path of that picture, and
 * {"$copy": "<absolute path>", "as": "<name>", "max": 1600} copies a file from outside the shoot
 * (a brand's own files in its repository) into study/ and becomes its path. Each override says in
 * `source` where its words come from.
 * Usage: node scripts/port/studies.mjs [slug …]   (after catalogue → prepare → walkthrough)
 *        node scripts/port/studies.mjs --overrides-only slug …
 * The latter compiles literal editorial overrides against existing studies when raw captures are absent.
 */
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CACHE = path.join(ROOT, ".port-cache/qwarter");
const MEDIA = path.join(ROOT, ".port-cache/media/qwarter.com/wp-content/uploads");
const SHOTS = path.join(ROOT, ".port-cache/shots");
const WORK = path.join(ROOT, "public/media/work");
const OUT = path.join(ROOT, "content/studies");
const only = process.argv.slice(2);
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
if (only.includes('--overrides-only')) {
  const slugs = only.filter(value => value !== '--overrides-only');
  if (!slugs.length) throw new Error('Name the studies whose overrides should be compiled.');
  for (const slug of slugs) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid study slug: ${slug}`);
    const file = path.join(OUT, `${slug}.json`);
    const overrideFile = path.join(OUT, '_overrides', `${slug}.json`);
    const study = JSON.parse(read(file));
    const override = JSON.parse(read(overrideFile));
    if (!study.generated) throw new Error(`${slug}: not a generated study`);
    if (/"\$(pic|copy)"/.test(JSON.stringify(override))) throw new Error(`${slug}: image placeholders require a full source rebuild`);
    const { source, ...fields } = override;
    const marker = ` By hand (content/studies/_overrides/${slug}.json): `;
    const result = { ...study, ...fields, source: study.source.split(marker)[0] + (source ? marker + source : ''), generated: true };
    const text = JSON.stringify(result, null, 2) + '\n';
    for (const [, ref] of text.matchAll(/"(\/media\/[^"?]+)"/g)) {
      if (!exists(path.join(ROOT, 'public', ref))) throw new Error(`${slug}: missing ${ref}`);
    }
    fs.writeFileSync(file, text);
    const dir = path.join(WORK, slug, 'study');
    const pictures = path.join(OUT, '_pictures', `${slug}.json`);
    if (exists(pictures)) {
      const records = JSON.parse(read(pictures));
      fs.writeFileSync(pictures, JSON.stringify(records.filter(item => text.includes(`"${item.file}"`)), null, 2) + '\n');
    }
    // The same delivered-picture cleanup as the full compiler; walkthrough frames remain available.
    for (const name of fs.readdirSync(dir)) {
      if (/^pic-\d+\.(png|jpg)$/.test(name) && !text.includes(`"/media/work/${slug}/study/${name}"`)) fs.rmSync(path.join(dir, name));
    }
    console.log(`${slug}: editorial override compiled`);
  }
  process.exit(0);
}
const { projects } = JSON.parse(read(path.join(ROOT, "content/work.json")));
const host = (u) => (u || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&(amp|lt|gt|quot|apos|nbsp|hellip|rsquo|lsquo|rdquo|ldquo|ndash|mdash);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" })[e]);
const clean = (t) => decode(t).replace(/\s+/g, " ").trim();
const norm = (t) => clean(t).toLowerCase().replace(/[^a-z0-9 ]/g, "");
const sentence = (t) => { const m = clean(t).match(/^[\s\S]*?[.!?](?=\s|$)/); return m ? m[0] : clean(t); };
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const WP_SLUG = { journey: "journey-nudge" };

// ---- the WordPress case studies -------------------------------------------------------------------------------------
const LABELS = /^(Industry Type|Location|Company Size|Organization Size|Product|Services|Website|Client|CLient):?$/i;
const HEADS = /^(Deliverables|Services|Strategy|Other|Style ?&|Imagery|3D Renderings|Style & Imagery|Style & 3D Renderings|Live Website|Project|Info|Project Info|Challenge|Solution|Design|Strategy|Design Strategy|Main|Pages|Main Pages|Main Page|Website|Software|Development|Next|Aa|CHALLENGE|SOLUTION)$/i;

function parseStudy(file) {
  let html = read(file);
  html = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  const images = [...new Set([...html.matchAll(/(?:src|data-src|href)="([^"\s]+\.(?:png|jpe?g|webp|gif))"/gi)].map((m) => m[1]).filter((u) => /\/wp-content\/uploads\//.test(u) && !/cropped-Nudge/.test(u)).map((u) => u.replace(/-\d+x\d+(?=\.\w+$)/, "")))];
  const text = decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "\n"));
  let lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const dedup = []; for (const l of lines) if (dedup[dedup.length - 1] !== l) dedup.push(l);
  lines = dedup;
  const start = lines.indexOf("Contact") + 1 || 0;
  const end = lines.lastIndexOf("Next") > 0 ? lines.lastIndexOf("Next") : lines.length;
  const body = lines.slice(start, end);
  const s = { name: body[0], service: body[1], facts: {}, colors: [], type: [], lists: {}, paragraphs: [], year: null, challenge: [], solution: [], strategy: [], quote: null, images };
  // the challenge / solution / design strategy blocks, by their headings (the tokens "Design" "Strategy" may be split)
  const idx = (re, from = 0) => body.findIndex((l, i) => i >= from && re.test(l));
  const iChallenge = idx(/^challenge$/i), iSolution = idx(/^solution$/i);
  let iStrategy = -1;
  for (let i = Math.max(iSolution, 0); i < body.length - 1; i++) if (/^design$/i.test(body[i]) && /^strategy$/i.test(body[i + 1])) { iStrategy = i; break; }
  if (iStrategy < 0) iStrategy = idx(/^design strategy$/i, Math.max(iSolution, 0));
  const block = (from, to) => (from < 0 ? [] : body.slice(from + 1, to < 0 ? body.length : to).filter((l) => l.length > 2 && !HEADS.test(l) && !/^(20\d\d)$/.test(l)));
  if (iChallenge >= 0) s.challenge = block(iChallenge, iSolution >= 0 ? iSolution : iStrategy);
  if (iSolution >= 0) s.solution = block(iSolution, iStrategy >= 0 ? iStrategy : -1);
  if (iStrategy >= 0) s.strategy = block(iStrategy + (/^design$/i.test(body[iStrategy]) ? 1 : 0), -1);
  for (let i = 2; i < (iChallenge >= 0 ? iChallenge : body.length); i++) {
    const l = body[i];
    if (LABELS.test(l) && body[i + 1] && !LABELS.test(body[i + 1]) && !HEADS.test(body[i + 1])) { s.facts[l.replace(/:$/, "").toLowerCase()] = body[i + 1]; i++; continue; }
    if (/^#[0-9a-f]{3,6}$/i.test(l)) { s.colors.push(l.toUpperCase().length === 4 ? l.toUpperCase().replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : l.toUpperCase()); continue; }
    if (l === "Aa") { for (let j = i + 1; j < i + 6 && body[j]; j++) { if (/\d{1,2}\s?pt$/i.test(body[j]) || (/bold|light|regular|semi|medium|italic/i.test(body[j]) && body[j].split(" ").length <= 5)) s.type.push(body[j]); else break; } continue; }
    if (/^(Deliverables|Services|Strategy|Other)$/i.test(l)) {
      const key = l.toLowerCase(); const items = [];
      for (let j = i + 1; j < body.length; j++) { const x = body[j]; if (!x || HEADS.test(x) || LABELS.test(x) || x.length > 48 || /[.!?]$/.test(x) || /^#/.test(x)) break; items.push(x); }
      if (items.length) { s.lists[key] = items; i += items.length; }
      continue;
    }
    if (/^Project Info$/i.test(l) || /^Info$/i.test(l)) { const y = body.slice(i + 1, i + 3).find((x) => /^20\d\d$/.test(x)); if (y) s.year = y; continue; }
    if (l.length >= 60 && /[.!?…]$/.test(l)) s.paragraphs.push(l);
  }
  if (!s.year) { const y = body.find((x) => /^20\d\d$/.test(x)); if (y) s.year = y; }
  return s;
}

const studiesWP = new Map();
for (const f of fs.readdirSync(path.join(CACHE, "html")).filter((f) => /^portfolio__.+\.html$/.test(f))) {
  const wp = f.slice("portfolio__".length, -5);
  if (wp === "11-hamilton-home") continue;
  const slug = Object.entries(WP_SLUG).find(([, v]) => v === wp)?.[0] || wp;
  studiesWP.set(slug, { wp, ...parseStudy(path.join(CACHE, "html", f)) });
}
// a paragraph on two case studies was pasted: it belongs to neither
const counts = new Map();
for (const s of studiesWP.values()) for (const p of [...s.paragraphs, ...s.challenge, ...s.solution, ...s.strategy]) counts.set(norm(p), (counts.get(norm(p)) || 0) + 1);
const own = (p) => counts.get(norm(p)) === 1;

// ---- the shoots --------------------------------------------------------------------------------------------------------
function shootOf(project) {
  const candidates = [path.join(WORK, project.slug, "raw"), path.join(SHOTS, project.slug)];
  for (const dir of candidates) {
    const mf = path.join(dir, "manifest.json");
    if (!exists(mf)) continue;
    const m = JSON.parse(read(mf));
    if (!m.pages?.length) continue;
    return { dir, ...m };
  }
  return null;
}
const titleOf = (title, name) => {
  let t = clean(title || "");
  for (const sep of [" – ", " — ", " | ", " · ", " - ", " // "]) if (t.includes(sep)) { const parts = t.split(sep).map((x) => x.trim()); const keep = parts.filter((x) => norm(x) !== norm(name) && !/^(home|my store)$/i.test(x)); t = (keep[0] || parts[0]); }
  return t || name;
};
const faceName = (f) => (f || "").replace(/[-_]?(w0\d|wf_[a-z0-9]+|\d{5,})/gi, "").replace(/[-_]+/g, " ").replace(/\b(semibold|bold|light|regular|medium|italic)\b/gi, (w) => " " + w).replace(/\s+/g, " ").trim().split(" ").map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

// ---- pictures ------------------------------------------------------------------------------------------------------------
function uploadPath(url) {
  const rel = url.split("/wp-content/uploads/")[1];
  if (!rel) return null;
  for (const base of [path.join(CACHE, "uploads"), MEDIA]) if (exists(path.join(base, rel))) return path.join(base, rel);
  return null;
}
let uploadIndex = null;
function findUpload(name) {
  if (!uploadIndex) {
    uploadIndex = new Map();
    const walk = (d) => { if (!exists(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else uploadIndex.set(e.name.toLowerCase(), f); } };
    walk(path.join(CACHE, "uploads")); walk(MEDIA);
  }
  return uploadIndex.get(name.toLowerCase()) || null;
}
async function deliverPicture(src, dir, stem, { max = 1600 } = {}) {
  const meta = await sharp(src).metadata();
  const alpha = meta.hasAlpha && (await sharp(src).ensureAlpha().raw().toBuffer()).some((_, i, buf) => i % 4 === 3 && buf[i] < 250 && i < 4 * 50000);
  const ext = alpha ? "png" : "jpg";
  const out = path.join(dir, `${stem}.${ext}`);
  const img = sharp(src).resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });
  if (alpha) await img.png({ compressionLevel: 9 }).toFile(out); else await img.flatten({ background: "#ffffff" }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
  return { file: out, rel: `/media/work/${path.basename(dir.replace(/\/study$/, ""))}/study/${stem}.${ext}`, width: meta.width, height: meta.height, alpha };
}
/** Is a picture mostly dark on its opaque pixels (so it wants a light ground), or light? */
async function brightness(file) {
  const data = await sharp(file).ensureAlpha().resize(64, 64, { fit: "inside" }).raw().toBuffer();
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 40) continue; sum += (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255; n++; }
  return n ? sum / n : 1;
}
const luminance = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// ---- one study -----------------------------------------------------------------------------------------------------------
for (const project of projects) {
  if (only.length && !only.includes(project.slug)) continue;
  if (project.media === false) continue;
  const file = path.join(OUT, `${project.slug}.json`);
  if (exists(file) && !JSON.parse(read(file)).generated) { console.log(`${project.slug}: written by hand, kept`); continue; }
  const wp = studiesWP.get(project.slug) || null;
  const shoot = shootOf(project);
  const dir = path.join(WORK, project.slug, "study");
  fs.mkdirSync(dir, { recursive: true });
  const address = host(project.url);
  const live = Boolean(shoot && shoot.base && !/localhost|127\.0\.0\.1/.test(shoot.base));
  const sources = [];
  const name = project.name;

  // -- the words
  const about = wp ? wp.paragraphs.find(own) || null : null;
  const description = shoot?.pages?.[0]?.description || null;
  const pageWords = (pg) => (pg.text || []).filter((t) => t.where !== "footer");
  // the site's own first heading (its home page's h1, a sentence long): what a site without a case study says of itself
  const siteLine = shoot?.pages?.[0] ? pageWords(shoot.pages[0]).find((t) => t.tag === "h1" && t.text.length >= 16 && t.text.length <= 140)?.text || null : null;
  // a line that only names the deliverable ("Website", the home page's Selected Work tile) is no tagline
  const bare = !project.line || norm(project.line) === norm(name) || /^(web ?sites?|website design|branding|logo|apps?|landing pages?|e-?commerce)$/i.test(project.line.trim());
  const tagline = !bare ? project.line : wp?.service ? cap(wp.service.toLowerCase()) : siteLine || project.made;
  const firstPara = shoot?.pages?.[0] ? pageWords(shoot.pages[0]).find((t) => t.tag === "p" && t.text.length >= 40 && t.text.length <= 240)?.text || null : null;
  // the statement never repeats the tagline: the first of these that says something else
  const rest = description && norm(sentence(description)) === norm(tagline) ? description.slice(sentence(description).length).trim() : null;
  const statement = [about && sentence(about), description && sentence(description), rest, siteLine, firstPara && sentence(firstPara), project.line]
    .find((t) => t && norm(t) !== norm(tagline)) || project.line;
  if (!about && !description && (siteLine || firstPara)) sources.push(`The statement is the site's own: its home page's first heading or first paragraph.`);
  if (bare && !wp?.service && siteLine) sources.push(`The line under the name is the site's own first heading (its home page's h1).`);
  const challenge = wp ? wp.challenge.filter(own) : [];
  const solution = wp ? wp.solution.filter(own) : [];
  const strategy = wp ? wp.strategy.filter(own) : [];
  const quoteCandidates = wp ? wp.paragraphs.filter((p) => own(p) && p !== about) : [];
  const quote = quoteCandidates[0] ? { text: quoteCandidates[0], source: `From qwarter.com's case study, the client's own words` } : (() => {
    const h = shoot?.pages?.flatMap((pg) => pageWords(pg).filter((t) => /^h[12]$/.test(t.tag) && t.text.length >= 24 && t.text.length <= 140)).find((t) => t.text !== tagline && t.text !== statement);
    return h ? { text: h.text, source: `From the site's ${titleOf(shoot.pages.find((pg) => pageWords(pg).includes(h))?.title, name).toLowerCase() === "home" ? "home page" : titleOf(shoot.pages.find((pg) => pageWords(pg).includes(h))?.title, name) + " page"}` } : undefined;
  })();
  const lists = wp?.lists || {};
  const role = (lists.deliverables || lists.services || []).slice(0, 4);
  if (!role.length) role.push(project.made);
  if (wp) sources.push(`qwarter.com/portfolio/${wp.wp}/ (WordPress snapshot 2026-10-22): the service line, facts, Style & Imagery, Deliverables/Services/Strategy, Project Info, challenge, solution and design strategy where they are this client's own (a paragraph pasted on another case study is left out), and its pictures`);
  if (shoot) sources.push(`${live ? host(shoot.base) : `${name}'s own build`} photographed on ${shoot.shot.slice(0, 10)} (scripts/work/shoot.mjs): page titles and first words, typefaces and colours observed, the logo and pictures the pages show, the phone frames`);

  // -- pictures: qwarter.com's, then the site's own
  const pics = [];
  let n = 0;
  const seen = new Set();
  if (wp) for (const url of wp.images) {
    const src = uploadPath(url);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const meta = await sharp(src).metadata().catch(() => null);
    if (!meta || (meta.width < 240 && meta.height < 240)) continue;
    const stem = path.basename(url).toLowerCase();
    const kind = /logo/.test(stem) ? "logo" : /ico[-_]?\d|icon/.test(stem) ? "icon" : /screenshot|screen-shot|home-page|website|page/.test(stem) ? "screen" : "picture";
    const d = await deliverPicture(src, dir, `pic-${String(++n).padStart(2, "0")}`);
    pics.push({ ...d, sourceFile: src, kind, from: "qwarter.com's case study (its media library)", alt: `${name}: ${kind === "logo" ? "the logo" : kind === "icon" ? "an icon" : kind === "screen" ? "a screen of the site" : "a picture"} as qwarter.com's case study shows it` });
  }
  if (shoot?.assets?.length) {
    const seenFiles = new Set();
    for (const a of shoot.assets) {
      if (!a.file || seenFiles.has(a.file) || a.kind === "icon" || a.kind === "svg") continue;
      seenFiles.add(a.file);
      const src = path.join(shoot.dir, a.file);
      if (!exists(src)) continue;
      const meta = await sharp(src).metadata().catch(() => null);
      if (!meta) continue;
      const big = Math.min(meta.width || 0, meta.height || 0) >= 300 && (meta.width || 0) * (meta.height || 0) >= 180000; // larger than a thumbnail, tall pictures included
      if (!a.logo && !big) continue;
      if (a.logo && !big && (meta.width || 0) < 120) continue;
      const d = await deliverPicture(src, dir, `pic-${String(++n).padStart(2, "0")}`).catch(() => null);
      if (!d) continue;
      pics.push({ ...d, sourceFile: src, kind: a.logo ? "logo" : a.kind === "og" ? "card" : "picture", from: `${host(shoot.base)} (the site's own picture${a.alt ? `: ${a.alt}` : ""})`, alt: a.alt || `${name}: ${a.logo ? "the logo" : "a picture"} from the site` });
      if (pics.filter((p) => p.kind !== "logo").length >= 30) break; // the pictures a study does not show are pruned below
    }
  }
  const logos = pics.filter((p) => p.kind === "logo").sort((a, b) => b.width * b.height - a.width * a.height);
  const screens = pics.filter((p) => p.kind === "screen");
  const gallery = pics.filter((p) => p.kind !== "logo" && p.kind !== "icon").slice(0, 8);

  // -- the identity
  const identity = [];
  const palette = wp?.colors?.length ? wp.colors.map((hex) => ({ hex })) : (() => {
    const d = shoot?.pages?.[0]?.design; if (!d) return [];
    const out = [];
    for (const b of (d.backgrounds || []).slice(0, 3)) out.push({ hex: b.hex, role: out.length ? "a surface" : "the page" });
    for (const i of (d.inks || []).slice(0, 2)) if (!out.some((o) => o.hex === i.hex)) out.push({ hex: i.hex, role: "the words" });
    if (d.link && !out.some((o) => o.hex === d.link)) out.push({ hex: d.link, role: "links" });
    return out;
  })();
  const light = palette.map((c) => c.hex).sort((a, b) => luminance(b) - luminance(a));
  if (logos[0]) {
    const bright = await brightness(logos[0].file);
    const ground = bright < 0.5 ? (light[0] && luminance(light[0]) > 0.7 ? light[0] : "#F4F2EE") : (light[light.length - 1] && luminance(light[light.length - 1]) < 0.2 ? light[light.length - 1] : "#0B0B0C");
    identity.push({ key: "logo", label: "Logo", note: `${name}'s logo as ${logos[0].from.startsWith("qwarter") ? "qwarter.com's case study shows it" : `the site shows it (${logos[0].from.split(" (")[0]})`}.`, image: logos[0].rel, alt: logos[0].alt, ground, dark: luminance(ground) < 0.4, fit: "contain" });
  } else if (shoot) {
    // the header of the site's own home page, as rendered: the wordmark as the site sets it
    const home = shoot.pages[0];
    const frame = path.join(shoot.dir, home.frame);
    if (exists(frame)) {
      const meta = await sharp(frame).metadata();
      const h = Math.min(meta.height, Math.round(meta.width * 0.2));
      const out = path.join(dir, "header.jpg");
      await sharp(frame).extract({ left: 0, top: 0, width: meta.width, height: h }).resize({ width: 1600 }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
      const bg = shoot.pages[0].design?.backgrounds?.[0]?.hex || "#0B0B0C";
      identity.push({ key: "wordmark", label: "Wordmark", note: `The top of ${address || name}'s home page as it stands: the name as the site itself sets it.`, image: `/media/work/${project.slug}/study/header.jpg`, alt: `The header of ${address || name}: the site's name and menu.`, ground: bg, dark: luminance(bg) < 0.4, fit: "cover" });
    }
  }
  if (palette.length) identity.push({ key: "palette", label: "Colour", note: wp?.colors?.length ? `The five colours qwarter.com's case study lists under Style & Imagery.` : `The colours ${address} is set in, by the area they cover and the words they carry, as observed on ${shoot.shot.slice(0, 10)}.`, colors: palette.slice(0, 7) });
  const faces = [];
  if (wp?.type?.length) for (const t of wp.type) { const m = t.match(/^(.*?)\s+(\d{1,2})\s?pt$/i); const fam = (m ? m[1] : t).replace(/\s+(semi ?bold|bold|ultra light|light|regular|medium|italic|semibold)\b/i, "").trim(); const weight = ((m ? m[1] : t).match(/(semi ?bold|bold|ultra light|light|regular|medium|italic)\b/i) || [])[1]; if (fam && !faces.some((f) => norm(f.family) === norm(fam))) faces.push({ role: faces.length === 0 ? "Headings" : faces.length === 1 ? "Subheadings" : "Text", family: cap(fam), weight: weight ? cap(weight.toLowerCase()) : undefined, fallback: /garamond|serif|playfair|cormorant|lora|times|georgia|adamina|pearl|emblema/i.test(fam) ? "serif" : "sans-serif" }); }
  const census = shoot?.pages?.find((pg) => pg.design?.fonts?.headings || pg.design?.fonts?.body)?.design?.fonts;
  if (census) for (const [role, fam] of [["Headings", census.headings], ["Text", census.body], ["Menu", census.nav]]) { const f = faceName(fam); if (f && !/^(arial|helvetica|system-ui|sans-serif|serif|-apple-system)$/i.test(f) && !faces.some((x) => norm(x.family) === norm(f))) faces.push({ role, family: f, fallback: /garamond|serif|playfair|cormorant|lora|times|georgia|claude|source serif/i.test(f) ? "serif" : "sans-serif" }); }
  if (faces.length) identity.push({ key: "type", label: "Type", note: wp?.type?.length ? `The type samples qwarter.com's case study sets under Style & Imagery${census ? `; ${faceName(census.headings || census.body)} is what ${address} renders its headings in today` : ""}.` : `The typefaces ${address} is set in, as observed: ${[census.headings, census.body].filter(Boolean).map(faceName).join(" and ")}.`, faces: faces.slice(0, 3) });
  const phoneHome = shoot?.pages?.find((pg) => pg.phone?.frame);
  if (phoneHome && exists(path.join(WORK, project.slug, "study", `m-${phoneHome.name}.jpg`))) identity.push({ key: "detail", label: "On a phone", note: `${address || name} on a phone, its home page as photographed on ${shoot.shot.slice(0, 10)}.`, image: `/media/work/${project.slug}/study/m-${phoneHome.name}.jpg`, alt: `${name}'s home page on a phone.`, ground: palette[0]?.hex || "#0B0B0C", dark: luminance(palette[0]?.hex || "#0B0B0C") < 0.4, fit: "cover" });
  else if (gallery[1]) identity.push({ key: "detail", label: "Detail", note: `${gallery[1].alt}.`, image: gallery[1].rel, alt: gallery[1].alt, ground: "#0B0B0C", dark: true, fit: "cover" });

  // -- the steps: the site page by page, then qwarter.com's challenge, solution and strategy
  const steps = [];
  const stills = (dev, pg) => `/media/work/${project.slug}/study/${dev}-${pg}.jpg`;
  // a recording counts once both its film and its poster are there (walkthrough.mjs writes the poster last)
  const hasDesktop = exists(path.join(dir, "desktop.mp4")) && exists(path.join(dir, "desktop-poster.jpg")), hasPhone = exists(path.join(dir, "phone.mp4")) && exists(path.join(dir, "phone-poster.jpg"));
  const pages = project.pages.filter((pg) => exists(path.join(dir, `d-${pg.name}.jpg`)));
  const leadBody = [about, description && norm(description) !== norm(about || "") ? description : null].filter(Boolean).join(" ") || `${name}, as ${live ? address + " stands today" : "qwarter.com's case study shows it"}.`;
  // the lead: the recording, else the first page's still; a site with neither (not yet recorded) gets no lead step
  if (hasDesktop || pages[0]) steps.push({ title: live ? `${address}, page by page` : `${name}, as the case study shows it`, body: leadBody, device: "desktop", ...(hasDesktop ? { recording: "desktop" } : { image: stills("d", pages[0].name), alt: `${name}: ${pages[0].title}.` }), source: about ? "qwarter.com's case study, its first paragraph about the client" : description ? "the site's own description" : "" });
  for (const pg of pages.slice(live ? 1 : 0, 7)) {
    const sp = shoot?.pages?.find((x) => x.name === pg.name);
    const words = sp ? pageWords(sp) : [];
    const h = words.find((t) => /^h[1-3]$/.test(t.tag) && t.text.length <= 120), p = words.find((t) => t.tag === "p" && t.text.length >= 40);
    const body = live ? [h ? `“${h.text}”` : null, p ? sentence(p.text) : null].filter(Boolean).join(" ") || `The ${pg.title} page of ${address}.` : `${pg.title} from qwarter.com's case study of ${name}.`;
    steps.push({ title: pg.title, body, image: stills("d", pg.name), alt: live ? `${address}: the ${pg.title} page.` : `${name}: ${pg.title}, as qwarter.com's case study shows it.`, device: live ? "desktop" : "picture", source: live ? "the page's own heading and first paragraph, as photographed" : "qwarter.com's case study" });
  }
  if (hasPhone) steps.push({ title: "On a phone", body: `${address} on a phone, ${shoot.pages.filter((pg) => pg.phone?.frame).length} pages as photographed on ${shoot.shot.slice(0, 10)}.`, device: "phone", recording: "phone", source: "the phone frames of the shoot" });
  const extra = [...screens, ...gallery.filter((g) => !screens.includes(g))];
  const note = (title, lines, i) => { if (!lines.length) return; const pic = extra[i]; steps.push({ title, body: lines.join(" "), ...(pic ? { image: pic.rel, alt: pic.alt, device: "picture" } : { device: "picture" }), source: "qwarter.com's case study" }); };
  note("The challenge", challenge, 0);
  note("The solution", solution, 1);
  note("Design strategy", strategy, 2);
  const deliverables = lists.deliverables || [];
  if (deliverables.length && lists.services?.length) steps.push({ title: "What was delivered", body: `Deliverables: ${deliverables.join(", ")}. Services: ${lists.services.join(", ")}.${lists.strategy?.length ? ` Strategy: ${lists.strategy.join(", ")}.` : ""}`, device: "picture", ...(extra[3] ? { image: extra[3].rel, alt: extra[3].alt } : {}), source: "qwarter.com's case study, its Deliverables, Services and Strategy lists" });
  if (steps.length === 1 && pages[0]) steps.push({ title: pages[0].title, body: `${name} as ${live ? address : "the case study"} shows it.`, image: stills("d", pages[0].name), alt: `${name}: ${pages[0].title}.`, device: live ? "desktop" : "picture" });

  // -- figures
  const figures = [];
  if (pages.length > 1) figures.push({ value: String(pages.length), label: live ? "Pages photographed from the live site" : "Pictures in qwarter.com's case study", source: "the shoot / the case study" });
  if (deliverables.length) figures.push({ value: String(deliverables.length), label: `Deliverables: ${deliverables.slice(0, 3).join(", ")}${deliverables.length > 3 ? "…" : ""}`, source: "qwarter.com's case study" });
  if (lists.services?.length) figures.push({ value: String(lists.services.length), label: `Services: ${lists.services.slice(0, 3).join(", ")}${lists.services.length > 3 ? "…" : ""}`, source: "qwarter.com's case study" });
  if (project.year) figures.push({ value: project.year, label: wp ? "The year qwarter.com's case study gives" : "The year", source: "Project Info" });
  if (palette.length && figures.length < 4) figures.push({ value: String(palette.length), label: "Colours in the palette", source: wp ? "Style & Imagery" : "observed" });

  const recordings = {};
  const webm = (dev) => (exists(path.join(dir, `${dev}.webm`)) ? `/media/work/${project.slug}/study/${dev}.webm` : undefined);
  if (hasDesktop) recordings.desktop = { src: `/media/work/${project.slug}/study/desktop.mp4`, webm: webm("desktop"), poster: `/media/work/${project.slug}/study/desktop-poster.jpg`, alt: `${name} on a desktop: ${pages.map((p) => p.title).join(", ")}.` };
  if (hasPhone) recordings.phone = { src: `/media/work/${project.slug}/study/phone.mp4`, webm: webm("phone"), poster: `/media/work/${project.slug}/study/phone-poster.jpg`, alt: `${name} on a phone.` };
  const facts = wp?.facts || project.facts || {};
  const client = [name, facts["industry type"] ? facts["industry type"].toLowerCase() : null, facts.location].filter(Boolean).join(", ");
  const status = live ? `Live at ${address}` : address ? `${address} is no longer online; the pictures are the case study's` : "From qwarter.com's case study";
  const study = {
    slug: project.slug, name, shortName: name, tagline, client, year: project.year || wp?.year || null, role,
    statement, summary: about || description || project.line,
    brief: [deliverables.length ? `Deliverables: ${deliverables.join(", ")}.` : null, lists.services?.length ? `Services: ${lists.services.join(", ")}.` : null, lists.strategy?.length ? `Strategy: ${lists.strategy.join(", ")}.` : null, lists.other?.length ? `Other: ${lists.other.join(", ")}.` : null].filter(Boolean).join(" ") || undefined,
    kind: wp?.service ? cap(wp.service.toLowerCase()) : project.made, status,
    url: live ? project.url : "", address,
    figures: figures.slice(0, 4), identity: identity.slice(0, 4), quote,
    steps, film: { src: `/media/work/${project.slug}/scroll.mp4`, webm: `/media/work/${project.slug}/scroll.webm`, poster: `/media/work/${project.slug}/scroll-poster.jpg`, alt: `${name}'s film.` },
    recordings, gallery: gallery.map((g) => ({ src: g.rel, alt: g.alt, source: g.from })),
    galleryNote: gallery.length ? [...new Set(gallery.map((g) => g.from.split(" (")[0]))].map((f) => (f.startsWith("qwarter.com") ? "pictures from qwarter.com's case study (its media library)" : `the site's own pictures, from ${f}`)).join("; ").replace(/^./, (c) => c.toUpperCase()) + "." : undefined,
    source: sources.join("; ") + ". Every word is qwarter.com's, the site's own or observed; nothing is written here.",
    generated: true,
  };
  if (!study.brief) delete study.brief;
  if (!study.quote) delete study.quote;
  if (!study.galleryNote) delete study.galleryNote;
  // what is written by hand about this study, laid over the generated record
  const overrideFile = path.join(OUT, "_overrides", `${project.slug}.json`);
  const copied = [];
  if (exists(overrideFile)) {
    const bySource = new Map(pics.map((p) => [path.basename(p.sourceFile || "").toLowerCase(), p]));
    const resolve = async (v) => {
      if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await resolve(x)); return out; }
      if (v && typeof v === "object") {
        if (v.$pic) {
          let p = bySource.get(String(v.$pic).toLowerCase());
          if (!p) {
            // a picture of qwarter.com's that is not on this case study's page (the portfolio tile, the home page): looked up by its file name in the snapshot's media
            const found = findUpload(String(v.$pic));
            if (!found) throw new Error(`${project.slug}: override names a picture neither the shoot nor the snapshot has: ${v.$pic}`);
            const d = await deliverPicture(found, dir, `pic-${String(++n).padStart(2, "0")}`);
            p = { ...d, sourceFile: found, kind: /logo/i.test(v.$pic) ? "logo" : "picture", from: "qwarter.com (its media library)", alt: "" };
            pics.push(p);
            bySource.set(String(v.$pic).toLowerCase(), p);
          }
          return p.rel;
        }
        if (v.$copy) {
          const stem = (v.as || path.basename(v.$copy)).replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
          const d = await deliverPicture(v.$copy, dir, stem, { max: v.max || 1600 });
          copied.push(path.basename(d.file));
          return d.rel;
        }
        const out = {}; for (const [k, x] of Object.entries(v)) out[k] = await resolve(x); return out;
      }
      return v;
    };
    const override = await resolve(JSON.parse(read(overrideFile)));
    const { source: overrideSource, ...rest } = override;
    Object.assign(study, rest);
    if (overrideSource) study.source = `${study.source} By hand (content/studies/_overrides/${project.slug}.json): ${overrideSource}`;
    study.generated = true;
  }
  // a step that plays a recording not rendered yet waits for it (the phone frames arrive with a later shoot)
  study.steps = study.steps.filter((st) => !st.recording || study.recordings[st.recording]);
  // only what the study shows stays in study/ (the walkthrough's files aside)
  const shown = new Set([...study.identity.map((t) => t.image), ...study.gallery.map((g) => g.src), ...study.steps.map((st) => st.image)].filter(Boolean).map((rel) => path.basename(rel)));
  for (const f of fs.readdirSync(dir)) if ((/^pic-\d+\.(png|jpg)$/.test(f) || f === "header.jpg" || copied.includes(f)) && !shown.has(f)) fs.rmSync(path.join(dir, f));
  fs.mkdirSync(path.join(OUT, "_pictures"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "_pictures", `${project.slug}.json`), JSON.stringify(pics.filter((p) => shown.has(path.basename(p.file))).map((p) => ({ file: p.rel, from: p.from, source: path.basename(p.sourceFile || ""), kind: p.kind, width: p.width, height: p.height })), null, 2) + "\n");
  fs.writeFileSync(file, JSON.stringify(study, null, 2) + "\n");
  console.log(`${project.slug}: ${steps.length} steps, ${identity.length} tiles, ${gallery.length} pictures, ${figures.length} figures${hasDesktop ? ", desktop" : ""}${hasPhone ? ", phone" : ""}${wp ? "" : " (no case study on qwarter.com)"}${live ? "" : " (not live)"}`);
}
