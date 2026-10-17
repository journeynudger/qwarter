/* ============================================================================
   Qwarter — site.js. Everything the pages do, in one deferred file, no framework:
     every page   the header collapses to a strip once a page that scrolls is scrolled
     featured     the loader (once per session), then the film-strip cascade: lays the projects
                  out around the focused one and moves the focus on wheel, keys, swipe and tap
     work         the slideshow: the opened site slides slowly through each of its pages inside
                  the frame; pages and projects change on input; the address follows the project
   The pause (bottom right on work, approach and contact) writes the same key the Paper shaders
   read (qw-motion), so one choice holds across the site. Reduced motion stops the sliding, the
   grain and the loader's flicker.
   ============================================================================ */
(function () {
  'use strict';
  var d = document, body = d.body, page = body.getAttribute('data-page');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOTION_KEY = 'qw-motion';
  function motionPaused() { try { return localStorage.getItem(MOTION_KEY) === 'paused'; } catch (e) { return false; } }
  function setMotion(paused) { try { localStorage.setItem(MOTION_KEY, paused ? 'paused' : 'moving'); } catch (e) { /* private mode: holds for this page */ } }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------- header: compact once a scrolling page is scrolled ---------------- */
  var header = d.querySelector('header.site');
  if (header && page !== 'featured' && page !== 'work') {
    var onScroll = function () { header.classList.toggle('compact', window.scrollY > 48); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- the echo: two layers, cross-faded ---------------- */
  function Echo(root) {
    var layers = root ? root.querySelectorAll('.echo-layer') : [];
    var current = 0, shown = layers[0] ? layers[0].getAttribute('src') : null;
    return {
      set: function (src) {
        if (!layers.length || src === shown) return;
        var next = layers[1 - current];
        if (next.tagName !== 'IMG') {
          var img = d.createElement('img');
          img.className = 'echo-layer'; img.alt = ''; img.decoding = 'async';
          next.replaceWith(img); next = img; layers = root.querySelectorAll('.echo-layer');
        }
        next.setAttribute('src', src);
        var go = function () { next.classList.add('on'); layers[current].classList.remove('on'); current = 1 - current; shown = src; };
        if (next.complete && next.naturalWidth) go(); else next.onload = go;
      }
    };
  }

  /* ---------------- shared input: wheel, keys, swipe ---------------- */
  function onInput(handlers) {
    var lock = false;
    var step = function (fn, arg) { if (lock) return; lock = true; fn(arg); setTimeout(function () { lock = false; }, 950); };
    window.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) < 24 && Math.abs(e.deltaX) < 24) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && handlers.side) step(handlers.side, e.deltaX > 0 ? 1 : -1);
      else step(handlers.main, e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
    window.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target && e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowDown': case 'PageDown': e.preventDefault(); step(handlers.main, 1); break;
        case 'ArrowUp': case 'PageUp': e.preventDefault(); step(handlers.main, -1); break;
        case 'ArrowRight': step(handlers.side || handlers.main, 1); break;
        case 'ArrowLeft': step(handlers.side || handlers.main, -1); break;
        case ' ': if (handlers.space && !(t === 'BUTTON' || t === 'A')) { e.preventDefault(); handlers.space(); } break;
        case 'Escape': if (handlers.escape) handlers.escape(); break;
        case 'Enter': if (handlers.enter && t !== 'BUTTON' && t !== 'A') handlers.enter(); break;
      }
    });
    var sx = null, sy = null;
    window.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchend', function (e) {
      if (sy === null) return;
      var dx = sx - e.changedTouches[0].clientX, dy = sy - e.changedTouches[0].clientY;
      sx = sy = null;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40 && handlers.side) step(handlers.side, dx > 0 ? 1 : -1);
      else if (Math.abs(dy) > 30) step(handlers.main, dy > 0 ? 1 : -1);
    }, { passive: true });
  }

  /* ============================ FEATURED ============================ */
  function featured() {
    var stage = d.getElementById('reelStage');
    var items = Array.prototype.slice.call(stage.querySelectorAll('.reel-item'));
    var rail = Array.prototype.slice.call(d.querySelectorAll('.reel-rail button'));
    var echo = Echo(d.getElementById('echo'));
    var n = items.length, cur = 0;

    /* The strip under the fisheye: the focused frame large; the previous ones stacked above
       it, left-aligned, each a step smaller; the next ones to its right, bottom-aligned, the
       same way. On a phone the next ones go below instead, right-aligned. The ring wraps, so
       with three projects every one of them is always on the stage. */
    function metrics() {
      var vw = window.innerWidth, vh = window.innerHeight, narrow = vw <= 760;
      var fw = narrow ? vw * 0.84 : Math.min(vw * 0.52, 960, (vh - 300) * 1.6);
      var fh = fw * 0.625;
      var s = narrow ? 0.42 : 0.32;
      var gx = narrow ? 0 : Math.max(24, vw * 0.022), gy = Math.max(14, vh * 0.024);
      var x0, y0;
      if (narrow) { x0 = (vw - fw) / 2; y0 = vh * 0.43 - fh / 2; }
      else { var groupW = fw + gx + fw * s; x0 = (vw - groupW) / 2; y0 = vh * 0.585 - fh / 2; }
      return { vw: vw, vh: vh, narrow: narrow, fw: fw, fh: fh, s: s, gx: gx, gy: gy, x0: x0, y0: y0 };
    }
    function place(entering) {
      var m = metrics();
      stage.style.setProperty('--fw', m.fw + 'px');
      stage.style.setProperty('--fh', m.fh + 'px');
      items.forEach(function (el, i) {
        var k = i - cur;
        if (n > 2) { if (k > n / 2) k -= n; if (k < -n / 2) k += n; }
        var x, y, sc, op, z, j;
        if (k === 0) { x = m.x0; y = m.y0; sc = 1; op = 1; z = 5; }
        else if (k < 0) {
          sc = Math.pow(m.s, -k);
          var bottom = m.y0 - m.gy;
          for (j = 1; j < -k; j++) bottom -= m.fh * Math.pow(m.s, j) + m.gy;
          x = m.x0; y = bottom - m.fh * sc; op = k === -1 ? 0.8 : 0.35; z = 5 + k;
        } else {
          sc = Math.pow(m.s, k);
          if (m.narrow) {
            var top = m.y0 + m.fh + m.gy * 3.6;
            for (j = 1; j < k; j++) top += m.fh * Math.pow(m.s, j) + m.gy;
            x = m.x0 + m.fw - m.fw * sc; y = top;
          } else {
            var left = m.x0 + m.fw + m.gx;
            for (j = 1; j < k; j++) left += m.fw * Math.pow(m.s, j) + m.gx;
            x = left; y = m.y0 + m.fh - m.fh * sc;
          }
          op = k === 1 ? 0.8 : 0.35; z = 5 - k;
        }
        if (entering) { y += 60; op = 0; }
        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
        el.style.opacity = op;
        el.style.zIndex = z;
        el.classList.toggle('focused', k === 0);
        el.setAttribute('tabindex', k === 0 ? '0' : '-1');
      });
      rail.forEach(function (b, i) { b.classList.toggle('current', i === cur); b.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); });
      echo.set(items[cur].getAttribute('data-blur'));
    }
    function go(i) { cur = ((i % n) + n) % n; place(false); }
    function enter() {
      stage.classList.add('still');
      place(true);
      void stage.offsetWidth; // the starting places are painted before the move
      stage.classList.remove('still');
      items.forEach(function (el, i) { el.style.transitionDelay = (i * 90) + 'ms'; });
      place(false);
      setTimeout(function () { items.forEach(function (el) { el.style.transitionDelay = ''; }); }, 1400);
    }
    items.forEach(function (el, i) {
      el.addEventListener('click', function (e) {
        if (!el.classList.contains('focused')) { e.preventDefault(); go(i); }
      });
    });
    rail.forEach(function (b, i) { b.addEventListener('click', function () { go(i); }); });
    onInput({
      main: function (dir) { go(cur + dir); },
      enter: function () { window.location.href = items[cur].getAttribute('href'); }
    });
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      stage.classList.add('still'); place(false);
      resizeTimer = setTimeout(function () { stage.classList.remove('still'); }, 120);
    });

    /* the loader: plays once per browser session, never under reduced motion */
    var loader = d.getElementById('loader');
    var seen = false;
    try { seen = sessionStorage.getItem('qwLoaderSeen') === '1'; } catch (e) { /* no storage: it plays */ }
    if (!loader || seen || reduced) {
      if (loader) loader.remove();
      enter();
      return;
    }
    try { sessionStorage.setItem('qwLoaderSeen', '1'); } catch (e) { /* then it plays again next time */ }
    var letters = Array.prototype.slice.call(loader.querySelectorAll('.lw'));
    /* each letter's face and weight per frame, settling on the roman */
    var frames = [
      ['sans ghost', 'serif half', 'italic on', 'sans ghost', 'serif mid', 'italic half', 'sans ghost'],
      ['serif on', 'italic mid', 'sans half', 'serif on', 'italic ghost', 'sans mid', 'serif half'],
      ['italic full', 'sans on', 'serif mid', 'italic on', 'sans half', 'serif on', 'italic mid'],
      ['serif full', 'serif on', 'italic full', 'sans on', 'serif full', 'italic on', 'serif on'],
      ['serif full', 'serif full', 'serif full', 'serif full', 'serif full', 'serif full', 'serif full']
    ];
    var f = 0;
    var step = function () {
      if (f < frames.length) {
        frames[f].forEach(function (cls, i) { if (letters[i]) letters[i].className = 'lw ' + cls; });
        f++;
        setTimeout(step, f === frames.length ? 820 : 230);
      } else {
        loader.classList.add('done');
        enter();
        setTimeout(function () { loader.remove(); }, 1300);
      }
    };
    setTimeout(function () { loader.classList.add('lit'); }, 120);
    setTimeout(function () { loader.classList.add('word'); step(); }, 1150);
  }

  /* ============================ WORK ============================ */
  function work() {
    var data = JSON.parse(d.getElementById('workData').textContent);
    var P = data.projects, N = P.length, pi = data.initial, pg = 0;
    var show = d.getElementById('show'), frame = d.getElementById('showFrame');
    var strips = [d.getElementById('stripA'), d.getElementById('stripB')], active = 0;
    var kicker = d.getElementById('showKicker'), title = d.getElementById('showTitle'), visit = d.getElementById('showVisit'), made = d.getElementById('showMade');
    var pagesNav = d.getElementById('showPages'), railNum = d.getElementById('railNum');
    var railTop = d.getElementById('railTop'), railBot = d.getElementById('railBot');
    var fillTop = railTop.querySelector('.rail-fill'), fillBot = railBot.querySelector('.rail-fill');
    var arrows = Array.prototype.slice.call(d.querySelectorAll('.show-arrow'));
    var pauseBtn = d.getElementById('showPause');
    var echo = Echo(d.getElementById('echo'));
    var paused = motionPaused(), hidden = d.hidden, pausedAt = 0;
    var t0 = performance.now(), travel = 0, dur = 0, hold = 4500;
    var SPEED = 70; // screen pixels per second along the page
    var LEAD = 1600; // the top of a page holds this long before it starts to slide

    function host(url) { return url.replace(/^https?:\/\//, '').replace(/\/$/, ''); }
    function project() { return P[pi]; }
    function pageOf(i) { var pages = project().pages; return pages[((i % pages.length) + pages.length) % pages.length]; }

    /* how far the current strip has to travel, and how long that takes */
    function measure() {
      var img = strips[active].firstElementChild;
      if (!img.complete || !img.naturalHeight) { img.onload = function () { measure(); t0 = performance.now(); }; travel = 0; dur = 0; hold = 1e9; return; }
      var scale = frame.clientWidth / img.naturalWidth;
      travel = Math.max(0, img.naturalHeight * scale - frame.clientHeight);
      dur = travel ? clamp(travel / SPEED, 6, 26) * 1000 : 0;
      hold = travel ? 1800 : 4500;
    }
    /* a soft start, a steady slide, a soft stop */
    function ease(p) {
      var a = 0.1, v = 1 / (1 - a);
      if (p < a) return v * p * p / (2 * a);
      if (p < 1 - a) return v * (a / 2 + (p - a));
      return 1 - v * (1 - p) * (1 - p) / (2 * a);
    }
    function renderPages() {
      pagesNav.innerHTML = '';
      project().pages.forEach(function (p, i) {
        var b = d.createElement('button');
        b.type = 'button'; b.textContent = p.title; b.setAttribute('data-page', i);
        if (i === pg) { b.className = 'current'; b.setAttribute('aria-current', 'true'); }
        b.addEventListener('click', function () { showPage(i); });
        pagesNav.appendChild(b);
      });
    }
    function markPage() {
      Array.prototype.forEach.call(pagesNav.children, function (b, i) {
        b.classList.toggle('current', i === pg);
        if (i === pg) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      frame.setAttribute('aria-label', project().name + ', ' + pageOf(pg).title + ' page, as it is on the site');
    }
    function showPage(i) {
      var pages = project().pages;
      pg = ((i % pages.length) + pages.length) % pages.length;
      var next = strips[1 - active], img = next.firstElementChild;
      if (!img) { img = d.createElement('img'); img.alt = ''; img.width = 1440; img.decoding = 'async'; next.appendChild(img); }
      var swap = function () {
        img.onload = null;
        next.style.transform = 'translate3d(0,0,0)';
        next.classList.add('on');
        strips[active].classList.remove('on');
        active = 1 - active;
        t0 = performance.now();
        measure();
        markPage();
        var after = pages[(pg + 1) % pages.length];
        if (after) { var pre = new Image(); pre.src = after.src; }
      };
      if (img.getAttribute('src') === pages[pg].src && img.complete) swap();
      else { img.onload = swap; img.setAttribute('src', pages[pg].src); }
    }
    function goProject(i, push) {
      pi = ((i % N) + N) % N;
      var p = project();
      show.classList.add('switching');
      setTimeout(function () {
        kicker.textContent = p.line;
        title.textContent = p.name;
        visit.setAttribute('href', p.url);
        visit.textContent = host(p.url) + ' ↗';
        made.textContent = p.made + ', ' + p.year;
        railNum.textContent = p.numeral;
        arrows.forEach(function (a) {
          var step = Number(a.getAttribute('data-step'));
          var q = P[((pi + step) % N + N) % N];
          a.setAttribute('href', '/work/' + q.slug + '/');
          a.setAttribute('aria-label', (step > 0 ? 'Next' : 'Previous') + ' project: ' + q.name);
          a.querySelector('.who').textContent = q.name;
        });
        echo.set(p.blur);
        d.title = p.name + ' – Qwarter';
        if (push) history.pushState({ pi: pi }, '', '/work/' + p.slug + '/');
        pg = 0;
        renderPages();
        showPage(0);
        show.classList.remove('switching');
      }, 450);
    }
    function setPaused(v) {
      paused = v;
      setMotion(v);
      pauseBtn.classList.toggle('paused', v);
      pauseBtn.setAttribute('aria-pressed', v ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', v ? 'Play the slideshow' : 'Pause the slideshow');
    }
    function tick(now) {
      var still = paused || hidden || reduced;
      if (still && !pausedAt) pausedAt = now;
      if (!still && pausedAt) { t0 += now - pausedAt; pausedAt = 0; }
      if (!still) {
        var el = Math.max(0, now - t0 - LEAD), p, y;
        if (dur) {
          if (el < dur) { p = el / dur; y = travel * ease(p); }
          else if (el < dur + hold) { p = 1; y = travel; }
          else { showPage(pg + 1); p = 0; y = 0; }
          strips[active].style.transform = 'translate3d(0,' + (-y).toFixed(2) + 'px,0)';
          p = Math.min(1, el / (dur + hold));
        } else {
          if (el > hold) { showPage(pg + 1); }
          p = Math.min(1, el / hold);
        }
        var hTop = railTop.offsetHeight, hBot = railBot.offsetHeight, split = hTop / (hTop + hBot || 1);
        if (p <= split) { fillTop.style.height = (p / split * 100) + '%'; fillBot.style.height = '0%'; }
        else { fillTop.style.height = '100%'; fillBot.style.height = ((p - split) / (1 - split) * 100) + '%'; }
      }
      requestAnimationFrame(tick);
    }

    pauseBtn.hidden = reduced; // under reduced motion nothing slides, so there is nothing to pause
    setPaused(paused);
    pauseBtn.addEventListener('click', function () { setPaused(!paused); });
    d.addEventListener('visibilitychange', function () { hidden = d.hidden; });
    arrows.forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); goProject(pi + Number(a.getAttribute('data-step')), true); });
    });
    Array.prototype.forEach.call(pagesNav.children, function (b, i) { b.addEventListener('click', function () { showPage(i); }); });
    window.addEventListener('popstate', function () {
      var m = location.pathname.match(/^\/work\/([^/]+)\/?$/);
      var idx = m ? P.findIndex(function (p) { return p.slug === m[1]; }) : 0;
      if (idx < 0) idx = 0;
      if (idx !== pi) goProject(idx, false);
    });
    window.addEventListener('resize', function () { var keep = (performance.now() - t0); measure(); t0 = performance.now() - Math.min(keep, dur + hold); });
    onInput({
      main: function (dir) { showPage(pg + dir); },
      side: function (dir) { goProject(pi + dir, true); },
      space: function () { setPaused(!paused); },
      escape: function () { window.location.href = '/'; }
    });
    if (!history.state) history.replaceState({ pi: pi }, '');
    measure();
    requestAnimationFrame(tick);
  }

  if (page === 'featured') featured();
  else if (page === 'work') work();
})();
