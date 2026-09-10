#!/usr/bin/env node
/* =====================================================================
   HUMANITY — tools/serve.js
   Zero-dependency static dev server (Node ≥ 18). Why not `python -m
   http.server`? Because the film's bundled soundtrack and clips need
   HTTP Range requests to seek (Python's SimpleHTTP has none — the audio
   element reports seekable [0,0] and `?t=` can't jump), and the WebGL
   cut layer needs CORS headers on images to sample them.

     node tools/serve.js              # http://localhost:8080
     node tools/serve.js 3000         # another port
     node tools/serve.js --host       # bind 0.0.0.0 (phone on the LAN)
     npm run dev                      # same thing

   Serves the repo root, correct MIME types, Range/206, ETag + no-cache
   for html/js/css (so edits show up on reload), long cache for media.
   ===================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const PORT = parseInt(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || '8080', 10);
const HOST = args.includes('--host') || process.env.HOST ? '0.0.0.0' : '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.map': 'application/json', '.wasm': 'application/wasm'
};
const MEDIA = new Set(['.mp4', '.webm', '.m4a', '.mp3', '.wav', '.ogg', '.opus', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.woff', '.woff2']);

function send(res, status, headers, body) { res.writeHead(status, headers); res.end(body); }

const server = http.createServer((req, res) => {
  const started = process.hrtime.bigint();
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return send(res, 400, {}, 'bad url'); }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, {}, 'forbidden');

  fs.stat(file, (err, st) => {
    const log = (code, extra = '', quiet = false) => { const ms = Number(process.hrtime.bigint() - started) / 1e6; console.log(`${code >= 400 && !quiet ? '\x1b[31m' : code === 304 || code === 206 || quiet ? '\x1b[2m' : ''}${code}\x1b[0m ${req.method} ${urlPath}${extra} \x1b[2m${ms.toFixed(1)}ms\x1b[0m`); };
    if (err || !st.isFile()) {
      // no SPA fallback on purpose: this is a static site; a 404 should look like one
      const expected = urlPath === '/media/manifest.json'; // film.js probes this to decide streaming vs local media
      log(404, expected ? '  (no bundled media yet — the film streams; this is fine)' : '', expected);
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, `404 — ${urlPath} not found`);
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'ETag': etag,
      'Last-Modified': st.mtime.toUTCString(),
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': MEDIA.has(ext) ? 'public, max-age=86400' : 'no-cache'
    };
    if (req.headers['if-none-match'] === etag) { log(304); return send(res, 304, headers); }

    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) { log(416); return send(res, 416, { 'Content-Range': `bytes */${st.size}` }); }
      let start = m[1] === '' ? Math.max(0, st.size - parseInt(m[2], 10)) : parseInt(m[1], 10);
      let end = m[1] !== '' && m[2] !== '' ? parseInt(m[2], 10) : st.size - 1;
      end = Math.min(end, st.size - 1);
      if (start > end || start >= st.size) { log(416); return send(res, 416, { 'Content-Range': `bytes */${st.size}` }); }
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`; headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers); log(206, ` [${start}-${end}]`);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers); log(200);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', (e) => { if (e.code === 'EADDRINUSE') { console.error(`✗ port ${PORT} is in use — try: node tools/serve.js ${PORT + 1}`); process.exit(1); } throw e; });
server.listen(PORT, HOST, () => {
  const lan = HOST === '0.0.0.0' ? Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}/`) : [];
  const hasMedia = fs.existsSync(path.join(ROOT, 'media', 'manifest.json'));
  console.log(`\n  HUMANITY dev server\n  → http://localhost:${PORT}/${lan.map((u) => `\n  → ${u}  (LAN)`).join('')}\n  media: ${hasMedia ? 'bundled (media/manifest.json found)' : 'streaming (run  node tools/fetch-media.js  to bundle)'}\n  film shortcuts: ?t=60  ?debug=1  ?nofilm=1  ?gl=0  ?speed=3\n`);
});
