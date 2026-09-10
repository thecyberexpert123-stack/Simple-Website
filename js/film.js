/* =====================================================================
   HUMANITY — film.js
   The editor. Takes FILM_SCRIPT (beats) + a clock (the soundtrack's audio time
   or a local timer) and cuts the picture live in the browser.

   Public API (window.Film):
     musicActive()   → true when the soundtrack is running
     toggleMusic()   → mute/unmute, returns "on"
     seek(sec)       → debug jump
   Query params: ?bpm= ?offset= ?t= ?speed= ?debug=1 ?nofilm=1 ?gl=0
   Keys (debug): T tap tempo · O mark downbeat · ←/→ offset · ↑/↓ bpm · [ ] seek
   ===================================================================== */
(function () {
  'use strict';
  const S = window.FILM_SCRIPT; if (!S) return;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const q = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEBUG = q.get('debug') === '1';
  const isMobile = matchMedia('(max-width: 700px)').matches;

  const film = $('#film'); if (!film) return;
  document.body.classList.add('filming');
  const pre = $('#pre'), gate = $('#fgate'), stage = $('#stage'), slots = $('#slots'), hud = $('#hud');
  const flashEl = $('#fx-flash'), skipBtn = $('#film-skip'), exploreBtn = $('#film-explore');
  const capEl = $('#hud-caption'), creditEl = $('#hud-credit'), tcEl = $('#hud-time'), chapEl = $('#hud-chapter'), codeEl = $('#hud-code'), bpmEl = $('#hud-bpm');
  const yearEl = $('#hud-year'), wordsEl = $('#words'), barsEl = $('#letterbox');
  const beatDots = Array.from(hud.querySelectorAll('.hud-beats i'));
  const progressEl = $('#hud-progress'), debugEl = $('#film-debug'), nowPlaying = $('#now-playing'), nowTitle = $('#now-title');

  /* ---------------------------------------------------------------- */
  /* Skip entirely (deep link / ?nofilm)                              */
  /* ---------------------------------------------------------------- */
  if (q.get('nofilm') === '1' || (location.hash && location.hash !== '#hero')) {
    film.remove(); document.body.classList.remove('filming'); window.HumanityApp?.enter(false, { fromFilm: true }); return;
  }

  /* ---------------------------------------------------------------- */
  /* Timing                                                           */
  /* ---------------------------------------------------------------- */
  const T = { ...S.TIMING };
  if (q.get('bpm')) T.bpm = clamp(parseFloat(q.get('bpm')) || T.bpm, T.minBpm, T.maxBpm);
  if (q.get('offset')) T.offset = parseFloat(q.get('offset')) || 0;
  const spb = () => 60 / T.bpm;                       // seconds per beat
  const beatAt = (t) => (t - T.offset) / spb();
  const timeAt = (beat) => T.offset + beat * spb();

  /* ---------------------------------------------------------------- */
  /* Compile the script into an absolute-beat timeline                */
  /* ---------------------------------------------------------------- */
  const chapters = []; const shots = []; let cursor = 0;
  S.CHAPTERS.forEach((c, ci) => {
    const len = c.bars * 4; const ch = { ...c, index: ci, start: cursor, end: cursor + len, len, shots: [] };
    let b = cursor;
    (c.shots || []).forEach((sh) => {
      const [media, beats, tr, caption, word] = sh;
      const shot = { chapter: ch, index: shots.length, media, beats, tr: tr || 'cut', caption: caption || '', word: word || '', start: b, end: b + beats };
      ch.shots.push(shot); shots.push(shot); b += beats;
    });
    if (c.shots && Math.abs(b - ch.end) > 1e-6) console.warn(`[film] chapter ${c.id}: shots span ${b - cursor} beats, chapter is ${len}`);
    chapters.push(ch); cursor += len;
  });
  const TOTAL_BEATS = cursor;
  const totalSeconds = () => timeAt(TOTAL_BEATS);
  const fmtT = (s) => { s = Math.max(0, s | 0); return `${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------------------------------------------------------------- */
  /* Assets — Commons renditions sized to the screen                  */
  /* ---------------------------------------------------------------- */
  // Rendition width: physical pixels of the long screen edge × the maximum Ken Burns zoom (1.16), snapped to
  // Wikimedia's cached thumb sizes so the picture is never shown larger than its own pixels.
  const KB_MAX = 1.16;
  const pickWidth = () => { const px = Math.round(Math.max(window.innerWidth, window.innerHeight, screen.width || 0) * Math.min(window.devicePixelRatio || 1, 3) * KB_MAX); return px > 2560 ? 3840 : px > 1920 ? 2560 : px > 1280 ? 1920 : 1280; };
  let want = pickWidth();
  addEventListener('resize', () => { const w = pickWidth(); if (w > want) { want = w; Object.values(S.IMAGES).forEach((d) => { if (!d.local) d.src = urlFor(d, want); }); } }, { passive: true });
  const LOWRES = 1500; // originals narrower than this are shown 'contained' on a soft backdrop instead of stretched
  const urlFor = S.urlFor;
  Object.values(S.IMAGES).forEach((d) => { d.src = urlFor(d, want); d.srcLo = urlFor(d, 1280); d.low = d.w < LOWRES; d.page = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(d.file)}`; });

  /* Local media (media/manifest.json, produced by tools/fetch_media.py). When present, stills, clips and the
     soundtrack are served from the repo itself — no YouTube / Wikimedia at runtime. Missing entries fall back. */
  const LOCAL = { audio: null, clips: {}, stills: {} }; window.FILM_LOCAL = LOCAL; // app.js reads it for the modal player
  async function loadManifest() {
    try {
      const r = await fetch('media/manifest.json', { cache: 'no-cache' }); if (!r.ok) return;
      const m = await r.json();
      if (m.audio?.file) LOCAL.audio = m.audio;
      Object.assign(LOCAL.clips, m.clips || {}); Object.assign(LOCAL.stills, m.stills || {});
      Object.entries(LOCAL.stills).forEach(([k, v]) => { const d = S.IMAGES[k]; if (!d) return; d.src = v.file; d.srcLo = v.file; d.local = true; d.low = (v.width || d.w) < LOWRES && d.w < LOWRES; });
    } catch (e) { /* no local media — stream */ }
  }

  const imgState = {}; const imgCache = {};
  function loadImage(key) {
    if (imgState[key]) return imgCache[key];
    const def = S.IMAGES[key]; if (!def) return Promise.resolve(false);
    imgState[key] = 'loading';
    imgCache[key] = new Promise((res) => {
      const im = new Image(); im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; im.crossOrigin = 'anonymous';
      const done = (ok) => { imgState[key] = ok ? 'ok' : 'fail'; res(ok); };
      im.onload = () => done(true);
      im.onerror = () => { if (im.src !== def.srcLo) { def.src = def.srcLo; im.src = def.srcLo; } else done(false); };
      im.src = def.src;
    });
    return imgCache[key];
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r('timeout'), ms))]);
  const keyOf = (m) => (typeof m === 'string' ? m : m.fallback);
  const firstKeys = (() => { const ks = []; shots.slice(0, 16).forEach((s) => { const k = keyOf(s.media); if (k && !ks.includes(k)) ks.push(k); }); return ks; })();
  const allKeys = Object.keys(S.IMAGES);

  /* ---------------------------------------------------------------- */
  /* Music: a plain <audio> element, ambient fallback                */
  /* ---------------------------------------------------------------- */
  const startAt = Math.max(0, parseFloat(q.get('t')) || 0);
  const music = { mode: 'none', audio: null, ready: false, playing: false, failed: false, muted: false, everPlayed: false, wantStart: false };
  const NOW_HTML = nowTitle.innerHTML;
  function showAudioWarn(msg) { nowPlaying.classList.add('show', 'warn'); nowTitle.textContent = msg; }
  function onPlaying() {
    if (!music.everPlayed && startAt > 0) seekMusic(startAt);
    music.playing = true; music.everPlayed = true; clock.syncHard();
    nowPlaying.classList.add('show'); nowPlaying.classList.remove('warn'); nowTitle.innerHTML = NOW_HTML + (LOCAL.audio?.streamed ? '' : ' <i class="mono">· local</i>');
    if (window.Ambient?.enabled) window.Ambient.disable();
  }

  /* -- local file -- */
  function createLocalAudio() {
    const a = new Audio(); a.src = LOCAL.audio.file; a.preload = 'auto'; a.loop = false; a.crossOrigin = 'anonymous'; a.playsInline = true;
    a.addEventListener('ended', () => { music.playing = false; if (finished) { window.Ambient?.enable(); } else { a.currentTime = 0; a.play().catch(() => { /* noop */ }); } });
    a.addEventListener('playing', onPlaying);
    a.addEventListener('pause', () => { music.playing = false; });
    a.addEventListener('waiting', () => { music.playing = false; });
    a.addEventListener('error', () => { music.audio = null; music.mode = 'none'; music.failed = true; music.playing = false; if (LOCAL.audio?.streamed) LOCAL.audio = null; if (started && withAudio) { showAudioWarn('soundtrack not bundled — playing the ambient score (npm run media:audio)'); window.Ambient?.enable(); } });
    a.addEventListener('canplaythrough', () => { music.ready = true; if (music.wantStart && !music.everPlayed) startMusic(); }, { once: true });
    music.audio = a; music.mode = 'local'; a.load();
  }

  /* -- No YouTube player. The soundtrack is an <audio> element: the bundled file when media/ has it,
        otherwise the same path is tried on the host (GitHub Pages serves it with Range support). If neither
        exists the film runs on its own clock with the generative ambient score and says so. -- */
  function createStreamAudio() { LOCAL.audio = { file: 'media/audio/soundtrack.m4a', streamed: true }; createLocalAudio(); }
  /* -- common controls -- */
  function rawPlay() {
    if (music.mode === 'local' && music.audio) { music.audio.muted = false; music.audio.volume = 1; return music.audio.play().catch(() => { /* autoplay policy — retried on gesture */ }); }
    return Promise.resolve();
  }
  function seekMusic(sec) {
    if (music.mode === 'local' && music.audio) { try { music.audio.currentTime = sec; } catch (e) { /* noop */ } }
  }
  function currentTime() {
    if (music.mode === 'local' && music.audio) return music.audio.currentTime;
    return -1;
  }
  function setVolume(v) { if (music.mode === 'local' && music.audio) music.audio.volume = v / 100; }
  function startMusic() {
    if (music.failed) return false;
    music.wantStart = true;
    if (music.mode === 'none') return false;
    rawPlay();
    let tries = 0; const iv = setInterval(() => {
      if (music.everPlayed || finished || music.failed) { clearInterval(iv); return; }
      tries++; rawPlay();
      if (tries === 3) showAudioWarn('tap anywhere to start the soundtrack');
      if (tries > 12) clearInterval(iv);
    }, 700);
    const kick = () => { if (!music.everPlayed && !music.failed) rawPlay(); };
    ['pointerdown', 'keydown', 'touchend'].forEach((ev) => addEventListener(ev, kick, { passive: true }));
    return true;
  }
  function musicActive() { return !!(music.everPlayed && !music.failed); }
  function toggleMusic() {
    if (!musicActive()) return false;
    music.muted = !music.muted;
    if (music.mode === 'local' && music.audio) { music.audio.muted = music.muted; if (!music.muted) music.audio.play().catch(() => { /* noop */ }); }
    return !music.muted;
  }
  function settleMusic() { // after the film: keep the track as the site's soundtrack, quieter
    if (!musicActive()) return;
    let v = 100; const iv = setInterval(() => { v -= 4; setVolume(Math.max(38, v)); if (v <= 38) clearInterval(iv); }, 60);
  }

  /* ---------------------------------------------------------------- */
  /* Clock — the audio element's time when the track runs, timer otherwise */
  /* ---------------------------------------------------------------- */
  const clock = {
    t0: 0, base: 0, speed: parseFloat(q.get('speed')) || 1, running: false, source: 'timer', lastSample: -1, lastSampleAt: 0,
    start(at = 0) { this.base = at; this.t0 = performance.now(); this.running = true; },
    now() {
      if (!this.running) return 0;
      const local = this.base + ((performance.now() - this.t0) / 1000) * this.speed;
      if (music.playing && !music.failed) {
        const s = currentTime();
        if (s >= 0) {
          this.source = 'audio';
          if (s !== this.lastSample) {
            this.lastSample = s; this.lastSampleAt = performance.now();
            const d = s - local;
            if (Math.abs(d) > 0.35) { this.base = s; this.t0 = performance.now(); return s; }
            this.base += d * 0.1;
          }
          return this.base + ((performance.now() - this.t0) / 1000) * this.speed;
        }
      }
      this.source = 'timer';
      return local;
    },
    syncHard() { const s = currentTime(); if (s >= 0) { this.base = s; this.t0 = performance.now(); } },
    seek(sec) { this.base = sec; this.t0 = performance.now(); if (musicActive()) seekMusic(sec); }
  };

  /* ---------------------------------------------------------------- */
  /* Split-letter titles                                              */
  /* ---------------------------------------------------------------- */
  function split(node, text, stagger = 0.045) {
    node.innerHTML = ''; node.classList.add('split');
    [...text].forEach((ch, i) => { const w = el('span'); const b = el('b', null, ch === ' ' ? '&nbsp;' : esc(ch)); b.style.transitionDelay = (i * stagger) + 's'; w.appendChild(b); node.appendChild(w); });
    return node;
  }

  /* ---------------------------------------------------------------- */
  /* Preloader                                                        */
  /* ---------------------------------------------------------------- */
  const pctEl = $('#pre-pct'), statusEl = $('#pre-status'), barEl = $('.pre-bar i'), wordEl = $('#pre-word');
  let shownPct = 0, targetPct = 0, preDone = false;
  function setTarget(p) { targetPct = Math.max(targetPct, clamp(p, 0, 100)); }
  function preTick() {
    if (shownPct < targetPct) shownPct = Math.min(targetPct, shownPct + Math.max(0.35, (targetPct - shownPct) * 0.08));
    const p = Math.round(shownPct); pctEl.textContent = `( ${String(p).padStart(2, '0')}% )`; barEl.style.transform = `scaleX(${shownPct / 100})`;
    wordEl.style.setProperty('--p', (shownPct / 100).toFixed(3));
    if (p >= 100 && !preDone) { preDone = true; setTimeout(showGate, 350); return; }
    requestAnimationFrame(preTick);
  }
  let statusI = 0; const statusIv = setInterval(() => { statusEl.textContent = S.PRELOAD_LINES[statusI++ % S.PRELOAD_LINES.length]; }, 620);
  statusEl.textContent = S.PRELOAD_LINES[0];
  async function preload() {
    requestAnimationFrame(preTick);
    await withTimeout(loadManifest(), 3000); setTarget(5);
    const tasks = [];
    const bump = (n) => () => setTarget(targetPct + n);
    tasks.push(withTimeout((document.fonts?.load('800 40px Syne') || Promise.resolve()).then(() => document.fonts?.load('400 12px "Space Mono"')), 2500).then(bump(10)));
    firstKeys.forEach((k) => tasks.push(withTimeout(loadImage(k), 6000).then(bump(50 / firstKeys.length))));
    if (LOCAL.audio) createLocalAudio(); else createStreamAudio();
    tasks.push(withTimeout(new Promise((r) => { if (!music.audio) return r(); music.audio.addEventListener('canplaythrough', r, { once: true }); music.audio.addEventListener('error', r, { once: true }); }), 8000).then(bump(20)));
    // warm local clips so the first frame is instant
    shots.forEach((sh) => { const m = sh.media; if (typeof m === 'object' && m.file) { const key = Object.keys(S.CLIPS).find((k) => S.CLIPS[k] === m); if (key && LOCAL.clips[key]) { const l = document.createElement('link'); l.rel = 'preload'; l.as = 'video'; l.href = LOCAL.clips[key].file; document.head.appendChild(l); } } });
    tasks.push(new Promise((r) => setTimeout(r, 1800)).then(bump(20)));
    await Promise.all(tasks); setTarget(100);
    allKeys.forEach((k) => loadImage(k)); // warm the rest in the background
  }

  /* ---------------------------------------------------------------- */
  /* Gate                                                             */
  /* ---------------------------------------------------------------- */
  const gateTitle = $('#fgate-title');
  function showGate() {
    clearInterval(statusIv); pre.classList.add('out'); gate.classList.add('show');
    split(gateTitle, 'HUMANITY', 0.06); requestAnimationFrame(() => requestAnimationFrame(() => gateTitle.classList.add('in')));
    $('#fgate-length').textContent = fmtT(totalSeconds());
    $('#fgate-cuts').textContent = String(shots.length);
    try { if (localStorage.getItem('humanity.filmSeen')) $('#fgate-eyebrow').textContent = 'Welcome back, explorer'; } catch (e) { /* noop */ }
    if (music.mode === 'none' || music.failed) $('#enter-audio .fbtn-tag').textContent = '( ambient score — track not bundled )';
    $('#fgate-src').textContent = LOCAL.audio && !music.failed ? (LOCAL.audio.streamed ? 'served with the site' : 'bundled with the site') : 'not bundled — ambient score instead';
    const clockEl = $('#fgate-clock'); const tickClock = () => { clockEl.textContent = new Date().toTimeString().slice(0, 8) + ' LOCAL'; }; tickClock(); setInterval(tickClock, 1000);
    const mk = (root) => { const track = root.querySelector('.marquee-track'); const html = S.TAGS.map((t) => `<span><i>[</i>${esc(t)}<i style="margin:0 0 0 22px">]</i></span>`).join(''); track.innerHTML = html + html; };
    mk($('#fgate-marquee')); mk($('#stage-marquee'));
    // background stills drifting behind the gate
    const bg = $('#fgate-bg'); ['milky', 'pillars', 'aldrin', 'earthrise'].forEach((k, i) => { const d = S.IMAGES[k]; const im = el('img'); im.alt = ''; im.crossOrigin = 'anonymous'; im.src = d.src; im.style.animationDelay = (i * 4) + 's'; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); bg.appendChild(im); });
    setTimeout(() => { $('#enter-audio').focus({ preventScroll: true }); }, 900);
  }
  $('#enter-audio').addEventListener('click', () => enter(true));
  $('#enter-silent').addEventListener('click', () => enter(false));
  $('#skip-film').addEventListener('click', (e) => { e.preventDefault(); finish(false, true); });
  addEventListener('keydown', (e) => { if (gate.classList.contains('show') && !gate.classList.contains('hidden') && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') enter(true); });

  /* ---------------------------------------------------------------- */
  /* Enter → run the film                                             */
  /* ---------------------------------------------------------------- */
  let withAudio = false, started = false, finished = false, raf = 0;
  function enter(audio) {
    if (started) return; started = true; withAudio = audio;
    gate.classList.add('hidden'); gateTitle.classList.add('out');
    stage.hidden = false; $('#stage-marquee').classList.add('show');
    if (!reduced && q.get('gl') !== '0') window.GLX?.mount(stage);
    let musicStarted = false;
    if (audio) musicStarted = startMusic();
    clock.start(startAt);
    if (!musicStarted && audio) { showAudioWarn('soundtrack unavailable — playing ambient score on the local clock'); window.Ambient?.enable(); }
    if (musicStarted && audio) setTimeout(() => { if (!music.everPlayed && !finished) { window.Ambient?.enable(); } }, 6000);
    window.Cosmos?.setMode(chapters[0].mode);
    buildProgress();
    setTimeout(() => skipBtn.classList.add('show'), 2500);
    if (DEBUG) debugEl.hidden = false;
    if (!reduced && document.documentElement.requestFullscreen && !isMobile && q.get('fs') === '1') document.documentElement.requestFullscreen().catch(() => { /* noop */ });
    raf = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- */
  /* Stage rendering                                                  */
  /* ---------------------------------------------------------------- */
  let curShot = -1, curChapter = -1, lastBeat = -1, curSlot = null, titlecard = null, openLinesEl = null, tcOutBeat = Infinity;
  const prewarmed = new Map(); let kbI = 0;

  const genWord = (shot) => { const c = (shot.caption || shot.chapter.title || '').split(/ — |, /)[0].trim(); const words = c.split(' '); return (words.length > 2 ? words.slice(0, 2).join(' ') : c).slice(0, 18); };
  function gen(word, code, clear) {
    const g = el('div', 'media gen' + (clear ? ' clear' : ''));
    g.appendChild(el('div', 'gen-grid'));
    if (word) { const w = el('div', 'gen-word', esc(word)); w.style.fontSize = `min(18vw, ${Math.min(150, 150 / Math.max(3, word.length) * 1.6).toFixed(1)}vw)`; g.appendChild(w); }
    if (code) g.appendChild(el('div', 'gen-code', esc(code)));
    return g;
  }
  /* GSAP camera: a real dolly/pan per shot. Long shots breathe (slow push with a slight drift), short shots snap
     (fast settle from a punch-in), portraits get a vertical tilt, wide plates a lateral pan. Never exceeds KB_MAX
     so the picture is never shown above its own pixel density. */
  const CAM_MOVES = [
    { from: { scale: 1.16, xPercent: 1.2, yPercent: 0.8 }, to: { scale: 1.02, xPercent: 0, yPercent: 0 } },
    { from: { scale: 1.03, xPercent: 0, yPercent: 0 }, to: { scale: 1.16, xPercent: -1.2, yPercent: -0.8 } },
    { from: { scale: 1.16, xPercent: -1.8, yPercent: 1.2 }, to: { scale: 1.05, xPercent: 0.8, yPercent: -0.4 } },
    { from: { scale: 1.04, xPercent: 0.8, yPercent: 0.4 }, to: { scale: 1.15, xPercent: -0.8, yPercent: 1.2 } },
    { from: { scale: 1.16, xPercent: 0, yPercent: 2.4 }, to: { scale: 1.03, xPercent: 0, yPercent: 0 } },
    { from: { scale: 1.02, rotation: -0.35 }, to: { scale: 1.14, rotation: 0.35 } }
  ];
  let camI = 0;
  function camera(im, shot, def) {
    const secs = Math.max(0.6, shot.beats * spb());
    const mv = CAM_MOVES[camI++ % CAM_MOVES.length];
    const portrait = !!(def && def.h_px && def.w && def.h_px > def.w);
    const from = { ...mv.from }, to = { ...mv.to };
    if (portrait) { from.yPercent = (from.yPercent || 0) + 1.5; to.yPercent = (to.yPercent || 0) - 1.5; }
    if (shot.beats <= 1) { // stab: land hard from a punch-in and hold — reads as a hit on the beat
      gsap.fromTo(im, { scale: 1.16, xPercent: 0, yPercent: 0, rotation: 0 }, { scale: 1.06, duration: Math.min(0.5, secs), ease: 'expo.out', overwrite: true });
      return;
    }
    gsap.fromTo(im, from, { ...to, duration: secs + 1.2, ease: shot.beats >= 6 ? 'sine.inOut' : 'power1.out', overwrite: true });
  }

  function still(shot, slot, key) {
    const def = S.IMAGES[key];
    if (!def || imgState[key] === 'fail') { slot.dataset.kind = 'gen'; return gen(genWord(shot), `( ${shot.chapter.code} · ${key} )`); }
    const wrap = el('div', 'media' + (def.low ? ' lowres' : ''));
    if (def.low) { const bd = el('img', 'backdrop'); bd.alt = ''; bd.crossOrigin = 'anonymous'; bd.src = def.src; bd.referrerPolicy = 'no-referrer'; wrap.appendChild(bd); }
    const useGsap = !!window.gsap && !reduced;
    const im = el('img', 'media img' + (useGsap ? ' cam' : ' kb' + (kbI++ % 6))); im.alt = ''; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; im.crossOrigin = 'anonymous'; im.src = def.src;
    im.addEventListener('load', () => { if (window.GLX?.supported && 'requestIdleCallback' in window) requestIdleCallback(() => GLX.prepare(im), { timeout: 400 }); else window.GLX?.prepare(im); }, { once: true });
    if (!useGsap) im.style.animationDuration = Math.max(1.2, shot.beats * spb() + 1.2) + 's';
    else slot._cam = () => camera(im, shot, def);
    im.onerror = () => { if (im.src !== def.srcLo) { def.src = def.srcLo; im.src = def.srcLo; return; } imgState[key] = 'fail'; wrap.replaceWith(gen(genWord(shot), `( ${shot.chapter.code} )`)); slot.dataset.kind = 'gen'; };
    wrap.appendChild(im);
    const gr = el('img', 'rgb-ghost r'); gr.crossOrigin = 'anonymous'; gr.src = def.src; gr.alt = ''; gr.referrerPolicy = 'no-referrer'; const gb = el('img', 'rgb-ghost b'); gb.crossOrigin = 'anonymous'; gb.src = def.src; gb.alt = ''; gb.referrerPolicy = 'no-referrer';
    wrap.appendChild(gr); wrap.appendChild(gb); slot.dataset.kind = 'img'; return wrap;
  }
  function mediaFor(shot, slot) {
    const m = shot.media; const frame = el('div', 'frame');
    if (typeof m === 'object' && m.mode) { frame.appendChild(gen(shot.chapter.kind === 'open' ? '' : (shot.chapter.title || ''), `( ${shot.chapter.code} )`, true)); slot.dataset.kind = 'gen'; return frame; }
    if (typeof m === 'string') { frame.appendChild(still(shot, slot, m)); return frame; }
    const clipKey = Object.keys(S.CLIPS).find((k) => S.CLIPS[k] === m);
    const local = clipKey && LOCAL.clips[clipKey];
    // clip: a real <video> (local H.264 if bundled, else the Commons VP9 transcode), a poster underneath so the
    // first beat is never black, no chrome, muted, looped inside its window. No third-party player anywhere.
    const c = el('div', 'media clip' + (local ? ' local' : '') + (m.w && m.w < 640 ? ' lowres' : ''));
    const stillDef = S.IMAGES[m.fallback];
    const poster = el('img', 'poster'); poster.alt = ''; poster.crossOrigin = 'anonymous'; poster.referrerPolicy = 'no-referrer';
    poster.src = local?.poster || (stillDef ? stillDef.src : S.clipPoster(m, 1280)); poster.onerror = () => { if (stillDef && poster.src !== stillDef.src) poster.src = stillDef.src; else poster.remove(); };
    c.appendChild(poster);
    const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = false; v.preload = 'auto'; v.disablePictureInPicture = true; v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    const inPoint = local ? 0 : (m.start || 0); const outPoint = inPoint + (m.len || 10);
    v.src = local ? local.file : S.clipUrl(m, clipHeight());
    v._in = inPoint; v._out = outPoint;
    // seek to the in-point as soon as metadata is known, then hold the frame until the cut lands
    v.addEventListener('loadedmetadata', () => { try { if (Math.abs(v.currentTime - inPoint) > 0.25) v.currentTime = inPoint; } catch (e) { /* noop */ } }, { once: true });
    v.addEventListener('timeupdate', () => { if (v.currentTime >= outPoint - 0.05) { try { v.currentTime = inPoint; } catch (e) { /* noop */ } } });
    v.addEventListener('playing', () => { v.classList.add('live'); slot.dataset.video = '1'; }, { once: true });
    // if the network / codec fails, fall back to the Ken Burns still so the beat is never empty
    v.addEventListener('error', () => { if (!c.isConnected) return; const s = still(shot, slot, m.fallback); c.replaceWith(s); slot.dataset.kind = 'img'; delete slot.dataset.video; if (slot._cam && slot === curSlot) { slot._cam(); slot._cam = null; } if (slot === curSlot) { const d = S.IMAGES[m.fallback]; creditEl.textContent = d ? `${d.credit} · ${d.license}` : ''; } }, { once: true });
    v.addEventListener('ended', () => { try { v.currentTime = inPoint; } catch (e) { /* noop */ } v.play().catch(() => { /* noop */ }); });
    c.appendChild(v); frame.appendChild(c); slot.dataset.kind = 'clip';
    if (window.gsap && !reduced) slot._cam = () => cameraClip([poster, v], shot);
    return frame;
  }
  function cameraClip(els, shot) {
    const secs = Math.max(0.6, shot.beats * spb()); const dir = (camI++ % 2) ? 1 : -1;
    gsap.fromTo(els, { scale: 1.06, xPercent: 0.6 * dir, yPercent: 0 }, { scale: 1.0, xPercent: 0, yPercent: 0, duration: secs + 1.2, ease: 'sine.out', overwrite: true });
  }
  /* which Commons transcode to stream: enough rows for the stage at this DPR, never more than the file has */
  function clipHeight() { const dpr = Math.min(3, window.devicePixelRatio || 1); const h = Math.round(Math.max(stage.clientHeight, stage.clientWidth * 9 / 16) * dpr); const c = navigator.connection; const slow = c && (c.saveData || /(^|[^0-9])2g/.test(c.effectiveType || '')); return slow ? 480 : h >= 700 ? 1080 : 480; }
  function makeSlot(shot) { const slot = el('div', 'slot warm'); slot.dataset.shot = shot.index; slot.appendChild(mediaFor(shot, slot)); slots.appendChild(slot); const v = slot.querySelector('video'); if (v) v.load(); /* buffer + decode the in-point now; play() happens on the cut so the first visible frame is the one we chose */ return slot; }
  function prewarm(shot) { if (prewarmed.has(shot.index)) return; prewarmed.set(shot.index, makeSlot(shot)); }

  function stageFx(cls, ms) { if (reduced) return; stage.classList.remove(cls); void stage.offsetWidth; stage.classList.add(cls); setTimeout(() => stage.classList.remove(cls), ms); }
  function flash(kind) { flashEl.className = 'fx-flash'; void flashEl.offsetWidth; flashEl.classList.add('go', kind || 'full'); }
  const FX = {
    flash: () => { flash('full'); stageFx('fx-strobe', 520); },
    drop: () => { flash('half'); stageFx('fx-shake', 480); },
    glitch: () => stageFx('fx-glitch', 460),
    invert: () => stageFx('fx-invert', 240),
    zoomblur: () => stageFx('fx-zoomblur', 420),
    shutter: () => stageFx('fx-shutter', 420),
    spin: () => stageFx('fx-shake', 300),
    flicker: () => stageFx('fx-flicker', 500),
    burn: () => { flash('warm'); stageFx('fx-burn', 900); },
    punch: () => stage.classList.add('downbeat'),
    zoomin: () => stage.classList.add('downbeat')
  };

  function slamWord(text, beats) {
    if (!text || reduced) return;
    // a new word retires whatever is still on screen — two slams never stack
    wordsEl.querySelectorAll('.word').forEach((o) => { if (window.gsap) gsap.to(o, { opacity: 0, duration: 0.12, overwrite: true, onComplete: () => o.remove() }); else o.remove(); });
    const w = el('div', 'word'); w.textContent = text;
    const variants = ['w-center', 'w-left', 'w-right', 'w-low', 'w-high'];
    const variant = variants[Math.floor(Math.random() * variants.length)]; w.classList.add(variant);
    if (Math.random() < 0.3) w.classList.add('outline');
    const life = Math.min(2.2, Math.max(0.6, beats * spb()));
    w.style.setProperty('--dur', life + 's');
    wordsEl.appendChild(w);
    if (window.gsap) {
      w.classList.add('gs');
      const side = variant === 'w-left' ? -1 : variant === 'w-right' ? 1 : 0;
      const tl = gsap.timeline({ onComplete: () => w.remove() });
      tl.fromTo(w, { opacity: 0, scale: side ? 1 : 2.4, xPercent: side * -35 + (variant === 'w-center' || variant === 'w-low' || variant === 'w-high' ? -50 : 0), yPercent: -50, skewX: side * -18 },
        { opacity: 1, scale: 1, xPercent: (variant === 'w-center' || variant === 'w-low' || variant === 'w-high' ? -50 : 0), skewX: 0, duration: 0.32, ease: 'expo.out' })
        .to(w, { xPercent: '+=' + (side * 2), scale: side ? 1 : 1.05, duration: Math.max(0.2, life - 0.5), ease: 'none' })
        .to(w, { opacity: 0, scale: side ? 1 : 1.1, duration: 0.22, ease: 'power2.in' });
    } else setTimeout(() => w.remove(), Math.min(2400, beats * spb() * 1000 + 300));
  }

  /* GPU transitions (js/glx.js): which CSS transition names get a shader, how long, and any direction hints.
     Anything not listed (cut, punch, drop, flash, invert, flicker) stays a hard CSS cut — those live on the beat. */
  const GL_MAP = {
    fade: ['liquid', 0.95], burn: ['luma', 0.9], iris: ['ripple', 0.75], spin: ['swirl', 0.6], glitch: ['mosaic', 0.42],
    zoomblur: ['chroma', 0.5], zoomout: ['chroma', 0.55], zoomin: ['chroma', 0.55, { inverse: true }],
    whip: ['warp', 0.45, { dir: [1, 0] }], whipL: ['warp', 0.45, { dir: [-1, 0] }], rise: ['warp', 0.5, { dir: [0, 1] }], fall: ['warp', 0.5, { dir: [0, -1] }],
    wipe: ['warp', 0.5, { dir: [1, 0] }], slice: ['slices', 0.5], shutter: ['slices', 0.5]
  };
  const GL_KEEP_FX = new Set(['burn', 'glitch']); // shader + the stage-wide flash/ghosting still feel right together
  const visibleMedia = (slot) => slot.querySelector('video.live') || slot.querySelector('img.img') || slot.querySelector('img.poster');
  const clipEl = (slot) => slot.querySelector('video');
  let glWhy = '';
  function glCut(prev, slot, tr, shot) {
    glWhy = '';
    if (!prev || reduced || !window.GLX?.supported || q.get('gl') === '0') { glWhy = 'off'; return false; }
    const spec = GL_MAP[tr]; if (!spec) { glWhy = 'css:' + tr; return false; }
    if (prev.dataset.kind === 'gen' || slot.dataset.kind === 'gen') { glWhy = 'gen'; return false; }
    if (prev.querySelector('.media.lowres') || slot.querySelector('.media.lowres')) { glWhy = 'lowres'; return false; } // contained images don't map onto the cover-fit shader
    const from = visibleMedia(prev), to = visibleMedia(slot); if (!from || !to) { glWhy = 'nomedia'; return false; }
    const dur = Math.min(spec[1], Math.max(0.3, shot.beats * spb() * 0.85));
    const ease = window.gsap ? gsap.parseEase(spec[0] === 'liquid' || spec[0] === 'luma' ? 'sine.inOut' : 'power2.inOut') : undefined;
    const ok = GLX.transition({ from: { el: from }, to: { el: to }, effect: spec[0], duration: dur, ease, ...(spec[2] || {}) });
    if (!ok) glWhy = 'glx:' + (GLX.lastReason || '?');
    return ok;
  }

  function showShot(i, hard) {
    const shot = shots[i]; if (!shot) return;
    const prev = curSlot; curShot = i;
    const slot = prewarmed.get(i) || makeSlot(shot); prewarmed.delete(i);
    prewarmed.forEach((s, k) => { if (k <= i) { s.remove(); prewarmed.delete(k); } }); // skipped-over prewarms (seek, slow frame) must not pile up
    const tr = hard ? 'cut' : shot.tr;
    slot.classList.remove('warm'); // Ken Burns starts now
    if (slot._cam) { slot._cam(); slot._cam = null; }
    const gpu = !hard && glCut(prev, slot, tr, shot);
    if (gpu) {
      // the shader blends prev→slot on the overlay canvas; underneath, the new slot is simply there
      slot.classList.add('on', 'tr-cut', 'gl');
      if (prev) { prev.classList.remove('on'); prev.classList.add('off'); }
    } else {
      slot.classList.add('on', 'tr-' + tr);
      if (prev) { prev.classList.remove('on'); prev.classList.add('off', 'tr-' + tr); }
      void slot.offsetWidth; slot.classList.add('go');
    }
    const vid = clipEl(slot); if (vid) { try { if (vid.readyState >= 1 && Math.abs(vid.currentTime - vid._in) > 0.6) vid.currentTime = vid._in; } catch (e) { /* noop */ } if (vid.paused) vid.play().catch(() => { /* muted autoplay after the gate gesture is always allowed */ }); }
    if (prev) prev.querySelectorAll('video').forEach((pv) => setTimeout(() => { pv.pause(); pv.removeAttribute('src'); pv.load(); }, 1200));
    if (!hard) { if (!gpu || GL_KEEP_FX.has(tr)) FX[tr]?.(); if (!titlecard) slamWord(shot.word, shot.beats); }
    curSlot = slot;
    if (prev) setTimeout(() => { prev.classList.add('gone'); setTimeout(() => prev.remove(), 600); }, gpu ? 1000 : 550);
    // caption + credit
    const capTxt = shot.caption || ''; if (capTxt !== capEl.textContent) { capEl.textContent = capTxt; capEl.classList.remove('on'); if (capTxt) { void capEl.offsetWidth; capEl.classList.add('on'); } }
    const key = keyOf(shot.media); const def = key && S.IMAGES[key];
    if (typeof shot.media === 'object' && shot.media.file) creditEl.textContent = `${shot.media.title} · ${shot.media.license}`;
    else creditEl.textContent = def && slot.dataset.kind === 'img' ? `${def.credit} · ${def.license}` : '';
    // prewarm upcoming clips (~5 s ahead) so the videos are buffered and parked on their in-point when they cut in
    for (let j = i + 1; j < shots.length && shots[j].start - shot.start < Math.ceil(5 / spb()) + 1; j++) { const mj = shots[j].media; if (typeof mj === 'object' && mj.file) prewarm(shots[j]); }
    // and the next two shots of any kind, so their pixels are decoded (and uploaded to the GPU) before the cut lands
    for (let j = i + 1; j <= i + 2 && j < shots.length; j++) prewarm(shots[j]);
  }

  function showChapter(ci, hard) {
    const ch = chapters[ci]; if (!ch) return;
    curChapter = ci; window.Cosmos?.setMode(ch.mode);
    stage.style.setProperty('--energy', ch.energy ?? 0.6);
    chapEl.textContent = ch.label || ''; codeEl.textContent = `( ${ch.code} )`;
    if (titlecard) hideTitlecard();
    if (openLinesEl) { openLinesEl.remove(); openLinesEl = null; }
    barsEl.classList.toggle('wide', ch.kind === 'chapter' || ch.kind === 'finale');
    if (ch.kind === 'open') {
      openLinesEl = el('div', 'openlines mono');
      const secs = `${Math.round(totalSeconds())}`;
      ch.lines.forEach(([b, txt]) => { const s = el('span', null, esc(txt.replace('RUNTIME', secs))); s.dataset.beat = b; openLinesEl.appendChild(s); });
      stage.appendChild(openLinesEl);
      return;
    }
    const tc = el('div', 'titlecard ' + ch.kind); titlecard = tc;
    if (ch.kind === 'chapter') tc.appendChild(el('div', 'tc-num', String(ch.num).padStart(2, '0')));
    tc.appendChild(el('div', 'tc-when mono', esc(ch.when != null ? String(ch.when) : (ch.label || ''))));
    const h = el('h2', 'tc-title'); split(h, ch.title || '', ch.kind === 'title' ? 0 : 0.05); tc.appendChild(h);
    h.style.fontSize = `min(${ch.kind === 'title' ? '16vw' : '11vw'}, ${(ch.kind === 'title' ? 150 : 128) / Math.max(4, (ch.title || '').length)}vw)`;
    tc.appendChild(el('p', 'tc-line', esc(ch.kind === 'title' ? ch.tagline : (ch.line || ''))));
    tc.appendChild(el('div', 'tc-rule'));
    stage.appendChild(tc);
    if (ch.kind === 'title') {
      h.classList.add('in'); h.querySelectorAll('b').forEach((b, i) => { b.style.transitionDelay = '0s'; b.style.transform = 'translateY(115%) rotate(6deg)'; b.style.opacity = '0'; b.dataset.beat = i; });
      requestAnimationFrame(() => tc.classList.add('in'));
      if (hard) h.querySelectorAll('b').forEach((b) => { b.style.transform = ''; b.style.opacity = ''; });
    } else if (window.gsap && !reduced) {
      tc.classList.add('in', 'gs'); h.classList.add('in');
      const letters = h.querySelectorAll('b'); letters.forEach((b) => { b.style.transitionDelay = '0s'; b.style.transition = 'none'; });
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo(letters, { yPercent: 120, rotate: 8, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.1, stagger: { each: 0.045, from: 'start' } }, 0)
        .fromTo(tc.querySelector('.tc-when'), { opacity: 0, y: 12, letterSpacing: '0.6em' }, { opacity: 1, y: 0, letterSpacing: '0.3em', duration: 0.9 }, 0.05)
        .fromTo(tc.querySelector('.tc-line'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1 }, 0.45)
        .fromTo(tc.querySelector('.tc-rule'), { width: 0 }, { width: 120, duration: 1.1 }, 0.35);
      const num = tc.querySelector('.tc-num'); if (num) tl.fromTo(num, { opacity: 0, scale: 1.25, xPercent: -50, yPercent: -50 }, { opacity: 1, scale: 1, duration: 2.4, ease: 'power2.out' }, 0);
      tc._tl = tl;
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => { tc.classList.add('in'); h.classList.add('in'); }));
    }
    tcOutBeat = ch.kind === 'finale' ? ch.start + ch.len * 0.6 : ch.kind === 'title' ? ch.start + 14 : ch.start + 4;
    if (ch.kind === 'finale') { exploreBtn.hidden = false; setTimeout(() => exploreBtn.classList.add('show'), 8 * spb() * 1000); }
  }
  function hideTitlecard() {
    const tc = titlecard; if (!tc) return; titlecard = null; tcOutBeat = Infinity;
    if (tc._tl && window.gsap) {
      tc._tl.kill(); tc.classList.add('out');
      const letters = tc.querySelectorAll('.tc-title b');
      gsap.timeline({ onComplete: () => tc.remove() })
        .to(letters, { yPercent: -120, opacity: 0, duration: 0.55, ease: 'power3.in', stagger: { each: 0.02, from: 'end' } }, 0)
        .to(tc.querySelectorAll('.tc-when, .tc-line, .tc-rule, .tc-num'), { opacity: 0, duration: 0.4 }, 0);
      return;
    }
    tc.classList.add('out'); tc.classList.remove('in'); tc.querySelector('.tc-title')?.classList.add('out');
    setTimeout(() => tc.remove(), 900);
  }

  function onBeat(b) {
    const inBar = ((b % 4) + 4) % 4;
    beatDots.forEach((d, i) => d.classList.toggle('on', i === inBar));
    if (window.gsap && !reduced && curSlot) {
      const energy = parseFloat(stage.style.getPropertyValue('--energy')) || 0.6;
      const fr = curSlot.querySelector('.frame');
      if (fr) { fr.classList.add('gs'); gsap.fromTo(fr, { scale: 1 + (inBar === 0 ? 0.05 : 0.018) * energy }, { scale: 1, duration: inBar === 0 ? 0.55 : 0.4, ease: 'expo.out', overwrite: true }); }
    } else { stage.classList.remove('beat', 'downbeat'); void stage.offsetWidth; stage.classList.add(inBar === 0 ? 'downbeat' : 'beat'); }
    window.Cosmos?.pulse(inBar === 0 ? 1 : 0.45);
    if (inBar === 0 && !reduced) { hud.classList.remove('tick'); void hud.offsetWidth; hud.classList.add('tick'); }
    if (openLinesEl) { const rel = b - chapters[curChapter].start; openLinesEl.querySelectorAll('span').forEach((s) => { if (+s.dataset.beat <= rel) s.classList.add('on'); }); }
    if (titlecard && titlecard.classList.contains('title')) { const rel = b - chapters[curChapter].start; titlecard.querySelectorAll('b').forEach((x) => { if (+x.dataset.beat <= rel) { x.style.transform = ''; x.style.opacity = ''; } }); if (rel >= 8) titlecard.querySelector('.tc-line')?.classList.add('show'); }
  }

  function buildProgress() { progressEl.innerHTML = ''; chapters.forEach((c) => { const i = el('i'); i.style.setProperty('--w', c.len); progressEl.appendChild(i); }); }
  function updateProgress(beat) {
    const segs = progressEl.children; chapters.forEach((c, i) => { const s = segs[i]; if (!s) return; if (beat >= c.end) { s.classList.add('done'); s.style.setProperty('--p', 1); } else if (beat >= c.start) { s.classList.remove('done'); s.style.setProperty('--p', ((beat - c.start) / c.len).toFixed(3)); } else { s.classList.remove('done'); s.style.setProperty('--p', 0); } });
  }
  // year odometer: eases across the chapter's [from, to] range on a log-ish curve so deep time flies and history lingers
  const fmtYear = (y) => {
    if (y <= -1e9) return `${(-y / 1e9).toFixed(2)} BILLION YEARS AGO`;
    if (y <= -1e6) return `${(-y / 1e6).toFixed(2)} MILLION YEARS AGO`;
    if (y <= -10000) return `${Math.round(-y / 1000).toLocaleString('en-US')},000 YEARS AGO`;
    if (y < 0) return `${Math.round(-y).toLocaleString('en-US')} BCE`;
    return `${Math.round(y)} CE`;
  };
  let lastYearTxt = '';
  function updateYear(beat) {
    const ch = chapters[curChapter]; if (!ch || !ch.years) return;
    const p = clamp((beat - ch.start) / ch.len, 0, 1); const e = 1 - Math.pow(1 - p, 3);
    const [a, b] = ch.years; const y = a + (b - a) * e;
    const txt = fmtYear(y); if (txt !== lastYearTxt) { yearEl.textContent = txt; lastYearTxt = txt; }
  }

  /* ---------------------------------------------------------------- */
  /* Frame loop                                                       */
  /* ---------------------------------------------------------------- */
  let lastTc = '';
  function frame() {
    if (finished) return;
    const t = clock.now(); const beat = beatAt(t); const b = Math.floor(beat);
    if (beat >= TOTAL_BEATS) { finish(true); return; }
    let ci = curChapter; if (ci < 0 || beat < chapters[ci].start || beat >= chapters[ci].end) { ci = chapters.findIndex((c) => beat >= c.start && beat < c.end); if (ci >= 0 && ci !== curChapter) showChapter(ci, Math.abs(b - lastBeat) > 4); }
    if (beat >= 0) {
      const si = curShot; const cur = shots[si];
      if (!cur || beat < cur.start || beat >= cur.end) {
        if (cur && shots[si + 1] && beat >= shots[si + 1].start && beat < shots[si + 1].end) showShot(si + 1, false);
        else { const ni = shots.findIndex((s) => beat >= s.start && beat < s.end); if (ni >= 0 && ni !== curShot) showShot(ni, cur ? Math.abs(b - lastBeat) > 4 : false); }
      }
    }
    if (b !== lastBeat && b >= 0) { onBeat(b); lastBeat = b; }
    if (titlecard && beat >= tcOutBeat) hideTitlecard();
    updateProgress(beat); updateYear(beat);
    const tcs = `${fmtT(t)} / ${fmtT(totalSeconds())}`; if (tcs !== lastTc) { tcEl.textContent = tcs; lastTc = tcs; }
    if (DEBUG) debugEl.textContent = `t ${t.toFixed(2)}s  beat ${beat.toFixed(2)}  bar ${Math.floor(beat / 4) + 1}\nbpm ${T.bpm.toFixed(2)}  offset ${T.offset.toFixed(3)}s  clock ${clock.source}  music ${music.playing ? 'playing' : music.failed ? 'failed' : music.ready ? 'ready' : 'none'}\nchapter ${chapters[curChapter]?.id || '-'}  shot ${curShot}\n?bpm=${T.bpm.toFixed(2)}&offset=${T.offset.toFixed(3)}\nT tap · O downbeat · ←→ offset · ↑↓ bpm · [ ] seek`;
    raf = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- */
  /* Finish → hand over to the monument                               */
  /* ---------------------------------------------------------------- */
  function finish(natural) {
    if (finished) return; finished = true; cancelAnimationFrame(raf);
    if (natural) flash('full');
    if (window.gsap && !reduced) { const st = $('#stage'); if (st) gsap.to(st, { scale: 1.08, opacity: 0, duration: 1.2, ease: 'power2.inOut' }); }
    film.classList.add('done'); document.body.classList.remove('filming');
    settleMusic();
    const soundOn = musicActive() && !music.muted;
    window.HumanityApp?.enter(false, { fromFilm: true, music: soundOn, ambient: !!window.Ambient?.enabled });
    setTimeout(() => { film.remove(); }, 1300); // the <audio> element isn't in #film, so the soundtrack survives
    try { localStorage.setItem('humanity.filmSeen', String(Date.now())); } catch (e) { /* private mode */ }
    if (document.fullscreenElement && q.get('fs') === '1') document.exitFullscreen?.();
  }
  skipBtn.addEventListener('click', () => finish(false));
  exploreBtn.addEventListener('click', () => finish(false));
  addEventListener('keydown', (e) => { if (started && !finished && e.key === 'Escape') finish(false); });

  /* ---------------------------------------------------------------- */
  /* Debug: tap tempo + nudges                                        */
  /* ---------------------------------------------------------------- */
  if (DEBUG) {
    const taps = [];
    addEventListener('keydown', (e) => {
      if (!started || finished) return; const t = clock.now();
      if (e.key === 't' || e.key === 'T') { taps.push(t); if (taps.length > 12) taps.shift(); if (taps.length >= 4) { const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]); const med = iv.sort((a, b) => a - b)[iv.length >> 1]; T.bpm = clamp(60 / med, T.minBpm, T.maxBpm); const ph = taps[taps.length - 1] - T.offset; T.offset += ph - Math.round(ph / spb()) * spb(); } }
      else if (e.key === 'o' || e.key === 'O') { T.offset = t - Math.floor(beatAt(t) / 4) * 4 * spb(); }
      else if (e.key === 'ArrowLeft') T.offset -= e.shiftKey ? 0.01 : 0.05;
      else if (e.key === 'ArrowRight') T.offset += e.shiftKey ? 0.01 : 0.05;
      else if (e.key === 'ArrowUp') T.bpm = clamp(T.bpm + (e.shiftKey ? 0.1 : 0.5), T.minBpm, T.maxBpm);
      else if (e.key === 'ArrowDown') T.bpm = clamp(T.bpm - (e.shiftKey ? 0.1 : 0.5), T.minBpm, T.maxBpm);
      else if (e.key === '[') clock.seek(Math.max(0, t - 5));
      else if (e.key === ']') clock.seek(t + 5);
      else return;
      e.preventDefault(); bpmEl.textContent = T.bpm.toFixed(1) + ' BPM';
    });
  }
  bpmEl.textContent = T.bpm.toFixed(1) + ' BPM';

  window.Film = { get glWhy() { return glWhy; }, musicActive, toggleMusic, seek: (s) => clock.seek(s), get timing() { return T; }, chapters, shots, images: S.IMAGES, local: LOCAL, get music() { return music; } };
  preload();
})();
