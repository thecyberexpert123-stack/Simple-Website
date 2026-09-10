#!/usr/bin/env node
/* =====================================================================
   HUMANITY — tools/check.js
   Static checks that run in plain Node (no browser, no deps). Catches
   the classes of bug that bit this project before they reach a commit:

     · every JS file parses
     · the screenplay adds up: shots × beats == chapter lengths, every
       still/clip referenced exists, no duplicate keys, no empty shot
     · every transition name has CSS (or a shader mapping) behind it
     · image URLs: no doubled ".png.png", thumb ≤ original width
     · index.html loads every js/ and css/ file that exists and in a
       sensible order (vendor → data → app → motion → film)
     · media/manifest.json (if present) points at files that exist
     · vendor licence file lists every vendored bundle

     node tools/check.js            # exit 1 on any failure
     npm test                       # same
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const rel = (p) => path.relative(ROOT, p);
let fails = 0, warns = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => { fails++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const warn = (m) => { warns++; console.log(`  \x1b[33m!\x1b[0m ${m}`); };
const section = (t) => console.log(`\n${t}`);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ---------- 1. parse ---------- */
section('JavaScript parses');
const jsFiles = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) { if (!/node_modules|\.git|media/.test(f)) walk(p); } else if (/\.js$/.test(f)) jsFiles.push(p); } })(ROOT);
for (const f of jsFiles) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: rel(f) }); } catch (e) { fail(`${rel(f)}: ${e.message}`); continue; }
}
ok(`${jsFiles.length} files parse`);

/* ---------- 2. screenplay ---------- */
section('Screenplay (js/film-script.js)');
const win = {}; vm.runInNewContext(read('js/film-script.js'), { window: win });
const S = win.FILM_SCRIPT;
if (!S) fail('window.FILM_SCRIPT not defined'); else {
  const imgKeys = Object.keys(S.IMAGES), clipKeys = Object.keys(S.CLIPS);
  ok(`${imgKeys.length} stills, ${clipKeys.length} clips, ${S.CHAPTERS.length} chapters`);
  // duplicate files
  const seen = new Map(); for (const k of imgKeys) { const f = S.IMAGES[k].file; if (seen.has(f)) warn(`stills ${seen.get(f)} and ${k} use the same file ${f}`); seen.set(f, k); }
  // shots
  let total = 0, shots = 0; const used = new Set(), usedClips = new Set(); const transitions = new Map();
  S.CHAPTERS.forEach((ch, ci) => {
    let sum = 0;
    ch.shots.forEach((sh, si) => {
      const [media, beats, tr] = sh; shots++;
      if (!(beats > 0)) fail(`chapter ${ch.id} shot ${si}: beats must be > 0 (got ${beats})`);
      if (typeof media === 'string') { if (!S.IMAGES[media]) fail(`chapter ${ch.id} shot ${si}: unknown still "${media}"`); used.add(media); }
      else if (media && media.file) { const ck = clipKeys.find((k) => S.CLIPS[k] === media); if (!ck) fail(`chapter ${ch.id} shot ${si}: clip object not in CLIPS`); else usedClips.add(ck); if (!S.IMAGES[media.fallback]) fail(`clip ${ck}: fallback still "${media.fallback}" missing`); else used.add(media.fallback); }
      else if (!(media && media.mode)) fail(`chapter ${ch.id} shot ${si}: unrecognised media`);
      transitions.set(tr, (transitions.get(tr) || 0) + 1);
      sum += beats;
    });
    if (ch.len != null && Math.abs(sum - ch.len) > 1e-9) fail(`chapter ${ch.id}: shots add up to ${sum} beats but len is ${ch.len}`);
    total += sum;
  });
  ok(`${shots} shots · ${total} beats · ${(total * 60 / S.TIMING.bpm).toFixed(1)} s at ${S.TIMING.bpm} BPM`);
  ['milky', 'pillars', 'aldrin', 'earthrise'].forEach((k) => used.add(k)); // gate backdrop
  const unused = imgKeys.filter((k) => !used.has(k)); if (unused.length) warn(`unused stills: ${unused.join(', ')}`);
  const unusedC = clipKeys.filter((k) => !usedClips.has(k)); if (unusedC.length) warn(`unused clips: ${unusedC.join(', ')}`);
  let badClip = 0;
  for (const k of clipKeys) {
    const c = S.CLIPS[k];
    if (!c.file || !/^[0-9a-f]{2}$/.test(c.h || '') || !Array.isArray(c.q) || !c.q.length || !c.title || !c.license) { fail(`clip ${k}: needs file, h (md5 prefix), q[], title, license`); badClip++; continue; }
    if (!(c.len > 0) || c.start < 0) { fail(`clip ${k}: bad start/len`); badClip++; }
    const hi = S.clipUrl(c, 1080), lo = S.clipUrl(c, 480);
    if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(hi) || !/\.(webm|ogv|mov|mp4)$/.test(hi)) { fail(`clip ${k}: odd URL ${hi}`); badClip++; }
    if (/\.(\d+)p\.vp9\.webm$/.test(lo) && +RegExp.$1 > 480) { fail(`clip ${k}: 480p request resolved to ${RegExp.$1}p`); badClip++; }
  }
  if (!badClip) ok(`${clipKeys.length} clips are native Commons files (no third-party player)`);
  // URLs
  let urlBad = 0;
  for (const k of imgKeys) { const d = S.IMAGES[k]; for (const w of [1280, 1920, 2560, 3840]) { const u = S.urlFor(d, w); if (/\.png\.png|\.jpe?g\.jpe?g/i.test(u)) { fail(`${k}: doubled extension in ${u}`); urlBad++; } if (w < d.w && !/\/thumb\//.test(u)) { fail(`${k}: width ${w} < original ${d.w} but URL is not a thumb`); urlBad++; } if (w >= d.w && /\/thumb\//.test(u)) { fail(`${k}: width ${w} ≥ original ${d.w} but URL is a thumb (upscaling)`); urlBad++; } } }
  if (!urlBad) ok('rendition URLs well-formed, never upscaled');
  // transitions vs CSS / shader map
  const css = read('css/film.css'); const filmJs = read('js/film.js');
  const glMap = /const GL_MAP = \{([\s\S]*?)\n  \};/.exec(filmJs); const glNames = glMap ? [...glMap[1].matchAll(/(\w+): \['/g)].map((m) => m[1]) : [];
  const fxNames = [...filmJs.matchAll(/^\s{4}(\w+): \(\) =>/gm)].map((m) => m[1]);
  let trBad = 0;
  for (const [tr, n] of transitions) { const hasCss = css.includes(`.tr-${tr}`); const hasFx = fxNames.includes(tr); const hasGl = glNames.includes(tr); if (!hasCss && !hasFx) { fail(`transition "${tr}" (${n}×) has no CSS rule and no stage FX`); trBad++; } }
  if (!trBad) ok(`${transitions.size} transition names all backed by CSS/FX · ${glNames.length} have GPU shaders`);
  console.log('    ' + [...transitions].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join('  '));
}

/* ---------- 3. index.html wiring ---------- */
section('index.html');
const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const links = [...html.matchAll(/<link[^>]+href="(css\/[^"]+)"/g)].map((m) => m[1]);
for (const s of scripts) if (!exists(s)) fail(`script ${s} referenced but missing`);
for (const c of links) if (!exists(c)) fail(`stylesheet ${c} referenced but missing`);
const order = ['js/vendor/gsap.min.js', 'js/data.js', 'js/film-script.js', 'js/app.js', 'js/motion.js', 'js/glx.js', 'js/film.js'];
const idx = order.map((f) => scripts.indexOf(f));
if (idx.some((i) => i < 0)) fail(`expected scripts missing from index.html: ${order.filter((f, i) => idx[i] < 0).join(', ')}`);
else if (idx.some((v, i) => i && v < idx[i - 1])) fail(`script order should be ${order.join(' → ')}`);
else ok(`${scripts.length} scripts, ${links.length} stylesheets, correct order`);
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))) if (!scripts.includes('js/' + f)) warn(`js/${f} exists but index.html does not load it`);
for (const id of ['film', 'stage', 'slots', 'fgate', 'fgate-src', 'hero-title', 'nav', 'cards', 'modal']) if (!new RegExp(`id="${id}"`).test(html)) fail(`#${id} missing from index.html`);
if (/youtube(-nocookie)?\.com\/(embed|iframe_api)/.test(html + fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js/film.js'), 'utf8'))) fail('a YouTube player embed is still referenced'); else ok('no third-party video player (all clips are native <video>)');

/* ---------- 4. media manifest ---------- */
section('media/');
if (exists('media/manifest.json')) {
  const m = JSON.parse(read('media/manifest.json')); let n = 0, bad = 0;
  const chk = (f, what) => { n++; if (!exists(f)) { fail(`${what}: ${f} listed in manifest but missing`); bad++; } };
  if (m.audio) chk(m.audio.file, 'audio');
  for (const [k, v] of Object.entries(m.clips || {})) { chk(v.file, `clip ${k}`); if (v.poster) chk(v.poster, `poster ${k}`); if (S && !S.CLIPS[k]) warn(`manifest clip "${k}" is not in the screenplay`); }
  for (const [k, v] of Object.entries(m.stills || {})) { chk(v.file, `still ${k}`); if (S && !S.IMAGES[k]) warn(`manifest still "${k}" is not in the screenplay`); }
  if (!bad) ok(`manifest: audio ${m.audio ? 'yes' : 'no'} · ${Object.keys(m.clips || {}).length} clips · ${Object.keys(m.stills || {}).length} stills · ${n} files present`);
  const size = (d) => { let t = 0; if (!fs.existsSync(d)) return 0; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); t += st.isDirectory() ? size(p) : st.size; } return t; };
  const mb = size(path.join(ROOT, 'media')) / 1048576; (mb > 900 ? warn : ok)(`media/ is ${mb.toFixed(1)} MB${mb > 900 ? ' — GitHub recommends repos under 1 GB' : ''}`);
  for (const f of fs.readdirSync(path.join(ROOT, 'media')).flatMap((d) => { const p = path.join(ROOT, 'media', d); return fs.statSync(p).isDirectory() ? fs.readdirSync(p).map((x) => path.join(p, x)) : [p]; })) if (fs.statSync(f).size > 100 * 1048576) fail(`${rel(f)} is over GitHub's 100 MB file limit`);
} else ok('no manifest — film streams (run python tools/fetch_media.py to bundle)');

/* ---------- 5. vendor licences ---------- */
section('js/vendor');
if (exists('js/vendor')) {
  const lic = exists('js/vendor/LICENSES.md') ? read('js/vendor/LICENSES.md') : '';
  const bundles = fs.readdirSync(path.join(ROOT, 'js/vendor')).filter((f) => f.endsWith('.js'));
  const missing = bundles.filter((b) => !lic.includes(b)); if (missing.length) fail(`LICENSES.md does not mention: ${missing.join(', ')}`); else ok(`${bundles.length} bundles, all listed in LICENSES.md`);
}

/* ---------- 6. Pages ---------- */
section('GitHub Pages');
if (!exists('.nojekyll')) warn('.nojekyll missing — Jekyll would ignore files/folders starting with "_" (none today, but cheap insurance)');
else ok('.nojekyll present');
if (exists('.github/workflows/pages.yml')) ok('Pages workflow present'); else warn('no Pages workflow (use Settings → Pages → Deploy from branch instead)');

console.log(`\n${fails ? '\x1b[31m' : '\x1b[32m'}${fails} failure${fails === 1 ? '' : 's'}\x1b[0m, ${warns} warning${warns === 1 ? '' : 's'}\n`);
process.exit(fails ? 1 : 0);
