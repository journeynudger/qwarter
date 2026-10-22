import { Echo, Footer, Header } from "@/components/site/chrome";
import { getFeatured, workMedia } from "@/lib/content";

/*
 * Work: one project at a time, the way Depo Luxe shows a film. The project's blurred frame
 * fills the screen; in focus, inside a frame, the site itself slides slowly through each of
 * its pages (the strips scripts/work/prepare.mjs made), page after page; a numeral rail on the
 * left drains with each page; the pages of the site are listed under the frame; the next and
 * previous projects are a key, a swipe or a tap away. site.js runs it; the server renders the
 * first page of the opened project, so the page is whole before any script.
 */
export function Work({ project }: { project?: string }) {
  const projects = getFeatured();
  const index = Math.max(0, projects.findIndex((p) => p.slug === project));
  const current = projects[index];
  const media = workMedia(current.slug);
  const first = current.pages[0];
  const data = {
    projects: projects.map((p) => {
      const m = workMedia(p.slug);
      return { slug: p.slug, numeral: p.numeral, name: p.name, url: p.url, line: p.line, made: p.made, year: p.year, blur: m.blur, pages: p.pages.map((pg) => ({ name: pg.name, title: pg.title, src: m.page(pg.name) })) };
    }),
    initial: index,
  };
  const prev = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];
  const host = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <Header current="/work/" />
      <div className="sky" aria-hidden="true" data-paper-shader="MeshGradient" data-paper-params='{"colors":["#050506","#0e0d11","#121015","#08090b"],"distortion":0.75,"swirl":0.3}' data-paper-speed="0.05" data-paper-opacity="0.9" data-paper-pause="off" />
      <Echo src={media.blur} />

      <main className="show" id="show">
        <div className="numeral-rail" aria-hidden="true">
          <div className="rail-seg top" id="railTop">
            <div className="rail-fill" />
          </div>
          <div className="rail-num" id="railNum">
            {current.numeral}
          </div>
          <div className="rail-seg bot" id="railBot">
            <div className="rail-fill" />
          </div>
        </div>

        <div className="show-body" id="showBody">
          <header className="show-head">
            <p className="show-kicker" id="showKicker">
              {current.line}
            </p>
            <h1 className="show-title" id="showTitle">
              {current.name}
            </h1>
          </header>

          <div className="show-frame" id="showFrame" role="img" aria-label={`${current.name}, ${first.title} page, as it is on the site`}>
            <div className="show-strip on" id="stripA">
              {/* eslint-disable-next-line @next/next/no-img-element -- the page itself, as one tall picture that slides */}
              <img src={media.page(first.name)} alt="" width={1440} decoding="async" fetchPriority="high" />
            </div>
            <div className="show-strip" id="stripB" />
          </div>

          <nav className="show-pages" id="showPages" aria-label="Pages of this site">
            {current.pages.map((pg, i) => (
              <button key={pg.name} type="button" data-page={i} className={i === 0 ? "current" : undefined} aria-current={i === 0 ? "true" : undefined}>
                {pg.title}
              </button>
            ))}
          </nav>

          <p className="show-meta">
            <a className="u" id="showVisit" href={current.url ?? "#"} target="_blank" rel="noopener" hidden={!current.url}>
              {host(current.url ?? "")} ↗
            </a>
            <span id="showMade">
              {current.made}
              {current.year ? `, ${current.year}` : ""}
            </span>
          </p>
        </div>

        <nav className="show-projects" aria-label="Projects">
          <a className="show-arrow prev" href={`/work/${prev.slug}/`} data-step="-1" aria-label={`Previous project: ${prev.name}`}>
            <span className="arrow">←</span>
            <span className="who">{prev.name}</span>
          </a>
          <a className="show-arrow next" href={`/work/${next.slug}/`} data-step="1" aria-label={`Next project: ${next.name}`}>
            <span className="who">{next.name}</span>
            <span className="arrow">→</span>
          </a>
        </nav>

        <a className="show-close" href="/" aria-label="Back to featured">
          ×
        </a>
        <button type="button" className="show-pause" id="showPause" aria-label="Pause the slideshow" aria-pressed="false" hidden>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
            <path className="ico-pause" d="M4 2h3v12H4zM9 2h3v12H9z" />
            <path className="ico-play" d="M4 2l10 6-10 6z" />
          </svg>
        </button>

        <script type="application/json" id="workData" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
      </main>
      <Footer />
    </>
  );
}
