import { Footer, Header } from "@/components/site/chrome";
import { getSite } from "@/lib/content";

/*
 * Approach: the studio's own words, set large, over the black velvet (a Paper shader of four
 * near-blacks; it never gets light enough to touch the text's contrast); then what qwarter.com
 * says of itself (its welcome, the team, its questions and answers, verbatim), and the facts.
 */
export function Approach() {
  const { statement, facts, about } = getSite().chrome;
  return (
    <>
      <Header current="/approach/" />
      <div
        className="sky"
        aria-hidden="true"
        data-paper-shader="MeshGradient"
        data-paper-params='{"colors":["#050506","#0e0d11","#121015","#08090b"],"distortion":0.75,"swirl":0.3}'
        data-paper-speed="0.05"
        data-paper-opacity="0.9"
      />
      <main className="page approach">
        <section className="statement" aria-labelledby="approachTitle">
          <h1 id="approachTitle" className="kicker">
            Approach
          </h1>
          <p className="big italic">{statement[0]}</p>
          <p className="big">{statement[1]}</p>
        </section>

        {about && (
          <section className="about" aria-label="The studio">
            <p className="kicker">{about.hero}</p>
            <p className="prose">{about.welcome}</p>
            <h2 className="kicker">Team</h2>
            <ul className="team">
              {about.team.map((m) => (
                <li key={m.name}>
                  <span className="name">{m.name}</span>
                  <span className="role">{m.role}</span>
                </li>
              ))}
            </ul>
            <h2 className="kicker">Questions</h2>
            <dl className="faq">
              {about.faq.map((f) => (
                <div key={f.q} className="qa">
                  <dt>{f.q}</dt>
                  <dd>
                    {f.a.length > 3 && f.a.every((l) => l.length < 40) ? (
                      <ul className="plain">
                        {f.a.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    ) : (
                      f.a.map((l, i) => (
                        <p key={i} className={/^STEP \d/.test(l) ? "step" : undefined}>
                          {l}
                        </p>
                      ))
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <dl className="facts">
          {facts.map((f) => (
            <div key={f.label} className="fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        <p className="more">
          <a className="u" href="/work/">
            The work →
          </a>
        </p>
      </main>
      <Footer flow />
    </>
  );
}
