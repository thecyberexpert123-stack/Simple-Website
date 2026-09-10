/* =====================================================================
   HUMANITY — app.js
   Wires the data to the page: gate, navigation, scene switching,
   cosmic calendar, journey, galleries + modal, numbers, live counters,
   personal timeline, voices, finale.
   ===================================================================== */
(function () {
  'use strict';

  const D = window.HUMANITY;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  // YouTube thumbnails: try the 1280px maxres frame first; not every video has one, so fall back to sd (640) then hq (480).
  const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  const YT_FALLBACK = ['sddefault', 'hqdefault'];
  document.addEventListener('error', (e) => {
    const im = e.target; if (!(im instanceof HTMLImageElement) || !/i\.ytimg\.com\/vi\//.test(im.src)) return;
    const step = +(im.dataset.fb || 0); if (step >= YT_FALLBACK.length) return;
    im.dataset.fb = step + 1; im.src = im.src.replace(/\/[a-z]+default\.jpg$/, `/${YT_FALLBACK[step]}.jpg`);
  }, true);
  // maxresdefault can also "succeed" with a 120×90 grey placeholder — treat that as a miss too
  document.addEventListener('load', (e) => {
    const im = e.target; if (!(im instanceof HTMLImageElement) || !/i\.ytimg\.com\/vi\//.test(im.src)) return;
    if (im.naturalWidth <= 120) { const step = +(im.dataset.fb || 0); if (step < YT_FALLBACK.length) { im.dataset.fb = step + 1; im.src = im.src.replace(/\/[a-z]+default\.jpg$/, `/${YT_FALLBACK[step]}.jpg`); } }
  }, true);

  /* ---------------------------------------------------------------- */
  /* Toast                                                            */
  /* ---------------------------------------------------------------- */
  const toastEl = $('#toast'); let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }

  /* ---------------------------------------------------------------- */
  /* Gate                                                             */
  /* ---------------------------------------------------------------- */
  const nav = $('#nav'), soundBtn = $('#sound-btn');
  const heroTitle = $('#hero-title');
  'HUMANITY'.split('').forEach((ch, i) => { const s = el('span', null, ch); s.style.transitionDelay = (0.3 + i * 0.08) + 's'; heroTitle.appendChild(s); });

  let entered = false;
  /* The film (js/film.js) calls this when it ends or is skipped.
     opts.music: the film's soundtrack keeps playing — the sound button then controls it. */
  function enter(withSound, opts = {}) {
    if (entered) return; entered = true;
    document.body.classList.remove('locked');
    nav.classList.add('show');
    if (!window.gsap) setTimeout(() => heroTitle.classList.add('in'), 300); // with GSAP, motion.js choreographs the hero
    if (opts.music) { soundBtn.setAttribute('aria-pressed', 'true'); soundBtn.title = 'Soundtrack'; soundBtn.setAttribute('aria-label', 'Toggle soundtrack'); }
    else if (opts.ambient) soundBtn.setAttribute('aria-pressed', 'true');
    else if (withSound) { Ambient.enable(); soundBtn.setAttribute('aria-pressed', 'true'); }
    window.scrollTo(0, 0);
    Cosmos.setMode('stars');
  }
  window.HumanityApp = { enter, toast };
  soundBtn.addEventListener('click', () => {
    if (window.Film?.musicActive()) { const on = window.Film.toggleMusic(); soundBtn.setAttribute('aria-pressed', String(on)); toast(on ? 'Soundtrack on' : 'Soundtrack muted'); return; }
    const on = Ambient.toggle(); soundBtn.setAttribute('aria-pressed', String(on)); toast(on ? 'Ambient sound on' : 'Ambient sound off');
  });
  $('#fs-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => toast('Fullscreen not available'));
    else document.exitFullscreen?.();
  });

  /* ---------------------------------------------------------------- */
  /* Navigation                                                       */
  /* ---------------------------------------------------------------- */
  const navLinks = $('#nav-links'), menuBtn = $('#menu-btn'), progress = $('#progress');
  menuBtn.addEventListener('click', () => { const open = navLinks.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(open)); });
  navLinks.addEventListener('click', (e) => { if (e.target.tagName === 'A') { navLinks.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });
  function onScroll() {
    const h = document.documentElement; const max = h.scrollHeight - h.clientHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    nav.classList.toggle('solid', window.scrollY > 40);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------------------------------------------------------------- */
  /* Reveal                                                           */
  /* ---------------------------------------------------------------- */
  const revealIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  const observeReveals = (root = document) => $$('.reveal:not(.in)', root).forEach((n) => revealIO.observe(n));

  /* ---------------------------------------------------------------- */
  /* Scene switching (backdrop + chord + nav highlight)               */
  /* ---------------------------------------------------------------- */
  const CHORD = { hero: 0, calendar: 1, journey: 2, galleries: 0, numbers: 3, live: 1, you: 2, voices: 3, finale: 0 };
  const sceneIO = new IntersectionObserver((es) => {
    if (document.body.classList.contains('filming')) return; // the film drives the cosmos while it runs
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      const scene = e.target.dataset.scene; if (scene) Cosmos.setMode(scene);
      const sec = e.target.closest('section'); if (!sec) return;
      if (CHORD[sec.id] != null) Ambient.setChord(CHORD[sec.id]);
      $$('.nav-links a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + sec.id));
      if (sec.id === 'journey' && e.target.classList.contains('era')) {
        const idx = +e.target.dataset.i; $$('#era-nav li').forEach((li, i) => li.classList.toggle('on', i === idx));
        Ambient.setChord(idx % 4);
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  $$('[data-scene]').forEach((n) => sceneIO.observe(n));

  /* ---------------------------------------------------------------- */
  /* Cosmic calendar                                                  */
  /* ---------------------------------------------------------------- */
  (function calendar() {
    const AGE = D.UNIVERSE_AGE, SEC_YEAR = 365 * 86400, YRS_PER_SEC = AGE / SEC_YEAR;
    const range = $('#cal-range'), fill = $('#cal-fill'), marks = $('#cal-marks'), months = $('#cal-months');
    const dayEl = $('#cal-day'), clockEl = $('#cal-clock'), titleEl = $('#cal-title'), noteEl = $('#cal-note'), agoEl = $('#cal-ago');
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const ZOOM = { year: [0, 1], december: [334 / 365, 1], day: [364 / 365, 1], minute: [1 - 60 / SEC_YEAR, 1] };
    let zoom = 'year', playing = false, raf = null, lastTitle = null;
    const events = D.cosmicEvents.map((e) => ({ ...e, f: 1 - e.yearsAgo / AGE })).sort((a, b) => a.f - b.f);

    const agoText = (y) => y <= 0 ? 'now' : y >= 1e9 ? fmt(y / 1e9, 2).replace(/\.?0+$/, '') + ' billion years ago' : y >= 1e6 ? fmt(y / 1e6, 1).replace(/\.0$/, '') + ' million years ago' : fmt(Math.round(y)) + ' years ago';
    const pad = (n) => String(n).padStart(2, '0');

    function dateOf(f) {
      let day = f * 365; let m = 0;
      while (m < 11 && day >= MLEN[m]) { day -= MLEN[m]; m++; }
      const dInt = Math.min(MLEN[m] - 1, Math.floor(day));
      const frac = day - Math.floor(day);
      const secs = Math.min(86399.999, frac * 86400);
      return { month: MONTHS[m], day: dInt + 1, h: Math.floor(secs / 3600), mi: Math.floor(secs % 3600 / 60), s: secs % 60 };
    }
    function ticks() {
      months.innerHTML = '';
      const labels = zoom === 'year' ? MONTHS.map((m) => m.slice(0, 3))
        : zoom === 'december' ? Array.from({ length: 12 }, (_, i) => 'Dec ' + (1 + Math.round(i * 31 / 12)))
        : zoom === 'day' ? Array.from({ length: 12 }, (_, i) => pad(i * 2) + ':00')
        : Array.from({ length: 12 }, (_, i) => '23:59:' + pad(i * 5));
      labels.forEach((l) => months.appendChild(el('span', null, l)));
    }
    function placeMarks() {
      marks.innerHTML = '';
      const [lo, hi] = ZOOM[zoom];
      events.forEach((e, i) => {
        if (e.f < lo || e.f > hi) return;
        const b = el('button'); b.style.left = ((e.f - lo) / (hi - lo) * 100) + '%'; b.title = e.title; b.setAttribute('aria-label', e.title); b.dataset.i = i;
        b.addEventListener('click', () => { stop(); range.value = Math.round((e.f - lo) / (hi - lo) * 100000); update(); });
        marks.appendChild(b);
      });
    }
    function update() {
      const [lo, hi] = ZOOM[zoom]; const f = lo + (hi - lo) * (range.value / 100000);
      const yearsAgo = Math.max(0, AGE * (1 - f));
      const d = dateOf(Math.min(f, 0.9999999999));
      dayEl.textContent = `${d.month} ${d.day}`;
      const showMs = zoom === 'minute' || zoom === 'day';
      clockEl.textContent = `${pad(d.h)}:${pad(d.mi)}:${pad(Math.floor(d.s))}` + (showMs ? '.' + String(Math.floor((d.s % 1) * 100)).padStart(2, '0') : '');
      fill.style.width = (range.value / 1000) + '%';
      // most recent event that has already happened
      let cur = events[0];
      for (const e of events) { if (e.f <= f + 1e-12) cur = e; else break; }
      if (cur.title !== lastTitle) { lastTitle = cur.title; titleEl.textContent = cur.title; noteEl.textContent = cur.note; titleEl.animate?.([{ opacity: 0.2, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' }); }
      agoEl.textContent = (f >= 1 ? 'Now — ' : agoText(yearsAgo) + ' — ') + `1 second here = ${fmt(YRS_PER_SEC)} years`;
      $$('button', marks).forEach((b) => b.classList.toggle('on', events[b.dataset.i] === cur));
    }
    function setZoom(z) {
      zoom = z; $$('.cal-zoom .chip[data-zoom]').forEach((c) => c.classList.toggle('on', c.dataset.zoom === z));
      range.value = z === 'year' ? 0 : 0; ticks(); placeMarks(); update();
    }
    function stop() { playing = false; cancelAnimationFrame(raf); $('#cal-play').textContent = '▶ Play'; }
    function play() {
      if (playing) return stop();
      playing = true; $('#cal-play').textContent = '❚❚ Pause';
      if (+range.value >= 100000) range.value = 0;
      const dur = (zoom === 'year' ? 60 : 30) * 1000; const start = performance.now(); const from = +range.value;
      const step = (now) => {
        if (!playing) return;
        const k = Math.min(1, (now - start) / dur * (1 - from / 100000) + 0); // constant speed across remaining range
        const v = from + (100000 - from) * Math.min(1, (now - start) / (dur * (1 - from / 100000)));
        range.value = Math.round(v); update();
        if (v >= 100000) return stop();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    range.addEventListener('input', () => { stop(); update(); });
    $$('.cal-zoom .chip[data-zoom]').forEach((c) => c.addEventListener('click', () => { stop(); setZoom(c.dataset.zoom); }));
    $('#cal-play').addEventListener('click', play);
    setZoom('year');
  })();

  /* ---------------------------------------------------------------- */
  /* Video tile + modal                                               */
  /* ---------------------------------------------------------------- */
  const modal = $('#modal'), mMedia = $('#modal-media');
  let lastFocus = null;
  function videoTile(v, cls = '') {
    const b = el('button', 'video-tile ' + cls);
    b.type = 'button'; b.setAttribute('aria-label', 'Play video: ' + v.title);
    b.innerHTML = `<img src="${posterFor(v)}" alt="" loading="lazy"><span class="play">${PLAY_SVG}</span><span class="cap"><b>${esc(v.title)}</b>${esc(v.source)}</span>`;
    b.addEventListener('click', () => openModal({ title: v.title, sub: v.source, video: v }));
    return b;
  }
  /* Video sources. Where an archival clip exists on Wikimedia Commons we play it ourselves; anything else is an
     honest link out to the publisher — there is no embedded YouTube player anywhere on the site. */
  const clipFor = (v) => (v.clip && window.FILM_SCRIPT?.CLIPS?.[v.clip]) || null;
  const posterFor = (v) => { const c = clipFor(v); if (c && window.FILM_SCRIPT) { const st = window.FILM_SCRIPT.IMAGES[c.fallback]; const w = (devicePixelRatio || 1) > 1.5 ? 2560 : 1600; return window.FILM_LOCAL?.clips?.[v.clip]?.poster || (st ? window.FILM_SCRIPT.urlFor(st, w) : window.FILM_SCRIPT.clipPoster(c, w > 1600 ? 1920 : 1280)); } return v.id ? ytThumb(v.id) : ''; };
  function extCard(v) {
    const a = el('a', 'ext-card'); a.href = `https://www.youtube.com/watch?v=${v.id}`; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = `<img src="${ytThumb(v.id)}" alt=""><span class="play">${PLAY_SVG}</span><span class="cap"><b>${esc(v.title)}</b>${esc(v.source)} — opens on YouTube ↗</span>`;
    return a;
  }
  function openModal(item, accent) {
    lastFocus = document.activeElement;
    modal.hidden = false; requestAnimationFrame(() => modal.classList.add('open'));
    document.body.classList.add('locked');
    modal.style.setProperty('--accent', accent || 'var(--gold)');
    $('#modal-year').textContent = item.year != null ? (item.year < 0 ? `c. ${fmt(-item.year)} BCE` : item.year) : '';
    $('#modal-title').textContent = item.title; $('#modal-sub').textContent = item.sub || '';
    $('#modal-text').textContent = item.text || '';
    const facts = $('#modal-facts'); facts.innerHTML = ''; (item.facts || []).forEach((f) => facts.appendChild(el('div', null, esc(f))));
    const src = $('#modal-src');
    if (item.video) {
      mMedia.hidden = false; mMedia.innerHTML = '';
      const v = item.video; const clip = clipFor(v);
      if (clip) {
        // native player: the full public-domain / CC file from Wikimedia Commons, no third-party embed
        const vid = document.createElement('video'); vid.controls = true; vid.autoplay = true; vid.playsInline = true; vid.preload = 'metadata'; vid.setAttribute('title', v.title);
        vid.poster = posterFor(v); const S = window.FILM_SCRIPT; const local = window.FILM_LOCAL?.clips?.[v.clip];
        const px = Math.round(Math.min(innerWidth, 1200) * Math.min(3, devicePixelRatio || 1)); const slow = navigator.connection && (navigator.connection.saveData || /(^|[^0-9])2g/.test(navigator.connection.effectiveType || ''));
        vid.src = S.clipUrl(clip, slow ? 480 : px >= 1100 ? 1080 : 480);
        vid.addEventListener('error', () => { if (local && vid.src !== local.file) { vid.src = local.file; vid.load(); return; } mMedia.innerHTML = ''; mMedia.appendChild(extCard(v)); }, { once: true });
        vid.addEventListener('play', () => Ambient.duck(true)); vid.addEventListener('pause', () => Ambient.duck(false));
        mMedia.appendChild(vid);
        src.innerHTML = `Footage: <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(clip.file)}" target="_blank" rel="noopener">${esc(clip.title)}</a> · ${esc(clip.license)} · Wikimedia Commons` + (v.id ? ` &nbsp;·&nbsp; <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">original broadcast ↗</a>` : '');
      } else {
        mMedia.appendChild(extCard(v));
        src.innerHTML = `Footage: <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${esc(v.title)}</a> — ${esc(v.source)} (opens on YouTube)`;
      }
    } else { mMedia.hidden = true; mMedia.innerHTML = ''; src.textContent = ''; }
    $('.modal-close').focus();
  }
  function closeModal() {
    modal.classList.remove('open'); document.body.classList.remove('locked');
    mMedia.querySelectorAll('video').forEach((v) => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* noop */ } });
    setTimeout(() => { modal.hidden = true; mMedia.innerHTML = ''; }, 500);
    Ambient.duck(false); lastFocus?.focus?.();
  }
  $$('[data-close]', modal).forEach((n) => n.addEventListener('click', closeModal));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------------------------------------------------------------- */
  /* Journey                                                          */
  /* ---------------------------------------------------------------- */
  (function journey() {
    const wrap = $('#eras'), navList = $('#era-nav');
    D.eras.forEach((era, i) => {
      const li = el('li'); const b = el('button', null, `<small>${esc(era.label)}</small>${esc(era.title)}`);
      b.addEventListener('click', () => { const t = document.getElementById('era-' + era.id); if (window.Motion?.lenis) window.Motion.scrollTo(t, { offset: -(window.innerHeight - t.offsetHeight) / 2 }); else t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); });
      li.appendChild(b); navList.appendChild(li);

      const sec = el('article', 'era'); sec.id = 'era-' + era.id; sec.dataset.scene = era.scene; sec.dataset.i = i;
      const card = el('div', 'era-card glass reveal'); card.dataset.index = String(i + 1).padStart(2, '0');
      card.innerHTML = `<p class="era-label">${esc(era.label)}</p><h3 class="era-title">${esc(era.title)}</h3><p class="era-lede">${esc(era.lede)}</p><p class="era-text">${esc(era.text)}</p><ul class="era-facts">${era.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`;
      if (era.video) { const m = el('div', 'era-media'); m.appendChild(videoTile(era.video)); card.appendChild(m); }
      sec.appendChild(card); wrap.appendChild(sec); sceneIO.observe(sec);
    });
  })();

  /* ---------------------------------------------------------------- */
  /* Galleries                                                        */
  /* ---------------------------------------------------------------- */
  (function galleries() {
    const tabs = $('#tabs'), head = $('#gallery-head'), cards = $('#cards');
    let current = D.galleries[0].id;
    D.galleries.forEach((g) => {
      const b = el('button', 'tab', `<i>${g.icon}</i>${esc(g.title)}`); b.setAttribute('role', 'tab'); b.dataset.id = g.id; b.style.setProperty('--accent', g.accent);
      b.addEventListener('click', () => show(g.id)); tabs.appendChild(b);
    });
    function show(id) {
      current = id; const g = D.galleries.find((x) => x.id === id);
      $$('.tab', tabs).forEach((t) => { const on = t.dataset.id === id; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); });
      document.getElementById('galleries').style.setProperty('--accent', g.accent);
      head.innerHTML = `<h3>${esc(g.title)}</h3><p>${esc(g.tagline)}</p>`;
      cards.innerHTML = '';
      g.items.forEach((it, i) => {
        const c = el('button', 'card'); c.type = 'button'; c.style.animationDelay = (i * 0.06) + 's';
        const art = it.video ? `<div class="art"><img src="${posterFor(it.video)}" alt="" loading="lazy"></div>` : `<div class="art gen"></div>`;
        const year = it.year < 0 ? `c. ${fmt(-it.year)} BCE` : it.year;
        c.innerHTML = `${art}${it.video ? `<span class="has-video" aria-hidden="true">${PLAY_SVG}</span>` : ''}<span class="year">${year}</span><h4>${esc(it.title)}</h4><p>${esc(it.sub)}</p><span class="more">${it.video ? 'Read & watch' : 'Read'}</span>`;
        c.addEventListener('click', () => openModal(it, g.accent));
        cards.appendChild(c);
      });
    }
    show(current);
  })();

  /* ---------------------------------------------------------------- */
  /* Numbers                                                          */
  /* ---------------------------------------------------------------- */
  (function numbers() {
    const wrap = $('#numbers-grid');
    const nodes = D.numbers.map((n, i) => {
      const card = el('div', 'num glass reveal'); card.dataset.delay = String(i % 4);
      const d = n.decimals || 0;
      card.innerHTML = `<div class="label">${esc(n.label)}</div>
        <div class="row"><span class="from">${fmt(n.from, d)}${esc(n.unit)}</span><span class="to ${n.invert ? (n.to < n.from ? 'good' : '') : (n.to > n.from ? 'good' : '')}" data-to="${n.to}" data-d="${d}" data-unit="${esc(n.unit)}">${fmt(n.from, d)}${esc(n.unit)}</span></div>
        <div class="cap"><span>${esc(n.fromLabel)}</span><span>${esc(n.toLabel)}</span></div>
        <div class="bar"><i></i></div><p class="note">${esc(n.note)}</p>`;
      wrap.appendChild(card); return card;
    });
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      const n = D.numbers[nodes.indexOf(e.target)], to = $('.to', e.target), bar = $('.bar i', e.target);
      const d = n.decimals || 0, start = performance.now(), dur = reduced ? 10 : 2400;
      const pct = n.invert ? (n.from ? 1 - n.to / n.from : 0) : (Math.max(n.from, n.to) ? n.to / Math.max(n.from, n.to) : 0);
      requestAnimationFrame(() => bar.style.width = (pct * 100) + '%');
      const tick = (now) => {
        const k = Math.min(1, (now - start) / dur), e2 = 1 - Math.pow(1 - k, 4);
        to.textContent = fmt(n.from + (n.to - n.from) * e2, d) + n.unit;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: 0.5 });
    nodes.forEach((n) => io.observe(n));
  })();

  /* ---------------------------------------------------------------- */
  /* Live                                                             */
  /* ---------------------------------------------------------------- */
  (function live() {
    const L = D.live, t0 = Date.now();
    const pop = $('#live-pop'), voy = $('#live-voy'), moon = $('#live-moon'), iss = $('#live-iss'), born = $('#live-born');
    const LIGHT_HOUR_KM = 1.079e9;
    function tick() {
      const now = Date.now();
      pop.textContent = fmt(L.population.value + (now - L.population.anchor) / 1000 * L.population.perSecond);
      const km = L.voyager1.km + (now - L.voyager1.anchor) / 1000 * L.voyager1.kmPerSecond;
      voy.innerHTML = `${fmt(km)}<small>km</small><span class="sub">${fmt(km / LIGHT_HOUR_KM, 2)} light-hours · ${fmt(km / 1.496e8, 1)} AU</span>`;
      let s = Math.floor((now - L.firstStep) / 1000);
      const y = Math.floor(s / 31557600); s -= y * 31557600; const d = Math.floor(s / 86400); s -= d * 86400;
      const h = Math.floor(s / 3600); s -= h * 3600; const mi = Math.floor(s / 60); s -= mi * 60;
      moon.innerHTML = `${y}<small>yrs</small> ${d}<small>days</small><span class="sub">${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}</span>`;
      iss.textContent = fmt((now - L.issCrewedSince) / 86400000 * L.issOrbitsPerDay);
      born.textContent = fmt((now - t0) / 1000 * L.birthsPerSecond);
    }
    tick(); setInterval(tick, 200);
  })();

  /* ---------------------------------------------------------------- */
  /* You                                                              */
  /* ---------------------------------------------------------------- */
  (function you() {
    const form = $('#you-form'), input = $('#birth-year'), out = $('#you-out');
    const YRS_PER_SEC = D.UNIVERSE_AGE / (365 * 86400);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const y = parseInt(input.value, 10), nowY = new Date().getFullYear();
      if (!y || y < 1900 || y > nowY) { toast('Please enter a year between 1900 and ' + nowY); input.focus(); return; }
      const age = nowY - y;
      const after = D.personalMilestones.filter((m) => m.year >= y), before = D.personalMilestones.length - after.length;
      const heartbeats = age * 365.25 * 24 * 60 * 72;          // ~72 bpm
      const orbitKm = age * 9.4e8;                              // Earth's orbital path per year
      const bornSince = age * 1.35e8;                           // ~135 M births / year (rough)
      const cosmicMs = age / YRS_PER_SEC * 1000;
      const list = [...after.map((m) => ({ ...m, you: false })), { year: y, label: 'you arrived', you: true }].sort((a, b) => a.year - b.year || (a.you ? -1 : 1));
      out.innerHTML = `<div class="you-story">
        <p class="big">You were born in <b>${y}</b>. Since then, humanity has ${after.length ? `achieved <b>${after.length}</b> of the ${D.personalMilestones.length} milestones on this page` : 'kept building on everything that came before'}${before ? ` — and the other ${before} were waiting for you when you arrived` : ''}.</p>
        <div class="you-stats">
          <div><small>Your age</small><b>${age}</b><span>trips around the Sun</span></div>
          <div><small>Distance travelled</small><b>${fmt(orbitKm / 1e9, 1)} bn km</b><span>orbiting the Sun alone</span></div>
          <div><small>Heartbeats, roughly</small><b>${fmt(heartbeats / 1e9, 2)} bn</b><span>and counting</span></div>
          <div><small>Humans born since</small><b>${fmt(bornSince / 1e9, 1)} bn</b><span>each a potential discoverer</span></div>
        </div>
        <ul class="you-list">${list.map((m, i) => `<li class="${m.you ? 'you' : ''}" style="animation-delay:${0.1 + i * 0.05}s"><b>${m.year}</b><span>${m.you ? '✦ ' : ''}${esc(m.label)}</span></li>`).join('')}</ul>
        <p class="you-cosmic">On the cosmic calendar, your entire life so far has lasted <b>${fmt(cosmicMs, 0)} milliseconds</b>. In that blink, the species you belong to photographed a black hole, edited its own genome and flew a helicopter on Mars. What will you do with the next few milliseconds?</p>
      </div>`;
      out.classList.add('in');
      Ambient.setChord(0);
    });
  })();

  /* ---------------------------------------------------------------- */
  /* Voices                                                           */
  /* ---------------------------------------------------------------- */
  (function voices() {
    const stage = $('#quotes'), dots = $('#q-dots'); let i = 0, timer = null;
    D.voices.forEach((v, k) => {
      const q = el('figure', 'quote'); q.innerHTML = `<div><blockquote>${esc(v.quote)}</blockquote><cite>${esc(v.who)}<small>${esc(v.role)}</small></cite></div>`;
      if (v.video) { const b = el('button', 'btn ghost watch', 'Watch'); b.addEventListener('click', () => openModal({ title: v.video.title, sub: v.video.source, video: v.video, text: v.quote })); q.firstChild.appendChild(b); }
      stage.appendChild(q);
      const d = el('button'); d.setAttribute('aria-label', 'Quote ' + (k + 1)); d.addEventListener('click', () => go(k)); dots.appendChild(d);
    });
    const qs = $$('.quote', stage), ds = $$('button', dots);
    function go(k) { i = (k + qs.length) % qs.length; qs.forEach((q, n) => q.classList.toggle('on', n === i)); ds.forEach((d, n) => d.classList.toggle('on', n === i)); restart(); }
    function restart() { clearInterval(timer); if (!reduced) timer = setInterval(() => go(i + 1), 9000); }
    $('#q-prev').addEventListener('click', () => go(i - 1)); $('#q-next').addEventListener('click', () => go(i + 1));
    stage.addEventListener('pointerenter', () => clearInterval(timer)); stage.addEventListener('pointerleave', restart);
    go(0);
  })();

  /* ---------------------------------------------------------------- */
  /* Finale                                                           */
  /* ---------------------------------------------------------------- */
  (function finale() {
    const KEY = 'humanity.star', mark = $('#mark'), input = $('#mark-name'), done = $('#mark-done');
    const light = (name, quiet) => { mark.classList.add('lit'); done.textContent = `✦ Your star is lit, ${name}. It is part of the sky now.`; if (!quiet) toast('A new star in the sky. ✦'); };
    try { const saved = localStorage.getItem(KEY); if (saved) { input.value = saved; light(saved, true); } } catch (e) { /* private mode */ }
    $('#mark-btn').addEventListener('click', () => {
      const name = input.value.trim(); if (!name) { toast('Add a name first'); input.focus(); return; }
      try { localStorage.setItem(KEY, name); } catch (e) { /* ignore */ }
      light(name);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#mark-btn').click(); });
    $('#share-btn').addEventListener('click', async () => {
      const data = { title: 'HUMANITY — A Monument to What We Have Done', text: 'The story of the species that looked up.', url: location.href.split('#')[0] };
      try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast('Link copied'); } } catch (e) { /* cancelled */ }
    });
  })();

  /* ---------------------------------------------------------------- */
  /* Boot                                                             */
  /* ---------------------------------------------------------------- */
  observeReveals();
  // Without the film layer (e.g. it was removed or failed to load), open the monument directly
  // (film.js sets window.Film when it boots; if it never does, the film is not running — open the monument)
  const noFilm = () => { if (!entered && !window.Film) { document.getElementById('film')?.remove(); enter(false); } };
  if (document.readyState === 'complete') noFilm(); else addEventListener('load', noFilm);
})();
