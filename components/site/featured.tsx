import { Echo, Footer, Header, QMark } from "@/components/site/chrome";
import { getProjects, getSite, workMedia } from "@/lib/content";

/*
 * Featured: the loader (once per session), then the work as a film strip under a fisheye
 * (Depo Luxe's home): the focused project large, the previous ones stacked above it and the
 * next ones off to its right, each a step smaller, with the focused project's blurred image
 * behind everything. site.js lays the strip out and moves it on scroll, keys, swipe and tap;
 * without it the projects are a plain list of links to their pages.
 */
export function Featured() {
  const projects = getProjects();
  const word = getSite().name;
  return (
    <>
      <div id="loader" aria-hidden="true">
        <div className="loader-stage">
          <QMark className="loader-mark" />
          <div className="loader-word">
            {[...word].map((ch, i) => (
              <span key={i} className="lw serif">
                {ch}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Header current="/" />
      <Echo src={workMedia(projects[0].slug).blur} />

      <main className="reel" id="reel" aria-label="Featured work">
        <h1 className="sr-only">Featured work</h1>
        <ol className="reel-rail" aria-label="Projects">
          {projects.map((p, i) => (
            <li key={p.slug}>
              <button type="button" data-go={i} aria-label={`Project ${p.numeral}, ${p.name}`} className={i === 0 ? "current" : undefined}>
                {p.numeral}
              </button>
            </li>
          ))}
        </ol>
        <div className="reel-stage" id="reelStage">
          {projects.map((p, i) => {
            const m = workMedia(p.slug);
            return (
              <a key={p.slug} className={`reel-item${i === 0 ? " focused" : ""}`} href={`/work/${p.slug}/`} data-index={i} data-blur={m.blur}>
                <span className="reel-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the project's own picture, sized by the strip */}
                  <img src={m.cover} srcSet={`${m.cover} 1x, ${m.cover2x} 2x`} alt={`${p.name} — ${p.line}`} width={1440} height={900} decoding="async" fetchPriority={i === 0 ? "high" : "low"} />
                </span>
                <span className="reel-label">
                  <span className="num">{p.numeral}</span>
                  <span className="name">{p.name}</span>
                  <span className="line">{p.line}</span>
                </span>
              </a>
            );
          })}
        </div>
      </main>
      <Footer />
    </>
  );
}
