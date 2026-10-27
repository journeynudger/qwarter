import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

test("page redirects add a trailing slash without redirecting back to the input URL", () => {
  for (const path of ["/work", "/about", "/About", "/About/"]) {
    const request = new NextRequest("https://example.com" + path + "?keep=value", {
      nextConfig: { trailingSlash: true },
    });
    const response = proxy(request);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://example.com" + path.toLowerCase().replace(/\/?$/, "/") + "?keep=value");
    assert.notEqual(response.headers.get("location"), request.url);
  }
  assert.equal(proxy(new NextRequest("https://example.com/about/")).status, 200);
});

