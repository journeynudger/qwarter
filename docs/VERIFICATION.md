# Verification

What was checked, how, and with what result. Every check ran on a production build
(`rm -rf .next && npm run build`), after the last change it covers.

## 2026-10-17: the site itself (Depo Luxe's language, Qwarter's work)

Every check ran on a production build (`rm -rf .next && npm run build`) served by `next start -p 3102`,
after the last change it covers. The reference sites (depoluxe.xyz, synchronized.studio) were still not
reachable from this environment, so the design was held against Lorenzo's three screenshots of Depo Luxe
and the sister site's code, not against the live reference; that comparison waits for the network
(CLAUDE.md, open questions).

| Check | How | Result |
|---|---|---|
| Build, types, lint, unit tests | `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, each by its own exit code | 0 / 0 / 0 / 0; 16 tests pass, 1 skipped (the qwarter.com quote check, which needs the snapshot) |
| Routes | the build's route list; `curl` per route | 7 pages pre-rendered (`/`, `/work/`, `/work/{jr-pugh,serein,journey}/`, `/approach/`, `/contact/`), each 200 with its own title and description; an unknown path answers 404 **with the site's own page** (header, "There is no page at this address", a link to Featured): `dynamicParams` is true for exactly this, with `dynamicParams = false` Next served its bare default 404 |
| Content model | `tests/content.test.ts`, `tests/work.test.ts` | every record has its fields; every project complete and sourced, numerals I II III in order; the delivered pictures of each project are exactly the ones its record names (cover, cover@2x, blur, one strip per page); nothing unused in `public/media`; no request to qwarter.com's WordPress or any reference studio |
| The pictures | `scripts/work/shoot.mjs` on the sites' own builds (Journey on :3100, Serein on :3101) and the vault's JR Pugh stills; `prepare.mjs` | 31 raw frames (58 MB of PNG, git-ignored) → 3.2 MB delivered: covers 40–69 KB, @2x 36–133 KB, blurs 2–3 KB, strips 13–458 KB (1440 wide, ≤ 5400 tall) |
| Rendered-page sweep | `scripts/qa/sweep.mjs`, 8 routes × 375 and 1280 px: console errors, broken images, images without alt, overflow, `<h1>` count, unnamed links, `target=_blank` without `rel`, dead internal links | **clean**: the only finding is the browser's own console line for the 404 page's status. Two earlier findings were fixed first: the home page had no `h1` (now a visually hidden "Featured work"), and the second echo layer and strip were empty `<img>`s counted as broken (now empty `<div>`s until the script needs them) |
| Stills | `scripts/qa/shots.mjs`: 15 stills at 1440×900 and 390×844 (loader mid-mark and mid-word, the cascade at rest and after one and two steps, the viewer at rest and after 9 s of sliding, every page at both widths, the 404), reviewed by eye | the loader lights the Q square by square and flickers the name; the cascade places the focused frame at 52vw with the previous project above-left and the next below-right (below, right-aligned, on the phone), the label under the focused frame, the numerals on the left (bottom right on the phone), the blurred echo behind; the viewer frames the site with its line and name above, its pages and address under, the rail draining on the left (hidden on the phone), × top right, pause bottom right; Approach and Contact read as intended over the shader; no page wider than its viewport |
| A bug the stills caught | the viewer's strip appeared inset and shifted | the state class `show` on the strips and echo layers collided with the viewer's `main.show` rules; renamed to `on` |
| Stale server | after a rebuild the markup still carried the old classes | an orphaned `next-server` kept serving the old pages from memory while the new CSS was read from disk; the server is now stopped by PID (`ps aux \| grep next-server`), never by pattern on the npm wrapper |
| The loader plays once | `sessionStorage` `qwLoaderSeen` | a second visit in the session skips straight to the cascade; `prefers-reduced-motion` skips it always |

### Still to verify

- depoluxe.xyz through `capture.mjs`, to hold the loader, the cascade and the viewer against the real thing.
- A hand on a real phone: the swipe on the cascade and the viewer, the wheel lock feel, iOS Safari's first tap.
- The Vercel preview: content type and size per route, not just status.

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
| Inventory and redirects | `inventory.py` and `redirects.py` on a fake WordPress snapshot (3 pages, a custom post type record with a featured image and custom fields, 2 media files, a sitemap-only URL) with 3 pages served here and a route map | inventory lists each page's headings, paragraphs and images, the client record with its featured image and fields, what uses each media file, and the sitemap-only URL; redirects: 3 ids, the moved page redirected once, the URL mapped to `null` dropped; an unmapped URL **fails** the run (exit 1) instead of being guessed |
| Paper shaders | a page with `data-paper-shader="MeshGradient"` in a real browser (SwiftShader WebGL) | canvas drawn at 1280×480 behind the heading (heading still on top by hit-test), pause button present; pressing it stores `qw-motion=paused` and relabels it "Play background animation" |

## Still to verify from 2026-10-12 (after the capture)

- The real reference through `compare-design.mjs`, every page × 1440 and 390, with Qwarter's content in.
- `sweep.mjs` over every route: console errors, broken images, missing alt, overflow at phone width, `<h1>` count, dead links.
- The Vercel deployment: content type and size per route (not just status: Deployment Protection answers 200 with a login page).
- Fresh eyes: side-by-side stills of reference and port, reviewed by someone with no part in the work.
