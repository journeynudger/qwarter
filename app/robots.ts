import type { MetadataRoute } from "next";

import { indexingAllowed, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) {
    // A preview or staging copy: keep it out of search results entirely.
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
