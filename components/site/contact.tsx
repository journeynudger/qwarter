import { Footer, Header } from "@/components/site/chrome";
import { getSite } from "@/lib/content";

export function Contact() {
  const { contact } = getSite().chrome;
  return (
    <>
      <Header current="/contact/" />
      <main className="page contact-wrap">
        <section className="contact-panel" aria-labelledby="contact-title">
          <h1 id="contact-title">Let’s talk.</h1>
          <form id="contact-form" action="/api/contact" method="post">
            <label htmlFor="contact-name">Your name</label>
            <input id="contact-name" name="name" autoComplete="name" maxLength={120} required />
            <label htmlFor="contact-email">Email address</label>
            <input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} required />
            <label htmlFor="contact-message">What do you have in mind?</label>
            <textarea id="contact-message" name="message" rows={4} minLength={10} maxLength={6000} required />
            <div className="contact-trap" aria-hidden="true">
              <label htmlFor="contact-website">Leave this empty</label>
              <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <button type="submit" className="contact-send" disabled>Send enquiry <span aria-hidden="true">↗</span></button>
            <p id="contact-status" role="status" aria-live="polite" />
            <noscript><p>Please enable JavaScript to send the form, or email us below.</p></noscript>
          </form>
          <p className="contact-direct">Or write to <a className="u" href={`mailto:${contact.email}`}>{contact.email}</a></p>
          <nav className="contact-social" aria-label="Social links">
            {contact.social?.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></a>)}
          </nav>
        </section>
      </main>
      <Footer flow />
    </>
  );
}
