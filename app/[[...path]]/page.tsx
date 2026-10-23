import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Approach } from "@/components/site/approach";
import { Archive } from "@/components/site/archive";
import { Contact } from "@/components/site/contact";
import { Featured } from "@/components/site/featured";
import { Work } from "@/components/site/work";
import { StudyPage } from "@/components/study/study";
import { StoriesIndex, StoryPage } from "@/components/stories/stories";
import { allPaths, getSite, pageMarkup, resolveRoute } from "@/lib/content";
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
      type: page.kind === "story" ? "article" : "website",
    },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { path } = await params;
  const route = resolveRoute(path);
  if (route.kind !== "page") notFound();
  const { page } = route;
  switch (page.kind) {
    case "stories":
      return <StoriesIndex />;
    case "story":
      return <StoryPage slug={page.story!} />;
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
    case "study":
      return <StudyPage slug={page.project!} />;
    default:
      // a carried page: its document's own body markup, served as it is. It is not reconciled by React
      // (dangerouslySetInnerHTML), because the design's own script rewrites this DOM as soon as it runs, and
      // a hydration pass after that would put the server's markup back. display: contents keeps the
      // wrapper out of the layout, so the design's "body > …" rules still see their elements.
      return <div style={{ display: "contents" }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: pageMarkup(page) }} />;
  }
}
