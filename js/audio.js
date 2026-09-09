/* =====================================================================
   HUMANITY — audio.js
   A generative ambient score built entirely with the Web Audio API —
   no audio files, no downloads. A slow, evolving pad in D major with
   shimmering partials, a sub drone, filtered noise "wind", and sparse
   bell tones. Each section shifts the harmony slightly.
   ===================================================================== */

window.Ambient = (function () {
  'use strict';

  let ctx = null, master = null, padGain = null, noiseGain = null, bellGain = null;
  let voices = [], lfo = null, enabled = false, bellTimer = null, currentChord = 0;

  // Chords (Hz). Warm, open voicings. D major → Bm → G → A.
  const CHORDS = [
    [73.42, 110.0, 146.83, 220.0, 293.66, 369.99],      // D  (D2 A2 D3 A3 D4 F#4)
    [61.74, 92.50, 123.47, 185.0, 246.94, 293.66],      // Bm (B1 F#2 B2 F#3 B3 D4)
    [49.00, 98.00, 146.83, 196.0, 246.94, 293.66],      // G  (G1 G2 D3 G3 B3 D4)
    [55.00, 110.0, 164.81, 220.0, 277.18, 329.63]       // A  (A1 A2 E3 A3 C#4 E4)
  ];
  // Bell scale (D major pentatonic, high)
  const BELLS = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51];

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.ratio.value = 4; comp.attack.value = 0.02; comp.release.value = 0.4;
    master.connect(comp).connect(ctx.destination);

    // reverb via feedback delays (cheap, no IR needed)
    const rev = ctx.createGain(); rev.gain.value = 0.55;
    const d1 = ctx.createDelay(2); d1.delayTime.value = 0.31;
    const d2 = ctx.createDelay(2); d2.delayTime.value = 0.47;
    const fb1 = ctx.createGain(); fb1.gain.value = 0.52;
    const fb2 = ctx.createGain(); fb2.gain.value = 0.48;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    rev.connect(d1); d1.connect(fb1); fb1.connect(lp); lp.connect(d1);
    rev.connect(d2); d2.connect(fb2); fb2.connect(d2);
    d1.connect(master); d2.connect(master);

    // pad
    padGain = ctx.createGain(); padGain.gain.value = 0.9;
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.Q.value = 0.6;
    padGain.connect(padFilter); padFilter.connect(master); padFilter.connect(rev);

    lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 350;
    lfo.connect(lfoGain).connect(padFilter.frequency); lfo.start();

    CHORDS[0].forEach((f, i) => {
      const v = { oscs: [], gain: ctx.createGain() };
      v.gain.gain.value = i === 0 ? 0.16 : 0.09 / Math.sqrt(i + 1);
      [-0.25, 0, 0.25].forEach((det, j) => {
        const o = ctx.createOscillator();
        o.type = j === 1 ? 'sine' : 'triangle';
        o.frequency.value = f; o.detune.value = det * 10 + (Math.random() - 0.5) * 4;
        o.connect(v.gain); o.start(); v.oscs.push(o);
      });
      v.gain.connect(padGain); voices.push(v);
    });

    // wind (filtered noise)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {           // pink-ish noise
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.08;
    }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 420; nf.Q.value = 0.7;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0.35;
    const nlfo = ctx.createOscillator(); nlfo.frequency.value = 0.035;
    const nlfoG = ctx.createGain(); nlfoG.gain.value = 260;
    nlfo.connect(nlfoG).connect(nf.frequency); nlfo.start();
    noise.connect(nf).connect(noiseGain).connect(master); noiseGain.connect(rev); noise.start();

    // bells
    bellGain = ctx.createGain(); bellGain.gain.value = 0.5; bellGain.connect(rev); bellGain.connect(master);
    scheduleBell();
  }

  function bell(freq, when) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2.756; // inharmonic partial → bell-like
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.08, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 6);
    o.connect(g); o2.connect(g2).connect(g); g.connect(bellGain);
    o.start(when); o2.start(when); o.stop(when + 6.2); o2.stop(when + 6.2);
  }
  function scheduleBell() {
    if (!ctx) return;
    const gap = 5 + Math.random() * 11;
    bellTimer = setTimeout(() => {
      if (enabled) bell(BELLS[Math.floor(Math.random() * BELLS.length)] * (Math.random() < 0.3 ? 0.5 : 1), ctx.currentTime + 0.05);
      scheduleBell();
    }, gap * 1000);
  }

  function setChord(idx) {
    if (!ctx || idx === currentChord) return;
    currentChord = idx;
    const chord = CHORDS[idx % CHORDS.length];
    const now = ctx.currentTime;
    voices.forEach((v, i) => v.oscs.forEach(o => {
      o.frequency.cancelScheduledValues(now);
      o.frequency.setTargetAtTime(chord[i], now, 2.5);
    }));
  }

  async function enable() {
    if (!ctx) build();
    if (ctx.state === 'suspended') await ctx.resume();
    enabled = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.7, ctx.currentTime, 2.5);
  }
  function disable() {
    if (!ctx) return;
    enabled = false;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
  }
  function toggle() { enabled ? disable() : enable(); return enabled; }

  // Duck the score while a video plays
  function duck(on) {
    if (!ctx || !enabled) return;
    master.gain.setTargetAtTime(on ? 0.08 : 0.7, ctx.currentTime, 0.8);
  }

  return { enable, disable, toggle, setChord, duck, get enabled() { return enabled; } };
})();
