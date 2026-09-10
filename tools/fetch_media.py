#!/usr/bin/env python3
"""
HUMANITY — tools/fetch_media.py

Fetches every piece of media the opening film needs and bundles it inside
the repo, so the site never touches YouTube (or anything else) at runtime:

    media/audio/soundtrack.m4a      the track (audio only, 192 kbps AAC)
    media/clips/<key>.mp4           each clip, cut to the exact window the
                                    film uses, highest quality available
                                    (≤ 1080p H.264, muted, fast-start)
    media/clips/<key>.jpg           first-frame poster for each clip
    media/stills/<key>.jpg|png      every still, up to 3840 px wide
    media/manifest.json             what was fetched (read by js/film.js)

Everything is driven by js/film-script.js — the same file the browser
reads — so the script never goes out of sync with the film. Clips come
straight from Wikimedia Commons (public domain / Creative Commons video
files, best transcode ≤ 1080p, or the original when it is 1080p or less);
the soundtrack comes from the YouTube link in TIMING.videoId via yt-dlp.

Requirements
    Python 3.9+
    ffmpeg  (Windows: winget install Gyan.FFmpeg   macOS: brew install ffmpeg
             Linux: sudo apt install ffmpeg)  — or pass --ffmpeg PATH, or
             pip install imageio-ffmpeg and the script finds it on its own
    yt-dlp  (pip install yt-dlp)  — soundtrack only

Usage
    python tools/fetch_media.py                 # everything
    python tools/fetch_media.py --audio         # soundtrack only
    python tools/fetch_media.py --clips         # clips only
    python tools/fetch_media.py --stills        # stills only
    python tools/fetch_media.py --clip apollo --clip webb
    python tools/fetch_media.py --max 2560      # cap still width (default 3840)
    python tools/fetch_media.py --quality 720   # cap clip height (default 1080)
    python tools/fetch_media.py --check         # show which tools were found
    python tools/fetch_media.py --verify        # re-check every manifest entry
    python tools/fetch_media.py --force         # redo items already present

Windows/PowerShell users: `py tools\fetch_media.py` works too.

The site works without any of this (clips and stills stream from Commons,
the film plays its ambient score if the soundtrack is missing), so run it
whenever you like, then `git add media && git commit`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media"
MANIFEST = MEDIA / "manifest.json"
SCRIPT_JS = ROOT / "js" / "film-script.js"
UA = "HUMANITY-monument/2.0 (static GitHub Pages site; media bundling script; contact via repository)"
COMMONS = "https://upload.wikimedia.org/wikipedia/commons"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

IS_WIN = os.name == "nt"


# ---------------------------------------------------------------------------
# small console helpers
# ---------------------------------------------------------------------------
def _c(code: str, s: str) -> str:
    if not sys.stdout.isatty() or os.environ.get("NO_COLOR"):
        return s
    return f"\033[{code}m{s}\033[0m"


ok = lambda s: print("  " + _c("32", "✓") + " " + s)  # noqa: E731
warn = lambda s: print("  " + _c("33", "!") + " " + s)  # noqa: E731
fail = lambda s: print("  " + _c("31", "✗") + " " + s)  # noqa: E731
info = lambda s: print("  " + _c("2", "·") + " " + s)  # noqa: E731


def human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


# ---------------------------------------------------------------------------
# read the screenplay exactly as the browser does (no Node required)
# ---------------------------------------------------------------------------
def load_script() -> dict:
    """Evaluate js/film-script.js. Prefers Node (exact); falls back to a small
    regex reader for TIMING / IMAGES / CLIPS when Node is absent."""
    node = shutil.which("node")
    if node:
        js = (
            "global.window={};require(process.argv[1]);const S=window.FILM_SCRIPT;"
            "process.stdout.write(JSON.stringify({TIMING:S.TIMING,IMAGES:S.IMAGES,CLIPS:S.CLIPS}))"
        )
        try:
            out = subprocess.run([node, "-e", js, str(SCRIPT_JS)], capture_output=True, text=True, check=True).stdout
            return json.loads(out)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:  # pragma: no cover
            warn(f"node could not evaluate film-script.js ({e}); using the built-in parser")
    return parse_script_without_node()


def parse_script_without_node() -> dict:
    src = SCRIPT_JS.read_text(encoding="utf-8")

    def block(name: str) -> str:
        m = re.search(r"const %s = \{(.*?)\n  \};" % name, src, re.S)
        if not m:
            raise SystemExit(f"could not find {name} in {SCRIPT_JS}")
        return m.group(1)

    def entries(text: str) -> dict:
        out: dict[str, dict] = {}
        for m in re.finditer(r"^\s{4}(\w+): \{(.*)\},?\s*$", text, re.M):
            key, body = m.group(1), m.group(2)
            d: dict = {}
            for km in re.finditer(r"(\w+): (\"[^\"]*\"|'(?:[^'\\]|\\.)*'|\[[^\]]*\]|[-\d.]+)", body):
                k, v = km.group(1), km.group(2)
                if v.startswith(("'", '"')):
                    d[k] = v[1:-1].replace("\\'", "'")
                elif v.startswith("["):
                    d[k] = [float(x) if "." in x else int(x) for x in re.findall(r"[-\d.]+", v)]
                else:
                    d[k] = float(v) if "." in v else int(v)
            out[key] = d
        return out

    timing: dict = {}
    for km in re.finditer(r"(\w+): ('[^']*'|[-\d.]+)", block("TIMING")):
        k, v = km.group(1), km.group(2)
        timing[k] = v[1:-1] if v.startswith("'") else (float(v) if "." in v else int(v))
    return {"TIMING": timing, "IMAGES": entries(block("IMAGES")), "CLIPS": entries(block("CLIPS"))}


# ---------------------------------------------------------------------------
# Commons URL builders — mirror urlFor / clipUrl in js/film-script.js
# ---------------------------------------------------------------------------
def commons_name(file: str) -> str:
    """Percent-encode a Commons file name the way upload.wikimedia.org expects."""
    name = file.replace(" ", "_")
    return urllib.parse.quote(name, safe="(),'!*")


def md5_prefix(file: str) -> str:
    return hashlib.md5(file.replace(" ", "_").encode("utf-8")).hexdigest()[:2]


def still_url(d: dict, width: int) -> str:
    f = commons_name(d["file"])
    h = d["h"]
    if md5_prefix(d["file"]) != h:
        warn(f"hash mismatch for {d['file']}: script says {h}, md5 says {md5_prefix(d['file'])} — using md5")
        h = md5_prefix(d["file"])
    base = f"{COMMONS}/{h[0]}/{h}/{f}"
    if not width or width >= d["w"]:
        return base
    return f"{COMMONS}/thumb/{h[0]}/{h}/{f}/{width}px-{f}"


def clip_candidates(c: dict, max_h: int) -> list[tuple[str, str]]:
    """Ordered (label, url) list from best to worst quality within max_h."""
    f = commons_name(c["file"])
    h = c["h"]
    base = f"{COMMONS}/{h[0]}/{h}/{f}"
    heights = sorted({int(q) for q in c.get("q", []) if int(q) > 0}, reverse=True)
    out: list[tuple[str, str]] = []
    src_h = int(c.get("hgt", 0) or 0)
    # the original is best whenever it isn't taller than the cap
    if 0 in [int(q) for q in c.get("q", [])] and (not src_h or src_h <= max_h):
        out.append((f"original {src_h or '?'}p", base))
    for hh in heights:
        if hh <= max_h:
            out.append((f"{hh}p", f"{COMMONS}/transcoded/{h[0]}/{h}/{f}/{f}.{hh}p.vp9.webm"))
    if not out:  # nothing under the cap — take the smallest thing that exists
        smallest = heights[-1] if heights else None
        out.append((f"{smallest}p" if smallest else "original", f"{COMMONS}/transcoded/{h[0]}/{h}/{f}/{f}.{smallest}p.vp9.webm" if smallest else base))
    return out


def commons_page(file: str) -> str:
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(file.replace(" ", "_"))


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
def http_head(url: str) -> tuple[int, int]:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, int(r.headers.get("Content-Length") or 0)
    except urllib.error.HTTPError as e:
        return e.code, 0
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, 0


def download(url: str, dest: Path, label: str = "", retries: int = 3) -> int:
    """Stream url → dest with a progress line and resume support. Returns bytes."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, retries + 1):
        have = part.stat().st_size if part.exists() else 0
        headers = {"User-Agent": UA}
        if have:
            headers["Range"] = f"bytes={have}-"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                if have and r.status != 206:  # server ignored the range → start over
                    have = 0
                total = int(r.headers.get("Content-Length") or 0) + have
                mode = "ab" if have else "wb"
                got = have
                t0 = time.time()
                with open(part, mode) as f:
                    while True:
                        chunk = r.read(1 << 18)
                        if not chunk:
                            break
                        f.write(chunk)
                        got += len(chunk)
                        if sys.stdout.isatty() and total:
                            pct = got * 100 // total
                            spd = got / max(1e-6, time.time() - t0)
                            sys.stdout.write(f"\r    {label:<34} {pct:3d}%  {human(got):>9} / {human(total)}  {human(spd)}/s   ")
                            sys.stdout.flush()
                if sys.stdout.isatty():
                    sys.stdout.write("\r" + " " * 100 + "\r")
                part.replace(dest)
                return got
        except urllib.error.HTTPError as e:
            if e.code in (404, 403, 410):
                raise
            warn(f"HTTP {e.code} on attempt {attempt}/{retries}")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            warn(f"network error on attempt {attempt}/{retries}: {e}")
        time.sleep(1.5 * attempt)
    raise RuntimeError(f"could not download {url}")


def commons_meta(file: str) -> dict | None:
    """Live licence / size lookup, used by --verify and for the manifest credit line."""
    q = urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo",
        "iiprop": "size|extmetadata", "iiextmetadatafilter": "LicenseShortName|Artist|Credit",
        "titles": "File:" + file,
    })
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{COMMONS_API}?{q}", headers={"User-Agent": UA}), timeout=30) as r:
            page = json.load(r)["query"]["pages"][0]
        if page.get("missing"):
            return None
        ii = page["imageinfo"][0]
        em = ii.get("extmetadata", {})
        strip = lambda s: re.sub(r"<[^>]+>", "", s or "").strip()  # noqa: E731
        return {"width": ii.get("width"), "height": ii.get("height"), "license": strip(em.get("LicenseShortName", {}).get("value")), "artist": strip(em.get("Artist", {}).get("value"))}
    except Exception:  # network optional
        return None


# ---------------------------------------------------------------------------
# tools: ffmpeg / ffprobe / yt-dlp
# ---------------------------------------------------------------------------
class Tools:
    def __init__(self, ffmpeg: str | None, ytdlp: str | None):
        self.ffmpeg = self._find_ffmpeg(ffmpeg)
        self.ffprobe = self._sibling(self.ffmpeg, "ffprobe") or shutil.which("ffprobe")
        self.ytdlp = self._find_ytdlp(ytdlp)

    @staticmethod
    def _sibling(exe: str | None, name: str) -> str | None:
        if not exe:
            return None
        p = Path(exe).with_name(name + (".exe" if IS_WIN else ""))
        return str(p) if p.exists() else None

    @staticmethod
    def _works(cmd: list[str]) -> bool:
        try:
            return subprocess.run(cmd, capture_output=True, timeout=20).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False

    def _find_ffmpeg(self, explicit: str | None) -> str | None:
        cands: list[str] = []
        if explicit:
            cands.append(explicit)
        if os.environ.get("FFMPEG"):
            cands.append(os.environ["FFMPEG"])
        w = shutil.which("ffmpeg")
        if w:
            cands.append(w)
        if IS_WIN:  # winget (Gyan.FFmpeg) installs here and only patches PATH for new shells
            for base in (Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages", Path("C:/ffmpeg/bin"), Path("C:/Program Files/ffmpeg/bin")):
                if base.exists():
                    cands += [str(p) for p in base.rglob("ffmpeg.exe")]
        else:
            cands += ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]
        try:  # pip install imageio-ffmpeg → a static ffmpeg with libx264
            import imageio_ffmpeg  # type: ignore

            cands.append(imageio_ffmpeg.get_ffmpeg_exe())
        except Exception:
            pass
        for c in cands:
            if c and self._works([c, "-version"]):  # ffmpeg only knows single-dash -version
                return c
        return None

    def _find_ytdlp(self, explicit: str | None) -> list[str] | None:
        cands: list[list[str]] = []
        if explicit:
            cands.append([explicit])
        if os.environ.get("YTDLP"):
            cands.append([os.environ["YTDLP"]])
        w = shutil.which("yt-dlp")
        if w:
            cands.append([w])
        cands.append([sys.executable, "-m", "yt_dlp"])
        for c in cands:
            if self._works(c + ["--version"]):
                return c
        return None

    def report(self) -> None:
        print("tools:")
        for name, v in (("ffmpeg", self.ffmpeg), ("ffprobe", self.ffprobe), ("yt-dlp", " ".join(self.ytdlp) if self.ytdlp else None)):
            (ok if v else info)(f"{name:<8} {v or ('not found' + (' (optional)' if name == 'ffprobe' else ''))}")

    def need_ffmpeg(self) -> str:
        if not self.ffmpeg:
            raise SystemExit("ffmpeg is required.  Windows: winget install Gyan.FFmpeg (then open a new terminal)  ·  macOS: brew install ffmpeg  ·  Linux: sudo apt install ffmpeg  ·  or: pip install imageio-ffmpeg")
        return self.ffmpeg

    def need_ytdlp(self) -> list[str]:
        if not self.ytdlp:
            raise SystemExit("yt-dlp is required for the soundtrack:  pip install yt-dlp")
        return self.ytdlp

    def probe(self, path: Path) -> dict:
        """duration + width/height via ffprobe, or ffmpeg's stderr as a fallback."""
        out: dict = {}
        if self.ffprobe:
            try:
                j = json.loads(subprocess.run([self.ffprobe, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(path)], capture_output=True, text=True, check=True).stdout)
                out["duration"] = round(float(j["format"].get("duration", 0)), 3)
                v = next((s for s in j["streams"] if s.get("codec_type") == "video"), None)
                if v:
                    out["size"] = [v["width"], v["height"]]
                return out
            except Exception:
                pass
        if self.ffmpeg:
            err = subprocess.run([self.ffmpeg, "-i", str(path)], capture_output=True, text=True).stderr
            m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
            if m:
                out["duration"] = round(int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]), 3)
            m = re.search(r"Video: .*? (\d{2,5})x(\d{2,5})", err)
            if m:
                out["size"] = [int(m[1]), int(m[2])]
        return out


# ---------------------------------------------------------------------------
# manifest
# ---------------------------------------------------------------------------
def load_manifest() -> dict:
    if MANIFEST.exists():
        try:
            return json.loads(MANIFEST.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            warn("manifest.json was unreadable — starting a fresh one")
    return {"audio": None, "clips": {}, "stills": {}}


def save_manifest(m: dict) -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    m["generated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    m["generator"] = "tools/fetch_media.py"
    MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# audio
# ---------------------------------------------------------------------------
def fetch_audio(S: dict, tools: Tools, manifest: dict, force: bool) -> None:
    T = S["TIMING"]
    out = MEDIA / "audio" / "soundtrack.m4a"
    print(f"\n♪ soundtrack  {T.get('trackTitle')} — {T.get('artist')}  (youtu.be/{T['videoId']})")
    if out.exists() and not force and manifest.get("audio", {}) and manifest["audio"].get("videoId") == T["videoId"]:
        ok(f"already bundled ({human(out.stat().st_size)}) — use --force to refetch")
        return
    yt = tools.need_ytdlp()
    ff = tools.need_ffmpeg()
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = MEDIA / ".tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    raw = tmp / "soundtrack.%(ext)s"
    cmd = yt + ["-f", "bestaudio[ext=m4a]/bestaudio/best", "--no-playlist", "--ffmpeg-location", str(Path(ff).parent), "-o", str(raw), "--force-overwrites", "--no-part", f"https://www.youtube.com/watch?v={T['videoId']}"]
    info("yt-dlp " + " ".join(cmd[len(yt):]))
    subprocess.run(cmd, check=True)
    src = next(tmp.glob("soundtrack.*"), None)
    if not src:
        raise SystemExit("yt-dlp produced no file")
    # normalise to AAC 192k, strip cover art, +faststart so seeking works instantly over HTTP Range
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-vn", "-map_metadata", "-1", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(out)], check=True)
    src.unlink(missing_ok=True)
    meta = tools.probe(out)
    manifest["audio"] = {"file": "media/audio/soundtrack.m4a", "duration": meta.get("duration"), "videoId": T["videoId"], "source": f"https://www.youtube.com/watch?v={T['videoId']}", "title": T.get("trackTitle"), "artist": T.get("artist"), "bpm": T.get("bpm"), "offset": T.get("offset")}
    save_manifest(manifest)
    ok(f"{out.relative_to(ROOT)}  {human(out.stat().st_size)}  {meta.get('duration', '?')} s")


# ---------------------------------------------------------------------------
# clips
# ---------------------------------------------------------------------------
def fetch_clips(S: dict, tools: Tools, manifest: dict, only: list[str], max_h: int, force: bool) -> None:
    ff = tools.need_ffmpeg()
    clips: dict = S["CLIPS"]
    tmp = MEDIA / ".tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    (MEDIA / "clips").mkdir(parents=True, exist_ok=True)
    print(f"\n▶ clips  ({len(clips)} in the screenplay, cap {max_h}p)")
    done = 0
    for key, c in clips.items():
        if only and key not in only:
            continue
        out = MEDIA / "clips" / f"{key}.mp4"
        poster = MEDIA / "clips" / f"{key}.jpg"
        start, length = float(c.get("start", 0)), float(c.get("len", 10))
        prev = manifest["clips"].get(key)
        if out.exists() and prev and not force and prev.get("start") == start and prev.get("len") == length and prev.get("file_src") == c["file"]:
            ok(f"{key:<10} already bundled  {human(out.stat().st_size)}")
            done += 1
            continue
        print(f"  {key:<10} {c.get('title', c['file'])}  [{start:g}s +{length:g}s]")
        src: Path | None = None
        chosen = ""
        for label, url in clip_candidates(c, max_h):
            status, size = http_head(url)
            if status != 200:
                info(f"{label:<14} not available ({status or 'no response'})")
                continue
            ext = Path(urllib.parse.urlparse(url).path).suffix or ".webm"
            src = tmp / f"{key}.src{ext}"
            try:
                download(url, src, f"{key} {label}")
                chosen = label
                info(f"{label:<14} {human(src.stat().st_size)}")
                break
            except Exception as e:  # try the next rendition
                warn(f"{label}: {e}")
                src = None
        if not src:
            fail(f"{key}: no rendition could be fetched — the film will stream this clip / use its still")
            continue
        # accurate trim (-ss after -i), drop audio, H.264 High@4.1 that every browser and Safari decode in hardware
        vf = f"scale=-2:'min({max_h},ih)':flags=lanczos,format=yuv420p"
        subprocess.run([ff, "-y", "-loglevel", "error", "-stats", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{length:.3f}", "-an", "-sn", "-map_metadata", "-1", "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-profile:v", "high", "-level", "4.1", "-g", "48", "-movflags", "+faststart", str(out)], check=True)
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(out), "-frames:v", "1", "-q:v", "2", str(poster)], check=True)
        meta = tools.probe(out)
        manifest["clips"][key] = {"file": f"media/clips/{key}.mp4", "poster": f"media/clips/{key}.jpg", "duration": meta.get("duration"), "size": meta.get("size"), "rendition": chosen, "start": start, "len": length, "file_src": c["file"], "source": commons_page(c["file"]), "title": c.get("title"), "license": c.get("license")}
        save_manifest(manifest)
        src.unlink(missing_ok=True)
        ok(f"{key:<10} {out.relative_to(ROOT)}  {human(out.stat().st_size)}  {meta.get('size', ['?', '?'])[0]}×{meta.get('size', ['?', '?'])[1]}  {meta.get('duration', '?')} s")
        done += 1
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"  {done}/{len([k for k in clips if not only or k in only])} clips bundled")


# ---------------------------------------------------------------------------
# stills
# ---------------------------------------------------------------------------
def fetch_stills(S: dict, manifest: dict, max_w: int, force: bool) -> None:
    images: dict = S["IMAGES"]
    (MEDIA / "stills").mkdir(parents=True, exist_ok=True)
    print(f"\n▣ stills  ({len(images)} in the screenplay, ≤ {max_w} px wide)")
    total = 0
    done = 0
    for key, d in images.items():
        ext = Path(d["file"]).suffix.lower() or ".jpg"
        if ext == ".jpeg":
            ext = ".jpg"
        out = MEDIA / "stills" / f"{key}{ext}"
        w = min(max_w, int(d["w"]))
        prev = manifest["stills"].get(key)
        if out.exists() and prev and not force and prev.get("width") == w:
            done += 1
            total += out.stat().st_size
            continue
        url = still_url(d, w)
        try:
            n = download(url, out, f"{key} {w}px")
        except Exception as e:
            # a thumbnail can fail (e.g. huge TIFF-ish JPEGs); fall back to the original file
            if "/thumb/" in url:
                try:
                    n = download(still_url(d, 0), out, f"{key} original")
                    w = int(d["w"])
                except Exception as e2:
                    fail(f"{key}: {e2}")
                    continue
            else:
                fail(f"{key}: {e}")
                continue
        total += n
        done += 1
        manifest["stills"][key] = {"file": f"media/stills/{key}{ext}", "width": w, "source": commons_page(d["file"]), "credit": d.get("credit"), "license": d.get("license")}
        save_manifest(manifest)
        ok(f"{key:<11} {w:>4} px  {human(n):>9}")
    print(f"  {done}/{len(images)} stills bundled, {human(total)} on disk")


# ---------------------------------------------------------------------------
# verify
# ---------------------------------------------------------------------------
def verify(S: dict, tools: Tools, manifest: dict) -> int:
    print("\nverify")
    problems = 0
    a = manifest.get("audio")
    if a:
        p = ROOT / a["file"]
        if not p.exists():
            fail(f"audio file missing: {a['file']}")
            problems += 1
        elif a.get("videoId") != S["TIMING"]["videoId"]:
            fail(f"audio is {a.get('videoId')} but the screenplay wants {S['TIMING']['videoId']} — run --audio --force")
            problems += 1
        else:
            ok(f"audio  {a['file']}  {human(p.stat().st_size)}  {a.get('duration')} s")
    else:
        warn("no soundtrack bundled (the film will play its ambient score)")
    for key, c in S["CLIPS"].items():
        m = manifest["clips"].get(key)
        if not m:
            warn(f"clip {key} not bundled (streams from Commons)")
            continue
        p = ROOT / m["file"]
        if not p.exists():
            fail(f"clip {key}: file missing")
            problems += 1
            continue
        if m.get("start") != c.get("start") or m.get("len") != c.get("len") or m.get("file_src") != c["file"]:
            warn(f"clip {key}: screenplay window changed — run --clips --clip {key} --force")
        if p.stat().st_size > 100 * 1024 * 1024:
            fail(f"clip {key}: {human(p.stat().st_size)} exceeds GitHub's 100 MB file limit")
            problems += 1
        d = m.get("duration") or 0
        if d and abs(d - float(c.get("len", 0))) > 0.6:
            warn(f"clip {key}: is {d} s, screenplay uses {c.get('len')} s")
    for key in S["IMAGES"]:
        m = manifest["stills"].get(key)
        if m and not (ROOT / m["file"]).exists():
            fail(f"still {key}: file missing")
            problems += 1
    missing_stills = [k for k in S["IMAGES"] if k not in manifest["stills"]]
    if missing_stills:
        warn(f"{len(missing_stills)} stills not bundled (stream from Commons): {', '.join(missing_stills[:8])}{'…' if len(missing_stills) > 8 else ''}")
    size = sum(p.stat().st_size for p in MEDIA.rglob("*") if p.is_file())
    ok(f"media/ is {human(size)} in total")
    print(("  " + _c("31", f"{problems} problem(s)")) if problems else ("  " + _c("32", "all good")))
    return problems


# ---------------------------------------------------------------------------
def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Bundle the HUMANITY film's media into media/ so nothing streams from YouTube.")
    ap.add_argument("--audio", action="store_true", help="only the soundtrack")
    ap.add_argument("--clips", action="store_true", help="only the clips")
    ap.add_argument("--stills", action="store_true", help="only the stills")
    ap.add_argument("--clip", action="append", default=[], metavar="KEY", help="restrict to one clip (repeatable)")
    ap.add_argument("--max", type=int, default=3840, metavar="PX", help="max still width (default 3840)")
    ap.add_argument("--quality", type=int, default=1080, metavar="P", help="max clip height (default 1080)")
    ap.add_argument("--ffmpeg", metavar="PATH", help="explicit ffmpeg binary")
    ap.add_argument("--yt-dlp", dest="ytdlp", metavar="PATH", help="explicit yt-dlp binary")
    ap.add_argument("--force", action="store_true", help="refetch items that are already bundled")
    ap.add_argument("--check", action="store_true", help="only report which tools were found")
    ap.add_argument("--verify", action="store_true", help="only verify the manifest against the screenplay")
    args = ap.parse_args(argv)

    if not SCRIPT_JS.exists():
        print(f"cannot find {SCRIPT_JS} — run this from the repository")
        return 2
    S = load_script()
    tools = Tools(args.ffmpeg, args.ytdlp)
    manifest = load_manifest()
    print(_c("1", "HUMANITY · media bundler"))
    tools.report()
    if args.check:
        return 0
    if args.verify:
        return 1 if verify(S, tools, manifest) else 0

    do_all = not (args.audio or args.clips or args.stills)
    t0 = time.time()
    try:
        if do_all or args.audio:
            try:
                fetch_audio(S, tools, manifest, args.force)
            except SystemExit as e:
                warn(str(e))
                warn("skipping the soundtrack — the film will use its ambient score until you bundle it")
                if args.audio:
                    return 1
        if do_all or args.clips:
            fetch_clips(S, tools, manifest, args.clip, args.quality, args.force)
        if do_all or args.stills:
            fetch_stills(S, manifest, args.max, args.force)
    except KeyboardInterrupt:
        print("\ninterrupted — progress so far is saved in media/manifest.json; rerun to continue")
        return 130
    verify(S, tools, manifest)
    print(f"\ndone in {time.time() - t0:.0f} s.  Next:  git add media && git commit -m \"Bundle film media\"")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
