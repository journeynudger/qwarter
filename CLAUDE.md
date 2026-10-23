# CLAUDE.md

Guidance for anyone (person or agent) changing this repository. Read it before the first edit.

## What this is

**qwarter.com, moved off WordPress onto Next.js on Vercel, as Qwarter's own site in Depo Luxe's design
language.** Lorenzo (2026-10-17): the loader and the home page of https://depoluxe.xyz/ (design by Cuchillo,
Awwwards Site of the Day 2026-07-07) "exactly", with its effect and blur; the vibe of the sister site he
built in the same language (JR Pugh, jeffvhs.com, 2026-07); the work "presented under our work tab where it
shows the background image blurred and the website in focus, sliding"; where Depo Luxe's tiles play a film
when the strip comes to rest, ours play the website scrolling; black Paper-shader velvet behind everything
(the Valerin site's red velvet, in black); and the full catalogue of brands and websites from qwarter.com.

- **Owner:** Lorenzo Scardicchio (lorenzo@qwarter.com)
- **Vercel:** Lorenzo's **personal** account, lorenzo@qwarter.com, scope `journeynudgers-projects`, project
  `qwarter` (not the Valerin team, not development@valerin-group.com). Pushes to `main` deploy Production;
  every other branch gets a preview URL. Details and the domain move: `docs/CUTOVER.md`.
- **GitHub:** `journeynudger/qwarter`
- **Sister ports:** `journeynudger/journeysite` (journeynudge.com; same stack and conventions, read its
  CLAUDE.md for the reasoning behind anything here that looks unusual) and the JR Pugh site in the mylife
  vault (`Open/_Generated/2026-07-16/jeffvhs-site-final`), whose stylesheet this one grew from.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build / start | `npm run build` · `npm start -- -p 3102` |
| Types / lint / unit tests | `npm run typecheck` · `npm run lint` · `npm test` |
| Photograph a site Qwarter built (raw PNGs, not committed; a local Next dev server through `localhost`, not `127.0.0.1`, whose chunks it answers with 403 so nothing hydrates; a page drawn in fixed layers that does not scroll, Bambino's wall, keeps them) | `node scripts/work/shoot.mjs <slug> <base> [name=route[\|click:selector] …] [--discover N] [--out dir] [--phone] [--assets] [--settle ms]` |
| Fetch what the build environment cannot reach, through a GitHub runner | Actions → *Capture the reference design and the WordPress site* → Run workflow (`design_origin`, `wordpress_origin`, `media_urls`, `shoot_specs`, `branch`); then `git fetch origin <branch> && git checkout origin/<branch> -- .port-cache .design-cache` |
| The catalogue from the WordPress snapshot and the clients' live sites | `node scripts/port/catalogue.mjs [--dry]`, then `prepare.mjs`, `video.mjs`, `npm test` |
| Make the delivered pictures from the raw ones | `node scripts/work/prepare.mjs [slug …]` |
| Render each site scrolling, as the strip's film | `node scripts/work/video.mjs [slug …]` → `scroll.mp4` + `scroll.webm` |
| The case studies' recordings: each site on a desktop and on a phone, 60 fps, plus the stills (scenes from the study's or its override's `walkthrough`, else the first pages) | `node scripts/work/walkthrough.mjs [--no-webm \| --webm-only] [slug …]` → `study/{desktop,phone}.{mp4,webm}`, posters, `d-*.jpg`, `m-*.jpg` |
| Record a page's own motion deterministically (a splash, a reveal) | `node scripts/work/record.mjs <url> <out.mp4> [--seconds 6] [--until <selector>] [--font-css <file>]` |
| The case studies from qwarter.com's case studies and the shoots (hand-written ones kept) | `node scripts/port/studies.mjs [slug …]`, after catalogue → prepare → walkthrough; then `npm test` |
| Icons and the social card from the brand's marks | `node scripts/brand/icons.mjs <white wordmark png>` (mark: `scripts/brand/trace-mark.mjs`) |
| Stills of every page, both widths, loader and slideshow mid-way | `node scripts/qa/shots.mjs --base http://localhost:3102` → `qa-out/shots/` |
| Rendered-page sweep (console errors, images, alt, overflow, h1, links) | `node scripts/qa/sweep.mjs --base http://localhost:3102` |
| Snapshot qwarter.com's WordPress (from the runner, see above; locally only with network) | `npm run capture:wordpress`, then `npm run port:inventory`, `npm run port:redirects` |
| Capture a reference design, extract, swap, compare | `npm run capture:design` · `npm run extract:design` · `npm run swap` · `npm run qa:compare` |

## Stack, and the one deliberate deviation

Next.js 16 (App Router), React 19, TypeScript, as journeysite. **No Tailwind, no shadcn, no client
framework in the page**: the design is one hand-written stylesheet and one script (`public/design/qwarter/`),
as the sister site's was, and Tailwind's preflight reset would restyle it. React renders the markup on the
server from `content/`; the only client-side React is the Paper shader island.

## How it fits together

```
app/[[...path]]/layout.tsx   root layout INSIDE the catch-all, so it knows the page: <body data-page="…">,
                             the site's head assets, paper.css, the shader island
app/[[...path]]/page.tsx     the page by kind: featured | work | approach | contact | html (carried markup)
app/[[...path]]/not-found.tsx the 404, in the same chrome (dynamicParams is true for exactly this)
app/sitemap.ts  robots.ts    /sitemap.xml, /robots.txt (indexing only when ALLOW_INDEXING=1)
proxy.ts  next.config.ts     ?p=123 and capitalised paths → their pages; trailing slashes; redirects; cache headers
components/site/chrome.tsx   Header (brand · menu · brand, tagline), Footer, Echo (the blurred background), QMark
components/site/featured.tsx the loader and the staircase (Depo Luxe's home)
components/site/archive.tsx  Work: every project in order, the catalogue included
components/site/work.tsx     the viewer (/work/<slug>/): one site at a time, sliding inside its frame
components/site/approach.tsx the statement, the facts, an index of the work, over a Paper shader
components/site/contact.tsx  the address
components/paper/            Paper shaders for markup that asks for one (data-paper-shader), pause + reduced motion
components/study/study.tsx   a case study (/work/<slug>/ when content/studies/<slug>.json exists): the whole page, on the server
components/layout/assets.tsx the <link>s, <style>s and <script>s a page lists, in order
lib/content.ts               types, accessors, resolveRoute(): the single source of routing truth; /work/<slug>/ pages
lib/studies.ts               the case studies' types and loader (content/studies/*.json), studyMedia()
lib/html.ts                  carried markup → React elements (kind "html" pages; none at the moment)
content/                     everything the site says (see below)
public/design/qwarter/       site.css, site.js, study.css, study.js, fonts/, paper.css, q-mark.svg, icon.svg, apple-touch-icon.png
public/media/work/<slug>/study/  a case study's own pictures and its recordings (walkthrough.mjs, studies.mjs)
public/media/work/<slug>/    the delivered pictures of each project; raw/ holds the captures (ignored by git)
public/media/og.jpg          the social card
scripts/work/                shoot.mjs (photograph a site, --phone --assets), prepare.mjs (deliver the pictures), video.mjs (the film),
                             walkthrough.mjs (the case studies' recordings), record.mjs (a page's own motion, frame by frame)
scripts/port/catalogue.mjs   the catalogue: qwarter.com's case studies + the clients' live sites → content/work.json, raw frames
scripts/port/studies.mjs     the case studies: qwarter.com's case studies + each site's shoot (+ _overrides) → content/studies/*.json
.github/workflows/capture.yml  a GitHub runner fetches what this environment cannot (Depo Luxe, qwarter.com, client sites) → a captures branch
scripts/brand/               trace-mark.mjs (the pixel Q as squares), icons.mjs
scripts/qa/                  shots.mjs, sweep.mjs, compare-design.mjs (parked), sheet.mjs
scripts/design/, scripts/port/, scripts/lib/   the capture / extract / swap / snapshot tooling (parked)
```

**Links are plain `<a>`, never `next/link`.** site.js expects a fresh document per page (the loader plays
once per session, the viewer owns the wheel and the keys), so every navigation is a full load. Do not
"upgrade" this.

**The page is finished before any script.** Every page renders whole on the server: the cascade is a column
of linked frames, the viewer shows the opened project's first page, the menu's current item is marked.
site.js (deferred) adds the motion. `html.js` (set by one inline line in `<head>`) is what the cascade's
positioned layout keys on, so without scripts the fallback layout shows, not an empty stage.

## The site as it ships: Depo Luxe's pages, carried, with Qwarter's content (2026-10-22)

Lorenzo asked for an exact replica of depoluxe.xyz ("literally no different from every animation"). Once
the capture workflow could reach it, the site stopped being an imitation and became the thing itself:
every page is one of Depo Luxe's pages, served as its own markup with its own stylesheet and script
(`public/design/depoluxe.xyz/`, byte for byte from the capture; Cuchillo's build), and every word, picture
and film in it is Qwarter's, swapped in by `scripts/design/swap.mjs` from specs that
`scripts/design/swaps-from-content.mjs` writes out of `content/work.json` and `content/site.json`. Their
script runs unchanged and does everything it did there: the preloader, the home's film stack and WebGL
staircase, the archive's looping list, the project player, the page transitions, the side menu.

| Ours | Their page | What is swapped in |
|---|---|---|
| `/` (`home`) | `/` | header words, menu, footer; every project twice in the film stack (`.visor-videos`) and the list (`.widget-home__ul`): cover, film, name, what was made, year |
| `/work/` (`work`) | `/archive/` | the same projects in its looping list and film stack: numeral, name (where it lists the client), name as the title, what was made where it names the director |
| `/work/<slug>/` | `/guslo/woman-md-studio/` (`project`, a template) | `{{film}}`, `{{cover}}`, `{{name}}`, `{{made}}`, `{{year}}`, filled per project at render time (`pageMarkup` in `lib/content.ts`); Close goes to /work/ |
| `/approach/` | `/about/` | the statement, qwarter.com's welcome and hero line as the opening text; its six titled blocks carry qwarter.com's six questions and answers, each illustrated with four of our covers and films |
| `/contact/` | `/contact/` ("Information") | the ways to reach Qwarter in its looping lists: the email, Instagram, Twitter, LinkedIn, the place |

What is not theirs any more: the menu has our four items (its Talent item removed, with the id order
their script keys on kept); the footer has our three social links and line, its legal links gone; the
cookie dialog stays in the DOM (their script holds a reference to it and animates it) but is hidden and
says the truth, "This site sets no cookies"; the preloader reveals four paths per picture, so our mark and
the word "Qwarter" are drawn as four paths each (`scripts/brand/letters.mjs` → `loader-mark.svg`,
`loader-word.svg`, EB Garamond italic from our own font file); the header's logo mask file holds our mark
under their file name; `/api/videos-data` (their Vimeo map) is dropped from the head, so each `<video>`
keeps the `src` we give it; `/imageLoaderWorker.js` and `/service-worker.js` are served at the root
because their script asks for them there (the worker is theirs, the service worker is an empty one);
their image loader asks for `<picture>.webp` beside every picture, so `prepare.mjs` writes those twins.
`prune.mjs` removed every file of theirs no page references (121 MB of their films and stills), and
`tests/content.test.ts` fails if any page loads from or links to depoluxe.xyz, Vimeo or their CDN.

The page is a carried page in `content/pages.json` (`kind: "html"`, `template` = their route); the layout
gives it none of our assets (no site.css, no site.js, no Paper shader) and no `data-page` on the body (their
script reads its own), and `page.tsx` serves the markup through `dangerouslySetInnerHTML` so React never
reconciles what their script rewrites. To redo the port after a new capture:
`extract.mjs --ref .design-cache/reference --mode server --routes "/=home,/archive/=work,/contact/=contact,/about/=approach,/guslo/woman-md-studio/=project"`,
then `swaps-from-content.mjs`, `swap.mjs`, `prune.mjs`, `npm test`, build. The sections below describe the
hand-built site that preceded this (its code remains in `components/site/` and `public/design/qwarter/`
and is not served); they stay as the record of how the staircase was measured.

## The case studies (2026-10-22)

Lorenzo asked for "smooth walkthroughs of each site… like these case studies" and pointed at the Valerin
site's project pages (valerin-umber.vercel.app/our-work/south-howard-flood-relief, which he designed after
Mouthwash's Seed and Casa), then for rich studies of JR Pugh (the splash, every page, the reels), Butter (the
store's film used as the store uses it, a Visit, the packaging and the brand), Serein (the brand, withserein.com,
the app), The Room, his artist site and Bambino, and Thanh Ta from its case study alone, with its logo and no
link. So `/work/<slug>/` is a case study wherever `content/studies/<slug>.json` exists (all 22 projects now),
in place of Depo Luxe's project player; the carried pages' links to a study carry `data-internal`, which
Cuchillo's click handler leaves to the browser, so the page loads whole.

**The page** (`components/study/study.tsx`, `study.css`, `study.js`): the name and a line, the facts in a row
(Client · Year · Made · Status), the project's film (the strip's own, square), one sentence set large with its
figures under it and the overview behind Read more, the identity as a mosaic of four tiles (the logo or
wordmark on its own ground, the colours as named bands, the type as a specimen, one detail), the site
recorded on a desktop in a browser frame, each design note as the screen it shaped (desktop, phone or a
picture) with its first sentence shown and the whole note a "+" away, the gallery with notches after the
first pair, a line from the site itself, the close (Visit <address> where there is one, Start a project, the
next study on its two screens) and the footer. Set in Depo Luxe's language so it belongs beside the carried
pages: black, EB Garamond, roman numerals, a numeral rail on the left from 1240px. Everything renders on the
server; study.js adds the motion (the veil, the title's lines rising, reveals, the statement word by word,
the figures counting, parallax on the screens, films playing in view with their own pause, the sheets lifted
into a `<dialog>` that swipes away on a phone, the gallery's drag with inertia, buttons that lean to the
pointer); `prefers-reduced-motion` keeps the page whole and still, and without the script the notes are
`<details>`.

**The recordings** (`scripts/work/walkthrough.mjs`): each page holds at its top, eases down it and holds at its
foot, with a cross-fade to the next; 1440×900 and 780×1688 at 60 frames a second, rendered at twice the size
and scaled down so the glide moves by half pixels; H.264 and VP9, 1–5 MB. A study can script its scenes
(`walkthrough.desktop` / `.phone`: pages, the site's own films under `raw/`, stills). JR Pugh's opens with
its splash, recorded from the site's own files in the vault with `scripts/work/record.mjs` (Chromium's virtual
time advanced one frame between screenshots, so nothing is dropped however slow the capture), then the tease
the home page plays, then the pages and the two reels; the catalogue prepends the same splash to its strip
film (`SPLASH` in catalogue.mjs; raw/ is not committed, so record it again before a catalogue run or the
film opens on the tease alone).

**The words.** Every study says in `source` where each line comes from, and nothing is written here:
- `scripts/port/studies.mjs` writes a study for every project from qwarter.com's own case study (the service
  line, the facts, the description, Style & Imagery's five colours and type samples, the Deliverables /
  Services / Strategy lists, Project Info, the challenge, the solution and the design strategy, the line it
  quotes, its pictures) and from the site's shoot (each page's title and first words, the typefaces and
  colours observed, its logo and pictures, the phone frames). A paragraph that appears word for word on two
  case studies was pasted and is left out, the catalogue's rule. The result carries `generated: true` and is
  rebuilt, never edited.
- What is written by hand about a generated study lives in `content/studies/_overrides/<slug>.json` and is
  laid over it on every run (a key given there replaces the generated one; `{"$pic": "<file>"}` names one of
  the shoot's or the snapshot's pictures, `{"$copy": "<absolute path>"}` brings a file from the project's own
  repository). Butter (the store's own words and pictures, the packaging), Thanh Ta (the case study's words,
  its logo in three settings, no link), Serein (the app's README, the brand files in `SereinLife/serein`, the
  site's own words, the brand references and brief in the vault), The Room (`journeynudger/theroom`: README,
  the wall's own interface strings, its plaster figures), Bambino (`journeynudger/bambino`: README, the
  chapters' own titles) and Lorenzo Type (`journeynudger/lorenzo`: the order sheet, the Hand page, the
  scans) are written that way. JR Pugh's study is written whole (`content/studies/jr-pugh.json`, no
  `generated`) from the project's files in the vault.
- `content/studies/_pictures/<slug>.json` says which source file each delivered picture came from;
  `_pending/` parks a step whose recording does not exist yet.

**Photographed from their own builds**, because the runner could not see them: The Room (the preview first linked is
behind Vercel's login; `site/server.mjs` from the repository; its public address, theroom-five.vercel.app, came on 2026-10-23), Lorenzo Type (lorenzoscardicchio.com answered
the runner with a Cloudflare challenge; the static files), Serein's Product and Manifesto pages (client-side
routes on withserein.com; the vault's `Serein/serein-site` run locally, with the live site's home for the
rest). Bambino from bambino-1dtu.vercel.app, the address Lorenzo gave. Their records in `content/work.json`
are written by hand; the catalogue keeps them (`OWN_FRAMES`, `LIVE_FRAMES` for Bambino) and orders them after
Journey (`FIRST`).

**Fonts.** The specimens set each site's faces in the face itself where it is ours to ship: Inter (fontsource,
OFL) for Butter, Serein and JR Pugh's monogram; Lorenzo Hand, Longhand and Typewriter (the site's own files,
free per its order sheet) for Lorenzo Type. A face that is not shipped (TANS PEARL, Old Claude LP, Cormorant
Garamond) falls through EB Garamond, and the tile's note says so where it matters.

## The design (the hand-built version, 2026-10-17, no longer served)

Tokens and treatment are the sister site's: EB Garamond (self-hosted, `fonts/`), cream `#f2ede3` on
`#0b0b0c`, a vignette and a drifting film grain over everything. The arrangement is Depo Luxe's, taken
from Lorenzo's screenshot of its home (2026-10-17, 2000×1091): everything measurable in it is in the
numbers below; what it cannot show (the exact easing, the loader, the hover) is ours until depoluxe.xyz
can be captured (`npm run capture:design -- --origin https://depoluxe.xyz`, needs the network).

- **Header.** One centred column at the top, as wide as its tagline (Depo Luxe's is ~400px at 2000px):
  row one the two brand words at its ends (`Qwarter` … `Studio`), row two the tagline in italic, row
  three the menu spread across it; three rows a line apart, all one size (~17px), all cream. No gradient
  behind it. On a page that scrolls it collapses to a frosted strip past 48px (site.js).
- **The velvet.** Under every page a `MeshGradient` of four near-blacks (`#050506 #0e0d11 #121015 #08090b`,
  distortion .75, swirl .3, speed .05, opacity .9): the Valerin site's velvet in black, with the paper
  grain over it. It has the pause button (WCAG 2.2.2); on Featured that button also stops the film.
- **Featured: the staircase** (`components/site/featured.tsx`, `featured()` in site.js). Square tiles in
  a chain anchored to the window's bottom-left corner: the focused tile largest (S = min(.56·vh, .42·vw);
  .64·vw on phones), the tiles before it stacked straight up from it at x = 0, the tiles after it along
  the bottom edge, **each half the size of its neighbour nearer the focus and touching it** (the screenshot:
  160 → 322 → 642 up the column, 279 → 140 → 70 along the bottom). Its numeral and name sit at each tile's
  top-right corner, outside it (2.15em in, 0.5em down, the name 3.1em after the numeral). A step is one
  eased transition of every tile's left/top/width/height (1.15 s, `cubic-bezier(.22,1,.36,1)`, 70 ms
  later per step of distance), on wheel, arrow keys, PageUp/Down, swipe, or a tap on another tile; a tap
  on the focused tile, or Enter, opens its Work page. The focused tile's frame, blurred to a colour field
  (`blur.jpg`: 96px, blur 7, brightness .48, then `filter: blur(28px)` at `scale(1.18)`), fills the window
  behind, **screened over the velvet** so the velvet's light moves through its dark. 1.3 s after the strip
  comes to rest the focused tile fades from its still into its film: the site scrolling (`scroll.webm`
  where VP9 plays, else `scroll.mp4`), muted, looping; any move stops it. No footer on this page: the
  bottom edge is the tiles'.
- **The film** (`scripts/work/video.mjs`): a 900×900 window on the page's own 1440px rendering (its
  centre), holding at the top for 0.9 s, panning down at 210 px/s for at most 6.5 s, holding 0.7 s,
  cross-fading 0.6 s to the next page; the first four pages of each site; H.264 and VP9. 0.3–2 MB each.
- **Loader** (featured only, once per browser session, never under reduced motion): the brand's pixel Q
  (`q-mark.svg`, traced from the icon mark's pixel grid: 51 squares, each numbered) lights up square by
  square, then the name flickers in letter by letter between roman, italic and sans (the sister site's
  letter frames) and settles; the stage lifts and the staircase flies in. About 3.5 s. Depo Luxe's own
  loader could not be seen from here.
- **Work** (`/work/`, `archive.tsx`): every project in order, the catalogue included: numeral, a square
  frame where there is one, name in italic, the line, what was made and the year, the site's address.
  A project with pictures opens in the viewer; one without (`media: false`) is listed and waits for them.
  The order is Lorenzo's (2026-10-22): the films open the strip (Butter, JR Pugh), then Stairway, Serein,
  Journey, then qwarter.com's case studies newest first (`FIRST` in `scripts/port/catalogue.mjs`).
- **The viewer** (`/work/<slug>/`, `work.tsx`): the project's blurred frame behind; its line and name
  above; the site itself inside a 16:10 frame (4:5 on phones), each page a tall strip (`page-<name>.jpg`,
  1440 wide, at most 5400 tall) that holds its top for 1.6 s, slides at 70 px/s with a soft start and stop
  (6–26 s), holds, and cross-fades to the next page; the pages are listed under the frame (tap to jump),
  the site's address and what Qwarter made under that; the numeral rail on the left drains with each page.
  Wheel, ↑↓ and a vertical swipe change the page; ←→, a horizontal swipe and the arrows at the foot change
  the project (pushState, so the address and title follow, and Back works); Space pauses; Escape and the ×
  go to Featured. The pause button writes `qw-motion`, the key the Paper shaders read, so one choice holds
  across the site; a hidden tab pauses; reduced motion shows the top of each page and slides nothing.
- **Approach and Contact.** The statement set large (italic, then roman); then qwarter.com's own words
  about itself, verbatim from the snapshot (`chrome.about`: its hero line, the About Us welcome, the team
  and roles, the six questions and answers of its FAQ, the four steps included); then the facts. Contact:
  the address as the page, with qwarter.com's Instagram, Twitter and LinkedIn under it. Both over the
  velvet. The 404 is the same page with "There is no page at this address."
- **Pictures.** `scripts/work/shoot.mjs` photographs a site at 1440×900@2× (viewport frame and full page
  after a scroll pass, so lazy images and reveals have happened; `--discover N` takes the home page and
  the first N−1 pages its own navigation links to; it writes `manifest.json` with each page's route, the
  title the site gives it and its height, and keeps every film the pages play, mp4/webm under 95 MB, as
  `video-NN`); `prepare.mjs` makes `cover.jpg` (1440×900, the viewer's first frame), `tile.jpg`/`tile@2x.jpg`
  (the frame's centre as a 900/1800 square, the staircase's tile), `blur.jpg` and the page strips;
  `video.mjs` the film. A film opens with the site's own clip when there is one (`film.intro` in
  work.json → `raw/intro.mp4`, up to 9 s, cut to the square, muted), then the pages: Jeff's reel, Butter's,
  the film behind Titanium Motor Arts and Journey on qwarter.com's portfolio page.
- **The catalogue** (`scripts/port/catalogue.mjs`). qwarter.com's WordPress keeps each case study as a
  page under `/portfolio/`; the tool reads the snapshot (`.port-cache/qwarter/`, taken by the capture
  workflow on 2026-10-22) and takes from each page only what is unmistakably that client's: its title, the
  service line under it, the facts block (Industry Type, Location, Company Size, Product, Services), the
  "Live Website" it names, "Project Info <year>", and the first sentence about the client; the lines the
  portfolio page's slider and the home page's Selected Work write; and the Selected Work tiles that link to
  sites with no case study (Butter, Core Rhythm Fitness, Ignite Beacon). It takes nothing from the
  challenge/solution prose, because on qwarter.com several of those were pasted from another client's page
  and never rewritten (`11-hamilton-home` is Journey's page under another title and is left out). Pictures:
  the client's live site photographed by the workflow (`.port-cache/shots/<slug>/`, accepted only when its
  titles name the client or it is the site the case study names, and it is not a parking or "Access
  Denied" page), else the pictures the case study itself shows. A project photographed from its own build
  (`OWN_FRAMES`) keeps those frames.

## Content model and provenance

| File | What it holds | Source | Edit freely? |
|---|---|---|---|
| `content/site.json` › `chrome` | brand words, tagline, menu, footer line, the statement, the facts, the contact and its social links, `about` (qwarter.com's hero line, welcome, team, FAQ) | `_provenance` inside the file says where each came from: Lorenzo's own positioning statement (mylife `Open/Work/Writing/Qwarter-The-Problem-Of-Direction.md`), Qwarter LLC's registration, the address he runs Qwarter's GitHub and Vercel from; `about` and the social links verbatim from qwarter.com's home, About Us and Contact pages (snapshot 2026-10-22) | Yes; keep `_provenance` true |
| `content/work.json` | the projects: numeral, name, url, line, what Qwarter made, year, `facts`, the frames, `film`, and `source` per project; `media: false` marks a project without pictures yet | written by `scripts/port/catalogue.mjs` from the WordPress snapshot and the shots of the live sites (each `source` says which page, which site, which date); the four sites photographed from their own builds carry their repository or vault folder | Regenerate with `catalogue.mjs` after a new snapshot or new shots; a project built here (not on qwarter.com): add it to `OWN_FRAMES`, photograph it, `prepare.mjs`, `video.mjs`, `npm test` |
| `.port-cache/`, `.design-cache/` (git-ignored) | the WordPress snapshot (`qwarter/`), the clients' shots (`shots/<slug>/`), fetched files (`media/`), the reference design | the capture workflow's branches: `captures-wp`, `captures-shots-1..3`, `captures-media`, `captures-lean`/`captures` | Fetch, never edit: `git checkout origin/<branch> -- .port-cache` |
| `public/media/work/<slug>/scroll.mp4`, `scroll.webm` | the film of the site scrolling | `video.mjs` from the strips | Regenerate, never edit |
| `content/pages.json` | the four pages: path, kind, title, description, card image | written here | Titles and descriptions yes |
| `public/media/work/<slug>/` | cover, cover@2x, tile, tile@2x, blur, page strips | `prepare.mjs` from `raw/` (git-ignored) | Regenerate, never edit |
| `public/design/qwarter/site.css`, `site.js` | the whole design and behaviour | written here, grown from the sister site's `style.css` / `index.html` / `reel.html` | Yes |
| `public/design/qwarter/fonts/` | EB Garamond 400–800 roman and italic, latin + latin-ext, OFL | Google Fonts, self-hosted (no third-party request) | — |
| `public/design/qwarter/q-mark.svg`, `icon.svg`, `apple-touch-icon.png`, `public/media/og.jpg` | the pixel Q as squares; icons; the social card with the brand's wordmark | traced from and composed of the brand's own marks (mylife `Projects/Project Proposals/Qwarter Template/Assets/`) | Regenerate with `scripts/brand/` |
| `public/design/qwarter/paper.css`, `components/paper/` | the shader surfaces, pause button, paper stock | written here (Verowater's paper) | Yes |
| `content/pages/<slug>.html` | the carried pages: Depo Luxe's markup with Qwarter's content in it | `swap.mjs` from `content/reference/<slug>.html` and `content/swaps/<slug>.json` | Regenerate, never edit: change the swaps or the content files |
| `content/reference/<slug>.html` | Depo Luxe's pages as captured (their content, never served): what the swaps are applied to | `extract.mjs` from the capture | Never edit; re-extract |
| `content/swaps/<slug>.json` | what of each reference page becomes Qwarter's, with each value's source | `scripts/design/swaps-from-content.mjs` from `content/work.json` and `content/site.json` | Regenerate, never edit |
| `public/design/depoluxe.xyz/`, `public/imageLoaderWorker.js`, `public/assets/audio/tac.m4a` | Cuchillo's stylesheet, script, fonts, worker, the archive's click sound | the capture, byte for byte (`extract.mjs`; the worker and the sound copied by hand to the paths the script asks for) | Never edit |
| `content/studies/<slug>.json` | a case study: the words, the tiles, the steps, the recordings and pictures it shows, `walkthrough` scenes, `source` | `scripts/port/studies.mjs` from qwarter.com's case study and the shoot (`generated: true`), or written whole (JR Pugh) | A generated one: never; change `_overrides/<slug>.json`. A hand-written one: yes, keep `source` true |
| `content/studies/_overrides/<slug>.json`, `_pictures/`, `_pending/` | what is written by hand over a generated study; where each delivered picture came from; a step waiting for its recording | written here / `studies.mjs` | Overrides yes, with their `source`; `_pictures` regenerated |
| `public/media/work/<slug>/study/` | the recordings and stills (`walkthrough.mjs`), the pictures the study shows (`studies.mjs`) | the raw captures; the snapshot's media; the projects' own repositories (`$copy`) | Regenerate, never edit |
| `public/design/qwarter/study.css`, `study.js` | the case study's design and motion | written here | Yes |
| `public/design/qwarter/fonts/inter-*`, `Lorenzo*.woff2` | Inter (fontsource, OFL); Lorenzo Type's own families | npm `@fontsource/inter`; `journeynudger/lorenzo` assets/ | — |
| `content/redirects.json` | WordPress redirects | `redirects.py` from the snapshot (not yet run) | Via `redirects.py` |

- **Never invent a fact.** No made-up client, project, number, quote, name, date or placeholder. Everything
  on the site is either Qwarter's own words (sourced) or a site's own words about itself. A gap is a
  question for Lorenzo (below), not a guess. UI copy ("Pages of this site", "There is no page at this
  address") is not a fact and may be written.
- **Nothing of Depo Luxe's or Synchronized Studio's content** is here or may be: no word, picture, film or
  client of theirs. Their *code* is, since 2026-10-22, at Lorenzo's decision ("ship the replica"): the carried
  pages' markup (`content/pages/*.html`, their original pages kept in `content/reference/` for the swaps),
  Cuchillo's stylesheet, script, fonts and worker (`public/design/depoluxe.xyz/`, `public/imageLoaderWorker.js`)
  and the archive's click sound (`public/assets/audio/tac.m4a`). `tests/content.test.ts` fails if a page loads
  from or links to depoluxe.xyz, Vimeo, their CDN, synchronized.studio or qwarter.com's WordPress.
- **Fonts are licensed per domain.** EB Garamond is OFL; the brand's own face (Monument Grotesk) is not
  shipped, so the wordmark appears only as the brand's PNG in the social card.
- `npm test` checks: every record has the fields its interface promises; every project is complete,
  sourced, and its numerals run in order; every frame named was delivered and nothing delivered is unnamed;
  every internal link lands on a page; every referenced media/design file exists and nothing unused ships.

## Paper shaders

`components/paper/paper-shaders.tsx` draws a Paper shader into any element that asks for one:

```html
<div class="sky" data-paper-shader="MeshGradient"
     data-paper-params='{"colors":["#0b0b0c","#17141a","#0d1216","#1a1613"],"distortion":0.7,"swirl":0.25}'
     data-paper-speed="0.06" data-paper-opacity="0.75">
```

Available: `MeshGradient`, `Water`, `GrainGradient`, `PaperTexture` (add more in `components/paper/shaders.ts`,
which keeps the bundle to the shaders named). The shader sits behind the element's content (the element
becomes a stacking context; the shader paints at z-index −1), stops for `prefers-reduced-motion` and for the
visitor's pause (one button per moving surface, remembered site-wide, WCAG 2.2.2), stops off screen, and
renders at capped resolution. Verowater's rules carry over: text never sits on a background that moves and
changes colour unless its contrast is guaranteed by the colour stops (here the stops are all darker than
`#1a1613`); half strength reads as depth, full strength as a screensaver.

## The capture workflow: a GitHub runner as the bridge to the open internet

The build environment's network policy allows GitHub and package registries only: qwarter.com,
depoluxe.xyz, the clients' sites and every mirror (archive.org, Google's cache) answer 403. GitHub's
runners have the open internet, so `.github/workflows/capture.yml` (`workflow_dispatch`, from `main`;
a workflow must be on the default branch to be dispatched) runs the tooling there and pushes the result to
an orphan branch (artifacts cannot be downloaded from here; branches can): `scripts/design/capture.mjs`
on `design_origin` (`design_args`: `--max`, `--frames`, `--video`, `--lean` for a first pass in minutes,
`--budget <seconds>` to stop taking routes and fetching media when the time is spent and still write the
manifest and report; a step's own time limit sends SIGTERM, which does the same),
`scripts/port/fetch.py` on `wordpress_origin`, `curl` for each line of `media_urls`, and
`scripts/work/shoot.mjs` for each line of `shoot_specs` (`<slug> <base> [routes] [--discover N]`, into
`.port-cache/shots/<slug>`). An input set to `skip` skips its step; an empty input takes the default. Every step has a time limit
(capture 45 min, WordPress 30, files 20, shoots 60) and the publish step always runs, so a run always leaves
what it took on the branch. Files over 95 MB are left out and listed in `.design-cache/too-large.txt`. Then, locally:
`git fetch origin <branch> && git checkout origin/<branch> -- .port-cache .design-cache`.

Taken so far (2026-10-22): qwarter.com's WordPress, whole (`captures-wp`: 19 pages, 21 posts, 292 media,
206 MB, the fourteen case studies among them); Jeff's reel from jeffvhs.com (`captures-media`); the
clients' live sites (`captures-shots-1..3`). depoluxe.xyz is the long one: a page that streams film never
goes idle, and fetching every film whole took the first four runs past the job's two-hour limit with nothing
published (the publish step did not run after a cancelled one); hence the budget, the step limits and
`--lean` first.

The first brief (2026-10-12) was to wear synchronized.studio's design with Qwarter's WordPress content
swapped in; its tooling (`extract.mjs`, `swap.mjs`, `prune.mjs`, `inventory.py`, `redirects.py`,
`scripts/qa/compare-design.mjs`, proven end to end on a test site, docs/VERIFICATION.md 2026-10-12) is what
the Depo Luxe replica will run on once its capture lands, and what `redirects.py` needs to map qwarter.com's
old URLs (it fails rather than guess).

## Open questions for Lorenzo

1. **Depo Luxe, exactly: it is their code.** The site now serves Depo Luxe's own pages, stylesheet and
   script (Cuchillo's build, captured on 2026-10-22) with Qwarter's content swapped in, as asked. Every
   word, picture and film is ours and nothing loads from their servers, but the markup, CSS and JavaScript
   are theirs byte for byte, and their script prints Cuchillo's credit in the console. A design studio
   shipping another studio's build is a call only you can make; the hand-built version (`components/site/`,
   `public/design/qwarter/site.*`) is one switch away in `content/pages.json`.
2. **The catalogue now comes from qwarter.com itself** (snapshot of 2026-10-22): the fourteen case studies
   under /portfolio/ and the three Selected Work sites without one (Butter, Core Rhythm Fitness, Ignite
   Beacon). Left out: `/portfolio/11-hamilton-home/`, whose page is Journey Nudge's under another title.
   Was 11 Hamilton Home a project of its own, and is there a site or a picture of it? Anything qwarter.com
   never listed (the Valerin sites, One Water Vero…)?
3. **Sites that no longer answer.** thanhta.com, titaniummotorarts.com and woodco1.com do not resolve any
   more and epicesg.com answers 503, so Thanh Ta, Titanium Motor Arts, Wood Company and EPIC ESG show the
   pictures their case studies show; iotechprotect.com answers the runner with "Access Denied" (a
   firewall that refuses GitHub's runners even to a desktop browser's name; tried twice). Kind Footprint's case
   study names no site, but kindfootprint.org is it (its title says so) and is photographed. If any of the
   dead ones has a new address, one line in the shoot list brings its pictures in.
4. **Butter, Core Rhythm Fitness, Beacon.** qwarter.com's home page links the three with a picture and
   (for Butter) a line, no year. Butter's Shopify store is titled "My Store" (its title was never set;
   worth a minute in its admin), so its name is qwarter.com's; the other two are named from their own
   titles, "CORE RHYTHM FITNESS" and "beacon — the night awaits". Say the years, or the names you use.
5. **The words on Approach.** They are qwarter.com's own: the hero line, the About Us welcome, the team
   and roles (Indigo Varela, Greg Finch, Sergio Monti, Emma Laurion, Alessio Monti), the FAQ with its four
   steps. Still current? Anyone to add or drop?
6. **The tagline and the second brand word.** The header reads `Qwarter … Studio` with "Websites,
   applications, and words that feel true to who they are." under it; both from your positioning
   statement. Say the word to change either.
7. **The contact address.** lorenzo@qwarter.com is shown, as the address Qwarter's GitHub and Vercel run
   from. If the public address is another (hello@, studio@), it is one value in `content/site.json`.
8. **The founder facts** (Founded 2023 · Las Vegas, Nevada · Lorenzo Scardicchio) come from Qwarter LLC's
   registration; LinkedIn says founded 2016. Which year is Qwarter's?
9. **The Room's address**: answered 2026-10-23, `theroom-five.vercel.app` (`content/studies/_overrides/theroom.json`,
   `content/work.json`); the study's Visit button goes there. The runner has not photographed that address yet; the
   frames are from the site's own build, which is the same code.
10. **lorenzoscardicchio.com.** The runner was met by a Cloudflare challenge there, so whether the foundry site
    (`journeynudger/lorenzo`, pushed 2026-10-22) is what the address serves could not be checked; the study is
    photographed from its files and its Visit button goes to the address the site itself names. Bambino's
    study links the alias its README calls live, `bambino-five.vercel.app`; the address you gave,
    `bambino-1dtu.vercel.app`, is the one photographed.
11. **The order of the strip** now runs Butter, JR Pugh, Stairway, Serein, Journey, The Room, Bambino, Lorenzo
    Type, then qwarter.com's catalogue (`FIRST` in `scripts/port/catalogue.mjs`). Say the word to move the three.
12. **The generated studies' words are qwarter.com's and the sites' own**, so where qwarter.com's challenge and
    solution were pasted from another client's page (Boujee Healer and Pineapple Club share theirs, 20/20
    Insights and IoTech their descriptions) the study says less rather than something false. If you have the
    real text for any of them, an override is one file.
13. **The Oct 6 porting prompt** ("Next/Vercel/WordPress") was not in `journeynudger/mylife` on GitHub; this
   port follows journeysite's CLAUDE.md and Verowater's `docs/site-kit/sources/PORT-PLAYBOOK-v1.md` instead.
