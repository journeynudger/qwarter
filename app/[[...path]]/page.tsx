import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Approach } from "@/components/site/approach";
import { Archive } from "@/components/site/archive";
import { Contact } from "@/components/site/contact";
import { Featured } from "@/components/site/featured";
import { Work } from "@/components/site/work";
import { allPaths, getPageHtml, getSite, resolveRoute } from "@/lib/content";
import { renderMarkup } from "@/lib/html";
import { indexingAllowed } from "@/lib/seo";

type Params = Promise<{ path?: string[] }>;

/*
 * Every page is pre-rendered (generateStaticParams); a path that is not one of them is still
 * answered by this route, so that notFound() renders the site's own not-found.tsx inside the
 * layout (with dynamicParams = false Next answers with its bare default 404 page instead).
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return allPaths().map((path) => ({ path }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { path } = await params;
  const route = resolveRoute(path);
  if (route.kind !== "page") return { title: { absolute: `Page not found – ${getSite().name}` }, robots: { index: false } };
  const { page } = route;
  const index = indexingAllowed() && !page.noindex;
  return {
    title: { absolute: page.title },
    description: page.description ?? undefined,
    alternates: { canonical: page.path },
    robots: index ? { index: true, follow: true, "max-image-preview": "large" } : { index: false, follow: false },
    openGraph: {
      title: page.title,
      description: page.description ?? undefined,
      url: page.path,
      siteName: getSite().name,
      images: page.image ? [page.image] : undefined,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { path } = await params;
  const route = resolveRoute(path);
  if (route.kind !== "page") notFound();
  const { page } = route;
  switch (page.kind) {
    case "featured":
      return <Featured />;
    case "archive":
      return <Archive />;
    case "work":
      return <Work project={page.project} />;
    case "approach":
      return <Approach />;
    case "contact":
      return <Contact />;
    default:
      // a carried page: its own elements, rendered as its document had them, no wrapper of ours
      return renderMarkup(getPageHtml(page.slug));
  }
}
