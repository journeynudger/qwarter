import { createElement } from "react";
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

test("all 48 public readings have complete, independently addressable routes", () => {
  assert.equal(stories.length, 48);
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
    assert.match(html, /<a(?=[^>]*id="h_a_4")(?=[^>]*href="\/stories\/")(?=[^>]*data-internal)[^>]*>/);
    assert.match(html, /<a(?=[^>]*href="\/stories\/")(?=[^>]*class="nav-item")(?=[^>]*data-internal)[^>]*>/);
  }
});

test("the October screenshot batch adds six complete stories and joins continuations once", () => {
  const additions = stories.filter(story => story.id >= 38 && story.id <= 43);
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

test('headlines are single concise phrases and the supplied portrait thumbnails have no white frame', async () => {
  const sharp = (await import('sharp')).default;
  for (const story of stories) {
    assert.deepEqual(story.headline,[story.title]);
    assert.ok(story.title.split(/\s+/).length <= 8,story.title);
  }
  assert.equal(stories.find(story => story.id === 38)?.title,'A Decade of Failure');
  assert.equal(stories.find(story => story.id === 43)?.title,'Say the Difficult Thing');
  for (const id of [16,17]) {
    const image = storyImage(stories.find(story => story.id === id)!)!;
    const {data,info} = await sharp(path.join(publicDir,image.src)).removeAlpha().raw().toBuffer({resolveWithObject:true});
    for(const side of ['top','bottom','left','right']) {
      const count = side === 'top' || side === 'bottom' ? info.width : info.height;
      let white=0;
      for(let i=0;i<count;i++) {
        const x=side==='left'?0:side==='right'?info.width-1:i;
        const y=side==='top'?0:side==='bottom'?info.height-1:i;
        const offset=(y*info.width+x)*info.channels;
        if(data[offset]>245 && data[offset+1]>245 && data[offset+2]>245) white++;
      }
      assert.ok(white/count < .99,`${image.src}: white ${side} margin`);
    }
  }
});

test('new articles preserve every paragraph and image through the immersive reader', async () => {
  const { readingSpreads } = await import('@/components/stories/stories');
  const { getAllStories } = await import('@/lib/stories');
  for (const story of getAllStories()) {
    const spreads = readingSpreads(story);
    assert.deepEqual(spreads.flatMap(s => s.blocks), story.blocks.filter(b => b.type !== 'image'), story.slug);
    assert.deepEqual(spreads.flatMap(s => s.images).sort((a,b) => a-b), story.images.map((_,i) => i), story.slug);
    const { DOMParser } = await import('linkedom');
    const dom = new DOMParser().parseFromString(renderToStaticMarkup(createElement(StoryPage, {slug:story.slug})), 'text/html');
    assert.equal(dom.querySelectorAll('h1').length, 1);
    assert.ok(dom.querySelector('#reading'));
    for (const img of dom.querySelectorAll('img')) assert.ok(img.getAttribute('alt') !== null);
    if (story.id >= 44) assert.ok(!story.blocks.some(b => 'text' in b && b.text.includes('—')), story.slug);
  }
});

test('three review drafts stay out of the public index and search metadata', async () => {
  const { getAllStories } = await import('@/lib/stories');
  const drafts = getAllStories().filter(s => s.draft);
  assert.equal(drafts.length,3);
  const index = renderToStaticMarkup(createElement(StoriesIndex));
  for (const draft of drafts) {
    assert.ok(!index.includes(storyUrl(draft)));
    assert.ok(getPages().find(p => p.path === storyUrl(draft))?.noindex);
    assert.ok(renderToStaticMarkup(createElement(StoryPage, {slug:draft.slug})).includes('Draft for review'));
  }
  assert.deepEqual(stories.slice(-2).map(s => s.id), [52,53]);
});
