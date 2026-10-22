import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const versions = new Map<string, string>();

/**
 * A /public path with a content hash appended, so next.config.ts can serve
 * /design/** as immutable and a changed file still reaches every visitor.
 * Anything else (an external URL, a path with a query) is returned as is.
 */
export function versioned(href: string): string {
  if (!href.startsWith("/design/") || href.includes("?")) return href;
  // in development the file changes under a running server: hash it on every render
  if (!versions.has(href) || process.env.NODE_ENV === "development") {
    const file = path.join(PUBLIC_DIR, decodeURIComponent(href));
    const hash = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
    versions.set(href, `${href}?v=${hash}`);
  }
  return versions.get(href)!;
}
