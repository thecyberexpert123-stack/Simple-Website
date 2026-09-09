/* =====================================================================
   HUMANITY — cosmos.js
   A single full-screen canvas particle engine. Every section requests a
   "scene"; particles morph smoothly between layouts (stars → galaxy →
   embers → ink → orbit → gears → helix → wind → atom → warp → network →
   bloom). Pointer movement adds gentle parallax. Respects reduced motion.
   ===================================================================== */

window.Cosmos = (function () {
  'use strict';

  const canvas = document.getElementById('cosmos');
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 800px)').matches || navigator.hardwareConcurrency <= 4;

  const N = isMobile ? 520 : 1300;       // morphing particles
  const STARS = isMobile ? 220 : 480;    // static twinkling backdrop
  const TAU = Math.PI * 2;

  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, minDim = 0;
  let mode = 'stars', prevMode = 'stars', morph = 1;   // morph 0→1 after a mode switch
  let t = 0, last = performance.now();
  let pointer = { x: 0, y: 0, tx: 0, ty: 0 };           // -1..1 parallax
  let scrollVel = 0, lastScrollY = window.scrollY;
  let running = true;

  /* ---------- palettes per scene ---------- */
  const PAL = {
    stars:   { bg: [8, 10, 20],   a: [232, 201, 138], b: [180, 200, 255] },
    galaxy:  { bg: [7, 8, 18],    a: [200, 180, 255], b: [255, 220, 160] },
    embers:  { bg: [14, 7, 4],    a: [255, 140, 40],  b: [255, 220, 120] },
    ink:     { bg: [10, 9, 8],    a: [220, 210, 190], b: [232, 201, 138] },
    orbit:   { bg: [6, 9, 18],    a: [232, 201, 138], b: [140, 190, 255] },
    gears:   { bg: [10, 9, 8],    a: [230, 170, 90],  b: [200, 200, 210] },
    helix:   { bg: [5, 12, 12],   a: [126, 240, 194], b: [232, 201, 138] },
    wind:    { bg: [8, 11, 18],   a: [220, 230, 255], b: [232, 201, 138] },
    atom:    { bg: [8, 7, 16],    a: [255, 159, 110], b: [140, 200, 255] },
    warp:    { bg: [3, 4, 9],     a: [255, 255, 255], b: [180, 200, 255] },
    network: { bg: [6, 9, 14],    a: [126, 200, 255], b: [232, 201, 138] },
    bloom:   { bg: [10, 7, 14],   a: [242, 143, 177], b: [199, 164, 255] }
  };

  /* ---------- particle store ---------- */
  const px = new Float32Array(N), py = new Float32Array(N);       // current
  const fx = new Float32Array(N), fy = new Float32Array(N);       // from (for morph)
  const seed = new Float32Array(N), seed2 = new Float32Array(N), seed3 = new Float32Array(N);
  const size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    seed[i] = Math.random(); seed2[i] = Math.random(); seed3[i] = Math.random();
    size[i] = 0.6 + Math.pow(Math.random(), 3) * 2.2;
  }
  const stars = [];
  for (let i = 0; i < STARS; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2, p: Math.random() * TAU, s: 0.4 + Math.random() * 1.2 });

  /* ---------- helpers ---------- */
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  function mixColor(c1, c2, k) { return [lerp(c1[0], c2[0], k) | 0, lerp(c1[1], c2[1], k) | 0, lerp(c1[2], c2[2], k) | 0]; }
  let bgCur = PAL.stars.bg.slice(), colA = PAL.stars.a.slice(), colB = PAL.stars.b.slice();

  /* ---------- scene layouts: given (i, time) → [x, y, alpha] in px ---------- */
  const out = [0, 0, 1];
  const scenes = {
    stars(i, tm) {
      // slow drifting field with subtle depth
      const z = 0.3 + seed3[i] * 0.7;
      const x = ((seed[i] + tm * 0.004 * z) % 1) * W;
      const y = ((seed2[i] + Math.sin(tm * 0.1 + seed[i] * 9) * 0.002) % 1 + 1) % 1 * H;
      out[0] = x; out[1] = y; out[2] = 0.25 + z * 0.6 * (0.7 + 0.3 * Math.sin(tm * 2 * z + seed[i] * 50));
      return out;
    },
    galaxy(i, tm) {
      // logarithmic spiral, two arms
      const arm = i % 2 ? Math.PI : 0;
      const r = Math.pow(seed[i], 0.55) * minDim * 0.55;
      const th = arm + Math.log(1 + r / (minDim * 0.06)) * 2.6 + tm * 0.05 + (seed2[i] - 0.5) * 0.9 * (1 - seed[i] * 0.5);
      const tilt = 0.42;
      out[0] = cx + Math.cos(th) * r;
      out[1] = cy + Math.sin(th) * r * tilt + (seed3[i] - 0.5) * 18;
      out[2] = 0.35 + (1 - seed[i]) * 0.65;
      return out;
    },
    embers(i, tm) {
      // rising sparks from the bottom centre
      const life = (seed2[i] + tm * (0.05 + seed3[i] * 0.09)) % 1;
      const spread = (seed[i] - 0.5) * (0.25 + life * 0.9) * W;
      const wob = Math.sin(tm * 1.5 + seed[i] * 40) * 18 * life;
      out[0] = cx + spread + wob;
      out[1] = H - life * H * 1.05;
      out[2] = (1 - life) * (0.5 + seed3[i] * 0.5);
      return out;
    },
    ink(i, tm) {
      // horizontal "lines of text" that ripple like writing
      const rows = 14;
      const row = Math.floor(seed2[i] * rows);
      const y = H * 0.12 + (row / rows) * H * 0.78;
      const x = ((seed[i] + tm * 0.018 * (0.5 + seed3[i] * 0.5)) % 1) * W;
      const gap = Math.sin(x * 0.03 + row) > 0.6 ? 1 : 0; // word gaps
      out[0] = x; out[1] = y + Math.sin(tm * 0.8 + x * 0.01) * 3;
      out[2] = gap ? 0.05 : 0.25 + seed3[i] * 0.5;
      return out;
    },
    orbit(i, tm) {
      // nested elliptical orbits — Kepler's solar system
      const ring = 1 + Math.floor(seed[i] * 7);
      const r = minDim * (0.06 + ring * 0.065);
      const speed = 0.35 / Math.pow(ring, 1.5) * 2.2;
      const th = seed2[i] * TAU + tm * speed;
      const jitter = (seed3[i] - 0.5) * 6;
      out[0] = cx + Math.cos(th) * r + jitter;
      out[1] = cy + Math.sin(th) * r * 0.62 + jitter;
      out[2] = 0.3 + (seed3[i] > 0.94 ? 0.7 : 0.3);
      return out;
    },
    gears(i, tm) {
      // three meshing gear rings turning in alternate directions
      const g = i % 3;
      const centers = [[cx - minDim * 0.28, cy - minDim * 0.05, minDim * 0.19, 1], [cx + minDim * 0.02, cy + minDim * 0.14, minDim * 0.16, -1.19], [cx + minDim * 0.30, cy - minDim * 0.12, minDim * 0.13, 1.46]];
      const [gx, gy, gr, dir] = centers[g];
      const teeth = 14;
      const th = seed[i] * TAU + tm * 0.25 * dir;
      const tooth = (Math.sin(th * teeth) > 0.2) ? 1.12 : 1;
      const rr = gr * (seed2[i] < 0.7 ? tooth : seed2[i] < 0.85 ? 0.55 : 0.2 + seed3[i] * 0.2);
      out[0] = gx + Math.cos(th) * rr; out[1] = gy + Math.sin(th) * rr;
      out[2] = 0.35 + seed3[i] * 0.5;
      return out;
    },
    helix(i, tm) {
      // DNA double helix rotating slowly
      const k = seed[i];
      const y = H * 0.02 + k * H * 0.96;
      const ph = k * TAU * 2.2 + tm * 0.7;
      const strand = i % 2 ? Math.PI : 0;
      const rung = seed2[i] < 0.28;
      const amp = minDim * 0.16;
      if (rung) {
        const q = Math.round(k * 26) / 26;
        const ph2 = q * TAU * 2.2 + tm * 0.7;
        const m = seed3[i] * 2 - 1;
        out[0] = cx + Math.sin(ph2) * amp * m; out[1] = H * 0.02 + q * H * 0.96;
        out[2] = 0.25 + 0.4 * (0.5 + 0.5 * Math.cos(ph2));
      } else {
        out[0] = cx + Math.sin(ph + strand) * amp + (seed3[i] - 0.5) * 4; out[1] = y;
        out[2] = 0.35 + 0.6 * (0.5 + 0.5 * Math.cos(ph + strand));
      }
      return out;
    },
    wind(i, tm) {
      // streamlines over an aerofoil — flight
      const y0 = seed2[i];
      const x = ((seed[i] + tm * 0.09 * (0.6 + seed3[i] * 0.6)) % 1);
      const d = x - 0.5;
      const bump = Math.exp(-d * d * 22) * (y0 - 0.5 < 0 ? -1 : 1) * 0.12 * (1 - Math.abs(y0 - 0.5) * 1.6);
      out[0] = x * W; out[1] = (y0 + bump) * H;
      out[2] = 0.2 + seed3[i] * 0.5;
      return out;
    },
    atom(i, tm) {
      // nucleus + three tilted electron shells
      if (seed[i] < 0.18) {
        const r = Math.pow(seed2[i], 0.5) * minDim * 0.05;
        const a = seed3[i] * TAU + tm * 0.3;
        out[0] = cx + Math.cos(a) * r; out[1] = cy + Math.sin(a) * r; out[2] = 0.9;
        return out;
      }
      const shell = Math.floor((seed[i] - 0.18) / 0.82 * 3);
      const tilt = shell * (Math.PI / 3);
      const r = minDim * 0.3;
      const th = seed2[i] * TAU + tm * (1.1 - shell * 0.2) * (shell % 2 ? -1 : 1);
      const ex = Math.cos(th) * r, ey = Math.sin(th) * r * 0.32;
      out[0] = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
      out[1] = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      out[2] = 0.2 + (Math.sin(th * 3 + tm * 4) > 0.9 ? 0.8 : 0.25);
      return out;
    },
    warp(i, tm) {
      // starfield rushing toward the viewer
      const z = (seed3[i] + tm * 0.18 * (0.5 + seed2[i] * 0.5)) % 1;   // 0 far → 1 near
      const a = seed[i] * TAU;
      const r = Math.pow(z, 1.8) * minDim * 0.9 + 4;
      out[0] = cx + Math.cos(a) * r; out[1] = cy + Math.sin(a) * r;
      out[2] = Math.min(1, z * 1.4) * 0.9;
      return out;
    },
    network(i, tm) {
      // slowly drifting nodes; connections drawn separately
      const x = (seed[i] + Math.sin(tm * 0.11 + seed2[i] * 12) * 0.02) * W;
      const y = (seed2[i] + Math.cos(tm * 0.13 + seed[i] * 10) * 0.02) * H;
      out[0] = x; out[1] = y; out[2] = 0.3 + seed3[i] * 0.5;
      return out;
    },
    bloom(i, tm) {
      // a phyllotaxis flower opening
      const n = i;
      const golden = 2.399963;
      const open = 0.75 + 0.25 * Math.sin(tm * 0.35);
      const r = Math.sqrt(n / N) * minDim * 0.46 * open;
      const a = n * golden + tm * 0.06;
      out[0] = cx + Math.cos(a) * r; out[1] = cy + Math.sin(a) * r * 0.9;
      out[2] = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(n * 0.05 - tm * 1.2));
      return out;
    }
  };

  /* ---------- resize ---------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2; minDim = Math.min(W, H);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  /* ---------- pointer parallax ---------- */
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / W - 0.5) * 2;
    pointer.ty = (e.clientY / H - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('scroll', () => {
    const y = window.scrollY; scrollVel += (y - lastScrollY) * 0.002; lastScrollY = y;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else if (!paused) { running = true; last = performance.now(); requestAnimationFrame(frame); } });
  let paused = false;
  function pause() { paused = true; running = false; }
  function resume() { if (!paused) return; paused = false; running = true; last = performance.now(); requestAnimationFrame(frame); }
  // Advance the simulation by `ms` and draw one frame (used for testing / static captures)
  function tick(ms) { last = performance.now() - (ms || 16); frame(performance.now()); }

  /* ---------- API ---------- */
  function setMode(m) {
    if (!scenes[m] || m === mode) return;
    // capture current positions as the "from" for the morph
    for (let i = 0; i < N; i++) { fx[i] = px[i]; fy[i] = py[i]; }
    prevMode = mode; mode = m; morph = 0;
  }

  /* ---------- frame ---------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    t += dt * (reduced ? 0.25 : 1);
    if (morph < 1) morph = Math.min(1, morph + dt / 1.8);
    const k = ease(morph);
    pointer.x = lerp(pointer.x, pointer.tx, 0.04); pointer.y = lerp(pointer.y, pointer.ty, 0.04);
    scrollVel *= 0.9;

    const pal = PAL[mode];
    bgCur = mixColor(bgCur, pal.bg, 0.03); colA = mixColor(colA, pal.a, 0.03); colB = mixColor(colB, pal.b, 0.03);

    // background
    ctx.fillStyle = `rgb(${bgCur[0]},${bgCur[1]},${bgCur[2]})`;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(cx - pointer.x * 40, cy * 0.7 - pointer.y * 40, 0, cx, cy, Math.max(W, H) * 0.8);
    g.addColorStop(0, `rgba(${colB[0]},${colB[1]},${colB[2]},0.07)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // static stars
    const parX = pointer.x * 8, parY = pointer.y * 8 + scrollVel * 6;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < STARS; i++) {
      const s = stars[i];
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.globalAlpha = tw * 0.55;
      ctx.beginPath(); ctx.arc(s.x * W + parX * s.r, s.y * H + parY * s.r, s.r, 0, TAU); ctx.fill();
    }

    // morphing particles
    const layout = scenes[mode];
    const depthX = pointer.x * 22, depthY = pointer.y * 22 + scrollVel * 30;
    for (let i = 0; i < N; i++) {
      const o = layout(i, t);
      let x = o[0], y = o[1];
      if (k < 1) { x = lerp(fx[i], x, k); y = lerp(fy[i], y, k); }
      px[i] = x; py[i] = y;
      const a = o[2] * (k < 1 ? 0.5 + 0.5 * k : 1);
      const c = seed3[i] > 0.5 ? colA : colB;
      const r = size[i] * (0.8 + o[2] * 0.6);
      const drawX = x + depthX * seed3[i], drawY = y + depthY * seed3[i];
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.arc(drawX, drawY, r, 0, TAU); ctx.fill();
      if (r > 2.2 && a > 0.6) {          // halo for the brightest
        ctx.globalAlpha = a * 0.18;
        ctx.beginPath(); ctx.arc(drawX, drawY, r * 3, 0, TAU); ctx.fill();
      }
    }

    // scene-specific overlays
    ctx.globalAlpha = 1;
    if (mode === 'network' && k > 0.5) drawNetwork(k);
    if (mode === 'warp') drawWarpTrails(k);
    if (mode === 'orbit') drawOrbitRings(k);

    ctx.globalAlpha = 1;
    if (running) requestAnimationFrame(frame);
  }

  function drawNetwork(k) {
    const step = isMobile ? 9 : 5;   // sample subset for links
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = `rgba(${colA[0]},${colA[1]},${colA[2]},1)`;
    const maxD = minDim * 0.09, maxD2 = maxD * maxD;
    for (let i = 0; i < N; i += step) {
      for (let j = i + step; j < N; j += step) {
        const dx = px[i] - px[j], dy = py[i] - py[j]; const d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          ctx.globalAlpha = (1 - d2 / maxD2) * 0.35 * (k - 0.5) * 2;
          ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(px[j], py[j]); ctx.stroke();
        }
      }
    }
  }
  function drawWarpTrails(k) {
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${colB[0]},${colB[1]},${colB[2]},1)`;
    for (let i = 0; i < N; i += 3) {
      const dx = px[i] - cx, dy = py[i] - cy; const d = Math.hypot(dx, dy);
      if (d < 40) continue;
      const len = Math.min(60, d * 0.12);
      ctx.globalAlpha = Math.min(0.5, d / minDim) * k;
      ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(px[i] - dx / d * len, py[i] - dy / d * len); ctx.stroke();
    }
  }
  function drawOrbitRings(k) {
    ctx.lineWidth = 0.5; ctx.strokeStyle = `rgba(${colA[0]},${colA[1]},${colA[2]},1)`;
    for (let ring = 1; ring <= 7; ring++) {
      const r = minDim * (0.06 + ring * 0.065);
      ctx.globalAlpha = 0.08 * k;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.62, 0, 0, TAU); ctx.stroke();
    }
    // the sun
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
    sg.addColorStop(0, `rgba(${colA[0]},${colA[1]},${colA[2]},0.9)`); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = k; ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, 40, 0, TAU); ctx.fill();
  }

  // initialise positions so the first frame isn't a jump from (0,0)
  for (let i = 0; i < N; i++) { const o = scenes.stars(i, 0); px[i] = fx[i] = o[0]; py[i] = fy[i] = o[1]; }
  requestAnimationFrame(frame);

  return { setMode, pause, resume, tick, get mode() { return mode; } };
})();
