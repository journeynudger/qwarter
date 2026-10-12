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
  return (
    // the design's own scripts add classes to <html> and <body> before React hydrates
    <html lang={site.lang} {...props(page?.html ?? {})} suppressHydrationWarning>
      <head>
        <Assets list={site.head} />
        {page && <Assets list={page.head} />}
        {/* ours, after the design's own: the Paper shader surfaces and paper stock */}
        <link rel="stylesheet" href={versioned("/design/qwarter/paper.css")} />
      </head>
      <body {...props(page?.body ?? {})} suppressHydrationWarning>
        {children}
        <Assets list={site.scripts} />
        {page && <Assets list={page.scripts} />}
        <PaperShaders />
      </body>
    </html>
  );
}
