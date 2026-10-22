/* The case studies' motion (public/design/qwarter/study.css lays the page out without it): the reveals as
   sections scroll in, the figures counting up, the statement's words arriving one by one, a soft parallax
   on the screens, the films playing only while they are in view (each with its own pause), the "+" sheets
   lifted into a dialog, the gallery's drag with inertia and its notches, the numeral rail, and the buttons
   that lean toward the pointer. Reduced motion keeps the page still and every film on its poster. */
(() => {
  "use strict";
  const html = document.documentElement;
  html.classList.add("js");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(.22,1,.36,1)";

  /* ---------------------------------------------------------------- reveals */
  const revealed = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); revealed.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => (still ? el.classList.add("in") : revealed.observe(el)));

  /* the statement: its words, one after another */
  const say = document.querySelector(".st-say");
  if (say && !still) {
    const words = say.textContent.trim().split(/\s+/);
    say.textContent = "";
    words.forEach((w, i) => {
      const s = document.createElement("span");
      s.textContent = w;
      s.style.setProperty("--w", `${i * 45}ms`);
      say.append(s, document.createTextNode(" "));
    });
  }

  /* the figures count up once, as they arrive */
  const counters = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      counters.unobserve(e.target);
      const el = e.target, to = Number(el.dataset.count), start = performance.now(), dur = 1400;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur), v = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(to * v));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  if (!still) document.querySelectorAll("[data-count]").forEach((el) => counters.observe(el));

  /* ---------------------------------------------------------------- the films */
  const films = [...document.querySelectorAll("[data-video]")].map((box) => {
    const video = box.querySelector("video"), pill = box.querySelector("[data-toggle]"), label = pill.querySelector("[data-label]");
    video.muted = true;
    video.defaultMuted = true;
    const state = { inView: false, byVisitor: false };
    const show = () => { const playing = !video.paused; pill.setAttribute("aria-pressed", playing ? "true" : "false"); if (label) label.textContent = playing ? "Pause" : "Play"; };
    const play = () => video.play().then(show).catch(() => {});
    const pause = () => { video.pause(); show(); };
    pill.addEventListener("click", () => { state.byVisitor = !video.paused; if (video.paused) play(); else pause(); });
    video.addEventListener("play", show);
    video.addEventListener("pause", show);
    return { box, video, state, play, pause };
  });
  if (!still) {
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const f = films.find((x) => x.box === e.target);
        if (!f) continue;
        f.state.inView = e.isIntersecting;
        if (e.isIntersecting && !f.state.byVisitor && !document.hidden) f.play();
        else if (!e.isIntersecting && !f.video.paused) f.pause();
      }
    }, { threshold: 0.25 });
    films.forEach((f) => seen.observe(f.box));
    document.addEventListener("visibilitychange", () => {
      for (const f of films) { if (document.hidden) f.pause(); else if (f.state.inView && !f.state.byVisitor) f.play(); }
    });
  }

  /* ---------------------------------------------------------------- the sheets, as a dialog */
  const dialog = document.querySelector("[data-dialog]");
  const body = dialog && dialog.querySelector("[data-dialog-body]");
  let opener = null, parked = null;
  const close = () => {
    if (!dialog.open) return;
    dialog.close();
  };
  if (dialog && typeof dialog.showModal === "function") {
    document.querySelectorAll(".st-more").forEach((details) => {
      const summary = details.querySelector("summary"), sheet = details.querySelector("[data-sheet]");
      summary.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (dialog.open) close();
        parked = { details, sheet };
        body.replaceChildren(sheet);
        opener = summary;
        dialog.setAttribute("aria-label", sheet.querySelector(".st-sheet__title")?.textContent || "Note");
        dialog.showModal();
      });
    });
    dialog.addEventListener("close", () => {
      if (parked) { parked.details.append(parked.sheet); parked = null; }
      if (opener) { opener.focus({ preventScroll: true }); opener = null; }
    });
    dialog.querySelector("[data-close]").addEventListener("click", close);
    dialog.addEventListener("click", (ev) => { if (ev.target === dialog) close(); });
    /* on a phone, a downward swipe on the card puts it away */
    const card = dialog.querySelector(".st-dialog__card");
    let drag = null;
    card.addEventListener("pointerdown", (ev) => {
      if (matchMedia("(min-width: 768px)").matches || ev.target.closest("button")) return;
      drag = { y: ev.clientY, t: performance.now(), dy: 0 };
      card.setPointerCapture(ev.pointerId);
    });
    card.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      drag.dy = Math.max(0, ev.clientY - drag.y);
      card.style.transition = "none";
      card.style.transform = `translateY(${drag.dy}px)`;
    });
    const letGo = () => {
      if (!drag) return;
      const speed = drag.dy / Math.max(1, performance.now() - drag.t);
      card.style.transition = "";
      card.style.transform = "";
      if (drag.dy > 120 || speed > 0.6) close();
      drag = null;
    };
    card.addEventListener("pointerup", letGo);
    card.addEventListener("pointercancel", letGo);
  }

  /* ---------------------------------------------------------------- the gallery */
  document.querySelectorAll("[data-gallery]").forEach((gallery) => {
    const track = gallery.querySelector(".st-gallery__track"), slides = [...track.children];
    const notches = [...gallery.querySelectorAll("[data-notch]")], arrows = [...gallery.querySelectorAll("[data-dir]")];
    const notchBox = gallery.querySelector(".st-notches");
    let index = 0, dx = 0, drag = null;
    const perView = () => (matchMedia("(min-width: 1024px)").matches ? 3 : 1);
    const stops = () => Math.max(1, slides.length - perView() + 1);
    const step = () => slides[0].getBoundingClientRect().width + 16;
    const paint = () => {
      const at = Math.min(index, stops() - 1);
      index = at;
      track.style.transform = `translate3d(${-at * step() + dx}px,0,0)`;
      notches.forEach((n, i) => { const on = i === at && i < stops(); n.toggleAttribute("aria-current", on); n.tabIndex = on ? 0 : -1; n.hidden = i >= stops(); });
      arrows[0].disabled = at === 0;
      arrows[1].disabled = at >= stops() - 1;
      notchBox.style.setProperty("--notches", String(stops()));
      slides.forEach((s, i) => s.toggleAttribute("aria-hidden", i < at || i >= at + perView()));
    };
    const go = (i, focus) => { index = Math.max(0, Math.min(i, stops() - 1)); paint(); if (focus) notches[index].focus(); };
    arrows.forEach((a) => a.addEventListener("click", () => { const next = index + Number(a.dataset.dir); go(next); if (next <= 0 || next >= stops() - 1) arrows[a.dataset.dir === "-1" ? 1 : 0].focus(); }));
    notches.forEach((n, i) => {
      n.addEventListener("click", () => go(i));
      n.addEventListener("keydown", (ev) => { if (ev.key === "ArrowRight") { ev.preventDefault(); go(index + 1, true); } else if (ev.key === "ArrowLeft") { ev.preventDefault(); go(index - 1, true); } });
    });
    track.addEventListener("pointerdown", (ev) => { if (ev.pointerType === "mouse" && ev.button !== 0) return; drag = { x: ev.clientX, y: ev.clientY, on: false, t: performance.now(), v: 0 }; });
    track.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const mx = ev.clientX - drag.x;
      if (!drag.on && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(ev.clientY - drag.y)) { drag.on = true; track.setPointerCapture(ev.pointerId); track.style.transition = "none"; }
      if (drag.on) { drag.v = (mx - dx) / Math.max(1, performance.now() - drag.t); drag.t = performance.now(); dx = mx; paint(); }
    });
    const up = () => {
      if (!drag) return;
      const was = drag; drag = null;
      track.style.transition = "";
      if (was.on) { const fling = was.v * 180; const moved = dx + fling; if (moved < -60) index += Math.max(1, Math.round(-moved / step())); else if (moved > 60) index -= Math.max(1, Math.round(moved / step())); }
      dx = 0; paint();
    };
    track.addEventListener("pointerup", up);
    track.addEventListener("pointercancel", up);
    addEventListener("resize", paint);
    paint();
  });

  /* ---------------------------------------------------------------- the rail */
  const rail = [...document.querySelectorAll("[data-rail]")];
  if (rail.length) {
    const current = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) rail.forEach((a) => a.toggleAttribute("aria-current", a.dataset.rail === e.target.id));
    }, { rootMargin: "-40% 0px -50% 0px" });
    rail.forEach((a) => { const sec = document.getElementById(a.dataset.rail); if (sec) current.observe(sec); });
  }

  if (still) return;

  /* ---------------------------------------------------------------- parallax and magnets */
  const stages = [...document.querySelectorAll("[data-parallax]")];
  let ticking = false;
  const settle = () => {
    ticking = false;
    const vh = innerHeight;
    for (const el of stages) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const p = (r.top + r.height / 2 - vh / 2) / vh; // -0.5 … 0.5 across the window
      el.style.transform = `translate3d(0,${(-p * 36).toFixed(1)}px,0)`;
    }
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(settle); } }, { passive: true });
  settle();

  document.querySelectorAll(".st-magnet, .st-more > summary, .st-pill, .st-gallery__arrow").forEach((el) => {
    el.addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = ev.clientX - (r.left + r.width / 2), y = ev.clientY - (r.top + r.height / 2);
      el.style.transition = `transform .25s ${EASE}`;
      el.style.transform = `translate(${(x * 0.22).toFixed(1)}px,${(y * 0.22).toFixed(1)}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transition = `transform .6s ${EASE}`; el.style.transform = ""; });
  });
})();
