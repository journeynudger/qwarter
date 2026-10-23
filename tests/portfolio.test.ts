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
  assert.equal(scene.querySelector('.qw-view-switch a[aria-current]')?.textContent,'Portfolio');
  assert.equal(scene.querySelector('.qw-view-switch a[href="/work/library/"]')?.textContent,'Library');
  const grid = new DOMParser().parseFromString(renderToStaticMarkup(Archive()),'text/html');
  assert.equal(grid.querySelectorAll('.qp-card').length,15);
  assert.deepEqual([...grid.querySelectorAll('.qp-card')].slice(0,5).map(a => a.getAttribute('href')),['/work/butter/','/work/jr-pugh/','/work/ignite-beacon/','/work/core-rhythm-fitness/','/work/thanh-ta/']);
  const film = grid.querySelector('a[href="/work/jr-pugh/"] [data-portfolio-preview]');
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

test('carried navigation always opens a fresh document, with view controls only on Portfolio', async () => {
  const { getPages, pageMarkup } = await import('@/lib/content');
  const { DOMParser } = await import('linkedom');
  for (const page of getPages().filter(p => p.template)) {
    const dom = new DOMParser().parseFromString(pageMarkup(page),'text/html');
    for (const a of dom.querySelectorAll('#Header a[href^="/"], #Sidemenu a[href^="/"]')) {
      assert.ok(a.hasAttribute('data-internal'), `${page.path}: ${a.getAttribute('href')}`);
    }
    assert.equal(!!dom.querySelector('.qw-view-switch'),page.slug === 'work',page.path);
  }
});

test('gallery buttons settle after swiping and adapt to desktop and phone slide counts', async () => {
  const { DOMParser } = await import('linkedom');
  const dom = new DOMParser().parseFromString(`<div data-gallery><div class="st-gallery__track">${Array.from({length:6},()=>'<div></div>').join('')}</div><div class="st-notches">${Array.from({length:6},(_,i)=>`<button data-notch="${i}"></button>`).join('')}</div><button data-dir="-1"></button><button data-dir="1"></button></div>`,'text/html');
  const track = dom.querySelector('.st-gallery__track')!;
  Object.defineProperty(track.firstElementChild,'getBoundingClientRect',{value:()=>({width:300})});
  let desktop=false;let resize=()=>{};
  const source=fs.readFileSync('public/design/qwarter/study.js','utf8');
  const gallery=source.slice(source.indexOf('document.querySelectorAll("[data-gallery]")'),source.indexOf('/* ---------------------------------------------------------------- the rail */'));
  vm.runInNewContext(gallery,{document:dom,matchMedia:()=>({matches:desktop}),addEventListener:(_event:string,fn:()=>void)=>resize=fn,performance:{now:()=>0}});
  const buttons=[...dom.querySelectorAll('[data-notch]')];
  assert.equal(buttons.filter(b=>!b.hidden).length,6);
  buttons[5].dispatchEvent(new dom.defaultView.Event('click'));
  assert.equal(buttons[5].getAttribute('aria-current'),'true');
  assert.ok(track.style.transform.includes('-1580px'));
  desktop=true;resize();
  assert.equal(buttons.filter(b=>!b.hidden).length,4);
  assert.equal(buttons[3].getAttribute('aria-current'),'true');
  assert.ok(track.style.transform.includes('-948px'));
  desktop=false;resize();
  assert.equal(buttons.filter(b=>!b.hidden).length,6);
});
