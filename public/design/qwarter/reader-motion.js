/* Progressive, reversible motion on the original images. Native scrolling owns
   the document; no cloned media, hidden prose, wheel handler or perpetual ticker. */
(() => {
  function start() {
    const reader = document.querySelector('[data-story-reader]');
    if (!reader || !('IntersectionObserver' in window)) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = matchMedia('(min-width: 901px)');
    const scenes = [...reader.querySelectorAll('[data-qr-scene]')].map(anchor => ({
      anchor,
      sheet: anchor.querySelector('.qr-spread'),
      rail: anchor.querySelector('.qr-spread__rail'),
      media: anchor.querySelector('.qr-spread__media'),
      mediaTop: 0,
      height: 0,
      plates: [...anchor.querySelectorAll('[data-qr-plate]')].map((element, index) => ({element, index, value: null})),
    }));
    const byAnchor = new Map(scenes.map(scene => [scene.anchor, scene]));
    const active = new Set();
    const clamp = value => Math.max(0, Math.min(1, value));
    const smooth = value => value * value * (3 - 2 * value);
    let frame = 0;
    let measureFrame = 0;
    let lastTime = 0;

    function draw(time) {
      frame = 0;
      if (document.hidden || reduced.matches) return;
      const ease = 1 - Math.exp(-Math.min(50, lastTime ? time - lastTime : 16) / 85);
      lastTime = time;
      const height = Math.max(1, innerHeight);
      const wide = desktop.matches;
      let settling = false;
      // Read geometry first; only transform/opacity properties are written below.
      const positions = [...active].map(scene => ({scene, top: scene.anchor.getBoundingClientRect().top}));
      for (const {scene, top} of positions) {
        const start = top + scene.mediaTop;
        const progress = (height * .92 - start) / (height * (wide ? .7 : .8));
        const drift = clamp(-start / Math.max(height, scene.height)) * (wide ? 28 : 12);
        scene.plates.forEach(plate => {
          const target = clamp(progress - plate.index * .18);
          if (plate.value === null) plate.value = target;
          plate.value += (target - plate.value) * ease;
          if (Math.abs(target - plate.value) > .001) settling = true;
          else plate.value = target;
          const entered = smooth(plate.value);
          const paired = scene.plates.length > 1;
          const sign = plate.index % 2 ? 1 : -1;
          const y = (1 - entered) * (wide ? 120 : 44) * (1 + plate.index * .35) - drift;
          const angle = paired ? sign * ((wide ? 1.7 : 1) + (1 - entered) * (wide ? 4 : 1.2)) : sign * (1 - entered) * 2;
          plate.element.style.setProperty('--qr-y', `${y.toFixed(2)}px`);
          plate.element.style.setProperty('--qr-angle', `${angle.toFixed(3)}deg`);
          plate.element.style.setProperty('--qr-scale', (.95 + .05 * entered).toFixed(4));
          plate.element.style.setProperty('--qr-opacity', clamp(plate.value * 3).toFixed(3));
        });
      }
      if (settling) frame = requestAnimationFrame(draw);
      else lastTime = 0;
    }
    function queue() {
      if (!frame && active.size && !document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
    }
    function measure() {
      measureFrame = 0;
      const dimensions = scenes.map(scene => ({
        scene,
        height:scene.sheet.offsetHeight,
        // The rail stays in flow even when a photograph is already pinned.
        mediaTop:desktop.matches
          ? scene.rail.offsetTop + scene.rail.offsetHeight + parseFloat(getComputedStyle(scene.rail).marginBottom || '0')
          : scene.media?.offsetTop || 0,
      }));
      for (const {scene, height, mediaTop} of dimensions) {
        scene.height = height;
        scene.mediaTop = mediaTop;
        // A tall sheet pins only after its last line can be read above the footer.
        scene.sheet.style.setProperty('--qr-pin-top', `${Math.min(0, innerHeight - 76 - height)}px`);
      }
      reader.classList.toggle('qr-motion', !reduced.matches);
      queue();
    }
    function queueMeasure() {
      if (!measureFrame) measureFrame = requestAnimationFrame(measure);
    }
    function preferenceChanged() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      reader.classList.remove('qr-motion');
      scenes.forEach(scene => scene.plates.forEach(plate => {
        plate.value = null;
        ['--qr-y','--qr-angle','--qr-scale','--qr-opacity'].forEach(property => plate.element.style.removeProperty(property));
      }));
      measure();
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const scene = byAnchor.get(entry.target);
        if (entry.isIntersecting) active.add(scene);
        else active.delete(scene);
      });
      queue();
    }, {rootMargin:'75% 0px'});
    scenes.forEach(scene => observer.observe(scene.anchor));
    if ('ResizeObserver' in window) {
      const resize = new ResizeObserver(queueMeasure);
      scenes.forEach(scene => resize.observe(scene.sheet));
    }
    reader.querySelectorAll('img').forEach(image => image.addEventListener('load', queueMeasure, {once:true}));
    document.fonts?.ready.then(queueMeasure);
    addEventListener('scroll', queue, {passive:true});
    addEventListener('resize', queueMeasure, {passive:true});
    addEventListener('pageshow', queueMeasure);
    reduced.addEventListener('change', preferenceChanged);
    desktop.addEventListener('change', queueMeasure);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else queueMeasure();
    });
    measure();
  }
  if (document.documentElement.dataset.hydrated === '1') start();
  else document.addEventListener('qw:hydrated', start, {once:true});
})();
