import { legacyHandler } from "@/lib/legacy-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { legacyHandler as GET, legacyHandler as HEAD };

