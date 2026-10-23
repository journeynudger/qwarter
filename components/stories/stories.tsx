/* eslint-disable @next/next/no-img-element -- self-hosted editorial stills, with intrinsic dimensions and a native image-viewer fallback */
import { Fragment } from "react";
import { notFound } from "next/navigation";

import { QMark } from "@/components/site/chrome";
import { Hydrated } from "@/components/study/hydrated";
import { getSite } from "@/lib/content";
import { featuredStories, getStories, getStory, roman, storyCategories, storyImage, storyUrl, type Story, type StoryImage } from "@/lib/stories";

function Chrome() {
  const { brand, nav } = getSite().chrome;
  return <>
    <a className="qs-skip" href="#main">Skip to content</a>
    <header className="qs-header">
      <a href="/" className="qs-wordmark" aria-label="Qwarter Studio, home"><span>{brand.left}</span><span>{brand.right}</span></a>
      <p>{brand.tagline}</p>
      <nav aria-label="Site">{nav.map((item) => <a key={item.href} href={item.href} aria-current={item.href === "/stories/" ? "page" : undefined}>{item.label}</a>)}</nav>
    </header>
    <a className="qs-mark" href="/" aria-label="Qwarter, home"><QMark /></a>
  </>;
}

function Footer() {
  return <footer className="qs-footer"><a href="/">Qwarter Studio</a><span>A practice in paying attention.</span><a href="/contact/">Let’s make something meaningful <span aria-hidden="true">↗</span></a></footer>;
}

function Plate({ image, index, wide = false }: { image: StoryImage; index: number; wide?: boolean }) {
  return <figure className={`qs-plate${wide ? " qs-plate--wide" : ""}`}>
    <a href={image.src} data-story-image aria-label={`Enlarge: ${image.alt}`}>
      <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
      <span className="qs-enlarge" aria-hidden="true">+</span>
    </a>
    <figcaption><span className="qs-label">Fig. {String(index + 1).padStart(2, "0")}</span><span>{image.caption}</span></figcaption>
  </figure>;
}

function Collage({ stories, className = "" }: { stories: Story[]; className?: string }) {
  const images = stories.map((story) => ({ story, image: storyImage(story) })).filter((entry) => entry.image);
  return <div className={`qs-collage ${className}`} aria-hidden="true">{images.slice(0, 4).map(({ story, image }, index) => <figure key={`${story.slug}-${index}`} className={`qs-cut qs-cut--${index + 1}`}><img src={image.src} alt="" width={image.width} height={image.height} fetchPriority={index === 0 ? "high" : "auto"} /><figcaption>[ {story.company} ]</figcaption></figure>)}</div>;
}

export function StoriesIndex() {
  const stories = getStories();
  const features = featuredStories();
  const collage = [features[1], features[2], stories.find((story) => story.id === 37)!, stories.find((story) => story.id === 34)!];
  return <>
    <Hydrated /><Chrome />
    <main id="main">
      <section className="qs-opening">
        <div className="qs-label qs-opening__eyebrow"><span>Qwarter / Stories</span><span>[ A collection of lessons ]</span></div>
        <h1>Good work has<br /><em>a long</em> memory.</h1>
        <Collage stories={collage} />
        <div className="qs-opening__foot"><p>We learn from those<br />who came before us.</p><a href="#library" className="qs-label">Explore the collection <span aria-hidden="true">↓</span></a><span className="qs-label">{stories.length} stories & counting</span></div>
      </section>

      <section className="qs-introduction" aria-labelledby="intro-title"><span className="qs-label">I / A way of seeing</span><div><h2 id="intro-title">A little curiosity.<br /><em>A wider perspective.</em></h2><p>The companies, people, and decisions we keep coming back to. Stories about finding a point of view, making something that matters, and staying with it when the work gets difficult.</p><p>We collect them to see our own work more clearly. There is always something to learn from the people who made a path before us.</p></div></section>

      <section className="qs-selected" aria-labelledby="selected-title"><div className="qs-section-label"><span className="qs-label">II / A place to begin</span><h2 id="selected-title">Three stories worth<br /><em>spending time with.</em></h2></div><div className="qs-featured">{features.map((story, index) => {
        const image = storyImage(story);
        return <a className={`qs-feature qs-feature--${index + 1}`} key={story.slug} href={storyUrl(story)}><div className="qs-feature__picture">{image ? <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" /> : <span>{roman(story.id)}</span>}<span className="qs-feature__arrow" aria-hidden="true">↗</span></div><div className="qs-label qs-feature__meta"><span>{story.company} / {story.category}</span><span>{story.minutes} min</span></div><h3>{story.headline[0]}<br /><em>{story.headline[1]}</em></h3><p>{story.lesson}</p></a>;
      })}</div></section>

      <section className="qs-library" id="library" aria-labelledby="library-title"><div className="qs-library__title"><span className="qs-label">III / Collected wisdom</span><h2 id="library-title">The <em>reading room.</em></h2><p>Follow your curiosity.</p></div>
        <form className="qs-controls" data-story-filters hidden role="search" aria-label="Find a story"><div className="qs-filters" aria-label="Filter by topic">{storyCategories.map((category, index) => <button type="button" key={category} data-category={category} aria-pressed={index === 0}>{category}</button>)}</div><label className="qs-search"><span className="qs-label">Search</span><input type="search" name="q" placeholder="A company, an idea…" autoComplete="off" aria-label="Search stories" /></label></form>
        <p className="qs-label qs-result" data-story-count aria-live="polite">{stories.length} stories</p>
        <ol className="qs-story-list">{stories.map((story) => { const image = storyImage(story); return <li key={story.slug} id={`story-${story.slug}`} data-story-row data-category={story.category} data-search={`${story.company} ${story.title} ${story.lesson}`.toLowerCase()}><a href={storyUrl(story)}><span className="qs-story-list__number">{roman(story.id)}</span><div className="qs-story-list__image">{image ? <img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" /> : <span>{story.company.slice(0, 1)}</span>}</div><div className="qs-story-list__name"><span className="qs-label">{story.company}</span><h3>{story.headline.join(" ")}</h3></div><span className="qs-story-list__topic qs-label">{story.category}</span><span className="qs-story-list__time qs-label">{story.minutes} min{story.isExcerpt && <small>Excerpt</small>}</span><span className="qs-story-list__arrow" aria-hidden="true">↗</span></a></li>; })}</ol><p className="qs-empty" data-story-empty hidden>No stories found. Try another company or idea.</p>
      </section>
      <section className="qs-closing"><span className="qs-label">A note to ourselves</span><p>Stay curious.<br /><em>The next lesson is everywhere.</em></p><a href="/approach/">Our way of working <span aria-hidden="true">↗</span></a></section>
    </main><Footer />
  </>;
}

export function StoryPage({ slug }: { slug: string }) {
  const story = getStory(slug);
  if (!story) notFound();
  const stories = getStories();
  const index = stories.findIndex((item) => item.slug === story.slug);
  const related = [...stories.slice(index + 1), ...stories.slice(0, index)].filter((item) => item.category === story.category).slice(0, 2);
  const next = stories[(index + 1) % stories.length];
  const hero = storyImage(story);
  const headings = story.blocks.filter((block) => block.type === "heading");
  const bodyImages = story.blocks.filter((block) => block.type === "image").map((block) => block.image);
  const additional = story.images.map((image, i) => ({ image, i })).filter(({ i }) => i !== story.hero && !bodyImages.includes(i));
  const figureOrder = [...new Set([story.hero, ...bodyImages, ...additional.map(({ i }) => i)])];
  const sourceImages = story.images.filter((image, i, all) => all.findIndex((item) => item.source === image.source) === i);
  return <>
    <Hydrated /><Chrome />
    <main id="main" data-story-reader>
      <section className="qs-story-opening">
        <div className="qs-label qs-story-breadcrumb"><a href="/stories/">Stories</a><span>/ {story.category}</span><span>[ {roman(story.id)} ]</span></div>
        <p className="qs-label qs-story-company">{story.company}</p>
        <h1>{story.headline[0]}<br /><em>{story.headline[1]}</em></h1>
        <div className="qs-story-opening__pictures">{story.images.filter((_, i) => i !== story.hero).slice(0, 2).map((image, i) => <figure className={`qs-story-scrap qs-story-scrap--${i + 1}`} key={image.src} aria-hidden="true"><img src={image.src} alt="" width={image.width} height={image.height} /><figcaption>{String(i + 1).padStart(2, "0")} / {story.company}</figcaption></figure>)}</div>
        <div className="qs-story-meta"><span>{story.minutes} minute read{story.isExcerpt ? " / excerpt" : ""}</span><a href="#reading">Begin reading <span aria-hidden="true">↓</span></a><span>Notes on {story.category.toLowerCase()}</span></div>
      </section>
      <div className="qs-reader-layout" id="reading">
        <aside className="qs-margin"><div className="qs-label"><span>From the notebook</span><span>Story {roman(story.id)}</span></div><p>{story.lesson}</p><span className="qs-margin__line" /><a className="qs-label" href="#takeaway">What we take from it <span aria-hidden="true">↘</span></a></aside>
        <article className="qs-prose" aria-label={story.title}>
          <div className="qs-label qs-prose__label"><span>{story.company}</span><span>Collected reading / {roman(story.id)}</span></div>
          {hero && <Plate image={hero} index={0} wide />}
          {story.blocks.map((block, i) => <Fragment key={i}>{block.type === "heading" ? <h2 id={block.id}><span className="qs-label">{String(story.blocks.slice(0, i + 1).filter((b) => b.type === "heading").length).padStart(2, "0")}</span>{block.text}</h2> : block.type === "image" ? <Plate image={story.images[block.image]} index={figureOrder.indexOf(block.image)} wide={block.image % 3 === 0} /> : <p className={i === 0 ? "qs-prose__lead" : undefined}>{block.text}</p>}</Fragment>)}
          {additional.length > 0 && <section className="qs-extra-images" aria-label="More of the story">{additional.map(({ image, i }) => <Plate key={image.src} image={image} index={figureOrder.indexOf(i)} />)}</section>}
          {story.isExcerpt && <p className="qs-excerpt-note">A fragment from our reading. The supplied source ends here.</p>}
          <section className="qs-takeaway" id="takeaway"><span className="qs-label">What we take from it</span><h2>{story.lesson}</h2><p>A thought to carry into the next thing we make.</p></section>
          <details className="qs-sources" id="sources"><summary>Reading & image notes <span aria-hidden="true">+</span></summary><div><p>This is a collected reading about {story.company}, presented as a lesson for our practice.</p>{story.source.url ? <a href={story.source.url} target="_blank" rel="noopener noreferrer">Read the original article ↗</a> : <p>Transcribed from the supplied screenshot collection.</p>}<p>Images and reference material:</p><ul>{sourceImages.map((image) => <li key={image.source}><a href={image.source} target="_blank" rel="noopener noreferrer">{image.credit || image.caption} ↗</a></li>)}</ul></div></details>
        </article>
      </div>
      <section className="qs-continue"><div><span className="qs-label">Keep following your curiosity</span><h2>One lesson leads<br /><em>to another.</em></h2></div><div className="qs-continue__links">{(related.length ? related : [next]).map((item) => <a href={storyUrl(item)} key={item.slug}><span className="qs-label">{item.company} / {item.minutes} min</span><h3>{item.headline.join(" ")}</h3><span aria-hidden="true">↗</span></a>)}</div></section>
    </main>
    <Footer />
    <div className="qs-reading-bar"><a href="/stories/" aria-label="Back to all stories">← <span>All stories</span></a><span className="qs-label qs-reading-bar__company">{story.company}</span><span className="qs-label" data-reading-percent aria-label="Reading progress">0%</span><details className="qs-contents"><summary>Contents <span aria-hidden="true">[ + ]</span></summary><nav aria-label="Article contents"><a href="#main">Opening</a>{headings.map((heading) => <a key={heading.id} href={`#${heading.id}`}>{heading.text}</a>)}<a href="#takeaway">What we take from it</a><a href="#sources">Reading & image notes</a></nav></details><div className="qs-progress" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} data-reading-progress><span /></div></div>
    <dialog className="qs-lightbox" aria-label="Expanded story image"><button type="button" data-image-close aria-label="Close expanded image">Close [ × ]</button><figure><img data-expanded-image alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /><figcaption data-expanded-caption /></figure></dialog>
  </>;
}
