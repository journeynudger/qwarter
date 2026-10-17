import { Footer, Header } from "@/components/site/chrome";
import { getSite } from "@/lib/content";

export default function NotFound() {
  const { nav } = getSite().chrome;
  return (
    <>
      <Header current="" />
      <main className="page contact-wrap not-found">
        <h1 className="kicker">404</h1>
        <p className="big italic">There is no page at this address.</p>
        <p className="row">
          <a className="u" href={nav[0].href}>
            {nav[0].label}
          </a>
        </p>
      </main>
      <Footer />
    </>
  );
}
