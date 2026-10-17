import { Footer, Header } from "@/components/site/chrome";
import { getProjects, workMedia } from "@/lib/content";

/*
 * Work: everything, in order. A project photographed from its own site opens in the viewer and
 * shows its square frame; a project from qwarter.com's catalogue whose pictures are not here yet
 * is listed with its line and what was made, and joins the strip the day its pictures arrive.
 */
export function Archive() {
  const projects = getProjects();
  const host = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <>
      <Header current="/work/" />
      <div className="sky" aria-hidden="true" data-paper-shader="MeshGradient" data-paper-params='{"colors":["#050506","#0e0d11","#121015","#08090b"],"distortion":0.75,"swirl":0.3}' data-paper-speed="0.05" data-paper-opacity="0.9" />
      <main className="page archive">
        <h1 className="kicker">
          Work <span className="count">{projects.length}</span>
        </h1>
        <ol className="archive-list">
          {projects.map((p) => {
            const row = (
              <>
                <span className="num">{p.numeral}</span>
                {p.media !== false ? (
                  <span className="thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the project's own frame */}
                    <img src={workMedia(p.slug).tile} alt="" width={900} height={900} loading="lazy" decoding="async" />
                  </span>
                ) : (
                  <span className="thumb empty" aria-hidden="true" />
                )}
                <span className="name">{p.name}</span>
                <span className="line">{p.line}</span>
                <span className="made">
                  {p.made}
                  {p.year ? `, ${p.year}` : ""}
                </span>
                <span className="site">{p.url ? host(p.url) : ""}</span>
              </>
            );
            return (
              <li key={p.slug} className={p.media === false ? "catalogue" : undefined}>
                {p.media !== false ? <a href={`/work/${p.slug}/`}>{row}</a> : <div>{row}</div>}
              </li>
            );
          })}
        </ol>
      </main>
      <Footer flow />
    </>
  );
}
