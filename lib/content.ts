import fs from "node:fs";
import { versioned } from "@/lib/assets";
import path from "node:path";

import pagesData from "@/content/pages.json";
import redirectsData from "@/content/redirects.json";
import siteData from "@/content/site.json";
import workData from "@/content/work.json";
import { getStudy, hasStudy, studyMedia } from "@/lib/studies";
import { getAllStories, getStories, storyImage, storyUrl } from "@/lib/stories";

// ---------------------------------------------------------------------------
// Shapes. Every content file under content/ is read through one of these.
// tests/content.test.ts checks the JSON against them field by field, so a
// misspelled key fails the test run instead of rendering blank.
// ---------------------------------------------------------------------------

/** One element of a page's <head> or end of <body>, in document order: the order is the design. */
export type Asset =
  | { kind: "stylesheet"; href: string; media?: string }
  | { kind: "style"; css: string; attrs?: Record<string, string> }
  | { kind: "script"; src?: string; code?: string; attrs?: Record<string, string> }
  | { kind: "preload"; href: string; as: string; type?: string; crossOrigin?: string; plain?: boolean } // plain: no ?v= (a URL a stylesheet also names)
  | { kind: "meta"; attrs: Record<string, string> };

export interface NavItem {
  label: string;
  href: string;
}

/** What every page carries: the header lockup, the menu, the footer line, and the studio's own words. */
export interface Chrome {
  brand: { left: string; right: string; tagline: string };
  nav: NavItem[];
  footer: string;
  /** The positioning statement, in the pieces it is set in. */
  statement: string[];
  facts: { label: string; value: string }[];
  contact: { email: string; place: string; social?: { label: string; href: string }[] };
  /** qwarter.com's own words about the studio (its home and About Us pages, verbatim). */
  about?: { hero: string; welcome: string; team: { name: string; role: string }[]; faq: { q: string; a: string[] }[] };
}

export interface Site {
  name: string;
  /** The address the site is served from once the domain moves (canonical URLs, sitemap). */
  origin: string;
  lang: string;
  icons: { rel: string; href: string; sizes?: string; type?: string }[];
  /** Assets every page loads, before the page's own (the design's stylesheet and scripts). */
  head: Asset[];
  scripts: Asset[];
  chrome: Chrome;
}

/**
 * What a page is. "html" renders content/pages/<slug>.html verbatim (markup carried from
 * elsewhere); the others are this site's own views (components/site/), fed from content/.
 */
export type PageKind = "html" | "featured" | "archive" | "work" | "approach" | "contact" | "study" | "stories" | "story";

export interface Page {
  slug: string;
  path: string;
  kind: PageKind;
  /** <title> exactly as it should be printed */
  title: string;
  description: string | null;
  /** Attributes on <html> and <body>, when a carried page needs its own. */
  html: Record<string, string>;
  body: Record<string, string>;
  /** The page's own <head> assets and end-of-body scripts, after the site-wide ones. */
  head: Asset[];
  scripts: Asset[];
  /** Social card image, root-relative. */
  image: string | null;
  modified: string | null;
  noindex?: boolean;
  /** A "work" page opened on one project: its slug in content/work.json. */
  project?: string;
  /** A collected reading in the Stories library. */
  story?: string;
  /** For a carried page: the reference route it was built on (scripts/qa/compare-design.mjs). */
  template?: string;
}

export interface WorkPage {
  /** The raw frame's name (public/media/work/<slug>/page-<name>.jpg). */
  name: string;
  /** The title that site gives the page. */
  title: string;
}

/**
 * A project of Qwarter's. One photographed from its own site carries its frames (and is on the
 * strip and in the viewer); one from qwarter.com's catalogue whose pictures are not here yet has
 * media: false and is listed under Work only. Every string is the site's own or its repository's.
 */
export interface Project {
  slug: string;
  numeral: string;
  name: string;
  /** The site's address, or null until it is known. */
  url: string | null;
  /** The site's own line about itself (its title or description), or the case study's. */
  line: string;
  /** What Qwarter made. */
  made: string;
  year: string | null;
  /** false: a catalogue entry without pictures yet. */
  media?: boolean;
  /** The frame the project is introduced with: one of pages[].name. */
  cover: string | null;
  pages: WorkPage[];
  /** The case study's facts as qwarter.com writes them (Industry Type, Location, Company Size, Product, Services). */
  facts?: Record<string, string>;
  /** The case study's first sentence about the client. */
  about?: string;
  /**
   * The project's film (scripts/work/video.mjs): the clip it opens with (in raw/, not shipped; null when the
   * site's own clip is left out on purpose) and where that came from, its scenes when they are chosen by hand
   * (without them: the clip, then the first pages filmed scrolling), and what the film is made of.
   */
  film?: { intro?: string | null; from?: string; scenes?: FilmScene[]; source?: string };
  /** The project comes from qwarter.com's catalogue (scripts/port/catalogue.mjs). */
  fromWordPress?: boolean;
  /** Where each fact above comes from. */
  source: string;
}

/** One scene of a project's film, cross-faded with the next (scripts/work/video.mjs). */
export type FilmScene =
  | { clip: string; from?: number; seconds?: number; speed?: number } // the site's own footage or a recording, raw/<file>
  | { film: string; seconds?: number; hold?: number; pan?: number; tail?: number } // a page filmed scrolling (raw/film-<page>.mp4), else its strip
  | { page: string; hold?: number; pan?: number; tail?: number } // the page strip glided down
  | { still: string; seconds?: number; move?: "in" | "out" } // a picture held with a slow move
  | { card: { image: string; ground?: string }; seconds?: number }; // a mark on its ground

export interface Work {
  projects: Project[];
}

export interface Redirects {
  paths: { source: string; destination: string }[];
  /** WordPress post and page ids, for /?p=123 and /?page_id=45 */
  ids: { id: number; path: string }[];
}

export const getSite = (): Site => siteData as unknown as Site;
export const getWork = (): Work => workData as unknown as Work;
/** Every project, catalogue entries included, in numeral order. */
export const getProjects = (): Project[] => getWork().projects;
/** The projects with pictures: the strip on Featured and the viewer's reel. */
export const getFeatured = (): Project[] => getProjects().filter((p) => p.media !== false);
export const getRedirects = (): Redirects => redirectsData as unknown as Redirects;

/** The delivered pictures of a project (scripts/work/prepare.mjs). */
export const workMedia = (slug: string) => ({
  cover: versioned(`/media/work/${slug}/cover.jpg`),
  cover2x: versioned(`/media/work/${slug}/cover@2x.jpg`),
  tile: versioned(`/media/work/${slug}/tile.jpg`),
  tile2x: versioned(`/media/work/${slug}/tile@2x.jpg`),
  blur: versioned(`/media/work/${slug}/blur.jpg`),
  video: versioned(`/media/work/${slug}/scroll.mp4`),
  videoWebm: versioned(`/media/work/${slug}/scroll.webm`),
  poster: versioned(`/media/work/${slug}/scroll-poster.jpg`),
  page: (name: string) => versioned(`/media/work/${slug}/page-${name}.jpg`),
});

/**
 * /work/<slug>/: the Work viewer, opened on that project. Each is its own page (its own title,
 * description and card) and all of them hold the same viewer, so a visitor moves between
 * projects without a reload and the address still says where they are.
 */
export function projectPages(): Page[] {
  const site = getSite();
  // the carried project template (content/pages/project.html, from the reference design's project page) when
  // there is one: every project is that page with its own words and film filled in (pageMarkup); else the viewer
  const template = (pagesData as unknown as Page[]).find((p) => p.slug === "project");
  return getFeatured().map((p) => (hasStudy(p.slug) ? studyPage(p) : {
    ...(template ?? { html: {}, body: {}, head: [], scripts: [] }),
    slug: template ? "project" : `work-${p.slug}`,
    path: `/work/${p.slug}/`,
    kind: template ? "html" : "work",
    project: p.slug,
    title: `${p.name} – ${site.name}`,
    description: `${p.name} — ${p.line} ${p.made} by ${site.name}${p.year ? `, ${p.year}` : ""}.`,
    image: workMedia(p.slug).cover,
    modified: null,
  }));
}

/**
 * A project with a case study (content/studies/<slug>.json) is served as that study at /work/<slug>/,
 * our own page (components/study/study.tsx) with its own stylesheet and script, in place of the carried
 * project template. The links to it on the carried pages carry data-internal, so the reference design's
 * script lets the browser load it whole (scripts/design/swaps-from-content.mjs).
 */
function studyPage(p: Project): Page {
  const site = getSite();
  const study = getStudy(p.slug)!;
  const m = studyMedia(p.slug);
  if (p.slug === "bambino") return {
    slug: "study-bambino", path: "/work/bambino/", kind: "study", project: p.slug,
    title: "Paintings – Qwarter", description: study.summary, html: {}, body: { class: "qs" }, modified: null,
    head: [
      { kind: "stylesheet", href: "/design/qwarter/fonts/fonts.css" },
      { kind: "stylesheet", href: "/design/qwarter/stories.css" },
      { kind: "stylesheet", href: "/design/qwarter/portfolio.css" },
    ],
    scripts: [{ kind: "script", src: "/design/qwarter/stories.js", attrs: { defer: "" } }],
    image: study.film?.poster ?? m.desktopPoster,
  };
  return {
    slug: `study-${p.slug}`,
    path: `/work/${p.slug}/`,
    kind: "study",
    project: p.slug,
    title: `${study.name}, a case study – ${site.name}`,
    description: study.summary,
    html: {},
    body: { class: "st" },
    head: [
      { kind: "preload", href: "/design/qwarter/fonts/ebgaramond-normal-400-800-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous", plain: true },
      { kind: "preload", href: "/design/qwarter/fonts/ebgaramond-italic-400-800-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous", plain: true },
      { kind: "stylesheet", href: "/design/qwarter/fonts/fonts.css" },
      { kind: "stylesheet", href: "/design/qwarter/study.css" },
    ],
    scripts: [{ kind: "script", src: "/design/qwarter/study.js", attrs: { defer: "" } }],
    image: study.film?.poster ?? (study.recordings.desktop ? m.desktopPoster : workMedia(p.slug).cover),
    modified: null,
  };
}

/** The pages served: the records (a "project" record is a template, not a route) and one page per project. */
export function storyPages(): Page[] {
  const base = {
    html: {}, body: { class: "qs" }, modified: null,
    head: [
      { kind: "preload", href: "/design/qwarter/fonts/ebgaramond-normal-400-800-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous", plain: true },
      { kind: "preload", href: "/design/qwarter/fonts/ebgaramond-italic-400-800-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous", plain: true },
      { kind: "stylesheet", href: "/design/qwarter/fonts/fonts.css" },
      { kind: "stylesheet", href: "/design/qwarter/stories.css" },
      { kind: "stylesheet", href: "/design/qwarter/reader.css" },
    ] as Asset[],
    scripts: [{ kind: "script", src: "/design/qwarter/stories.js", attrs: { defer: "" } }] as Asset[],
  };
  return [
    { ...base, slug: "stories", path: "/stories/", kind: "stories", title: "Stories – Qwarter", description: "We learn from those who came before us. Collected stories about craft, brands, resilience, and finding a point of view.", image: storyImage(getStories()[0])?.src ?? null },
    ...getAllStories().map((story): Page => ({ ...base, slug: `story-${story.slug}`, path: storyUrl(story), kind: "story", story: story.slug, title: `${story.title} – Qwarter Stories`, description: story.lesson, image: storyImage(story)?.src ?? null, noindex: story.isExcerpt || story.draft })),
  ];
}

export const getPages = (): Page[] => [...(pagesData as unknown as Page[]).filter((p) => p.slug !== "project"), ...projectPages(), ...storyPages()];

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A carried page's markup, ready to render: content/pages/<slug>.html, and for a project page the template
 * with its {{tokens}} filled from content/work.json: name, line, made, year, url, host, numeral, slug, about,
 * cover, tile, film (H.264), filmWebm, blur. A token with nothing behind it becomes an empty string.
 */
export function pageMarkup(page: Page): string {
  const html = getPageHtml(page.slug);
  // Our own ending lives outside the captured source, inside the carried scroll
  // article so the reference engine includes its height and navigation.
  if (page.slug === "approach") {
    const ending = fs.readFileSync(path.join(CONTENT_DIR, "fragments", "approach-ai.html"), "utf8");
    return html.replace("</article>", `${ending}</article>`);
  }
  if (page.slug === "work") return html + '<nav class="qw-view-switch" aria-label="Portfolio view"><a href="/work/" aria-current="page" data-internal>Portfolio</a><a href="/work/library/" data-internal>Library</a></nav>';
  if (!page.project) return html;
  const p = getProjects().find((x) => x.slug === page.project);
  if (!p) return html;
  const m = workMedia(p.slug);
  const values: Record<string, string> = {
    name: p.name, line: p.line, made: p.made, year: p.year ?? "", url: p.url ?? "", host: p.url ? p.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "",
    numeral: p.numeral, slug: p.slug, about: p.about ?? "", cover: m.cover, cover2x: m.cover2x, tile: m.tile, film: m.video, filmWebm: m.videoWebm, blur: m.blur,
  };
  return html.replace(/\{\{\s*([a-zA-Z0-9]+)\s*\}\}/g, (_, k: string) => escapeHtml(values[k] ?? ""));
}

const CONTENT_DIR = path.join(process.cwd(), "content");

/** A carried page's body markup (kind "html"): content/pages/<slug>.html. */
export function getPageHtml(slug: string): string {
  return fs.readFileSync(path.join(CONTENT_DIR, "pages", `${slug}.html`), "utf8");
}

// ---------------------------------------------------------------------------
// Routing. Every URL the site serves resolves through here, so the layout
// (html/body attributes, stylesheets, scripts) and the page always agree.
// ---------------------------------------------------------------------------

export type Route = { kind: "page"; page: Page } | { kind: "not-found" };

export function resolveRoute(segments: string[] | undefined): Route {
  const parts = (segments ?? []).map((s) => decodeURIComponent(s));
  const wanted = parts.length ? `/${parts.join("/")}/` : "/";
  const page = getPages().find((p) => p.path === wanted);
  return page ? { kind: "page", page } : { kind: "not-found" };
}

/** Every path that is pre-rendered at build time. */
export function allPaths(): string[][] {
  return getPages().map((p) => p.path.split("/").filter(Boolean));
}
