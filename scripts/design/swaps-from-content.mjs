#!/usr/bin/env node
/**
 * The swap specs (content/swaps/<slug>.json) that put Qwarter's content into the reference design's pages,
 * written from content/work.json and content/site.json so that every value on a page is one of ours and
 * says so. scripts/design/swap.mjs applies them; tests/swaps.test.ts checks every word against qwarter.com's
 * snapshot or these two files.
 *
 * What goes where (Depo Luxe's structure, Qwarter's content):
 *   every page   header: brand words, tagline, menu (Featured · Work · Approach · Contact; its Talent item
 *                removed); side menu the same; footer: our social links, our copyright line, its legal links
 *                removed; the cookie dialog hidden and told the truth (this site sets no cookies); the logo
 *                masks replaced by Qwarter's mark (the SVG file itself, so its stylesheet needs no change)
 *   home         the film lists: the featured projects, twice (its list loops), its film and its cover; the title,
 *                what was made and the year in the attributes its script reads
 *   work         (its Archive page) every project twice in its looping list and film stack: numeral, name, what was made
 *   approach     (its About page) the statement and qwarter.com's welcome as the opening text; its six titled
 *                blocks carry qwarter.com's six questions and answers, illustrated with our films
 *   contact      (its Information page) the ways to reach Qwarter, in its looping lists
 *   project      (its film page) a template: {{name}}, {{made}}, {{year}}, {{film}}, {{cover}} filled per project
 *                at render time (lib/content.ts pageMarkup)
 *
 * Usage: node scripts/design/swaps-from-content.mjs && node scripts/design/swap.mjs && node scripts/design/prune.mjs
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const work = JSON.parse(fs.readFileSync(path.join(ROOT, "content/work.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8"));
const { brand, nav, footer, statement, about, contact } = site.chrome;
const projects = work.projects.filter((p) => p.media !== false);
const versioned = (url) => `${url}?v=${crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, "public", url))).digest("hex").slice(0,10)}`;
const media = (slug) => ({
  cover: versioned(`/media/work/${slug}/cover.jpg`), cover2x: versioned(`/media/work/${slug}/cover@2x.jpg`), tile: versioned(`/media/work/${slug}/tile.jpg`), tile2x: versioned(`/media/work/${slug}/tile@2x.jpg`),
  film: versioned(`/media/work/${slug}/scroll.mp4`), blur: versioned(`/media/work/${slug}/blur.jpg`),
});
const SRC = { work: "content/work.json", site: "content/site.json" };
const host = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
const OUT = path.join(ROOT, "content/swaps");
/** A page heading for a page whose reference has none, present for readers and search, out of the way of the design. */
// a project with a case study (content/studies/<slug>.json) is our own page: data-internal makes the reference
// design's script leave the link to the browser (its click handler skips links that carry it)
const studied = (slug) => fs.existsSync(path.join(ROOT, "content/studies", `${slug}.json`));
const hiddenH1 = (text) => `<h1 style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">${text}</h1>`;
const svg = (name) => fs.readFileSync(path.join(ROOT, "public/design/qwarter", name), "utf8").replace(/<\?xml[^>]*>\s*/, "").trim();
fs.mkdirSync(OUT, { recursive: true });

/** The header, side menu, footer and windows every page carries. `current` is the page's own path. */
function chrome(current) {
  const items = nav; // Featured, Work, Stories, Approach, Contact
  const social = contact.social ?? [];
  const swaps = [
    { select: "#Header .title", attr: { title: `${brand.left} ${brand.right}`, "data-internal": "" } },
    { select: "#Header .logo-depo", attr: { "aria-label": brand.left } },
    { select: "#Header .title span:nth-of-type(1)", text: brand.left, source: `${SRC.site} chrome.brand.left` },
    { select: "#Header .title span:nth-of-type(2)", text: brand.right, source: `${SRC.site} chrome.brand.right` },
    { select: "#Header .claim", text: brand.tagline, source: `${SRC.site} chrome.brand.tagline` },
    // Use all five positions; Stories takes the previously unused third link. Keep its original id
    // because the carried design animates these ids, and let Stories load as its own document.
    ...[1, 2, 3, 4, 5].map((n, i) => ({ select: `#Header nav a:nth-of-type(${n})`, text: items[i].label, attr: { href: items[i].href, "aria-current": items[i].href === current ? "page" : null, "data-internal": "" }, source: `${SRC.site} chrome.nav[${i}]` })),
    ...[1, 2, 3, 4, 5].map((n, i) => ({ select: `#Sidemenu .list li:nth-child(${n}) a`, attr: { href: items[i].href, "aria-current": items[i].href === current ? "page" : null, "data-internal": "" } })),
    ...[1, 2, 3, 4, 5].map((n, i) => ({ select: `#Sidemenu .list li:nth-child(${n}) a .__text`, text: items[i].label, source: `${SRC.site} chrome.nav[${i}]` })),
    // the footer: the three social links (Instagram, Twitter, LinkedIn as qwarter.com lists them), our line, no legal pages
    ...social.slice(0, 3).map((l, i) => ({ select: `.footer__rrss li:nth-child(${i + 1}) a`, text: l.label, attr: { href: l.href, rel: "noopener" }, source: `${SRC.site} chrome.contact.social[${i}]` })),
    ...(social.length < 3 ? [{ select: `.footer__rrss li:nth-child(n+${social.length + 1})`, remove: true, reason: "Qwarter lists fewer social links than the reference" }] : []),
    { select: ".copyright .text", text: footer, source: `${SRC.site} chrome.footer` },
    { select: ".copyright .fake", text: footer, source: `${SRC.site} chrome.footer` },
    { select: ".footer__legales", remove: true, reason: "the reference's legal pages; Qwarter has none of these pages and sets no cookies" },
    // the logos the script reveals four paths at a time: the preloader's two (its DEPO, then LUXE: here the mark,
    // then the word) and the footer's (scripts/brand/letters.mjs draws both)
    { select: "#Preloader figure.__logo:nth-of-type(1)", html: svg("loader-mark.svg"), source: "public/design/qwarter/loader-mark.svg, Qwarter's mark (scripts/brand/letters.mjs)" },
    { select: "#Preloader figure.__logo:nth-of-type(2)", html: svg("loader-word.svg"), source: "public/design/qwarter/loader-word.svg, the word Qwarter in EB Garamond italic (scripts/brand/letters.mjs)" },
    { select: ".footer__logo figure", html: svg("loader-mark.svg"), source: "public/design/qwarter/loader-mark.svg, Qwarter's mark" },
    // the cookie dialog: its script needs the element; the site sets no cookies, so it stays hidden and says so
    { select: "#CMP", attr: { style: "display:none", "aria-hidden": "true" } },
    { select: "#CMP .content", text: "This site sets no cookies.", source: "UI copy; true of this site (no analytics, no consent cookie is ever written because this dialog never opens)" },
    { select: "#CMP .information", html: "", source: "emptied: the cookie categories of a dialog that never opens (its script animates this element, so it stays)" },
    // its message window (shown by its script on an error): no words of theirs, a plain OK
    { select: "#Message .content p", text: "", source: "UI copy: the message window's text is set by the script when it opens" },
    { select: "#Message .btn-ok", text: "OK", source: "UI copy" },
  ];
  return swaps;
}

const head = (title) => ({
  title,
  head: [
    { remove: { href: "/api/videos-data" } },
    { remove: { codeIncludes: "__videosDataReady" } },
    { meta: "apple-mobile-web-app-title", content: brand.left },
  ],
});

// ---- home -------------------------------------------------------------------------------------------------
// the home shows the featured projects (content/work.json `featured`: the ones with footage worth a full screen,
// Lorenzo's list of 2026-10-23), numbered as that strip; the Work page lists every project with its catalogue numeral
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"];
const featured = projects.filter((p) => p.featured).map((p, i) => ({ ...p, numeral: ROMAN[i] }));
const twice = [...featured, ...featured];
const all = [...projects, ...projects];
const home = {
  ...head(brand.left),
  description: statement.join(" "),
  image: "/media/og.jpg",
  swaps: [
    ...chrome("/"),
    { select: ".widget-home__article", attr: { "data-internal": "" } },
    { select: ".widget-home__ul", attr: { "aria-label": "Featured projects" } },
    { select: ".visor-videos", repeat: "figure", items: twice.map((p) => ({ img: { attr: { src: media(p.slug).cover, "data-src": media(p.slug).cover2x, alt: p.name, width: "1440", height: "900" } }, video: { attr: { src: media(p.slug).film } }, source: `${SRC.work} ${p.slug}: its cover and film (scripts/work/prepare.mjs, video.mjs)` })) },
    { select: ".widget-home__ul", repeat: "li", items: twice.map((p) => ({
      a: { attr: { href: `/work/${p.slug}/`, "data-video-url": media(p.slug).film, "data-internal": studied(p.slug) ? "" : null } },
      "[data-project-counter]": { text: p.numeral },
      "[data-project-title]": { text: p.name, attr: { "data-project-title": p.name } },
      "[data-project-director]": { text: p.made, attr: { "data-project-director": p.made } },
      "[data-project-client]": { text: p.year ?? "", attr: { "data-project-client": p.year ?? "" } },
      source: `${SRC.work} ${p.slug}: numeral, name, made, year`,
    })) },
  ],
};

// ---- work (the reference's Archive page: every project, one film at a time, a looping list beside it) --------
const workPage = {
  ...head(`Portfolio – ${brand.left}`),
  description: "Everything Qwarter has made: the sites shown as they are, and the catalogue of brands and websites from qwarter.com.",
  swaps: [
    ...chrome("/work/"),
    { select: "article.page-archive", prepend: hiddenH1(nav[1].label), source: `${SRC.site} chrome.nav[1].label` },
    { select: ".block-project-list__ul", attr: { "aria-label": nav[1].label } },
    { select: ".block-project-list .visor-videos", repeat: "figure", items: all.map((p) => ({ img: { attr: { src: media(p.slug).cover, "data-src": media(p.slug).cover2x, alt: p.name, width: "1440", height: "900" } }, video: { attr: { src: media(p.slug).film } }, source: `${SRC.work} ${p.slug}: its cover and film` })) },
    // the list: numeral and name (where the reference lists the client), the name as the title, what was made where it names the director
    { select: ".block-project-list__ul", repeat: "li", items: all.map((p) => ({
      a: { attr: { href: `/work/${p.slug}/`, "data-internal": studied(p.slug) ? "" : null } },
      ".__roman": { text: p.numeral },
      ".__client": { text: p.name },
      ".__title": { text: p.name, attr: { href: null, "aria-hidden": "true" } },
      ".__director": { text: p.made, attr: { href: null, "aria-hidden": "true" } },
      source: `${SRC.work} ${p.slug}: numeral, name, made`,
    })) },
  ],
};

// ---- approach (the reference's About page: an opening text, six titled blocks with media) ------------------
const paragraphs = (lines) => lines.map((l) => `<p>${l}</p>`).join("");
const faq = about?.faq ?? [];
const approach = {
  ...head(`Approach – ${brand.left}`),
  description: statement.join(" "),
  swaps: [
    ...chrome("/approach/"),
    { select: "article.page-about", prepend: hiddenH1(nav.find((item) => item.href === "/approach/").label), source: `${SRC.site} chrome.nav approach label` },
    { select: "section.block-text:not(.--has-roman) .body", html: paragraphs([...statement, about.welcome, about.hero]), source: `${SRC.site} chrome.statement, chrome.about.welcome, chrome.about.hero` },
  ],
};
faq.slice(0, 6).forEach((q, i) => {
  const n = i + 1;
  approach.swaps.push({ select: `section.block-title.--type_${n} h2.body`, text: q.q, source: `${SRC.site} chrome.about.faq[${i}].q` });
  // the block's four pictures: the four projects Lorenzo named for this page (2026-10-23: "use thanh ta, jeff vhs,
  // butter, and beacon"), their cover and film, in a different order on each block
  const shown = ["thanh-ta", "jr-pugh", "butter", "ignite-beacon"].map((slug) => projects.find((p) => p.slug === slug)).filter(Boolean);
  for (let k = 0; k < 4; k++) {
    const p = shown[(i + k) % shown.length];
    approach.swaps.push({ select: `section.block-title.--type_${n} figure.media-${k + 1} img`, attr: { src: media(p.slug).cover, "data-src": media(p.slug).cover2x, alt: p.name, width: "1440", height: "900" } });
    approach.swaps.push({ select: `section.block-title.--type_${n} figure.media-${k + 1} video`, attr: { "data-src": media(p.slug).film } });
  }
  const roman = `section.block-text.--has-roman:nth-of-type(${2 * n + 1})`;
  approach.swaps.push({ select: `${roman} .body`, html: paragraphs(q.a), source: `${SRC.site} chrome.about.faq[${i}].a` });
  approach.swaps.push({ select: `${roman} .label`, text: q.q, source: `${SRC.site} chrome.about.faq[${i}].q` });
});

// ---- contact (the reference's Information page: looping lists of people; here the ways to reach Qwarter) --
const ways = [
  { role: "Email", name: [contact.email], value: "", href: `mailto:${contact.email}`, source: `${SRC.site} chrome.contact.email (no name beside it: Lorenzo, 2026-10-23)` },
  ...(contact.social ?? []).map((l, i) => ({ role: l.label, name: [host(l.href).split("/").pop()], value: host(l.href), href: l.href, source: `${SRC.site} chrome.contact.social[${i}]: the account's name, from its address` })),
  { role: "Based in", name: [contact.place], value: contact.place, href: `mailto:${contact.email}`, source: `${SRC.site} chrome.contact.place` },
];
const contactItems = (list) => list.map((w) => ({
  "a.email": { attr: { href: w.href, target: w.href.startsWith("mailto:") ? null : "_blank", rel: w.href.startsWith("mailto:") ? null : "noopener" } },
  ".role": { text: w.role },
  ".name.n1": { html: w.name.map((n) => `<span>${n}</span>`).join("") },
  ".name.n2": { html: w.name.map((n) => `<span>${n}</span>`).join("") },
  img: { remove: true },
  "span.email": { text: w.value },
  source: w.source,
}));
const left = [ways[0], ways[1], ways[2]].filter(Boolean), right = [ways[3], ways[4], ways[0]].filter(Boolean);
const contactPage = {
  ...head(`Contact – ${brand.left}`),
  description: `${contact.email} · ${contact.place}`,
  swaps: [
    ...chrome("/contact/"),
    { select: "article.page-contact", prepend: hiddenH1(nav[3].label), source: `${SRC.site} chrome.nav[3].label` },
    { select: ".widget-contact__team[aria-label='left']", repeat: "li", items: contactItems([...left, ...left]) },
    { select: ".widget-contact__team[aria-label='right']", repeat: "li", items: contactItems([...right, ...right]) },
  ],
};

// ---- project (a template) -----------------------------------------------------------------------------------
const project = {
  ...head(`Project – ${brand.left}`),
  description: null,
  swaps: [
    ...chrome("/work/"),
    { select: "article.project video", attr: { src: "{{film}}", poster: "{{cover}}" } },
    { select: ".plaver-video__title .client", text: "{{year}}", source: `${SRC.work} year, filled per project (lib/content.ts pageMarkup)` },
    { select: ".plaver-video__title .title", text: "{{name}}", source: `${SRC.work} name, filled per project` },
    { select: ".plaver-video__title .director", text: "{{made}}", source: `${SRC.work} made, filled per project` },
    { select: "a[data-back]", attr: { href: "/work/" } },
  ],
};

for (const [slug, spec] of Object.entries({ home, work: workPage, approach, contact: contactPage, project })) {
  fs.writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify({ _written: "by scripts/design/swaps-from-content.mjs from content/work.json and content/site.json; regenerate, never edit", ...spec }, null, 2) + "\n");
  console.log(`${slug}: ${spec.swaps.length} swaps`);
}
// the header's logo is a CSS mask of the reference's SVG: the same file now holds Qwarter's mark
const mask = path.join(ROOT, "public/design/depoluxe.xyz/assets/svg/depo-luxe-box.svg");
if (fs.existsSync(path.dirname(mask))) { fs.copyFileSync(path.join(ROOT, "public/design/qwarter/q-mark.svg"), mask); console.log("the header's logo mask now holds Qwarter's mark"); }
