/* Concrete Flow – Freecam + Replay der letzten 2 Minuten */
window.CF = window.CF || {};

/* ---------------- Freie Kamera ---------------- */
CF.FreeCam = (() => {
  const pos = new THREE.Vector3(); let yaw = 0, pitch = 0, fov = 60;
  const I = () => CF.Input.raw;
  function start(camera) {
    pos.copy(camera.position);
    const d = new THREE.Vector3(); camera.getWorldDirection(d);
    yaw = Math.atan2(d.x, d.z); pitch = Math.asin(Math.max(-1, Math.min(1, d.y))); fov = camera.fov;
  }
  function update(dt, camera, opts = {}) {
    const r = I(); r.poll();
    const k = r.key;
    let fwd = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0) - r.axis(1);
    let side = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0) + r.axis(0);
    let up = (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0) + (r.btn(7) ? 1 : 0) - (r.btn(6) ? 1 : 0);
    const fast = k('ShiftLeft') || k('ShiftRight') || r.btn(10) ? 3.5 : 1;
    const sp = 9 * fast * dt;
    const [lx, ly] = r.look;
    yaw -= lx * 0.0035 + (r.axis(2) + (k('KeyL') ? 1 : 0) - (k('KeyJ') ? 1 : 0)) * 2.2 * dt;
    pitch -= ly * 0.0035 + (r.axis(3) + (k('KeyK') ? 1 : 0) - (k('KeyI') ? 1 : 0)) * 1.8 * dt;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    pos.x += (fx * fwd - fz * side) * sp; pos.z += (fz * fwd + fx * side) * sp; pos.y += up * sp;
    // Richtung "vorwärts" folgt auch der Neigung, damit man frei fliegen kann
    pos.y += Math.sin(pitch) * fwd * sp * 0.9;
    pos.x = Math.max(-400, Math.min(400, pos.x)); pos.z = Math.max(-400, Math.min(400, pos.z));
    const gh = CF.World.groundAt(pos.x, pos.z, pos.y + 0.1).h;
    pos.y = Math.max(gh + 0.15, Math.min(250, pos.y));
    if (opts.wheelFov) { fov = Math.max(15, Math.min(110, fov + r.wheel * 3)); }
    camera.position.copy(pos);
    camera.lookAt(pos.x + Math.sin(yaw) * Math.cos(pitch), pos.y + Math.sin(pitch), pos.z + Math.cos(yaw) * Math.cos(pitch));
    camera.fov = fov; camera.updateProjectionMatrix();
  }
  return { start, update, get fov() { return fov; }, set fov(v) { fov = v; }, pos };
})();

/* ---------------- Replay ---------------- */
CF.Replay = (() => {
  const HZ = 30, SECONDS = 120, N = HZ * SECONDS, PS = 21;
  let stride = PS, buf = null, head = 0, count = 0, acc = 0, npcCount = -1;
  let cursor = 0, playing = true, speed = 1, camMode = 'follow', uiHidden = false;
  const SPEEDS = [0.25, 0.5, 1, 2];
  const $ = id => document.getElementById(id);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  function alloc() {
    npcCount = CF.NPC.count; stride = PS + npcCount * CF.NPC.STRIDE;
    buf = new Float32Array(N * stride); head = 0; count = 0;
  }
  function clear() { alloc(); }

  /* Aufnahme: Visual-Zustand des Spielers + NPCs */
  function record(dt) {
    if (!buf || npcCount !== CF.NPC.count) alloc();
    acc += dt;
    while (acc >= 1 / HZ) {
      acc -= 1 / HZ;
      const o = head * stride, S = CF.Skater, P = CF.Player.P;
      const r = S.root, bp = S.boardPivot;
      buf[o] = r.position.x; buf[o + 1] = r.position.y; buf[o + 2] = r.position.z;
      buf[o + 3] = r.rotation.x; buf[o + 4] = r.rotation.y; buf[o + 5] = r.rotation.z;
      buf[o + 6] = bp.position.x; buf[o + 7] = bp.position.y; buf[o + 8] = bp.position.z;
      buf[o + 9] = bp.rotation.x; buf[o + 10] = bp.rotation.y; buf[o + 11] = bp.rotation.z;
      buf[o + 12] = S.body.position.y;
      buf[o + 13] = P.crouch ? 1 : 0; buf[o + 14] = P.pushing && P.state === 'ground' ? 1 : 0; buf[o + 15] = P.state === 'air' ? 1 : 0;
      buf[o + 16] = P.grab === 'Melon Grab' ? 1 : P.grab ? 2 : 0;
      buf[o + 17] = P.state === 'grind' ? P.balance : -9;
      buf[o + 18] = P.state === 'bail' ? P.bailT : -1;
      buf[o + 19] = CF.Env.st.time; buf[o + 20] = P.state === 'grind' ? 1 : 0;
      CF.NPC.snapshot(buf, o + PS);
      head = (head + 1) % N; count = Math.min(N, count + 1);
    }
  }
  const idx = i => ((head - count + Math.max(0, Math.min(count - 1, i))) % N + N) % N;

  function applyFrame(f, dt) {
    const o = idx(f) * stride, S = CF.Skater;
    S.root.position.set(buf[o], buf[o + 1], buf[o + 2]); S.root.rotation.set(buf[o + 3], buf[o + 4], buf[o + 5]);
    S.boardPivot.position.set(buf[o + 6], buf[o + 7], buf[o + 8]); S.boardPivot.rotation.set(buf[o + 9], buf[o + 10], buf[o + 11]);
    if (buf[o + 18] >= 0) S.bailPose(buf[o + 18]);
    else {
      const g = buf[o + 16];
      S.animate(dt, { crouch: buf[o + 13] > 0.5, pushing: buf[o + 14] > 0.5, air: buf[o + 15] > 0.5, grab: g === 1 ? 'Melon Grab' : g === 2 ? 'Indy Grab' : null, lean: 0, grindBalance: buf[o + 17] > -5 ? buf[o + 17] : undefined });
      S.body.position.y = buf[o + 12];
    }
    CF.NPC.restore(buf, o + PS, dt);
    return o;
  }

  /* ---------------- Wiedergabe ---------------- */
  function enter(camera) {
    if (!buf || count < HZ) return false;
    cursor = Math.max(0, count - HZ * 10); playing = true; speed = 1; camMode = 'follow';
    camPos.copy(camera.position); camLook.set(buf[idx(cursor) * stride], buf[idx(cursor) * stride + 1] + 1, buf[idx(cursor) * stride + 2]);
    $('replay').classList.add('show'); uiHidden = false; $('replay').classList.remove('hidden');
    render();
    return true;
  }
  function exit() { $('replay').classList.remove('show'); }

  function update(dt, camera) {
    const r = CF.Input.raw; r.poll();
    const P = k => r.pressed(k);
    if (P('Space') || P('GP0')) playing = !playing;
    const big = r.key('ShiftLeft') ? 10 : 2;
    if (P('ArrowLeft') || P('GP4') || P('GP14')) { cursor -= HZ * big; }
    if (P('ArrowRight') || P('GP5') || P('GP15')) { cursor += HZ * big; }
    if (P('Comma')) { cursor -= 1; playing = false; }
    if (P('Period')) { cursor += 1; playing = false; }
    if (P('ArrowUp') || P('GP12')) speed = SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)];
    if (P('ArrowDown') || P('GP13')) speed = SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)];
    if (P('KeyC') || P('GP3')) { camMode = camMode === 'follow' ? 'free' : camMode === 'free' ? 'orbit' : 'follow'; if (camMode === 'free') CF.FreeCam.start(camera); }
    if (P('KeyH')) { uiHidden = !uiHidden; $('replay').classList.toggle('hidden', uiHidden); }
    if (playing) cursor += dt * HZ * speed;
    if (cursor >= count - 1) { cursor = count - 1; playing = false; }
    cursor = Math.max(0, cursor);
    const o = applyFrame(Math.floor(cursor), playing ? dt * speed : 0.0001);
    const px = buf[o], py = buf[o + 1], pz = buf[o + 2];
    if (camMode === 'free') CF.FreeCam.update(dt, camera, { wheelFov: true });
    else {
      // Kamera-Richtung aus der Bewegung der letzten Frames
      const o2 = idx(Math.max(0, Math.floor(cursor) - 6)) * stride;
      let hx = px - buf[o2], hz = pz - buf[o2 + 2]; const hl = Math.hypot(hx, hz);
      if (hl < 0.05) { hx = Math.sin(buf[o + 4]); hz = Math.cos(buf[o + 4]); } else { hx /= hl; hz /= hl; }
      let tx, ty, tz;
      if (camMode === 'orbit') { const a = performance.now() / 4000; tx = px + Math.cos(a) * 6; tz = pz + Math.sin(a) * 6; ty = py + 2.2; }
      else { tx = px - hx * 5; tz = pz - hz * 5; ty = py + 2; }
      ty = Math.max(ty, CF.World.groundAt(tx, tz, py + 2).h + 0.6);
      const k = 1 - Math.exp(-dt * 6);
      camPos.lerp(new THREE.Vector3(tx, ty, tz), k); camLook.lerp(new THREE.Vector3(px, py + 0.9, pz), k * 1.5);
      camera.position.copy(camPos); camera.lookAt(camLook); camera.fov = 65; camera.updateProjectionMatrix();
    }
    render();
    return { exit: P('Escape') || P('GP1'), photo: P('KeyP') || P('GP2') };
  }
  function render() {
    const total = count / HZ, cur = cursor / HZ;
    const fmt = s => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
    $('rp-bar').style.width = (count > 1 ? cursor / (count - 1) * 100 : 0) + '%';
    $('rp-time').textContent = `${fmt(cur)} / ${fmt(total)}`;
    $('rp-state').textContent = (playing ? '▶' : '❚❚') + `  ${speed}×  ·  Kamera: ${camMode === 'follow' ? 'Folgen' : camMode === 'free' ? 'Freecam' : 'Orbit'}`;
  }
  function seekFraction(f) { cursor = f * (count - 1); playing = false; }

  return { record, clear, enter, exit, update, seekFraction, get length() { return count / HZ; } };
})();
