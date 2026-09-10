# media/

Local copies of the film's soundtrack, clips and stills, produced by

    python tools/fetch_media.py        (or: node tools/fetch-media.js)

(needs `ffmpeg`; `yt-dlp` only for the soundtrack). The film reads
`media/manifest.json`; anything listed there is served from this folder,
anything missing streams from Wikimedia Commons (clips, stills) or falls back
to the ambient score (soundtrack).

Expected size: ~6 MB audio + ~40–60 MB of 1080p clips + ~40–80 MB of stills
at 3840 px (use `--max 2560` for roughly half). GitHub Pages serves files up
to 100 MB each and repos up to ~1 GB, so committing this folder is fine.

Sources and licences are recorded per item in the manifest. The soundtrack
(ZAI JIAN — Super Slowed, NTRIX) is copyrighted music: keep a
local copy only if you have the rights to redistribute it, otherwise delete
`media/audio/` and the film will play its generative ambient score.
