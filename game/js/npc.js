/* Concrete Flow – NPC-Skater, die im Park unterwegs sind */
window.CF = window.CF || {};
CF.NPC = (() => {
  const W = CF.World;
  const NAMES = ['Mika', 'Jonte', 'Lou', 'Ayla', 'Kenji', 'Rosa', 'Tariq', 'Ida', 'Bo', 'Nele', 'Sami', 'Vik'];
  const ROUTES = {
    loopA: [[-100, -10], [48, -10], [52, -4], [52, 78], [44, 82], [-100, 80], [-104, 74], [-104, -4]],
    loopB: [[-80, -45], [16, -45], [18, -38], [16, -30], [-80, -30], [-84, -38]],
  };
  const FLIPS = [['Kickflip', 0, 0, 1], ['Heelflip', 0, 0, -1], ['Shove-It', 0, 1, 0], ['360 Flip', 0, 1, 1], ['Hardflip', 1, 0, -1]];
  const npcs = [];
  let scene, count = 0;
  const SPECS = [
    { kind: 'route', route: 'loopA', dir: 1, speed: 7 },
    { kind: 'pipe', cx: 78, z: -46, amp: 11.6, period: 4.6 },
    { kind: 'bowl', cx: 72, cz: 48, r: 6.6, speed: 6.5 },
    { kind: 'route', route: 'loopB', dir: 1, speed: 6.5 },
    { kind: 'pipe', cx: 75, z: -24, amp: 7.4, period: 3.4 },
    { kind: 'route', route: 'loopA', dir: -1, speed: 7.5, start: 4 },
    { kind: 'bowl', cx: 98, cz: 30, r: 4.6, speed: 5.5 },
    { kind: 'route', route: 'loopB', dir: -1, speed: 7, start: 3 },
    { kind: 'route', route: 'loopA', dir: 1, speed: 6, start: 2 },
    { kind: 'bowl', cx: 96, cz: 70, r: 3.6, speed: 4.5 },
    { kind: 'route', route: 'loopA', dir: -1, speed: 6.8, start: 6 },
    { kind: 'route', route: 'loopB', dir: 1, speed: 7.2, start: 2 },
  ];

  function nameTag(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.roundRect ? g.roundRect(8, 10, 240, 44, 22) : g.rect(8, 10, 240, 44); g.fill();
    g.fillStyle = '#fff'; g.font = '700 30px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
    s.scale.set(1.2, 0.3, 1); s.position.y = 2.15; return s;
  }

  function make(i) {
    const spec = SPECS[i % SPECS.length];
    const sk = CF.makeSkater();
    sk.init(scene, (i * 3 + 1) % CF.OUTFITS.length);
    const tag = nameTag(NAMES[i % NAMES.length]); sk.root.add(tag);
    const n = { sk, spec, tag, name: NAMES[i % NAMES.length], x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, v: spec.speed || 6,
      wp: spec.start || 0, jy: 0, jvy: 0, air: false, flip: null, nextTrick: 2 + Math.random() * 5, phase: Math.random() * Math.PI * 2, crouch: 0, pushT: 0 };
    if (spec.kind === 'route') { const p = ROUTES[spec.route][n.wp]; n.x = p[0]; n.z = p[1]; }
    npcs.push(n);
    return n;
  }
  function init(sc, n) { scene = sc; setCount(n); }
  function setCount(n) {
    n = Math.max(0, Math.min(SPECS.length, n));
    while (npcs.length > n) { const o = npcs.pop(); scene.remove(o.sk.root); }
    while (npcs.length < n) make(npcs.length);
    count = n;
  }
  const angN = a => Math.atan2(Math.sin(a), Math.cos(a));

  function update(dt, player) {
    for (const n of npcs) {
      const s = n.spec;
      let speed = 0;
      if (s.kind === 'route') {
        const R = ROUTES[s.route], tgt = R[n.wp];
        const dx = tgt[0] - n.x, dz = tgt[1] - n.z, d = Math.hypot(dx, dz);
        if (d < 2.5) n.wp = (n.wp + s.dir + R.length) % R.length;
        const want = Math.atan2(dx, dz);
        n.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, angN(want - n.yaw)));
        // Dem Spieler ausweichen / abbremsen
        let target = s.speed;
        if (player) {
          const px = player.x - n.x, pz = player.z - n.z, pd = Math.hypot(px, pz);
          const ahead = (px * Math.sin(n.yaw) + pz * Math.cos(n.yaw)) / (pd || 1);
          if (pd < 6 && ahead > 0.6) { target = Math.min(target, Math.max(0, pd - 1.5)); n.yaw += angN(Math.atan2(px, pz) + 1.2 - n.yaw) * dt * 0.8; }
        }
        n.v += (target - n.v) * Math.min(1, dt * 1.5);
        n.x += Math.sin(n.yaw) * n.v * dt; n.z += Math.cos(n.yaw) * n.v * dt;
        const g = W.groundAt(n.x, n.z, n.y + 0.4);
        n.y += (g.h - n.y) * Math.min(1, dt * 12);
        n.pitch = -Math.atan(g.gx * Math.sin(n.yaw) + g.gz * Math.cos(n.yaw));
        n.pushT = n.v < target - 0.3 ? 0.5 : Math.max(0, n.pushT - dt);
        speed = n.v;
        // Tricks
        n.nextTrick -= dt;
        if (n.nextTrick <= 0 && !n.air && n.v > 4) { n.air = true; n.jvy = 4.6; n.flip = Math.random() < 0.75 ? { f: FLIPS[Math.floor(Math.random() * FLIPS.length)], t: 0 } : null; n.nextTrick = 3 + Math.random() * 6; }
      } else if (s.kind === 'pipe') {
        const w = Math.PI * 2 / s.period;
        n.phase += w * dt;
        const sx = Math.sin(n.phase), vx = s.amp * w * Math.cos(n.phase);
        n.x = s.cx + s.amp * sx; n.z = s.z;
        const g = W.groundAt(n.x, n.z, 20);
        n.y = g.h;
        // Board zeigt in Fahrtrichtung, am Umkehrpunkt dreht der Skater (Kickturn)
        const want = vx >= 0 ? Math.PI / 2 : -Math.PI / 2;
        n.yaw += angN(want - n.yaw) * Math.min(1, dt * 6);
        n.pitch = -Math.atan(g.gx * Math.sin(n.yaw));
        speed = Math.abs(vx); n.pushT = 0;
      } else if (s.kind === 'bowl') {
        n.phase += s.speed / s.r * dt;
        const r = s.r + Math.sin(n.phase * 2.3) * s.r * 0.22;
        n.x = s.cx + Math.cos(n.phase) * r; n.z = s.cz + Math.sin(n.phase) * r;
        const g = W.groundAt(n.x, n.z, 1);
        n.y = g.h;
        n.yaw = Math.atan2(-Math.sin(n.phase), Math.cos(n.phase));
        n.pitch = -Math.atan(g.gx * Math.sin(n.yaw) + g.gz * Math.cos(n.yaw));
        n.roll = Math.atan(g.gx * Math.cos(n.yaw) - g.gz * Math.sin(n.yaw));
        speed = s.speed;
      }
      // Sprung/Flip (Routen)
      if (n.air) {
        n.jvy -= 15 * dt; n.jy += n.jvy * dt;
        if (n.flip) n.flip.t += dt;
        if (n.jy <= 0) { n.jy = 0; n.air = false; n.flip = null; }
      }
      n.speed = speed;
      apply(n, dt);
    }
  }
  function apply(n, dt) {
    const sk = n.sk;
    sk.root.position.set(n.x, n.y + n.jy, n.z);
    sk.root.rotation.set(n.pitch, n.yaw, n.roll || 0);
    const bp = sk.boardPivot; bp.rotation.set(0, 0, 0); bp.position.set(0, 0.075, 0);
    if (n.flip) {
      const p = Math.min(1, n.flip.t / 0.5), f = n.flip.f;
      bp.rotation.set(f[1] * Math.PI * 2 * p, f[2] * Math.PI * 2 * p, f[3] * Math.PI * 2 * p);
      bp.position.y += Math.sin(p * Math.PI) * 0.25;
    }
    if (dt > 0) sk.animate(dt, { crouch: n.air && n.jvy > 2, pushing: n.pushT > 0, air: n.air, lean: 0 });
  }

  /* Bei Zusammenstoß mit dem Spieler */
  function collide(P, speed) {
    for (const n of npcs) {
      const d = Math.hypot(P.x - n.x, P.z - n.z);
      if (d < 0.75 && Math.abs(P.y - (n.y + n.jy)) < 1.0 && (speed > 3 || n.speed > 3)) return n;
    }
    return null;
  }

  /* Replay-Schnittstelle */
  const STRIDE = 12;
  function snapshot(arr, o) {
    for (const n of npcs) {
      const bp = n.sk.boardPivot;
      arr[o++] = n.x; arr[o++] = n.y + n.jy; arr[o++] = n.z; arr[o++] = n.yaw; arr[o++] = n.pitch; arr[o++] = n.roll || 0;
      arr[o++] = bp.rotation.x; arr[o++] = bp.rotation.y; arr[o++] = bp.rotation.z; arr[o++] = bp.position.y;
      arr[o++] = n.air ? 1 : 0; arr[o++] = n.pushT > 0 ? 1 : 0;
    }
    return o;
  }
  function restore(arr, o, dt) {
    for (const n of npcs) {
      const sk = n.sk;
      sk.root.position.set(arr[o], arr[o + 1], arr[o + 2]); sk.root.rotation.set(arr[o + 4], arr[o + 3], arr[o + 5]);
      sk.boardPivot.rotation.set(arr[o + 6], arr[o + 7], arr[o + 8]); sk.boardPivot.position.set(0, arr[o + 9], 0);
      sk.animate(dt, { air: arr[o + 10] > 0.5, pushing: arr[o + 11] > 0.5, crouch: false, lean: 0 });
      o += STRIDE;
    }
    return o;
  }

  return { init, update, setCount, collide, snapshot, restore, STRIDE, get count() { return count; }, list: npcs,
    showTags(v) { for (const n of npcs) n.tag.visible = v; } };
})();
