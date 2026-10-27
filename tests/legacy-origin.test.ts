import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyHandler, legacyPathAllowed, requestLegacy } from "@/lib/legacy-origin";

test("only the existing form API and certificate challenge can reach the old origin", async () => {
  for (const path of ["/wp-json/gf/v2", "/wp-json/gf/v2/entries", "/wp-json/gf/v2/forms/83/submissions", "/.well-known/acme-challenge/test_ABC-123"]) {
    assert.equal(legacyPathAllowed(path), true, path);
  }
  for (const path of ["/wp-admin/", "/wp-json/wp/v2/users", "/wp-json/gf/v2evil", "/wp-json/gf/v2/%2f..%2fwp-admin", "/.well-known/acme-challenge/../private"]) {
    assert.equal(legacyPathAllowed(path), false, path);
  }
  await assert.rejects(requestLegacy("https://example.com/wp-json/gf/v2/entries"), /Unsupported legacy route/);
  await assert.rejects(requestLegacy("/wp-json/gf/v2/../../wp-admin/"), /Unsupported legacy route/);
  assert.equal((await legacyHandler(new Request("https://example.com/wp-admin/"))).status, 404);
});

test("oversized legacy requests are refused before delivery", async () => {
  const request = new Request("https://example.com/wp-json/gf/v2/forms/80/submissions", {
    method: "POST", headers: { "content-length": "1000001" }, body: "{}",
  });
  assert.equal((await legacyHandler(request)).status, 413);
});

