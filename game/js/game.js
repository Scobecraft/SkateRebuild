/* Concrete Flow – Spielablauf, Punkte, Level/Streaks, Challenges, Kamera, HUD, Menüs, Modi */
window.CF = window.CF || {};
(() => {
  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString('de-DE');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cf_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cf_' + k, JSON.stringify(v)); } catch (e) { /* ignorieren */ } },
  };
  const settings = Object.assign({ music: 0.55, sfx: 0.9, vibration: true, quality: 'ultra', outfit: 0, cam: 0, npcs: 8, dayLength: 24, weather: 'auto', startTime: 15.5 },
    store.get('settings', {}));
  if (!['ultra', 'hoch', 'leistung'].includes(settings.quality)) settings.quality = 'ultra';
  CF.shadowRes = settings.quality === 'leistung' ? 2048 : 4096;

  /* ---------------- Renderer ---------------- */
  const canvas = $('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb0c8e0, 160, 750);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 2500);
  function resize() {
    const pr = Math.min(window.devicePixelRatio || 1, settings.quality === 'leistung' ? 1 : 1.5);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (post) {
      post.composer.setSize(innerWidth, innerHeight);
      if (post.ssao) post.ssao.setSize(innerWidth * pr, innerHeight * pr);
      post.fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    }
  }
  /* ---------------- Post-Processing (HDR-Pipeline) ---------------- */
  const X = window.THREEX;
  const GradeShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uContrast: { value: 1.1 }, uSat: { value: 1.14 }, uVig: { value: 0.22 }, uGrain: { value: 0.025 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uContrast, uSat, uVig, uGrain; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(.2126,.7152,.0722));
        c.rgb = mix(vec3(l), c.rgb, uSat);
        c.rgb = (c.rgb - .5) * uContrast + .5;
        vec2 d = vUv - .5; c.rgb *= 1. - uVig * smoothstep(.3, .85, length(d * vec2(1.25, 1.)));
        c.rgb += (h(vUv * 1000. + uTime) - .5) * uGrain;
        gl_FragColor = vec4(clamp(c.rgb, 0., 1.), c.a); }`,
  };
  let post = null;
  function setupPost() {
    if (settings.quality === 'leistung') return;
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType });
    renderer.toneMapping = THREE.NoToneMapping; // Tonemapping übernimmt der ACES-Pass
    const composer = new X.EffectComposer(renderer, rt);
    composer.addPass(new X.RenderPass(scene, camera));
    let ssao = null;
    if (settings.quality === 'ultra') {
      ssao = new X.SSAOPass(scene, camera, innerWidth * pr, innerHeight * pr);
      ssao.kernelRadius = 0.7; ssao.minDistance = 0.0004; ssao.maxDistance = 0.03;
      composer.addPass(ssao);
    }
    const bloom = new X.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.55, 0.92);
    composer.addPass(bloom);
    const aces = new X.ShaderPass(X.ACESFilmicToneMappingShader); composer.addPass(aces);
    composer.addPass(new X.ShaderPass(X.GammaCorrectionShader));
    const grade = new X.ShaderPass(GradeShader); composer.addPass(grade);
    const fxaa = new X.ShaderPass(X.FXAAShader); composer.addPass(fxaa);
    post = { composer, ssao, bloom, aces, grade, fxaa };
  }
  function renderFrame() {
    if (!post) { renderer.render(scene, camera); return; }
    post.aces.uniforms.exposure.value = renderer.toneMappingExposure;
    post.grade.uniforms.uTime.value = (post.grade.uniforms.uTime.value + 1.37) % 1000;
    post.bloom.strength = CF.Env.isNight ? 0.42 : 0.28;
    post.composer.render();
  }
  addEventListener('resize', resize); resize();

  // Ladebalken für die Texturen
  THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => { $('load-bar').style.width = Math.round(loaded / total * 100) + '%'; };
  THREE.DefaultLoadingManager.onLoad = () => $('loading').classList.add('hide');
  setTimeout(() => $('loading').classList.add('hide'), 15000);

  CF.World.build(scene, renderer);
  setupPost(); resize();
  CF.Props.load(scene);
  CF.Env.init(scene, renderer, settings.quality);
  CF.Env.setTime(settings.startTime);
  CF.Env.st.dayLength = settings.dayLength;
  CF.Env.st.auto = settings.weather === 'auto';
  CF.Env.setWeather(settings.weather === 'auto' ? 'klar' : settings.weather, true);
  CF.Skater.init(scene);
  if (!CF.Progress.outfitUnlocked(settings.outfit)) settings.outfit = 0;
  CF.Skater.setOutfit(settings.outfit);
  CF.NPC.init(scene, settings.npcs);
  const Pl = CF.Player;
  Pl.spawn(CF.World.spawns[0]);
  CF.Audio.vol.music = settings.music; CF.Audio.vol.sfx = settings.sfx;
  CF.Input.vibration = settings.vibration;

  /* ---------------- Popups ---------------- */
  function popup(text, cls = '', ms = 1600) {
    const d = document.createElement('div'); d.className = 'popup ' + cls; d.innerHTML = text;
    $('popups').appendChild(d); setTimeout(() => d.remove(), ms);
  }
  function toast(text, ms = 2500) {
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = text;
    $('toasts').appendChild(d); setTimeout(() => d.remove(), ms);
  }

  /* ---------------- Challenges ---------------- */
  const CHALLENGES = [
    { id: 'kickflip', text: 'Lande einen Kickflip', xp: 300 },
    { id: 'tre', text: 'Lande einen 360 Flip', xp: 600 },
    { id: 'grind3', text: 'Grinde 3 Sekunden am Stück', xp: 500 },
    { id: 'handrail', text: 'Grinde ein Handrail an der Treppe', xp: 500 },
    { id: 'coping', text: 'Grinde die Coping eines Bowls', xp: 600 },
    { id: 'spin540', text: 'Lande einen 540er-Spin', xp: 800 },
    { id: 'combo5k', text: 'Lande eine Combo mit 5.000+ Punkten', xp: 600 },
    { id: 'combo25k', text: 'Lande eine Combo mit 25.000+ Punkten', xp: 1500 },
    { id: 'megagap', text: 'Springe den Mega-Gap (über 1,6 s Airtime)', xp: 1000 },
    { id: 'sky', text: 'Fliege höher als 10 m', xp: 1200 },
    { id: 'dropflip', text: 'Lande einen Flip-Trick von der Plaza-Plattform', xp: 500 },
    { id: 'streak5', text: 'Schaffe einen 5er-Streak', xp: 800 },
    { id: 'streak10', text: 'Schaffe einen 10er-Streak', xp: 2000 },
    { id: 'rain', text: 'Lande eine 2.000er-Combo im Regen', xp: 700 },
    { id: 'night', text: 'Lande einen 360 Flip bei Nacht', xp: 700 },
    { id: 'level10', text: 'Erreiche Level 10', xp: 1500 },
    { id: 'career', text: 'Sammle insgesamt 100.000 Punkte', xp: 2000 },
  ];
  const done = new Set(store.get('challenges', []));
  let career = store.get('career', 0);
  function complete(id) {
    if (done.has(id)) return;
    done.add(id); store.set('challenges', [...done]);
    const c = CHALLENGES.find(c => c.id === id);
    popup(`★ CHALLENGE GESCHAFFT ★<br><small>${c.text} · +${fmt(c.xp)} XP</small>`, 'challenge', 2800);
    CF.Audio.challenge(); CF.Input.rumble(0.3, 0.8, 300, true);
    session.score += 1000;
    CF.Progress.addXP(c.xp);
    renderGoals();
  }
  function renderGoals() {
    $('goals-list').innerHTML = CHALLENGES.map(c => `<li class="${done.has(c.id) ? 'done' : ''}">${done.has(c.id) ? '✔' : '○'} ${c.text}</li>`).join('');
    $('goals-count').textContent = `${done.size}/${CHALLENGES.length}`;
  }
  renderGoals();

  /* ---------------- Level-ups ---------------- */
  CF.onLevelUp = (lv, rank, unlocked) => {
    popup(`LEVEL ${lv}!<br><small>Rang: ${rank}${unlocked.length ? ' · Neues Outfit: ' + unlocked.join(', ') : ''}</small>`, 'level', 3200);
    CF.Audio.levelUp(); CF.Input.rumble(0.5, 0.9, 450, true);
    if (lv >= 10) complete('level10');
    refreshHUD();
  };
  CF.onWeather = name => toast(`🌦 Wetterumschwung: ${name}`, 2600);

  /* ---------------- Punkte, Combos & Streaks ---------------- */
  const session = { score: 0, mode: 'free', time: 0, best: store.get('best', 0), xp: 0 };
  const combo = { active: false, tricks: [], base: 0, mult: 0, pending: false, timer: 0, f: {} };
  CF.Score = {
    add(name, pts, info = {}) {
      if (!combo.active) Object.assign(combo, { active: true, tricks: [], base: 0, mult: 0, f: { rails: new Set(), spins: 0, names: new Set() } });
      const last = combo.tricks[combo.tricks.length - 1];
      const reps = combo.tricks.filter(t => t === name).length; // Wiederholungen bringen weniger
      combo.tricks.push(name);
      combo.base += pts * Math.pow(0.6, reps);
      combo.mult += 1;
      combo.pending = false;
      combo.f.names.add(name.split(' (')[0]);
      if (info.spin) combo.f.spins = Math.max(combo.f.spins, info.spin);
      if (info.railId) combo.f.rails.add(info.railId);
      renderCombo(last !== name);
    },
    grindTick(dt) { if (combo.active) { combo.base += 120 * dt; renderCombo(); } },
    grabTick(dt) { if (combo.active) { combo.base += 220 * dt; renderCombo(); } },
    grindEnd(time) { if (combo.active) combo.f.maxGrind = Math.max(combo.f.maxGrind || 0, time); },
    leftGround() { combo.pending = false; },
    landed(info) {
      if (info.airT > 1.1) this.add(`Big Air ${info.airT.toFixed(1).replace('.', ',')} s`, Math.round(info.airT * 180));
      if (!combo.active) return;
      const f = combo.f;
      f.maxAir = Math.max(f.maxAir || 0, info.airT);
      f.maxY = Math.max(f.maxY || 0, Pl.P.maxY);
      if (info.flips > 0 && info.drop > 1.3) f.dropFlip = true;
      combo.pending = true; combo.timer = 0.8;
    },
    bail(reason) {
      const lost = combo.active ? ` · ${fmt(combo.base * combo.mult)} verloren` : '';
      const s = CF.Progress.breakStreak();
      popup(`BAIL!<br><small>${reason}${lost}${s >= 2 ? ` · ${s}er-Streak gerissen` : ''}</small>`, 'bail', 1900);
      combo.active = false; renderCombo(); refreshHUD();
    },
    cancel() { combo.active = false; renderCombo(); },
  };
  function bank() {
    const raw = Math.round(combo.base) * combo.mult;
    const bonus = CF.Progress.streakBonus;
    const pts = Math.round(raw * bonus);
    session.score += pts; career += pts; store.set('career', career);
    const xp = Math.round(pts / 8); session.xp += xp;
    CF.Progress.addXP(xp);
    const streak = CF.Progress.comboLanded(raw);
    const f = combo.f;
    popup(`+${fmt(pts)}${bonus > 1 ? ` <small>(Streak ×${bonus.toFixed(1).replace('.', ',')})</small>` : ''}<br><small class="xp">+${fmt(xp)} XP</small>`, pts > 5000 ? 'big' : 'good', 1500);
    if (streak >= 2) {
      $('streak').classList.remove('bump'); void $('streak').offsetWidth; $('streak').classList.add('bump');
      if ([3, 5, 10, 15, 20, 25].includes(streak)) { popup(`🔥 ${streak}er-STREAK!`, 'streak', 1800); CF.Audio.streak(streak); }
    }
    CF.Audio.bank(pts > 5000); CF.Input.rumble(0.05, 0.25, 80);
    if (f.names.has('Kickflip')) complete('kickflip');
    if (f.names.has('360 Flip')) { complete('tre'); if (CF.Env.isNight) complete('night'); }
    if ((f.maxGrind || 0) >= 3) complete('grind3');
    if (f.rails.has('handrail')) complete('handrail');
    if (f.rails.has('coping')) complete('coping');
    if (f.spins >= 540) complete('spin540');
    if (raw >= 5000) complete('combo5k');
    if (raw >= 25000) complete('combo25k');
    if ((f.maxAir || 0) >= 1.6) complete('megagap');
    if ((f.maxY || 0) >= 10) complete('sky');
    if (f.dropFlip) complete('dropflip');
    if (streak >= 5) complete('streak5');
    if (streak >= 10) complete('streak10');
    if (raw >= 2000 && CF.Env.st.cur.rain > 0.5) complete('rain');
    if (career >= 100000) complete('career');
    combo.active = false; renderCombo(); refreshHUD();
  }
  function renderCombo(flash) {
    const el = $('combo');
    if (!combo.active) { el.classList.remove('show'); return; }
    el.classList.add('show');
    const list = combo.tricks.slice(-6).join(' + ');
    $('combo-tricks').textContent = (combo.tricks.length > 6 ? '… + ' : '') + list;
    $('combo-pts').textContent = fmt(combo.base);
    $('combo-mult').textContent = '× ' + combo.mult;
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  function refreshHUD() {
    const Pg = CF.Progress;
    $('lvl').textContent = Pg.level;
    $('rank').textContent = Pg.rank;
    $('xpbar').style.width = (Pg.levelProgress * 100) + '%';
    $('xptext').textContent = Pg.nextLevelXp ? `${fmt(Pg.nextLevelXp)} XP bis Lv ${Pg.level + 1}` : 'MAX LEVEL';
    const s = Pg.streak;
    $('streak').classList.toggle('show', s >= 1);
    $('streak-n').textContent = s;
    $('streak-b').textContent = '×' + Pg.streakBonus.toFixed(1).replace('.', ',');
  }
  refreshHUD();

  /* ---------------- Kamera ---------------- */
  const CAMS = [
    { name: 'Standard', dist: 4.6, height: 1.9, look: 0.9, fov: 68 },
    { name: 'Weit', dist: 7.5, height: 3.0, look: 1.0, fov: 62 },
    { name: 'Filmer (tief)', dist: 3.2, height: 0.7, look: 0.8, fov: 92 },
  ];
  let camYaw = Math.PI;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tv = new THREE.Vector3();
  function updateCamera(dt) {
    const P = Pl.P, C = CAMS[settings.cam];
    const h = Pl.heading;
    if (h !== null && P.state !== 'bail') {
      const d = ((h - camYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      camYaw += d * (1 - Math.exp(-dt * (P.state === 'air' ? 1.6 : 4.5)));
    }
    const sp = Pl.speed;
    const dist = C.dist + Math.min(sp, 20) * 0.08;
    const tx = P.x - Math.sin(camYaw) * dist, tz = P.z - Math.cos(camYaw) * dist;
    let ty = P.y + C.height + (P.state === 'air' ? 0.4 : 0);
    ty = Math.max(ty, CF.World.groundAt(tx, tz, P.y + 2).h + 0.6);
    camPos.lerp(tv.set(tx, ty, tz), 1 - Math.exp(-dt * (P.state === 'air' ? 5 : 9)));
    camLook.lerp(tv.set(P.x + Math.sin(camYaw) * 1.5, P.y + C.look, P.z + Math.cos(camYaw) * 1.5), 1 - Math.exp(-dt * 12));
    camera.position.copy(camPos); camera.lookAt(camLook);
    const fov = C.fov + Math.min(sp, 22) * 0.45;
    camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 3)); camera.updateProjectionMatrix();
  }
  function snapCamera() {
    const P = Pl.P; camYaw = P.yaw;
    camPos.set(P.x - Math.sin(camYaw) * 5, P.y + 2, P.z - Math.cos(camYaw) * 5); camLook.set(P.x, P.y + 1, P.z);
  }
  let orbit = 0;
  function menuCamera(dt) {
    orbit += dt * 0.04;
    camera.position.set(Math.cos(orbit) * 125, 42, Math.sin(orbit) * 105);
    camera.lookAt(0, 0, -10); camera.fov = 55; camera.updateProjectionMatrix();
  }

  /* ---------------- Menüs ---------------- */
  let mode = 'menu', menuStack = [], focus = 0, photoReturn = 'play';
  const isElectron = /Electron/i.test(navigator.userAgent);
  const pct = v => Math.round(v * 100) + '%';
  function save() { store.set('settings', settings); }
  function cycleOutfit(d) {
    const n = CF.OUTFITS.length;
    for (let i = 1; i <= n; i++) { const k = (settings.outfit + d * i + n * 4) % n; if (CF.Progress.outfitUnlocked(k)) { settings.outfit = k; break; } }
    CF.Skater.setOutfit(settings.outfit); save();
  }
  const WEATHER_OPTS = ['auto', ...CF.Env.KEYS];
  const MENUS = {
    main: () => ({
      title: 'CONCRETE FLOW', sub: 'Megapark Session',
      items: [
        { label: 'Free Skate', act: () => startGame('free') },
        { label: 'Highscore-Session (3 Min)', act: () => startGame('session') },
        { label: 'Spot wählen', act: () => openMenu('spots') },
        { label: () => 'Outfit: ' + CF.OUTFITS[settings.outfit].name, side: d => cycleOutfit(d), act: () => openMenu('outfits') },
        { label: 'Profil & Challenges', act: () => openMenu('goals') },
        { label: 'Einstellungen', act: () => openMenu('settings') },
        { label: 'Steuerung', act: () => openMenu('controls') },
        ...(isElectron ? [{ label: 'Beenden', act: () => window.close() }] : []),
      ],
      footer: () => `Lv ${CF.Progress.level} ${CF.Progress.rank} · Bestwert Session: ${fmt(session.best)} · Karriere: ${fmt(career)} · Bester Streak: ${CF.Progress.bestStreak}`,
    }),
    pause: () => ({
      title: 'PAUSE', items: [
        { label: 'Weiter', act: () => resume() },
        { label: 'Replay ansehen (letzte 2 Min)', act: () => startReplay() },
        { label: 'Fotomodus', act: () => startPhoto('pause') },
        { label: 'Spot wählen', act: () => openMenu('spots') },
        { label: () => 'Outfit: ' + CF.OUTFITS[settings.outfit].name, side: d => cycleOutfit(d), act: () => openMenu('outfits') },
        { label: 'Profil & Challenges', act: () => openMenu('goals') },
        { label: 'Einstellungen', act: () => openMenu('settings') },
        { label: 'Steuerung', act: () => openMenu('controls') },
        { label: 'Hauptmenü', act: () => toMain() },
      ],
    }),
    outfits: () => ({
      title: 'OUTFITS', items: CF.OUTFITS.map((o, i) => ({
        label: (CF.Progress.outfitUnlocked(i) ? (i === settings.outfit ? '✔ ' : '') + o.name : `🔒 ${o.name} (ab Level ${CF.Progress.outfitLevel(i)})`),
        act: () => { if (CF.Progress.outfitUnlocked(i)) { settings.outfit = i; CF.Skater.setOutfit(i); save(); } else toast(`🔒 Freischaltung ab Level ${CF.Progress.outfitLevel(i)}`); },
      })).concat([{ label: 'Zurück', act: back }]),
    }),
    spots: () => ({
      title: 'SPOT WÄHLEN', items: CF.World.spawns.map(s => ({ label: s.name, act: () => { if (mode === 'menu') startGame('free', s); else { closeMenus(); teleport(s); resume(); } } }))
        .concat([{ label: 'Zurück', act: back }]),
    }),
    settings: () => ({
      title: 'EINSTELLUNGEN', items: [
        { label: () => 'Musik: ' + pct(settings.music), side: d => { settings.music = Math.max(0, Math.min(1, Math.round((settings.music + d * 0.1) * 10) / 10)); CF.Audio.setVolume('music', settings.music); save(); } },
        { label: () => 'Soundeffekte: ' + pct(settings.sfx), side: d => { settings.sfx = Math.max(0, Math.min(1, Math.round((settings.sfx + d * 0.1) * 10) / 10)); CF.Audio.setVolume('sfx', settings.sfx); save(); } },
        { label: () => 'Musik-Track: ' + CF.Audio.Music.name, act: () => CF.Audio.Music.next(), side: () => CF.Audio.Music.next() },
        { label: () => 'Vibration: ' + (settings.vibration ? 'An' : 'Aus'), act: () => { settings.vibration = !settings.vibration; CF.Input.vibration = settings.vibration; if (settings.vibration) CF.Input.rumble(0.6, 0.6, 250, true); save(); }, side() { this.act(); } },
        { label: () => 'Kamera: ' + CAMS[settings.cam].name, side: d => { settings.cam = (settings.cam + d + CAMS.length) % CAMS.length; save(); }, act: () => { settings.cam = (settings.cam + 1) % CAMS.length; save(); } },
        { label: () => 'Uhrzeit: ' + CF.Env.timeString, side: d => { CF.Env.setTime(CF.Env.st.time + d); settings.startTime = CF.Env.st.time; save(); } },
        { label: () => 'Tageszyklus: ' + (settings.dayLength ? settings.dayLength + ' Min pro Tag' : 'Aus (Zeit steht)'), side: d => { const L = [0, 10, 24, 48]; settings.dayLength = L[(L.indexOf(settings.dayLength) + d + L.length) % L.length]; CF.Env.st.dayLength = settings.dayLength; save(); } },
        { label: () => 'Wetter: ' + (settings.weather === 'auto' ? 'Wechselnd' : CF.Env.WEATHER[settings.weather].name), side: d => { settings.weather = WEATHER_OPTS[(WEATHER_OPTS.indexOf(settings.weather) + d + WEATHER_OPTS.length) % WEATHER_OPTS.length]; CF.Env.st.auto = settings.weather === 'auto'; if (!CF.Env.st.auto) CF.Env.setWeather(settings.weather); save(); } },
        { label: () => 'NPC-Skater: ' + settings.npcs, side: d => { settings.npcs = Math.max(0, Math.min(12, settings.npcs + d)); CF.NPC.setCount(settings.npcs); save(); } },
        { label: () => 'Grafik: ' + ({ ultra: 'Ultra (SSAO + Bloom)', hoch: 'Hoch (Bloom)', leistung: 'Leistung' })[settings.quality] + ' – nach Neustart', side: d => { const Q = ['leistung', 'hoch', 'ultra']; settings.quality = Q[(Q.indexOf(settings.quality) + d + 3) % 3]; save(); } },
        { label: 'Vollbild umschalten (F11)', act: toggleFullscreen },
        { label: 'Fortschritt zurücksetzen', act: () => { done.clear(); store.set('challenges', []); career = 0; store.set('career', 0); session.best = 0; store.set('best', 0); CF.Progress.reset(); settings.outfit = 0; CF.Skater.setOutfit(0); save(); renderGoals(); refreshHUD(); toast('Fortschritt zurückgesetzt'); } },
        { label: 'Zurück', act: back },
      ],
    }),
    goals: () => ({
      title: 'PROFIL', html: `<div class="profile"><div class="lvbig">LV ${CF.Progress.level}</div><div><b>${CF.Progress.rank}</b><br>${fmt(CF.Progress.xp)} XP gesamt · ${CF.Progress.nextLevelXp ? fmt(CF.Progress.nextLevelXp) + ' XP bis Level ' + (CF.Progress.level + 1) : 'Max-Level'}<br>Karriere-Punkte: ${fmt(career)} · Bester Streak: ${CF.Progress.bestStreak}</div></div>
        <h3>Challenges ${done.size}/${CHALLENGES.length}</h3><ul class="goal-menu">${CHALLENGES.map(c => `<li class="${done.has(c.id) ? 'done' : ''}">${done.has(c.id) ? '✔' : '○'} ${c.text} <small>+${fmt(c.xp)} XP</small></li>`).join('')}</ul>`,
      items: [{ label: 'Zurück', act: back }],
    }),
    controls: () => ({ title: 'STEUERUNG', html: $('controls-tpl').innerHTML, items: [{ label: 'Zurück', act: back }] }),
  };
  function openMenu(name) { menuStack.push(name); focus = 0; renderMenu(); CF.Audio.uiOk(); }
  function back() { menuStack.pop(); focus = 0; if (!menuStack.length) { if (mode === 'pause') resume(); else menuStack.push('main'); } renderMenu(); CF.Audio.ui(); }
  function closeMenus() { menuStack = []; $('menu').classList.remove('show'); }
  let curItems = [];
  function renderMenu() {
    const name = menuStack[menuStack.length - 1];
    if (!name) { $('menu').classList.remove('show'); return; }
    const m = MENUS[name]();
    curItems = m.items;
    focus = Math.min(focus, curItems.length - 1);
    $('menu').classList.add('show');
    $('menu').classList.toggle('main', name === 'main');
    $('menu-title').textContent = m.title;
    $('menu-sub').textContent = m.sub || '';
    $('menu-html').innerHTML = m.html || '';
    $('menu-footer').textContent = m.footer ? m.footer() : (CF.Input.hasGamepad ? 'Ⓐ Auswählen · Ⓑ Zurück · ◀ ▶ Ändern' : 'Enter Auswählen · Esc Zurück · ◀ ▶ Ändern');
    const box = $('menu-items'); box.innerHTML = '';
    curItems.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'mbtn' + (i === focus ? ' focus' : '') + (it.side ? ' side' : '');
      b.innerHTML = (it.side ? '<span class="arr">◀</span>' : '') + `<span>${typeof it.label === 'function' ? it.label() : it.label}</span>` + (it.side ? '<span class="arr">▶</span>' : '');
      b.onmouseenter = () => { if (focus !== i) { focus = i; highlight(); } };
      b.onclick = e => { CF.Audio.init(); const arr = e.target.closest('.arr'); if (arr && it.side) { it.side(arr.textContent === '◀' ? -1 : 1); CF.Audio.ui(); renderMenu(); } else activate(i); };
      box.appendChild(b);
    });
  }
  function highlight() { [...$('menu-items').children].forEach((b, i) => b.classList.toggle('focus', i === focus)); }
  function activate(i) {
    const it = curItems[i]; if (!it) return;
    CF.Audio.uiOk();
    if (it.act) it.act(); else if (it.side) it.side(1);
    if (menuStack.length) renderMenu();
  }
  function menuInput(dt) {
    const m = CF.Input.menu(dt);
    if (m.dir) { focus = (focus + m.dir + curItems.length) % curItems.length; highlight(); CF.Audio.ui(); }
    if (m.side && curItems[focus] && curItems[focus].side) { curItems[focus].side(m.side); CF.Audio.ui(); renderMenu(); }
    if (m.ok) activate(focus);
    else if (m.back && menuStack.length > 1) back();
    else if (m.back && mode === 'pause') resume();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen && document.exitFullscreen();
  }
  addEventListener('keydown', e => { if (e.code === 'F11') { e.preventDefault(); toggleFullscreen(); } });

  /* ---------------- Spielmodi ---------------- */
  function teleport(sp) { CF.Score.cancel(); Pl.spawn(sp); snapCamera(); }
  function startGame(m, sp) {
    CF.Audio.init();
    closeMenus();
    session.mode = m; session.score = 0; session.xp = 0; session.time = m === 'session' ? 180 : 0;
    teleport(sp || CF.World.spawns[0]);
    CF.Replay.clear();
    mode = 'play';
    document.body.classList.add('playing');
    $('timer').style.display = m === 'session' ? '' : 'none';
    hintT = 14; $('hint').classList.add('show');
    toast(m === 'session' ? 'Highscore-Session: 3 Minuten – hol so viele Punkte wie möglich!' : 'Free Skate – erkunde den Megapark!', 3500);
  }
  function pause() { mode = 'pause'; menuStack = ['pause']; focus = 0; renderMenu(); CF.Audio.silence(); }
  function resume() { closeMenus(); mode = 'play'; document.body.classList.add('playing'); }
  function toMain() {
    mode = 'menu'; menuStack = ['main']; focus = 0; renderMenu();
    document.body.classList.remove('playing'); CF.Score.cancel(); CF.Audio.silence();
    $('results').classList.remove('show');
  }
  function startReplay() {
    closeMenus(); CF.Audio.silence();
    if (!CF.Replay.enter(camera)) { toast('Noch keine Aufnahme vorhanden – fahr erst ein paar Sekunden.'); mode = 'play'; return; }
    mode = 'replay'; document.body.classList.remove('playing');
  }
  function endReplay() { CF.Replay.exit(); Pl.sync(0.016, { steer: 0 }); snapCamera(); resume(); }
  function startPhoto(from) {
    closeMenus(); CF.Audio.silence();
    photoReturn = from; mode = 'photo'; document.body.classList.remove('playing');
    CF.Photo.enter(camera, renderer);
  }
  function endPhoto() {
    CF.Photo.exit();
    if (photoReturn === 'replay') { mode = 'replay'; $('replay').classList.add('show'); }
    else { Pl.sync(0.016, { steer: 0 }); snapCamera(); resume(); }
  }
  function endSession() {
    if (combo.active && combo.pending) bank();
    mode = 'results';
    const best = session.score > session.best;
    if (best) { session.best = session.score; store.set('best', session.best); }
    $('res-score').textContent = fmt(session.score);
    $('res-best').textContent = (best ? 'NEUER BESTWERT!' : 'Bestwert: ' + fmt(session.best)) + ` · +${fmt(session.xp)} XP · Lv ${CF.Progress.level}`;
    $('results').classList.add('show');
    CF.Audio.silence(); CF.Audio.challenge();
  }

  CF.onGamepad = (on, id) => {
    toast(on ? `🎮 Controller verbunden<br><small>${(id || '').replace(/\(.*?\)/g, '').trim().slice(0, 48)}</small>` : '🎮 Controller getrennt');
    if (on) CF.Input.rumble(0.4, 0.4, 200, true);
    if (menuStack.length) renderMenu();
  };
  // Schnittstelle für das Admin-Menü
  CF.Game = {
    teleport: sp => { teleport(sp); },
    toast, refreshHUD,
    completeAll: () => CHALLENGES.forEach(c => complete(c.id)),
    addScore: n => { session.score += n; career += n; store.set('career', career); },
  };

  /* ---------------- HUD ---------------- */
  let hintT = 0;
  const WICON = { klar: '☀', wolkig: '⛅', regen: '🌧', gewitter: '⛈', nebel: '🌫' };
  function updateHUD(dt) {
    $('score').textContent = fmt(session.score);
    if (session.mode === 'session') {
      const t = Math.max(0, session.time), mm = Math.floor(t / 60), ss = Math.floor(t % 60);
      $('timer').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      $('timer').classList.toggle('low', t < 20);
    }
    $('speed').textContent = Math.round(Pl.speed * 3.6) + ' km/h';
    $('clock').textContent = `${CF.Env.isNight ? '☾' : WICON[CF.Env.st.weather]} ${CF.Env.timeString}`;
    const P = Pl.P;
    const bal = $('balance');
    if (P.state === 'grind') { bal.classList.add('show'); $('needle').style.left = (50 + P.balance * 50) + '%'; bal.classList.toggle('danger', Math.abs(P.balance) > 0.7); }
    else bal.classList.remove('show');
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').classList.remove('show'); }
    $('hint').innerHTML = CF.Input.hasGamepad
      ? 'Ⓐ/RT Anschieben · L-Stick Lenken · <b>R-Stick ↓ dann ↑ = Ollie</b> · ↓ dann ↖/↗ = Kick/Heelflip · LB/RB Grab · Steuerkreuz ↑ Replay · ↓ Foto'
      : 'W Anschieben · A/D Lenken · <b>Maus halten ↓ dann ↑ = Ollie</b> (oder Leertaste) · J/K/L/I Flips · Q/E Grab · V Replay · F Foto · R Reset';
  }

  /* ---------------- Hauptschleife ---------------- */
  let last = performance.now();
  menuStack = ['main']; renderMenu();
  function frame(now) {
    requestAnimationFrame(frame);
    const rdt = Math.min(0.05, (now - last) / 1000); last = now;
    CF.Input.raw.poll();
    if (CF.Admin.checkSecret()) { CF.Admin.isOpen ? CF.Admin.close() : CF.Admin.open(); }
    const dt = rdt * (mode === 'play' ? CF.Mods.timeScale : 1);
    let focusP = Pl.P;
    if (CF.Admin.isOpen) {
      CF.Admin.update();
      if (mode === 'play') { Pl.sync(0.0001, { steer: 0 }); }
    } else if (mode === 'play') {
      const inp = CF.Input.sample(rdt);
      if (inp.pause) { pause(); finish(rdt, focusP, true); return; }
      if (inp.replay) { startReplay(); finish(rdt, focusP, true); return; }
      if (inp.photo) { startPhoto('play'); finish(rdt, focusP, true); return; }
      if (inp.music) toast('♫ ' + CF.Audio.Music.next(), 2000);
      if (inp.camera) { settings.cam = (settings.cam + 1) % CAMS.length; save(); toast('Kamera: ' + CAMS[settings.cam].name, 1200); }
      if (inp.goals) $('goals').classList.toggle('show');
      Pl.update(dt, inp);
      Pl.sync(dt, inp);
      CF.NPC.update(dt, Pl.P);
      const hit = CF.NPC.collide(Pl.P, Pl.speed);
      if (hit && Pl.P.state !== 'bail' && Pl.P.state !== 'grind') Pl.bail(`Zusammenstoß mit ${hit.name}!`);
      if (combo.active && combo.pending && Pl.P.state === 'ground') { combo.timer -= dt; if (combo.timer <= 0) bank(); }
      if (session.mode === 'session') { session.time -= dt; if (session.time <= 0) endSession(); }
      CF.Replay.record(dt);
      updateCamera(rdt);
      const P = Pl.P, sp = Pl.speed;
      CF.Audio.update({
        roll: P.state === 'ground' ? Math.min(1, sp / 10) * (1 + CF.Env.wet * 0.3) : 0, rollFreq: sp,
        grind: P.state === 'grind', grindMetal: P.state === 'grind' && P.grind.r.metal,
        wind: P.state === 'air' ? Math.min(1, sp / 18) : Math.max(0, (sp - 12) / 20),
      });
      updateHUD(rdt);
      CF.Admin.debug(rdt, P);
    } else if (mode === 'replay') {
      const r = CF.Replay.update(rdt, camera);
      if (r.exit) endReplay();
      else if (r.photo) { CF.Replay.exit(); startPhoto('replay'); }
      focusP = camera.position;
    } else if (mode === 'photo') {
      const r = CF.Photo.update(rdt);
      if (r.shoot) { const n = CF.Photo.shoot(renderFrame); toast(isElectron ? `📷 Foto gespeichert<br><small>Bilder › Concrete Flow › ${n}</small>` : `📷 Foto gespeichert<br><small>${n}</small>`, 2600); }
      if (r.exit) endPhoto();
      focusP = camera.position;
    } else {
      if (mode === 'menu') { menuCamera(rdt); Pl.sync(rdt, { steer: 0 }); CF.NPC.update(rdt, null); focusP = { x: 0, z: 0 }; }
      if (mode === 'results') {
        const m = CF.Input.menu(rdt);
        if (m.ok) { $('results').classList.remove('show'); startGame('session'); }
        else if (m.back) toMain();
      } else menuInput(rdt);
    }
    finish(rdt, focusP, mode === 'photo' || mode === 'replay' || mode === 'pause');
  }
  function finish(dt, focusP, freeze) {
    CF.Env.update(dt, focusP, camera.position, freeze);
    if (mode === 'photo') renderer.toneMappingExposure *= CF.Photo.st.exposure;
    CF.Input.endFrame();
    renderFrame();
  }
  $('res-again').onclick = () => { $('results').classList.remove('show'); startGame('session'); };
  $('res-menu').onclick = () => toMain();
  $('rp-track').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); CF.Replay.seekFraction((e.clientX - r.left) / r.width); };
  requestAnimationFrame(frame);
  CF.debug = { Pl, session, combo, startGame, camera, renderer, scene, get mode() { return mode; }, startReplay, startPhoto };
})();
