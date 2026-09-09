#!/usr/bin/env node
/* =====================================================================
   HUMANITY — tools/fetch-media.js
   Pulls the film's media into the repo so nothing streams from YouTube
   or Wikimedia at runtime:

     media/audio/soundtrack.m4a        the track (audio only, 160 kbps AAC)
     media/clips/<key>.mp4             trimmed, muted, 1080p H.264 clips
     media/clips/<key>.jpg             first-frame poster for each clip
     media/stills/<key>.jpg|png        stills at up to 3840 px wide
     media/manifest.json               what was fetched (read by film.js)

   Requirements: node ≥ 18, yt-dlp, ffmpeg  (brew install yt-dlp ffmpeg
   or  pip install yt-dlp  +  apt install ffmpeg).

   Usage:
     node tools/fetch-media.js              # everything
     node tools/fetch-media.js --audio      # only the soundtrack
     node tools/fetch-media.js --clips      # only the clips
     node tools/fetch-media.js --stills     # only the stills
     node tools/fetch-media.js --max 2560   # cap still width (default 3840)
     node tools/fetch-media.js --clip apollo --clip webb   # a subset

   The film works without any of this (it falls back to streaming), so
   run it whenever you like and commit the media/ folder — or keep it out
   of Git and host it elsewhere; see README "Local media".
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const only = args.filter((a, i) => args[i - 1] === '--clip');
const MAXW = parseInt(opt('--max', '3840'), 10);
const doAll = !flag('--audio') && !flag('--clips') && !flag('--stills');

/* load the script the same way the browser does */
global.window = {};
require(path.join(ROOT, 'js', 'film-script.js'));
const S = global.window.FILM_SCRIPT;

const manifestPath = path.join(MEDIA, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { audio: null, clips: {}, stills: {} };
const save = () => { fs.mkdirSync(MEDIA, { recursive: true }); manifest.generated = new Date().toISOString(); fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n'); };

function has(bin) { const r = spawnSync(bin, ['--version'], { stdio: 'ignore' }); return r.status === 0; }
function need(bin, hint) { if (!has(bin)) { console.error(`✗ ${bin} not found. ${hint}`); process.exit(1); } }
const log = (m) => console.log(m);

/* ---------- audio ---------- */
function fetchAudio() {
  need('yt-dlp', 'Install: pip install yt-dlp  (or brew install yt-dlp)'); need('ffmpeg', 'Install: apt install ffmpeg  (or brew install ffmpeg)');
  const dir = path.join(MEDIA, 'audio'); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'soundtrack.m4a');
  log(`♪ soundtrack ${S.TIMING.videoId} → ${path.relative(ROOT, out)}`);
  execFileSync('yt-dlp', ['-f', 'bestaudio[ext=m4a]/bestaudio', '--extract-audio', '--audio-format', 'm4a', '--audio-quality', '160K', '-o', out, '--force-overwrites', `https://www.youtube.com/watch?v=${S.TIMING.videoId}`], { stdio: 'inherit' });
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  manifest.audio = { file: 'media/audio/soundtrack.m4a', duration: parseFloat(probe), source: `https://www.youtube.com/watch?v=${S.TIMING.videoId}`, title: S.TIMING.trackTitle, artist: S.TIMING.artist };
  save();
}

/* ---------- clips ---------- */
function fetchClips() {
  need('yt-dlp', 'Install: pip install yt-dlp'); need('ffmpeg', 'Install: apt install ffmpeg');
  const dir = path.join(MEDIA, 'clips'); fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(MEDIA, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  for (const [key, c] of Object.entries(S.CLIPS)) {
    if (only.length && !only.includes(key)) continue;
    if (c.live) { log(`↷ ${key}: live stream, skipped (streams at runtime, still fallback otherwise)`); continue; }
    const out = path.join(dir, `${key}.mp4`); const poster = path.join(dir, `${key}.jpg`);
    log(`▶ ${key} ${c.yt} [${c.start}s +${c.len}s] → ${path.relative(ROOT, out)}`);
    const src = path.join(tmp, `${key}.src.mp4`);
    // best ≤1080p mp4 video, no audio needed — download only the section we use (+2 s slack for keyframes)
    execFileSync('yt-dlp', ['-f', 'bestvideo[height<=1080][ext=mp4]/bestvideo[height<=1080]/best[height<=1080]', '--download-sections', `*${Math.max(0, c.start - 2)}-${c.start + c.len + 2}`, '--force-keyframes-at-cuts', '-o', src, '--force-overwrites', `https://www.youtube.com/watch?v=${c.yt}`], { stdio: 'inherit' });
    // trim exactly, drop audio, re-encode to a lean 1080p H.264 that every browser plays; fast start for instant playback
    const ss = fs.existsSync(src) ? 2 : c.start;
    execFileSync('ffmpeg', ['-y', '-ss', String(ss), '-i', src, '-t', String(c.len), '-an', '-vf', 'scale=-2:min(1080\\,ih)', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
    execFileSync('ffmpeg', ['-y', '-i', out, '-frames:v', '1', '-q:v', '2', poster], { stdio: 'ignore' });
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
    const wh = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', out]).toString().trim();
    manifest.clips[key] = { file: `media/clips/${key}.mp4`, poster: `media/clips/${key}.jpg`, duration: dur, size: wh, source: `https://www.youtube.com/watch?v=${c.yt}&t=${c.start}`, title: c.title };
    save(); fs.rmSync(src, { force: true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ---------- stills ---------- */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'HUMANITY-monument/1.0 (github pages site; media fetch script)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return download(res.headers.location, dest).then(resolve, reject); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const f = fs.createWriteStream(dest); res.pipe(f); f.on('finish', () => f.close(resolve)); f.on('error', reject);
    });
    req.on('error', reject);
  });
}
async function fetchStills() {
  const dir = path.join(MEDIA, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const [key, d] of Object.entries(S.IMAGES)) {
    const ext = /\.png$/i.test(d.file) ? 'png' : 'jpg';
    const out = path.join(dir, `${key}.${ext}`);
    const w = Math.min(MAXW, d.w); const url = S.urlFor(d, w);
    process.stdout.write(`▣ ${key} ${w}px … `);
    try { await download(url, out); const kb = Math.round(fs.statSync(out).size / 1024); log(`${kb} KB`); manifest.stills[key] = { file: `media/stills/${key}.${ext}`, width: w, source: `https://commons.wikimedia.org/wiki/File:${d.file}`, credit: d.credit, license: d.license }; }
    catch (e) { log(`failed (${e.message}) — will stream at runtime`); }
    save();
  }
}

(async () => {
  if (doAll || flag('--audio')) fetchAudio();
  if (doAll || flag('--clips')) fetchClips();
  if (doAll || flag('--stills')) await fetchStills();
  save();
  const size = (dir) => { let n = 0; if (!fs.existsSync(dir)) return 0; for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); n += st.isDirectory() ? size(p) : st.size; } return n; };
  log(`\n✓ media/ is ${(size(MEDIA) / 1048576).toFixed(1)} MB — manifest: ${path.relative(ROOT, manifestPath)}`);
  log('  audio: ' + (manifest.audio ? 'yes' : 'no') + '  clips: ' + Object.keys(manifest.clips).length + '  stills: ' + Object.keys(manifest.stills).length);
})().catch((e) => { console.error(e); process.exit(1); });
