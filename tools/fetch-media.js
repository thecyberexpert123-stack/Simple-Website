#!/usr/bin/env node
/* =====================================================================
   HUMANITY — tools/fetch-media.js
   Pulls the film's media into the repo so nothing streams at runtime:

     media/audio/soundtrack.m4a        the track (audio only, 160 kbps AAC)
     media/clips/<key>.mp4             trimmed, muted, 1080p H.264 clips
     media/clips/<key>.jpg             first-frame poster for each clip
     media/stills/<key>.jpg|png        stills at up to 3840 px wide
     media/manifest.json               what was fetched (read by film.js)

   Requirements: node ≥ 18 and ffmpeg for clips + stills; yt-dlp as well
   for the soundtrack (winget install ffmpeg; pip install yt-dlp).
   Clips come straight from Wikimedia Commons (public domain / CC), so
   only the soundtrack still needs yt-dlp.

   Usage:
     node tools/fetch-media.js              # everything
     node tools/fetch-media.js --audio      # only the soundtrack
     node tools/fetch-media.js --clips      # only the clips
     node tools/fetch-media.js --stills     # only the stills
     node tools/fetch-media.js --max 2560   # cap still width (default 3840)
     node tools/fetch-media.js --clip apollo --clip webb   # a subset
     node tools/fetch-media.js --check      # just show which tools were found
     node tools/fetch-media.js --ffmpeg /path/to/ffmpeg --yt-dlp /path/to/yt-dlp   # explicit paths

   The film works without any of this (clips stream from Commons; the
   soundtrack falls back to the ambient score if the file is missing), so
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

const log = (m) => console.log(m);

/* ---------- locating yt-dlp / ffmpeg / ffprobe ----------
   ffmpeg only understands `-version` (single dash) — `--version` exits non-zero, which is why an earlier
   revision of this script claimed ffmpeg was missing when it was installed. We now: (1) honour explicit
   overrides FFMPEG / FFPROBE / YTDLP env vars or --ffmpeg / --yt-dlp flags, (2) look on PATH (with .exe on
   Windows), (3) try the usual install folders, (4) fall back to `python -m yt_dlp` / the ffmpeg bundled with
   imageio-ffmpeg or static-ffmpeg, if present. */
const IS_WIN = process.platform === 'win32';
const HOME = process.env.HOME || process.env.USERPROFILE || '';
function runs(cmd, argv) {
  try { const r = spawnSync(cmd, argv, { stdio: 'ignore', shell: false, windowsHide: true }); return r.status === 0; } catch (e) { return false; }
}
function firstWorking(candidates, testArgs) {
  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) { if (runs(c[0], [...c.slice(1), ...testArgs])) return c; continue; }
    if (c.includes(path.sep) && !fs.existsSync(c)) continue;
    if (runs(c, testArgs)) return [c];
  }
  return null;
}
function commonDirs(bin) {
  const b = IS_WIN ? bin + '.exe' : bin;
  return [
    '/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', '/opt/local/bin', '/snap/bin', path.join(HOME, '.local', 'bin'), path.join(HOME, 'bin'),
    'C:\\ffmpeg\\bin', 'C:\\Program Files\\ffmpeg\\bin', 'C:\\ProgramData\\chocolatey\\bin', path.join(HOME, 'scoop', 'shims'), path.join(HOME, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links'),
  ].map((d) => path.join(d, b));
}
function pipBinary(pkgDir, prefix) {
  // e.g. ffmpeg shipped inside the imageio-ffmpeg wheel: site-packages/imageio_ffmpeg/binaries/ffmpeg-*
  try {
    const py = IS_WIN ? 'python' : 'python3';
    const r = spawnSync(py, ['-c', `import ${pkgDir},os;print(os.path.dirname(${pkgDir}.__file__))`], { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) return null;
    const dir = path.join(r.stdout.trim(), 'binaries');
    const f = fs.readdirSync(dir).find((n) => n.startsWith(prefix));
    return f ? path.join(dir, f) : null;
  } catch (e) { return null; }
}
const BIN = {};
function resolveBin(name) {
  if (BIN[name]) return BIN[name];
  let found = null;
  if (name === 'ffmpeg' || name === 'ffprobe') {
    const override = opt('--' + name, process.env[name.toUpperCase()]);
    found = firstWorking([override, name, ...commonDirs(name), name === 'ffmpeg' ? pipBinary('imageio_ffmpeg', 'ffmpeg-') : null, path.join(HOME, '.static_ffmpeg', IS_WIN ? name + '.exe' : name)], ['-version']);
    if (!found && name === 'ffprobe') { // static builds sometimes ship only ffmpeg; ffprobe is optional for us
      found = null;
    }
  } else if (name === 'yt-dlp') {
    const override = opt('--yt-dlp', process.env.YTDLP);
    found = firstWorking([override, 'yt-dlp', ...commonDirs('yt-dlp'), [IS_WIN ? 'python' : 'python3', '-m', 'yt_dlp'], ['python', '-m', 'yt_dlp'], ['py', '-m', 'yt_dlp']], ['--version']);
  }
  BIN[name] = found;
  return found;
}
function need(name, hint) {
  const b = resolveBin(name);
  if (!b) {
    console.error(`✗ ${name} not found. ${hint}`);
    console.error(`  If it IS installed: open a NEW terminal (PATH is read at start), or pass its full path, e.g.`);
    console.error(IS_WIN ? `    node tools/fetch-media.js --ffmpeg "C:\\ffmpeg\\bin\\ffmpeg.exe" --yt-dlp "C:\\path\\to\\yt-dlp.exe"` : `    node tools/fetch-media.js --ffmpeg /path/to/ffmpeg --yt-dlp /path/to/yt-dlp`);
    console.error(`  (env vars FFMPEG / FFPROBE / YTDLP work too; yt-dlp may also be used as "python -m yt_dlp").`);
    process.exit(1);
  }
  return b;
}
/* run a resolved tool; `name` is ffmpeg | ffprobe | yt-dlp */
function tool(name, argv, opts = {}) {
  const b = resolveBin(name);
  if (!b) throw new Error(`${name} not available`);
  return execFileSync(b[0], [...b.slice(1), ...argv], { windowsHide: true, ...opts });
}
/* ffprobe is optional: fall back to parsing `ffmpeg -i` output */
function probeDuration(file) {
  if (resolveBin('ffprobe')) return parseFloat(tool('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
  const r = spawnSync(resolveBin('ffmpeg')[0], [...resolveBin('ffmpeg').slice(1), '-i', file], { encoding: 'utf8', windowsHide: true });
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(r.stderr || ''); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : NaN;
}
function probeSize(file) {
  if (resolveBin('ffprobe')) return tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file]).toString().trim();
  const r = spawnSync(resolveBin('ffmpeg')[0], [...resolveBin('ffmpeg').slice(1), '-i', file], { encoding: 'utf8', windowsHide: true });
  const m = /Video:.*?\s(\d{2,5})x(\d{2,5})/.exec(r.stderr || ''); return m ? `${m[1]}x${m[2]}` : '';
}
/* where yt-dlp should look for ffmpeg (it needs it for merging / audio extraction) */
function ffLoc() {
  const f = resolveBin('ffmpeg')[0];
  if (!f.includes(path.sep)) return f; // plain command name on PATH
  const base = path.basename(f).toLowerCase();
  if (base === 'ffmpeg' || base === 'ffmpeg.exe') return path.dirname(f);
  // oddly named binary (e.g. imageio's ffmpeg-linux-x86_64-v7.0.2): expose it under the name yt-dlp expects
  const dir = path.join(MEDIA, '.tmp', 'ffbin'); fs.mkdirSync(dir, { recursive: true });
  const link = path.join(dir, IS_WIN ? 'ffmpeg.exe' : 'ffmpeg');
  if (!fs.existsSync(link)) { try { fs.symlinkSync(f, link); } catch (e) { fs.copyFileSync(f, link); } }
  return dir;
}
function report() {
  for (const n of ['yt-dlp', 'ffmpeg', 'ffprobe']) { const b = resolveBin(n); log(`  ${b ? '✓' : '·'} ${n.padEnd(8)} ${b ? b.join(' ') : (n === 'ffprobe' ? 'not found (optional)' : 'not found')}`); }
}

/* ---------- audio ---------- */
function fetchAudio() {
  need('yt-dlp', 'Install: pip install yt-dlp  (or brew install yt-dlp)'); need('ffmpeg', 'Install: apt install ffmpeg  (or brew install ffmpeg / winget install ffmpeg)');
  const dir = path.join(MEDIA, 'audio'); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'soundtrack.m4a');
  log(`♪ soundtrack ${S.TIMING.videoId} → ${path.relative(ROOT, out)}`);
  tool('yt-dlp', ['-f', 'bestaudio[ext=m4a]/bestaudio', '--extract-audio', '--audio-format', 'm4a', '--audio-quality', '160K', '--ffmpeg-location', ffLoc(), '-o', out, '--force-overwrites', `https://www.youtube.com/watch?v=${S.TIMING.videoId}`], { stdio: 'inherit' });
  manifest.audio = { file: 'media/audio/soundtrack.m4a', duration: probeDuration(out), source: `https://www.youtube.com/watch?v=${S.TIMING.videoId}`, title: S.TIMING.trackTitle, artist: S.TIMING.artist };
  save();
}

/* ---------- clips ----------
   Each clip is a public-domain / CC file on Wikimedia Commons (see CLIPS in js/film-script.js). We download
   the best transcode ≤1080p straight from upload.wikimedia.org — no yt-dlp involved — then trim the window
   the film uses and re-encode it to a lean H.264 .mp4 that every browser (including Safari) plays instantly. */
async function fetchClips() {
  need('ffmpeg', 'Install: winget install ffmpeg  (or brew install ffmpeg / apt install ffmpeg)');
  const dir = path.join(MEDIA, 'clips'); fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(MEDIA, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  for (const [key, c] of Object.entries(S.CLIPS)) {
    if (only.length && !only.includes(key)) continue;
    const out = path.join(dir, `${key}.mp4`); const poster = path.join(dir, `${key}.jpg`);
    const url = S.clipUrl(c, 1080);
    log(`▶ ${key} [${c.start}s +${c.len}s] ← ${decodeURIComponent(url.split('/').pop())}`);
    const src = path.join(tmp, `${key}.src${path.extname(url.split('?')[0]) || '.webm'}`);
    try { await download(url, src); } catch (e) { log(`  ✗ download failed (${e.message}) — the film will stream this clip instead`); continue; }
    // trim exactly, drop audio, re-encode to ≤1080p H.264; fast start so the first frame is instant
    tool('ffmpeg', ['-y', '-ss', String(c.start), '-i', src, '-t', String(c.len), '-an', '-vf', 'scale=-2:min(1080\\,ih)', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
    tool('ffmpeg', ['-y', '-i', out, '-frames:v', '1', '-q:v', '2', poster], { stdio: 'ignore' });
    const dur = probeDuration(out);
    const wh = probeSize(out);
    manifest.clips[key] = { file: `media/clips/${key}.mp4`, poster: `media/clips/${key}.jpg`, duration: dur, size: wh, source: `https://commons.wikimedia.org/wiki/File:${c.file}`, start: c.start, title: c.title, license: c.license };
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
  log('tools:'); report();
  if (flag('--check')) return;
  if (doAll || flag('--audio')) fetchAudio();
  if (doAll || flag('--clips')) await fetchClips();
  if (doAll || flag('--stills')) await fetchStills();
  save();
  const size = (dir) => { let n = 0; if (!fs.existsSync(dir)) return 0; for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); n += st.isDirectory() ? size(p) : st.size; } return n; };
  log(`\n✓ media/ is ${(size(MEDIA) / 1048576).toFixed(1)} MB — manifest: ${path.relative(ROOT, manifestPath)}`);
  log('  audio: ' + (manifest.audio ? 'yes' : 'no') + '  clips: ' + Object.keys(manifest.clips).length + '  stills: ' + Object.keys(manifest.stills).length);
})().catch((e) => {
  const msg = e && e.status !== undefined ? `command failed (exit ${e.status}): ${e.message.split('\n')[0]}` : (e && e.message) || String(e);
  console.error(`\n✗ ${msg}`);
  if (/yt-dlp|yt_dlp/.test(msg)) console.error('  yt-dlp could not download. Usual fixes: `pip install -U yt-dlp` (YouTube changes often), check your network/VPN, or retry.');
  console.error('  Progress so far is saved in media/manifest.json — rerun to continue; the film streams anything missing.');
  process.exit(1);
});
