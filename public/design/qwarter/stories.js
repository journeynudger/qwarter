/* Progressive enhancement: the entire collection and every story exist before this script. */
(() => {
  function start() {
    const panels = [...document.querySelectorAll('[data-qr-tone]')];
    const revealItems = [...document.querySelectorAll('[data-qr-reveal]')];
    if (revealItems.length && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelector('.qr-reader')?.classList.add('qr-motion');
      const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {entry.target.classList.add('qr-visible');revealObserver.unobserve(entry.target);}
      }), {threshold:.06, rootMargin:'0px 0px 40px 0px'});
      revealItems.forEach(item => revealObserver.observe(item));
    }
    const form = document.querySelector('[data-story-filters]');
    if (form) {
      form.hidden = false;
      const search = form.querySelector('input[type="search"]');
      const buttons = [...form.querySelectorAll('[data-category]')];
      const rows = [...document.querySelectorAll('[data-story-row]')];
      const count = document.querySelector('[data-story-count]');
      const empty = document.querySelector('[data-story-empty]');
      let category = 'All stories';
      const update = () => {
        const query = search.value.trim().toLocaleLowerCase();
        let visible = 0;
        rows.forEach(row => {
          const matches = (category === 'All stories' || row.dataset.category === category) && row.dataset.search.includes(query);
          row.hidden = !matches;
          if (matches) visible++;
        });
        count.textContent = `${visible} ${visible === 1 ? 'story' : 'stories'}`;
        empty.hidden = visible > 0;
      };
      buttons.forEach(button => button.addEventListener('click', () => {
        category = button.dataset.category;
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        update();
      }));
      search.addEventListener('input', update);
      form.addEventListener('submit', event => { event.preventDefault(); update(); });
    }
    const previews = [...document.querySelectorAll('[data-portfolio-preview]')];
    if (previews.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const previewObserver = new IntersectionObserver(entries => entries.forEach(({target,isIntersecting}) => {
        if (isIntersecting) target.play().catch(() => {}); else target.pause();
      }), {threshold: .15});
      previews.forEach(video => previewObserver.observe(video));
      document.addEventListener('visibilitychange', () => { if (document.hidden) previews.forEach(video => video.pause()); });
    }
    const header = document.querySelector('.qs-header');
    const wordmark = header?.querySelector('.qs-wordmark');
    const measureHeader = () => {
      const nav = header?.querySelector('nav');
      if (header && wordmark && nav) header.style.setProperty('--qs-nav-lift', `${wordmark.offsetTop - nav.offsetTop}px`);
    };
    measureHeader();
    window.addEventListener('resize', measureHeader, { passive: true });
    document.fonts?.ready.then(measureHeader);
    const progress = document.querySelector('[data-reading-progress]');
    const percent = document.querySelector('[data-reading-percent]');
    let queued = false;
    const updateScroll = () => {
      const compact = window.scrollY > 60;
      if (panels.length) {
        const panel = panels.find(section => {const r=section.getBoundingClientRect();return r.top<=100 && r.bottom>100;});
        document.body.classList.toggle('qr-light',panel?.dataset.qrTone === 'paper');
      }
      document.body.classList.toggle('qs-scrolled', compact);
      wordmark?.setAttribute('tabindex', compact ? '-1' : '0');
      wordmark?.setAttribute('aria-hidden', String(compact));
      if (progress && percent) {
        const start = document.querySelector('#reading').getBoundingClientRect().top + window.scrollY;
        const end = document.querySelector('#takeaway').getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
        const value = Math.max(0, Math.min(100, Math.round(((window.scrollY - start) / Math.max(1, end - start)) * 100)));
        progress.setAttribute('aria-valuenow', String(value));
        progress.firstElementChild.style.width = `${value}%`;
        percent.textContent = `${value}%`;
      }
      queued = false;
    };
    const queueScroll = () => { if (!queued) { queued = true; requestAnimationFrame(updateScroll); } };
    window.addEventListener('scroll', queueScroll, { passive: true });
    window.addEventListener('resize', queueScroll, { passive: true });
    updateScroll();
    const contents = document.querySelector('.qs-contents');
    contents?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { contents.open = false; }));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && contents) contents.open = false; });
    const lightbox = document.querySelector('.qs-lightbox');
    if (lightbox && typeof lightbox.showModal === 'function') {
      const expanded = lightbox.querySelector('[data-expanded-image]');
      const caption = lightbox.querySelector('[data-expanded-caption]');
      let trigger;
      const close = () => { lightbox.close(); document.body.style.overflow = ''; trigger?.focus(); };
      document.querySelectorAll('[data-story-image]').forEach(link => link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const image = link.querySelector('img');
        expanded.src = image.currentSrc || image.src;
        expanded.alt = image.alt;
        caption.textContent = image.alt;
        trigger = link;
        lightbox.showModal();
        document.body.style.overflow = 'hidden';
      }));
      lightbox.querySelector('[data-image-close]').addEventListener('click', close);
      lightbox.addEventListener('cancel', event => { event.preventDefault(); close(); });
      lightbox.addEventListener('click', event => { if (event.target === lightbox || event.target === lightbox.querySelector('figure')) close(); });
      lightbox.addEventListener('close', () => { document.body.style.overflow = ''; });
    }
  }
  if (document.documentElement.dataset.hydrated === '1') start();
  else document.addEventListener('qw:hydrated', start, { once: true });
})();
