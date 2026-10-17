import { Footer, Header } from "@/components/site/chrome";
import { getProjects, getSite } from "@/lib/content";

/*
 * Approach: the studio's own words, set large, over a Paper shader breathing in the dark
 * (the same four near-blacks the site is made of; it never gets light enough to touch the
 * text's contrast), then the facts of the company and an index of the work.
 */
export function Approach() {
  const { statement, facts } = getSite().chrome;
  const projects = getProjects();
  return (
    <>
      <Header current="/approach/" />
      <div
        className="sky"
        aria-hidden="true"
        data-paper-shader="MeshGradient"
        data-paper-params='{"colors":["#0b0b0c","#17141a","#0d1216","#1a1613"],"distortion":0.7,"swirl":0.25}'
        data-paper-speed="0.06"
        data-paper-opacity="0.75"
      />
      <main className="page approach">
        <section className="statement" aria-labelledby="approachTitle">
          <h1 id="approachTitle" className="kicker">
            Approach
          </h1>
          <p className="big italic">{statement[0]}</p>
          <p className="big">{statement[1]}</p>
        </section>

        <dl className="facts">
          {facts.map((f) => (
            <div key={f.label} className="fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        <section className="index" aria-labelledby="indexTitle">
          <h2 id="indexTitle" className="kicker">
            Work
          </h2>
          <ol className="index-list">
            {projects.map((p) => (
              <li key={p.slug}>
                <a href={`/work/${p.slug}/`}>
                  <span className="num">{p.numeral}</span>
                  <span className="name">{p.name}</span>
                  <span className="line">{p.line}</span>
                  <span className="made">
                    {p.made}, {p.year}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Footer flow />
    </>
  );
}
