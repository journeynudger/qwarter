import fs from "node:fs";
import path from "node:path";

import pagesData from "@/content/pages.json";
import redirectsData from "@/content/redirects.json";
import siteData from "@/content/site.json";

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

export interface Site {
  name: string;
  /** The address the site is served from once the domain moves (canonical URLs, sitemap). */
  origin: string;
  lang: string;
  icons: { rel: string; href: string; sizes?: string; type?: string }[];
  /** Assets every page loads, before the page's own (the design's shared stylesheet and scripts). */
  head: Asset[];
  scripts: Asset[];
}

/** A page: the reference design's document, carrying Qwarter's content. */
export interface Page {
  slug: string;
  path: string;
  /** <title> exactly as it should be printed */
  title: string;
  description: string | null;
  /**
   * The reference design's route this page is built on ("/", "/work/", …): the page in the
   * capture (.design-cache/synchronized/routes/) that scripts/qa/compare-design.mjs holds it against.
   */
  template: string;
  /** Attributes on <html> and <body>, as the reference design printed them. */
  html: Record<string, string>;
  body: Record<string, string>;
  /** The page's own <head> assets and end-of-body scripts, after the site-wide ones. */
  head: Asset[];
  scripts: Asset[];
  /** Social card image, root-relative. */
  image: string | null;
  modified: string | null;
  noindex?: boolean;
}

export interface Redirects {
  paths: { source: string; destination: string }[];
  /** WordPress post and page ids, for /?p=123 and /?page_id=45 */
  ids: { id: number; path: string }[];
}

export const getSite = (): Site => siteData as Site;
export const getPages = (): Page[] => pagesData as unknown as Page[];
export const getRedirects = (): Redirects => redirectsData as unknown as Redirects;

const CONTENT_DIR = path.join(process.cwd(), "content");

/** The page's body markup: the reference design's elements, with Qwarter's words and pictures in them. */
export function getPageHtml(slug: string): string {
  return fs.readFileSync(path.join(CONTENT_DIR, "pages", `${slug}.html`), "utf8");
}

/** content/not-found.html when the design has its own 404 page; null renders the plain fallback. */
export function getNotFoundHtml(): string | null {
  const file = path.join(CONTENT_DIR, "not-found.html");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
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
