import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Assets } from "@/components/layout/assets";
import { PaperShaders } from "@/components/paper/paper-shaders";
import { versioned } from "@/lib/assets";
import { getSite, resolveRoute } from "@/lib/content";
import { reactProps } from "@/lib/html";

/*
 * The root layout lives inside the catch-all so it knows which page it wraps:
 * the reference design prints different <html>/<body> attributes and assets
 * per page, and its CSS and scripts depend on them.
 */

const site = getSite();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || site.origin),
  icons: site.icons.map((i) => ({ rel: i.rel, url: i.href, sizes: i.sizes, type: i.type })),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const props = (attrs: Record<string, string>) => reactProps(Object.entries(attrs));

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const route = resolveRoute(path);
  const page = route.kind === "page" ? route.page : null;
  // a carried page (built on the reference design's) brings its own stylesheet and scripts and takes none of
  // ours: the two designs must not meet in one document
  const carried = Boolean(page?.template);
  // a case study (components/study/) brings its own stylesheet and script as well; it takes the site-wide ones of neither design
  const own = carried || page?.kind === "study" || page?.kind === "stories" || page?.kind === "story" || page?.kind === "archive";
  return (
    // the design's own scripts add classes to <html> and <body> before React hydrates
    <html lang={site.lang} {...props(page?.html ?? {})} suppressHydrationWarning>
      <head>
        <Assets list={[{ kind: "script", src: "/design/qwarter/visit.js" }]} />
        {!own && <Assets list={site.head} />}
        {page && <Assets list={page.head} />}
        <Assets list={[{ kind: "stylesheet", href: "/design/qwarter/refinements.css" }]} />
        {/* the Paper shader surfaces and paper stock, after the site's own stylesheet */}
        {!own && <link rel="stylesheet" href={versioned("/design/qwarter/paper.css")} />}
      </head>
      {/* a carried page's script reads data-page itself (from its article), so the body carries only its own attributes */}
      <body data-page={carried ? undefined : (page?.kind ?? "not-found")} {...props(page?.body ?? {})} suppressHydrationWarning>
        {children}
        {!own && <Assets list={site.scripts} />}
        {page && <Assets list={page.scripts} />}
        {!own && <PaperShaders />}
      </body>
    </html>
  );
}
