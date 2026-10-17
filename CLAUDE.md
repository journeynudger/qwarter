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
| Photograph a site Qwarter built (raw PNGs, not committed) | `node scripts/work/shoot.mjs <slug> <base> name=route[\|click:selector] …` |
| Make the delivered pictures from the raw ones | `node scripts/work/prepare.mjs [slug …]` |
| Render each site scrolling, as the strip's film | `node scripts/work/video.mjs [slug …]` → `scroll.mp4` + `scroll.webm` |
| Icons and the social card from the brand's marks | `node scripts/brand/icons.mjs <white wordmark png>` (mark: `scripts/brand/trace-mark.mjs`) |
| Stills of every page, both widths, loader and slideshow mid-way | `node scripts/qa/shots.mjs --base http://localhost:3102` → `qa-out/shots/` |
| Rendered-page sweep (console errors, images, alt, overflow, h1, links) | `node scripts/qa/sweep.mjs --base http://localhost:3102` |
| Snapshot qwarter.com's WordPress (needs network) | `npm run capture:wordpress`, then `npm run port:inventory`, `npm run port:redirects` |
| Capture a reference design, extract, swap, compare (parked, see below) | `npm run capture:design` · `npm run extract:design` · `npm run swap` · `npm run qa:compare` |

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
components/layout/assets.tsx the <link>s, <style>s and <script>s a page lists, in order
lib/content.ts               types, accessors, resolveRoute(): the single source of routing truth; /work/<slug>/ pages
lib/html.ts                  carried markup → React elements (kind "html" pages; none at the moment)
content/                     everything the site says (see below)
public/design/qwarter/       site.css, site.js, fonts/, paper.css, q-mark.svg, icon.svg, apple-touch-icon.png
public/media/work/<slug>/    the delivered pictures of each project; raw/ holds the captures (ignored by git)
public/media/og.jpg          the social card
scripts/work/                shoot.mjs (photograph a site), prepare.mjs (deliver the pictures), video.mjs (the film)
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

## The design

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
  A photographed site opens in the viewer; a catalogue entry waits for its pictures.
- **The viewer** (`/work/<slug>/`, `work.tsx`): the project's blurred frame behind; its line and name
  above; the site itself inside a 16:10 frame (4:5 on phones), each page a tall strip (`page-<name>.jpg`,
  1440 wide, at most 5400 tall) that holds its top for 1.6 s, slides at 70 px/s with a soft start and stop
  (6–26 s), holds, and cross-fades to the next page; the pages are listed under the frame (tap to jump),
  the site's address and what Qwarter made under that; the numeral rail on the left drains with each page.
  Wheel, ↑↓ and a vertical swipe change the page; ←→, a horizontal swipe and the arrows at the foot change
  the project (pushState, so the address and title follow, and Back works); Space pauses; Escape and the ×
  go to Featured. The pause button writes `qw-motion`, the key the Paper shaders read, so one choice holds
  across the site; a hidden tab pauses; reduced motion shows the top of each page and slides nothing.
- **Approach and Contact.** The statement set large (italic, then roman) and the facts; the address as the
  page; both over the velvet. The 404 is the same page with "There is no page at this address."
- **Pictures.** `scripts/work/shoot.mjs` photographs a site at 1440×900@2× (viewport frame and full page
  after a scroll pass, so lazy images and reveals have happened); `prepare.mjs` makes `cover.jpg`
  (1440×900, the viewer's first frame), `tile.jpg`/`tile@2x.jpg` (the frame's centre as a 900/1800 square,
  the staircase's tile), `blur.jpg` and the page strips; `video.mjs` the film.

## Content model and provenance

| File | What it holds | Source | Edit freely? |
|---|---|---|---|
| `content/site.json` › `chrome` | brand words, tagline, menu, footer line, the statement, the facts, the contact | `_provenance` inside the file says where each came from: Lorenzo's own positioning statement (mylife `Open/Work/Writing/Qwarter-The-Problem-Of-Direction.md`), Qwarter LLC's registration, the address he runs Qwarter's GitHub and Vercel from | Yes; keep `_provenance` true |
| `content/work.json` | the projects: numeral, name, url, line, what Qwarter made, year, the frames, and `source` per project; `media: false` marks a catalogue entry without pictures yet | the three photographed sites: each site's own `<title>`/description and its repository or vault folder. The ten catalogue entries (IV–XIII): qwarter.com's own case studies, found through search on 2026-10-17 because qwarter.com itself is unreachable from the build environment; each line as the search returned it, each `source` naming its qwarter.com page | Yes. A new project: add it, photograph it, `prepare.mjs`, `video.mjs`, `npm test`. The catalogue entries are to be checked word for word against the WordPress snapshot when it can be taken |
| `public/media/work/<slug>/scroll.mp4`, `scroll.webm` | the film of the site scrolling | `video.mjs` from the strips | Regenerate, never edit |
| `content/pages.json` | the four pages: path, kind, title, description, card image | written here | Titles and descriptions yes |
| `public/media/work/<slug>/` | cover, cover@2x, tile, tile@2x, blur, page strips | `prepare.mjs` from `raw/` (git-ignored) | Regenerate, never edit |
| `public/design/qwarter/site.css`, `site.js` | the whole design and behaviour | written here, grown from the sister site's `style.css` / `index.html` / `reel.html` | Yes |
| `public/design/qwarter/fonts/` | EB Garamond 400–800 roman and italic, latin + latin-ext, OFL | Google Fonts, self-hosted (no third-party request) | — |
| `public/design/qwarter/q-mark.svg`, `icon.svg`, `apple-touch-icon.png`, `public/media/og.jpg` | the pixel Q as squares; icons; the social card with the brand's wordmark | traced from and composed of the brand's own marks (mylife `Projects/Project Proposals/Qwarter Template/Assets/`) | Regenerate with `scripts/brand/` |
| `public/design/qwarter/paper.css`, `components/paper/` | the shader surfaces, pause button, paper stock | written here (Verowater's paper) | Yes |
| `content/redirects.json`, `content/pages/`, `content/swaps/`, `content/reference/` | WordPress redirects; carried markup; the swap tooling's files | empty until qwarter.com's WordPress is snapshotted (parked, below) | — |

- **Never invent a fact.** No made-up client, project, number, quote, name, date or placeholder. Everything
  on the site is either Qwarter's own words (sourced) or a site's own words about itself. A gap is a
  question for Lorenzo (below), not a guess. UI copy ("Pages of this site", "There is no page at this
  address") is not a fact and may be written.
- **Nothing of Depo Luxe's or Synchronized Studio's content** is here or may be: only the arrangement.
  `tests/content.test.ts` fails if a page loads from or links to synchronized.studio or qwarter.com's WordPress.
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

## Parked: the capture / swap tooling and qwarter.com's WordPress content

The first brief (2026-10-12) was to wear synchronized.studio's design with Qwarter's WordPress content
swapped in. The tooling for it is complete and proven end to end on a test site (docs/VERIFICATION.md,
2026-10-12): `scripts/design/capture.mjs` (any site, completely), `extract.mjs`, `swap.mjs`, `prune.mjs`,
`scripts/port/fetch.py` (WordPress through its REST API), `inventory.py`, `redirects.py`,
`scripts/qa/compare-design.mjs`. Neither site could be captured from this environment (its network policy
allows GitHub and package registries only), and on 2026-10-17 the direction changed to the site described
above. The tooling stays for two uses: capturing depoluxe.xyz to hold this design against the real thing, and
snapshotting qwarter.com's WordPress so its old URLs redirect (`redirects.py` fails rather than guess) and
any content worth keeping (clients, case studies, words) can be brought into `content/`.

## Open questions for Lorenzo

1. **Network access, which now blocks two of your asks.** The environment's policy denies `qwarter.com`
   and `depoluxe.xyz` (and every mirror: archive.org, Google's cache). Without it the catalogue has no
   pictures and the home is built from your screenshot rather than from Depo Luxe itself. Cloud
   environment menu (the session's title bar) → Edit → Network access: add `qwarter.com`, `www.qwarter.com`
   and `depoluxe.xyz` under Allowed domains (leave "Allow package managers" ticked), or choose Full. Then:
   `npm run capture:wordpress` (every case study, its pictures and words), `capture:design` on
   depoluxe.xyz (its loader, easing, blur, hover, measured), and the strip grows to the whole catalogue.
2. **The catalogue as it stands** (IV–XIII on /work/): Ekaterina Sky, EPIC ESG, Titanium Motor Arts,
   IoTech Protect, 20/20 Insights, Pineapple Club, ION Insurance, Thanh Ta, Boujee Healer, Wood Company,
   from qwarter.com's own case-study pages as search returned them. Anything missing from qwarter.com, or
   a brand you worked with that qwarter.com never listed (the Valerin sites, One Water Vero, 11 Hamilton…)?
3. **The tagline and the second brand word.** The header reads `Qwarter … Studio` with "Websites,
   applications, and words that feel true to who they are." under it; both from your positioning
   statement. Say the word to change either.
4. **The contact address.** lorenzo@qwarter.com is shown, as the address Qwarter's GitHub and Vercel run
   from. If the public address is another (hello@, studio@), it is one value in `content/site.json`.
5. **The founder facts** (Founded 2023 · Las Vegas, Nevada · Lorenzo Scardicchio) come from Qwarter LLC's
   registration; LinkedIn says founded 2016. Which year is Qwarter's?
6. **The Oct 6 porting prompt** ("Next/Vercel/WordPress") was not in `journeynudger/mylife` on GitHub; this
   port follows journeysite's CLAUDE.md and Verowater's `docs/site-kit/sources/PORT-PLAYBOOK-v1.md` instead.
