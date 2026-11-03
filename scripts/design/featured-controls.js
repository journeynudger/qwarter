/* Included in the derived Featured runtime; the captured reference stays untouched. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- prepended to the generated runtime
function qwFeaturedControls(page) {
  const count = page.scroller._items.length / 2;
  const items = page.scroller._items.slice(0, count);
  const controls = document.createElement('nav');
  controls.className = 'qw-featured-controls';
  controls.setAttribute('aria-label', 'Browse featured projects');
  controls.innerHTML = '<button type="button" data-prev aria-label="Previous project">←</button><label class="qw-featured-range"><span data-position></span><input type="range" min="0" step="1" value="0" aria-label="Featured project"></label><button type="button" data-next aria-label="Next project">→</button><a data-open data-internal>View project ↗</a><button type="button" data-auto aria-label="Pause automatic preview">Pause</button>';
  document.body.append(controls);
  const input = controls.querySelector('input');
  const position = controls.querySelector('[data-position]');
  const open = controls.querySelector('[data-open]');
  const auto = controls.querySelector('[data-auto]');
  input.max = String(count - 1);
  let current = -1;
  let dragging = false;
  page.qwPaused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderAuto = () => {
    auto.textContent = page.qwPaused ? 'Play' : 'Pause';
    auto.setAttribute('aria-label', page.qwPaused ? 'Play automatic preview' : 'Pause automatic preview');
  };
  renderAuto();
  const go = (index, immediate = false) => {
    index = (index + count) % count;
    const candidates = page.scroller._items.filter(item => item.indice % count === index);
    const item = candidates.sort((a, b) => Math.abs(a.top + a.height / 2 + page.scroller.position) - Math.abs(b.top + b.height / 2 + page.scroller.position))[0];
    page.qwPaused = true;
    renderAuto();
    page.scroller.minSpeed = 0;
    page.scroller.goto(-item.top - item.height / 2, immediate);
    if (!immediate) page.scroller.startScroll();
  };
  input.addEventListener('pointerdown', () => { dragging = true; page.qwSelecting = true; });
  input.addEventListener('input', () => go(Number(input.value)));
  let hoveringControls = false;
  controls.addEventListener('pointerenter', () => { hoveringControls = true; page.qwSelecting = true; });
  controls.addEventListener('pointerleave', () => { hoveringControls = false; if (!dragging) page.qwSelecting = false; });
  const release = () => { dragging = false; page.qwSelecting = hoveringControls; };
  input.addEventListener('pointerup', release);
  input.addEventListener('pointercancel', release);
  input.addEventListener('blur', release);
  controls.querySelector('[data-prev]').addEventListener('click', () => go(current - 1));
  controls.querySelector('[data-next]').addEventListener('click', () => go(current + 1));
  auto.addEventListener('click', () => { page.qwPaused = !page.qwPaused; renderAuto(); });
  controls.addEventListener('wheel', event => event.stopPropagation(), {passive:true});
  controls.addEventListener('touchmove', event => event.stopPropagation(), {passive:true});
  const remember = () => {
    try { sessionStorage.setItem('qw-featured-return', items[current]?.data.href || ''); } catch {}
  };
  open.addEventListener('click', remember);
  page.visor.container.addEventListener('click', remember);
  const update = () => {
    const selected = page.visor.actual;
    if (selected == null || selected < 0) return;
    const index = selected % count;
    if (index === current) return;
    current = index;
    const item = items[index];
    if (!dragging) input.value = String(index);
    input.setAttribute('aria-valuetext', `${item.data.counter}: ${item.data.title}`);
    position.textContent = `${item.data.counter} / ${count}`;
    open.href = item.data.href;
    open.setAttribute('aria-label', `View ${item.data.title}`);
    document.body.dataset.featuredProject = item.data.title;
  };
  const restore = () => {
    try {
      const saved = sessionStorage.getItem('qw-featured-return');
      sessionStorage.removeItem('qw-featured-return');
      const index = items.findIndex(item => item.data.href === saved);
      // Let the infinite list reorder while it travels; an immediate jump uses
      // stale item positions and can restore a different project.
      if (index >= 0) go(index);
    } catch {}
    update();
  };
  update();
  return { update, restore, dispose() { controls.remove(); } };
}
