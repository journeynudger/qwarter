import fs from "node:fs";
import path from "node:path";

/*
 * The case studies: one page per project at /work/<slug>/, in the manner of the Valerin site's
 * (valerin-umber.vercel.app/our-work/…, which Lorenzo designed after Mouthwash's project pages and
 * asked for here, 2026-10-22): the name and a line, the facts in a row, the film, one statement with
 * its figures, the identity as a mosaic, the site recorded on a desktop and on a phone, the design
 * notes screen by screen with the reasoning a "+" away, the gallery, a line from the site, the close.
 *
 * Every study is a JSON file in content/studies/<slug>.json. Those written by
 * scripts/port/studies.mjs carry generated: true and are rebuilt from the WordPress case study and
 * the site's own shoot; the others are written by hand from the project's own repository, and each
 * says in `source` where every word comes from. Nothing in a study is invented.
 */

export interface StudyMedia {
  src: string;
  /** A VP9 copy for browsers without H.264 (headless Chromium, some Linux builds). */
  webm?: string;
  poster: string;
  /** What the film shows, for anyone who cannot see it. */
  alt: string;
}

export interface StudyStep {
  title: string;
  /** The note, whole; the first sentence is shown under the screen, the rest behind "+". */
  body: string;
  /** A still of the site (under /media/work/<slug>/study/), unless the step plays a recording. */
  image?: string;
  alt?: string;
  /** How the still is framed: a browser, a phone, or a picture on its own (a case study's mockup, a product shot). */
  device: "desktop" | "phone" | "picture";
  /** Play the site's own recording on this device instead of the still. */
  recording?: "desktop" | "phone";
  source?: string;
}

export interface StudyColor {
  hex: string;
  /** Its name in the project's own code or guide, when it has one. */
  name?: string;
  /** What it does on the site, as observed (the page, headings, links…). */
  role?: string;
}

export interface StudyTile {
  key: "logo" | "wordmark" | "palette" | "type" | "detail";
  label: string;
  /** The note behind "+". */
  note: string;
  /** The logo, the wordmark or the detail, as a picture under /media/work/<slug>/study/. */
  image?: string;
  alt?: string;
  /** The ground the picture sits on: the brand's own colour. */
  ground?: string;
  /** The ground is dark: the caption is set light. */
  dark?: boolean;
  /** A wordmark set in type rather than a picture: the words and the face they are set in, or its parts each in their own. */
  wordmark?: { text: string; family: string; weight?: string; italic?: boolean; fallback?: string; color?: string; letterSpacing?: string; transform?: string; parts?: { text: string; family: string; weight?: string; italic?: boolean; fallback?: string }[] };
  /** How the picture fills its tile: whole (contain, the default) or edge to edge. */
  fit?: "contain" | "cover";
  colors?: StudyColor[];
  /** The typefaces, by the role each plays on the site (fallback: the generic family behind it, serif by default). */
  faces?: { role: string; family: string; weight?: string; sample?: string; fallback?: string }[];
  source?: string;
}

/** One scene of a recording: a page gliding, one of the site's own films (under public/media/work/<slug>/, raw/ included), or a page's top held still. */
export type WalkthroughScene = { page: string; hold?: number; pan?: number; tail?: number } | { clip: string; seconds?: number; from?: number } | { still: string; seconds?: number };

export interface Study {
  slug: string;
  name: string;
  /** The page opens on "{shortName}, / {tagline}". */
  shortName: string;
  tagline: string;
  client: string;
  year: string | null;
  /** What Qwarter made, as the facts row lists it. */
  role: string[];
  /** One sentence set large: the site's own words, or qwarter.com's about it. */
  statement: string;
  summary: string;
  brief?: string;
  kind: string;
  status: string;
  /** The site's address, or empty while there is nowhere to send a reader. */
  url: string;
  address: string;
  figures: { value: string; label: string; source?: string }[];
  identity: StudyTile[];
  quote?: { text: string; source: string };
  steps: StudyStep[];
  /** The project film (the strip's own, square) and the two recordings. */
  film?: StudyMedia;
  recordings: { desktop?: StudyMedia; phone?: StudyMedia };
  gallery: { src: string; alt: string; source?: string; frame?: { x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number } }[];
  galleryNote?: string;
  /** The recordings' own script, when the site's films or a recorded splash belong in them (scripts/work/walkthrough.mjs). */
  walkthrough?: { desktop?: WalkthroughScene[]; phone?: WalkthroughScene[] };
  /** Where every word above comes from. */
  source: string;
  /** Written by scripts/port/studies.mjs; rebuilt, never edited. */
  generated?: boolean;
}

const DIR = path.join(process.cwd(), "content/studies");

let cache: Study[] | null = null;

/** Every study, in the projects' order (content/work.json), read once per process (per render in development). */
export function getStudies(): Study[] {
  if (cache && process.env.NODE_ENV !== "development") return cache;
  if (!fs.existsSync(DIR)) return (cache = []);
  const list = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Study);
  cache = list;
  return list;
}

export const getStudy = (slug: string): Study | undefined => getStudies().find((s) => s.slug === slug);
export const hasStudy = (slug: string): boolean => getStudies().some((s) => s.slug === slug);

/** Where a study's pictures and recordings live (scripts/work/walkthrough.mjs, scripts/port/studies.mjs). */
export const studyMedia = (slug: string) => ({
  dir: `/media/work/${slug}/study`,
  desktop: `/media/work/${slug}/study/desktop.mp4`,
  desktopWebm: `/media/work/${slug}/study/desktop.webm`,
  desktopPoster: `/media/work/${slug}/study/desktop-poster.jpg`,
  phone: `/media/work/${slug}/study/phone.mp4`,
  phoneWebm: `/media/work/${slug}/study/phone.webm`,
  phonePoster: `/media/work/${slug}/study/phone-poster.jpg`,
  still: (device: "d" | "m", name: string) => `/media/work/${slug}/study/${device}-${name}.jpg`,
});

/** The first sentence of a note: what is shown under the screen before "+". */
export function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return m ? m[0] : text;
}
