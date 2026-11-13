/* Concrete Flow – Audio: Soundeffekte + prozedural generierte Musik (alles synthetisiert, keine Fremd-Samples) */
window.CF = window.CF || {};
CF.Audio = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  let roll, grindMetal, grindStone, wind, rainL, rainH;
  const vol = { master: 0.8, sfx: 0.9, music: 0.55 };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    roll = loopNoise('bandpass', 420, 0.7);
    grindMetal = loopNoise('bandpass', 3400, 4);
    grindStone = loopNoise('bandpass', 1300, 1.2);
    wind = loopNoise('highpass', 900, 0.5);
    rainL = loopNoise('lowpass', 900, 0.4);
    rainH = loopNoise('highpass', 5200, 0.3);
    Music.start();
  }

  function loopNoise(type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
    return { g, f };
  }
  function setLoop(l, v, f) {
    if (!ctx) return;
    l.g.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    if (f) l.f.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
  }
  function burst(dur, freq, type, v, q = 1, bus) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function tone(f0, f1, dur, v, type = 'sine', bus, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }

  /* ---------------- Musik: eigener Step-Sequencer ---------------- */
  const Music = (() => {
    // Drei eigene Tracks: Tempo, Grundton (MIDI), Akkordfolge (Stufen in Moll-Skala), Stil
    const TRACKS = [
      { name: 'Asphalt Sunset', bpm: 88,  root: 45, prog: [0, 5, 3, 4], style: 'lofi' },
      { name: 'Kickflip Kids',  bpm: 168, root: 40, prog: [0, 3, 5, 4], style: 'punk' },
      { name: 'Night Session',  bpm: 100, root: 43, prog: [0, 6, 5, 4], style: 'boom' },
    ];
    const SCALE = [0, 2, 3, 5, 7, 8, 10];
    let track = 0, step = 0, nextT = 0, timer = null, on = true, bar = 0, seed = 1;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    function deg(d, oct = 0) { const o = Math.floor(d / 7); return SCALE[((d % 7) + 7) % 7] + 12 * (o + oct); }

    function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4); }
    function snare(t, v = 0.45) { const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, rnd()); s.stop(t + 0.2);
      const o = ctx.createOscillator(), g2 = ctx.createGain(); o.frequency.value = 190;
      g2.gain.setValueAtTime(v * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g2); g2.connect(musicBus); o.start(t); o.stop(t + 0.1); }
    function hat(t, v = 0.12, len = 0.04) { const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, rnd()); s.stop(t + len + 0.02); }
    function note(t, midi, dur, v, type, cutoff = 2400, det = 0) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(midi); o.detune.value = det;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.25);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.3); }

    function schedule(t, st) {
      const tr = TRACKS[track];
      const chord = tr.prog[Math.floor(bar % 4)];
      const s16 = st % 16;
      const sixteenth = 60 / tr.bpm / 4;
      if (tr.style === 'punk') {
        if (s16 % 8 === 0 || s16 === 6 || s16 === 10) kick(t);
        if (s16 % 8 === 4) snare(t, 0.5);
        if (s16 % 2 === 0) hat(t, 0.09);
        if (s16 % 2 === 0) { // Power-Chord-Achtel (Säge, verzerrt durch Detune)
          const r = tr.root + 12 + deg(chord);
          note(t, r, sixteenth * 1.8, 0.07, 'sawtooth', 1800, -6);
          note(t, r + 7, sixteenth * 1.8, 0.05, 'sawtooth', 1800, 6);
          note(t, r - 12, sixteenth * 1.8, 0.16, 'square', 600);
        }
        if (bar % 2 === 1 && s16 % 4 === 2 && rnd() < 0.6)
          note(t, tr.root + 24 + deg(chord + [0, 2, 4, 7][Math.floor(rnd() * 4)]), sixteenth * 2, 0.05, 'square', 3000);
      } else {
        const swing = (s16 % 2 === 1) ? sixteenth * (tr.style === 'lofi' ? 0.22 : 0.12) : 0;
        t += swing;
        const kp = tr.style === 'lofi' ? [0, 7, 10] : [0, 3, 8, 11];
        if (kp.includes(s16)) kick(t);
        if (s16 === 4 || s16 === 12) snare(t, tr.style === 'lofi' ? 0.32 : 0.45);
        if (s16 % 2 === 0 || (tr.style === 'boom' && rnd() < 0.3)) hat(t, s16 % 4 === 2 ? 0.1 : 0.06);
        if (s16 === 0) { // weiche Akkorde (Septakkord)
          [0, 2, 4, 6].forEach((d, i) => note(t + i * 0.012, tr.root + 12 + deg(chord + d), sixteenth * 15, 0.045, 'triangle', 1400));
        }
        if ([0, 6, 10].includes(s16)) note(t, tr.root - 12 + deg(chord), sixteenth * 3, 0.22, 'sine', 500);
        if (s16 % 2 === 0 && rnd() < (tr.style === 'lofi' ? 0.28 : 0.35)) {
          const d = chord + [0, 2, 4, 5, 7][Math.floor(rnd() * 5)];
          note(t, tr.root + 24 + deg(d), sixteenth * 2.5, 0.05, tr.style === 'lofi' ? 'sine' : 'square', 2200);
        }
      }
    }
    function tick() {
      if (!ctx) return;
      const tr = TRACKS[track];
      const sixteenth = 60 / tr.bpm / 4;
      while (nextT < ctx.currentTime + 0.15) {
        if (on) schedule(nextT, step);
        step++; if (step % 16 === 0) bar++;
        nextT += sixteenth;
      }
    }
    return {
      TRACKS,
      start() { if (timer) return; nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 40); },
      next() { track = (track + 1) % TRACKS.length; step = 0; bar = 0; seed = 1 + track * 977; if (ctx) nextT = ctx.currentTime + 0.1; return TRACKS[track].name; },
      get name() { return TRACKS[track].name; },
      set enabled(v) { on = v; }, get enabled() { return on; },
    };
  })();

  return {
    init, Music, vol,
    setVolume(k, v) {
      vol[k] = v;
      if (!ctx) return;
      ({ master, sfx: sfxBus, music: musicBus })[k].gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    update(s) { // s: {roll, rollFreq, grind, grindMetal, wind}
      if (!ctx) return;
      setLoop(roll, s.roll * 0.55, 260 + s.rollFreq * 40);
      setLoop(grindMetal, s.grind && s.grindMetal ? 0.35 : 0, 3000 + s.rollFreq * 60);
      setLoop(grindStone, s.grind && !s.grindMetal ? 0.45 : 0);
      setLoop(wind, s.wind * 0.25, 600 + s.wind * 1200);
    },
    silence() { if (!ctx) return; [roll, grindMetal, grindStone, wind].forEach(l => setLoop(l, 0)); },
    levelUp() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.3, 0.13, 'triangle', null, i * 0.08)); },
    streak(n) { tone(500 + n * 60, 900 + n * 60, 0.15, 0.1, 'square'); },
    shutter() { burst(0.05, 3000, 'bandpass', 0.6, 2); setTimeout(() => burst(0.06, 2000, 'bandpass', 0.5, 2), 70); },
    pop() { burst(0.07, 2200, 'highpass', 0.9); tone(260, 80, 0.08, 0.35, 'triangle'); },
    land(h) { burst(0.22, 420, 'lowpass', 0.7 + h * 0.35); tone(120, 50, 0.15, 0.4 + h * 0.2, 'sine'); },
    flip() { burst(0.05, 5000, 'bandpass', 0.25, 3); },
    grindStart(metal) { metal ? tone(1800, 1400, 0.25, 0.12, 'triangle') : burst(0.1, 900, 'bandpass', 0.6); },
    bail() { burst(0.5, 260, 'lowpass', 1.3); tone(90, 40, 0.4, 0.6, 'sine'); burst(0.25, 2500, 'bandpass', 0.4, 2); },
    wall() { burst(0.2, 300, 'lowpass', 1); },
    bank(big) { tone(660, 660, 0.12, 0.12, 'square'); tone(990, 990, big ? 0.35 : 0.18, 0.12, 'square', null, 0.09); },
    setRain(v) { if (!ctx) return; setLoop(rainL, v * 0.35); setLoop(rainH, v * 0.18); },
    thunder() {
      if (!ctx) return;
      burst(0.25, 1800, 'bandpass', 0.6, 0.6);
      burst(3.5, 140, 'lowpass', 1.6, 0.7);
      setTimeout(() => burst(2.5, 90, 'lowpass', 1.2, 0.7), 300);
      CF.Input.rumble(0.7, 0.2, 700, true);
    },
    challenge() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.22, 0.12, 'square', null, i * 0.1)); },
    ui() { tone(900, 700, 0.05, 0.08, 'square'); },
    uiOk() { tone(700, 1100, 0.08, 0.1, 'square'); },
  };
})();
