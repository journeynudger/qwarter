/* eslint-disable @next/next/no-img-element -- the artist's paintings, shown whole */
import { Chrome, Footer, Icon } from "@/components/stories/stories";
import { Hydrated } from "@/components/study/hydrated";
import { versioned } from "@/lib/assets";
import { getStudy } from "@/lib/studies";

export function Paintings() {
  const gallery = getStudy("bambino")!;
  return <><Hydrated /><Chrome current="/work/" />
    <main className="qp qp-paintings" id="main">
      <header className="qp-opening"><a className="qs-label qp-back" href="/work/">Portfolio <Icon kind="left" /></a><h1>Paintings.</h1><div><p>An art gallery by<br />Lorenzo Scardicchio.</p><a className="qp-gallery-link" href={gallery.url} target="_blank" rel="noopener noreferrer">Enter the gallery <Icon /></a></div></header>
      <figure className="qp-painting-film"><video muted controls playsInline preload="metadata" poster={versioned(gallery.film!.poster)} aria-label={gallery.film!.alt}><source src={versioned(gallery.film!.src)} type="video/mp4" /><source src={versioned(gallery.film!.webm!)} type="video/webm" /></video><figcaption className="qs-label">{gallery.gallery.length} paintings / Lorenzo Scardicchio</figcaption></figure>
      <section className="qp-art-grid" aria-label="Paintings">{gallery.gallery.map((painting,index) => <figure key={painting.src}>
        <a href={painting.src} data-story-image aria-label={`Enlarge: ${painting.alt}`}><img src={painting.src} alt={painting.alt} width="1200" height="1200" loading="lazy" /><span className="qs-enlarge"><Icon kind="plus" /></span></a>
        <figcaption><span className="qs-label">{String(index+1).padStart(2,"0")}</span><p>{painting.alt}<small>Painting by Lorenzo Scardicchio</small></p></figcaption>
      </figure>)}</section>
      <section className="qp-close"><h2>A wall of paintings.<br />A little room to look.</h2><a href={gallery.url} target="_blank" rel="noopener noreferrer">Explore the original gallery <Icon /></a></section>
    </main><Footer />
    <dialog className="qs-lightbox" aria-label="Expanded painting"><button type="button" data-image-close aria-label="Close expanded painting">Close <Icon kind="close" /></button><figure><img data-expanded-image alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /><figcaption data-expanded-caption /></figure></dialog>
  </>;
}
