import fs from "node:fs";
import path from "node:path";

import pagesData from "@/content/pages.json";
import redirectsData from "@/content/redirects.json";
import siteData from "@/content/site.json";
import workData from "@/content/work.json";

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
  | { kind: "preload"; href: string; as: string; type?: string; crossOrigin?: string }
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
  contact: { email: string; place: string };
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
export type PageKind = "html" | "featured" | "archive" | "work" | "approach" | "contact";

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
  /** Where each fact above comes from. */
  source: string;
}

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
  cover: `/media/work/${slug}/cover.jpg`,
  cover2x: `/media/work/${slug}/cover@2x.jpg`,
  tile: `/media/work/${slug}/tile.jpg`,
  tile2x: `/media/work/${slug}/tile@2x.jpg`,
  blur: `/media/work/${slug}/blur.jpg`,
  video: `/media/work/${slug}/scroll.mp4`,
  videoWebm: `/media/work/${slug}/scroll.webm`,
  page: (name: string) => `/media/work/${slug}/page-${name}.jpg`,
});

/**
 * /work/<slug>/: the Work viewer, opened on that project. Each is its own page (its own title,
 * description and card) and all of them hold the same viewer, so a visitor moves between
 * projects without a reload and the address still says where they are.
 */
export function projectPages(): Page[] {
  const site = getSite();
  return getFeatured().map((p) => ({
    slug: `work-${p.slug}`,
    path: `/work/${p.slug}/`,
    kind: "work",
    project: p.slug,
    title: `${p.name} – ${site.name}`,
    description: `${p.name} — ${p.line} ${p.made} by ${site.name}, ${p.year}.`,
    html: {},
    body: {},
    head: [],
    scripts: [],
    image: workMedia(p.slug).cover,
    modified: null,
  }));
}

export const getPages = (): Page[] => [...(pagesData as unknown as Page[]), ...projectPages()];

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
