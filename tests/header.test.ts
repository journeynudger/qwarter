import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

test('the shared header compacts with native or carried scrolling and restores at the top', () => {
  const events = new Map<string, () => void>();
  const attributes = new Map<string, string>();
  const classes = new Set<string>();
  const variables = new Map<string, string>();
  const observers: { callback: () => void; target?: unknown }[] = [];
  let progress = '0';
  const indicator = { style: { getPropertyValue: () => progress } };
  const title = { offsetTop: 0, setAttribute: (key: string, value: string) => attributes.set(key, value) };
  const header = {
    querySelector: (selector: string) => selector === '.title' ? title : { offsetTop: 58 },
    style: { setProperty: (key: string, value: string) => variables.set(key, value) },
  };
  const body = { classList: { toggle: (name: string, on: boolean) => on ? classes.add(name) : classes.delete(name) } };
  const window = { scrollY: 0, addEventListener: (name: string, listener: () => void) => events.set(name, listener) };
  const context = {
    window,
    document: { querySelectorAll: () => [], readyState: 'complete', body, querySelector: (selector: string) => selector === '#Header' ? header : indicator },
    requestAnimationFrame: (callback: () => void) => callback(),
    MutationObserver: class {
      entry: { callback: () => void; target?: unknown };
      constructor(callback: () => void) { this.entry = { callback }; observers.push(this.entry); }
      observe(target: unknown) { this.entry.target = target; }
      disconnect() { this.entry.target = undefined; }
    },
  };
  vm.runInNewContext(fs.readFileSync('public/design/qwarter/carried.js', 'utf8'), context);
  assert.equal(variables.get('--qw-nav-lift'), '-58px');
  assert.equal(classes.has('qw-header-compact'), false);
  window.scrollY = 120; events.get('scroll')!();
  assert.equal(classes.has('qw-header-compact'), true);
  assert.equal(attributes.get('tabindex'), '-1');
  window.scrollY = 0; events.get('scroll')!();
  assert.equal(classes.has('qw-header-compact'), false);
  assert.equal(attributes.get('tabindex'), '0');
  progress = '.2'; observers.find(observer => observer.target === indicator)!.callback();
  assert.equal(classes.has('qw-header-compact'), true);
  progress = '0'; observers.find(observer => observer.target === indicator)!.callback();
  assert.equal(classes.has('qw-header-compact'), false);
});

test('a decoded preview replaces its poster and failure restores the still', () => {
  const events = new Map<string,()=>void>();
  const classes = new Set<string>();
  const video = {readyState:0, addEventListener:(name:string,fn:()=>void)=>events.set(name,fn)};
  const figure = {querySelector:()=>video,classList:{toggle:(name:string,on:boolean)=>on?classes.add(name):classes.delete(name),remove:(name:string)=>classes.delete(name)}};
  const script=fs.readFileSync('public/design/qwarter/carried.js','utf8');
  const start=script.indexOf("document.querySelectorAll('.visor-videos figure')");
  const end=script.indexOf('    let indicator;',start);
  vm.runInNewContext(script.slice(start,end),{document:{querySelectorAll:()=>[figure]}});
  assert.ok(!classes.has('qw-film-ready'));
  video.readyState=2;events.get('loadeddata')!();assert.ok(classes.has('qw-film-ready'));
  events.get('error')!();assert.ok(!classes.has('qw-film-ready'));
  video.readyState=4;events.get('playing')!();assert.ok(classes.has('qw-film-ready'));
  video.readyState=0;events.get('emptied')!();assert.ok(!classes.has('qw-film-ready'));
});
