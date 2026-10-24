/* One opening animation per tab, including visits that begin in Stories or Portfolio. */
(() => {
  try {
    if (sessionStorage.getItem('qwarter-visited') === '1') document.documentElement.classList.add('qw-returning');
    sessionStorage.setItem('qwarter-visited', '1');
  } catch {
    // Storage can be unavailable in private browsing; an internal referrer still identifies navigation.
    try { if (new URL(document.referrer).origin === location.origin) document.documentElement.classList.add('qw-returning'); } catch {}
  }
})();

// Native pages and the carried, transformed scrollers share one navigation policy.
// Down hides the entire menu. Up, a stationary tap, or keyboard navigation restores it.
(() => {
  let previousY = 0, travelled = 0, direction = 0, touchY = null, pointer = null;
  const setHidden = hidden => {
    if (!document.body) return;
    document.body.classList.toggle('qw-menu-hidden', hidden);
    document.body.classList.toggle('qw-menu-revealed', !hidden);
    document.querySelectorAll('#Header, .qs-header, .qs-mark, .st-top').forEach(menu => {
      menu.inert = hidden;
    });
  };
  const move = delta => {
    if (!Number.isFinite(delta) || Math.abs(delta) < 1) return;
    const next = Math.sign(delta);
    travelled = next === direction ? travelled + Math.abs(delta) : Math.abs(delta);
    direction = next;
    if (travelled >= 8) setHidden(next > 0);
  };
  addEventListener('wheel', event => move(event.deltaY), {passive:true});
  addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY ?? null; }, {passive:true});
  addEventListener('touchmove', event => {
    const y = event.touches[0]?.clientY;
    if (touchY !== null && y !== undefined) move(touchY - y);
    touchY = y ?? null;
  }, {passive:true});
  addEventListener('scroll', () => {
    const y = Math.max(0, window.scrollY);
    move(y - previousY);
    previousY = y;
    if (y <= 4) setHidden(false);
  }, {passive:true});
  addEventListener('pointerdown', event => { pointer = {x:event.clientX,y:event.clientY}; }, {passive:true});
  addEventListener('pointerup', event => {
    if (pointer && Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y) < 8) setHidden(false);
    pointer = null;
  }, {passive:true});
  addEventListener('pointercancel', () => { pointer = null; }, {passive:true});
  addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key === 'Escape' || event.key === 'Home') setHidden(false);
  });
})();
