import crypto from "node:crypto";

/** A route's folder name in a capture: "/" → home, "/work/alpha/" → work__alpha (a query gets a short hash). */
export function slugOf(route) {
  const bare = route.replace(/[?#].*$/, "").replace(/^\/|\/$/g, "");
  const q = route.includes("?") ? `__q${crypto.createHash("sha1").update(route).digest("hex").slice(0, 6)}` : "";
  return (bare ? bare.replace(/[^a-zA-Z0-9-_.]+/g, "__") : "home") + q;
}
