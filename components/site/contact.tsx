import { Footer, Header } from "@/components/site/chrome";
import { getSite } from "@/lib/content";

/** Contact: the address is the page. */
export function Contact() {
  const { contact, brand } = getSite().chrome;
  return (
    <>
      <Header current="/contact/" />
      <div
        className="sky"
        aria-hidden="true"
        data-paper-shader="MeshGradient"
        data-paper-params='{"colors":["#050506","#0e0d11","#121015","#08090b"],"distortion":0.75,"swirl":0.3}'
        data-paper-speed="0.05"
        data-paper-opacity="0.9"
      />
      <main className="page contact-wrap">
        <h1 className="kicker">Contact</h1>
        <p className="big italic">
          <a className="u" href={`mailto:${contact.email}`}>
            {contact.email}
          </a>
        </p>
        <p className="row">{contact.place}</p>
        <p className="row dim">
          {brand.left} {brand.right}
        </p>
      </main>
      <Footer />
    </>
  );
}
