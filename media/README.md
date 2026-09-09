# media/

Local copies of the film's soundtrack, clips and stills, produced by

    node tools/fetch-media.js

(needs `yt-dlp` and `ffmpeg`). The film reads `media/manifest.json`; anything
listed there is served from this folder, anything missing streams from
YouTube / Wikimedia as before.

Expected size: ~6 MB audio + ~40–60 MB of 1080p clips + ~40–80 MB of stills
at 3840 px (use `--max 2560` for roughly half). GitHub Pages serves files up
to 100 MB each and repos up to ~1 GB, so committing this folder is fine.

Sources and licences are recorded per item in the manifest. The soundtrack
(FUNK CONTRA — Dj Samir, Nulteex, Zericxxn) is copyrighted music: keep a
local copy only if you have the rights to redistribute it, otherwise delete
`media/audio/` and the film will stream it from YouTube.
