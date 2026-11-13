/* Concrete Flow – Audio: echte Aufnahmen (CC0, OpenGameArt) + Musik-Playlist. Credits: assets/audio/CREDITS.txt */
window.CF = window.CF || {};
CF.Audio = (() => {
  let ctx = null, master, sfxBus, musicBus, verb, verbSend;
  const vol = { master: 0.85, sfx: 0.9, music: 0.5 };
  const buf = {};
  const loops = {};
  const SFX = ['pop1', 'pop2', 'pop3', 'land1', 'land2', 'land3', 'clank1', 'clank2', 'ui_tick', 'ui_ok', 'ping', 'wall', 'bail1', 'bail2', 'whoosh',
    'roll_loop', 'grind_metal_loop', 'grind_concrete_loop', 'wind_loop', 'rain_loop'];
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = vol.master;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master);
    // Dezenter Außenhall (Reflexionen von Rampen und Wänden)
    verb = ctx.createConvolver(); verb.buffer = impulse(1.2, 3.2);
    verbSend = ctx.createGain(); verbSend.gain.value = 0.18; verbSend.connect(verb); verb.connect(sfxBus);
    for (const n of SFX) fetch(`assets/audio/sfx/${n}.ogg`).then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { buf[n] = b; if (/_loop$/.test(n)) startLoop(n); }).catch(() => {});
    Music.start();
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); }
    return b;
  }
  /* Einmaliger Sound mit Variation */
  function play(name, { gain = 1, rate = 1, vary = 0.06, lp = 0, wet = true, delay = 0 } = {}) {
    if (!ctx || !buf[name]) return;
    const s = ctx.createBufferSource(); s.buffer = buf[name];
    s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    const g = ctx.createGain(); g.gain.value = gain;
    let node = s;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g); g.connect(sfxBus); if (wet) g.connect(verbSend);
    s.start(ctx.currentTime + delay);
  }
  /* Dauerschleifen (Rollen, Grind, Wind, Regen) laufen immer, nur Lautstärke/Tonhöhe ändern sich */
  function startLoop(name) {
    const s = ctx.createBufferSource(); s.buffer = buf[name]; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 8000;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfxBus);
    if (name !== 'rain_loop') g.connect(verbSend);
    s.start(0, Math.random() * buf[name].duration);
    loops[name] = { s, f, g };
  }
  function setLoop(name, gain, rate, lp, tc = 0.06) {
    const l = loops[name]; if (!l || !ctx) return;
    const t = ctx.currentTime;
    l.g.gain.setTargetAtTime(gain, t, tc);
    if (rate) l.s.playbackRate.setTargetAtTime(rate, t, 0.08);
    if (lp) l.f.frequency.setTargetAtTime(lp, t, 0.08);
  }

  /* ---------------- Musik: Playlist echter Tracks ---------------- */
  const Music = (() => {
    const TRACKS = [
      { file: 'punk_lofi', name: 'Fast Cheerful Punk Rock Lo-Fi', by: 'annandistance' },
      { file: 'funked_up', name: 'Funked Up', by: 'joth' },
      { file: 'hiphop_jam', name: 'Funky Hip Hop Lofi Jam', by: 'omfgdude' },
      { file: 'punk_hardcore', name: 'Flesh and Blood', by: 'pro-sensory' },
      { file: 'drive', name: 'Drive', by: 'Zane Little Music' },
      { file: 'chill_lofi', name: 'Chill Lofi Inspired', by: 'omfgdude' },
      { file: 'punk_metal', name: 'Punk Rock Metal', by: 'madworldgames' },
    ];
    let el = null, idx = Math.floor(Math.random() * TRACKS.length), on = true, src = null;
    function load(i) {
      idx = (i + TRACKS.length) % TRACKS.length;
      el.src = `assets/audio/music/${TRACKS[idx].file}.ogg`;
      if (on) el.play().catch(() => {});
      CF.onTrack && CF.onTrack(TRACKS[idx]);
    }
    return {
      TRACKS,
      start() {
        if (el) return;
        el = new Audio(); el.preload = 'auto';
        el.addEventListener('ended', () => load(idx + 1));
        try { src = ctx.createMediaElementSource(el); src.connect(musicBus); } catch (e) { /* Fallback: direkt abspielen */ }
        load(idx);
      },
      next() { if (el) load(idx + 1); return TRACKS[(idx) % TRACKS.length].name; },
      get name() { const t = TRACKS[idx]; return `${t.name} – ${t.by}`; },
      set enabled(v) { on = v; if (!el) return; v ? el.play().catch(() => {}) : el.pause(); }, get enabled() { return on; },
    };
  })();

  return {
    init, Music, vol,
    setVolume(k, v) {
      vol[k] = v;
      if (!ctx) return;
      ({ master, sfx: sfxBus, music: musicBus })[k].gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    update(s) { // s: {roll, rollFreq (m/s), grind, grindMetal, wind}
      if (!ctx) return;
      const sp = s.rollFreq || 0;
      setLoop('roll_loop', s.roll * 0.9, 0.75 + Math.min(sp, 20) * 0.035, 1200 + Math.min(sp, 20) * 260);
      setLoop('grind_metal_loop', s.grind && s.grindMetal ? 0.75 : 0, 0.85 + Math.min(sp, 15) * 0.02, 0, 0.03);
      setLoop('grind_concrete_loop', s.grind && !s.grindMetal ? 0.9 : 0, 0.8 + Math.min(sp, 15) * 0.025, 0, 0.03);
      setLoop('wind_loop', s.wind * 0.55, 0.8 + s.wind * 0.5, 700 + s.wind * 3500);
    },
    silence() { for (const n of ['roll_loop', 'grind_metal_loop', 'grind_concrete_loop', 'wind_loop']) setLoop(n, 0); },
    setRain(v) { setLoop('rain_loop', v * 0.6, 1, 0, 0.5); },
    pop() { play(pick(['pop1', 'pop2', 'pop3']), { gain: 0.9, vary: 0.08 }); play('pop1', { gain: 0.35, rate: 0.55, lp: 700, wet: false }); },
    land(h) {
      const g = 0.55 + h * 0.5;
      play(pick(['land1', 'land2', 'land3']), { gain: g, vary: 0.07 });
      play('land1', { gain: g * 0.7, rate: 0.5, lp: 400, wet: false }); // Körper-Thump
    },
    flip() { play('whoosh', { gain: 0.45, vary: 0.15 }); },
    grindStart(metal) { metal ? play(pick(['clank1', 'clank2']), { gain: 0.65 }) : play('land2', { gain: 0.6, rate: 0.85, lp: 2500 }); },
    bail() { play('bail1', { gain: 1 }); play('bail2', { gain: 0.8, delay: 0.12 }); play(pick(['clank1', 'clank2']), { gain: 0.35, rate: 0.7, delay: 0.25 }); },
    wall() { play('wall', { gain: 0.85 }); },
    thunder() {
      if (!ctx) return;
      // Donner: tiefes, langes Grollen aus gefiltertem Rauschen (kein passendes CC0-Sample vorhanden)
      const n = ctx.sampleRate * 5, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      let v = 0; for (let i = 0; i < n; i++) { v = v * 0.995 + (Math.random() * 2 - 1) * 0.05; d[i] = v * Math.pow(1 - i / n, 1.6) * (1 + Math.sin(i / 9000) * 0.5); }
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      const g = ctx.createGain(); g.gain.value = 3.2;
      s.connect(f); f.connect(g); g.connect(sfxBus); g.connect(verbSend); s.start();
      CF.Input.rumble(0.7, 0.2, 700, true);
    },
    bank(big) { play('ping', { gain: big ? 0.45 : 0.3, rate: big ? 1.5 : 1.2, vary: 0 }); if (big) play('ping', { gain: 0.35, rate: 2, vary: 0, delay: 0.09 }); },
    challenge() { [1, 1.26, 1.5, 2].forEach((r, i) => play('ping', { gain: 0.4, rate: r, vary: 0, delay: i * 0.1 })); },
    levelUp() { [1, 1.26, 1.5, 1.68, 2].forEach((r, i) => play('ping', { gain: 0.4, rate: r * 0.9, vary: 0, delay: i * 0.08 })); },
    streak(n) { play('ping', { gain: 0.35, rate: 1 + Math.min(n, 20) * 0.04, vary: 0 }); },
    shutter() { play('ui_tick', { gain: 0.8, rate: 1.4, wet: false }); play('ui_tick', { gain: 0.6, rate: 1.1, wet: false, delay: 0.07 }); },
    ui() { play('ui_tick', { gain: 0.45, vary: 0.03, wet: false }); },
    uiOk() { play('ui_ok', { gain: 0.55, vary: 0.03, wet: false }); },
  };
})();
