import type { NextConfig } from "next";

import redirectsJson from "./content/redirects.json";

/*
 * URLs stay WordPress's, trailing slash included, so every link and search
 * result pointing at qwarter.com keeps working after the move.
 * content/redirects.json is written by the port (scripts/port/).
 */

type Redirect = { source: string; destination: string; permanent: boolean };
const redirectsData = redirectsJson as { paths: { source: string; destination: string }[] };

const fromContent: Redirect[] = redirectsData.paths.map((r) => ({ ...r, permanent: true }));

// WordPress archive and feed URLs that have no page of their own here.
const wordpress: Redirect[] = [
  { source: "/feed", destination: "/", permanent: true },
  { source: "/comments/feed", destination: "/", permanent: true },
  { source: "/wp-sitemap.xml", destination: "/sitemap.xml", permanent: true },
  { source: "/wp-sitemap-:rest.xml", destination: "/sitemap.xml", permanent: true },
  { source: "/sitemap_index.xml", destination: "/sitemap.xml", permanent: true },
  { source: "/wp-admin", destination: "/", permanent: false },
  { source: "/wp-login.php", destination: "/", permanent: false },
  { source: "/wp-content/uploads/2022/06/Pineapple_Club_Logo_Black_whiteBG.pdf", destination: "/legacy-assets/Pineapple_Club_Logo_Black_whiteBG.pdf", permanent: true },
];

const nextConfig: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  turbopack: { root: __dirname },
  async redirects() {
    return [...fromContent, ...wordpress];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        // the layout requests these with ?v=<content hash>
        source: "/design/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
