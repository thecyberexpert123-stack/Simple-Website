/* =====================================================================
   HUMANITY — js/glx.js
   GPU shader transitions for the film. A WebGL canvas sits over the
   slot stack; on a cut it blends the outgoing and incoming pictures with
   a real pixel effect (liquid displacement, chroma zoom, cross-warp,
   ripple, mosaic, swirl, luminance burn, slices) driven by a progress
   uniform, then gets out of the way. Everything degrades: if WebGL is
   missing, the image is cross-origin tainted, or the frame isn't ready,
   `GLX.transition()` returns false and film.js falls back to its CSS
   transitions.

   API
     GLX.supported                     boolean
     GLX.mount(stageEl)                creates the canvas inside the stage
     GLX.prepare(imgEl)                upload a texture early (idle time)
     GLX.transition({ from, to, effect, dir, duration, ease, onDone })
                                        from/to: { el: <img>|<video>, matrix: () => DOMMatrix|null }
                                        returns true if the GPU took the cut
     GLX.busy                          a transition is running
   ===================================================================== */
(function () {
  'use strict';
  const EFFECTS = { liquid: 0, chroma: 1, warp: 2, ripple: 3, mosaic: 4, swirl: 5, luma: 6, slices: 7 };
  const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D uA, uB;
uniform float uP, uT, uSeed, uAspect, uAspA, uAspB, uDirX, uDirY, uInv;
uniform int uFx;
uniform mat3 uMA, uMB;   /* inverse element transforms, in element uv space */

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<4;i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }

/* screen uv -> element uv (undo the CSS transform) -> cover-fit texture uv */
vec2 cover(vec2 uv, float ia){
  if (ia > uAspect) { uv.x = (uv.x - 0.5) * (uAspect / ia) + 0.5; }
  else { uv.y = (uv.y - 0.5) * (ia / uAspect) + 0.5; }
  return uv;
}
vec2 mapA(vec2 uv){ vec3 e = uMA * vec3(uv, 1.0); return cover(e.xy, uAspA); }
vec2 mapB(vec2 uv){ vec3 e = uMB * vec3(uv, 1.0); return cover(e.xy, uAspB); }
vec4 A(vec2 uv){ return texture2D(uA, mapA(uv)); }
vec4 B(vec2 uv){ return texture2D(uB, mapB(uv)); }
float luma(vec4 c){ return dot(c.rgb, vec3(0.299, 0.587, 0.114)); }

void main(){
  vec2 uv = vec2(v.x, 1.0 - v.y); /* CSS space: y down, matches image rows */
  float p = uP; vec4 c;
  vec2 ar = vec2(uAspect, 1.0);
  if (uFx == 0) {            /* liquid displacement dissolve */
    float n = fbm(uv * ar * 2.4 + uSeed * 7.0 + uT * 0.05);
    vec2 d = (vec2(n, fbm(uv * ar * 2.4 + 13.1 + uSeed)) - 0.5) * 0.35;
    float k = smoothstep(0.0, 1.0, p);
    vec4 a = A(uv + d * k); vec4 b = B(uv - d * (1.0 - k));
    float m = smoothstep(n - 0.25, n + 0.25, p * 1.5 - 0.25);
    c = mix(a, b, m);
  } else if (uFx == 1) {     /* chromatic zoom */
    float s = sin(p * 3.14159);
    float dir = uInv > 0.5 ? -1.0 : 1.0;
    vec2 ca = (uv - 0.5) / (1.0 + dir * 0.55 * p) + 0.5;
    vec2 cb = (uv - 0.5) * (1.0 + dir * 0.35 * (1.0 - p)) + 0.5;
    vec2 off = (uv - 0.5) * s * 0.035;
    vec4 a = vec4(A(ca + off).r, A(ca).g, A(ca - off).b, 1.0);
    vec4 b = vec4(B(cb + off).r, B(cb).g, B(cb - off).b, 1.0);
    c = mix(a, b, smoothstep(0.25, 0.75, p));
    c.rgb += s * 0.12;
  } else if (uFx == 2) {     /* directional cross-warp */
    vec2 dirv = vec2(uDirX, uDirY);
    float d = dot(uv - 0.5, dirv) + 0.5;
    float x = smoothstep(0.0, 1.0, p * 2.0 + d - 1.0);
    vec2 ua = (uv - 0.5) * (1.0 - x) + 0.5;
    vec2 ub = (uv - 0.5) * x + 0.5;
    ua += dirv * x * 0.12; ub -= dirv * (1.0 - x) * 0.12;
    c = mix(A(ua), B(ub), x);
  } else if (uFx == 3) {     /* ripple iris */
    vec2 q = (uv - 0.5) * ar; float r = length(q);
    float edge = p * 1.15;
    float w = sin(r * 34.0 - p * 22.0) * 0.012 * (1.0 - p) * smoothstep(edge + 0.25, edge - 0.05, r);
    vec2 duv = uv + normalize(q + 1e-4) * w;
    float m = smoothstep(edge, edge - 0.06, r);
    c = mix(A(duv), B(duv), m);
    c.rgb += (1.0 - abs(r - edge) / 0.03) * 0.25 * step(abs(r - edge), 0.03) * (1.0 - p);
  } else if (uFx == 4) {     /* mosaic glitch */
    float s = sin(p * 3.14159);
    float cell = mix(0.002, 0.075, s);
    vec2 g = vec2(cell, cell * uAspect);
    vec2 cuv = (floor(uv / g) + 0.5) * g;
    float jit = hash(floor(uv / g) + floor(uT * 20.0)) ;
    vec2 j = (jit - 0.5) * s * 0.06 * vec2(1.0, 0.0);
    float m = step(hash(floor(uv / g) + uSeed) * 0.6 + 0.2, p);
    c = mix(A(cuv + j), B(cuv - j), m);
  } else if (uFx == 5) {     /* swirl */
    vec2 q = (uv - 0.5) * ar; float r = length(q);
    float ang = sin(p * 3.14159) * 2.2 * (1.0 - smoothstep(0.0, 0.9, r));
    float cs = cos(ang), sn = sin(ang);
    vec2 rq = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs) / ar + 0.5;
    c = mix(A(rq), B(rq), smoothstep(0.3, 0.7, p));
  } else if (uFx == 6) {     /* luminance burn */
    vec4 a = A(uv); vec4 b = B(uv);
    float l = luma(a) * 0.7 + fbm(uv * ar * 3.0 + uSeed) * 0.3;
    float m = smoothstep(l - 0.12, l + 0.12, p * 1.3 - 0.1);
    float ring = smoothstep(0.0, 0.08, abs(m - 0.5) * -1.0 + 0.5) * (1.0 - p);
    c = mix(a, b, m);
    c.rgb += vec3(1.0, 0.65, 0.25) * ring * 0.9;
  } else {                    /* slices */
    float n = 12.0; float band = floor(uv.y * n);
    float delay = hash(vec2(band, uSeed)) * 0.5;
    float x = clamp((p - delay) / 0.5, 0.0, 1.0); x = x * x * (3.0 - 2.0 * x);
    float dirv = mod(band, 2.0) == 0.0 ? 1.0 : -1.0;
    vec2 ua = uv + vec2(dirv * x * 0.25, 0.0);
    vec2 ub = uv - vec2(dirv * (1.0 - x) * 0.25, 0.0);
    c = mix(A(ua), B(ub), step(uv.x * dirv + (dirv < 0.0 ? 1.0 : 0.0), x));
  }
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

  const GLX = { supported: false, busy: false };
  let gl = null, canvas = null, prog = null, U = {}, stage = null, raf = 0, active = null;
  const texCache = new Map(); // src -> { tex, w, h, at }
  let vidTexA = null, vidTexB = null;

  function makeShader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); } return s; }

  GLX.mount = function (stageEl) {
    if (canvas) return GLX.supported;
    stage = stageEl;
    try {
      canvas = document.createElement('canvas'); canvas.className = 'glx'; canvas.setAttribute('aria-hidden', 'true');
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
        || canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) return false;
      prog = gl.createProgram();
      gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uA', 'uB', 'uP', 'uT', 'uSeed', 'uAspect', 'uAspA', 'uAspB', 'uDirX', 'uDirY', 'uInv', 'uFx', 'uMA', 'uMB'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
      vidTexA = newTex(); vidTexB = newTex();
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); GLX.supported = false; endTransition(false); }, false);
      stage.appendChild(canvas);
      GLX.supported = true;
    } catch (e) { GLX.supported = false; if (canvas) canvas.remove(); canvas = null; gl = null; }
    return GLX.supported;
  };

  function newTex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return t; }
  function upload(tex, src) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
  function isVideo(el) { return el && el.tagName === 'VIDEO'; }
  function ready(el) { if (!el) return false; if (isVideo(el)) return el.readyState >= 2 && el.videoWidth > 0; return el.complete && el.naturalWidth > 0; }
  const maxTex = () => gl.getParameter(gl.MAX_TEXTURE_SIZE);

  /* Texture for an <img>, cached by src. Returns null if tainted / not ready. */
  function imageTexture(img) {
    const key = img.currentSrc || img.src; const hit = texCache.get(key);
    if (hit) { hit.at = performance.now(); return hit; }
    if (!ready(img)) return null;
    if (Math.max(img.naturalWidth, img.naturalHeight) > maxTex()) return null;
    const tex = newTex();
    try { upload(tex, img); } catch (e) { gl.deleteTexture(tex); return null; } // SecurityError → tainted (no CORS)
    if (gl.getError() !== gl.NO_ERROR) { gl.deleteTexture(tex); return null; }
    const rec = { tex, w: img.naturalWidth, h: img.naturalHeight, at: performance.now() };
    texCache.set(key, rec);
    if (texCache.size > 10) { let oldest = null; texCache.forEach((r, k) => { if (!oldest || r.at < oldest[1].at) oldest = [k, r]; }); if (oldest && oldest[1] !== rec) { gl.deleteTexture(oldest[1].tex); texCache.delete(oldest[0]); } }
    return rec;
  }
  GLX.prepare = function (img) { if (!GLX.supported || !img || isVideo(img)) return false; return !!imageTexture(img); };

  /* inverse of the element's CSS transform (about its centre), expressed in element uv space */
  function inverseMatrix(el, w, h) {
    let m = null;
    try { const t = getComputedStyle(el).transform; if (t && t !== 'none') m = new DOMMatrix(t); } catch (e) { m = null; }
    if (!m || m.is2D === false) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const { a, b, c, d, e, f } = m; const det = a * d - b * c; if (!det) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    // element uv (0..1) → px about centre → apply inverse → back to uv
    const ia = d / det, ib = -b / det, ic = -c / det, id = a / det;
    const tx = e / w, ty = f / h;
    // uv' = M^-1 * (uv - 0.5 - t) + 0.5 ; column-major mat3 for GLSL
    const ox = 0.5 - (ia * (0.5 + tx) + ic * (0.5 + ty));
    const oy = 0.5 - (ib * (0.5 + tx) + id * (0.5 + ty));
    return [ia, ib, 0, ic, id, 0, ox, oy, 1];
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.round(stage.clientWidth * dpr), h = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    return [w, h];
  }

  let dprCap = 2, slowRuns = 0; GLX.slow = false;
  function judge(a) {
    if (!a || a.frames < 4) return;
    const avg = (performance.now() - a.t0) / a.frames;
    if (avg > 34) { slowRuns++; if (dprCap > 1) dprCap = 1; else if (slowRuns >= 2) GLX.slow = true; } // < 30 fps: drop to 1× first, then hand cuts back to CSS
    else if (avg < 20 && slowRuns) slowRuns--;
  }
  function endTransition(ok) {
    if (!active) return;
    cancelAnimationFrame(raf); const a = active; active = null; GLX.busy = false; judge(a);
    canvas.classList.remove('on');
    if (a.tween && a.tween.kill) a.tween.kill();
    if (a.onDone) a.onDone(ok);
  }

  GLX.transition = function (opts) {
    GLX.lastReason = '';
    if (!GLX.supported || !opts || !opts.from || !opts.to) { GLX.lastReason = 'unsupported'; return false; }
    const fx = EFFECTS[opts.effect]; if (fx === undefined) { GLX.lastReason = 'effect'; return false; }
    const elA = opts.from.el, elB = opts.to.el;
    if (!ready(elA) || !ready(elB)) { GLX.lastReason = 'notready:' + (ready(elA) ? '' : 'A') + (ready(elB) ? '' : 'B'); return false; }
    if (active) endTransition(false);
    let recA, recB;
    try {
      if (isVideo(elA)) { upload(vidTexA, elA); recA = { tex: vidTexA, w: elA.videoWidth, h: elA.videoHeight, video: elA }; } else { recA = imageTexture(elA); }
      if (isVideo(elB)) { upload(vidTexB, elB); recB = { tex: vidTexB, w: elB.videoWidth, h: elB.videoHeight, video: elB }; } else { recB = imageTexture(elB); }
    } catch (e) { GLX.lastReason = 'upload:' + e.message; return false; }
    if (!recA || !recB) { GLX.lastReason = 'texture:' + (recA ? '' : 'A') + (recB ? '' : 'B'); return false; }
    const [W, H] = resize();
    const seed = Math.random() * 100; const t0 = performance.now();
    const dur = Math.max(0.2, opts.duration || 0.6) * 1000;
    const ease = opts.ease || ((x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const st = { p: 0 };
    if (GLX.slow) { GLX.lastReason = 'slow'; return false; }
    active = { onDone: opts.onDone, tween: null, t0, frames: 0 }; GLX.busy = true;
    canvas.classList.add('on');
    const rectW = stage.clientWidth, rectH = stage.clientHeight;
    const draw = () => {
      if (!active) return;
      const now = performance.now(); const k = Math.min(1, (now - t0) / dur);
      st.p = ease(k);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, recA.tex); if (recA.video && ready(recA.video)) { try { upload(recA.tex, recA.video); } catch (e) { /* keep last frame */ } }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, recB.tex); if (recB.video && ready(recB.video)) { try { upload(recB.tex, recB.video); } catch (e) { /* keep last frame */ } }
      gl.uniform1f(U.uP, st.p); gl.uniform1f(U.uT, (now - t0) / 1000); gl.uniform1f(U.uSeed, seed);
      gl.uniform1f(U.uAspect, W / H); gl.uniform1f(U.uAspA, recA.w / recA.h); gl.uniform1f(U.uAspB, recB.w / recB.h);
      gl.uniform1f(U.uDirX, opts.dir ? opts.dir[0] : 1); gl.uniform1f(U.uDirY, opts.dir ? opts.dir[1] : 0); gl.uniform1f(U.uInv, opts.inverse ? 1 : 0);
      gl.uniform1i(U.uFx, fx);
      gl.uniformMatrix3fv(U.uMA, false, new Float32Array(opts.from.matrix ? opts.from.matrix() || inverseMatrix(elA, rectW, rectH) : inverseMatrix(elA, rectW, rectH)));
      gl.uniformMatrix3fv(U.uMB, false, new Float32Array(opts.to.matrix ? opts.to.matrix() || inverseMatrix(elB, rectW, rectH) : inverseMatrix(elB, rectW, rectH)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); active.frames++;
      if (k >= 1) { endTransition(true); return; }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return true;
  };
  GLX.cancel = () => endTransition(false);
  /* Debug: render one frame of an effect at progress p (0..1) and return a PNG data URL. Used by the test harness. */
  GLX.debugFrame = function (opts, p) {
    if (!GLX.supported) return null;
    const fx = EFFECTS[opts.effect]; const elA = opts.from.el, elB = opts.to.el;
    const recA = isVideo(elA) ? (upload(vidTexA, elA), { tex: vidTexA, w: elA.videoWidth, h: elA.videoHeight }) : imageTexture(elA);
    const recB = isVideo(elB) ? (upload(vidTexB, elB), { tex: vidTexB, w: elB.videoWidth, h: elB.videoHeight }) : imageTexture(elB);
    if (!recA || !recB) return null;
    const [W, H] = resize();
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, recA.tex); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, recB.tex);
    gl.uniform1f(U.uP, p); gl.uniform1f(U.uT, p); gl.uniform1f(U.uSeed, opts.seed || 3.7);
    gl.uniform1f(U.uAspect, W / H); gl.uniform1f(U.uAspA, recA.w / recA.h); gl.uniform1f(U.uAspB, recB.w / recB.h);
    gl.uniform1f(U.uDirX, opts.dir ? opts.dir[0] : 1); gl.uniform1f(U.uDirY, opts.dir ? opts.dir[1] : 0); gl.uniform1f(U.uInv, opts.inverse ? 1 : 0);
    gl.uniform1i(U.uFx, fx);
    const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    gl.uniformMatrix3fv(U.uMA, false, new Float32Array(opts.from.matrix ? opts.from.matrix() || I : inverseMatrix(elA, stage.clientWidth, stage.clientHeight)));
    gl.uniformMatrix3fv(U.uMB, false, new Float32Array(opts.to.matrix ? opts.to.matrix() || I : inverseMatrix(elB, stage.clientWidth, stage.clientHeight)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas.toDataURL('image/jpeg', 0.85);
  };
  GLX.effects = Object.keys(EFFECTS);
  window.GLX = GLX;
})();
