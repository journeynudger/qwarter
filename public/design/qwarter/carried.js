/* Read the carried page's existing scroll indicator: its smooth scroll does not
 * move window.scrollY. No wheel interception or changes to the reference build. */
(() => {
  const start = () => {
    const header = document.querySelector('#Header');
    if (!header) return;
    const title = header.querySelector('.title');
    const nav = header.querySelector('nav');
    let indicator;
    let indicatorObserver;
    const measure = () => {
      if (title && nav) header.style.setProperty('--qw-nav-lift', `${title.offsetTop - nav.offsetTop}px`);
    };
    const update = () => {
      const progress = indicator ? parseFloat(indicator.style.getPropertyValue('--progress')) || 0 : 0;
      const compact = window.scrollY > 60 || progress > .006;
      document.body.classList.toggle('qw-header-compact', compact);
      // Hidden wordmarks must not remain in the keyboard tab order.
      title?.setAttribute('tabindex', compact ? '-1' : '0');
      title?.setAttribute('aria-hidden', String(compact));
    };
    const connectIndicator = () => {
      const next = document.querySelector('.page-about .scrollbar-fake');
      if (next !== indicator) {
        indicatorObserver?.disconnect();
        indicator = next;
        if (indicator) {
          indicatorObserver = new MutationObserver(update);
          indicatorObserver.observe(indicator, { attributes: true, attributeFilter: ['style'] });
        }
      }
      measure(); update();
    };
    connectIndicator();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    document.fonts?.ready.then(measure);
    // Carried pages can replace their article without reloading the shared header.
    let queued = false;
    new MutationObserver(() => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(() => { queued = false; connectIndicator(); });
      }
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
