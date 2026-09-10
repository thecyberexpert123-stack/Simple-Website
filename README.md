# HUMANITY — A Monument to What We Have Done

> The story of the species that looked up.

An interactive, single-page web monument to human achievement. No frameworks, no build step, no backend, no tracking — pure HTML, CSS and JavaScript that runs anywhere and deploys to GitHub Pages in one click.

## What's inside

| Section | What it does |
| --- | --- |
| **Entry gate** | Cinematic entrance; enter with or without a generative ambient score (Web Audio, no audio files). |
| **Living background** | A 1,300-particle canvas engine that morphs between twelve scenes — stars, spiral galaxy, embers, ink, orbits, gears, DNA helix, airflow, atom, warp, network, bloom — as you scroll. |
| **The Cosmic Calendar** | 13.8 billion years compressed into one year. Scrub, zoom to December / the last day / the final minute, or press Play. 29 events, positioned exactly. |
| **The Journey** | Eleven eras from Fire to the Present Frontier, each with facts and official footage. |
| **The Galleries** | Six halls (Cosmos · Life & Medicine · Mind & Machines · Energy & Matter · Society & Rights · Art & Imagination) — 42 milestones, 16 with source footage from NASA, CERN, WHO, SpaceX, LLNL, DeepMind, Smithsonian, MIT and more. |
| **The Numbers** | Life expectancy, child mortality, poverty, literacy, electricity, connectivity — animated from *then* to *now*. |
| **Live** | World population, Voyager 1's distance, time since the first Moon footstep, ISS orbits, births since you opened the page — ticking in real time. |
| **You** | Enter your birth year → which milestones happened in your lifetime, your orbital distance, heartbeats, and your life in cosmic-calendar milliseconds. |
| **Voices** | Sagan, Armstrong, Curie, Kennedy, Newton, Mandela, Berners-Lee, Einstein. |
| **Finale** | Light a star with your name (stored only in your browser). Share. Begin again. |

There is no third-party video player anywhere on the site. Archival footage (NASA, JPL, ESO, NOAA, the U.S. National Archives) is played from public-domain / Creative Commons files on Wikimedia Commons in a plain `<video>` element; the handful of items whose only source is a publisher's YouTube upload (WHO, CERN, LLNL, MIT, DeepMind, TED) are honest links that open on YouTube in a new tab.

## Host it on GitHub Pages

1. Push this repository to GitHub (branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The included workflow (`.github/workflows/pages.yml`) deploys automatically on every push to `main`.

Alternatively choose **Source: Deploy from a branch → `main` / `(root)`** — the site is fully static, so that works too.

## Run locally

Node.js 18+ is the only thing you need (no `npm install` — the tools have zero dependencies):

```bash
npm run dev            # → http://localhost:8080   (or: node tools/serve.js 8080)
npm run check          # static project checks: parse, screenplay maths, wiring, media manifest, licences
```

Use `node tools/serve.js 8080 --host` to expose it on your LAN (binds `0.0.0.0`) for phone testing. Windows / PowerShell works the same.

Why a bespoke server rather than `python3 -m http.server`? Browsers **seek** inside media with HTTP `Range` requests. Python's server (and many one-liners) doesn't support them, so a locally bundled soundtrack refuses to jump to `?t=90`, `[`/`]` seeks stall, and clip `<video>` elements start slow. `tools/serve.js` answers `206 Partial Content`, sends ETags, disables caching for HTML/CSS/JS while you edit, and adds permissive CORS. Any static host that supports Range (GitHub Pages does) is fine in production.

Opening `index.html` straight from disk also works for a quick look, but the local media path and the seekable soundtrack need a real `http://` origin.

## Structure

```
index.html          markup
css/style.css       design system, layout, motion
js/data.js          all content — eras, galleries, numbers, voices, cosmic calendar
js/cosmos.js        canvas particle engine (scenes, morphing, parallax)
js/audio.js         generative ambient score (Web Audio API)
js/app.js           application logic
js/motion.js        motion layer — Lenis inertia scroll + GSAP/ScrollTrigger/SplitText choreography, magnetic buttons, tilt, cursor lens
js/glx.js           WebGL shader transitions for the film (liquid, chroma zoom, warp, ripple, mosaic, swirl, luma burn, slices)
js/film-script.js   the film's screenplay (shots, beats, captions, sources)
js/film.js          the film editor (clock, cuts, camera, HUD)
js/vendor/          GSAP 3.15 (+ ScrollTrigger, SplitText, CustomEase) and Lenis 1.3 — committed, no build step
tools/serve.js      zero-dependency dev server (Range/206, ETag, CORS) — `npm run dev`
tools/check.js      project checker — `npm run check`
tools/fetch-media.js  bundles the soundtrack, clips and stills locally (see "Local media") — `npm run media`
package.json        npm scripts only; nothing to install
.github/workflows   GitHub Pages deployment
```

## Motion stack

| Layer | Tool | What it does here |
| --- | --- | --- |
| Scroll | **Lenis** | inertia scrolling driven by GSAP's ticker; nav anchors and the era rail scroll through it; stops while a modal/gate has the page locked |
| Choreography | **GSAP + ScrollTrigger** | section heads split into masked lines/words and rise in, staggered card batches, parallax depth on eras/heads/hero/finale, a self-drawing rule under each head, a `04 / 09` section counter in the nav |
| Type | **SplitText** | hero letters cascade from the centre; chapter titlecards in the film cascade letter by letter with an overshoot and exit upward |
| Film camera | **GSAP** | every still gets a real dolly/pan (six moves, portrait-aware; one-beat stabs land hard from a punch-in); beat pulses are eased impulses instead of CSS class flips; kinetic words slam in with an elastic settle |
| Film cuts | **WebGL (js/glx.js)** | 15 of the 21 transition names now render as pixel shaders blending the outgoing and incoming frames: `fade→liquid`, `burn→luma`, `iris→ripple`, `spin→swirl`, `glitch→mosaic`, `zoom*→chroma`, `whip/rise/fall/wipe→warp`, `slice/shutter→slices`. Hard cuts, punches, drops and flashes stay hard — they live on the beat. |
| Pointer | **GSAP quickTo** | magnetic buttons/tabs, 3-D tilt with a moving highlight on cards/tiles/numbers, a difference-blend cursor lens (mouse only) |

Everything degrades: no WebGL → CSS transitions; no GSAP → the original CSS reveals; `prefers-reduced-motion` → no Lenis, no lens, no tilt, no shader cuts. The shader layer also measures itself — if a device can't hold ~30 fps through a cut it first halves its resolution, then hands cuts back to CSS. `?gl=0` forces the CSS path.


## Sources

Our World in Data · UN World Population Prospects 2024 · WHO · World Bank · ITU · NASA/JPL · CERN · Smithsonian National Air and Space Museum. Figures are rounded; live counters are extrapolations from published rates and are indicative, not measured.

## Accessibility & performance

Respects `prefers-reduced-motion`, keyboard-navigable (Esc closes the modal), semantic landmarks, ARIA labels, responsive from 320 px upward. Particle count and pixel ratio scale down automatically on mobile.

## The opening film

Before the monument, the site plays a ~2¾-minute film: eleven chapters and 106 cuts through 13.8 billion years, edited live in the browser to the beat of *FUNK CONTRA (Extended · Slowed)* — Dj Samir, Nulteex, Zericxxn — played from `media/audio/soundtrack.m4a` (see *Local media*). Archival stills come from Wikimedia Commons at 1280 / 1920 / 2560 / 3840 px — chosen from the screen's physical pixels so a picture is never shown larger than its own resolution; originals under 1500 px are shown at their own size on a soft backdrop instead of being stretched (credits in the HUD and in `js/film-script.js`); ten clips are public-domain / CC video files from Wikimedia Commons (Wright 1908, Apollo 11, Earthrise, Voyager at Saturn, Falcon Heavy, Perseverance EDL, the ISS time-lapse, Starship from GOES, Webb, M87) streamed muted straight into `<video>` elements — no YouTube player, so nothing can come up “unavailable”, in-points are exact, and the WebGL cuts can sample the video frames too. Transitions (punch, whip, iris, slice, shutter, spin, zoom-blur, burn, rise/fall, glitch, strobe, flicker) land on beats; kinetic words slam on downbeats; the particle cosmos kicks on every beat; a year odometer runs down the right edge.

If the soundtrack file is missing or cannot start (not bundled yet, autoplay policy), the film keeps its cuts on a local clock and the site's own generative ambient score plays instead; tapping anywhere retries the soundtrack. A clip that fails to load falls back to its Ken Burns still on the same beat.

* `js/film-script.js` — the screenplay: chapters, shots, transitions (all in beats), image credits, tempo.
* `js/film.js` — the editor: preloader, gate, beat clock, cuts, HUD, hand-off to the monument.
* `css/film.css` — the look.

### Local media (recommended)

The soundtrack is **not** in the repo (it is commercial music) — fetch it once and the film has its beat-locked track. Clips and stills stream fine from Wikimedia Commons, but bundling them makes first frames instant and removes the last external dependency:

```bash
pip install yt-dlp        # soundtrack only — or: brew install yt-dlp   /   PowerShell: winget install yt-dlp.yt-dlp
sudo apt install ffmpeg   # or: brew install ffmpeg   /   PowerShell: winget install Gyan.FFmpeg  (then reopen the terminal)
npm run media             # = node tools/fetch-media.js → media/audio, media/clips, media/stills, media/manifest.json
npm run check             # confirms every file in the manifest exists and is under GitHub's 100 MB limit
git add media && git commit -m "Bundle film media"
```

`npm run media:audio`, `media:clips`, `media:stills` fetch one kind at a time.

The script downloads the track as 160 kbps AAC, pulls each clip straight from Wikimedia Commons (no yt-dlp needed for clips), cuts it to the exact window the film uses and re-encodes it as a lean ≤1080p H.264 MP4 (muted, fast-start — Safari-friendly), and saves every still at up to 3840 px. `film.js` reads `media/manifest.json` at boot: the soundtrack is a plain `<audio>` element (sample-accurate clock), clips are `<video>` elements, stills load from the repo. Anything not in the manifest streams from Commons, so partial fetches are fine (`--audio`, `--clips`, `--stills`, `--clip apollo`, `--max 2560`).

Note on rights: the archival clips and stills are public domain / CC and safe to redistribute; the soundtrack is commercial music — bundle it only if you hold the rights, otherwise leave `media/audio/` out and the film plays its own ambient score.

### Tuning the beat grid

Tempo and first-downbeat offset live in `TIMING` at the top of `js/film-script.js` and can be overridden without editing: `?bpm=96.7&offset=0.12`. Open `?debug=1`, enter with audio, and tap **T** on the beat (≥4 taps) or press **O** on a downbeat; arrows nudge (←/→ offset, ↑/↓ bpm), `[`/`]` seek, and the overlay prints the URL params to paste back into the script.

Other switches: `?nofilm=1` (or any `#section` link) skips straight to the monument; `?t=90` starts the film at 90 s; `Esc` skips at any time.

`?gl=0` disables the WebGL cuts (CSS transitions only).
