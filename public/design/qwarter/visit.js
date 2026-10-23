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
