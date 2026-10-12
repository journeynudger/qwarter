# Verification

What was checked, how, and with what result. Every check ran on a production build
(`rm -rf .next && npm run build`), after the last change it covers.

## 2026-10-12: the plumbing and the tooling, before any content

Neither qwarter.com nor synchronized.studio was reachable from the session that built this (its
environment's network policy), so everything below was proven on stand-ins: a local test site with the
features a studio site has, and a fake WordPress REST API. Nothing below says anything about the real sites yet.

| Check | How | Result |
|---|---|---|
| Build, types, lint, unit tests | `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, each by its own exit code | 0 / 0 / 0 / 0; 14 tests pass, 1 skipped (the qwarter.com quote check, which runs once the snapshot is on disk) |
| Markup renderer | `tests/html.test.ts`: nested elements, raw-text `<script>`/`<style>` that contain `</div>`, a script inside an element, void and self-closed elements, quoting, entities, inline styles with `data:` URLs, attributes → React props | pass. Two tests were wrong at first and the code was right; one (a `;` inside `url()`) was a real bug, fixed in `styleObject` |
| The page is the reference's document | a page with `<html>`/`<body>` attributes, head stylesheet, head and tail scripts, inline body script; served HTML and a real browser | `<body>`'s children are exactly the page's elements (plus Next's hidden boundary `<div hidden>`); stylesheets in order; every script ran; a class a design script added to `<html>` survived hydration |
| Capture | `scripts/design/capture.mjs` on a local test site: preloader, custom cursor with easing and a hover state, hover-zoom cards revealed on scroll, lazy images, a menu button, a webfont, robots.txt + sitemap | 5 routes found (sitemap and links), 12 files saved with their types (font included), intro frames from black preloader to hero, scroll frames through the reveal, the cursor found as 1 follower: 16px at rest, 80px over cards and images, easing trail recorded; hover zoom `scale(1.08)` recorded per card; menu opened; breakpoint `(max-width: 767px)` |
| Extract → build → compare | the test site's capture through `extract.mjs`, built, then `compare-design.mjs` against the capture | **3 pages × 1440 and 390: 0.0% of pixels differ in every scroll frame; every element matched, none moved or restyled; page heights equal; cursor states and hover changes identical** |
| The comparison can fail | the same comparison against a different build (stale server) | 99.9% pixels, 0/14 elements matched, cursor 0/5: reported, not passed |
| WordPress snapshot | `scripts/port/fetch.py` against a fake WordPress (3 pages, a custom post type with 150 records, a media file, a sitemap listing a page the API does not) | paging across 2 pages of 100, the custom type found through `/wp/v2/types`, the sitemap-only page fetched, the upload saved; 155/156 URLs fetched, the one miss being the deliberate 404 probe |
| Content swap | `swap.mjs` on the test site's home page: heading replaced, the three reference cards repeated as two "client" cards with their own pictures, a section removed; `prune.mjs`; `npm test` with a fake qwarter.com snapshot | applied 3/3; client pictures copied to `public/media` and downscaled 2400→800 and 1200→800 px wide; the two reference pictures no page used any more deleted, the one still used kept; provenance test passes, and **fails** when an invented line ("Award-winning studio since 2009") is swapped in |
| The swapped page keeps the design | the swapped home page built and compared with the reference | cursor identical in all 4 states (80px blended circle over a card), no element restyled; the reported differences are exactly the content: one card fewer, the removed section, a shorter page |
| Paper shaders | a page with `data-paper-shader="MeshGradient"` in a real browser (SwiftShader WebGL) | canvas drawn at 1280×480 behind the heading (heading still on top by hit-test), pause button present; pressing it stores `qw-motion=paused` and relabels it "Play background animation" |

## Still to verify (after the capture)

- The real reference through `compare-design.mjs`, every page × 1440 and 390, with Qwarter's content in.
- `sweep.mjs` over every route: console errors, broken images, missing alt, overflow at phone width, `<h1>` count, dead links.
- The Vercel deployment: content type and size per route (not just status: Deployment Protection answers 200 with a login page).
- Fresh eyes: side-by-side stills of reference and port, reviewed by someone with no part in the work.
