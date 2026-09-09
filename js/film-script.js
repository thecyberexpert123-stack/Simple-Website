/* =====================================================================
   HUMANITY — film-script.js
   The screenplay for the opening film: a beat-synced cut through
   13.8 billion years. Everything here is data; js/film.js is the editor.

   Timing model
   ------------
   All durations are in BEATS. The film is laid out on the beat grid of
   the soundtrack (FUNK CONTRA — Extended · Slowed, streamed via
   YouTube). Tempo and first-beat offset are tunable in TIMING below,
   via ?bpm=&offset= in the URL, or with the in-film tap-tempo tool
   (?debug=1 → press T on the beat, O on a downbeat).

   Shot syntax:  [ media, beats, transition, caption ]
     media      'imgKey' | { yt:'videoId', start:sec, fallback:'imgKey' }
                | { mode:'cosmosMode' }   (pure generative background)
     transition cut | punch | whip | whipL | fade | glitch | flash |
                zoomin | zoomout | wipe | slice | iris | invert | drop
   ===================================================================== */
window.FILM_SCRIPT = (function () {
  'use strict';

  const TIMING = {
    videoId: 'kkq8Uz_CYmI',   // FUNK CONTRA - (Extended) - Slowed · 4:04
    bpm: 96.7,                // estimate — see README "Tuning the beat grid"
    offset: 0.12,             // seconds from stream start to first downbeat
    minBpm: 60, maxBpm: 160
  };

  /* ------------------------------------------------------------------
     Archival stills (Wikimedia Commons). Public-domain unless noted.
     Credits are shown in the film HUD and in the site footer.
     ------------------------------------------------------------------ */
  const IMAGES = {
    milky: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Milky_Way_Arch.jpg/1600px-Milky_Way_Arch.jpg', credit: 'Bruno Gilli / ESO', license: 'CC BY 4.0', page: 'https://commons.wikimedia.org/wiki/File:Milky_Way_Arch.jpg' },
    udf: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Hubble_ultra_deep_field_high_rez_edit1.jpg/1600px-Hubble_ultra_deep_field_high_rez_edit1.jpg', credit: 'NASA / ESA / STScI — Hubble Ultra Deep Field', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Hubble_ultra_deep_field_high_rez_edit1.jpg' },
    pillars: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg/1600px-Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg', credit: 'NASA / ESA / Hubble — Pillars of Creation', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg' },
    marble: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/The_Blue_Marble_(remastered).jpg/1600px-The_Blue_Marble_(remastered).jpg', credit: 'NASA / Apollo 17 — The Blue Marble, 1972', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:The_Blue_Marble_(remastered).jpg' },
    hands: { src: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/SantaCruz-CuevaManos-P2210651b.jpg', credit: 'Cueva de las Manos, Argentina — c. 7300 BCE', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:SantaCruz-CuevaManos-P2210651b.jpg' },
    lascaux: { src: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Lascaux_painting.jpg', credit: 'Lascaux cave, France — c. 17,000 years ago', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Lascaux_painting.jpg' },
    cune: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cuneiform_tablet-_administrative_account_of_barley_distribution_with_cylinder_seal_impression_of_a_male_figure,_hunting_dogs,_and_boars_MET_DT847.jpg/1600px-Cuneiform_tablet-_administrative_account_of_barley_distribution_with_cylinder_seal_impression_of_a_male_figure,_hunting_dogs,_and_boars_MET_DT847.jpg', credit: 'Cuneiform tablet, c. 3100 BCE — The Met (CC0)', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Cuneiform_tablet-_administrative_account_of_barley_distribution_with_cylinder_seal_impression_of_a_male_figure,_hunting_dogs,_and_boars_MET_DT847.jpg' },
    pyramid: { src: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Kheops-Pyramid.jpg', credit: 'Great Pyramid of Giza — Nina Aldin Thune', license: 'CC BY 2.5', page: 'https://commons.wikimedia.org/wiki/File:Kheops-Pyramid.jpg' },
    rosetta: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Rosetta_Stone.JPG/1600px-Rosetta_Stone.JPG', credit: 'The Rosetta Stone — Hans Hillewaert', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Rosetta_Stone.JPG' },
    vitruv: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Da_Vinci_Vitruve_Luc_Viatour.jpg/1600px-Da_Vinci_Vitruve_Luc_Viatour.jpg', credit: 'Leonardo da Vinci — Vitruvian Man, c. 1490', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Da_Vinci_Vitruve_Luc_Viatour.jpg' },
    gutenberg: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gutenberg_Bible,_Lenox_Copy,_New_York_Public_Library,_2009._Pic_01.jpg/1600px-Gutenberg_Bible,_Lenox_Copy,_New_York_Public_Library,_2009._Pic_01.jpg', credit: 'Gutenberg Bible, 1455 — Kevin Eng', license: 'CC BY-SA 2.0', page: 'https://commons.wikimedia.org/wiki/File:Gutenberg_Bible,_Lenox_Copy,_New_York_Public_Library,_2009._Pic_01.jpg' },
    galileo: { src: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Galileo_moon_phases.jpg', credit: 'Galileo Galilei — sketches of the Moon, 1610', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Galileo_moon_phases.jpg' },
    principia: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Prinicipia-title.png/1600px-Prinicipia-title.png', credit: 'Isaac Newton — Principia, 1687', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Prinicipia-title.png' },
    hokusai: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1600px-Tsunami_by_hokusai_19th_century.jpg', credit: 'Hokusai — The Great Wave, c. 1831', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg' },
    tesla: { src: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Tesla_colorado_adjusted.jpg', credit: 'Nikola Tesla, Colorado Springs, 1899 — Dickenson V. Alley', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Tesla_colorado_adjusted.jpg' },
    bridge: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Brooklyn_Bridge_Postdlf.jpg/1600px-Brooklyn_Bridge_Postdlf.jpg', credit: 'Brooklyn Bridge, 1883 — Postdlf', license: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:Brooklyn_Bridge_Postdlf.jpg' },
    ford: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Ford_assembly_line_-_1913.jpg/1600px-Ford_assembly_line_-_1913.jpg', credit: 'Ford assembly line, 1913', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Ford_assembly_line_-_1913.jpg' },
    flight: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/First_flight2.jpg/1600px-First_flight2.jpg', credit: 'First flight, Kitty Hawk, 17 Dec 1903 — John T. Daniels', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:First_flight2.jpg' },
    einstein: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Einstein_1921_by_F_Schmutzer_-_restoration.jpg/1600px-Einstein_1921_by_F_Schmutzer_-_restoration.jpg', credit: 'Albert Einstein, 1921 — Ferdinand Schmutzer', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Einstein_1921_by_F_Schmutzer_-_restoration.jpg' },
    curie: { src: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Marie_Curie_c1920.jpg', credit: 'Marie Curie, c. 1920 — Henri Manuel', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Marie_Curie_c1920.jpg' },
    trinity: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Trinity_Detonation_T&B.jpg/1600px-Trinity_Detonation_T&B.jpg', credit: 'Trinity, 16 July 1945 — Berlyn Brixner / LANL', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Trinity_Detonation_T&B.jpg' },
    vaccine: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Smallpox_vaccine.jpg/1600px-Smallpox_vaccine.jpg', credit: 'Smallpox vaccine — CDC / James Gathany', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Smallpox_vaccine.jpg' },
    launch: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Apollo_11_Launch_-_GPN-2000-000630.jpg/1600px-Apollo_11_Launch_-_GPN-2000-000630.jpg', credit: 'Apollo 11 launch, 16 July 1969 — NASA', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Apollo_11_Launch_-_GPN-2000-000630.jpg' },
    earthrise: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/NASA-Apollo8-Dec24-Earthrise.jpg/1600px-NASA-Apollo8-Dec24-Earthrise.jpg', credit: 'Earthrise, 24 Dec 1968 — NASA / Bill Anders', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg' },
    aldrin: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Aldrin_Apollo_11_original.jpg/1600px-Aldrin_Apollo_11_original.jpg', credit: 'Buzz Aldrin on the Moon, 1969 — NASA / Neil Armstrong', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Aldrin_Apollo_11_original.jpg' },
    boot: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Apollo_11_bootprint.jpg/1600px-Apollo_11_bootprint.jpg', credit: 'Bootprint, Sea of Tranquility, 1969 — NASA / Buzz Aldrin', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Apollo_11_bootprint.jpg' },
    eniac: { src: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Eniac.jpg', credit: 'ENIAC, 1946 — U.S. Army', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Eniac.jpg' },
    transistor: { src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Replica-of-first-transistor.jpg', credit: 'Replica of the first transistor, 1947 — Bell Labs', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Replica-of-first-transistor.jpg' },
    web: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/First_Web_Server.jpg/1600px-First_Web_Server.jpg', credit: 'The first web server, CERN, 1990 — Coolcaesar', license: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:First_Web_Server.jpg' },
    pbd: { src: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Pale_Blue_Dot.png', credit: 'Pale Blue Dot, 1990 — NASA / JPL / Voyager 1', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Pale_Blue_Dot.png' },
    iss: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/STS-133_International_Space_Station_after_undocking.jpg/1600px-STS-133_International_Space_Station_after_undocking.jpg', credit: 'International Space Station, 2011 — NASA', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:STS-133_International_Space_Station_after_undocking.jpg' },
    falcon: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Falcon_Heavy_Demo_Mission_(40126461411).jpg/1600px-Falcon_Heavy_Demo_Mission_(40126461411).jpg', credit: 'Falcon Heavy side boosters landing, 2018 — SpaceX (CC0)', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Falcon_Heavy_Demo_Mission_(40126461411).jpg' },
    bh: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Black_hole_-_Messier_87_crop_max_res.jpg/1600px-Black_hole_-_Messier_87_crop_max_res.jpg', credit: 'M87* — Event Horizon Telescope, 2019', license: 'CC BY 4.0', page: 'https://commons.wikimedia.org/wiki/File:Black_hole_-_Messier_87_crop_max_res.jpg' },
    webb: { src: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Webb's_First_Deep_Field.jpg/1600px-Webb's_First_Deep_Field.jpg", credit: "Webb's First Deep Field, 2022 — NASA / ESA / CSA / STScI", license: 'Public domain', page: "https://commons.wikimedia.org/wiki/File:Webb's_First_Deep_Field.jpg" },
    earth17: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/1600px-The_Earth_seen_from_Apollo_17.jpg', credit: 'Earth from Apollo 17, 1972 — NASA', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg' },
    higgs: { src: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/CMS_Higgs-event.jpg', credit: 'Simulated Higgs event, CMS — CERN', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:CMS_Higgs-event.jpg' }
  };

  /* ------------------------------------------------------------------
     Muted archival clips (YouTube, official channels). `start` is a
     seek position in seconds; every clip has a still as fallback.
     ------------------------------------------------------------------ */
  const CLIPS = {
    wright: { yt: 'FnML3I-yYyo', start: 24, fallback: 'flight' },
    apollo: { yt: 'pJbtYs0oZfQ', start: 95, fallback: 'aldrin' },
    mars: { yt: '4czjS9h4Fpg', start: 150, fallback: 'falcon' },
    issLive: { yt: 'uwXgcTc8oY8', start: 0, fallback: 'iss' },
    starship: { yt: 'hI9HQfCAw64', start: 30, fallback: 'falcon' }
  };

  /* ------------------------------------------------------------------
     Chapters. `mode` is the generative background (js/cosmos.js) that
     shows through pure-text shots and when a still cannot be loaded.
     Shot beats per chapter should sum to a multiple of 4 (one bar).
     ------------------------------------------------------------------ */
  const CHAPTERS = [
    {
      id: 'open', kind: 'open', mode: 'stars', bars: 4,
      label: 'HUMANITY — THE FILM', title: '', code: 'P-000',
      lines: [
        [1, '// 13,800,000,000 years'],
        [5, '// one species that looked up'],
        [9, '// two minutes forty-four seconds'],
        [13, '// cut to the beat. just watch.']
      ]
    },
    {
      id: 'title', kind: 'title', mode: 'galaxy', bars: 4,
      label: 'A MONUMENT TO WHAT WE HAVE DONE', title: 'HUMANITY', tagline: 'Starstuff that learned to wonder, then learned to build.', code: 'P-001',
      shots: [
        [{ mode: 'galaxy' }, 8, 'fade'],
        ['milky', 4, 'flash', 'The Milky Way — 100 billion suns, one of which is ours'],
        ['udf', 2, 'punch', 'Hubble Ultra Deep Field — 10,000 galaxies in a grain of sky'],
        ['pillars', 2, 'glitch', 'Pillars of Creation — where stars are born']
      ]
    },
    {
      id: 'fire', kind: 'chapter', num: 1, mode: 'embers', bars: 6,
      label: 'CHAPTER 01', title: 'FIRE & ART', when: '1,500,000 – 17,000 years ago', code: 'P-002',
      line: 'Warmth. Light. Cooked food. Then a hand on a cave wall: the mind turns outward.',
      shots: [
        [{ mode: 'embers' }, 4, 'fade'],
        ['hands', 6, 'iris', 'Cueva de las Manos — hands stencilled 9,000 years ago'],
        ['lascaux', 6, 'whip', 'Lascaux — painted by torchlight, 17,000 years ago'],
        ['hands', 1, 'cut'], ['lascaux', 1, 'cut'], ['hands', 1, 'cut'], ['lascaux', 1, 'glitch'],
        [{ mode: 'embers' }, 4, 'flash']
      ]
    },
    {
      id: 'word', kind: 'chapter', num: 2, mode: 'ink', bars: 6,
      label: 'CHAPTER 02', title: 'THE WORD', when: '3100 BCE – 1455 CE', code: 'P-003',
      line: 'Memory escapes the skull. Ideas outlive the people who had them.',
      shots: [
        ['cune', 6, 'slice', 'Cuneiform — a barley account, Sumer, c. 3100 BCE'],
        ['pyramid', 4, 'punch', 'The Great Pyramid — 2560 BCE, 2.3 million blocks'],
        ['rosetta', 4, 'whipL', 'The Rosetta Stone — one decree, three scripts'],
        ['hokusai', 4, 'wipe', 'Hokusai — The Great Wave, c. 1831'],
        ['gutenberg', 4, 'zoomin', 'Gutenberg Bible, 1455 — ideas become cheap'],
        ['gutenberg', 1, 'invert'], ['cune', 1, 'cut']
      ]
    },
    {
      id: 'reason', kind: 'chapter', num: 3, mode: 'orbit', bars: 6,
      label: 'CHAPTER 03', title: 'REASON', when: '1490 – 1921', code: 'P-004',
      line: 'The universe becomes calculable.',
      shots: [
        ['vitruv', 4, 'iris', 'Leonardo — Vitruvian Man, c. 1490'],
        ['galileo', 4, 'punch', 'Galileo — the Moon has mountains, 1610'],
        ['principia', 4, 'whip', 'Newton — Principia Mathematica, 1687'],
        ['curie', 4, 'slice', 'Marie Curie — two Nobel Prizes, two sciences'],
        ['einstein', 6, 'zoomout', 'Einstein, 1921 — E = mc²'],
        ['einstein', 1, 'glitch'], ['galileo', 1, 'cut']
      ]
    },
    {
      id: 'machine', kind: 'chapter', num: 4, mode: 'gears', bars: 6,
      label: 'CHAPTER 04', title: 'THE MACHINE', when: '1883 – 1913', code: 'P-005',
      line: 'Steel, current, and twelve seconds of flight.',
      shots: [
        ['bridge', 4, 'drop', 'Brooklyn Bridge, 1883 — steel learns to span'],
        ['tesla', 4, 'flash', 'Tesla at Colorado Springs, 1899'],
        ['ford', 4, 'whip', 'Ford assembly line, 1913 — the world speeds up'],
        [CLIPS.wright, 8, 'punch', 'Kitty Hawk, 17 December 1903 — 12 seconds, 120 feet'],
        ['flight', 2, 'zoomin', 'Kitty Hawk, 17 December 1903 — 12 seconds, 120 feet'],
        ['flight', 1, 'invert'], ['tesla', 1, 'cut']
      ]
    },
    {
      id: 'atom', kind: 'chapter', num: 5, mode: 'atom', bars: 6,
      label: 'CHAPTER 05', title: 'THE ATOM', when: '1945 – 2012', code: 'P-006',
      line: 'We learn what everything is made of — and what that knowledge costs.',
      shots: [
        [{ mode: 'atom' }, 2, 'fade'],
        ['trinity', 1, 'flash', 'Trinity, 16 July 1945 — 0.016 seconds after detonation'],
        [{ mode: 'atom' }, 1, 'invert'],
        ['trinity', 4, 'cut', 'Trinity, 16 July 1945 — 0.016 seconds after detonation'],
        ['vaccine', 4, 'wipe', 'Smallpox — the first disease we erased, 1980'],
        ['transistor', 4, 'punch', 'The first transistor, Bell Labs, 1947'],
        ['eniac', 4, 'whipL', 'ENIAC, 1946 — 18,000 vacuum tubes'],
        ['higgs', 4, 'glitch', 'The Higgs boson — CERN, 4 July 2012']
      ]
    },
    {
      id: 'moon', kind: 'chapter', num: 6, mode: 'orbit', bars: 8,
      label: 'CHAPTER 06', title: 'LEAVING THE CRADLE', when: '1968 – 1972', code: 'P-007',
      line: 'Life leaves its cradle for the first time in four billion years.',
      shots: [
        ['launch', 4, 'drop', 'Apollo 11 lifts off — 16 July 1969'],
        ['launch', 1, 'cut'], ['launch', 1, 'punch'], ['launch', 1, 'punch'], ['launch', 1, 'flash'],
        ['earthrise', 8, 'fade', 'Earthrise — Apollo 8, Christmas Eve 1968'],
        [CLIPS.apollo, 8, 'glitch', '20 July 1969 — "That\'s one small step for a man"'],
        ['aldrin', 4, 'punch', 'Buzz Aldrin, photographed by Neil Armstrong'],
        ['boot', 4, 'zoomin', 'A bootprint that will last a million years']
      ]
    },
    {
      id: 'network', kind: 'chapter', num: 7, mode: 'network', bars: 6,
      label: 'CHAPTER 07', title: 'THE NETWORK', when: '1990 – 2025', code: 'P-008',
      line: 'A nervous system for the species. A permanent address in orbit.',
      shots: [
        ['web', 4, 'slice', 'The first web server — CERN, 1990. "This machine is a server. DO NOT POWER DOWN!!"'],
        ['pbd', 4, 'iris', 'Pale Blue Dot — Voyager 1 looks home from 6 billion km, 1990'],
        [CLIPS.issLive, 8, 'whip', 'Live from the International Space Station — humans in orbit since 2000'],
        ['iss', 2, 'punch', 'International Space Station — 25 years of continuous presence'],
        ['falcon', 4, 'flash', 'Falcon Heavy boosters return to land — 2018'],
        ['falcon', 1, 'glitch'], ['web', 1, 'cut']
      ]
    },
    {
      id: 'universe', kind: 'chapter', num: 8, mode: 'galaxy', bars: 8,
      label: 'CHAPTER 08', title: 'SEEING THE UNIVERSE', when: '1995 – 2022', code: 'P-009',
      line: 'We photograph the unphotographable and read the first light.',
      shots: [
        ['udf', 6, 'zoomout', 'Hubble Ultra Deep Field — 11 days staring at nothing'],
        ['pillars', 4, 'whip', 'Pillars of Creation — 6,500 light-years away'],
        ['bh', 6, 'iris', 'M87* — the first image of a black hole, 2019'],
        ['bh', 1, 'invert'], ['bh', 1, 'glitch'],
        [CLIPS.mars, 6, 'punch', 'Perseverance touches down on Mars — 18 February 2021'],
        ['webb', 6, 'fade', "Webb's First Deep Field — 12 July 2022, light 13 billion years old"],
        ['marble', 2, 'flash', 'Home.']
      ]
    },
    {
      id: 'now', kind: 'finale', mode: 'warp', bars: 8,
      label: 'CHAPTER 09', title: 'NOW', when: new Date().getFullYear(), code: 'P-010',
      line: 'You are here.',
      shots: [
        [CLIPS.starship, 8, 'glitch', 'Starship Flight 5 — a 71-metre booster caught out of the sky, 13 October 2024'],
        ['earth17', 8, 'fade', 'Earth from Apollo 17 — everyone you have ever known is in this frame'],
        [{ mode: 'warp' }, 16, 'flash']
      ]
    }
  ];

  const TAGS = ['FIRE', 'THE WRITTEN WORD', 'AGRICULTURE', 'MATHEMATICS', 'THE PRINTING PRESS', 'GRAVITY', 'VACCINATION', 'ELECTRICITY', 'FLIGHT', 'RELATIVITY', 'ANTIBIOTICS', 'THE TRANSISTOR', 'THE MOON', 'THE INTERNET', 'THE GENOME', 'GRAVITATIONAL WAVES', 'A BLACK HOLE, PHOTOGRAPHED', 'FIRST LIGHT'];

  const PRELOAD_LINES = [
    '// waking the cosmos',
    '// compressing 13.8 billion years',
    '// requesting archival footage',
    '// tuning the beat grid',
    '// polishing the moon',
    '// counting 8 billion of us',
    '// almost there, explorer'
  ];

  return { TIMING, IMAGES, CLIPS, CHAPTERS, TAGS, PRELOAD_LINES };
})();
