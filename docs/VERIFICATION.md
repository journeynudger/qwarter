# Verification

What was checked, how, and with what result. Every check ran on a production build
(`rm -rf .next && npm run build`), after the last change it covers.

## 2026-10-22: the catalogue from qwarter.com itself, the clients' sites photographed, films that open with the site's own clip

The network opened through GitHub's runners (`.github/workflows/capture.yml`, pushing to orphan branches): qwarter.com's
WordPress was snapshotted whole, the clients' live sites photographed, Jeff's reel fetched. Checks on a production build:

| Check | How | Result |
|---|---|---|
| The snapshot | `scripts/port/fetch.py` on the runner, `npm run port:inventory` here | 19 pages, 21 posts, 10 `project` posts (all "Project Test N", ignored), 292 media, 206 MB; `failed.txt` empty; the fourteen case studies under /portfolio/ present with their live HTML |
| What the case studies say | read page by page before writing the importer | several carry another client's challenge/solution prose unedited (11 Hamilton Home is Journey's page whole; Boujee Healer's solution is Pineapple Club's; Ekaterina Sky's challenge is IEA's; 20/20 Insights' typography block is IoTech's), so `catalogue.mjs` takes only the fields that are unmistakably the page's own and nothing from that prose |
| The importer, dry | `node scripts/port/catalogue.mjs --dry` | 14 case studies + 4 Selected Work sites → 19 projects; each line traceable (home page Selected Work, portfolio slider, Industry Type + Location, or the first sentence about the client), each `source` naming the WordPress page id and modification date |
| Shots of the live sites | `shoot.mjs --discover` on the runner, `manifest.json` read here | accepted only when a page title names the client or the host is the one the case study names, and never a "Access Denied"/parking page: iotechprotect.com refused the headless browser ("Access Denied", 900px) and was rejected; thanhta.com and titaniummotorarts.com no longer resolve; a `/home` alias of the home page is dropped (same title and height) |
| `shoot.mjs` itself | against the local Stairway build with `--discover 3` | home, /shop and /support found from its navigation; frames at 1440×900@2×; manifest with each page's own title and height |
| Films with an opening clip | `video.mjs`, `ffprobe` | Journey's first cut came out at 6.6 MB / 9.0 MB (a 4K brain animation at constant quality), so the encodes are rate-capped (H.264 maxrate 2000k, VP9 1200k/1800k), the clip 8 s and three pages after it. Final: Butter 18.1 s (its Shopify film, then three pages) 1.3 MB / 1.1 MB; JR Pugh 16.2 s (his reel) 0.8 / 0.7; Journey 30.5 s (the brain film) 3.6 / 3.1; Titanium Motor Arts 16.7 s (the portfolio's render) 1.6 / 1.5; the fifteen films without a clip 5.7–30.6 s, 0.13–2.4 MB |
| A frame taken mid-page | `prepare.mjs` looks for the viewport frame down the whole-page capture | kindfootprint.org animates its scrolling and had not come back to its top when its frame was taken (the frame matches the page 6300px down); its cover is now the top of the whole-page capture, and `shoot.mjs` waits for `scrollY` to reach 0 before a frame. Butter's and Stairway's frames differ from their page tops too (video heroes), but match best at 0px and are kept |
| Overlays | the covers, on a contact sheet | ekaterina-sky.art's newsletter popup sits over its frame; `shoot.mjs` now dismisses cookie and newsletter popups (the probes' `dismissOverlays`) before a frame, and the site is to be photographed again |
| Dead and refusing sites | the shoot logs | thanhta.com, titaniummotorarts.com, woodco1.com: `ERR_NAME_NOT_RESOLVED`; epicesg.com: 503; iotechprotect.com: "Access Denied" to a headless browser's name (a desktop Chrome name is now sent) |
| Approach and Contact | the rendered pages | qwarter.com's hero line, welcome, team, FAQ (four steps included) and social links, verbatim from the snapshot (`chrome.about`, `chrome.contact.social`), each with its `_provenance` |
| Types, lint, tests, build | each by its own exit code | 0 / 0 / 0 / 0; 17 tests pass; 27 routes prerendered (19 projects, the four pages, 404, robots, sitemap) |
| The catalogue, final | `tests/work.test.ts`, `content/work.json` | 19 projects, numerals I–XIX in order, every one with pictures: Butter (5 pages of butterspreads.com, its own film first), JR Pugh, Stairway, Serein, Journey, 20/20 Insights, Mzaero, Thanh Ta, Ion Insurance, IoTech Protect, Titanium Motor Arts, Ekaterina Sky, EPIC ESG, Wood Company, Boujee Healer, Kind Footprint, Pineapple Club, Beacon, Core Rhythm Fitness; 11 of them photographed live on 2026-10-22, 4 from their own builds, 4 from the pictures their case studies show; 58 MB of delivered media in 197 files |

## 2026-10-17, later: the home as Depo Luxe's staircase, the films, the velvet, the catalogue

Lorenzo's screenshot of depoluxe.xyz's home (2000×1091) was measured and the staircase rebuilt to it;
depoluxe.xyz and qwarter.com stayed unreachable (403 at the environment's proxy, also for archive.org and
Google's cache), so the catalogue is text until the network opens. Checks on a production build:

| Check | How | Result |
|---|---|---|
| Build, types, lint, unit tests | each by its own exit code | 0 / 0 / 0 / 0; 16 tests pass, 1 skipped |
| Geometry against the screenshot | the three stills at 1440×900 (focus I, II, III), measured | focused tile 504px (.56·vh) flush bottom-left; the tiles after it along the bottom edge at 252 and 126, touching; with focus II and III the earlier tiles stack straight up at x=0 at 252 and 126, touching: the screenshot's 160→322→642 column and 279→140→70 row, halving each step; labels 36px right of each tile, 8px down from its top, numeral column 3.1em |
| Header | the stills | one centred column as wide as the tagline; brand words at its ends, italic tagline, menu spread across; three rows a line apart |
| The film | `ffprobe`; a frame at 3 s from each | 900×900, 24 fps, 16–31 s; H.264 328 KB–1.95 MB, VP9 316 KB–1.94 MB; headless Chromium (no H.264) plays the VP9 |
| The velvet | the Work index still | the MeshGradient's slow swirl visible through the black; the pause button bottom right; the echo screened over it on Featured and in the viewer |
| Rendered-page sweep | 8 routes × 375 and 1280 px | clean (the 404 page's own status line only) |
| Catalogue | `tests/work.test.ts` | 13 projects, numerals I–XIII in order; the 10 catalogue entries carry no cover, no pages, no media folder, and each names its qwarter.com page in `source` |
| The echo's depth | `sharp().stats()` on each `blur.jpg` | mean brightness held at ≤ 0.30 for every project (a white site's echo, Journey's, came out at 0.6 before and washed the header; it is now brought down to the same depth as the dark ones) |
| The film plays at rest | the `home-rest` still at 8.5 s | the focused tile shows the site's second page mid-scroll, the still faded out |
| Stale server, again | the `.webm` answered 404 from a server started before the files existed; `kill` by a PID threshold had missed it (the container had restarted and PIDs were low) | the QA server is now stopped by matching `/proc/<pid>/cwd` to the repo, never by PID range or by `pkill -f` (which kills the shell that runs it) |

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
