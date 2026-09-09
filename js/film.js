/* =====================================================================
   HUMANITY — film.js
   The editor. Takes FILM_SCRIPT (beats) + a clock (YouTube stream time
   or a local timer) and cuts the picture live in the browser.

   Public API (window.Film):
     musicActive()   → true when the soundtrack is running
     toggleMusic()   → mute/unmute, returns "on"
     seek(sec)       → debug jump
   Query params: ?bpm= ?offset= ?t= ?speed= ?debug=1 ?nofilm=1
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
  const screenPx = Math.min(2560, Math.round(Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2)));
  const want = screenPx > 1920 ? 2560 : screenPx > 1280 ? 1920 : 1280;
  function urlFor(def, width) {
    const f = encodeURIComponent(def.file).replace(/%2C/g, ',').replace(/%27/g, "'").replace(/%28/g, '(').replace(/%29/g, ')').replace(/%21/g, '!').replace(/%2A/g, '*').replace(/%26/g, '%26');
    const base = `https://upload.wikimedia.org/wikipedia/commons/${def.h[0]}/${def.h}/${f}`;
    if (!width || width >= def.w) return base;
    const isPng = /\.png$/i.test(def.file);
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${def.h[0]}/${def.h}/${f}/${width}px-${f}${isPng ? '.png' : ''}`;
  }
  Object.values(S.IMAGES).forEach((d) => { d.src = urlFor(d, want); d.srcLo = urlFor(d, 1280); d.page = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(d.file)}`; });

  const imgState = {}; const imgCache = {};
  function loadImage(key) {
    if (imgState[key]) return imgCache[key];
    const def = S.IMAGES[key]; if (!def) return Promise.resolve(false);
    imgState[key] = 'loading';
    imgCache[key] = new Promise((res) => {
      const im = new Image(); im.decoding = 'async'; im.referrerPolicy = 'no-referrer';
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
  /* Music (YouTube IFrame API) with graceful fallback                */
  /* ---------------------------------------------------------------- */
  const music = { api: false, player: null, ready: false, playing: false, failed: false, muted: false, everPlayed: false, pending: false, wantStart: false };
  function loadYT() {
    return new Promise((res) => {
      if (window.YT && window.YT.Player) { music.api = true; return res(true); }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); music.api = true; res(true); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }
  function createPlayer() {
    if (!music.api || music.player) return;
    try {
      music.player = new YT.Player('yt-player', {
        videoId: T.videoId, width: 320, height: 180,
        host: 'https://www.youtube.com',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, iv_load_policy: 3, modestbranding: 1, origin: location.origin, enablejsapi: 1 },
        events: {
          onReady: () => { music.ready = true; if (music.wantStart) startMusic(); },
          onStateChange: (e) => {
            const st = e.data;
            if (st === YT.PlayerState.PLAYING) { music.playing = true; music.everPlayed = true; clock.syncHard(); nowPlaying.classList.add('show'); nowPlaying.classList.remove('warn'); nowTitle.innerHTML = NOW_HTML; if (window.Ambient?.enabled) window.Ambient.disable(); }
            else if (st === YT.PlayerState.PAUSED) { music.playing = false; if (!finished && !music.muted && music.everPlayed) { try { music.player.playVideo(); } catch (err) { /* noop */ } } }
            else if (st === YT.PlayerState.BUFFERING || st === YT.PlayerState.CUED) music.playing = false;
            else if (st === YT.PlayerState.ENDED) { music.playing = false; try { music.player.seekTo(0, true); music.player.playVideo(); } catch (err) { /* noop */ } }
          },
          onError: () => { music.failed = true; music.playing = false; showAudioWarn('soundtrack unavailable (video blocked here) — playing ambient score'); if (withAudio) window.Ambient?.enable(); }
        }
      });
    } catch (e) { music.failed = true; }
  }
  const NOW_HTML = nowTitle.innerHTML;
  function showAudioWarn(msg) { nowPlaying.classList.add('show', 'warn'); nowTitle.textContent = msg; }
  function startMusic() {
    if (music.failed) return false;
    music.wantStart = true;
    if (!music.player) return false;
    if (!music.ready) return true; // will start in onReady (still inside the user-gesture grace period on most browsers)
    try {
      music.player.unMute(); music.player.setVolume(100);
      music.player.playVideo();
      // Browsers may swallow the first play() if the iframe wasn't fully warm; retry a few times, then tell the user
      let tries = 0; const iv = setInterval(() => {
        if (music.everPlayed || finished || music.failed) { clearInterval(iv); return; }
        tries++; try { music.player.playVideo(); } catch (e) { /* noop */ }
        if (tries === 3) showAudioWarn('tap anywhere to start the soundtrack');
        if (tries > 12) { clearInterval(iv); }
      }, 700);
      // any gesture retries playback (mobile autoplay policies)
      const kick = () => { if (!music.everPlayed && !music.failed) { try { music.player.unMute(); music.player.playVideo(); } catch (e) { /* noop */ } } };
      ['pointerdown', 'keydown', 'touchend'].forEach((ev) => addEventListener(ev, kick, { passive: true }));
      return true;
    } catch (e) { music.failed = true; return false; }
  }
  function musicActive() { return !!(music.player && music.everPlayed && !music.failed); }
  function toggleMusic() {
    if (!musicActive()) return false;
    try { if (music.muted) { music.player.unMute(); music.player.playVideo(); music.muted = false; } else { music.player.mute(); music.muted = true; } } catch (e) { /* noop */ }
    return !music.muted;
  }
  function settleMusic() { // after the film: keep the track as the site's soundtrack, quieter
    if (!musicActive()) return;
    let v = 100; const iv = setInterval(() => { v -= 4; try { music.player.setVolume(Math.max(38, v)); } catch (e) { /* noop */ } if (v <= 38) clearInterval(iv); }, 60);
  }

  /* ---------------------------------------------------------------- */
  /* Clock — stream time when the player runs, local timer otherwise   */
  /* ---------------------------------------------------------------- */
  const clock = {
    t0: 0, base: 0, speed: parseFloat(q.get('speed')) || 1, running: false, source: 'timer', lastSample: -1, lastSampleAt: 0,
    start(at = 0) { this.base = at; this.t0 = performance.now(); this.running = true; },
    now() {
      if (!this.running) return 0;
      const local = this.base + ((performance.now() - this.t0) / 1000) * this.speed;
      if (music.playing && !music.failed) {
        let s = -1; try { s = music.player.getCurrentTime(); } catch (e) { s = -1; }
        if (s >= 0) {
          this.source = 'stream';
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
    syncHard() { try { const s = music.player.getCurrentTime(); if (s >= 0) { this.base = s; this.t0 = performance.now(); } } catch (e) { /* noop */ } },
    seek(sec) { this.base = sec; this.t0 = performance.now(); if (musicActive()) { try { music.player.seekTo(sec, true); } catch (e) { /* noop */ } } }
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
    const tasks = [];
    const bump = (n) => () => setTarget(targetPct + n);
    tasks.push(withTimeout((document.fonts?.load('800 40px Syne') || Promise.resolve()).then(() => document.fonts?.load('400 12px "Space Mono"')), 2500).then(bump(10)));
    firstKeys.forEach((k) => tasks.push(withTimeout(loadImage(k), 6000).then(bump(50 / firstKeys.length))));
    const yt = loadYT().then((ok) => { if (ok === true) createPlayer(); return ok; });
    tasks.push(withTimeout(yt, 5000).then(bump(20)));
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
    if (music.failed || !music.player) { $('#enter-audio .fbtn-tag').textContent = music.player ? '( recommended )' : '( audio may be unavailable )'; }
    const clockEl = $('#fgate-clock'); const tickClock = () => { clockEl.textContent = new Date().toTimeString().slice(0, 8) + ' LOCAL'; }; tickClock(); setInterval(tickClock, 1000);
    const mk = (root) => { const track = root.querySelector('.marquee-track'); const html = S.TAGS.map((t) => `<span><i>[</i>${esc(t)}<i style="margin:0 0 0 22px">]</i></span>`).join(''); track.innerHTML = html + html; };
    mk($('#fgate-marquee')); mk($('#stage-marquee'));
    // background stills drifting behind the gate
    const bg = $('#fgate-bg'); ['milky', 'pillars', 'aldrin', 'earthrise'].forEach((k, i) => { const d = S.IMAGES[k]; const im = el('img'); im.alt = ''; im.src = d.srcLo; im.style.animationDelay = (i * 4) + 's'; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); bg.appendChild(im); });
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
    let musicStarted = false;
    if (audio) musicStarted = startMusic();
    const t = parseFloat(q.get('t')) || 0;
    clock.start(t);
    if (musicStarted && t > 0) clock.seek(t);
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
  function still(shot, slot, key) {
    const def = S.IMAGES[key];
    if (!def || imgState[key] === 'fail') { slot.dataset.kind = 'gen'; return gen(genWord(shot), `( ${shot.chapter.code} · ${key} )`); }
    const wrap = el('div', 'media');
    const im = el('img', 'media img kb' + (kbI++ % 6)); im.alt = ''; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; im.src = def.src;
    im.style.animationDuration = Math.max(1.2, shot.beats * spb() + 1.2) + 's';
    im.onerror = () => { imgState[key] = 'fail'; wrap.replaceWith(gen(genWord(shot), `( ${shot.chapter.code} )`)); slot.dataset.kind = 'gen'; };
    wrap.appendChild(im);
    const gr = el('img', 'ghost r'); gr.src = def.srcLo; gr.alt = ''; gr.referrerPolicy = 'no-referrer'; const gb = el('img', 'ghost b'); gb.src = def.srcLo; gb.alt = ''; gb.referrerPolicy = 'no-referrer';
    wrap.appendChild(gr); wrap.appendChild(gb); slot.dataset.kind = 'img'; return wrap;
  }
  function mediaFor(shot, slot) {
    const m = shot.media; const frame = el('div', 'frame');
    if (typeof m === 'object' && m.mode) { frame.appendChild(gen(shot.chapter.kind === 'open' ? '' : (shot.chapter.title || ''), `( ${shot.chapter.code} )`, true)); slot.dataset.kind = 'gen'; return frame; }
    if (typeof m === 'string') { frame.appendChild(still(shot, slot, m)); return frame; }
    // clip: poster + muted YouTube iframe (poster stays underneath until the video is visibly playing)
    const c = el('div', 'media clip'); c.appendChild(still(shot, slot, m.fallback));
    const ifr = document.createElement('iframe');
    const id = m.yt; const start = m.start || 0;
    ifr.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&start=${start}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&loop=1&playlist=${id}&vq=hd1080`;
    ifr.allow = 'autoplay; encrypted-media'; ifr.title = ''; ifr.tabIndex = -1; ifr.setAttribute('aria-hidden', 'true'); ifr.referrerPolicy = 'strict-origin-when-cross-origin';
    ifr.addEventListener('load', () => setTimeout(() => ifr.classList.add('live'), 1400));
    c.appendChild(ifr); frame.appendChild(c); slot.dataset.kind = 'clip'; return frame;
  }
  function makeSlot(shot) { const slot = el('div', 'slot'); slot.dataset.shot = shot.index; slot.appendChild(mediaFor(shot, slot)); slots.appendChild(slot); return slot; }
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
    const w = el('div', 'word'); w.textContent = text;
    const variants = ['w-center', 'w-left', 'w-right', 'w-low', 'w-high'];
    w.classList.add(variants[Math.floor(Math.random() * variants.length)]);
    if (Math.random() < 0.3) w.classList.add('outline');
    w.style.setProperty('--dur', Math.min(2.2, Math.max(0.6, beats * spb())) + 's');
    wordsEl.appendChild(w);
    setTimeout(() => w.remove(), Math.min(2400, beats * spb() * 1000 + 300));
  }

  function showShot(i, hard) {
    const shot = shots[i]; if (!shot) return;
    const prev = curSlot; curShot = i;
    const slot = prewarmed.get(i) || makeSlot(shot); prewarmed.delete(i);
    const tr = hard ? 'cut' : shot.tr;
    slot.classList.add('on', 'tr-' + tr);
    if (prev) { prev.classList.remove('on'); prev.classList.add('off', 'tr-' + tr); }
    void slot.offsetWidth; slot.classList.add('go');
    if (!hard) { FX[tr]?.(); if (!titlecard) slamWord(shot.word, shot.beats); }
    curSlot = slot;
    if (prev) setTimeout(() => { prev.classList.add('gone'); setTimeout(() => prev.remove(), 600); }, 550);
    // caption + credit
    capEl.textContent = shot.caption || ''; capEl.classList.toggle('on', !!shot.caption);
    const key = keyOf(shot.media); const def = key && S.IMAGES[key];
    if (typeof shot.media === 'object' && shot.media.yt) creditEl.textContent = 'footage · youtube.com/watch?v=' + shot.media.yt;
    else creditEl.textContent = def && slot.dataset.kind === 'img' ? `${def.credit} · ${def.license}` : '';
    // prewarm upcoming clips (~5 s ahead) so iframes are already playing when they cut in
    for (let j = i + 1; j < shots.length && shots[j].start - shot.start < Math.ceil(5 / spb()) + 1; j++) { const mj = shots[j].media; if (typeof mj === 'object' && mj.yt) prewarm(shots[j]); }
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
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => { tc.classList.add('in'); h.classList.add('in'); }));
    }
    tcOutBeat = ch.kind === 'finale' ? ch.start + ch.len * 0.5 : ch.kind === 'title' ? ch.start + 14 : ch.start + 4;
    if (ch.kind === 'finale') { exploreBtn.hidden = false; setTimeout(() => exploreBtn.classList.add('show'), 4 * spb() * 1000); }
  }
  function hideTitlecard() {
    const tc = titlecard; if (!tc) return; titlecard = null; tcOutBeat = Infinity;
    tc.classList.add('out'); tc.classList.remove('in'); tc.querySelector('.tc-title')?.classList.add('out');
    setTimeout(() => tc.remove(), 900);
  }

  function onBeat(b) {
    const inBar = ((b % 4) + 4) % 4;
    beatDots.forEach((d, i) => d.classList.toggle('on', i === inBar));
    stage.classList.remove('beat', 'downbeat'); void stage.offsetWidth; stage.classList.add(inBar === 0 ? 'downbeat' : 'beat');
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
    if (DEBUG) debugEl.textContent = `t ${t.toFixed(2)}s  beat ${beat.toFixed(2)}  bar ${Math.floor(beat / 4) + 1}\nbpm ${T.bpm.toFixed(2)}  offset ${T.offset.toFixed(3)}s  clock ${clock.source}  music ${music.playing ? 'playing' : music.failed ? 'failed' : music.ready ? 'ready' : music.player ? 'created' : 'none'}\nchapter ${chapters[curChapter]?.id || '-'}  shot ${curShot}\n?bpm=${T.bpm.toFixed(2)}&offset=${T.offset.toFixed(3)}\nT tap · O downbeat · ←→ offset · ↑↓ bpm · [ ] seek`;
    raf = requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- */
  /* Finish → hand over to the monument                               */
  /* ---------------------------------------------------------------- */
  function finish(natural) {
    if (finished) return; finished = true; cancelAnimationFrame(raf);
    if (natural) flash('full');
    film.classList.add('done'); document.body.classList.remove('filming');
    settleMusic();
    const soundOn = musicActive() && !music.muted;
    window.HumanityApp?.enter(false, { fromFilm: true, music: soundOn, ambient: !!window.Ambient?.enabled });
    setTimeout(() => { film.remove(); }, 1300);
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

  window.Film = { musicActive, toggleMusic, seek: (s) => clock.seek(s), get timing() { return T; }, chapters, shots, images: S.IMAGES };
  preload();
})();
