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

test('navigation stays hidden after scrolling down and returns on up, tap, or keyboard', () => {
  const events = new Map<string,(event?: unknown)=>void>();
  const classes = new Set<string>();
  const menus = [{inert:false},{inert:false}];
  const window = {scrollY:0};
  vm.runInNewContext(fs.readFileSync('public/design/qwarter/visit.js','utf8'), {
    sessionStorage:{getItem:()=>null,setItem:()=>{}},window,
    document:{documentElement:{classList:{add:()=>{}}},querySelectorAll:()=>menus,body:{classList:{toggle:(v:string,on:boolean)=>on?classes.add(v):classes.delete(v)}}},
    addEventListener:(name:string,fn:(event?:unknown)=>void)=>events.set(name,fn),
  });
  const hidden=()=>classes.has('qw-menu-hidden');
  events.get('wheel')!({deltaY:35}); assert.ok(hidden()); assert.ok(menus.every(menu=>menu.inert));
  events.get('wheel')!({deltaY:-2}); assert.ok(hidden(), 'Ignore tiny trackpad jitter');
  events.get('wheel')!({deltaY:-20}); assert.ok(!hidden());
  events.get('touchstart')!({touches:[{clientY:400}]});
  events.get('pointerdown')!({clientX:40,clientY:400});
  events.get('touchmove')!({touches:[{clientY:200}]}); assert.ok(hidden());
  events.get('pointerup')!({clientX:40,clientY:200}); assert.ok(hidden(), 'Finishing a swipe is not a tap');
  events.get('pointerdown')!({clientX:40,clientY:200});
  events.get('pointerup')!({clientX:41,clientY:201}); assert.ok(!hidden());
  window.scrollY=200;events.get('scroll')!();assert.ok(hidden());
  window.scrollY=170;events.get('scroll')!();assert.ok(!hidden());
  events.get('wheel')!({deltaY:30});events.get('keydown')!({key:'Tab'});assert.ok(!hidden());assert.ok(menus.every(menu=>!menu.inert));
  window.scrollY=0;events.get('scroll')!();assert.ok(!hidden());
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
    if (page.slug === 'home') assert.ok(dom.querySelector('.widget-home__article')?.hasAttribute('data-internal'));
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
