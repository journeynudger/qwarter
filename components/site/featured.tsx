import { Echo, Footer, Header, QMark } from "@/components/site/chrome";
import { getFeatured, getSite, workMedia } from "@/lib/content";

/*
 * Featured: the loader (once per session), then Depo Luxe's staircase. Square tiles anchored to
 * the bottom-left corner of the window: the focused one largest, the ones before it stacked
 * straight up from it, the ones after it marching right along the bottom edge, each a step
 * smaller than its neighbour nearer the focus and touching it; its numeral and name at each
 * tile's top-right corner; the focused tile's picture, blurred to a colour field, filling the
 * room behind, over the black velvet. When the strip comes to rest the focused tile plays the
 * site scrolling. site.js lays it out and moves it on scroll, keys, swipe and tap; without
 * scripts the tiles are a plain column of links to their pages.
 */
export function Featured() {
  const projects = getFeatured();
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
      <div className="sky" aria-hidden="true" data-paper-shader="MeshGradient" data-paper-params='{"colors":["#050506","#0e0d11","#121015","#08090b"],"distortion":0.75,"swirl":0.3}' data-paper-speed="0.05" data-paper-opacity="0.9" />
      <Echo src={workMedia(projects[0].slug).blur} />

      <main className="strip" id="strip" aria-label="Featured work">
        <h1 className="sr-only">Featured work</h1>
        {projects.map((p, i) => {
          const m = workMedia(p.slug);
          return (
            <a key={p.slug} className={`tile${i === 0 ? " focused" : ""}`} href={`/work/${p.slug}/`} data-index={i} data-blur={m.blur} data-video={m.video}>
              <span className="tile-media">
                {/* eslint-disable-next-line @next/next/no-img-element -- the project's own picture, sized by the strip */}
                <img src={m.tile} srcSet={`${m.tile} 1x, ${m.tile2x} 2x`} alt={`${p.name} — ${p.line}`} width={900} height={900} decoding="async" fetchPriority={i === 0 ? "high" : "low"} />
                <video className="tile-video" muted loop playsInline preload="none" poster={m.tile} aria-hidden="true" tabIndex={-1} />
              </span>
              <span className="tile-label">
                <span className="num">{p.numeral}</span>
                <span className="name">{p.name}</span>
              </span>
            </a>
          );
        })}
      </main>
      <Footer />
    </>
  );
}
