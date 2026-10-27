import { legacyHandler } from "@/lib/legacy-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export { legacyHandler as GET, legacyHandler as HEAD, legacyHandler as POST, legacyHandler as PUT, legacyHandler as PATCH, legacyHandler as DELETE, legacyHandler as OPTIONS };

