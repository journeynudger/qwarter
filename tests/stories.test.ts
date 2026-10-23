import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StoriesIndex, StoryPage } from "@/components/stories/stories";
import { getPages, resolveRoute } from "@/lib/content";
import { getStories, storyCategories, storyImage, storyUrl } from "@/lib/stories";

const stories = getStories();
const publicDir = path.join(process.cwd(), "public");

test("all 38 readings have complete, independently addressable routes", () => {
  assert.equal(stories.length, 38);
  assert.equal(new Set(stories.map((story) => story.slug)).size, stories.length);
  assert.equal(resolveRoute(["stories"]).kind, "page");
  assert.equal(resolveRoute(["stories", "not-a-story"]).kind, "not-found");
  for (const story of stories) {
    const route = resolveRoute(["stories", story.slug]);
    assert.equal(route.kind, "page");
    if (route.kind === "page") assert.equal(route.page.story, story.slug);
    assert.ok(getPages().some((page) => page.path === storyUrl(story)));
    assert.ok(storyCategories.includes(story.category));
    assert.ok(story.minutes > 0);
    assert.ok(story.blocks.length > 0);
    assert.ok(story.source.url || story.source.detail);
  }
});

test("every story has real, local, sourced pictures and valid figure references", () => {
  for (const story of stories) {
    assert.ok(storyImage(story), `${story.slug}: hero`);
    for (const block of story.blocks) if (block.type === "image") {
      assert.ok(story.images[block.image], `${story.slug}: figure ${block.image}`);
    }
    for (const image of story.images) {
      assert.ok(image.src.startsWith("/media/stories/"));
      assert.ok(fs.existsSync(path.join(publicDir, image.src)), image.src);
      assert.ok(image.width > 0 && image.height > 0);
      assert.ok(image.alt && image.caption && image.source && image.originalUrl);
    }
  }
});

test("the rendered index and every reader work without client-side scripts", () => {
  const index = renderToStaticMarkup(StoriesIndex());
  assert.equal((index.match(/<h1\b/g) ?? []).length, 1);
  for (const story of stories) {
    assert.ok(index.includes(`href="${storyUrl(story)}"`));
    const rendered = renderToStaticMarkup(StoryPage({ slug: story.slug }));
    assert.equal((rendered.match(/<h1\b/g) ?? []).length, 1, story.slug);
    assert.ok(rendered.includes('id="takeaway"'));
    assert.ok(rendered.includes('id="sources"'));
    assert.ok(rendered.includes('href="/stories/"'));
    const ids = [...rendered.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${story.slug}: duplicate anchors`);
  }
});

test("excerpts are explicit and newsletter promotions stay out of article copy", () => {
  assert.deepEqual(stories.filter((story) => story.isExcerpt).map((story) => story.id), [16, 17, 23]);
  for (const story of stories) {
    const copy = story.blocks.flatMap((block) => block.type === "image" ? [] : [block.text]).join(" ");
    assert.doesNotMatch(copy, /Profit\s?Snack|Smart Retail Tech Expo|Nuelink|Software Advice|RAREMINTS|Masterworks|T-Mobile|APPLY NOW/i);
    assert.doesNotMatch(copy, /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D]/u);
    if (story.isExcerpt) {
      assert.ok(renderToStaticMarkup(StoryPage({ slug: story.slug })).includes("The supplied source ends here."));
      assert.ok(getPages().find((page) => page.story === story.slug)?.noindex);
    }
  }
});

test("the generated navigation exposes Stories through ordinary full-page links", () => {
  for (const slug of ["home", "work", "approach", "contact", "project"]) {
    const html = fs.readFileSync(path.join(process.cwd(), "content/pages", `${slug}.html`), "utf8");
    assert.match(html, /id="h_a_4"[^>]*href="\/stories\/"[^>]*data-internal/);
    assert.match(html, /href="\/stories\/" class="nav-item" data-internal/);
  }
});

test("the October screenshot batch adds six complete stories and joins continuations once", () => {
  const additions = stories.filter(story => story.id >= 38);
  assert.equal(additions.length, 6);
  assert.deepEqual(additions.map(story => story.company).sort(), ['Apple', 'Anthropic', 'Cristiano Ronaldo', 'Lionel Messi', 'Amazon', 'NVIDIA'].sort());
  const copy = (id: number) => stories.find(story => story.id === id)!.blocks.flatMap(block => block.type === 'image' ? [] : [block.text]).join('\n');
  assert.equal(copy(39).split('Every time he made the model bigger').length - 1, 1);
  assert.equal(copy(42).split('Set the hiring bar painfully high.').length - 1, 1);
  assert.equal(copy(43).split('P.S. Sega sold their stake').length - 1, 1);
  assert.ok(stories.find(story => story.id === 4)!.source.detail!.includes('IMG_6512'));
  assert.ok(stories.find(story => story.id === 6)!.source.detail!.includes('IMG_6515'));
  for (const story of additions) {
    const rendered = renderToStaticMarkup(StoryPage({ slug: story.slug }));
    for (const image of story.images) {
      assert.ok(image.credit, story.slug);
      assert.ok(rendered.includes('Credit: '));
      assert.ok(rendered.includes(image.source.replaceAll('&', '&amp;')));
    }
  }
  const ronaldo = stories.find(story => story.id === 40)!;
  assert.match(ronaldo.images[0].alt, /bicycle kick/i);
});


test("the shelf excludes withdrawn material and prioritises the requested six stories", () => {
  assert.doesNotMatch(JSON.stringify(stories), /gamma/i);
  assert.deepEqual(stories.slice(0, 6).map(story => story.id), [39, 43, 38, 40, 34, 42]);
  for (const slug of ['starting-a-company-one-rung-at-a-time', 'ai-slide-decks-and-communicating-ideas', 'gamma-customer-advisory-board', 'hiring-when-candidates-use-ai', 'gamma-creation-index']) {
    assert.equal(resolveRoute(['stories', slug]).kind, 'not-found');
  }
  const index = renderToStaticMarkup(StoriesIndex());
  assert.equal((index.match(/class="qs-cut qs-cut--/g) ?? []).length, 6);
  assert.equal((index.match(/class="qs-feature qs-feature--/g) ?? []).length, 6);
  assert.doesNotMatch(index, /<em\b|gamma/i);
  for (const story of stories) {
    const reader = renderToStaticMarkup(StoryPage({ slug: story.slug }));
    assert.doesNotMatch(reader, /<em\b/);
    assert.match(reader, /class="qs-enlarge"[^>]*><svg class="qs-icon"/);
  }
});
