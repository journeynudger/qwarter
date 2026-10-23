import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { getProjects, getPages } from '@/lib/content';
import { getStudy } from '@/lib/studies';
import site from '@/content/site.json';

test('Portfolio excludes withdrawn projects and exposes the painting gallery', () => {
  const withdrawn = ['ekaterina-sky','iotech-protect','mzaero','journey','epic-esg'];
  const projects = getProjects();
  assert.equal(projects.length,16);
  for (const slug of withdrawn) {
    assert.ok(!projects.some(project => project.slug === slug));
    assert.ok(!getPages().some(page => page.path === `/work/${slug}/`));
  }
  assert.equal(site.chrome.nav.find(item => item.href === '/work/')?.label, 'Portfolio');
  const gallery = getStudy('bambino')!;
  assert.equal(gallery.url, 'https://bambino-1dtu.vercel.app/gallery');
  assert.equal(gallery.gallery.length,11);
  assert.equal(new Set(gallery.gallery.map(painting => painting.src)).size,11);
  assert.ok(!JSON.stringify(gallery).match(/notebooks|algorithmic-self|racing-to-the-bottom/i));
});

test('the opening loader appears only on the first document in a tab', () => {
  const storage = new Map<string,string>();
  const script = fs.readFileSync('public/design/qwarter/visit.js','utf8');
  const run = (blocked = false, referrer = '') => {
    const classes = new Set<string>();
    vm.runInNewContext(script, {
      sessionStorage: { getItem: (key: string) => { if (blocked) throw Error(); return storage.get(key); }, setItem: (key: string,value: string) => storage.set(key,value) },
      document: { referrer, documentElement: { classList: { add: (name: string) => classes.add(name) } } },
      URL, location: {origin:'https://qwarter.vercel.app'},
    });
    return classes.has('qw-returning');
  };
  assert.equal(run(),false);
  assert.equal(run(),true);
  assert.equal(run(true,'https://qwarter.vercel.app/stories/'),true);
  assert.equal(run(true,'https://example.com/'),false);
});
