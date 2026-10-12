import type { MetadataRoute } from "next";

import { getPages } from "@/lib/content";
import { siteUrl } from "@/lib/seo";

/** Replaces WordPress's /wp-sitemap.xml (which now redirects here). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return getPages()
    .filter((p) => !p.noindex)
    .map((p) => ({ url: `${base}${p.path}`, lastModified: p.modified ? new Date(p.modified) : undefined }));
}
