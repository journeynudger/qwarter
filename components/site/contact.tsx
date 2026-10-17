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
        data-paper-params='{"colors":["#0b0b0c","#121419","#191417","#0e1311"],"distortion":0.55,"swirl":0.35}'
        data-paper-speed="0.05"
        data-paper-opacity="0.7"
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
