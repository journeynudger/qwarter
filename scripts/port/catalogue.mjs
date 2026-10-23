#!/usr/bin/env node
/**
 * Qwarter's catalogue, from qwarter.com's own WordPress and the clients' live sites.
 *
 * Facts come from the WordPress snapshot (scripts/port/fetch.py → .port-cache/qwarter/): every case study
 * is a page under /portfolio/ (its title; the service line under its title; "Industry Type / Location /
 * Company Size / Product / Services"; the "Live Website" it names; "Project Info <year>"; the first
 * paragraph about the client), the portfolio page's own blurbs, and the home page's Selected Work tiles
 * (the sites it links to that have no case study: Butter, Core Rhythm Fitness, Ignite Beacon). Nothing is
 * taken from a case study's challenge/solution prose: on qwarter.com several of those were pasted from
 * another client's page and never rewritten.
 *
 * Pictures come from the client's live site when it has been photographed (scripts/work/shoot.mjs through
 * the capture workflow → .port-cache/shots/<slug>/: frames, manifest.json with each page's own title, and
 * the films the site plays), and otherwise from the pictures the case study itself shows (its media
 * library, under .port-cache/qwarter/uploads/). A project whose own build was photographed already
 * (public/media/work/<slug>/raw/ exists) keeps those frames; its shots only add the films.
 *
 * Writes public/media/work/<slug>/raw/ (frames, intro film) and content/work.json; then run
 * scripts/work/prepare.mjs and scripts/work/video.mjs. Usage:
 *   node scripts/port/catalogue.mjs [--cache .port-cache/qwarter] [--shots .port-cache/shots] [--dry]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const take = (k, d) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; return argv[i + 1]; };
const CACHE = path.resolve(ROOT, take("cache", ".port-cache/qwarter"));
const SHOTS = path.resolve(ROOT, take("shots", ".port-cache/shots"));
const MEDIA = path.resolve(ROOT, take("media", ".port-cache/media"));
const DRY = argv.includes("--dry");
const WORK = path.join(ROOT, "public/media/work");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"];

/** The strip's order, Lorenzo's (2026-10-22): Butter's and Jeff's films open it, then Stairway and the rest. */
const FIRST = ["butter", "jr-pugh", "stairway", "serein", "journey", "theroom", "bambino", "lorenzo-type"];
/** Projects photographed from their own builds or stills: their frames stay; shots add films only. */
const OWN_FRAMES = ["jr-pugh", "serein", "journey", "stairway", "theroom", "bambino", "lorenzo-type"];
const LIVE_FRAMES = ["jr-pugh", "bambino"];
// a splash a site plays on arrival, recorded from the site's own files (scripts/work/record.mjs → raw/loader.mp4): the film
// opens with it, before the clip the site plays. raw/ is not committed, so the splash is prepended only when the recording is there
const SPLASH = { "jr-pugh": { file: "loader.mp4", seconds: 3.9, from: "the splash jeffvhs.com plays on arrival (recorded from the site's own files, scripts/work/record.mjs)" } }; // photographed from its own build once; the live site replaces those frames when it has been shot
/** Films from outside the shots: the client's own, found where the note says. */
const FILMS = {
  "jr-pugh": { file: path.join(MEDIA, "jeffvhs.com/wp-content/uploads/2026/07/brazil-reel-tease.mp4"), from: "the reel jeffvhs.com plays (its media library, 2026/07/brazil-reel-tease.mp4)" },
  tima: { file: path.join(CACHE, "uploads/2022/07/tima-home-bg.mp4"), from: "the film behind Titanium Motor Arts on qwarter.com/portfolio/ (its media library, 2022/07/tima-home-bg.mp4)" },
  journey: { file: path.join(CACHE, "uploads/2022/07/Journey_Brain.mp4"), from: "the film behind Journey on qwarter.com/portfolio/ (its media library, 2022/07/Journey_Brain.mp4)" },
};
/** Case-study pages that are another page's copy, not a case study of their own (listed in CLAUDE.md's questions). */
const COPIES = ["11-hamilton-home"];
/** Projects Lorenzo asked to take off the site for now (2026-10-23: "remove kindfootprint for now"); their media leave the tree with them (main's 3faeb72 still holds Kind Footprint's, and .port-cache/shots/ its shoot). */
const WITHDRAWN = ["kind-footprint"];
/** A client the case study pages name without a line of their own: the home page's Selected Work says it. */
const NOT_PICTURES = /logo|bug|ico-|icon|removebg|headshot|portrait|partner-logo|palette|gradient|watercolor|mickeyhand|placeholder|Primal-Journey|\.gif$|\.svg$|\.pdf$/i;

const read = (f) => fs.readFileSync(f, "utf8");
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘").replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”").replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&hellip;/g, "…").replace(/&#038;/g, "&");
const plain = (html) => decode(String(html).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const firstSentence = (text, max = 180) => { const m = text.match(/^.{12,}?[.!?](?=\s|$)/); const s = (m ? m[0] : text).trim(); return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : s; };
const CASE = { "3d": "3D", "ui/ux": "UI/UX", seo: "SEO", "google my business": "Google My Business", acuity: "Acuity", shopify: "Shopify", wordpress: "WordPress", esg: "ESG", api: "API", ecommerce: "e-commerce", "e-commerce": "e-commerce", ai: "AI" };
const sentence = (s) => { let t = s.toLowerCase().replace(/\s+/g, " ").trim(); for (const [k, v] of Object.entries(CASE)) t = t.replace(new RegExp(`(^|[^a-z0-9])${k.replace(/[/]/g, "\\/")}(?=$|[^a-z0-9])`, "g"), `$1${v}`); return t.charAt(0).toUpperCase() + t.slice(1); };
const host = (u) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleOf = (title, route, siteName) => {
  if (route === "/" || route === "") return "Home";
  const parts = plain(title || "").split(/\s+[|–—·•:-]\s+|\s+\|\s+/).map((p) => p.trim()).filter(Boolean);
  const own = parts.filter((p) => p.toLowerCase() !== siteName.toLowerCase() && !/^https?:|\.(com|net|org|art|audio)$/i.test(p));
  const t = own[0] || parts[0] || route.replace(/^\/+|\/+$/g, "").split("/").pop().replace(/[-_]+/g, " ");
  return t.length > 48 ? `${t.slice(0, 47).replace(/\s+\S*$/, "")}…` : t || "Page";
};

// ---- WordPress: the case studies ------------------------------------------------------------------------
const pages = JSON.parse(read(path.join(CACHE, "pages.json")));
const portfolio = pages.find((p) => p.slug === "portfolio");
const studies = pages.filter((p) => p.parent === portfolio?.id && p.status === "publish");
const htmlOf = (p) => { const f = path.join(CACHE, "html", `portfolio__${p.slug}.html`); return fs.existsSync(f) ? read(f) : (p.content?.rendered || ""); };
const uploadsDir = path.join(CACHE, "uploads");
const uploadPath = (url) => { const i = (url || "").indexOf("/wp-content/uploads/"); if (i < 0) return null; const rel = decodeURIComponent(url.slice(i + "/wp-content/uploads/".length).split(/[?#]/)[0]).replace(/-\d{2,4}x\d{2,4}(?=\.\w{3,4}$)/, ""); const f = path.join(uploadsDir, rel); return fs.existsSync(f) ? f : null; };

// the portfolio page's own blurbs (a Divi slider: a name, a line, a film or picture behind it)
const blurbs = new Map();
{
  const html = fs.existsSync(path.join(CACHE, "html/portfolio.html")) ? read(path.join(CACHE, "html/portfolio.html")) : "";
  for (const m of html.matchAll(/<h2[^>]*>([^<]{2,80})<\/h2>\s*<p>([^<]{10,240})<\/p>/g)) blurbs.set(plain(m[1]).toLowerCase(), plain(m[2]));
}
// the home page's Selected Work: tiles that link to the clients' sites (a blurb module with words, or a picture)
const selected = [];
{
  const html = fs.existsSync(path.join(CACHE, "html/home.html")) ? read(path.join(CACHE, "html/home.html")) : "";
  const a = html.indexOf("Selected"), b = html.indexOf("FAQ", a);
  const region = a > 0 ? html.slice(Math.max(0, a - 6000), b > a ? b : undefined) : "";
  const add = (url, more) => { if (!url || /qwarter\.com/.test(url)) return; const u = url.replace(/\/+$/, "").replace(/^http:\/\//, "https://"); const had = selected.find((s) => host(s.url) === host(u)); if (had) Object.assign(had, more); else selected.push({ url: u, img: null, name: null, line: null, ...more }); };
  for (const m of region.matchAll(/<div class="et_pb_module et_pb_blurb[\s\S]*?<h4[^>]*>\s*(?:<a[^>]*href="([^"]+)"[^>]*>)?([^<]{2,60})(?:<\/a>)?\s*<\/h4>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g)) {
    const url = m[1] || null, name = plain(m[2]), desc = m[3];
    const line = plain((desc.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [, ""])[1]);
    if (url) add(url, { name, line: line || null }); else selected.push({ url: null, img: null, name, line: line || null });
  }
  for (const m of region.matchAll(/<a\b[^>]*href="(https?:\/\/(?!qwarter\.com)[^"]+)"[^>]*>\s*<span class="et_pb_image_wrap[^"]*">\s*<img[^>]+src="([^"]+)"/g)) add(m[1], { img: m[2] });
  for (const m of region.matchAll(/<a\b[^>]*href="(https?:\/\/(?!qwarter\.com)[^"]+)"[^>]*>([^<]{2,40})<\/a>/g)) { const t = plain(m[2]); if (t && !/\./.test(t)) add(m[1], { name: t }); }
}

function facts(p) {
  const html = htmlOf(p);
  const body = html.slice(Math.max(0, html.indexOf("<article")));
  const name = plain((html.match(/<title>([^<]+)<\/title>/) || [, p.title?.rendered || p.slug])[1].split(" | ")[0]);
  const afterH1 = body.split(/<\/h1>/)[1] || "";
  const madeRaw = plain(afterH1.split(/<h4|<strong>\s*Industry|<strong>\s*Location/)[0]).replace(/^\/\/\s*/, "");
  const made = madeRaw && madeRaw.length < 90 ? sentence(madeRaw) : null;
  const f = {};
  for (const m of body.matchAll(/<strong>\s*(Industry Type|Location|Company Size|Organization Size|Product|Services|Website)\s*:?\s*<\/strong>\s*:?\s*([^<]+)/g)) f[m[1].toLowerCase()] = plain(m[2]);
  const live = (body.match(/Live Website[\s\S]{0,400}?<li>\s*(?:<a[^>]*>)?\s*([a-z0-9.-]+\.[a-z]{2,}(?:\/[a-z0-9-]+)*)/i) || [])[1] || (f.website ? f.website.replace(/^https?:\/\//, "") : null);
  const url = live ? `https://${live.toLowerCase().replace(/\/+$/, "")}` : null;
  const year = (body.match(/Project\s*(?:<em>)?Info(?:<\/em>)?\s*<\/h2>\s*<p[^>]*>\s*(20\d\d)/) || body.match(/Project Info\s*(20\d\d)/) || [])[1] || null;
  // the first paragraph that speaks of the client, by name
  const tokens = [...new Set([name, ...name.split(/\s+/)].map((t) => t.replace(/[^a-z0-9]/gi, "")).filter((t) => t.length >= 4))];
  const texts = [...body.matchAll(/<(h3|p)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => plain(m[2])).filter((t) => t.length >= 60 && !/\d+pt\b|^Aa$/.test(t));
  const about = texts.find((t) => tokens.some((k) => new RegExp(`\\b${k}`, "i").test(t))) || null;
  const pictures = [];
  for (const m of body.matchAll(/<img[^>]+(?:data-src|src)="(https?:\/\/qwarter\.com\/wp-content\/uploads\/[^"]+)"/g)) {
    const u = m[1];
    if (NOT_PICTURES.test(u)) continue;
    const file = uploadPath(u);
    if (file && !pictures.includes(file)) pictures.push(file);
  }
  return { name, made, facts: f, url, year, about, pictures, blurb: blurbs.get(name.toLowerCase()) || null };
}

// ---- the shots of the live sites ------------------------------------------------------------------------
const PARKED = /for sale|parked|domain|godaddy|hugedomains|sedo|expired|suspended|not found|coming soon|under construction|access denied|forbidden|\b40\d\b|\b50\d\b|unavailable|attention required|just a moment|verify you are human|blocked|error/i;
/** A film's origin, written without the address itself (nothing here loads from or links to it). */
const filmFrom = (src, where) => `the film ${where} (${src.replace(/^https?:\/\//, "").replace(/\/wp-content\/uploads\//, ", media library ").split("?")[0]})`;
/** Every shoot on disk, by the host it photographed: a tile named only by its address finds its shots this way. */
const shotsByHost = new Map();
if (fs.existsSync(SHOTS)) for (const d of fs.readdirSync(SHOTS)) { const mf = path.join(SHOTS, d, "manifest.json"); if (fs.existsSync(mf)) { try { shotsByHost.set(host(JSON.parse(read(mf)).base), d); } catch { /* not a manifest */ } } }
/** A site's own title as a name: its words, in title case when it shouts them and capitalised when it whispers. */
const nameFrom = (title) => { const t = plain(title || "").split(/\s+[|–—·•:-]\s+|\s+\|\s+/)[0].trim(); if (!t) return null; if (t === t.toUpperCase() && /[A-Z]/.test(t)) return t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase()); if (t === t.toLowerCase()) return t.charAt(0).toUpperCase() + t.slice(1); return t; };
function shotsOf(slug, name, url) {
  let dir = path.join(SHOTS, slug);
  if (!fs.existsSync(path.join(dir, "manifest.json")) && url && shotsByHost.has(host(url))) dir = path.join(SHOTS, shotsByHost.get(host(url)));
  const mf = path.join(dir, "manifest.json");
  if (!fs.existsSync(mf)) return null;
  const m = JSON.parse(read(mf));
  const pages = [];
  for (const pg of m.pages || []) {
    if (!pg.frame || !fs.existsSync(path.join(dir, pg.frame))) continue;
    if (pages.some((q) => q.title === pg.title && q.height === pg.height)) continue; // /home, /index: the home page again
    pages.push(pg);
  }
  if (!pages.length) return null;
  const home = pages[0];
  const tokens = [...new Set([name, ...name.split(/\s+/)].map((t) => t.replace(/[^a-z0-9]/gi, "")).filter((t) => t.length >= 4))];
  const titles = pages.map((pg) => `${pg.title || ""} ${pg.description || ""}`).join(" ");
  const named = tokens.some((k) => new RegExp(k, "i").test(titles));
  const theirs = url && host(m.base) === host(url);
  const parked = PARKED.test(home.title || "") && !named;
  if (parked || (!named && !theirs)) return { rejected: parked ? `its home is titled "${home.title}"` : `its titles ("${home.title}") do not name ${name} and ${host(m.base)} is not the site the case study names` };
  const videos = (m.videos || []).filter((v) => v.file && fs.existsSync(path.join(dir, v.file)));
  return { dir, folder: path.basename(dir), base: m.base, shot: m.shot, pages, videos, title: home.title, description: home.description };
}

/** Every frame a shoot took, by the name it is delivered under: the viewport frame, the whole page, and the same two on a phone. */
const framesOf = (shots) => shots.pages.flatMap((pg) => {
  const f = (file, name) => (file && fs.existsSync(path.join(shots.dir, file)) ? [{ src: path.join(shots.dir, file), name }] : []);
  return [...f(pg.frame, `${pg.name}.png`), ...f(pg.full, `${pg.name}-full.png`), ...f(pg.phone?.frame, `m-${pg.name}.png`), ...f(pg.phone?.full, `m-${pg.name}-full.png`)];
});

// ---- assemble ---------------------------------------------------------------------------------------------
const work = JSON.parse(read(path.join(ROOT, "content/work.json")));
const existing = new Map(work.projects.filter((p) => !p.fromWordPress).map((p) => [p.slug, p]));
const out = [];
const notes = [];

function deliver(slug, files, { frames = [], intro = null } = {}) {
  // frames: [{src, name}] PNG/JPEG → raw/<name>.png ; intro: {file} → raw/intro.<ext>
  const raw = path.join(WORK, slug, "raw");
  if (DRY) return;
  fs.mkdirSync(raw, { recursive: true });
  for (const f of frames) fs.copyFileSync(f.src, path.join(raw, f.name));
  if (intro) {
    const ext = path.extname(intro.file).toLowerCase() === ".webm" ? "webm" : "mp4";
    const target = path.join(raw, `intro.${ext}`);
    const splash = SPLASH[slug] && fs.existsSync(path.join(raw, SPLASH[slug].file)) ? path.join(raw, SPLASH[slug].file) : null;
    if (splash && ext === "mp4") {
      // the splash first, then the site's own clip, both at the same size and rate, one cross-fade between them
      const tmp = path.join(raw, "intro.tmp.mp4");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", splash, "-i", intro.file, "-filter_complex",
        `[0:v]trim=0:${SPLASH[slug].seconds},setpts=PTS-STARTPTS,scale=1440:900:force_original_aspect_ratio=increase,crop=1440:900,fps=30,format=yuv420p[a];[1:v]scale=1440:900:force_original_aspect_ratio=increase,crop=1440:900,fps=30,format=yuv420p[b];[a][b]xfade=transition=fade:duration=0.6:offset=${(SPLASH[slug].seconds - 0.6).toFixed(2)}[v]`,
        "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", tmp]);
      fs.renameSync(tmp, target);
    } else fs.copyFileSync(intro.file, target);
  }
}

async function fromUploads(slug, files, max = 6) {
  // the case study's own pictures, 1440 wide, as the project's frames
  const pages = [];
  for (const file of files) {
    try {
      const meta = await sharp(file).metadata();
      if ((meta.width || 0) < 600) continue;
      const name = `img-${String(pages.length + 1).padStart(2, "0")}`;
      if (!DRY) { fs.mkdirSync(path.join(WORK, slug, "raw"), { recursive: true }); await sharp(file).rotate().flatten({ background: "#ffffff" }).resize({ width: 1440 }).png().toFile(path.join(WORK, slug, "raw", `${name}.png`)); }
      pages.push({ name, title: `Picture ${pages.length + 1}` });
      if (pages.length >= max) break;
    } catch (e) { notes.push(`${slug}: ${path.basename(file)} unreadable (${String(e.message).split("\n")[0]})`); }
  }
  return pages;
}

// 1. the case studies
for (const p of studies) {
  const slug = p.slug === "tima" ? "tima" : p.slug;
  if (COPIES.includes(slug)) { notes.push(`${slug}: left out, its page is another case study's copy (see CLAUDE.md)`); continue; }
  const f = facts(p);
  const sel = selected.find((s) => s.name && s.name.toLowerCase() === f.name.toLowerCase()) || null;
  const known = ["journey-nudge"].includes(slug) ? existing.get("journey") : null; // photographed from its own build already
  if (known) {
    // the case study's facts join the project we already have
    const src = `${known.source}; qwarter.com/portfolio/${p.slug}/ (WordPress page ${p.id}, modified ${p.modified.slice(0, 10)}): ${f.made || ""}${f.year ? `, ${f.year}` : ""}${f.facts["industry type"] ? `; ${f.facts["industry type"]}, ${f.facts.location || ""}` : ""}`;
    existing.set("journey", { ...known, made: f.made || known.made, facts: f.facts, blurb: f.blurb || undefined, source: src });
    continue;
  }
  const place = [f.facts["industry type"], f.facts.location].filter(Boolean).join(", ");
  const line = sel?.line || f.blurb || place || (f.about ? firstSentence(f.about, 120) : null) || f.made || f.name;
  const shots = shotsOf(slug, f.name, f.url);
  const where = `qwarter.com/portfolio/${p.slug}/ (WordPress page ${p.id}, modified ${p.modified.slice(0, 10)})`;
  const provenance = [`name, service line${f.year ? ", year" : ""}${f.url ? ", live site" : ""} and facts from ${where}`, sel?.line ? "line from qwarter.com's home page (Selected Work)" : f.blurb ? "line from qwarter.com/portfolio/ (its slider)" : place ? "line: the case study's Industry Type and Location" : f.about ? "line: the case study's first sentence about the client" : "line: the service line"];
  const project = { slug, name: f.name, url: f.url, line, made: f.made || "Case study", year: f.year || (p.date || "").slice(0, 4) || null, facts: f.facts, about: f.about ? firstSentence(f.about, 240) : undefined, cover: null, pages: [], fromWordPress: true, source: "" };
  if (shots && !shots.rejected) {
    deliver(slug, null, { frames: framesOf(shots) });
    project.pages = shots.pages.map((pg) => ({ name: pg.name, title: titleOf(pg.title, pg.route, f.name) }));
    project.cover = project.pages[0].name;
    if (!project.url) { project.url = shots.base.replace(/\/+$/, "") + (shots.pages[0].route && shots.pages[0].route !== "/" ? shots.pages[0].route.replace(/\/+$/, "") : ""); provenance.push(`live site: the one photographed, ${host(project.url)}`); }
    provenance.push(`pictures: ${host(shots.base)} photographed on ${shots.shot.slice(0, 10)} (${shots.pages.length} pages, titles the site's own)`);
    const film = shots.videos[0];
    if (film) { deliver(slug, null, { intro: { file: path.join(shots.dir, film.file) } }); project.film = { intro: `intro.${path.extname(film.file).slice(1)}`, from: filmFrom(film.src, `${host(shots.base)}${film.route} plays`) }; }
  } else {
    if (shots?.rejected) notes.push(`${slug}: the live site's shots were not used: ${shots.rejected}`);
    project.pages = await fromUploads(slug, f.pictures);
    if (project.pages.length) { project.cover = project.pages[0].name; provenance.push(`pictures: the ones the case study shows (its media library), ${project.pages.length} of them`); }
    else { project.media = false; notes.push(`${slug}: no picture (no shots, nothing usable in the case study)`); }
  }
  if (!project.film && FILMS[slug] && fs.existsSync(FILMS[slug].file) && project.media !== false) { deliver(slug, null, { intro: { file: FILMS[slug].file } }); project.film = { intro: `intro.${path.extname(FILMS[slug].file).slice(1)}`, from: FILMS[slug].from }; }
  if (project.film) provenance.push(`film opens with ${project.film.from}`);
  project.source = provenance.join("; ");
  out.push(project);
}

// 2. the home page's Selected Work: sites without a case study
for (const s of selected) {
  if (!s.url) continue;
  const h = host(s.url);
  if ([...existing.values(), ...out].some((p) => p.url && host(p.url) === h)) continue;
  const given = s.name || h;
  const shots = shotsOf(s.name ? slugOf(s.name) : slugOf(h.replace(/\.[a-z]+$/, "")), given, s.url);
  const slug = s.name ? slugOf(s.name) : shots?.folder || slugOf(h.replace(/\.[a-z]+$/, ""));
  const project = { slug, name: given, url: s.url, line: s.line ? firstSentence(s.line, 120) : null, about: s.line && s.line.length > 40 ? s.line : undefined, made: "Website", year: null, cover: null, pages: [], fromWordPress: true, source: "" };
  const provenance = [`qwarter.com's home page, Selected Work (WordPress page ${pages.find((p) => p.slug === "home")?.id ?? "home"}, modified ${pages.find((p) => p.slug === "home")?.modified?.slice(0, 10)}): linked as ${h}${s.name ? `, named "${s.name}"` : ", with a picture and no words"}${s.line ? "; its line" : ""}`];
  if (shots && !shots.rejected) {
    if (!s.name) { project.name = nameFrom(shots.title) || h; provenance.push(`name: the site's own title "${shots.title}"`); }
    if (!project.line) { project.line = shots.description ? firstSentence(shots.description) : (plain(shots.title || "").split(/\s+[|–—·-]\s+/)[1] || project.name); provenance.push(shots.description ? "line: the site's own description" : "line: the site's own title"); }
    deliver(slug, null, { frames: framesOf(shots) });
    project.pages = shots.pages.map((pg) => ({ name: pg.name, title: titleOf(pg.title, pg.route, project.name) }));
    project.cover = project.pages[0].name;
    provenance.push(`pictures: ${h} photographed on ${shots.shot.slice(0, 10)} (${shots.pages.length} pages)`);
    const film = shots.videos[0];
    if (film) { deliver(slug, null, { intro: { file: path.join(shots.dir, film.file) } }); project.film = { intro: `intro.${path.extname(film.file).slice(1)}`, from: filmFrom(film.src, `${h}${film.route} plays`) }; provenance.push(`film opens with ${project.film.from}`); }
  } else {
    if (shots?.rejected) notes.push(`${slug}: the live site's shots were not used: ${shots.rejected}`);
    const tile = s.img ? uploadPath(s.img) : null;
    project.pages = tile ? await fromUploads(slug, [tile], 1) : [];
    if (project.pages.length) { project.cover = project.pages[0].name; provenance.push("picture: the tile qwarter.com's home page shows for it"); } else project.media = false;
    if (!project.line) project.line = h;
  }
  project.source = provenance.join("; ");
  out.push(project);
}

// 3. the projects photographed from their own builds: shots add their films
for (const slug of OWN_FRAMES) {
  const p = existing.get(slug);
  if (!p) continue;
  const shots = shotsOf(slug, p.name, p.url);
  if (LIVE_FRAMES.includes(slug) && shots && !shots.rejected) {
    // the live site, as it stands, replaces the frames taken from the project's own build (Lorenzo, 2026-10-22: "pull from the latest jeffvhs.com")
    const raw = path.join(WORK, slug, "raw");
    if (!DRY && fs.existsSync(raw)) for (const f of fs.readdirSync(raw)) if (/\.png$/.test(f)) fs.rmSync(path.join(raw, f));
    deliver(slug, null, { frames: framesOf(shots) });
    p.pages = shots.pages.map((pg) => ({ name: pg.name, title: titleOf(pg.title, pg.route, p.name) }));
    p.cover = p.pages[0].name;
    p.source = p.source.replace(/; stills from [^;]*/, "").replace(/; pictures: [^;]*/, "") + `; pictures: ${host(shots.base)} photographed on ${shots.shot.slice(0, 10)} (${shots.pages.length} pages, titles the site's own)`;
  }
  // a project photographed from its own build keeps those frames, and takes the live site's phone frames for the pages whose names match
  if (!LIVE_FRAMES.includes(slug) && shots && !shots.rejected) deliver(slug, null, { frames: framesOf(shots).filter((f) => /^m-/.test(f.name) && p.pages.some((pg) => f.name === `m-${pg.name}.png` || f.name === `m-${pg.name}-full.png`)) });
  const film = shots && !shots.rejected ? shots.videos[0] : null;
  if (film) { deliver(slug, null, { intro: { file: path.join(shots.dir, film.file) } }); p.film = { intro: `intro.${path.extname(film.file).slice(1)}`, from: filmFrom(film.src, `${host(shots.base)}${film.route} plays`) }; }
  else if (FILMS[slug] && fs.existsSync(FILMS[slug].file)) { deliver(slug, null, { intro: { file: FILMS[slug].file } }); p.film = { intro: `intro.${path.extname(FILMS[slug].file).slice(1)}`, from: FILMS[slug].from }; }
  if (p.film && SPLASH[slug] && fs.existsSync(path.join(WORK, slug, "raw", SPLASH[slug].file))) p.film.from = `${SPLASH[slug].from}, then ${p.film.from}`;
  p.source = p.source.replace(/; film opens with .*$/, "");
  if (p.film) p.source += `; film opens with ${p.film.from}`;
  out.push(p);
}

// 4. the withdrawn leave (their media directory with them, below), then the order: Lorenzo's first, then by year, newest first; catalogue entries without pictures last
for (const slug of WITHDRAWN) { const i = out.findIndex((p) => p.slug === slug); if (i >= 0) { out.splice(i, 1); notes.push(`${slug}: withdrawn for now (Lorenzo, 2026-10-23), see CLAUDE.md`); } }
const rank = (p) => { const i = FIRST.indexOf(p.slug); return i < 0 ? 100 : i; };
out.sort((a, b) => (a.media === false) - (b.media === false) || rank(a) - rank(b) || Number(b.year || 0) - Number(a.year || 0) || a.name.localeCompare(b.name));
const projects = out.map((p, i) => ({ ...p, numeral: ROMAN[i] }));
if (!DRY) {
  work._provenance = "Qwarter's work: the four sites photographed from their own builds or stills (scripts/work/shoot.mjs), and the catalogue qwarter.com's WordPress publishes (scripts/port/catalogue.mjs reads the snapshot: each case study's facts, the portfolio and home pages' own lines) with each client's live site photographed where it still stands. Every word under a project is qwarter.com's, the site's own or its repository's: nothing here is written for effect. Each project's source says which.";
  work._fields = "numeral/name/url/line/made/year are shown; facts holds the case study's Industry Type / Location / Company Size / Product / Services as written; cover names the frame the project is introduced with; pages lists the frames the slideshow walks, in order, each with the title the site itself gives that page (or 'Picture N' for a case study's own pictures); film.intro names the clip in raw/ the project's film opens with and film.from where it came from; media:false marks a project with no picture yet: listed under Work, not on the strip.";
  fs.writeFileSync(path.join(ROOT, "content/work.json"), JSON.stringify({ ...work, projects }, null, 2) + "\n");
  for (const d of fs.readdirSync(WORK)) if (!projects.some((p) => p.slug === d && p.media !== false)) fs.rmSync(path.join(WORK, d), { recursive: true, force: true });
}
console.log(`${studies.length} case studies + ${selected.filter((s) => s.url).length} Selected Work sites → ${projects.filter((p) => p.media !== false).length} projects with pictures, ${projects.filter((p) => p.media === false).length} without; ${projects.length} in all`);
for (const p of projects) console.log(`  ${p.numeral.padEnd(5)} ${p.slug.padEnd(22)} ${(p.url ? host(p.url) : "—").padEnd(28)} ${String(p.year || "").padEnd(5)} ${p.pages.length} pages${p.film ? ", film" : ""}${p.media === false ? ", NO PICTURE" : ""}  | ${p.line}`);
for (const n of notes) console.log(`  - ${n}`);
