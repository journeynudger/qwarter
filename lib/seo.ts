import { getSite } from "@/lib/content";

/**
 * Search engines may index this deployment only when ALLOW_INDEXING=1.
 * Leave it unset on *.vercel.app so the copy never competes with
 * qwarter.com; set it in Production when the domain moves to Vercel.
 */
export function indexingAllowed(): boolean {
  return process.env.ALLOW_INDEXING === "1";
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || getSite().origin).replace(/\/$/, "");
}
