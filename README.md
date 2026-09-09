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

All videos are embedded from their official publishers via `youtube-nocookie.com` and remain their property.

## Host it on GitHub Pages

1. Push this repository to GitHub (branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The included workflow (`.github/workflows/pages.yml`) deploys automatically on every push to `main`.

Alternatively choose **Source: Deploy from a branch → `main` / `(root)`** — the site is fully static, so that works too.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

(Opening `index.html` directly from disk also works, but a local server is recommended so YouTube embeds behave correctly.)

## Structure

```
index.html          markup
css/style.css       design system, layout, motion
js/data.js          all content — eras, galleries, numbers, voices, cosmic calendar
js/cosmos.js        canvas particle engine (scenes, morphing, parallax)
js/audio.js         generative ambient score (Web Audio API)
js/app.js           application logic
.github/workflows   GitHub Pages deployment
```

## Sources

Our World in Data · UN World Population Prospects 2024 · WHO · World Bank · ITU · NASA/JPL · CERN · Smithsonian National Air and Space Museum. Figures are rounded; live counters are extrapolations from published rates and are indicative, not measured.

## Accessibility & performance

Respects `prefers-reduced-motion`, keyboard-navigable (Esc closes the modal), semantic landmarks, ARIA labels, responsive from 320 px upward. Particle count and pixel ratio scale down automatically on mobile.
