/* eslint-disable @next/next/no-img-element -- self-hosted editorial stills, with intrinsic dimensions and a native image-viewer fallback */
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { QMark } from "@/components/site/chrome";
import { Hydrated } from "@/components/study/hydrated";
import { getSite } from "@/lib/content";
import { featuredStories, getStories, getStory, roman, storyCategories, storyImage, storyUrl, type Story, type StoryImage } from "@/lib/stories";

export function Icon({ kind = "arrow" }: { kind?: "arrow" | "plus" | "left" | "down" | "close" }) {
  const paths = {
    arrow: "M6 18 18 6M6 6h12v12",
    plus: "M12 5v14M5 12h14",
    left: "M19 12H5m7-7-7 7 7 7",
    down: "M12 5v14m-7-7 7 7 7-7",
    close: "m6 6 12 12M6 18 18 6",
  };
  return <svg className="qs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind]} /></svg>;
}

export function Chrome({ current = "/stories/" }: { current?: string }) {
  const { brand, nav } = getSite().chrome;
  return <>
    <a className="qs-skip" href="#main">Skip to content</a>
    <div className="qs-header-blur" aria-hidden="true" />
    <header className="qs-header">
      <a href="/" className="qs-wordmark" aria-label="Qwarter Studio, home"><span>{brand.left}</span><span>{brand.right}</span></a>
      <p>{brand.tagline}</p>
      <nav aria-label="Site">{nav.map((item) => <a key={item.href} href={item.href} aria-current={item.href === current ? "page" : undefined}>{item.label}</a>)}</nav>
    </header>
    <a className="qs-mark" href="/" aria-label="Qwarter, home"><QMark /></a>
  </>;
}

export function Footer() {
  return <footer className="qs-footer"><a href="/">Qwarter Studio</a><span>A practice in paying attention.</span><a href="/contact/">Let’s make something meaningful <span aria-hidden="true"><Icon /></span></a></footer>;
}

function imageCredit(image: StoryImage) {
  const credit = image.credit?.split(";")[0].trim() ?? "";
  return /^(Supplied |Extracted from |Original advertiser)/i.test(credit) ? "" : credit;
}

function Plate({ image, index, wide = false }: { image: StoryImage; index: number; wide?: boolean }) {
  // Keep production/provenance notes in the source record, not under every photo.
  const displayCredit = imageCredit(image);
  return <figure className={`qs-plate${wide ? " qs-plate--wide" : ""}`}>
    <a href={image.src} data-story-image aria-label={`Enlarge: ${image.alt}`}>
      <img src={image.src} alt={image.alt} width={image.width} height={image.height} style={image.width < 600 ? {maxWidth:image.width,marginInline:"auto"} : undefined} loading="lazy" decoding="async" />
      <span className="qs-enlarge" aria-hidden="true"><Icon kind="plus" /></span>
    </a>
    <figcaption><span className="qs-label">Fig. {String(index + 1).padStart(2, "0")}</span><span>{image.caption}<small className="qs-photo-credit">{displayCredit ? `Credit: ${displayCredit}.` : ""}{image.date ? ` ${image.date}.` : ""} <a href={image.source} target="_blank" rel="noopener noreferrer">Source</a>{image.license && image.licenseUrl && <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license}</a></>}</small></span></figcaption>
  </figure>;
}

function Collage({ stories, className = "" }: { stories: Story[]; className?: string }) {
  const images = stories.map((story) => ({ story, image: storyImage(story) })).filter((entry) => entry.image);
  return <div className={`qs-collage ${className}`}>{images.map(({ story, image }, index) => <a key={story.slug} className={`qs-cut qs-cut--${index + 1}`} href={storyUrl(story)} aria-label={`${story.company}: ${story.title}`}><figure><img src={image.src} alt="" width={image.width} height={image.height} fetchPriority={index === 0 ? "high" : "auto"} /><figcaption>[ {story.company} ]</figcaption></figure></a>)}</div>;
}

export function StoriesIndex() {
  const stories = getStories();
  const collage = featuredStories();
  return <>
    <Hydrated /><Chrome />
    <main id="main">
      <section className="qs-opening">
        <div className="qs-label qs-opening__eyebrow"><span>Qwarter / Stories</span><span>[ A collection of lessons ]</span></div>
        <h1>Good work has<br /><span>a long</span> memory.</h1>
        <Collage stories={collage} />
        <div className="qs-opening__foot"><p>We learn from those<br />who came before us.</p><a href="#library" className="qs-label">Explore the library <span aria-hidden="true"><Icon kind="down" /></span></a><span className="qs-label">{stories.length} stories & counting</span></div>
      </section>

      <section className="qs-library" id="library" aria-labelledby="library-title"><div className="qs-library__title"><span className="qs-label">I / Collected wisdom</span><h2 id="library-title">Library</h2><p>Follow your curiosity.</p></div>
        <form className="qs-controls" data-story-filters hidden role="search" aria-label="Find a story"><div className="qs-filters" aria-label="Filter by topic">{storyCategories.map((category, index) => <button type="button" key={category} data-category={category} aria-pressed={index === 0}>{category}</button>)}</div><label className="qs-search"><span className="qs-label">Search</span><input type="search" name="q" placeholder="A company, an idea…" autoComplete="off" aria-label="Search stories" /></label></form>
        <p className="qs-label qs-result" data-story-count aria-live="polite">{stories.length} stories</p>
        <ol className="qs-story-list">{stories.map((story, position) => { const image = storyImage(story); return <li key={story.slug} id={`story-${story.slug}`} data-story-row data-category={story.category} data-search={`${story.company} ${story.title} ${story.lesson}`.toLowerCase()}><a href={storyUrl(story)}><span className="qs-story-list__number">{roman(position + 1)}</span><div className="qs-story-list__image">{image ? <img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" /> : <span>{story.company.slice(0, 1)}</span>}</div><div className="qs-story-list__name"><span className="qs-label">{story.company}</span><h3>{story.title}</h3></div><span className="qs-story-list__topic qs-label">{story.category}</span><span className="qs-story-list__time qs-label">{story.minutes} min{story.isExcerpt && <small>Excerpt</small>}</span><span className="qs-story-list__arrow" aria-hidden="true"><Icon /></span></a></li>; })}</ol><p className="qs-empty" data-story-empty hidden>No stories found. Try another company or idea.</p>
      </section>
      <section className="qs-closing"><span className="qs-label">A note to ourselves</span><p>Stay curious.<br /><span>The next lesson is everywhere.</span></p><a href="/approach/">Our way of working <span aria-hidden="true"><Icon /></span></a></section>
    </main><Footer />
  </>;
}

type Spread = { blocks: Story["blocks"]; images: number[] };

/** Keep the source paragraphs in order and place each supplied image once, alongside the reading. */
export function readingSpreads(story: Story): Spread[] {
  const result: Spread[] = [];
  let current: Spread = { blocks: [], images: [] };
  const flush = () => { if (current.blocks.length || current.images.length) result.push(current); current = { blocks: [], images: [] }; };
  for (const block of story.blocks) {
    if (block.type === "heading" && current.blocks.length) flush();
    if (block.type === "image") { current.images.push(block.image); flush(); }
    else {
      current.blocks.push(block);
      const paragraphs = current.blocks.filter(item => item.type === "paragraph");
      const words = paragraphs.reduce((sum, item) => sum + item.text.split(/\s+/).length, 0);
      if ((paragraphs.length >= 3 && words >= 140) || paragraphs.length >= 7) flush();
    }
  }
  flush();
  const placed = new Set(result.flatMap(section => section.images));
  const remaining = [story.hero, ...story.images.map((_,i) => i).filter(i => i !== story.hero)].filter(i => !placed.has(i));
  for (const section of result) if (!section.images.length && remaining.length) section.images.push(...remaining.splice(0, story.imageLayout === "pairs" ? 2 : 1));
  while (remaining.length) result.push({blocks: [], images: remaining.splice(0, Math.min(2, remaining.length))});
  return result;
}

function ReaderVideo({video}: {video: NonNullable<Story["videos"]>[number]}) {
  return <figure className="qr-video" data-qr-reveal>
    <iframe src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`} title={video.title} loading="lazy" width="560" height="420" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
    <figcaption><span className="qs-label">Watch / {video.title}</span><p>{video.caption}</p><a href={video.source} target="_blank" rel="noopener noreferrer">Watch on YouTube <Icon /></a></figcaption>
  </figure>;
}

export function StoryPage({ slug }: { slug: string }) {
  const story = getStory(slug);
  if (!story) notFound();
  const stories = getStories();
  const position = stories.findIndex(item => item.slug === story.slug);
  const index = position >= 0 ? position : story.id - 1;
  const related = [...stories.slice(position + 1), ...stories.slice(0, Math.max(0,position))].filter(item => item.slug !== story.slug && item.category === story.category).slice(0,2);
  const next = stories[(Math.max(0,position)+1)%stories.length];
  const sections = readingSpreads(story);
  const headings = story.blocks.filter(block => block.type === "heading");
  // Editorial references only. Upload notes, extraction details and file metadata stay in the content record.
  const sourceEntries = [
    ...(story.source.url ? [{url: story.source.url, label: story.source.url.endsWith(".pdf") ? `${story.company}: image collection` : story.source.label.replace(/^Supplied [^;]+;\s*/, "").replace(/^Supplied reflection and /, "")}] : []),
    ...story.images.filter(image => /^https?:|\.pdf(?:#|$)/.test(image.source)).map(image => ({url:image.source, label:image.caption})),
  ].filter((item,i,all) => all.findIndex(other => other.url.split("#")[0] === item.url.split("#")[0]) === i);
  const accents: Record<string,string> = { Brand: "#3a4030", Craft: "#333d40", Direction: "#3c3831", Growth: "#293c38", Resilience: "#403032" };
  const accent = story.id === 51 ? "#591d24" : story.id === 44 ? "#173e32" : accents[story.category];
  const number = roman(index+1);
  return <>
    <Hydrated /><Chrome />
    <main id="main" className="qr-reader" data-story-reader style={{"--qr-accent":accent} as CSSProperties}>
      <header className="qr-opening" data-qr-tone="ink">
        <div className="qr-opening__rail qs-label"><a href="/stories/">Qwarter / Stories</a><span>{story.draft ? "Draft / For review" : `${number} / ${story.category}`}</span><span>{story.company}</span></div>
        {story.draft && <p className="qr-draft">Draft for review. This page is unlisted.</p>}
        <h1>{story.title}</h1>
        <div className="qr-opening__foot"><p>{story.lesson}</p><span className="qs-label">{story.minutes} minute read{story.isExcerpt ? " / excerpt" : ""}</span><a className="qs-label" href="#reading">Begin reading <Icon kind="down" /></a></div>
      </header>
      <div id="reading" className="qr-spreads">
        {sections.map((section,i) => <section key={i} className={`qr-spread qr-spread--${i%3===0?"ink":i%3===1?"color":"paper"}${section.images.length?"":" qr-spread--text"}${i%2?" qr-spread--reverse":""}${section.images.length>1?" qr-spread--paired":""}${!section.blocks.length?" qr-spread--plates":""}`} data-qr-tone={i%3===2?"paper":"ink"} aria-label={`Reading section ${i+1}`}>
          <div className="qr-spread__rail qs-label"><span>{number} / {String(i+1).padStart(2,"0")}</span><span>{story.company}</span></div>
          {(section.blocks.length>0 || (i===Math.min(1,sections.length-1) && !!story.videos?.length)) && <div className="qr-spread__text" data-qr-reveal>
            {section.blocks.map((block,j) => block.type === "heading" ? <h2 key={j} id={block.id}>{block.text}</h2> : block.type === "paragraph" ? <p key={j} className={i===0&&j===0?"qr-lead":undefined}>{block.text}</p> : null)}
            {i===Math.min(1,sections.length-1) && story.videos?.map(video => <ReaderVideo key={video.youtubeId} video={video} />)}
          </div>}
          {section.images.length>0 && <div className={`qr-spread__media${section.images.length>1?" qr-spread__media--sequence":""}`}>
            {section.images.map((image,j) => <div key={image} className="qr-plate-slot" data-qr-reveal data-qr-depth={j%2 ? "1.4" : "0.7"} style={{"--qr-delay":`${j*100}ms`} as CSSProperties}><Plate image={story.images[image]} index={image} wide /></div>)}
          </div>}
        </section>)}
      </div>
      <section className="qr-ending" data-qr-tone="paper">
        {story.isExcerpt && <p className="qs-excerpt-note">A fragment from our reading. The supplied source ends here.</p>}
        <section className="qr-takeaway" id="takeaway"><span className="qs-label">What we take from it</span><h2>{story.lesson}</h2></section>
        <details className="qs-sources" id="sources"><summary>References <Icon kind="plus" /></summary><div><ul>{sourceEntries.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.label} <Icon /></a></li>)}</ul></div></details>
      </section>
      <section className="qs-continue"><div><span className="qs-label">Keep following your curiosity</span><h2>One lesson leads<br /><span>to another.</span></h2></div><div className="qs-continue__links">{(related.length ? related : [next]).map((item) => <a href={storyUrl(item)} key={item.slug}><span className="qs-label">{item.company} / {item.minutes} min</span><h3>{item.title}</h3><span aria-hidden="true"><Icon /></span></a>)}</div></section>
    </main>
    <Footer />
    <div className="qs-reading-bar"><a href="/stories/" aria-label="Back to all stories"><Icon kind="left" /> <span>All stories</span></a><span className="qs-label qs-reading-bar__company">{story.company}</span><span className="qs-label" data-reading-percent aria-label="Reading progress">0%</span><details className="qs-contents"><summary>Contents <span aria-hidden="true"><Icon kind="plus" /></span></summary><nav aria-label="Article contents"><a href="#main">Opening</a>{headings.map((heading) => <a key={heading.id} href={`#${heading.id}`}>{heading.text}</a>)}<a href="#takeaway">What we take from it</a><a href="#sources">References</a></nav></details><div className="qs-progress" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} data-reading-progress><span /></div></div>
    <dialog className="qs-lightbox" aria-label="Expanded story image"><button type="button" data-image-close aria-label="Close expanded image">Close <Icon kind="close" /></button><figure><img data-expanded-image alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /><figcaption data-expanded-caption /></figure></dialog>
  </>;
}
