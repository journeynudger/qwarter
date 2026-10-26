import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {parseHTML} from 'linkedom';
import {getPages, pageMarkup} from '@/lib/content';

// Exercise the shipped controller with measured desktop/phone geometry. These
// checks cover scroll reversal and lifecycle behaviour, not browser paint output.
function readerHarness({reduced = false, observer = true} = {}) {
  const {document, window: domWindow} = parseHTML('<html data-hydrated="1"><body><main data-story-reader><div data-qr-scene><section class="qr-spread"><div class="qr-spread__rail">I</div><div class="qr-spread__text"><p>The words stay readable.</p></div><div class="qr-spread__media"><a data-qr-plate href="/one.webp"><img alt="One"></a><a data-qr-plate href="/two.webp"><img alt="Two"></a></div></section></div></main></body></html>');
  const reader = document.querySelector('main')!;
  const scene = document.querySelector('[data-qr-scene]')!;
  const sheet = document.querySelector<HTMLElement>('.qr-spread')!;
  const rail = document.querySelector('.qr-spread__rail')!;
  const media = document.querySelector('.qr-spread__media')!;
  const plates = [...document.querySelectorAll<HTMLElement>('[data-qr-plate]')];
  const listeners = new Map<string, () => void>();
  const frames = new Map<number, (time:number) => void>();
  let id = 0, time = 0, top = 1000, sheetHeight = 1100, mediaTop = 800;
  let intersect: (entries: {target:Element;isIntersecting:boolean}[]) => void = () => {};
  let preferenceChange = () => {};
  let breakpointChange = () => {};
  let resize = () => {};
  const reducedQuery = {matches:reduced,addEventListener:(_:string,fn:()=>void) => {preferenceChange=fn;}};
  const wideQuery = {matches:true,addEventListener:(_:string,fn:()=>void) => {breakpointChange=fn;}};
  Object.defineProperty(sheet,'offsetHeight',{get:() => sheetHeight});
  Object.defineProperties(rail,{offsetTop:{value:24},offsetHeight:{value:40}});
  Object.defineProperty(media,'offsetTop',{get:() => mediaTop});
  Object.defineProperty(document,'hidden',{value:false,writable:true});
  scene.getBoundingClientRect = () => ({top}) as DOMRect;
  const context = {
    document, innerHeight:900,
    matchMedia:(query:string) => query.includes('reduce') ? reducedQuery : wideQuery,
    getComputedStyle:() => ({marginBottom:'64px'}),
    requestAnimationFrame:(callback:(time:number)=>void) => {frames.set(++id,callback);return id;},
    cancelAnimationFrame:(key:number) => frames.delete(key),
    addEventListener:(event:string,callback:()=>void) => listeners.set(event,callback),
    IntersectionObserver:class {constructor(callback:typeof intersect){intersect=callback;}observe(){}},
    ResizeObserver:class {constructor(callback:()=>void){resize=callback;}observe(){}},
    window:{} as object,
  };
  context.window = observer ? context : {};
  vm.runInNewContext(fs.readFileSync('public/design/qwarter/reader-motion.js','utf8'),context);
  const settle = () => {
    let count=0;
    while(frames.size && count++<150) {const batch=[...frames.values()];frames.clear();time+=16;batch.forEach(callback=>callback(time));}
    assert.ok(count<150,'animation must settle, not run forever');
  };
  return {
    document, reader, sheet, plates, frames, listeners, settle,
    show:() => {intersect([{target:scene,isIntersecting:true}]);settle();},
    scroll:(y:number) => {top=y;listeners.get('scroll')?.();settle();},
    reduce:(value:boolean) => {reducedQuery.matches=value;preferenceChange();settle();},
    phone:() => {wideQuery.matches=false;mediaTop=1000;sheetHeight=1700;context.innerHeight=760;breakpointChange();resize();settle();},
    hidden:(value:boolean) => {Object.defineProperty(document,'hidden',{value,writable:true});document.dispatchEvent(new domWindow.Event('visibilitychange'));},
  };
}

test('reader images enter in sequence, reverse with scrolling and leave the text untouched', () => {
  const page=readerHarness();
  const copy=page.document.querySelector('.qr-spread__text')!.outerHTML;
  page.show();
  assert.equal(page.plates[0].style.getPropertyValue('--qr-opacity'),'0.000');
  page.scroll(250);
  const first=parseFloat(page.plates[0].style.getPropertyValue('--qr-y'));
  assert.ok(parseFloat(page.plates[1].style.getPropertyValue('--qr-y'))>first,'second photograph follows the first');
  page.scroll(-400);
  assert.equal(page.plates[0].style.getPropertyValue('--qr-opacity'),'1.000');
  assert.equal(page.plates[0].style.getPropertyValue('--qr-scale'),'1.0000');
  page.scroll(700);
  assert.ok(parseFloat(page.plates[0].style.getPropertyValue('--qr-y'))>first,'scrolling up reverses the reveal');
  assert.equal(page.document.querySelector('.qr-spread__text')!.outerHTML,copy);
  assert.equal(page.document.querySelectorAll('img').length,2,'no duplicate photograph layers');
  assert.equal(page.frames.size,0,'no idle animation loop');
  assert.equal(page.listeners.has('wheel'),false,'native scrolling remains in control');
});

test('tall sheets finish reading before they pin; phone resizing remeasures the image entrance', () => {
  const page=readerHarness();page.show();
  assert.equal(page.sheet.style.getPropertyValue('--qr-pin-top'),'-276px');
  page.scroll(-100);page.phone();
  assert.equal(page.sheet.style.getPropertyValue('--qr-pin-top'),'-1016px');
  assert.equal(page.plates[0].style.getPropertyValue('--qr-opacity'),'0.000','a phone image below the prose waits until it reaches the viewport');
  page.scroll(-1100);
  assert.equal(page.plates[0].style.getPropertyValue('--qr-scale'),'1.0000');
});

test('reduced motion, missing observers and hidden tabs retain a complete quiet reader', () => {
  const fallback=readerHarness({observer:false});
  assert.equal(fallback.reader.classList.contains('qr-motion'),false);
  const page=readerHarness({reduced:true});page.show();
  assert.equal(page.reader.classList.contains('qr-motion'),false);
  assert.equal(page.plates[0].getAttribute('style'),null);
  page.reduce(false);page.show();page.scroll(250);
  assert.ok(page.reader.classList.contains('qr-motion'));
  page.hidden(true);page.scroll(-200);
  assert.equal(page.frames.size,0);
  page.hidden(false);page.settle();
  page.reduce(true);
  assert.equal(page.reader.classList.contains('qr-motion'),false);
  assert.equal(page.plates[0].style.getPropertyValue('--qr-opacity'),'');
});

test('Approach opens with the thesis and all four laboratories before the existing service sections', () => {
  const {document}=parseHTML(pageMarkup(getPages().find(page=>page.slug==='approach')!));
  const article=document.querySelector('article')!;
  assert.equal(article.querySelector('section')?.id,'ai');
  assert.equal(article.querySelectorAll('#ai').length,1);
  assert.deepEqual([...article.querySelectorAll('.qw-labs h4')].map(node=>node.textContent),['Menlo Park','Bell Labs','SRI','Xerox PARC','Our turn.']);
  assert.ok(article.querySelector('.block-text'),'the existing approach is retained below the thesis');
});
