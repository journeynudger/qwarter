import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { getProjects, getPages } from '@/lib/content';
import { getStudy } from '@/lib/studies';
import site from '@/content/site.json';

test('Portfolio excludes withdrawn projects and exposes the painting gallery', () => {
  const withdrawn = ['ekaterina-sky','iotech-protect','mzaero','journey','epic-esg','2020-insights'];
  const projects = getProjects();
  assert.equal(projects.length,15);
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
      window: {scrollY:0}, addEventListener: () => {}, URL, location: {origin:'https://qwarter.vercel.app'},
    });
    return classes.has('qw-returning');
  };
  assert.equal(run(),false);
  assert.equal(run(),true);
  assert.equal(run(true,'https://qwarter.vercel.app/stories/'),true);
  assert.equal(run(true,'https://example.com/'),false);
});

test('the default portfolio keeps its scrolling presentation and offers a Library view', async () => {
  const { resolveRoute, pageMarkup } = await import('@/lib/content');
  const { Archive } = await import('@/components/site/archive');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DOMParser } = await import('linkedom');
  const scrolling = resolveRoute(['work']);
  const library = resolveRoute(['work','library']);
  assert.equal(scrolling.kind,'page'); assert.equal(library.kind,'page');
  if (scrolling.kind !== 'page' || library.kind !== 'page') return;
  assert.equal(scrolling.page.template,'/archive/');
  assert.equal(library.page.kind,'archive');
  const scene = new DOMParser().parseFromString(pageMarkup(scrolling.page),'text/html');
  assert.ok(scene.querySelector('.block-project-list .visor-videos'));
  assert.equal(scene.querySelector('.qw-view-switch a[aria-current]')?.textContent,'Scrolling');
  assert.equal(scene.querySelector('.qw-view-switch a[href="/work/library/"]')?.textContent,'Library');
  const grid = new DOMParser().parseFromString(renderToStaticMarkup(Archive()),'text/html');
  assert.equal(grid.querySelectorAll('.qp-card').length,15);
  assert.deepEqual([...grid.querySelectorAll('.qp-card')].slice(0,5).map(a => a.getAttribute('href')),['/work/butter/','/work/jr-pugh/','/work/ignite-beacon/','/work/core-rhythm-fitness/','/work/thanh-ta/']);
  const film = grid.querySelector('[data-portfolio-preview]');
  assert.ok(film?.hasAttribute('muted'));assert.ok(film?.hasAttribute('loop'));assert.match(film?.outerHTML ?? '', /playsinline/i);
  assert.ok(film?.querySelector('source')?.getAttribute('src')?.includes('/jr-pugh/scroll.mp4?v='));
});

test('menu blur clears once scrolling stops, including carried wheel scrolling', () => {
  const events = new Map<string,()=>void>(); const classes = new Set<string>(); let idle:()=>void = ()=>{};
  vm.runInNewContext(fs.readFileSync('public/design/qwarter/visit.js','utf8'), {
    sessionStorage:{getItem:()=>null,setItem:()=>{}},
    document:{documentElement:{classList:{add:()=>{}}},body:{classList:{add:(v:string)=>classes.add(v),remove:(v:string)=>classes.delete(v)}}},
    addEventListener:(name:string,fn:()=>void)=>events.set(name,fn),
    setTimeout:(fn:()=>void)=>{idle=fn;return 1;},clearTimeout:()=>{},
  });
  assert.ok(!classes.has('qw-menu-scrolling'));
  for(const event of ['wheel','touchmove','scroll']){events.get(event)!();assert.ok(classes.has('qw-menu-scrolling'));idle();assert.ok(!classes.has('qw-menu-scrolling'));}
});
