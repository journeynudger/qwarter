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

// Carried pages scroll in transforms, so wheel/touch events also drive the transient blur.
(() => {
 let idle;
 const moving = () => {
  if (!document.body) return;
  document.body.classList.add('qw-menu-scrolling');
  clearTimeout(idle);
  idle = setTimeout(() => document.body.classList.remove('qw-menu-scrolling'), 240);
 };
 addEventListener('wheel', moving, {passive:true});
 addEventListener('touchmove', moving, {passive:true});
 addEventListener('scroll', moving, {passive:true});
})();
