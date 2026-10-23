/* eslint-disable @next/next/no-img-element -- the study's stills are served as they are, at the sizes the recordings share; next/image would wrap and restyle them */
import { Hydrated } from "@/components/study/hydrated";
import type { CSSProperties, ReactNode } from "react";

import { QMark } from "@/components/site/chrome";
import { getFeatured, getSite, workMedia } from "@/lib/content";
import { firstSentence, getStudies, getStudy, type Study, type StudyMedia, type StudyStep, type StudyTile } from "@/lib/studies";

/*
 * A case study, in the manner of the Valerin site's project pages (which Lorenzo designed after Mouthwash's
 * and asked for here): the name and a line about what was made, the facts in one row, the film, one
 * sentence set large with its figures under it and the overview behind "Read more", the identity as a
 * mosaic, the site playing on a desktop, each design decision as the screen it shaped with its reasoning a
 * "+" away, the gallery, a line from the site itself, and the close. Set in Depo Luxe's language (black,
 * EB Garamond) so it belongs beside the carried pages. Everything is rendered on the server; study.js adds
 * the motion (reveals, the sheets, the gallery's drag, the films playing in view), and without it every
 * word and picture is on the page, the notes open as <details>.
 */

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Relative luminance of #RRGGBB (WCAG 2.1), for the label on a colour band. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (hex: string) => (luminance(hex) > 0.4 ? "#111111" : "#ffffff");
/** A face and what stands in for it: a serif falls through the page's own EB Garamond before the browser's. */
const stack = (family: string, fallback?: string) => `"${family}", ${fallback === "serif" || !fallback ? '"EB Garamond", serif' : fallback}`;

/**
 * A silent film: `muted` written as an attribute (React drops it from server markup, and a phone will not
 * play inline without it), H.264 first and VP9 for a browser without it, its poster until it plays, and
 * its own pause (every film runs longer than five seconds, WCAG 2.2.2).
 */
function Film({ media, pill = "corner", className }: { media: StudyMedia; pill?: "corner" | "center" | "icon"; className?: string }) {
  const video = `<video muted loop playsinline preload="metadata" poster="${media.poster}" aria-label="${media.alt.replace(/"/g, "&quot;")}"><source src="${media.src}" type="video/mp4">${media.webm ? `<source src="${media.webm}" type="video/webm">` : ""}</video>`;
  return (
    <div className={`st-video${className ? ` ${className}` : ""}`} data-video>
      <div dangerouslySetInnerHTML={{ __html: video }} />
      <button type="button" className={`st-pill st-pill--${pill}`} data-toggle aria-pressed="false">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path className="st-pill__play" d="M7 4.5v15l12.5-7.5z" /><g className="st-pill__pause"><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></g></svg>
        <span className={pill === "icon" ? "sr" : undefined} data-label>Play</span>
        <span className="sr">: {media.alt}</span>
      </button>
    </div>
  );
}

/** A browser with the address the site lives at; the screenshot or film inside it is real. */
function Browser({ address, children, className }: { address: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`st-browser${className ? ` ${className}` : ""}`}>
      <div className="st-browser__bar" aria-hidden="true">
        <i /><i /><i />
        <span className="st-browser__address">{address || " "}</span>
      </div>
      <div className="st-browser__screen">{children}</div>
    </figure>
  );
}

function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <figure className={`st-phone${className ? ` ${className}` : ""}`}>
      <div className="st-phone__screen">{children}</div>
    </figure>
  );
}

/** The sheet behind a "+": a <details> on the page, which study.js lifts into a dialog. */
function More({ label, title, body, summary = "+", ariaLabel }: { label: string; title: string; body: ReactNode; summary?: ReactNode; ariaLabel?: string }) {
  return (
    <details className="st-more">
      <summary aria-label={ariaLabel ?? `Read more: ${title}`}>{summary}</summary>
      <div className="st-sheet" data-sheet>
        <p className="st-annot">{label}</p>
        <h3 className="st-sheet__title">{title}</h3>
        <div className="st-sheet__body">{body}</div>
      </div>
    </details>
  );
}

/** One design decision: the screen it shaped, its name and first sentence, and the whole note a "+" away. */
function Note({ study, step, index, className }: { study: Study; step: StudyStep; index: number; className?: string }) {
  const rec = step.recording ? study.recordings[step.recording] : undefined;
  const device = rec ? step.recording! : step.device;
  const lead = firstSentence(step.body);
  const rest = step.body.length > lead.length;
  const screen = rec ? <Film media={rec} pill="icon" /> : step.image ? <img src={step.image} alt={step.alt ?? ""} loading="lazy" decoding="async" /> : null;
  return (
    <figure className={`st-case st-case--${device} reveal${className ? ` ${className}` : ""}`}>
      <div className="st-case__stage" data-parallax>
        {device === "phone" ? <Phone>{screen}</Phone> : device === "picture" ? <div className="st-picture">{screen}</div> : <Browser address={study.address}>{screen}</Browser>}
      </div>
      <figcaption className="st-note">
        <span className="st-note__text">
          <span className="st-annot"><span aria-hidden="true">{String(index).padStart(2, "0")} · </span>{step.title}</span>
          <span className="st-note__lead">{lead}</span>
        </span>
        {rest ? <More label="Design note" title={step.title} body={<p>{step.body}</p>} ariaLabel={`Read the note: ${step.title}`} /> : null}
      </figcaption>
    </figure>
  );
}

/** A tile of the identity mosaic: the logo or wordmark on its own ground, the colours as bands, the type, one detail. */
function Tile({ tile, index, name }: { tile: StudyTile; index: number; name: string }) {
  const span = [7, 5, 5, 7][index % 4];
  const row = index < 2 ? "st-tile--tall" : "st-tile--low";
  const style = { "--ground": tile.ground ?? "#0f0f10", "--span": span } as CSSProperties;
  let stage: ReactNode = null;
  if (tile.key === "palette" && tile.colors) {
    stage = (
      <ul className="st-swatches" aria-label="Colours">
        {tile.colors.map((c, i) => (
          <li key={c.hex + i} style={{ background: c.hex, color: onColor(c.hex), "--i": i } as CSSProperties}>
            <span className="st-swatch__name">{c.name ?? c.role ?? ""}{c.name && c.role ? <span className="st-swatch__role"> {c.role}</span> : null}</span>
            <span className="st-annot st-swatch__hex" style={{ color: "inherit" }}>{c.hex.toUpperCase()}</span>
          </li>
        ))}
      </ul>
    );
  } else if (tile.key === "type" && tile.faces) {
    stage = (
      <div className="st-type">
        {tile.faces.map((f) => (
          <div className="st-face" key={f.role + f.family}>
            <p className="st-face__glyph" aria-hidden="true" style={{ fontFamily: stack(f.family, f.fallback), fontWeight: f.weight?.split(",")[0].trim().replace(/[^0-9]/g, "") || 400 }}>Aa</p>
            <div className="st-face__text">
              <p className="st-face__name">{f.family}</p>
              <p className="st-annot">{f.role}{f.weight ? ` · ${f.weight}` : ""}</p>
              <p className="st-face__sample" style={{ fontFamily: stack(f.family, f.fallback) }}>{f.sample ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789"}</p>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (tile.wordmark) {
    const w = tile.wordmark;
    const parts = w.parts ?? [{ text: w.text, family: w.family, weight: w.weight, italic: w.italic }];
    stage = (
      <p className="st-wordmark" style={{ color: w.color, letterSpacing: w.letterSpacing, textTransform: w.transform as CSSProperties["textTransform"] }}>
        {parts.map((p, i) => (
          <span key={i} style={{ fontFamily: stack(p.family, p.fallback), fontWeight: p.weight, fontStyle: p.italic ? "italic" : undefined }}>{p.text}</span>
        ))}
      </p>
    );
  } else if (tile.image) {
    stage = <img className={`st-tile__img st-tile__img--${tile.fit ?? "contain"}`} src={tile.image} alt={tile.alt ?? ""} loading="lazy" decoding="async" />;
  }
  return (
    <figure className={`st-tile st-tile--${tile.key} ${row} reveal${tile.dark ? " st-tile--dark" : ""}`} style={style}>
      <div className="st-tile__stage">{stage}</div>
      <figcaption className="st-tile__caption">
        <span className="st-annot">{tile.label}</span>
        <More label={name} title={tile.label} body={<p>{tile.note}</p>} ariaLabel={`About the ${tile.label.toLowerCase()}`} />
      </figcaption>
    </figure>
  );
}

function Gallery({ study }: { study: Study }) {
  if (!study.gallery.length) return null;
  return (
    <figure className="st-gallery-figure reveal">
      <section className="st-gallery" data-gallery aria-roledescription="carousel" aria-label={`${study.shortName}, pictures`}>
        <div className="st-gallery__window">
          <div className="st-gallery__track">
            {study.gallery.map((g, i) => (
              <div className="st-slide" key={g.src} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${study.gallery.length}`}>
                <img src={g.src} alt={g.alt} loading="lazy" decoding="async" draggable={false} />
              </div>
            ))}
          </div>
        </div>
        <button type="button" className="st-gallery__arrow st-gallery__arrow--prev" data-dir="-1" aria-label="Previous picture"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg></button>
        <button type="button" className="st-gallery__arrow st-gallery__arrow--next" data-dir="1" aria-label="Next picture"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg></button>
        <div className="st-notches" role="group" aria-label="Pictures">
          {study.gallery.map((g, i) => (
            <button type="button" key={g.src} data-notch={i} aria-label={`Show picture ${i + 1} of ${study.gallery.length}`} aria-current={i === 0 ? "true" : undefined} tabIndex={i === 0 ? 0 : -1}><span aria-hidden="true" /></button>
          ))}
        </div>
      </section>
      {study.galleryNote ? <figcaption className="st-gallery__note">{study.galleryNote}</figcaption> : null}
    </figure>
  );
}

/** The next project, on the two screens it was built for, as the way into its study. */
function Scene({ study, label }: { study: Study; label: string }) {
  const d = study.recordings.desktop, p = study.recordings.phone;
  return (
    <article className="st-scene">
      <p className="st-annot">{label}</p>
      <div className="st-scene__stage">
        <Browser address={study.address} className="st-scene__browser">{d ? <Film media={d} pill="icon" /> : <img src={workMedia(study.slug).cover} alt="" loading="lazy" />}</Browser>
        {p ? <Phone className="st-scene__phone"><Film media={p} pill="icon" /></Phone> : null}
      </div>
      <h2 className="st-scene__title"><a href={`/work/${study.slug}/`}>{study.shortName} <span aria-hidden="true">→</span></a></h2>
    </article>
  );
}

export function StudyPage({ slug }: { slug: string }) {
  const study = getStudy(slug);
  if (!study) return null;
  const site = getSite();
  const { brand, nav, footer, contact } = site.chrome;
  const project = getFeatured().find((p) => p.slug === slug);
  const numeral = project?.numeral ?? "";
  const studied = getStudies();
  const order = getFeatured().map((p) => p.slug).filter((s) => studied.some((x) => x.slug === s));
  const next = order.length > 1 ? getStudy(order[(order.indexOf(slug) + 1) % order.length]) : undefined;
  const [lead, ...notes] = study.steps;
  const pairs: StudyStep[][] = [];
  for (let i = 0; i < notes.length; i += 2) pairs.push(notes.slice(i, i + 2));
  const facts = [
    { label: "Client", value: study.client },
    { label: "Year", value: study.year ?? "" },
    { label: "Made", value: study.role.join(" · ") },
    { label: "Status", value: study.status },
  ].filter((f) => f.value);
  const sections = [
    { id: "film", name: "The film" },
    { id: "statement", name: "In one line" },
    { id: "identity", name: "Identity" },
    { id: "desktop", name: "On a desktop" },
    { id: "notes", name: "Screen by screen" },
    { id: "close", name: "See it" },
  ];
  const film = study.film ?? { src: workMedia(slug).video, webm: workMedia(slug).videoWebm, poster: workMedia(slug).poster, alt: `${study.name}'s film.` };
  return (
    <>
      <header className="st-top">
        <a className="st-mark" href="/" aria-label={`${brand.left}, home`}><QMark className="st-mark__svg" /></a>
        <nav className="st-nav" aria-label="Site">
          {nav.map((item) => (
            <a key={item.href} href={item.href} aria-current={item.href === "/work/" ? "page" : undefined}>{item.label}</a>
          ))}
        </nav>
      </header>
      <nav className="st-rail" aria-label="On this page">
        <ol>
          {sections.map((s, i) => (
            <li key={s.id}><a href={`#${s.id}`} data-rail={s.id}><span className="st-rail__num">{ROMAN[i]}</span><span className="st-rail__name">{s.name}</span></a></li>
          ))}
        </ol>
      </nav>
      <main className="study" id="main">
        <article>
          <header className="st-open">
            <a className="st-back" href="/work/"><span aria-hidden="true">←</span> Portfolio</a>
            {numeral ? <p className="st-numeral" aria-label={`Project ${numeral}`}>{numeral}</p> : null}
            <h1 className="st-title">
              <span className="st-line"><span>{study.shortName},</span></span>
              <span className="st-line st-line--tag"><span>{study.tagline}</span></span>
            </h1>
            <dl className="st-facts">
              {facts.map((f, i) => (
                <div key={f.label} className="reveal" style={{ "--d": `${0.5 + i * 0.08}s` } as CSSProperties}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <section className="st-film reveal" id="film" aria-label="The film" style={{ "--d": "0.7s" } as CSSProperties}>
            <Film media={film} pill="center" className="st-video--film" />
          </section>

          <section className="st-statement" id="statement">
            <p className="st-say reveal">{study.statement}</p>
            <div className="reveal" style={{ "--d": "0.15s" } as CSSProperties}>
              <More label="Project overview" title={study.name} summary={<>Read more <span aria-hidden="true">+</span></>} body={<><p>{study.summary}</p>{study.brief ? <p className="st-sheet__brief">{study.brief}</p> : null}</>} ariaLabel={`Read more about ${study.name}`} />
            </div>
            {study.figures.length ? (
              <dl className="st-figures">
                {study.figures.map((f, i) => (
                  <div key={f.label} className="reveal" style={{ "--d": `${0.1 + i * 0.1}s` } as CSSProperties}>
                    <dd data-count={/^\d+$/.test(f.value) ? f.value : undefined}>{f.value}</dd>
                    <dt>{f.label}</dt>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>

          {study.identity.length ? (
            <section className="st-identity" id="identity" aria-label="Identity">
              <div className="st-mosaic">
                {study.identity.slice(0, 4).map((t, i) => <Tile key={t.key + i} tile={t} index={i} name={study.shortName} />)}
              </div>
            </section>
          ) : null}

          <section className="st-desktop" id="desktop" aria-label="The site on a desktop">
            <div className="st-desktop__inner">
              <Browser address={study.address} className="st-browser--hero reveal">
                {study.recordings.desktop ? <Film media={study.recordings.desktop} pill="icon" /> : lead?.image ? <img src={lead.image} alt={lead.alt ?? ""} /> : null}
              </Browser>
              {lead ? (
                <div className="st-note st-note--lead reveal" style={{ "--d": "0.2s" } as CSSProperties}>
                  <span className="st-note__text">
                    <span className="st-annot"><span aria-hidden="true">01 · </span>{lead.title}</span>
                    <span className="st-note__lead">{firstSentence(lead.body)}</span>
                  </span>
                  {lead.body.length > firstSentence(lead.body).length ? <More label="Design note" title={lead.title} body={<p>{lead.body}</p>} ariaLabel={`Read the note: ${lead.title}`} /> : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="st-notes" id="notes" aria-label="Design notes">
            {pairs.map((pair, p) => (
              <div className="st-pairs" key={p}>
                <div className={`st-pair${pair.length === 1 ? " st-pair--one" : ""}`}>
                  {pair.map((step, i) => (
                    <Note key={step.title} study={study} step={step} index={2 + p * 2 + i} className={pair.length === 1 ? "st-case--wide" : (p + i) % 2 === 0 ? "st-case--seven" : "st-case--five"} />
                  ))}
                </div>
                {p === 0 ? <Gallery study={study} /> : null}
                {p === 0 && study.quote && pairs.length > 1 ? (
                  <figure className="st-quote reveal">
                    <blockquote><p>“{study.quote.text}”</p></blockquote>
                    <figcaption className="st-annot">{study.quote.source}</figcaption>
                  </figure>
                ) : null}
              </div>
            ))}
            {pairs.length <= 1 && study.quote ? (
              <figure className="st-quote reveal">
                <blockquote><p>“{study.quote.text}”</p></blockquote>
                <figcaption className="st-annot">{study.quote.source}</figcaption>
              </figure>
            ) : null}
          </section>

          <section className="st-close" id="close">
            <div className="st-close__row reveal">
              <div>
                <p className="st-annot">{study.status}</p>
                <h2 className="st-close__title">{study.url ? <>See it for <em>yourself.</em></> : <>Want one <em>like it?</em></>}</h2>
              </div>
              <div className="st-close__actions">
                {study.url ? <a className="st-button st-button--solid st-magnet" href={study.url} rel="noopener" target="_blank">Visit {study.address}</a> : null}
                <a className={`st-button st-magnet${study.url ? "" : " st-button--solid"}`} href="/contact/">Start a project with {brand.left}</a>
              </div>
            </div>
            {next ? <div className="st-next reveal"><Scene study={next} label="Next project" /></div> : null}
          </section>
        </article>
      </main>
      <footer className="st-foot">
        <ul className="st-foot__social" aria-label="Follow Qwarter">
          {(contact.social ?? []).map((s) => <li key={s.href}><a href={s.href} rel="noopener" target="_blank">{s.label}</a></li>)}
        </ul>
        <p className="st-foot__line">{footer}</p>
      </footer>
      <Hydrated />
      <dialog className="st-dialog" data-dialog aria-label="Note">
        <div className="st-dialog__card">
          <button type="button" className="st-dialog__close" data-close aria-label="Close"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          <div className="st-dialog__body" data-dialog-body />
        </div>
      </dialog>
    </>
  );
}
