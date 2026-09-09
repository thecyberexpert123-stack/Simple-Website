/* =====================================================================
   HUMANITY — data layer
   All content for the monument lives here: eras, milestones, galleries,
   numbers, voices and the cosmic calendar. Every video is an official or
   archival source (NASA, CERN, SpaceX, WHO, LLNL, DeepMind, Smithsonian,
   MIT, NFSA). Video IDs were verified against YouTube's oEmbed endpoint.
   ===================================================================== */

window.HUMANITY = (function () {
  'use strict';

  /* ------------------------------------------------------------------
     Cosmic calendar: 13.8 billion years compressed into one year.
     Positions are computed from `yearsAgo`, so they are exact.
  ------------------------------------------------------------------ */
  const UNIVERSE_AGE = 13.8e9;

  const cosmicEvents = [
    { yearsAgo: 13.8e9, title: 'The Big Bang', note: 'Space, time, matter and energy come into being.' },
    { yearsAgo: 13.6e9, title: 'First stars ignite', note: 'Hydrogen collapses; the cosmic dark ages end.' },
    { yearsAgo: 13.2e9, title: 'The Milky Way forms', note: 'Our galaxy assembles from smaller ones.' },
    { yearsAgo: 4.6e9, title: 'The Sun is born', note: 'A cloud of gas and stardust collapses.' },
    { yearsAgo: 4.54e9, title: 'Earth forms', note: 'Rock, iron and the remains of dead stars.' },
    { yearsAgo: 4.5e9, title: 'The Moon forms', note: 'A Mars-sized world strikes the young Earth.' },
    { yearsAgo: 3.8e9, title: 'Life begins', note: 'Self-replicating chemistry appears in the oceans.' },
    { yearsAgo: 2.4e9, title: 'Oxygen fills the air', note: 'Cyanobacteria reshape the planet\'s chemistry.' },
    { yearsAgo: 1.8e9, title: 'Complex cells', note: 'Cells with nuclei — the eukaryotes.' },
    { yearsAgo: 600e6, title: 'Multicellular life', note: 'Cells learn to cooperate.' },
    { yearsAgo: 540e6, title: 'Cambrian explosion', note: 'Eyes, shells, predators — animal life diversifies.' },
    { yearsAgo: 470e6, title: 'Plants colonise land', note: 'The continents turn green.' },
    { yearsAgo: 230e6, title: 'First dinosaurs', note: 'They will rule for 165 million years.' },
    { yearsAgo: 200e6, title: 'First mammals', note: 'Small, warm-blooded, nocturnal.' },
    { yearsAgo: 130e6, title: 'First flowers', note: 'Colour arrives.' },
    { yearsAgo: 66e6, title: 'Asteroid impact', note: 'The non-avian dinosaurs vanish. Mammals inherit the Earth.' },
    { yearsAgo: 7e6, title: 'Human and chimp lineages split', note: 'The long walk begins.' },
    { yearsAgo: 3.3e6, title: 'First stone tools', note: 'Hands begin to shape the world.' },
    { yearsAgo: 1.5e6, title: 'Control of fire', note: 'Warmth, light, cooked food, the campfire story.' },
    { yearsAgo: 300e3, title: 'Homo sapiens', note: 'Us.' },
    { yearsAgo: 45e3, title: 'Cave paintings', note: 'Art — the mind turns outward.' },
    { yearsAgo: 12e3, title: 'Agriculture', note: 'We stop wandering and start building.' },
    { yearsAgo: 5.2e3, title: 'Writing', note: 'Memory escapes the skull.' },
    { yearsAgo: 2.5e3, title: 'Philosophy, mathematics', note: 'Athens, Pataliputra, Luoyang.' },
    { yearsAgo: 585, title: 'The printing press', note: 'Ideas become cheap.' },
    { yearsAgo: 338, title: 'Newton\'s Principia', note: 'The universe becomes calculable.' },
    { yearsAgo: 57, title: 'Footprints on the Moon', note: 'Life leaves its cradle for the first time.' },
    { yearsAgo: 36, title: 'The World Wide Web', note: 'A nervous system for the species.' },
    { yearsAgo: 0, title: 'Now', note: 'You, reading this.' }
  ];

  /* ------------------------------------------------------------------
     The Journey: eras of human achievement.
     `scene` selects the particle-engine mode for the backdrop.
  ------------------------------------------------------------------ */
  const eras = [
    {
      id: 'fire',
      scene: 'embers',
      label: 'c. 1,500,000 years ago',
      title: 'Fire',
      lede: 'The first technology was a captured star.',
      text: 'Long before we were fully human, our ancestors learned to keep a flame alive. Fire cooked food, which fed larger brains. It kept the night at bay and gathered us in circles where the first stories were told. Every reactor, every engine, every rocket that followed is a descendant of that first tended ember.',
      facts: ['Cooking may have doubled the energy our ancestors could extract from food.', 'Hearths at Wonderwerk Cave, South Africa, are around one million years old.', 'Firelight extended the day — and social life — by hours.']
    },
    {
      id: 'word',
      scene: 'ink',
      label: 'c. 3200 BCE',
      title: 'The Written Word',
      lede: 'Memory escaped the skull.',
      text: 'In Sumer, accountants pressing reeds into wet clay invented something larger than accounting. Writing let a thought outlive the thinker. It let a farmer in one century argue with a philosopher in another. Every library, law, poem and line of code descends from those first wedge-shaped marks.',
      facts: ['Cuneiform, Egyptian hieroglyphs, Chinese characters and Mesoamerican scripts arose independently.', 'The Library of Alexandria may have held hundreds of thousands of scrolls.', 'Gutenberg\'s press (c. 1440) made Europe\'s book output explode from thousands to millions per year.']
    },
    {
      id: 'reason',
      scene: 'orbit',
      label: '1543 – 1687',
      title: 'The Age of Reason',
      lede: 'The universe became calculable.',
      text: 'Copernicus moved the Earth. Galileo pointed a telescope at Jupiter and saw moons that did not orbit us. Kepler found the ellipses. Then Newton, in a single book, showed that the apple and the Moon obey the same law. Humanity discovered that nature could be read — and that it was written in mathematics.',
      facts: ['Newton\'s Principia (1687) unified terrestrial and celestial mechanics.', 'The scientific method — hypothesis, experiment, publication — is itself an invention.', 'Within 300 years of the Principia, humans had used its laws to land on the Moon.']
    },
    {
      id: 'machine',
      scene: 'gears',
      label: '1712 – 1900',
      title: 'The Machine Age',
      lede: 'We taught fire to work.',
      text: 'Steam engines turned heat into motion. Railways compressed continents. Electricity — tamed by Faraday, Maxwell, Tesla and Edison — turned night into day and put power at the flick of a switch. For the first time in history, the average person\'s life began to get measurably, rapidly better.',
      facts: ['In 1800 roughly 90% of humanity lived in extreme poverty; today it is under 10%.', 'Electrification is regularly ranked the greatest engineering achievement of the 20th century.', 'The Haber–Bosch process (1909) now feeds around half the world\'s population.']
    },
    {
      id: 'medicine',
      scene: 'helix',
      label: '1796 – today',
      title: 'The Conquest of Disease',
      lede: 'We stopped burying most of our children.',
      text: 'Jenner\'s vaccine. Semmelweis and handwashing. Pasteur\'s germ theory. Fleming\'s penicillin. Salk\'s polio vaccine. The eradication of smallpox in 1980 — the only human disease ever wiped out entirely. In two centuries, global life expectancy rose from about 30 years to over 73, and the share of children dying before age five fell from over 40% to under 4%.',
      facts: ['Smallpox killed an estimated 300 million people in the 20th century alone. Since 1980: zero.', 'The structure of DNA (1953) and the Human Genome Project (2003) opened biology\'s source code.', 'CRISPR (2012) lets us edit that code; the first CRISPR cure was approved in 2023.'],
      video: { id: 'freX6WB8Cag', title: '40 years since smallpox eradication', source: 'World Health Organization' }
    },
    {
      id: 'flight',
      scene: 'wind',
      label: '1903',
      title: 'Flight',
      lede: 'Twelve seconds. One hundred and twenty feet.',
      text: 'On a cold December morning at Kitty Hawk, two bicycle mechanics from Ohio did what every human who ever watched a bird had dreamed of. Sixty-six years later — within a single human lifetime — we were walking on the Moon. No other species has ever accelerated like this.',
      facts: ['The Wright Flyer\'s first flight was shorter than a Boeing 747\'s wingspan.', 'Today around 100,000 flights carry roughly 12 million passengers every single day.', 'Charles Lindbergh crossed the Atlantic in 1927; Concorde did it in under 3 hours by 1976.'],
      video: { id: 'FnML3I-yYyo', title: 'Flying the Wright Flyer', source: 'Smithsonian National Air and Space Museum' }
    },
    {
      id: 'atom',
      scene: 'atom',
      label: '1897 – 2022',
      title: 'Into the Atom',
      lede: 'We found the machinery beneath reality.',
      text: 'Thomson found the electron. Rutherford found the nucleus. Einstein rewrote space and time. Bohr, Heisenberg, Schrödinger and Dirac built quantum mechanics — the strangest and most accurate theory humans have ever devised. In 2012 CERN found the Higgs boson; in 2022, a laboratory in California achieved fusion ignition, briefly lighting a star on Earth.',
      facts: ['Quantum electrodynamics agrees with experiment to about one part in a billion.', 'The Large Hadron Collider is a 27 km ring; its magnets are colder than deep space.', 'Every transistor, laser, MRI scanner and solar cell is applied quantum mechanics.'],
      video: { id: 'm-dNqCbRc_Y', title: 'Higgs boson — highlights of the discovery', source: 'CERN' }
    },
    {
      id: 'space',
      scene: 'warp',
      label: '1957 – 1969',
      title: 'Leaving the Cradle',
      lede: 'Life left its planet for the first time in four billion years.',
      text: 'Sputnik. Gagarin. Then, on 20 July 1969, 600 million people watched two humans step onto another world and come home. The Apollo program remains the furthest any living thing has travelled from Earth. We went, as Kennedy said, not because it was easy, but because it was hard.',
      facts: ['The Apollo Guidance Computer had about 4 KB of RAM.', 'Twelve humans have walked on the Moon. They brought back 382 kg of it.', 'Apollo 8\'s "Earthrise" photograph helped ignite the modern environmental movement.'],
      video: { id: 'pJbtYs0oZfQ', title: 'Apollo 11 Moonwalk — restored footage', source: 'NASA / NFSA' }
    },
    {
      id: 'network',
      scene: 'network',
      label: '1947 – 1989',
      title: 'The Thinking Machine',
      lede: 'We built a nervous system for the species.',
      text: 'The transistor (1947) shrank the room-sized computer to a fingernail. Moore\'s law turned that fingernail into a supercomputer. ARPANET connected machines; in 1989, at CERN, Tim Berners-Lee connected knowledge with the World Wide Web — and gave it away for free. Today more than five billion people carry the sum of human knowledge in their pockets.',
      facts: ['A modern phone chip contains tens of billions of transistors.', 'The first web page is still online at info.cern.ch.', 'Wikipedia — written by volunteers — is the largest encyclopedia ever assembled.'],
      video: { id: 'sSqZ_hJu9zA', title: 'A brief history of the World Wide Web', source: 'CERN' }
    },
    {
      id: 'cosmos',
      scene: 'galaxy',
      label: '1990 – today',
      title: 'Seeing the Universe',
      lede: 'We photographed the edge of time.',
      text: 'Hubble showed us a universe of a trillion galaxies. Voyager 1 crossed into interstellar space carrying a golden record of our music. LIGO heard two black holes collide over a billion light-years away. The Event Horizon Telescope photographed a black hole. And in 2022 the James Webb Space Telescope began to show us the first galaxies ever to form.',
      facts: ['Voyager 1 is the most distant human-made object — over 25 billion km away, still transmitting.', 'LIGO can measure a change in length smaller than 1/10,000th the width of a proton.', 'Webb\'s mirror is 6.5 m across and operates at –233 °C, 1.5 million km from Earth.'],
      video: { id: 'nmMRMIE3MGw', title: 'First images from the James Webb Space Telescope', source: 'NASA' }
    },
    {
      id: 'now',
      scene: 'bloom',
      label: '2012 – today',
      title: 'The Present Frontier',
      lede: 'The story is accelerating.',
      text: 'Reusable rockets land themselves. mRNA vaccines were designed within days of a virus being sequenced. AlphaFold solved a fifty-year-old problem in biology and predicted the structure of nearly every known protein. Artificial intelligence writes, reasons and discovers alongside us. Perseverance is caching rock on Mars for return to Earth, and a helicopter has flown in another world\'s sky.',
      facts: ['In October 2024 a 71-metre rocket booster was caught out of the air by its launch tower.', 'AlphaFold\'s 200 million protein structures are free to every scientist on Earth.', 'Global renewable capacity is now growing faster than any energy source in history.'],
      video: { id: 'hI9HQfCAw64', title: 'Starship Flight 5 — first booster catch', source: 'SpaceX' }
    }
  ];

  /* ------------------------------------------------------------------
     Galleries — six domains of achievement
  ------------------------------------------------------------------ */
  const galleries = [
    {
      id: 'cosmos',
      title: 'Cosmos',
      icon: '✦',
      accent: '#8ec5ff',
      tagline: 'Leaving Earth. Seeing everything.',
      items: [
        {
          year: 1969, title: 'Apollo 11', sub: 'First humans on another world',
          text: 'Neil Armstrong and Buzz Aldrin spent 21 hours on the lunar surface while Michael Collins orbited above. Around 600 million people — a fifth of humanity — watched live. It remains the furthest any human has ever travelled.',
          facts: ['Distance: 384,400 km', 'Crew: 3 · Support staff: ~400,000', 'Fuel at landing: ~25 seconds left'],
          video: { id: 'pJbtYs0oZfQ', title: 'Apollo 11 Moonwalk — restored footage', source: 'NASA / NFSA Australia' }
        },
        {
          year: 1968, title: 'Earthrise', sub: 'The photograph that changed how we see home',
          text: 'On Christmas Eve 1968, Apollo 8 astronaut Bill Anders photographed the Earth rising over the lunar horizon. "We came all this way to explore the Moon," he said, "and the most important thing is that we discovered the Earth."',
          facts: ['First crewed flight to leave Earth orbit', 'Camera: Hasselblad 500 EL, 70 mm film', 'Widely credited with inspiring Earth Day (1970)'],
          video: { id: 'dE-vOscpiNc', title: 'Earthrise — reconstructed from lunar orbiter data', source: 'NASA Goddard' }
        },
        {
          year: 1977, title: 'Voyager', sub: 'The furthest thing we have ever made',
          text: 'Two probes launched in 1977 toured Jupiter, Saturn, Uranus and Neptune, then kept going. Voyager 1 entered interstellar space in 2012. Each carries a Golden Record — greetings in 55 languages, Bach, Chuck Berry, a heartbeat — a message in a bottle for whoever finds it.',
          facts: ['Distance: > 25 billion km and counting', 'Signal travel time to Earth: ~23 hours', 'Power: plutonium, expected to last into the 2030s'],
          video: { id: 'D4m3BOtAaj0', title: 'Highlights from Voyager\'s 40th anniversary', source: 'NASA' }
        },
        {
          year: 2000, title: 'The International Space Station', sub: 'A quarter century of continuous human presence in orbit',
          text: 'Built by 15 nations, the ISS has been continuously crewed since 2 November 2000. It is the most expensive single object ever constructed and a living demonstration that former adversaries can build together — 400 km up, at 28,000 km/h.',
          facts: ['Orbits: ~16 per day', 'Mass: ~420 tonnes', 'Visited by 280+ people from 20+ countries'],
          video: { id: 'uwXgcTc8oY8', title: 'Live video from the International Space Station', source: 'NASA (live stream)' }
        },
        {
          year: 2015, title: 'Gravitational Waves', sub: 'Hearing the universe for the first time',
          text: 'A century after Einstein predicted them, LIGO detected ripples in spacetime from two black holes merging 1.3 billion years ago. The instruments measured a distortion thousands of times smaller than a proton. A new kind of astronomy was born.',
          facts: ['Detector arms: 4 km, in vacuum', 'Sensitivity: 1 part in 10²¹', 'Nobel Prize in Physics, 2017'],
          video: { id: 'B4XzLDM3Py8', title: 'LIGO detects gravitational waves', source: 'MIT' }
        },
        {
          year: 2019, title: 'The First Image of a Black Hole', sub: 'Photographing the unphotographable',
          text: 'Eight radio telescopes across the globe were synchronised into one Earth-sized instrument. The result: the shadow of the supermassive black hole at the heart of galaxy M87, 55 million light-years away and 6.5 billion times the mass of the Sun.',
          facts: ['Data: ~5 petabytes, shipped on hard drives', 'Resolution: reading a newspaper in New York from Paris', 'Team: 300+ scientists, 20 countries'],
          video: { id: 'Dr20f19czeE', title: 'First ever image of a black hole', source: 'European Commission / EHT' }
        },
        {
          year: 2021, title: 'Perseverance & Ingenuity', sub: 'A helicopter flies on another planet',
          text: 'Perseverance landed in Jezero Crater on its own, using terrain-relative navigation, and filmed its own descent. Weeks later Ingenuity became the first aircraft to fly on another world — in air 1% as dense as Earth\'s. It was designed for 5 flights and made 72.',
          facts: ['Landing: "seven minutes of terror", fully autonomous', 'Ingenuity rotor speed: 2,400 rpm', 'Samples cached for future return to Earth'],
          video: { id: '4czjS9h4Fpg', title: 'Perseverance descent and touchdown on Mars', source: 'NASA' }
        },
        {
          year: 2022, title: 'James Webb Space Telescope', sub: 'Seeing the first light in the universe',
          text: 'A 6.5-metre gold-coated mirror unfolded itself in deep space, 1.5 million km from Earth, cooled to –233 °C. Webb sees infrared light stretched by 13 billion years of cosmic expansion — the first galaxies, the atmospheres of alien worlds.',
          facts: ['344 single points of failure during deployment — all succeeded', 'Sunshield: the size of a tennis court', 'Mirror: 18 hexagonal beryllium segments'],
          video: { id: 'nmMRMIE3MGw', title: 'First images from Webb (official broadcast)', source: 'NASA' }
        }
      ]
    },
    {
      id: 'life',
      title: 'Life & Medicine',
      icon: '❋',
      accent: '#7ef0c2',
      tagline: 'Understanding the code. Rewriting fate.',
      items: [
        {
          year: 1796, title: 'Vaccination', sub: 'The idea that saved more lives than any other',
          text: 'Edward Jenner noticed milkmaids who caught cowpox never got smallpox. From that observation grew vaccination — a technology that, by WHO estimates, now prevents 3.5–5 million deaths every year.',
          facts: ['Smallpox: eradicated 1980', 'Polio: cases down 99.9% since 1988', 'Measles vaccines have averted ~60 million deaths since 2000']
        },
        {
          year: 1928, title: 'Antibiotics', sub: 'A mouldy dish in London',
          text: 'Alexander Fleming returned from holiday to find a fungus killing the bacteria in his petri dishes. Penicillin, mass-produced by 1944, turned a scratch, a birth or a routine surgery from a mortal gamble into a manageable event.',
          facts: ['Before antibiotics ~30% of pneumonia cases were fatal', 'Penicillin was scaled up using a mouldy cantaloupe from an Illinois market', 'Antibiotics added an estimated 20+ years to life expectancy']
        },
        {
          year: 1953, title: 'The Double Helix', sub: 'Life\'s instruction set revealed',
          text: 'Using Rosalind Franklin\'s X-ray images, Watson and Crick showed that DNA is a double helix — and that its structure explains how life copies itself. The entire biotechnology age begins here.',
          facts: ['Human genome: ~3.2 billion base pairs', 'You share ~60% of your genes with a banana', 'Every cell holds about 2 metres of DNA']
        },
        {
          year: 1980, title: 'Smallpox Eradicated', sub: 'The only human disease ever wiped from the Earth',
          text: 'A virus that killed 300 million people in the 20th century was hunted down village by village by a global campaign led by the WHO. On 8 May 1980, the World Health Assembly declared the world free of smallpox. Nothing like it has been achieved before or since.',
          facts: ['Last natural case: Somalia, 1977', 'Cost of the campaign: ~$300 million', 'Estimated lives saved since: 150–200 million'],
          video: { id: 'freX6WB8Cag', title: '40th anniversary of smallpox eradication', source: 'World Health Organization' }
        },
        {
          year: 2003, title: 'The Human Genome Project', sub: 'Reading the book of us',
          text: 'Thirteen years, 20 institutions, six countries, and $3 billion to read the first human genome. Today the same job takes a day and costs a few hundred dollars — a drop in cost faster than Moore\'s law.',
          facts: ['Genes: ~20,000 (far fewer than expected)', 'Cost per genome: $3 billion → ~$200', 'Data released free, daily, to the world']
        },
        {
          year: 2012, title: 'CRISPR', sub: 'The genome becomes editable',
          text: 'Jennifer Doudna and Emmanuelle Charpentier repurposed a bacterial immune system into precise molecular scissors. In 2023 the first CRISPR therapy was approved, curing sickle-cell disease. In 2025 a baby received a therapy custom-built for his mutation in six months.',
          facts: ['Nobel Prize in Chemistry, 2020', 'First approved CRISPR cure: Casgevy, 2023', 'Cuts DNA at a chosen 20-letter address'],
          video: { id: 'TdBAHexVYzc', title: 'How CRISPR lets us edit our DNA', source: 'TED — Jennifer Doudna' }
        },
        {
          year: 2020, title: 'mRNA Vaccines', sub: 'Designed in 48 hours, delivered to billions',
          text: 'Decades of unglamorous work by Katalin Karikó, Drew Weissman and others meant that when a new virus was sequenced in January 2020, a vaccine could be designed within days. By late 2021, billions of doses had been given — the fastest vaccine development in history.',
          facts: ['Sequence to design: ~2 days', 'Nobel Prize in Medicine, 2023', 'Estimated ~20 million lives saved in the first year']
        },
        {
          year: 2020, title: 'AlphaFold', sub: 'A fifty-year grand challenge, solved',
          text: 'Predicting how a protein folds from its sequence was one of biology\'s hardest open problems. DeepMind\'s AlphaFold solved it, then released predicted structures for essentially every known protein — 200 million of them — for free.',
          facts: ['Nobel Prize in Chemistry, 2024', 'Structures released: 200+ million', 'Used by 2+ million researchers'],
          video: { id: 'gg7WjuFs8F4', title: 'AlphaFold: the making of a scientific breakthrough', source: 'Google DeepMind' }
        }
      ]
    },
    {
      id: 'mind',
      title: 'Mind & Machines',
      icon: '◈',
      accent: '#f2c14e',
      tagline: 'Thought, externalised.',
      items: [
        {
          year: 1440, title: 'The Printing Press', sub: 'Ideas become cheap',
          text: 'Gutenberg\'s movable type dropped the cost of a book by roughly 300-fold. Literacy, the Reformation, the Scientific Revolution and the Enlightenment all rode on the back of the press.',
          facts: ['Books printed by 1500: ~20 million', 'European literacy 1500 → 1800: ~10% → ~50%', 'Gutenberg died in obscurity']
        },
        {
          year: 1687, title: 'Principia Mathematica', sub: 'The laws of motion and gravity',
          text: 'Newton showed that the same force pulling an apple to the ground keeps the Moon in orbit. Physics, engineering and the very notion of a lawful universe descend from this book.',
          facts: ['Written in 18 months', 'Invented calculus along the way', 'Still used to plot spacecraft trajectories']
        },
        {
          year: 1947, title: 'The Transistor', sub: 'The most manufactured object in history',
          text: 'Bardeen, Brattain and Shockley at Bell Labs created a solid-state switch. Roughly 13 sextillion have been made since — more than all the grains of sand on Earth\'s beaches. Every digital thing is built from them.',
          facts: ['Size today: a few nanometres', 'Chips per year: > 1 trillion', 'Nobel Prize in Physics, 1956']
        },
        {
          year: 1936, title: 'The Universal Machine', sub: 'Turing imagines the computer',
          text: 'Alan Turing proved that a single machine could, in principle, compute anything computable. A decade later ENIAC and its successors made the idea physical. Within one lifetime, computation went from thought-experiment to the substrate of civilisation.',
          facts: ['ENIAC: 18,000 vacuum tubes, 27 tonnes', 'Apollo Guidance Computer: 4 KB RAM', 'Your phone: ~100,000× more powerful than Apollo\'s']
        },
        {
          year: 1989, title: 'The World Wide Web', sub: '"This is for everyone"',
          text: 'Tim Berners-Lee proposed a hypertext system at CERN, built the first browser and server, and in 1993 CERN released the technology royalty-free. It is the largest information system ever created and it belongs to no one.',
          facts: ['Websites today: ~1 billion+', 'Internet users: 5.5 billion', 'First web page: info.cern.ch — still live'],
          video: { id: 'sSqZ_hJu9zA', title: 'A brief history of the World Wide Web', source: 'CERN' }
        },
        {
          year: 2007, title: 'The Smartphone', sub: 'A supercomputer in every pocket',
          text: 'A camera, a library, a telephone, a map of the world, a bank and a broadcast studio — in a slab of glass owned by more than half of humanity. No technology has ever spread so far, so fast.',
          facts: ['Smartphone users: ~5 billion', 'Time from 0 → 1 billion users: ~7 years', 'Most people on Earth first accessed the web on a phone']
        },
        {
          year: 2022, title: 'Generative AI', sub: 'Machines that speak, see, code and reason',
          text: 'Large language models trained on the written record of humanity can now converse, translate, write software, pass professional exams and assist in scientific discovery. Whatever comes next, a threshold has been crossed.',
          facts: ['ChatGPT reached 100 million users in 2 months', 'AI systems now design drugs, chips and materials', 'The field is moving faster than any previous technology']
        }
      ]
    },
    {
      id: 'energy',
      title: 'Energy & Matter',
      icon: '⚛',
      accent: '#ff9f6e',
      tagline: 'Taming the forces of nature.',
      items: [
        {
          year: 1831, title: 'Electromagnetism', sub: 'Faraday, Maxwell and the birth of the electric age',
          text: 'Faraday showed a moving magnet makes a current; Maxwell wrote four equations that unified electricity, magnetism and light. Generators, motors, radio, and eventually every screen you\'ve ever looked at, follow.',
          facts: ['Maxwell\'s equations predicted radio waves before anyone had seen them', 'Global electricity: ~30,000 TWh per year', '~91% of humanity now has electricity access']
        },
        {
          year: 1909, title: 'Haber–Bosch', sub: 'Bread from air',
          text: 'Pulling nitrogen from the atmosphere to make fertiliser is the reason the Earth can feed eight billion people. Roughly half the nitrogen in your body passed through a Haber–Bosch reactor.',
          facts: ['Feeds an estimated ~4 billion people', 'Uses ~1–2% of world energy', 'Nobel Prizes: 1918 (Haber), 1931 (Bosch)']
        },
        {
          year: 1905, title: 'Relativity', sub: 'E = mc²',
          text: 'Einstein\'s special and general relativity rewrote space, time, gravity and energy. GPS satellites must correct for both theories every day, or your map would drift by kilometres.',
          facts: ['GPS clock correction: ~38 microseconds/day', 'Predicted black holes, gravitational waves, the expanding universe', 'Confirmed by the 1919 eclipse expedition']
        },
        {
          year: 1954, title: 'The Solar Cell', sub: 'Electricity from sunlight',
          text: 'Bell Labs built the first practical silicon solar cell in 1954 at 6% efficiency and $1,800 per watt. Today panels exceed 22% and cost under $0.20 per watt — a 99.99% price drop that is reshaping the world\'s energy.',
          facts: ['Cost decline since 1976: ~99.8%', 'Solar is now the cheapest electricity in history in most of the world', 'Installed capacity doubles roughly every 3 years']
        },
        {
          year: 2012, title: 'The Higgs Boson', sub: 'Why anything has mass',
          text: 'Predicted in 1964, the Higgs field was confirmed in 2012 by 10,000 scientists using the largest machine ever built. The Standard Model of particle physics was complete.',
          facts: ['LHC circumference: 27 km', 'Collision energy: 13.6 TeV', 'Nobel Prize in Physics, 2013'],
          video: { id: 'm-dNqCbRc_Y', title: 'Higgs boson — highlights of the discovery', source: 'CERN' }
        },
        {
          year: 2022, title: 'Fusion Ignition', sub: 'A star, briefly, in a laboratory',
          text: 'On 5 December 2022, 192 lasers at the National Ignition Facility compressed a peppercorn-sized fuel pellet and, for the first time, a fusion reaction released more energy than the laser energy that triggered it.',
          facts: ['Laser energy in: 2.05 MJ · Fusion energy out: 3.15 MJ', 'Temperature: > 100 million °C', 'Six decades of work'],
          video: { id: '6Eh2rZAD6uc', title: 'What is fusion ignition?', source: 'Lawrence Livermore National Laboratory' }
        },
        {
          year: 2015, title: 'Reusable Rockets', sub: 'Landing a skyscraper on its tail',
          text: 'For sixty years, rockets were thrown away after one use. In December 2015 a Falcon 9 booster returned and landed upright. In 2024 a Super Heavy booster was caught by its own launch tower. The cost of reaching orbit has fallen by an order of magnitude.',
          facts: ['Falcon boosters reflown: 20+ times each', 'Falcon Heavy side boosters landed in sync, Feb 2018', 'Starship: the largest and most powerful rocket ever flown'],
          video: { id: 'wbSwFU6tY1c', title: 'Falcon Heavy test flight', source: 'SpaceX' }
        }
      ]
    },
    {
      id: 'society',
      title: 'Society & Rights',
      icon: '☉',
      accent: '#f28fb1',
      tagline: 'Achievements measured in dignity.',
      items: [
        {
          year: -1750, title: 'Written Law', sub: 'The Code of Hammurabi and the rule of rules',
          text: 'The idea that law should be written down, public and apply to rulers as well as ruled is among humanity\'s oldest and most important inventions. It is the foundation of every constitution since.',
          facts: ['Hammurabi\'s stele: 282 laws, carved in basalt', 'Magna Carta (1215): the king is not above the law', 'Today: 190+ national constitutions']
        },
        {
          year: -508, title: 'Democracy', sub: 'Rule by the people',
          text: 'Cleisthenes\' reforms in Athens made ordinary citizens the sovereign. Flawed and exclusionary at first, the idea has proven the most resilient political technology ever devised. Today more than half of humanity lives under some form of elected government.',
          facts: ['Athens: ~30,000 eligible citizens voted directly', 'Universal suffrage: New Zealand first, 1893', 'India: the largest election in history, ~970 million voters (2024)']
        },
        {
          year: 1833, title: 'The Abolition of Slavery', sub: 'An institution as old as civilisation, ended',
          text: 'For most of history, slavery was unquestioned. In little more than a century — driven by the enslaved themselves, abolitionists, and moral argument — it was outlawed across the world. Mauritania became the last country to criminalise it in 2007.',
          facts: ['Haiti: first successful slave revolution, 1804', 'UK Slavery Abolition Act: 1833', 'US 13th Amendment: 1865']
        },
        {
          year: 1948, title: 'The Universal Declaration of Human Rights', sub: '"All human beings are born free and equal"',
          text: 'Drafted in the ashes of the Second World War by a committee chaired by Eleanor Roosevelt, the UDHR was the first time humanity agreed, in writing, on the rights of every person. It is the most translated document in the world.',
          facts: ['Adopted: 10 December 1948, 48 votes to 0', 'Translations: 500+ languages', '30 articles that inspired 70+ human rights treaties']
        },
        {
          year: 1893, title: 'Women\'s Suffrage', sub: 'Half of humanity gains a voice',
          text: 'New Zealand granted women the vote in 1893; within a century nearly every country followed. The full participation of women in education, science and government is among the largest expansions of human capability in history.',
          facts: ['Global female literacy 1970 → today: ~55% → ~84%', 'Women now earn the majority of university degrees in most countries', 'Nobel laureates: Curie (twice), Doudna, Charpentier, Karikó…']
        },
        {
          year: 1990, title: 'The Great Escape from Poverty', sub: 'The quietest, biggest achievement',
          text: 'In 1990, 38% of humanity lived in extreme poverty. By 2019 it was under 9% — over a billion people lifted out in a single generation, largely in Asia. Child mortality, hunger and illiteracy fell alongside it.',
          facts: ['Extreme poverty 1820 → today: ~80% → <10%', 'Child mortality 1800 → today: 43% → 3.7%', 'Global literacy: 12% (1820) → 87% (today)']
        }
      ]
    },
    {
      id: 'culture',
      title: 'Art & Imagination',
      icon: '♫',
      accent: '#c7a4ff',
      tagline: 'The reason we bothered.',
      items: [
        {
          year: -43000, title: 'Cave Painting', sub: 'The first time a mind turned outward',
          text: 'In Sulawesi, Chauvet and Lascaux, humans painted animals, hands and hunts by torchlight. Tens of thousands of years later, the paintings still move us. Art may be the first evidence of a mind that could imagine what was not there.',
          facts: ['Oldest known figurative art: ~51,000 years, Indonesia', 'Chauvet: 36,000 years old, discovered 1994', 'Pigments: ochre, charcoal, manganese']
        },
        {
          year: -800, title: 'Epic Poetry', sub: 'Homer, the Mahabharata, Gilgamesh',
          text: 'Before writing was common, humanity stored its wisdom in verse — tens of thousands of lines memorised and sung. Gilgamesh, the oldest surviving epic, is about a king who learns he cannot escape death and decides to build something that lasts instead.',
          facts: ['Mahabharata: ~1.8 million words', 'Gilgamesh: ~4,000 years old', 'Homer\'s epics were sung for centuries before being written']
        },
        {
          year: 1503, title: 'The Renaissance', sub: 'Leonardo, Michelangelo, and the rebirth of wonder',
          text: 'In Florence, artists became scientists and scientists became artists. Leonardo dissected corpses to paint better hands and sketched helicopters four centuries early. Perspective, anatomy and observation entered art — and never left.',
          facts: ['Leonardo\'s notebooks: ~7,000 surviving pages', 'Sistine Chapel ceiling: 4 years, ~500 m²', 'Brunelleschi\'s dome: still the largest brick dome ever built']
        },
        {
          year: 1824, title: 'The Ninth Symphony', sub: 'Written by a man who could not hear it',
          text: 'Beethoven was profoundly deaf when he composed the Ninth. At its premiere he had to be turned around to see the audience applauding. Its final movement — "Ode to Joy" — is the anthem of the European Union and was etched onto the Voyager Golden Record.',
          facts: ['Duration: ~70 minutes', 'First symphony to use a choir', 'The CD was reportedly sized to fit it']
        },
        {
          year: 1895, title: 'Cinema', sub: 'Dreams, projected',
          text: 'The Lumière brothers\' first public screening lasted about 50 seconds. Within a century film had become the defining art form of the modern age — a shared dream shown to billions.',
          facts: ['First screening: 28 December 1895, Paris', 'Films now produced per year: ~10,000+', 'Cinema is the youngest of the major art forms']
        },
        {
          year: 1977, title: 'The Golden Record', sub: 'Humanity\'s message to the stars',
          text: 'Aboard both Voyagers is a gold-plated copper record carrying 115 images, greetings in 55 languages, whale song, a kiss, a heartbeat, Bach, Beethoven, Blind Willie Johnson and Chuck Berry. It will outlast the Earth itself.',
          facts: ['Expected lifetime: > 1 billion years', 'Curated by Carl Sagan and Ann Druyan', 'Will pass within 1.6 light-years of a star in ~40,000 years'],
          video: { id: 'GO5FwsblpT8', title: 'Pale Blue Dot', source: 'Carl Sagan (official)' }
        }
      ]
    }
  ];

  /* ------------------------------------------------------------------
     Living numbers — how life actually changed
     Sources: Our World in Data, UN WPP 2024, WHO, World Bank, ITU.
  ------------------------------------------------------------------ */
  const numbers = [
    { label: 'Global life expectancy', from: 29, to: 73, unit: ' years', fromLabel: '1800', toLabel: 'today', note: 'More than doubled in two centuries.' },
    { label: 'Children dying before age five', from: 43, to: 3.7, unit: '%', decimals: 1, fromLabel: '1800', toLabel: 'today', invert: true, note: 'From nearly half to under one in twenty-five.' },
    { label: 'Humanity in extreme poverty', from: 80, to: 9, unit: '%', fromLabel: '1820', toLabel: 'today', invert: true, note: 'Over a billion people escaped poverty since 1990 alone.' },
    { label: 'Adults who can read', from: 12, to: 87, unit: '%', fromLabel: '1820', toLabel: 'today', note: 'Literacy is the default now, not the exception.' },
    { label: 'People with electricity', from: 0, to: 91, unit: '%', fromLabel: '1880', toLabel: 'today', note: 'Light at the flick of a switch, for nine in ten humans.' },
    { label: 'People online', from: 0, to: 5.5, unit: ' billion', decimals: 1, fromLabel: '1990', toLabel: 'today', note: 'Two-thirds of the species, connected.' },
    { label: 'Deaths from smallpox per year', from: 2000000, to: 0, unit: '', fromLabel: '1960s', toLabel: 'since 1980', invert: true, big: true, note: 'The only human disease ever eradicated.' },
    { label: 'Humans who have been to space', from: 0, to: 700, unit: '+', fromLabel: '1960', toLabel: 'today', note: 'From 12 nations at first, now more than 40.' }
  ];

  /* ------------------------------------------------------------------
     Voices
  ------------------------------------------------------------------ */
  const voices = [
    { quote: 'Look again at that dot. That\'s here. That\'s home. That\'s us. On it everyone you love, everyone you know, everyone you ever heard of, every human being who ever was, lived out their lives.', who: 'Carl Sagan', role: 'Pale Blue Dot, 1994', video: { id: 'GO5FwsblpT8', title: 'Pale Blue Dot', source: 'Carl Sagan (official)' } },
    { quote: 'That\'s one small step for man, one giant leap for mankind.', who: 'Neil Armstrong', role: 'Sea of Tranquility, 20 July 1969' },
    { quote: 'Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less.', who: 'Marie Curie', role: 'Two Nobel Prizes — Physics 1903, Chemistry 1911' },
    { quote: 'We choose to go to the Moon in this decade and do the other things, not because they are easy, but because they are hard.', who: 'John F. Kennedy', role: 'Rice University, 1962' },
    { quote: 'If I have seen further, it is by standing on the shoulders of giants.', who: 'Isaac Newton', role: 'Letter to Robert Hooke, 1675' },
    { quote: 'It always seems impossible until it\'s done.', who: 'Nelson Mandela', role: 'President of South Africa, 1994–1999' },
    { quote: 'This is for everyone.', who: 'Tim Berners-Lee', role: 'Inventor of the World Wide Web, London 2012' },
    { quote: 'Somewhere, something incredible is waiting to be known.', who: 'Carl Sagan', role: 'Astronomer' },
    { quote: 'The important thing is not to stop questioning. Curiosity has its own reason for existing.', who: 'Albert Einstein', role: 'Physicist' },
    { quote: 'We are the local embodiment of a Cosmos grown to self-awareness. We have begun to contemplate our origins: starstuff pondering the stars.', who: 'Carl Sagan', role: 'Cosmos, 1980' }
  ];

  /* ------------------------------------------------------------------
     Milestones for the "Your place in the story" section
  ------------------------------------------------------------------ */
  const personalMilestones = [
    { year: 1953, label: 'the structure of DNA was discovered' },
    { year: 1957, label: 'the first satellite reached orbit' },
    { year: 1961, label: 'the first human flew in space' },
    { year: 1969, label: 'humans first walked on the Moon' },
    { year: 1977, label: 'the Voyagers left Earth' },
    { year: 1980, label: 'smallpox was eradicated' },
    { year: 1989, label: 'the World Wide Web was invented' },
    { year: 1990, label: 'Hubble opened its eye' },
    { year: 2000, label: 'humans began living continuously in orbit' },
    { year: 2003, label: 'the human genome was sequenced' },
    { year: 2007, label: 'the smartphone arrived' },
    { year: 2012, label: 'the Higgs boson was found and CRISPR was invented' },
    { year: 2015, label: 'gravitational waves were heard and a rocket landed itself' },
    { year: 2019, label: 'a black hole was photographed' },
    { year: 2020, label: 'mRNA vaccines were deployed and AlphaFold solved protein folding' },
    { year: 2021, label: 'a helicopter flew on Mars' },
    { year: 2022, label: 'Webb saw first light and fusion ignition was achieved' },
    { year: 2024, label: 'a rocket booster was caught out of the sky' }
  ];

  /* ------------------------------------------------------------------
     Live counters — anchors & rates (approximate, clearly labelled)
     Population: UN WPP 2024 mid-2025 estimate ≈ 8.23 bn, ~+70 M/yr.
     Voyager 1: ≈ 24.9 bn km on 2025-01-01, receding ≈ 16.9 km/s (heliocentric).
     Apollo 11 first step: 1969-07-21 02:56:15 UTC.
     ISS: crewed continuously since 2000-11-02, ≈ 15.5 orbits/day.
  ------------------------------------------------------------------ */
  const live = {
    population: { anchor: Date.UTC(2025, 6, 1), value: 8.231e9, perSecond: 2.25 },
    voyager1: { anchor: Date.UTC(2025, 0, 1), km: 24.9e9, kmPerSecond: 16.9 },
    firstStep: Date.UTC(1969, 6, 21, 2, 56, 15),
    issCrewedSince: Date.UTC(2000, 10, 2),
    issOrbitsPerDay: 15.5,
    birthsPerSecond: 4.2
  };

  return { UNIVERSE_AGE, cosmicEvents, eras, galleries, numbers, voices, personalMilestones, live };
})();
