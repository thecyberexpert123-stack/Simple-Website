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

   Shot syntax:  [ media, beats, transition, caption, word ]
     media      'imgKey' | { yt:'videoId', start:sec, fallback:'imgKey' }
                | { mode:'cosmosMode' }   (pure generative background)
     transition cut | punch | whip | whipL | fade | glitch | flash | zoomin
                | zoomout | wipe | slice | iris | invert | drop | zoomblur
                | shutter | spin | flicker | burn | rise | fall
     word       optional kinetic word slammed on the first beat of the shot
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
     Archival stills (Wikimedia Commons). URL is built from the file name
     and the first two characters of its MD5 hash; `w` is the original
     width, so the editor can request 1280 / 1920 / 2560 px renditions.
     ------------------------------------------------------------------ */
  const IMAGES = {
    // cosmos
    milky: { file: 'Milky_Way_Arch.jpg', h: '9e', w: 4000, credit: 'The Milky Way over Paranal — Bruno Gilli / ESO', license: 'CC BY 4.0' },
    andromeda: { file: 'Andromeda_Galaxy_(with_h-alpha).jpg', h: '98', w: 3000, credit: 'Andromeda — Adam Evans', license: 'CC BY 2.0' },
    xdf: { file: 'Hubble_Extreme_Deep_Field_(full_resolution).png', h: '22', w: 2382, credit: 'Hubble eXtreme Deep Field — NASA / ESA', license: 'Public domain' },
    udf: { file: 'Hubble_ultra_deep_field_high_rez_edit1.jpg', h: '0d', w: 6200, credit: 'Hubble Ultra Deep Field — NASA / ESA / STScI', license: 'Public domain' },
    pillars: { file: 'Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg', h: '68', w: 6780, credit: 'Pillars of Creation — NASA / ESA / Hubble', license: 'Public domain' },
    crab: { file: 'Crab_Nebula.jpg', h: '00', w: 3864, credit: 'Crab Nebula — NASA / ESA / Hubble', license: 'Public domain' },
    carina: { file: 'NGC_3372a-full.jpg', h: '9a', w: 29566, credit: 'Carina Nebula — NASA / ESA / Hubble', license: 'Public domain' },
    marble: { file: 'The_Blue_Marble_(remastered).jpg', h: 'cb', w: 3000, credit: 'The Blue Marble — NASA / Apollo 17, 1972', license: 'Public domain' },
    eastern: { file: 'Earth_Eastern_Hemisphere.jpg', h: '6f', w: 2048, credit: 'Earth, eastern hemisphere — NASA', license: 'Public domain' },
    eclipse: { file: 'Solar_eclipse_1999_4_NR.jpg', h: '1c', w: 3543, credit: 'Total solar eclipse, 1999 — Luc Viatour', license: 'CC BY-SA 3.0' },
    // deep past
    hands: { file: 'SantaCruz-CuevaManos-P2210651b.jpg', h: 'f4', w: 1600, credit: 'Cueva de las Manos, Argentina — c. 7300 BCE', license: 'Public domain' },
    lascaux: { file: 'Lascaux_II.jpg', h: '40', w: 2748, credit: 'Lascaux — Jack Versloot', license: 'CC BY 2.0' },
    stonehenge: { file: 'Stonehenge2007_07_30.jpg', h: '3c', w: 2816, credit: 'Stonehenge — garethwiscombe', license: 'CC BY 2.0' },
    cune: { file: 'Cuneiform_tablet-_administrative_account_of_barley_distribution_with_cylinder_seal_impression_of_a_male_figure,_hunting_dogs,_and_boars_MET_DT847.jpg', h: '4d', w: 3787, credit: 'Cuneiform tablet, c. 3100 BCE — The Met', license: 'CC0' },
    giza: { file: 'Pyramids_of_the_Giza_Necropolis.jpg', h: '96', w: 10104, credit: 'Giza — KennyOMG', license: 'CC BY-SA 4.0' },
    parthenon: { file: 'Parthenon_(30276156187).jpg', h: 'a4', w: 8256, credit: 'The Parthenon — Phanatic', license: 'CC BY-SA 2.0' },
    colosseum: { file: 'Colosseo_2020.jpg', h: 'de', w: 12051, credit: 'The Colosseum — FeaturedPics', license: 'CC BY-SA 4.0' },
    rosetta: { file: 'Rosetta_Stone.JPG', h: '23', w: 3665, credit: 'The Rosetta Stone — Hans Hillewaert', license: 'CC BY-SA 4.0' },
    // reason
    vitruv: { file: 'Da_Vinci_Vitruve_Luc_Viatour.jpg', h: '22', w: 2258, credit: 'Leonardo — Vitruvian Man, c. 1490', license: 'Public domain' },
    press: { file: 'Gutenberg_press.jpg', h: '1e', w: 1924, credit: 'A Gutenberg-style press', license: 'Public domain' },
    gutenberg: { file: 'Gutenberg_Bible,_Lenox_Copy,_New_York_Public_Library,_2009._Pic_01.jpg', h: 'b6', w: 1920, credit: 'Gutenberg Bible, 1455 — Kevin Eng', license: 'CC BY-SA 2.0' },
    galileo: { file: "Galileo's_sketches_of_the_moon.png", h: '7b', w: 2200, credit: 'Galileo — sketches of the Moon, 1610', license: 'Public domain' },
    newton: { file: 'Newton-WilliamBlake.jpg', h: '0e', w: 4702, credit: 'Newton — William Blake, 1795', license: 'Public domain' },
    principia: { file: 'Prinicipia-title.png', h: '17', w: 1930, credit: 'Newton — Principia, 1687', license: 'Public domain' },
    hokusai: { file: 'Tsunami_by_hokusai_19th_century.jpg', h: 'a5', w: 3859, credit: 'Hokusai — The Great Wave, c. 1831', license: 'Public domain' },
    curie: { file: 'Marie_Curie_c1920.jpg', h: '7e', w: 1460, credit: 'Marie Curie, c. 1920 — Henri Manuel', license: 'Public domain' },
    einstein: { file: 'Einstein_1921_by_F_Schmutzer_-_restoration.jpg', h: '3e', w: 2523, credit: 'Albert Einstein, 1921 — Ferdinand Schmutzer', license: 'Public domain' },
    // machine
    watt: { file: 'Maquina_vapor_Watt_ETSIIM.jpg', h: '9e', w: 1024, credit: 'Watt steam engine — Nicolás Pérez', license: 'CC BY-SA 3.0' },
    bridge: { file: 'Brooklyn_Bridge_Postdlf.jpg', h: 'f0', w: 2377, credit: 'Brooklyn Bridge, 1883 — Postdlf', license: 'CC BY-SA 3.0' },
    tesla: { file: 'Nikola_Tesla,_with_his_equipment_Wellcome_M0014782.jpg', h: '20', w: 7441, credit: 'Tesla, Colorado Springs, 1899 — Wellcome Collection', license: 'Public domain' },
    edison: { file: 'Edison_in_his_NJ_laboratory_1901.jpg', h: '42', w: 960, credit: 'Edison in his laboratory, 1901', license: 'Public domain' },
    ford: { file: 'Ford_assembly_line_-_1913.jpg', h: '29', w: 3916, credit: 'Ford assembly line, 1913', license: 'Public domain' },
    flight: { file: 'Wright_First_Flight_1903Dec17_(full_restore_115).jpg', h: 'fe', w: 7162, credit: 'First flight, Kitty Hawk, 17 Dec 1903 — John T. Daniels', license: 'Public domain' },
    x1: { file: 'Bell_X-1_46-062_(in_flight).jpg', h: '50', w: 2969, credit: 'Bell X-1 — first supersonic flight, 1947 — NASA', license: 'Public domain' },
    // atom
    trinity: { file: 'Trinity_shot_color.jpg', h: '8d', w: 2426, credit: 'Trinity, 16 July 1945 — Jack Aeby / LANL', license: 'Public domain' },
    trinityB: { file: 'Trinity_Detonation_T&B.jpg', h: 'fc', w: 1624, credit: 'Trinity, 0.016 s — Berlyn Brixner / LANL', license: 'Public domain' },
    vaccine: { file: 'Smallpox_vaccine.jpg', h: '95', w: 3032, credit: 'Smallpox vaccine — CDC / James Gathany', license: 'Public domain' },
    transistor: { file: 'Bardeen_Shockley_Brattain_1948.JPG', h: 'c2', w: 3073, credit: 'Bardeen, Shockley & Brattain — Bell Labs, 1948', license: 'Public domain' },
    eniac: { file: 'Eniac.jpg', h: '4e', w: 1340, credit: 'ENIAC, 1946 — U.S. Army', license: 'Public domain' },
    higgs: { file: 'CMS_Higgs-event.jpg', h: '1c', w: 1104, credit: 'Simulated Higgs event, CMS — CERN', license: 'Public domain' },
    // space
    sputnik: { file: 'Sputnik_asm.jpg', h: 'be', w: 1094, credit: 'Sputnik 1, 1957 — NASA', license: 'Public domain' },
    gagarin: { file: 'Yuri_Gagarin_(1961)_-_Restoration.jpg', h: 'e5', w: 2213, credit: 'Yuri Gagarin, 1961', license: 'Public domain' },
    launch: { file: 'Apollo_11_Launch_-_GPN-2000-000630.jpg', h: '16', w: 2400, credit: 'Apollo 11 lifts off — 16 July 1969 — NASA', license: 'Public domain' },
    earthrise: { file: 'NASA-Apollo8-Dec24-Earthrise.jpg', h: 'a8', w: 2400, credit: 'Earthrise — Apollo 8, 24 Dec 1968 — NASA / Bill Anders', license: 'Public domain' },
    eagle: { file: 'Apollo_11_Lunar_Module_Eagle_in_landing_configuration_in_lunar_orbit_from_the_Command_and_Service_Module_Columbia.jpg', h: 'd5', w: 2480, credit: 'Eagle in lunar orbit — Apollo 11 — NASA', license: 'Public domain' },
    armstrong: { file: 'Neil_Armstrong_pose.jpg', h: '0d', w: 3300, credit: 'Neil Armstrong, 1969 — NASA', license: 'Public domain' },
    aldrin: { file: 'Aldrin_Apollo_11_original.jpg', h: '98', w: 3912, credit: 'Buzz Aldrin on the Moon — NASA / Neil Armstrong', license: 'Public domain' },
    boot: { file: 'Apollo_11_bootprint.jpg', h: '89', w: 2349, credit: 'Bootprint, Sea of Tranquility — NASA / Buzz Aldrin', license: 'Public domain' },
    cernan: { file: 'Apollo_17_Cernan_on_moon.jpg', h: '2f', w: 3904, credit: 'Gene Cernan, Apollo 17 — the last man on the Moon, 1972 — NASA', license: 'Public domain' },
    shuttle: { file: 'Space_Shuttle_Columbia_launching.jpg', h: '41', w: 6084, credit: 'Columbia, STS-1, 12 April 1981 — NASA', license: 'Public domain' },
    hubble: { file: 'HST-SM4.jpeg', h: '3f', w: 2022, credit: 'Hubble Space Telescope, 2009 — NASA', license: 'Public domain' },
    iss: { file: 'ISS-56_International_Space_Station_fly-around_(05).jpg', h: 'ff', w: 6048, credit: 'International Space Station, 2018 — NASA', license: 'Public domain' },
    curiosity: { file: "Curiosity_Self-Portrait_at_'Big_Sky'_Drilling_Site.jpg", h: 'f3', w: 4483, credit: 'Curiosity self-portrait on Mars, 2015 — NASA / JPL-Caltech', license: 'Public domain' },
    falcon: { file: 'Falcon_Heavy_Side_Boosters_landing_on_LZ1_and_LZ2_-_2018_(25254688767).jpg', h: '52', w: 3000, credit: 'Falcon Heavy boosters landing, 2018 — SpaceX', license: 'CC0' },
    pbd: { file: 'Pale_Blue_Dot.png', h: '73', w: 453, credit: 'Pale Blue Dot — Voyager 1, 1990 — NASA / JPL', license: 'Public domain' },
    // network / seeing
    web: { file: 'First_Web_Server.jpg', h: 'd1', w: 2048, credit: 'The first web server, CERN, 1990 — Coolcaesar', license: 'CC BY-SA 3.0' },
    netmap: { file: 'Internet_map_4096.png', h: 'c3', w: 4096, credit: 'Map of the Internet — Matt Britt / The Opte Project', license: 'CC BY 2.5' },
    bh: { file: 'Black_hole_-_Messier_87_crop_max_res.jpg', h: '4f', w: 4320, credit: 'M87* — Event Horizon Telescope, 2019', license: 'CC BY 4.0' },
    bhAnat: { file: 'Anatomy_of_a_Black_Hole.jpg', h: '82', w: 4992, credit: 'Anatomy of a black hole — ESO', license: 'CC BY 4.0' },
    webb: { file: "Webb's_First_Deep_Field.jpg", h: 'bf', w: 4537, credit: "Webb's First Deep Field, 2022 — NASA / ESA / CSA / STScI", license: 'Public domain' },
    earth17: { file: 'The_Earth_seen_from_Apollo_17.jpg', h: '97', w: 3000, credit: 'Earth from Apollo 17, 1972 — NASA', license: 'Public domain' }
  };

  /* ------------------------------------------------------------------
     Muted archival clips (YouTube, official channels). `start` is a
     seek position in seconds; every clip has a still as fallback.
     ------------------------------------------------------------------ */
  const CLIPS = {
    wright: { yt: 'FnML3I-yYyo', start: 24, fallback: 'flight' },
    apollo: { yt: 'pJbtYs0oZfQ', start: 95, fallback: 'aldrin' },
    earthrise: { yt: 'dE-vOscpiNc', start: 40, fallback: 'earthrise' },
    falcon: { yt: 'wbSwFU6tY1c', start: 1850, fallback: 'falcon' },
    mars: { yt: '4czjS9h4Fpg', start: 150, fallback: 'curiosity' },
    issLive: { yt: 'uwXgcTc8oY8', start: 0, fallback: 'iss' },
    starship: { yt: 'hI9HQfCAw64', start: 30, fallback: 'falcon' },
    webb: { yt: 'nmMRMIE3MGw', start: 1290, fallback: 'webb' },
    blackhole: { yt: 'Dr20f19czeE', start: 5, fallback: 'bh' },
    higgs: { yt: 'm-dNqCbRc_Y', start: 10, fallback: 'higgs' },
    fusion: { yt: '6Eh2rZAD6uc', start: 20, fallback: 'trinity' }
  };

  /* ------------------------------------------------------------------
     Chapters. `mode` is the generative background (js/cosmos.js) that
     shows through pure-text shots and when a still cannot be loaded.
     `years` drives the HUD odometer across the chapter (negative = BCE).
     `energy` 0..1 scales the camera shake / pulse intensity.
     Shot beats per chapter should sum to bars × 4.
     ------------------------------------------------------------------ */
  const Y = (n) => n; // readability
  const CHAPTERS = [
    {
      id: 'open', kind: 'open', mode: 'stars', bars: 4, energy: 0.1, years: [-13.8e9, -13.8e9],
      label: 'HUMANITY — THE FILM', title: '', code: 'P-000',
      lines: [
        [0, '// 13,800,000,000 years'],
        [3, '// one species that looked up'],
        [6, '// RUNTIME seconds. cut to the beat.'],
        [9, '// headphones on. just watch.']
      ],
      shots: [
        [{ mode: 'stars' }, 8, 'fade'],
        ['milky', 4, 'fade', 'The Milky Way — 100 billion suns, one of which is ours'],
        ['milky', 4, 'cut']
      ]
    },
    {
      id: 'title', kind: 'title', mode: 'galaxy', bars: 4, energy: 0.7, years: [-13.8e9, -4.5e9],
      label: 'A MONUMENT TO WHAT WE HAVE DONE', title: 'HUMANITY', tagline: 'Starstuff that learned to wonder, then learned to build.', code: 'P-001',
      shots: [
        ['andromeda', 4, 'drop'],
        ['xdf', 2, 'punch', 'Hubble eXtreme Deep Field — 5,500 galaxies in a speck of sky'],
        ['pillars', 2, 'zoomblur', 'Pillars of Creation — where stars are born'],
        ['crab', 2, 'glitch', 'Crab Nebula — a star that exploded in 1054'],
        ['carina', 2, 'whip', 'Carina Nebula — 7,500 light-years away'],
        ['eclipse', 1, 'flash', 'Total eclipse, 1999'],
        ['marble', 1, 'invert'],
        ['eastern', 1, 'cut'],
        ['marble', 1, 'punch', 'Earth. Home.']
      ]
    },
    {
      id: 'fire', kind: 'chapter', num: 1, mode: 'embers', bars: 6, energy: 0.5, years: [-1.5e6, -3000],
      label: 'CHAPTER 01', title: 'FIRE & ART', when: '1,500,000 – 5,000 years ago', code: 'P-002',
      line: 'Warmth. Light. Cooked food. Then a hand on a cave wall: the mind turns outward.',
      shots: [
        [{ mode: 'embers' }, 4, 'burn', '', 'FIRE'],
        ['hands', 4, 'iris', 'Cueva de las Manos — hands stencilled 9,000 years ago', 'HANDS'],
        ['lascaux', 4, 'whip', 'Lascaux — painted by torchlight, 17,000 years ago', 'ART'],
        ['hands', 1, 'cut'], ['lascaux', 1, 'cut'], ['hands', 0.5, 'cut'], ['lascaux', 0.5, 'cut'], ['hands', 0.5, 'cut'], ['lascaux', 0.5, 'glitch'],
        ['stonehenge', 4, 'rise', 'Stonehenge — 3000 BCE, aligned to the solstice', 'SKY'],
        ['stonehenge', 4, 'cut']
      ]
    },
    {
      id: 'word', kind: 'chapter', num: 2, mode: 'ink', bars: 6, energy: 0.55, years: [-3100, 1455],
      label: 'CHAPTER 02', title: 'THE WORD', when: '3100 BCE – 1455 CE', code: 'P-003',
      line: 'Memory escapes the skull. Ideas outlive the people who had them.',
      shots: [
        ['cune', 4, 'slice', 'Cuneiform — a barley account, Sumer, c. 3100 BCE', 'WRITE'],
        ['giza', 4, 'zoomout', 'Giza — 2560 BCE, 2.3 million blocks', 'BUILD'],
        ['parthenon', 2, 'whipL', 'The Parthenon — 438 BCE'],
        ['colosseum', 2, 'whip', 'The Colosseum — 80 CE'],
        ['rosetta', 3, 'shutter', 'The Rosetta Stone — one decree, three scripts', 'READ'],
        ['rosetta', 1, 'invert'],
        ['hokusai', 4, 'wipe', 'Hokusai — The Great Wave, c. 1831', 'SEE'],
        ['press', 2, 'punch', 'The press — Mainz, 1440s'],
        ['gutenberg', 1, 'cut', 'Gutenberg Bible, 1455 — ideas become cheap'],
        ['press', 0.5, 'cut'], ['gutenberg', 0.5, 'flicker', '', 'PRINT']
      ]
    },
    {
      id: 'reason', kind: 'chapter', num: 3, mode: 'orbit', bars: 6, energy: 0.6, years: [1490, 1921],
      label: 'CHAPTER 03', title: 'REASON', when: '1490 – 1921', code: 'P-004',
      line: 'The universe becomes calculable.',
      shots: [
        ['vitruv', 4, 'iris', 'Leonardo — Vitruvian Man, c. 1490', 'MEASURE'],
        ['galileo', 4, 'spin', 'Galileo — the Moon has mountains, 1610', 'LOOK'],
        ['newton', 2, 'punch', 'Newton — William Blake, 1795'],
        ['principia', 2, 'slice', 'Principia Mathematica, 1687 — F = ma', 'F = ma'],
        ['curie', 4, 'whipL', 'Marie Curie — two Nobel Prizes, two sciences', 'RADIUM'],
        ['einstein', 4, 'zoomout', 'Einstein, 1921', 'E = mc²'],
        ['einstein', 1, 'glitch'], ['galileo', 0.5, 'cut'], ['newton', 0.5, 'cut'], ['curie', 1, 'invert'],
        ['einstein', 1, 'punch']
      ]
    },
    {
      id: 'machine', kind: 'chapter', num: 4, mode: 'gears', bars: 6, energy: 0.8, years: [1776, 1947],
      label: 'CHAPTER 04', title: 'THE MACHINE', when: '1776 – 1947', code: 'P-005',
      line: 'Steam, steel, current — and twelve seconds of flight.',
      shots: [
        ['watt', 2, 'drop', 'Watt steam engine, 1776 — the world starts to move', 'STEAM'],
        ['bridge', 2, 'rise', 'Brooklyn Bridge, 1883 — steel learns to span', 'STEEL'],
        ['tesla', 4, 'flash', 'Tesla at Colorado Springs, 1899 — millions of volts', 'VOLT'],
        ['edison', 1, 'cut', 'Edison, 1901'], ['tesla', 1, 'glitch'],
        ['ford', 2, 'whip', 'Ford assembly line, 1913 — the world speeds up', 'SPEED'],
        [CLIPS.wright, 8, 'punch', 'Kitty Hawk, 17 December 1903 — 12 seconds, 120 feet', 'FLY'],
        ['flight', 2, 'zoomin'],
        ['x1', 1.5, 'zoomblur', 'Bell X-1 — faster than sound, 1947', 'MACH 1'],
        ['x1', 0.5, 'invert']
      ]
    },
    {
      id: 'atom', kind: 'chapter', num: 5, mode: 'atom', bars: 6, energy: 0.9, years: [1945, 2022],
      label: 'CHAPTER 05', title: 'THE ATOM', when: '1945 – 2022', code: 'P-006',
      line: 'We learn what everything is made of — and what that knowledge costs.',
      shots: [
        [{ mode: 'atom' }, 2, 'fade'],
        ['trinityB', 0.5, 'flash', 'Trinity, 16 July 1945 — 0.016 seconds after detonation'],
        [{ mode: 'atom' }, 0.5, 'invert'],
        ['trinityB', 0.5, 'cut'], [{ mode: 'atom' }, 0.5, 'cut'],
        ['trinity', 4, 'drop', 'Trinity — the first nuclear explosion', 'ATOM'],
        ['vaccine', 4, 'wipe', 'Smallpox — the first disease we erased, 1980', 'CURE'],
        ['transistor', 3, 'punch', 'The transistor — Bell Labs, 1947', 'SWITCH'],
        ['eniac', 1, 'cut', 'ENIAC, 1946 — 18,000 vacuum tubes'],
        ['eniac', 2, 'shutter', 'ENIAC, 1946 — 18,000 vacuum tubes', 'COMPUTE'],
        [CLIPS.higgs, 4, 'glitch', 'The Higgs boson — CERN, 4 July 2012', 'HIGGS'],
        [CLIPS.fusion, 2, 'burn', 'Fusion ignition — Lawrence Livermore, 5 December 2022', 'IGNITE']
      ]
    },
    {
      id: 'moon', kind: 'chapter', num: 6, mode: 'orbit', bars: 8, energy: 1, years: [1957, 1972],
      label: 'CHAPTER 06', title: 'LEAVING THE CRADLE', when: '1957 – 1972', code: 'P-007',
      line: 'Life leaves its cradle for the first time in four billion years.',
      shots: [
        ['sputnik', 2, 'spin', 'Sputnik 1 — 4 October 1957 — the first beep from orbit', 'ORBIT'],
        ['gagarin', 2, 'punch', 'Yuri Gagarin — 12 April 1961 — the first human in space', 'ПОЕХАЛИ!'],
        ['launch', 3, 'drop', 'Apollo 11 lifts off — 16 July 1969', 'LIFT'],
        ['launch', 0.5, 'punch'], ['launch', 0.5, 'punch'],
        [CLIPS.earthrise, 6, 'fade', 'Earthrise — Apollo 8, Christmas Eve 1968', 'HOME'],
        ['eagle', 2, 'whip', 'Eagle in lunar orbit — 20 July 1969'],
        [CLIPS.apollo, 8, 'glitch', '20 July 1969 — "That\'s one small step for a man…"', 'STEP'],
        ['armstrong', 1, 'cut', 'Neil Armstrong'], ['aldrin', 1, 'cut', 'Buzz Aldrin'],
        ['aldrin', 2, 'punch', 'Buzz Aldrin, photographed by Neil Armstrong'],
        ['boot', 2, 'zoomin', 'A bootprint that will last a million years', 'ONE'],
        ['cernan', 2, 'fall', 'Gene Cernan, Apollo 17, 1972 — the last footsteps, so far']
      ]
    },
    {
      id: 'network', kind: 'chapter', num: 7, mode: 'network', bars: 6, energy: 0.8, years: [1981, 2018],
      label: 'CHAPTER 07', title: 'THE NETWORK', when: '1981 – 2018', code: 'P-008',
      line: 'A nervous system for the species. A permanent address in orbit.',
      shots: [
        ['shuttle', 2, 'drop', 'Columbia — STS-1, 12 April 1981', 'REUSE'],
        ['web', 3, 'slice', 'The first web server — CERN, 1990. "DO NOT POWER DOWN!!"', 'WWW'],
        ['netmap', 1, 'glitch', 'A map of the Internet, 2005 — Opte Project'],
        ['netmap', 2, 'zoomout', 'A map of the Internet, 2005 — Opte Project', 'CONNECT'],
        ['pbd', 2, 'iris', 'Pale Blue Dot — Voyager 1 looks home from 6 billion km, 1990'],
        [CLIPS.issLive, 6, 'whip', 'Live from the International Space Station — crewed since 2000', 'LIVE'],
        ['iss', 2, 'punch', 'International Space Station — 25 years of continuous presence'],
        [CLIPS.falcon, 4, 'flash', 'Falcon Heavy — two boosters land together, 6 February 2018', 'LAND'],
        ['falcon', 1, 'glitch'], ['web', 0.5, 'cut'], ['netmap', 0.5, 'invert']
      ]
    },
    {
      id: 'universe', kind: 'chapter', num: 8, mode: 'galaxy', bars: 8, energy: 0.9, years: [1990, 2022],
      label: 'CHAPTER 08', title: 'SEEING THE UNIVERSE', when: '1990 – 2022', code: 'P-009',
      line: 'We photograph the unphotographable and read the first light.',
      shots: [
        ['hubble', 2, 'rise', 'Hubble — launched 24 April 1990', 'HUBBLE'],
        ['udf', 4, 'zoomout', 'Hubble Ultra Deep Field — 11 days staring at nothing', '10,000'],
        ['pillars', 2, 'whip', 'Pillars of Creation'],
        ['crab', 2, 'whipL', 'Crab Nebula'],
        [CLIPS.blackhole, 6, 'iris', 'M87* — the first image of a black hole, 10 April 2019', 'SEE'],
        ['bh', 1, 'invert'], ['bhAnat', 1, 'glitch', 'Anatomy of a black hole — ESO'],
        [CLIPS.mars, 6, 'punch', 'Perseverance touches down on Mars — 18 February 2021', 'MARS'],
        ['curiosity', 2, 'cut', 'Curiosity self-portrait — Mars, 2015'],
        [CLIPS.webb, 4, 'zoomblur', "Webb's First Deep Field — 12 July 2022, light 13 billion years old", 'FIRST LIGHT'],
        ['webb', 1, 'flicker'], ['marble', 1, 'flash', 'Home.']
      ]
    },
    {
      id: 'now', kind: 'finale', mode: 'warp', bars: 8, energy: 0.6, years: [2024, new Date().getFullYear()],
      label: 'CHAPTER 09', title: 'NOW', when: new Date().getFullYear(), code: 'P-010',
      line: 'You are here.',
      shots: [
        [CLIPS.starship, 8, 'glitch', 'Starship Flight 5 — a 71-metre booster caught out of the sky, 13 October 2024', 'CATCH'],
        ['earth17', 8, 'fade', 'Earth from Apollo 17 — everyone you have ever known is in this frame', 'YOU'],
        [{ mode: 'warp' }, 16, 'burn']
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

  void Y;
  return { TIMING, IMAGES, CLIPS, CHAPTERS, TAGS, PRELOAD_LINES };
})();
