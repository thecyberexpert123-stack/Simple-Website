/* =====================================================================
   HUMANITY — js/motion.js
   The motion layer for the monument (everything after the film):

     · Lenis inertia scroll, driven by GSAP's ticker (one clock)
     · ScrollTrigger choreography: headings split into words/lines and
       rise in, section parallax, pinned progress, scrubbed backgrounds
     · SplitText hero + section titles with masked line reveals
     · Magnetic buttons, 3-D tilt on cards/tiles, a soft cursor lens
     · Nav anchors → smooth Lenis scroll

   Everything is optional: if GSAP/Lenis fail to load, or the user prefers
   reduced motion, the CSS `.reveal` fallback in app.js still runs and the
   page is fully usable. Nothing here touches the film (js/film.js).
   ===================================================================== */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  if (!window.gsap) return; // vendor missing — CSS fallback only
  const { gsap } = window;
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);
  if (window.CustomEase) { gsap.registerPlugin(CustomEase); CustomEase.create('out', '0.16, 1, 0.3, 1'); CustomEase.create('io', '0.65, 0, 0.35, 1'); }
  const OUT = window.CustomEase ? 'out' : 'expo.out';
  document.documentElement.classList.add('has-motion');

  let lenis = null;
  const Motion = { lenis: null, started: false, ready: false, scrollTo };

  /* ---------------------------------------------------------------- */
  /* Smooth scroll                                                     */
  /* ---------------------------------------------------------------- */
  function startLenis() {
    if (lenis || reduced || !window.Lenis) return;
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.4, smoothWheel: true, syncTouch: false, anchors: false, prevent: (n) => n.closest && (n.closest('#modal') || n.closest('.nav-links.open')) });
    lenis.on('scroll', () => window.ScrollTrigger && ScrollTrigger.update());
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    Motion.lenis = lenis;
    document.documentElement.classList.add('lenis-on');
  }
  function scrollTo(target, opts = {}) {
    const node = typeof target === 'string' ? $(target) : target; if (!node) return;
    if (lenis) lenis.scrollTo(node, { offset: opts.offset ?? -8, duration: opts.duration ?? 1.4, easing: (x) => 1 - Math.pow(1 - x, 4), lock: false });
    else node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: opts.block || 'start' });
  }
  /* body.locked (gate / modal) should freeze inertia too */
  new MutationObserver(() => { if (!lenis) return; if (document.body.classList.contains('locked')) lenis.stop(); else lenis.start(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* nav + in-page anchors */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a || a.id === 'skip-film') return;
    const id = a.getAttribute('href'); if (id.length < 2) return; const node = $(id); if (!node) return;
    e.preventDefault(); history.replaceState(null, '', id); scrollTo(node);
  });

  /* ---------------------------------------------------------------- */
  /* Text splitting                                                    */
  /* ---------------------------------------------------------------- */
  const splits = [];
  function splitLines(node, type) {
    if (!window.SplitText) return null;
    try { const s = SplitText.create(node, { type: type || 'lines,words', mask: 'lines', linesClass: 'ln', wordsClass: 'wd', autoSplit: true, onSplit: () => undefined }); splits.push(s); return s; } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- */
  /* Section choreography                                              */
  /* ---------------------------------------------------------------- */
  function buildScroll() {
    if (!window.ScrollTrigger) return;
    ScrollTrigger.defaults({ toggleActions: 'play none none none' });

    // section heads: eyebrow → title (lines) → lede (lines) — replaces the plain CSS reveal for these
    $$('.section-head, .finale-inner').forEach((head) => {
      const eyebrow = $('.eyebrow', head), title = $('.h2, .finale-title', head), lede = $('.lede, .finale-text', head);
      const tl = gsap.timeline({ scrollTrigger: { trigger: head, start: 'top 82%' } });
      if (eyebrow) { eyebrow.classList.add('in'); tl.from(eyebrow, { opacity: 0, x: -14, duration: 0.7, ease: OUT }, 0); }
      if (title) {
        title.classList.add('in');
        const s = reduced ? null : splitLines(title, 'lines,words');
        if (s && s.words.length) tl.from(s.words, { yPercent: 110, rotate: 2, opacity: 0, duration: 1.1, ease: OUT, stagger: { each: 0.035, from: 'start' } }, 0.08);
        else tl.from(title, { opacity: 0, y: 24, duration: 1, ease: OUT }, 0.08);
      }
      if (lede) {
        lede.classList.add('in');
        const s = reduced ? null : splitLines(lede, 'lines');
        if (s && s.lines.length) tl.from(s.lines, { yPercent: 100, opacity: 0, duration: 0.9, ease: OUT, stagger: 0.07 }, 0.3);
        else tl.from(lede, { opacity: 0, y: 18, duration: 0.9, ease: OUT }, 0.3);
      }
    });

    // remaining .reveal items: staggered by proximity, in batches, so grids bloom rather than pop one by one
    const rest = $$('.reveal:not(.in)');
    rest.forEach((n) => n.classList.add('gs'));
    if (rest.length) ScrollTrigger.batch(rest, { start: 'top 88%', batchMax: 8, onEnter: (els) => { gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: OUT, stagger: { each: 0.08, from: 'start' }, overwrite: true, onStart: () => els.forEach((n) => n.classList.add('in')) }); } });

    // gentle depth: eras, quotes and cards drift at different speeds
    if (!reduced) {
      $$('.era-card').forEach((c, i) => gsap.fromTo(c, { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: 0.6 } }));
      $$('.section-head').forEach((h) => gsap.fromTo(h, { y: 0 }, { y: -30, ease: 'none', scrollTrigger: { trigger: h.closest('.section') || h, start: 'top top', end: 'bottom top', scrub: 0.8 } }));
      const hero = $('#hero .hero-inner'); if (hero) gsap.to(hero, { yPercent: 18, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.5 } });
      const finale = $('#finale .finale-inner'); if (finale) gsap.fromTo(finale, { scale: 0.94, opacity: 0.6 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#finale', start: 'top 90%', end: 'top 30%', scrub: 0.6 } });
    }

    // horizontal rule that draws itself under each section head
    $$('.section-head').forEach((h) => { const r = document.createElement('i'); r.className = 'head-rule'; h.appendChild(r); gsap.from(r, { scaleX: 0, transformOrigin: '0 50%', duration: 1.4, ease: OUT, scrollTrigger: { trigger: h, start: 'top 80%' } }); });

    // nav progress hairline is already scroll-driven in app.js; add a section "chapter" counter to the nav
    const counter = document.createElement('span'); counter.className = 'nav-counter mono'; counter.textContent = '01 / 09'; const tools = $('#nav .nav-tools'); if (tools) tools.insertBefore(counter, tools.firstChild); else $('#nav')?.appendChild(counter);
    $$('main > section.section, section.section').forEach((sec, i, all) => ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (st) => { if (st.isActive) { counter.textContent = `${String(i + 1).padStart(2, '0')} / ${String(all.length).padStart(2, '0')}`; counter.classList.remove('tick'); void counter.offsetWidth; counter.classList.add('tick'); } } }));
  }

  /* ---------------------------------------------------------------- */
  /* Hero entrance (called by app.enter through the hook below)        */
  /* ---------------------------------------------------------------- */
  function heroIn() {
    const title = $('#hero-title'); if (!title) return;
    const letters = $$('span', title); if (!letters.length) return;
    title.classList.add('in', 'gs');
    gsap.set(letters, { opacity: 0, yPercent: 60, rotateX: 40, transformOrigin: '50% 100%', transitionDelay: 0 });
    const tl = gsap.timeline({ defaults: { ease: OUT } });
    tl.to(letters, { opacity: 1, yPercent: 0, rotateX: 0, duration: 1.4, stagger: { each: 0.06, from: 'center' } }, 0.25)
      .from('.hero-eyebrow', { opacity: 0, y: -10, duration: 0.9 }, 0.1)
      .from('.hero-sub', { opacity: 0, y: 16, duration: 1 }, 0.9)
      .from('.hero-meta > *', { opacity: 0, y: 12, duration: 0.8, stagger: 0.08 }, 1.05)
      .from('.hero-scroll', { opacity: 0, duration: 1 }, 1.6);
  }

  /* ---------------------------------------------------------------- */
  /* Pointer craft: magnetic buttons, tilt, cursor lens                */
  /* ---------------------------------------------------------------- */
  function pointerCraft() {
    if (!fine || reduced) return;
    // magnetic
    const magnets = $$('.btn, .tab, .nav-links a, #sound-btn, #fs-btn, .video-tile .play');
    magnets.forEach((m) => {
      const strength = m.classList.contains('tab') ? 0.18 : 0.28; let raf = 0;
      m.addEventListener('pointermove', (e) => { const r = m.getBoundingClientRect(); const dx = (e.clientX - (r.left + r.width / 2)) * strength, dy = (e.clientY - (r.top + r.height / 2)) * strength; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => gsap.to(m, { x: dx, y: dy, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })); });
      m.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); gsap.to(m, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' }); });
    });
    // tilt
    const tiltables = () => $$('.card, .video-tile, .num, .era-card, .quote.on > div, .mark');
    document.addEventListener('pointermove', (e) => {
      const t = e.target.closest && e.target.closest('.card, .video-tile, .num, .era-card, .mark'); if (!t) return;
      const r = t.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      const amt = t.classList.contains('era-card') ? 2.5 : 6;
      gsap.to(t, { rotateY: px * amt, rotateX: -py * amt, transformPerspective: 900, transformOrigin: '50% 50%', duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
      t.style.setProperty('--mx', (px + 0.5).toFixed(3)); t.style.setProperty('--my', (py + 0.5).toFixed(3));
    }, { passive: true });
    document.addEventListener('pointerout', (e) => { const t = e.target.closest && e.target.closest('.card, .video-tile, .num, .era-card, .mark'); if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return; gsap.to(t, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' }); }, { passive: true });
    void tiltables;
    // cursor lens
    const cur = document.createElement('div'); cur.className = 'lens'; cur.setAttribute('aria-hidden', 'true'); cur.innerHTML = '<i></i><b></b>'; document.body.appendChild(cur);
    const dot = cur.querySelector('i'), ring = cur.querySelector('b');
    const qx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' }), qy = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
    let shown = false;
    addEventListener('pointermove', (e) => { if (e.pointerType && e.pointerType !== 'mouse') return; if (!shown) { shown = true; document.documentElement.classList.add('lens-on'); } qx(e.clientX); qy(e.clientY); dx(e.clientX); dy(e.clientY); const hot = e.target.closest && e.target.closest('a, button, [role=button], input, .video-tile, .card, #cal-range'); cur.classList.toggle('hot', !!hot); cur.classList.toggle('drag', !!(hot && hot.id === 'cal-range')); }, { passive: true });
    addEventListener('pointerdown', () => cur.classList.add('down')); addEventListener('pointerup', () => cur.classList.remove('down'));
    document.addEventListener('mouseleave', () => cur.classList.add('hide')); document.addEventListener('mouseenter', () => cur.classList.remove('hide'));
  }

  /* ---------------------------------------------------------------- */
  /* Boot: wait for the monument to be entered (film end / skip)       */
  /* ---------------------------------------------------------------- */
  function start() {
    if (Motion.started) return; Motion.started = true;
    startLenis();
    heroIn();
    // deep link (#numbers etc.): app.enter() resets scroll to 0, so honour the hash ourselves once Lenis owns the scroll
    const hash = location.hash; if (hash && hash !== '#hero' && $(hash)) requestAnimationFrame(() => { const node = $(hash); if (lenis) { lenis.scrollTo(node, { immediate: true, force: true, offset: -8 }); } else node.scrollIntoView(); });
    // let app.js finish building the DOM (galleries render on tab switch) then choreograph
    requestAnimationFrame(() => { buildScroll(); pointerCraft(); Motion.ready = true; if (window.ScrollTrigger) ScrollTrigger.refresh(); });
    // galleries re-render their grid on tab change; keep new items animated
    const grid = $('#cards'); if (grid) new MutationObserver(() => { if (!window.ScrollTrigger) return; const fresh = $$('.reveal:not(.in):not(.gs)', grid); if (!fresh.length) return; fresh.forEach((n) => n.classList.add('gs')); ScrollTrigger.batch(fresh, { start: 'top 92%', onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: OUT, stagger: 0.06, onStart: () => els.forEach((n) => n.classList.add('in')) }) }); ScrollTrigger.refresh(); }).observe(grid, { childList: true });
    addEventListener('resize', () => window.ScrollTrigger && ScrollTrigger.refresh(), { passive: true });
  }
  // app.js calls HumanityApp.enter(); we wrap it so motion starts exactly then
  const hook = () => { const app = window.HumanityApp; if (!app || app.__motion) return false; const orig = app.enter; app.enter = function () { const r = orig.apply(this, arguments); start(); return r; }; app.__motion = true; return true; };
  if (!hook()) document.addEventListener('DOMContentLoaded', hook);
  // if the page was entered before this ran (nofilm / hash entry), start now
  if (!document.body.classList.contains('locked') && document.getElementById('nav')?.classList.contains('show')) start();
  window.Motion = Motion;
})();
