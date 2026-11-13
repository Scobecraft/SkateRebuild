/* Concrete Flow – Spieler-Physik, Tricks, Grinds, Bails */
window.CF = window.CF || {};
CF.Player = (() => {
  const W = CF.World;
  const Mods = CF.Mods = CF.Mods || { gravity: 1, pop: 1, speed: 1, noBail: false, infBalance: false, timeScale: 1 };
  let GRAV = 15, POP = 5.0, PUSH_MAX = 9.5;
  const STEP = 0.3, SPIN = 7.0, TAU = Math.PI * 2;
  // Sturz auslösen – im God-Mode (Admin) wird stattdessen weitergefahren
  const fail = reason => { if (Mods.noBail) return false; bail(reason); return true; };
  const angNorm = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const TRICKS = {
    ollie:    { name: 'Ollie', pts: 100, dur: 0 },
    kickflip: { name: 'Kickflip', pts: 300, dur: 0.42, rz: 1 },
    heelflip: { name: 'Heelflip', pts: 300, dur: 0.42, rz: -1 },
    shove:    { name: '360 Shove-It', pts: 280, dur: 0.45, ry: 1 },
    varial:   { name: 'Varial Kickflip', pts: 450, dur: 0.5, rz: 1, ry: 0.5 },
    tre:      { name: '360 Flip', pts: 650, dur: 0.55, rz: 1, ry: 1 },
    hard:     { name: 'Hardflip', pts: 550, dur: 0.5, rz: -1, rx: 1 },
  };

  const P = {
    x: 0, y: 0, z: 0, yaw: 0, s: 0,            // s = Geschwindigkeit entlang der Oberfläche (Boden)
    vx: 0, vy: 0, vz: 0,                       // Geschwindigkeit in der Luft
    gx: 0, gz: 0,                              // Gradient der aktuellen Oberfläche
    state: 'ground', spin: 0, flip: null, grab: null, airT: 0, maxY: 0,
    grind: null, balance: 0, drift: 0, bailT: 0, pushing: false, crouch: false,
    board: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0 }, airFlips: 0, launchY: 0,
    lastSafe: null,
  };

  function spawn(sp) {
    P.x = sp.x; P.z = sp.z; P.yaw = sp.yaw;
    P.y = sp.y !== undefined ? sp.y : W.groundAt(sp.x, sp.z, 50).h;
    const g = W.groundAt(P.x, P.z, P.y + 0.5); P.y = g.h; P.gx = g.gx; P.gz = g.gz;
    P.s = 0; P.vx = P.vy = P.vz = 0; P.state = 'ground'; P.flip = null; P.grab = null; P.grind = null; P.spin = 0;
    CF.Skater.root.rotation.set(0, P.yaw, 0);
  }

  /* ---------------- Boden ---------------- */
  function slopeAlong() {
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    return P.gx * fx + P.gz * fz;
  }
  function updateGround(dt, inp) {
    let m = slopeAlong();
    const G = Math.hypot(P.gx, P.gz);
    // Lenken
    const turn = 2.7 / (1 + Math.abs(P.s) * 0.055);
    P.yaw -= inp.steer * turn * dt;
    // Auf schrägen Wänden dreht die Schwerkraft das Board langsam bergab
    if (G > 0.05 && Math.abs(P.s) > 0.5) {
      const motion = P.s >= 0 ? P.yaw : P.yaw + Math.PI;
      const down = Math.atan2(-P.gx, -P.gz);
      const d = angNorm(down - motion);
      P.yaw += Math.sin(d) * Math.min(G, 3) * 0.55 * dt; // sin: stabil bei gerade hoch/runter
    }
    m = slopeAlong();
    const c = 1 / Math.sqrt(1 + m * m), sn = m * c;
    P.s -= GRAV * sn * dt;
    P.pushing = false;
    if (inp.push && Math.abs(m) < 0.5 && Math.abs(P.s) < PUSH_MAX) {
      P.s += (P.s < -0.4 ? -1 : 1) * 5.2 * Mods.speed * dt; P.pushing = true;
    }
    if (inp.brake) P.s -= Math.sign(P.s) * Math.min(Math.abs(P.s), 9 * dt);
    P.s -= Math.sign(P.s) * Math.min(Math.abs(P.s), (0.2 + 0.0022 * P.s * P.s) * dt);

    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    const hs = P.s * c;
    const nx = P.x + fx * hs * dt, nz = P.z + fz * hs * dt;
    const rise = Math.max(0, P.s * sn * dt);
    if (W.blocked(nx, nz, P.y, STEP + rise * 2)) {
      if (Math.abs(P.s) > 7.5 && fail('Gegen die Wand!')) return;
      if (Math.abs(P.s) > 2) { CF.Audio.wall(); CF.Input.rumble(0.5, 0.3, 120); }
      P.s = -P.s * 0.25; return;
    }
    const g = W.groundAt(nx, nz, P.y + STEP + rise * 2);
    const dropTol = 0.12 + Math.max(0, -P.s * sn * dt) * 2;
    const mNew = g.gx * fx + g.gz * fz;
    const lip = Math.abs(m) > 1.4 && Math.abs(mNew) < Math.abs(m) * 0.5 && P.s * sn > 0; // über die Coping hinaus
    if (g.h < P.y - dropTol || lip) {
      // Abheben: Geschwindigkeit entlang der Oberfläche übernehmen
      P.vx = fx * hs; P.vz = fz * hs; P.vy = P.s * sn;
      if (Math.abs(m) > 2.0 && G > 0) { // Vert-Assist: Rausfliegen aus Quarter/Bowl verhindern
        const ux = P.gx / G, uz = P.gz / G, d = P.vx * ux + P.vz * uz;
        P.vx -= ux * d * 0.97; P.vz -= uz * d * 0.97;
      }
      P.x = nx; P.z = nz;
      goAir(false);
      return;
    }
    P.x = nx; P.z = nz; P.y = g.h; P.gx = g.gx; P.gz = g.gz;
    if (Math.abs(m) < 0.05 && !g.bowl) P.lastSafe = { x: P.x, z: P.z, y: P.y, yaw: P.yaw };
  }

  function goAir(popped) {
    P.state = 'air'; P.spin = 0; P.airT = 0; P.maxY = P.y; P.launchY = P.y; P.airFlips = 0;
    CF.Score.leftGround();
  }

  function pop(T) {
    let vx, vy, vz;
    if (P.state === 'ground') {
      const m = slopeAlong(), c = 1 / Math.sqrt(1 + m * m), sn = m * c;
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      vx = fx * P.s * c; vz = fz * P.s * c; vy = P.s * sn;
      // Pop entlang der Oberflächennormalen (gemischt mit "oben")
      const nx = -P.gx, nz = -P.gz, nl = Math.hypot(nx, 1, nz);
      vx += (nx / nl) * POP * 0.6; vz += (nz / nl) * POP * 0.6; vy += (1 / nl) * POP * 0.6 + POP * 0.4;
    } else { // aus dem Grind
      const g = P.grind; vx = g.r.ux * g.dir * g.speed; vz = g.r.uz * g.dir * g.speed; vy = POP * 0.9;
      endGrind(true);
    }
    P.vx = vx; P.vy = vy; P.vz = vz;
    P.y += 0.02;
    goAir(true);
    CF.Audio.pop(); CF.Input.rumble(0.15, 0.5, 70, true);
  }

  function doTrick(key) {
    const T = TRICKS[key]; if (!T) return;
    if (P.state === 'bail') return;
    if (P.state === 'ground' || P.state === 'grind') {
      pop(T);
      CF.Score.add(T.name, T.pts);
      if (T.dur) { P.flip = Object.assign({ t: 0 }, T); P.airFlips++; CF.Audio.flip(); }
    } else if (P.state === 'air') {
      if (key === 'ollie' || P.flip || P.grab) return;
      P.flip = Object.assign({ t: 0 }, T); P.airFlips++; CF.Audio.flip();
      CF.Score.add(T.name, Math.round(T.pts * 0.8));
    }
  }

  /* ---------------- Luft ---------------- */
  function updateAir(dt, inp) {
    P.airT += dt;
    P.vy -= GRAV * dt;
    const sp = inp.steer * SPIN * dt;
    P.yaw -= sp; P.spin -= sp;
    const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt, ny = P.y + P.vy * dt;
    // Hindernisse seitlich
    if (W.blocked(nx, nz, Math.max(P.y, ny), 0.6)) {
      const imp = Math.hypot(P.vx, P.vz);
      if (!W.blocked(nx, P.z, Math.max(P.y, ny), 0.6)) { P.vz *= -0.3; }
      else if (!W.blocked(P.x, nz, Math.max(P.y, ny), 0.6)) { P.vx *= -0.3; }
      else { P.vx *= -0.3; P.vz *= -0.3; }
      if (imp > 9 && fail('Gegen die Kante!')) return;
      CF.Audio.wall(); CF.Input.rumble(0.4, 0.2, 100);
      return;
    }
    // Grind-Check
    if (P.vy < 0 && tryGrind(P.y, nx, ny, nz)) return;
    const g = W.groundAt(nx, nz, P.y + 0.6);
    if (ny <= g.h) { P.x = nx; P.z = nz; P.y = g.h; land(g); return; }
    P.x = nx; P.y = ny; P.z = nz;
    P.maxY = Math.max(P.maxY, P.y);
    if (P.y < -20) respawnSafe();
  }

  function land(g) {
    // Flip nicht fertig?
    if (P.flip && P.flip.t / P.flip.dur < 0.82 && fail('Flip nicht fertig gedreht')) return;
    P.flip = null;
    // Geschwindigkeit in Oberflächen-Koordinaten zerlegen
    const G = Math.hypot(g.gx, g.gz);
    let Vx, Vz, vn;
    if (G < 1e-3) { Vx = P.vx; Vz = P.vz; vn = P.vy; }
    else {
      const ux = g.gx / G, uz = g.gz / G, px = -uz, pz = ux;
      const c = 1 / Math.sqrt(1 + G * G), sn = G * c;
      const vh = P.vx * ux + P.vz * uz;
      const va = vh * c + P.vy * sn, vl = P.vx * px + P.vz * pz;
      vn = -vh * sn + P.vy * c;
      Vx = ux * va + px * vl; Vz = uz * va + pz * vl;
    }
    const impact = -vn;
    if (impact > 16 && fail('Zu harte Landung!')) return;
    const sp = Math.hypot(Vx, Vz);
    if (sp > 2) {
      const hv = Math.atan2(Vx, Vz), d = angNorm(hv - P.yaw);
      if (Math.abs(d) < 0.85) { P.yaw = hv; P.s = sp; }
      else if (Math.abs(d) > Math.PI - 0.85) { P.yaw = hv + Math.PI; P.s = -sp; }
      else { if (fail('Schräg gelandet')) return; P.yaw = hv; P.s = sp; }
    } else P.s = Vx * Math.sin(P.yaw) + Vz * Math.cos(P.yaw);
    if (P.grab) P.grab = null;
    P.state = 'ground'; P.gx = g.gx; P.gz = g.gz;
    const halves = Math.round(Math.abs(P.spin) / Math.PI);
    if (halves >= 1) CF.Score.add((P.spin > 0 ? 'FS ' : 'BS ') + halves * 180, halves * 220, { spin: halves * 180 });
    const drop = P.maxY - P.y;
    CF.Score.landed({ drop, flips: P.airFlips, airT: P.airT });
    const hard = clamp(impact / 16, 0, 1);
    CF.Audio.land(hard); CF.Input.rumble(0.25 + hard * 0.75, 0.3 + hard * 0.4, 90 + hard * 160, true);
  }

  /* ---------------- Grinds ---------------- */
  function tryGrind(prevY, nx, ny, nz) {
    const hv = Math.hypot(P.vx, P.vz);
    if (hv < 1.2) return false;
    for (const r of W.rails) {
      const t = ((nx - r.a.x) * r.dx + (nz - r.a.z) * r.dz) / (r.lenXZ * r.lenXZ);
      if (t < 0 || t > 1) continue;
      const cx = r.a.x + r.dx * t, cz = r.a.z + r.dz * t;
      if (Math.hypot(nx - cx, nz - cz) > 0.5) continue;
      const ry = r.a.y + (r.b.y - r.a.y) * t;
      if (ny > ry + 0.15 || ny < ry - 0.4 || prevY < ry - 0.45) continue; // Grind-Magnet: leicht unterhalb wird hochgezogen
      const dot = (P.vx * r.ux + P.vz * r.uz) / hv;
      if (Math.abs(dot) < 0.22) continue;
      if (P.flip && P.flip.t / P.flip.dur < 0.82 && fail('Flip nicht fertig gedreht')) return true;
      startGrind(r, t, Math.sign(dot), Math.max(3, hv * Math.abs(dot) + 0.5));
      return true;
    }
    return false;
  }
  function grindName(r, yawOff) {
    const a = Math.abs(Math.atan2(Math.sin(yawOff), Math.cos(yawOff)));
    const aa = Math.min(a, Math.PI - a) * 180 / Math.PI; // 0..90
    if (r.id === 'coping') return aa < 30 ? '50-50 Stall' : aa > 60 ? 'Rock\'n\'Roll' : 'Smith Grind';
    if (aa < 25) return '50-50 Grind';
    if (aa > 62) return r.metal ? 'Boardslide' : 'Noseslide';
    return 'Crooked Grind';
  }
  function startGrind(r, t, dir, speed) {
    P.flip = null; P.grab = null;
    const railYaw = Math.atan2(r.ux * dir, r.uz * dir);
    const off = angNorm(P.yaw - railYaw);
    // Board leicht in die nächste "saubere" Position einrasten
    const snaps = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
    let best = off; for (const s of snaps) if (Math.abs(angNorm(off - s)) < 0.45) best = s;
    P.grind = { r, t, dir, speed, yawOff: best, time: 0, name: grindName(r, best) };
    P.yaw = railYaw + best;
    P.state = 'grind'; P.spin = 0;
    P.balance = (Math.random() - 0.5) * 0.15; P.drift = (Math.random() - 0.5) * 0.9;
    const label = r.name && r.name !== 'Coping' ? `${P.grind.name} (${r.name})` : P.grind.name;
    CF.Score.add(label, 160, { grind: true, railId: r.id });
    CF.Audio.grindStart(r.metal); CF.Input.rumble(0.35, 0.6, 110, true);
  }
  function updateGrind(dt, inp) {
    const g = P.grind, r = g.r;
    g.time += dt;
    const slope = (r.b.y - r.a.y) / r.len3 * g.dir; // >0 = bergauf
    g.speed += -GRAV * slope * dt - (r.metal ? 0.35 : 0.7) * dt;
    g.t += g.dir * g.speed * dt / r.lenXZ;
    // Balance
    P.drift += (Math.random() - 0.5) * 2.2 * dt; P.drift = clamp(P.drift, -0.9, 0.9);
    P.balance += (P.balance * 1.0 + P.drift * 0.45) * dt + inp.steer * 2.1 * dt;
    if (Mods.infBalance) P.balance *= 0.9;
    if (Math.abs(P.balance) > 1) { if (fail('Balance verloren')) return; P.balance = 0; }
    CF.Score.grindTick(dt);
    if (g.t < 0 || g.t > 1 || g.speed < 0.8) {
      const end = g.t > 1 ? r.b : r.a;
      // Nahtlos zur nächsten Rail (z. B. Bowl-Coping) wechseln
      const next = g.speed >= 0.8 && W.rails.find(o => o !== r && (o.a.distanceTo(end) < 0.12 || o.b.distanceTo(end) < 0.12) &&
        Math.abs(o.ux * r.ux + o.uz * r.uz) > 0.75);
      if (next) {
        const atA = next.a.distanceTo(end) < 0.12;
        g.r = next; g.t = atA ? 0.001 : 0.999; g.dir = atA ? 1 : -1;
        P.yaw = Math.atan2(next.ux * g.dir, next.uz * g.dir) + g.yawOff;
        return;
      }
      g.t = clamp(g.t, 0, 1);
      P.vx = r.ux * g.dir * g.speed; P.vz = r.uz * g.dir * g.speed; P.vy = 1.2;
      endGrind(false);
      goAir(false);
      return;
    }
    P.x = r.a.x + r.dx * g.t; P.z = r.a.z + r.dz * g.t; P.y = r.a.y + (r.b.y - r.a.y) * g.t;
    if (Math.random() < dt * 8) CF.Input.rumble(0.08, 0.35, 70);
  }
  function endGrind() {
    const g = P.grind; if (!g) return;
    // Board wieder in Fahrtrichtung drehen
    const railYaw = Math.atan2(g.r.ux * g.dir, g.r.uz * g.dir);
    P.yaw = Math.abs(angNorm(P.yaw - railYaw)) <= Math.PI / 2 ? railYaw : railYaw + Math.PI;
    CF.Score.grindEnd(g.time, g.r.id);
    P.grind = null; P.state = 'air';
  }

  /* ---------------- Sturz ---------------- */
  function bail(reason) {
    if (P.state === 'bail') return;
    const wasGrind = P.state === 'grind';
    if (wasGrind) { const g = P.grind; P.vx = g.r.ux * g.dir * g.speed; P.vz = g.r.uz * g.dir * g.speed; P.vy = 0; P.grind = null; }
    if (P.state === 'ground') { const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); P.vx = fx * P.s; P.vz = fz * P.s; P.vy = 1; }
    P.state = 'bail'; P.bailT = 0; P.flip = null; P.grab = null;
    const b = P.board; b.x = 0; b.y = 0; b.z = 0; b.vx = (Math.random() - 0.5) * 3; b.vy = 3 + Math.random() * 2; b.vz = (Math.random() - 0.5) * 4; b.r = 0;
    CF.Score.bail(reason);
    CF.Audio.bail(); CF.Input.rumble(1, 1, 450, true);
  }
  function updateBail(dt) {
    P.bailT += dt;
    P.vy -= GRAV * dt;
    const f = Math.exp(-2.2 * dt); P.vx *= f; P.vz *= f;
    const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
    if (!W.blocked(nx, nz, P.y, 0.4)) { P.x = nx; P.z = nz; } else { P.vx *= -0.3; P.vz *= -0.3; }
    P.y += P.vy * dt;
    const g = W.groundAt(P.x, P.z, P.y + 0.5);
    if (P.y <= g.h) { P.y = g.h; P.vy = 0; }
    const b = P.board; b.vy -= GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.r += dt * 9;
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * 0.35; b.vx *= 0.7; b.vz *= 0.7; }
    if (P.bailT > 2.2) recover();
  }
  function recover() {
    const g = W.groundAt(P.x, P.z, P.y + 0.5);
    const G = Math.hypot(g.gx, g.gz);
    if (G > 0.6 || g.bowl) { respawnSafe(); return; }
    P.y = g.h; P.gx = g.gx; P.gz = g.gz; P.s = 0; P.state = 'ground';
  }
  function respawnSafe() {
    const s = P.lastSafe || W.defaultSpawn();
    spawn({ x: s.x, z: s.z, yaw: s.yaw, y: s.y });
  }

  /* ---------------- Haupt-Update ---------------- */
  function update(dt, inp) {
    GRAV = 15 * Mods.gravity; POP = 5.0 * Mods.pop; PUSH_MAX = 9.5 * Mods.speed;
    if (inp.trick) doTrick(inp.trick);
    P.crouch = inp.crouch && P.state !== 'bail';
    // Grabs
    const grabKey = inp.grabMelon ? 'Melon Grab' : inp.grabIndy ? 'Indy Grab' : null;
    if (P.state === 'air' && grabKey && !P.grab && !P.flip && P.airT > 0.12) { P.grab = grabKey; CF.Score.add(grabKey, 180); CF.Input.rumble(0.1, 0.3, 60); }
    if (P.grab && !grabKey) P.grab = null;
    if (P.grab && P.state === 'air') CF.Score.grabTick(dt);

    const steps = 4, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (P.state === 'ground') updateGround(h, inp);
      else if (P.state === 'air') updateAir(h, inp);
      else if (P.state === 'grind') updateGrind(h, inp);
      else if (P.state === 'bail') updateBail(h);
    }
    if (P.flip) { P.flip.t += dt; if (P.flip.t >= P.flip.dur) P.flip = null; }
    if (inp.reset) { CF.Score.cancel(); respawnSafe(); }
  }

  /* Visuals in das Modell schreiben */
  let pitch = 0, roll = 0;
  function sync(dt, inp) {
    const S = CF.Skater, root = S.root;
    root.position.set(P.x, P.y, P.z);
    root.rotation.y = P.yaw;
    let targetPitch = 0, targetRoll = 0;
    if (P.state === 'ground') {
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      targetPitch = -Math.atan(P.gx * fx + P.gz * fz);
      targetRoll = Math.atan(P.gx * fz - P.gz * fx);
    } else if (P.state === 'grind') {
      const r = P.grind.r; targetPitch = -Math.atan((r.b.y - r.a.y) / r.lenXZ * P.grind.dir) * Math.cos(P.grind.yawOff);
    }
    const k = 1 - Math.exp(-dt * (P.state === 'air' ? 3 : 14));
    pitch += (targetPitch - pitch) * k; roll += (targetRoll - roll) * k;
    root.rotation.x = pitch; root.rotation.z = roll + (P.state === 'grind' ? P.balance * 0.25 : 0);

    const bp = S.boardPivot;
    if (P.state === 'bail') {
      const b = P.board; bp.position.set(b.x, 0.075 + b.y, b.z); bp.rotation.set(b.r, b.r * 0.7, 0);
      S.bailPose(P.bailT);
      return;
    }
    bp.position.set(0, 0.075, 0); bp.rotation.set(0, 0, 0);
    let lift = 0;
    if (P.flip) {
      const p = Math.min(1, P.flip.t / P.flip.dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      bp.rotation.set((P.flip.rx || 0) * TAU * e, (P.flip.ry || 0) * TAU * e, (P.flip.rz || 0) * TAU * e);
      lift = Math.sin(p * Math.PI) * 0.28;
    }
    if (P.grab) { lift = 0.18; bp.rotation.z = 0.25; }
    bp.position.y += lift;
    S.body.position.y = 0.1 + lift * 0.6;
    S.animate(dt, {
      crouch: P.crouch || (P.state === 'air' && P.airT < 0.15), pushing: P.pushing && P.state === 'ground',
      air: P.state === 'air', grab: P.grab, lean: P.state === 'ground' ? -inp.steer * Math.sign(P.s || 1) : 0,
      grindBalance: P.state === 'grind' ? P.balance : undefined,
    });
    S.body.position.y += lift * 0.6;
  }

  return {
    P, spawn, update, sync, TRICKS, respawnSafe, bail: r => fail(r),
    get speed() { return P.state === 'ground' ? Math.abs(P.s) : P.state === 'grind' ? P.grind.speed : Math.hypot(P.vx, P.vz, P.vy); },
    get heading() { // Bewegungsrichtung für die Kamera
      if (P.state === 'ground') return Math.abs(P.s) > 0.6 ? (P.s >= 0 ? P.yaw : P.yaw + Math.PI) : null;
      if (P.state === 'grind') return Math.atan2(P.grind.r.ux * P.grind.dir, P.grind.r.uz * P.grind.dir);
      return Math.hypot(P.vx, P.vz) > 1 ? Math.atan2(P.vx, P.vz) : null;
    },
  };
})();
