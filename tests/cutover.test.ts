import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { NextRequest } from "next/server";
import { getPages } from "@/lib/content";
import data from "@/content/redirects.json";
import { proxy } from "@/proxy";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

test("WordPress links redirect directly to existing routes without loops", () => {
  const routes = new Set(getPages().map(page => page.path));
  assert.ok(data.paths.length >= 30);
  for (const item of data.paths) {
    assert.ok(routes.has(item.destination), item.source);
    assert.notEqual(item.source, item.destination);
    assert.ok(!data.paths.some(other => other.source === item.destination));
  }
  for (const item of data.ids) {
    const response = proxy(new NextRequest(`https://qwarter.com/?p=${item.id}`));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), `https://qwarter.com${item.path}`);
  }
});

test("retired articles and test pages return Gone by slug and WordPress id", () => {
  for (const path of data.retired.paths) {
    assert.equal(proxy(new NextRequest(`https://qwarter.com${path}`)).status, 410, path);
    assert.equal(proxy(new NextRequest(`https://qwarter.com${path.toUpperCase()}`)).status, 410, path);
  }
  for (const id of data.retired.ids) {
    assert.equal(proxy(new NextRequest(`https://qwarter.com/?page_id=${id}`)).status, 410);
  }
  assert.equal(proxy(new NextRequest("https://qwarter.com/stories/")).status, 200);
});

test("Vercel aliases stay noindex while the real domain can be indexed", () => {
  const original = process.env.ALLOW_INDEXING;
  try {
    delete process.env.ALLOW_INDEXING;
    assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
    process.env.ALLOW_INDEXING = "1";
    assert.equal(robots().sitemap, "https://qwarter.com/sitemap.xml");
    assert.deepEqual(robots().rules, { userAgent: "*", allow: "/", disallow: ["/api/"] });
    assert.equal(proxy(new NextRequest("https://qwarter.vercel.app/stories/")).headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(proxy(new NextRequest("https://qwarter.com/stories/")).headers.get("x-robots-tag"), null);
    const draftPages = getPages().filter(page => page.noindex);
    for (const page of draftPages) assert.ok(!sitemap().some(entry => entry.url === `https://qwarter.com${page.path}`));
  } finally {
    if (original === undefined) delete process.env.ALLOW_INDEXING;
    else process.env.ALLOW_INDEXING = original;
  }
});

test("the original downloadable logo PDF survives the move", () => {
  const pdf = fs.readFileSync("public/legacy-assets/Pineapple_Club_Logo_Black_whiteBG.pdf");
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});
