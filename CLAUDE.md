# CLAUDE.md

Guidance for anyone (person or agent) changing this repository. Read it before the first edit.

## What this is

**qwarter.com, moved off WordPress onto Next.js on Vercel, wearing synchronized.studio's design.**
The look, layout, type, motion, scroll and cursor are synchronized.studio's, carried across from its own
pages (Lorenzo, 2026-10-12: "make qwarter identical to it end to end", "using qwarter's clients",
"the cards on the home page: images and animations identical, scroll and cursor identical, but using
the content on qwarter"). Every word, client, case study and picture is Qwarter's, from qwarter.com.
Paper shaders are installed as on Verowater (`@paper-design/shaders-react`).

- **Owner:** Lorenzo Scardicchio (lorenzo@qwarter.com)
- **Vercel:** Lorenzo's **personal** account, lorenzo@qwarter.com (not the Valerin team, not development@valerin-group.com)
- **GitHub:** `journeynudger/qwarter`
- **Sister port:** `journeynudger/journeysite` (journeynudge.com). Same stack, same conventions, same tooling
  shape; read its CLAUDE.md for the reasoning behind anything here that looks unusual.

## Status (2026-10-12)

The plumbing and the tooling are done and proven end to end on a test site (docs/VERIFICATION.md):
capture → extract → build → compare came out **pixel-identical** (0.0% of pixels, every element matched,
cursor and hover the same) on 3 pages × 2 widths.

**Neither site has been captured yet.** The cloud session that built this could not reach qwarter.com or
synchronized.studio (its environment's network policy allows GitHub and package registries only), so
nothing from either site is in the repo, and the site has no pages yet. Pick up at "Doing the port" below.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build / start | `npm run build` · `npm start -- -p 3100` |
| Types / lint / unit tests | `npm run typecheck` · `npm run lint` · `npm test` |
| Capture the reference design (needs network) | `npm run capture:design` (= `node scripts/design/capture.mjs --origin https://synchronized.studio`) |
| Snapshot qwarter.com's WordPress (needs network) | `npm run capture:wordpress` (= `python3 scripts/port/fetch.py`) |
| Capture qwarter.com's rendered pages, for reference | `node scripts/design/capture.mjs --origin https://qwarter.com --out .port-cache/qwarter-rendered` |
| Turn captured reference pages into pages here | `npm run extract:design -- --routes /=home,/work/=work` |
| Put Qwarter's content into them, drop unused design files | `npm run swap` (= `swap.mjs` then `prune.mjs`) |
| Compare the build against the reference (offline) | `npm run qa:compare` (needs `npm start -- -p 3100`) |
| Rendered-page sweep | `npm run qa:sweep` (needs `npm start -- -p 3100`) |
| Look at screenshots side by side | `node scripts/qa/sheet.mjs out.png a.png b.png …` |

## Stack, and the one deliberate deviation

Next.js 16 (App Router), React 19, TypeScript, as journeysite. **No Tailwind, no shadcn**: every page
brings the reference design's own hand-tuned CSS, and Tailwind's preflight reset would restyle it.

## How it fits together

```
app/[[...path]]/layout.tsx   root layout INSIDE the catch-all, so it knows the page: the design prints
                             different <html>/<body> attributes and assets per page
app/[[...path]]/page.tsx     every page, statically generated from content/pages.json
app/sitemap.ts  robots.ts    /sitemap.xml, /robots.txt (indexing only when ALLOW_INDEXING=1)
proxy.ts                     ?p=123 / ?page_id= and capitalised paths → their pages (one hop)
next.config.ts               trailing slashes (WordPress's), every old URL's redirect, cache headers
components/layout/assets.tsx the design's <link>s, <style>s and <script>s, in its order
components/paper/            Paper shaders for carried markup (data-paper-shader), pause + reduced motion
lib/content.ts               typed accessors + resolveRoute(): the single source of routing truth
lib/html.ts                  page markup → React elements, top-level element for element, no wrapper
content/                     everything a page says (see below)
public/design/<host>/        the reference design's CSS, JS, fonts and images, byte for byte (URLs inside
                             pointed at these copies); public/design/qwarter/ is ours
public/media/                Qwarter's own pictures, only those a page uses
scripts/design/              capture.mjs (any site, completely), extract.mjs (captured page → page here),
                             swap.mjs (Qwarter's content into it), prune.mjs (design files no page uses → gone)
scripts/port/                fetch.py: qwarter.com's WordPress through its REST API, media library included
scripts/qa/                  compare-design.mjs, sweep.mjs, sheet.mjs
scripts/lib/                 browser launch, the shared page probes, pixel diff, route slugs
```

**A page is the reference page's own document.** `content/pages/<slug>.html` is the body markup of a
synchronized.studio page (its classes, attributes, structure and inline scripts untouched), with Qwarter's
words and pictures in it. `lib/html.ts` renders each top-level element as one React element whose inner
HTML is set verbatim, so the DOM is the reference's: no wrapper of ours that `body > …` selectors or
scroll libraries would trip on. Its scripts run because the browser parses them on a full page load.

**Links are plain `<a>`, never `next/link`.** The design's scripts expect a fresh document (as on its own
site), so every navigation is a full load. Do not "upgrade" this. If the reference uses animated page
transitions (barba.js, swup), they come across with its scripts and work the same way.

**Asset order is the design.** `content/pages.json` lists each page's head assets in the order the
reference printed them; `components/layout/assets.tsx` prints them in that order. `paper.css` (ours) loads last.

## Doing the port (what is left)

1. **Open the network.** The environment needs `synchronized.studio`, `qwarter.com` and whatever CDNs they
   load from (the capture's errors name them; Webflow sites use `cdn.prod.website-files.com`,
   `assets-global.website-files.com`, `d3e54v103j8qbb.cloudfront.net`; fonts may come from
   `fonts.googleapis.com`, `fonts.gstatic.com`, `use.typekit.net`). Easiest: Network access "Full" while porting.
2. **Capture both.** `npm run capture:design`, `npm run capture:wordpress`, and the rendered capture of
   qwarter.com. Read `.design-cache/synchronized/report.md`: it names the stack (Webflow? Next.js? GSAP,
   Lenis, Locomotive, barba…), every route, font, breakpoint, the cursor and the hover behaviour.
3. **Decide the mode.** If the reference's scripts can run from another origin (Webflow, plain JS, GSAP,
   Lenis: the usual for a studio site), `extract.mjs --mode server` carries the page with its scripts and
   everything moves as it does there. If they cannot (a Next.js or Nuxt build, whose chunks load from
   `/_next/` paths that clash with ours), use `--mode rendered` and rebuild the motion with the same
   libraries the report found.
4. **Map routes.** Each Qwarter page (from qwarter.com's sitemap) is built on the reference page that plays
   the same part: home → home, clients/work → work, a client → a case study, about → studio, contact →
   contact. `npm run extract:design -- --routes <reference route>=<our slug>,…`. A Qwarter page with no
   counterpart takes the nearest template; a reference page with no Qwarter counterpart is not built.
5. **Swap the content**: `content/swaps/<slug>.json` lists, by CSS selector into the reference page, every
   word, name, number, link, logo and picture that becomes Qwarter's, each with its `source` on qwarter.com
   (format in `scripts/design/swap.mjs`); `npm run swap` applies them to `content/reference/<slug>.html` and
   writes `content/pages/<slug>.html`, copying Qwarter's pictures (`wp:<path>`) into `public/media`,
   downscaled. Repeated blocks (the home page's cards) use `repeat`: the reference card is cloned once per
   Qwarter client, so its markup, image treatment and animation stay exactly as they are. Then `prune.mjs`
   deletes every design file no page uses (the reference studio's own pictures must not stay downloadable).
6. **Paper shaders.** Add `data-paper-shader` to the surfaces that should carry one (below).
7. **Hold it against the reference.** `npm run build && npm start -- -p 3100`, then `npm run qa:compare`
   until nothing is reported but the content itself; then `npm run qa:sweep`; `npm test`.
8. **Deploy** (docs/CUTOVER.md) and record what was checked in docs/VERIFICATION.md.

## Content swap rules

| Comes from synchronized.studio (keep) | Comes from qwarter.com (replace) |
|---|---|
| Markup structure, classes, `data-*` attributes the scripts read | Every word: headings, body copy, buttons, nav labels, footer text |
| CSS, JS, layout, grid, spacing, type scale, colours | Client names, project titles, case studies, services, testimonials |
| Motion: scroll, reveals, transitions, hover, cursor, preloader | Pictures: client work, team, logos (Qwarter's own, from its media library) |
| Decorative assets that carry no meaning (icons, arrows, noise, shapes) | Contact details, social links, legal pages, `<title>` and description |

- **Never invent a fact.** No made-up client, project, number, quote, name, date or placeholder. If the
  reference has a section Qwarter has nothing for, the section goes and it becomes a question for Lorenzo.
- **Nothing of Synchronized Studio's stays**: its name, logo, client work, case-study images, videos,
  testimonials, team photos and copy are its own. A test (`tests/content.test.ts`) fails if any page still
  loads from or links to synchronized.studio or qwarter.com.
- **Fonts are licensed per domain.** A webfont the reference serves may not be licensed for qwarter.com.
  Check each family the capture report lists; use a licence Qwarter holds, or the nearest free family, and
  record which in the provenance table.
- **Card images.** "Identical images" on the home cards means the same treatment (crop, ratio, hover zoom,
  reveal); the pictures are Qwarter's clients' (Lorenzo, 2026-10-12: "using qwarter's clients").

## Paper shaders

`components/paper/paper-shaders.tsx` draws a Paper shader into any element that asks for one:

```html
<section class="hero" data-paper-shader="MeshGradient"
         data-paper-params='{"colors":["#0b0b0b","#1c1c22","#0b0b0b","#24242c"],"distortion":0.6,"swirl":0.2}'
         data-paper-speed="0.12" data-paper-opacity="0.5">
```

Available: `MeshGradient`, `Water`, `GrainGradient`, `PaperTexture` (add more in `components/paper/shaders.ts`,
which keeps the bundle to the shaders named). The shader sits behind the element's content without touching
it (the element becomes a stacking context; the shader paints at z-index −1), stops for
`prefers-reduced-motion` and for the visitor's pause (one button per moving surface, remembered site-wide,
WCAG 2.2.2), stops off screen, and renders at capped resolution. `.paper-stock` (with `--paper: 0.14`) adds
Verowater's paper grain. Verowater's rules carry over: text never sits on a background that moves and
changes colour unless its contrast is guaranteed by the colour stops; half strength reads as depth, full
strength as a screensaver; one coat of grain per surface.

## Content model and provenance

| File | What it holds | Source | Edit freely? |
|---|---|---|---|
| `content/reference/<slug>.html` | the reference page's body markup, untouched (URLs pointed at our copies) | synchronized.studio (`extract.mjs`) | No: re-extract instead |
| `content/swaps/<slug>.json` | what of that page becomes Qwarter's, each piece with its source on qwarter.com | **written here**, every quote checked against the qwarter.com snapshot by `tests/swaps.test.ts` | Yes: this is where Qwarter's words live |
| `content/pages/<slug>.html` | the page: reference markup with the swaps applied | `swap.mjs` (or `extract.mjs` before any swaps) | No: edit the swaps, then `npm run swap` |
| `content/pages.json` | per page: title, description, `<html>`/`<body>` attributes, head assets, reference route | `extract.mjs`; title and description are Qwarter's | Titles and descriptions yes; assets only with the design in mind |
| `content/site.json` | name, origin, icons, site-wide assets | written here; icons from qwarter.com | Yes |
| `content/redirects.json` | old WordPress URLs → their pages; WP ids for `?p=` | from qwarter.com's sitemap and REST ids | Yes |
| `public/design/<host>/**` | the reference's CSS, JS, fonts, images | synchronized.studio, byte for byte except URLs | No: fix in `public/design/qwarter/` |
| `public/design/qwarter/paper.css` | shader surfaces, pause button, paper stock | written here (Verowater's paper) | Yes |
| `public/media/**` | Qwarter's pictures | qwarter.com's media library (`fetch.py`), downscaled | Add only what a page uses (`npm test` fails on an unused file) |

## Open questions for Lorenzo

1. **Network access** for this repo's cloud environment: allow `qwarter.com`, `synchronized.studio` and their
   CDNs (or "Full") so the capture can run. Nothing else is blocking.
2. **Vercel**: import `journeynudger/qwarter` once into the lorenzo@qwarter.com personal account
   (docs/CUTOVER.md); or give the session a token for that account and allow `vercel.com`/`api.vercel.com`.
3. **Fonts**: once the capture lists synchronized.studio's families, which ones does Qwarter hold a licence for?
4. **The Oct 6 porting prompt** ("Next/Vercel/WordPress") was not in `journeynudger/mylife` on GitHub (its last
   vault backup there is 2026-10-07 18:30 PT and holds no such file); this port follows journeysite's
   CLAUDE.md and Verowater's `docs/site-kit/sources/PORT-PLAYBOOK-v1.md` instead. Push the vault or paste
   the prompt if it differs.
