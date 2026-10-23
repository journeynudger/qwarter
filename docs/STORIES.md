# Stories

The reading room lives at `/stories/`; every entry has its own `/stories/<slug>/` URL.
It is a collection of lessons from other companies and people, rather than a Qwarter client-work
portfolio. The introductory copy and each “What we take from it” are Qwarter editorial framing;
the article bodies come from Lorenzo’s supplied reading collection of 2026-10-23.

## Design and implementation

The black ground, EB Garamond roman and italic, Q mark, and navigation belong to the existing site.
The oversized title pages, numbered figures, collaged photographs, margin notes, narrow reading
measure, and bottom reading controls are an original implementation informed by the Stripe Press
*Poor Charlie’s Almanack* reference. No Stripe fonts, imagery, markup, CSS, or scripts are shipped.

- `content/stories.json`: all 37 articles, their headings, images, categories, source notes, and takeaways.
- `lib/stories.ts`: types and accessors; curated starting points, categories, and Roman numerals.
- `components/stories/stories.tsx`: the index and readers, fully rendered on the server.
- `public/design/qwarter/stories.css` and `stories.js`: layout and progressive enhancements.
- `public/media/stories/`: locally saved WebP imagery. Each image records its download URL, source page,
  description, dimensions, and a credit when known. Images never depend on remote hotlinks.

The root catch-all remains the routing authority. `storyPages()` in `lib/content.ts` contributes
the index and 37 reader routes, metadata, Open Graph images, static generation, and sitemap entries.
Stories use their own assets, as the existing case studies do, so the carried design’s page-transition
script cannot intercept the new reader. The existing five menu positions and their animation ids
remain intact; the previously hidden third position is now Stories.

Search and category filters enhance the complete server-rendered list. Contents are native `<details>`
links; figures are image links until the script adds a native dialog. Escape closes the dialog,
focus returns to its trigger, and reduced motion disables smooth scrolling and hover motion.
`Hydrated` gates DOM updates so they do not compete with React hydration.

## Editing content

Each entry has a stable slug, two-line headline, company, category, read time, source, lesson, image
array, and ordered `blocks`. Blocks are paragraphs, headings with unique ids, or references to an image
index. `hero` indexes the opening image. Images not already placed in the body appear in the closing
image section, so adding a photograph does not silently leave an unused asset in production.

Article copy has had sponsor blocks, advertising links, publisher branding, related-news footers,
newsletter controls, and emojis removed. Historical campaigns discussed by an article remain as
editorial illustrations. The separate Wrigley advertisement transcription is not included.

IBM, Arthur Rock/Fairchild, and Skool are incomplete supplied excerpts. Their pages say so, carry
`noindex`, and stay out of the sitemap. No missing ending has been invented. The two Trader Joe’s
articles are separate supplied versions and intentionally have separate routes.

The supplied bodies are a transcription and cleanup, not a new independent fact check. Before a
production editorial release, review the original source claims, particularly Poppi’s Shark Tank
investor, relative-date Chipotle outbreak claims, the Apple credit-card and WeWork dates in Ansoff,
and the Cola Wars health and naval-fleet claims. Image sources and credits are preserved; downloading
an image does not create a new license to it.

## Navigation regeneration

For a navigation-only edit, run `node scripts/design/navigation.mjs` after editing `content/site.json`.
This regenerates the carried pages’ header and side-menu blocks without a browser or capture.
The full reference-swap pipeline also knows about Stories:
`node scripts/design/swaps-from-content.mjs` followed by `node scripts/design/swap.mjs`.
The latter requires the reference pipeline’s Playwright browser installation.

## Verification

`npm run typecheck`, `node --import tsx --test tests/*.test.ts`, and `npm run build` cover routes,
rendered readers, complete copy without scripts, local imagery, figure references, promotion removal,
excerpt indexing, and navigation integration. The direct Node test command runs the same suite as
`npm test`, without tsx’s command-line IPC server, for restricted local environments.

Desktop and 390 px mobile browser review covers the title pages, reading layout, live filters and
search, empty-search state, contents navigation, image dialog, and reading progress.

## Readability and header update (2026-10-23)

The wordmark and tagline lift above the viewport on scroll, leaving the menu at the top. The shared
carried header reads the existing Approach scroll indicator as well as native scrolling, reconnects
when carried navigation replaces the article, and removes the hidden wordmark from keyboard focus.
Stories uses the same motion with its native scroll. Reduced-motion preferences disable transitions.
Approach media uses larger responsive frames, preserving whole website pictures and videos. Story
labels and captions have a readable minimum size, natural image colour, and full-width supporting
pictures on phones. Decorative reader pictures are removed on phones to protect headline readability.

All 37 supplied articles have individual routes; 109 local image files decode successfully and their
pixel dimensions match the article records. The three incomplete supplied sources remain marked as
excerpts. The existing tests and production build pass. A focused header regression test covers both
native and carried scroll state and restoration at the top. Fresh browser visual review for this update
was blocked by the browser URL security policy; previous screenshots predate these layout changes.

The AI and advisory content supplied on 2026-10-23 is an additional final chapter within Approach,
confirmed by Lorenzo, rather than a separate page. `content/fragments/approach-ai.html` holds the original
Qwarter section; `pageMarkup` inserts it inside the carried article so its height participates in the
existing smooth scroll. The captured HTML and source build remain unchanged. Its illustration is an
original set of six vector drawings for the idea-to-launch sequence, not historical claims or LCA assets.
The brand, tagline and navigation now share the same width; tagline spacing fills that width.

## Additional supplied screenshots (2026-10-23)

The collection now has 43 stories and 117 local image files. IMG_6511 adds Tony Fadell/iPod;
IMG_6513–6514 combine into Dario Amodei; IMG_6517 adds Cristiano Ronaldo; IMG_6518 adds the
Messi napkin; IMG_6519–6520 combine into the Amazon principles; IMG_6522–6523 combine into NVIDIA/Sega.
IMG_6512 and IMG_6515 duplicate the existing Superhuman and Eventbrite articles, so their source
records are updated rather than creating duplicate routes. IMG_6516 illustrates the existing iMac
article; IMG_6521 is preserved as a supporting Amazon letter excerpt. Overlap is removed once.

Eight images are added. The new primary image sources are Apple Newsroom, Anthropic, Wikimedia Commons
(Anton Zaytsev/soccer.ru, CC BY-SA 3.0), AP via NPR/GPB, and Amazon. The clean Jensen Huang archive copy
matches the supplied photo; its source is Ticker History, with original photographer/date explicitly
unconfirmed. Susan Ragan/AP and the March 1999 date for the supplied iMac picture were verified through
ORF and AP gallery coverage. Each photograph now has a visible source link and credit beneath it.
Known dates and license links are printed; unconfirmed attribution is stated rather than invented.
Older figures lacking an identified photographer say so and link to their original source.

These bodies preserve the supplied article text; source numerical and relative-date claims are not an
independent fact check. In particular, review the Dario valuation, the Ronaldo 2026 match/record claims,
and the NVIDIA Sega stake estimate before using them as independently verified statements. No date has
been inferred for the supplied Amazon screenshot or the Jensen photograph. Visual inspection of the
actual new image files confirmed the subjects and clarity. Fresh page/browser review remains blocked
by the previously reported browser policy.

## Shelf and typography revision (2026-10-23)

Five withdrawn readings (source ids 1, 2, 3, 8 and 12) and their three otherwise-unused images have
been removed from the published content. Their routes now resolve to 404 and leave the sitemap.
There are 38 readings and 114 image files. The opening photograph strip, six selected cards, and
library order now start with ids 39, 43, 38, 40, 34 and 42: Dario, NVIDIA, Apple/iPod, Ronaldo,
Coca-Cola/Pepsi and Amazon. The iMac article follows those six. Display numerals follow shelf order;
source ids and surviving article URLs remain stable.

The Ronaldo portrait is replaced with the side-view bicycle-kick photograph from UEFA's 3 April 2018
Juventus–Real Madrid coverage, credited AFP/Getty Images, via UEFA. The former portrait file and its
license metadata are removed. Stories no longer renders emphasis elements, and Qwarter's own styles
enforce upright typography on carried pages, case studies, and readers. Shared source builds remain
unchanged. Image enlargement, arrows, contents and close controls use centered 24-unit SVG drawings,
with consistent square control boxes. The six lead photographs and card frames are aligned in grids.

Verification: 38 routes and six selected/opening items, absence of withdrawn text and emphasis markup,
retired routes, figure references, attribution, and existing content checks; production build passes.
Browser visual review remains unavailable because of the previously recorded browser policy block.

## Immersive readings and review drafts (2026-10-23)

The collection contains 48 public readings and three unlisted review drafts. Ten additions follow the
existing 38 in shelf order: Beautiful First Sentences of Books; The Client Isn’t Always Right;
The Story Inside the Swoosh; Ogilvy’s Rule of Typography; Logos Used to Be Art;
From Novelty to Commodity; Permission to Fail; Rosso Corsa; A Memory Worth Keeping;
Build the Future First. Memex and Xerox PARC are the last two public entries. The opening six remain unchanged.

All 51 readers use the same responsive ruled spreads, alternating ink / category color / warm paper,
large upright type, sticky desktop figures, inline mobile figures and progressive image reveals.
The source paragraphs remain in order, and each image appears once in the reading body. Layered
frontispieces introduce the image collections. Original image bounds are retained; small archival
images are limited to their intrinsic width rather than enlarged across a desktop column.
Reduced motion and a document without JavaScript retain the full reading.

The user supplied ten Barnes & Noble conceptual posters, NeXT / Nike / PBS / iPhone imagery, and
both PDFs. The ten actual embedded images in each PDF were extracted with Poppler rather than
photographing their surrounding presentation templates. Ferrari photographs and Ogilvy advertisements
have local copies and source notes. PBS also includes the original design firm’s television application
and identity booklet, with credit and source links. Memex uses the Life illustration and a Bush portrait;
PARC uses Alto / office archival photographs from the Computer History Museum. Videos include the
1997 Jordan Failure commercial, Jobs on Rand, the iPhone introduction, SRI’s 1968 demo highlights,
and Dan Ingalls’s Alto/Smalltalk demonstration. Each embed has a direct viewing fallback.

Original essays use the supplied writing and the Bill conversations as context without republishing
private transcripts or promoting a product. The three Daring Fireball-inspired essays stay unlisted,
carry a visible Draft notice and noindex, and are excluded from public related links and the sitemap:
`leave-room-to-be-wrong`, `remembering-to-ask`, `let-the-question-land`.
New prose contains no em dashes. Unsupported precise source claims were qualified or omitted.
