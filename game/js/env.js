/* Concrete Flow – Umwelt: Tag-Nacht-Zyklus, dynamischer Himmel, Wetter (Regen, Gewitter, Nebel), Nachtbeleuchtung */
window.CF = window.CF || {};
CF.Env = (() => {
  const WEATHER = {
    klar:     { name: 'Klar',     cloud: 0.25, overcast: 0.0,  rain: 0,   fogNear: 260, fogFar: 1500, wind: 1 },
    wolkig:   { name: 'Bewölkt',  cloud: 0.65, overcast: 0.45, rain: 0,   fogNear: 180, fogFar: 1000, wind: 1.6 },
    regen:    { name: 'Regen',    cloud: 0.9,  overcast: 0.8,  rain: 1,   fogNear: 40,  fogFar: 320, wind: 2.2 },
    gewitter: { name: 'Gewitter', cloud: 1.0,  overcast: 0.95, rain: 1.4, fogNear: 30,  fogFar: 260, wind: 3.2, storm: true },
    nebel:    { name: 'Nebel',    cloud: 0.7,  overcast: 0.7,  rain: 0,   fogNear: 4,   fogFar: 95,  wind: 0.5 },
  };
  const KEYS = Object.keys(WEATHER);
  const st = {
    time: 15.5,          // Uhrzeit 0..24
    dayLength: 24,       // Minuten pro Tag (0 = Zeit angehalten)
    weather: 'klar', auto: true, nextChange: 240,
    cur: Object.assign({}, WEATHER.klar), wet: 0, flash: 0, nextBolt: 8,
  };
  let skyP, scene, renderer, sky, skyMat, sun, hemi, pm, envRT, envScene, envTimer = 0, lastEnvKey = '';
  const spots = [], points = [], cones = [];
  let rain, rainPos, rainVel;
  const RAIN_N = 7000;
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
  const tmpC = new THREE.Color();

  const vert = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`;
  // Overlay-Schicht über dem physikalischen Himmel: Wolken, Sterne, Mond, Bedeckung, Blitze
  const frag = `
    varying vec3 vDir;
    uniform vec3 sunDir, moonDir; uniform float uDay, uDusk, uOver, uCloud, uTime, uFlash, uNight;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
    void main(){
      vec3 d = normalize(vDir); float y = d.y;
      vec3 col = vec3(0.); float a = 0.;
      float sd = max(dot(d, sunDir), 0.);
      vec3 sunCol = mix(vec3(1.,.5,.22), vec3(1.,.97,.9), smoothstep(0.,.35,sunDir.y));
      // Sterne + Mond
      if (uNight > 0.01 && y > 0.) {
        vec2 g = floor(vec2(atan(d.z,d.x)*220., asin(clamp(y,-1.,1.))*220.));
        float s = hash(g); float tw = .6 + .4*sin(uTime*2. + s*60.);
        float star = step(.9975, s) * tw * uNight * (1.-uOver) * smoothstep(0.,.2,y) * (0.5 + 0.5*hash(g+3.));
        float md = max(dot(d, moonDir), 0.);
        float moon = smoothstep(.99955,.99975,md) * uNight * (1.-uOver*.8);
        col += vec3(.9,.95,1.)*star*2. + vec3(1.,.97,.9)*moon*3. + vec3(.5,.6,.8)*pow(md,200.)*.25*uNight;
        a = max(a, max(star, moon));
      }
      // Wolken
      if (y > -0.02) {
        float yy = max(y, 0.0);
        vec2 p = d.xz / (yy + .1) * 1.1 + vec2(uTime*.010, uTime*.004);
        float n = fbm(p) * .62 + fbm(p*2.9 + 4.)*.38;
        float cov = smoothstep(1.02 - uCloud, 1.2 - uCloud*.55, n) * smoothstep(-.02, .14, y);
        float thick = smoothstep(.45, 1.1, n);
        vec3 lit = mix(vec3(.05,.06,.09), mix(vec3(1.,.62,.42), vec3(1.), smoothstep(0.,.3,sunDir.y)), max(uDay, uDusk*.9));
        vec3 shade = mix(vec3(.025,.03,.045), vec3(.48,.52,.6), uDay) + vec3(.35,.18,.1)*uDusk;
        vec3 cc = mix(lit, shade, thick*.75 + uOver*.45);
        cc += sunCol * pow(sd, 6.) * .6 * (uDay + uDusk) * (1.-thick*.6);
        col = mix(col, cc * 1.25, cov); a = max(a, cov * .97);
      }
      // Bedeckter Himmel
      vec3 grey = mix(vec3(.02,.025,.035), vec3(.6,.63,.68), uDay) + vec3(.2,.12,.06)*uDusk;
      col = mix(col, grey, uOver*.8*(1.-a*.4)); a = max(a, uOver*.82);
      col += vec3(.8,.85,1.) * uFlash; a = max(a, uFlash);
      gl_FragColor = vec4(col, a);
    }`;

  function init(sc, rend, quality) {
    scene = sc; renderer = rend;
    // Physikalischer Himmel (atmosphärische Streuung)
    skyP = new THREEX.Sky(); skyP.scale.setScalar(1000); skyP.frustumCulled = false; scene.add(skyP);
    const su = skyP.material.uniforms;
    su.turbidity.value = 3; su.rayleigh.value = 1.2; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
    skyMat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false, transparent: true,
      uniforms: { sunDir: { value: sunDir }, moonDir: { value: moonDir }, uDay: { value: 1 }, uDusk: { value: 0 }, uOver: { value: 0 },
        uCloud: { value: .3 }, uTime: { value: 0 }, uFlash: { value: 0 }, uNight: { value: 0 } },
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(950, 48, 24), skyMat);
    sky.renderOrder = 1; sky.frustumCulled = false; scene.add(sky);
    // Eigene kleine Szene für die Umgebungs-Reflexionen
    envScene = new THREE.Scene();
    const skyP2 = new THREEX.Sky(); skyP2.scale.setScalar(900); skyP2.material = skyP.material; envScene.add(skyP2);
    const ov2 = new THREE.Mesh(sky.geometry, skyMat); ov2.renderOrder = 1; envScene.add(ov2);
    pm = new THREE.PMREMGenerator(renderer);

    hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6a5a48, 0.35); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
    sun.castShadow = true; sun.shadow.mapSize.set(CF.shadowRes || 2048, CF.shadowRes || 2048);
    const c = sun.shadow.camera; c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 320;
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
    scene.add(sun); scene.add(sun.target);

    // Nachtlichter
    const maxLights = quality !== 'leistung' ? 99 : 6;
    let n = 0;
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const l of CF.World.lamps) {
      if (l.type === 'flood') {
        if (n++ < maxLights) {
          const s = new THREE.SpotLight(0xfff1d6, 0, 190, 0.62, 0.55, 1.1);
          s.position.copy(l.pos); s.target.position.copy(l.target); scene.add(s); scene.add(s.target); spots.push(s);
        }
        const len = l.pos.distanceTo(l.target) * 0.9;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(0.5) * len, len, 24, 1, true), coneMat);
        cone.geometry.translate(0, -len / 2, 0);
        cone.position.copy(l.pos); cone.lookAt(l.target); cone.rotateX(-Math.PI / 2); scene.add(cone); cones.push(cone);
      } else if (n++ < maxLights + 4) {
        const p = new THREE.PointLight(0xffd9a0, 0, 22, 2); p.position.copy(l.pos); scene.add(p); points.push(p);
      }
    }
    cones.mat = coneMat;

    // Regen (Linien-Partikel um die Kamera)
    const g = new THREE.BufferGeometry();
    rainPos = new Float32Array(RAIN_N * 6); rainVel = new Float32Array(RAIN_N);
    for (let i = 0; i < RAIN_N; i++) { resetDrop(i, null, true); }
    g.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.45, depthWrite: false }));
    rain.frustumCulled = false; rain.visible = false; scene.add(rain);
    setTime(st.time);
  }
  function resetDrop(i, c, initial) {
    const cx = c ? c.x : 0, cy = c ? c.y : 0, cz = c ? c.z : 0;
    const x = cx + (Math.random() - 0.5) * 70, z = cz + (Math.random() - 0.5) * 70;
    const y = initial ? cy + Math.random() * 40 - 5 : cy + 25 + Math.random() * 15;
    rainVel[i] = 18 + Math.random() * 8;
    rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
    rainPos[i * 6 + 3] = x; rainPos[i * 6 + 4] = y + 0.55; rainPos[i * 6 + 5] = z;
  }

  function setTime(t) { st.time = ((t % 24) + 24) % 24; }
  function setWeather(k, instant) {
    if (!WEATHER[k]) return;
    st.weather = k;
    if (instant) Object.assign(st.cur, WEATHER[k]);
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function update(dt, focus, camPos, freeze) {
    // Uhrzeit
    if (st.dayLength > 0 && !freeze) st.time = (st.time + dt * 24 / (st.dayLength * 60)) % 24;
    // Automatischer Wetterwechsel
    if (st.auto && !freeze) { st.nextChange -= dt; if (st.nextChange <= 0) {
      const r = Math.random(); setWeather(r < 0.38 ? 'klar' : r < 0.62 ? 'wolkig' : r < 0.82 ? 'regen' : r < 0.9 ? 'gewitter' : 'nebel');
      st.nextChange = 180 + Math.random() * 240; CF.onWeather && CF.onWeather(WEATHER[st.weather].name); } }
    // Wetter weich überblenden
    const T = WEATHER[st.weather], k = 1 - Math.exp(-dt / 6);
    for (const key of ['cloud', 'overcast', 'rain', 'fogNear', 'fogFar', 'wind']) st.cur[key] += (T[key] - st.cur[key]) * k;
    st.wet = Math.min(1, Math.max(0, st.wet + (st.cur.rain > 0.2 ? dt / 25 : -dt / 90)));

    // Sonnenstand: Aufgang 6 Uhr, Untergang 20 Uhr
    const dayFrac = (st.time - 6) / 14;
    const ang = dayFrac * Math.PI;
    const el = Math.sin(ang) * 1.05 - 0.08; // max. ~ 55°
    const az = -0.6 + dayFrac * 2.6;
    sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    moonDir.set(-sunDir.x * 0.8, Math.abs(sunDir.y) * 0.8 + 0.25, -sunDir.z * 0.8).normalize();
    const e = sunDir.y;
    const day = smooth(-0.04, 0.32, e), dusk = smooth(-0.2, 0.0, e) * (1 - smooth(0.06, 0.3, e));
    const night = 1 - smooth(-0.18, 0.02, e);
    const over = st.cur.overcast;

    // Gewitter
    st.flash = Math.max(0, st.flash - dt * 4);
    if (T.storm || st.cur.rain > 1.1) { st.nextBolt -= dt; if (st.nextBolt <= 0) { st.flash = 1; st.nextBolt = 6 + Math.random() * 14; setTimeout(() => CF.Audio.thunder(), 400 + Math.random() * 1800); } }
    const fl = st.flash > 0.5 ? st.flash : st.flash * 0.3;

    const u = skyMat.uniforms;
    u.uDay.value = day; u.uDusk.value = dusk; u.uOver.value = over; u.uCloud.value = st.cur.cloud; u.uTime.value += dt * st.cur.wind; u.uFlash.value = fl * 0.6; u.uNight.value = night;
    sky.position.copy(camPos); skyP.position.copy(camPos);
    const su = skyP.material.uniforms;
    su.sunPosition.value.copy(sunDir);
    su.turbidity.value = 2.0 + over * 10 + dusk * 2; su.rayleigh.value = 0.9 + dusk * 1.3 + over * 1.5;
    su.mieCoefficient.value = 0.004 + over * 0.012;

    // Licht: Sonne tagsüber, Mond nachts
    const sunUp = e > -0.03;
    const lightDir = sunUp ? sunDir : moonDir;
    sun.position.copy(sun.target.position).add(tmpV.copy(lightDir).multiplyScalar(160));
    sun.target.position.set(Math.round(focus.x), 0, Math.round(focus.z));
    sun.position.copy(sun.target.position).add(tmpV.copy(lightDir).multiplyScalar(160));
    if (sunUp) {
      tmpC.setRGB(1, 0.55 + 0.42 * smooth(0, 0.4, e), 0.3 + 0.6 * smooth(0, 0.45, e));
      sun.color.copy(tmpC); sun.intensity = 2.1 * smooth(-0.03, 0.12, e) * (1 - over * 0.8);
    } else { sun.color.setRGB(0.55, 0.65, 1.0); sun.intensity = 0.35 * (1 - over * 0.7); }
    sun.castShadow = sun.intensity > 0.08;
    hemi.intensity = (0.1 + 0.25 * day) * (1 + over * 0.3) + fl * 2.5;
    hemi.color.setRGB(0.6 + 0.2 * day, 0.68 + 0.2 * day, 0.85 + 0.1 * day);
    hemi.groundColor.setRGB(0.25 * (0.3 + day), 0.22 * (0.3 + day), 0.2 * (0.3 + day));
    renderer.toneMappingExposure = 0.52 + night * 0.2 + over * 0.06;

    // Nebel-Farbe passend zum Horizont
    const fogC = scene.fog.color;
    fogC.setRGB(0.68, 0.8, 0.94).lerp(tmpC.setRGB(0.03, 0.045, 0.09), 1 - day);
    if (dusk > 0) fogC.lerp(tmpC.setRGB(0.85, 0.55, 0.38), dusk * 0.5);
    fogC.lerp(tmpC.setRGB(0.55 * (0.1 + day), 0.58 * (0.1 + day), 0.62 * (0.1 + day)), over * 0.7);
    scene.fog.near = st.cur.fogNear * (1 - night * 0.3); scene.fog.far = st.cur.fogFar * (1 - night * 0.35);

    // Lichter an, sobald es dunkel wird
    const on = smooth(0.12, -0.02, e) * 1 + over * 0.25 * smooth(0.3, 0.05, e);
    const lightsOn = Math.min(1, on);
    for (const s of spots) s.intensity = lightsOn * 0.9;
    for (const p of points) p.intensity = lightsOn * 0.4;
    cones.mat.opacity = 0; for (const c of cones) c.visible = false; // Lichtkegel nur als Option (wirkten unnatürlich)
    for (const nm of CF.World.nightMats) nm.mat.emissiveIntensity = nm.day + (nm.night - nm.day) * Math.max(lightsOn, night);

    // Nässe: Oberflächen werden dunkler und spiegeln
    const W = CF.World.M, wet = st.wet;
    CF.World.wetU.value = wet;
    for (const m of [W.ground, W.ramp, W.side, W.wood, W.asphalt, W.bowl, W.paintRed, W.paintBlue, W.paintYellow]) {
      if (!m) continue;
      if (m.userData.base === undefined) m.userData.base = m.color.clone();
      m.roughness = 1 - wet * 0.62; m.color.copy(m.userData.base).multiplyScalar(1 - wet * 0.32);
      m.envMapIntensity = (0.35 + 0.65 * day) * (1 + wet * 1.2);
    }
    for (const m of [W.metal, W.metalDark]) m.envMapIntensity = 0.3 + 0.7 * day;

    // Regen-Partikel
    const rv = st.cur.rain;
    rain.visible = rv > 0.03;
    if (rain.visible) {
      const active = Math.floor(RAIN_N * Math.min(1, rv));
      const wx = st.cur.wind * 1.2;
      for (let i = 0; i < RAIN_N; i++) {
        const o = i * 6;
        if (i >= active) { rainPos[o + 1] = rainPos[o + 4] = -999; continue; }
        const dy = rainVel[i] * dt;
        rainPos[o + 1] -= dy; rainPos[o + 4] -= dy; rainPos[o] += wx * dt; rainPos[o + 3] += wx * dt * 0.98;
        if (rainPos[o + 1] < camPos.y - 15 || rainPos[o + 1] < -1 || Math.abs(rainPos[o] - camPos.x) > 40 || Math.abs(rainPos[o + 2] - camPos.z) > 40) resetDrop(i, camPos, false);
      }
      rain.geometry.attributes.position.needsUpdate = true;
      rain.material.opacity = 0.25 + 0.3 * day;
      rain.material.color.setRGB(0.55 + 0.25 * day, 0.6 + 0.25 * day, 0.68 + 0.2 * day);
    }
    CF.Audio.setRain(Math.min(1, rv));

    // Umgebungs-Reflexionen alle paar Sekunden aus dem aktuellen Himmel neu berechnen
    envTimer -= dt;
    const key = [Math.round(e * 40), Math.round(over * 10), Math.round(st.cur.cloud * 10)].join(':');
    if (envTimer <= 0 && key !== lastEnvKey) {
      envTimer = 2; lastEnvKey = key;
      const saveFlash = u.uFlash.value; u.uFlash.value = 0;
      const rt = pm.fromScene(envScene, 0, 0.1, 1000);
      u.uFlash.value = saveFlash;
      if (envRT) envRT.dispose();
      envRT = rt; scene.environment = rt.texture;
    }
  }
  const tmpV = new THREE.Vector3();

  return {
    init, update, setTime, setWeather, WEATHER, KEYS, st,
    get timeString() { const h = Math.floor(st.time), m = Math.floor((st.time - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
    get wet() { return st.wet; },
    get isNight() { return sunDir.y < 0; },
  };
})();
