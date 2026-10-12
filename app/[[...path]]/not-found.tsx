import { getNotFoundHtml, getSite } from "@/lib/content";
import { renderMarkup } from "@/lib/html";

/** The design's own 404 page once it is carried across (content/not-found.html); a plain one until then. */
export default function NotFound() {
  const html = getNotFoundHtml();
  if (html) return renderMarkup(html);
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "20vh 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 32, fontWeight: 500, margin: 0 }}>Page not found</h1>
      <p style={{ marginTop: 16 }}>
        <a href="/">Go to {getSite().name}</a>
      </p>
    </main>
  );
}
