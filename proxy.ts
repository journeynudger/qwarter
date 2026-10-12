import { NextResponse, type NextRequest } from "next/server";

import redirectsJson from "./content/redirects.json";

/*
 * WordPress URLs that next.config.ts redirects cannot express:
 *   /?p=123, /?page_id=45   → the post or page itself (one hop, query dropped)
 *   /About/                 → /about/ (WordPress slugs ignore case)
 */

const redirectsData = redirectsJson as { ids: { id: number; path: string }[] };
const byId = new Map(redirectsData.ids.map((r) => [String(r.id), r.path]));

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname === "/") {
    const id = url.searchParams.get("p") || url.searchParams.get("page_id");
    const target = id ? byId.get(id) : undefined;
    if (target) return NextResponse.redirect(new URL(target, url.origin), 308);
    return NextResponse.next();
  }
  const lower = url.pathname.toLowerCase();
  if (lower !== url.pathname) {
    const dest = url.clone();
    dest.pathname = lower.endsWith("/") ? lower : `${lower}/`;
    return NextResponse.redirect(dest, 308);
  }
  return NextResponse.next();
}

export const config = {
  // The home page (for ?p= / ?page_id=) and any page path with a capital letter. Never media, design or Next assets.
  matcher: ["/", "/((?!_next|api|media|design)[^.]*[A-Z][^.]*)"],
};
