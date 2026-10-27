import https from "node:https";

const ORIGIN_HOST = "qwarter.com";
const ORIGIN_IP = "208.87.133.155";
const MAX_REQUEST = 1_000_000;
const MAX_RESPONSE = 4_000_000;

/**
 * Preserve the existing Gravity Forms backend after DNS moves to Vercel.
 * Connect to the original server, but retain the original HTTPS identity:
 * normal CA validation, SNI and Host all remain ORIGIN_HOST.
 * Never follow redirects or accept a destination from a request.
 */
export function legacyPathAllowed(pathname: string): boolean {
  return /^\/wp-json\/gf\/v2(?:\/[A-Za-z0-9_-]+)*\/?$/.test(pathname)
    || /^\/\.well-known\/acme-challenge\/[A-Za-z0-9_-]+$/.test(pathname);
}

export async function requestLegacy(
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
  body?: Uint8Array,
): Promise<Response> {
  const target = new URL(path, `https://${ORIGIN_HOST}`);
  if (target.origin !== `https://${ORIGIN_HOST}` || !legacyPathAllowed(target.pathname)) {
    throw new Error("Unsupported legacy route");
  }
  if (body && body.byteLength > MAX_REQUEST) return new Response(null, { status: 413 });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: ORIGIN_IP,
      servername: ORIGIN_HOST,
      port: 443,
      method,
      path: target.pathname + target.search,
      headers: { ...headers, host: ORIGIN_HOST, "accept-encoding": "identity" },
      // Certificate verification is deliberately left enabled.
    }, res => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", chunk => {
        size += chunk.length;
        if (size > MAX_RESPONSE) res.destroy(new Error("Legacy response too large"));
        else chunks.push(Buffer.from(chunk));
      });
      res.on("error", reject);
      res.on("end", () => {
        const out = new Headers({
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Content-Type-Options": "nosniff",
        });
        for (const key of ["content-type", "content-disposition", "www-authenticate", "allow", "location"]) {
          const value = res.headers[key];
          if (typeof value === "string") out.set(key, value);
        }
        const status = res.statusCode || 502;
        const bytes = Buffer.concat(chunks);
        resolve(new Response(method === "HEAD" || [204, 205, 304].includes(status) ? null : new Uint8Array(bytes), { status, headers: out }));
      });
    });
    const timeout = setTimeout(() => req.destroy(new Error("Legacy origin timed out")), 45_000);
    req.on("close", () => clearTimeout(timeout));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function legacyHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!legacyPathAllowed(url.pathname)) return new Response(null, { status: 404 });
  if (Number(request.headers.get("content-length")) > MAX_REQUEST) return new Response(null, { status: 413 });
  try {
    const headers: Record<string, string> = {};
    for (const key of ["authorization", "content-type", "accept", "x-wp-nonce", "cookie"]) {
      const value = request.headers.get(key);
      if (value) headers[key] = value;
    }
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : new Uint8Array(await request.arrayBuffer());
    return await requestLegacy(url.pathname + url.search, request.method, headers, body);
  } catch {
    return Response.json({ error: "The form service is temporarily unavailable." }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}

