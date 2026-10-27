import { NextResponse, type NextRequest } from "next/server";

import redirectsJson from "./content/redirects.json";

/*
 * WordPress URLs that next.config.ts redirects cannot express:
 *   /?p=123, /?page_id=45   → the post or page itself (one hop, query dropped)
 *   /About/                 → /about/ (WordPress slugs ignore case)
 */

const redirectsData = redirectsJson as { ids: { id: number; path: string }[]; retired?: { paths: string[]; ids: number[] } };
const byId = new Map(redirectsData.ids.map((r) => [String(r.id), r.path]));
const retiredPaths = new Set(redirectsData.retired?.paths ?? []);
const retiredIds = new Set((redirectsData.retired?.ids ?? []).map(String));

function retired() {
  return new NextResponse('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page retired · Qwarter</title></head><body style="margin:0;background:#090909;color:#ece9df;font:22px Georgia,serif"><main style="max-width:640px;margin:20vh auto;padding:24px"><p>Qwarter</p><h1>This page has been retired.</h1><p><a style="color:inherit" href="/stories/">Visit the Library</a> or <a style="color:inherit" href="/work/">explore our work</a>.</p></main></body></html>', { status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "public, max-age=3600" } });
}

function next(request: NextRequest) {
  const response = NextResponse.next();
  // Production aliases share the same build. Keep the Vercel copies out of search
  // after indexing is enabled for the real domain.
  if (request.nextUrl.hostname.endsWith(".vercel.app")) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const normalized = url.pathname.toLowerCase().replace(/\/?$/, "/");
  if (retiredPaths.has(normalized)) return retired();
  if (url.pathname === "/") {
    const id = url.searchParams.get("p") || url.searchParams.get("page_id");
    if (id && retiredIds.has(id)) return retired();
    const target = id ? byId.get(id) : undefined;
    if (target) return NextResponse.redirect(new URL(target, url.origin), 308);
    return next(request);
  }
  const lower = url.pathname.toLowerCase();
  if (lower !== url.pathname || !url.pathname.endsWith("/")) {
    const dest = new URL(request.url);
    dest.pathname = lower.endsWith("/") ? lower : `${lower}/`;
    return NextResponse.redirect(dest, 308);
  }
  return next(request);
}

export const config = {
  matcher: ["/((?!_next|api|wp-json|media|design|legacy-assets)[^.]*)"],
};
