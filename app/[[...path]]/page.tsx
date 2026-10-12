import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { allPaths, getPageHtml, getSite, resolveRoute } from "@/lib/content";
import { renderMarkup } from "@/lib/html";
import { indexingAllowed } from "@/lib/seo";

type Params = Promise<{ path?: string[] }>;

export const dynamicParams = false;

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

/** The page's elements, rendered as the reference design's document had them: no wrapper of ours. */
export default async function Page({ params }: { params: Params }) {
  const { path } = await params;
  const route = resolveRoute(path);
  if (route.kind !== "page") notFound();
  return renderMarkup(getPageHtml(route.page.slug));
}
