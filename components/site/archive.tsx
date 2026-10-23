/* eslint-disable @next/next/no-img-element -- full-frame project previews with intrinsic dimensions */
import { Chrome, Footer, Icon } from "@/components/stories/stories";
import { Hydrated } from "@/components/study/hydrated";
import { getProjects, workMedia } from "@/lib/content";

export function Archive() {
  const projects = getProjects();
  return <>
    <Hydrated /><Chrome current="/work/" /><nav className="qw-view-switch" aria-label="Portfolio view"><a href="/work/">Portfolio</a><a href="/work/library/" aria-current="page">Library</a></nav>
    <main className="qp" id="main">
      <header className="qp-opening"><p className="qs-label">Qwarter / Selected work</p><h1>Portfolio.</h1><div><p>Websites, identities, and things<br />we put into the world.</p><span className="qs-label">{projects.length} projects</span></div></header>
      <ol className="qp-grid">{projects.map(project => <li key={project.slug}>
        <a className="qp-card" href={`/work/${project.slug}/`}>
          <figure><img src={workMedia(project.slug).cover2x} alt={project.slug === "bambino" ? "A painting by Lorenzo Scardicchio" : `${project.name}, full website preview`} width="1440" height="900" loading="lazy" decoding="async" />{["butter", "jr-pugh", "tima"].includes(project.slug) && <video data-portfolio-preview muted loop playsInline preload="metadata" poster={workMedia(project.slug).cover2x} aria-label={`${project.name}’s original homepage film`}><source src={workMedia(project.slug).video} type="video/mp4" /></video>}<span className="qp-card__arrow"><Icon /></span></figure>
          <div className="qp-card__meta"><span className="qs-label">{project.numeral} / {project.made}</span><span className="qs-label">{project.year}</span></div>
          <h2>{project.name}</h2><p>{project.line}</p>
        </a>
      </li>)}</ol>
      <section className="qp-close"><h2>Something in mind?</h2><a href="/contact/">Let’s make it happen <Icon /></a></section>
    </main><Footer />
  </>;
}
