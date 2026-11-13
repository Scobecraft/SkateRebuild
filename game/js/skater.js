/* Concrete Flow – Skater-Modell (eigener Charakter) + Animation */
window.CF = window.CF || {};
CF.OUTFITS = [
    { name: 'Teal Hoodie', hoodie: 0x1f9e8f, pants: 0x2b2f3a, cap: 0xf4a261, shoes: 0xf1f1f1, skin: 0xc68e6a, deck: '#e4572e' },
    { name: 'Sunset Flannel', hoodie: 0xc0392b, pants: 0x5d6d7e, cap: 0x222222, shoes: 0x222222, skin: 0x8d5a3b, deck: '#3a86ff' },
    { name: 'Lemon Tee', hoodie: 0xf1c40f, pants: 0x34495e, cap: 0x8e44ad, shoes: 0xe74c3c, skin: 0xf0c8a0, deck: '#06d6a0' },
    { name: 'Night Rider', hoodie: 0x222831, pants: 0x393e46, cap: 0x00adb5, shoes: 0x00adb5, skin: 0xa86b4c, deck: '#ff006e' },
    { name: 'Olive Worker', hoodie: 0x6b7b3a, pants: 0xc2a878, cap: 0x3d2b1f, shoes: 0x8b5a2b, skin: 0xe0b48f, deck: '#ffbe0b' },
    { name: 'Gold Legend', hoodie: 0xd4af37, pants: 0x111111, cap: 0xffffff, shoes: 0xd4af37, skin: 0x7a4b2e, deck: '#111111' },
    { name: 'Coral Wave', hoodie: 0xff7f6e, pants: 0x1d3557, cap: 0xa8dadc, shoes: 0xffffff, skin: 0xf3cba5, deck: '#457b9d' },
    { name: 'Forest Camo', hoodie: 0x4a5d23, pants: 0x2f3e1d, cap: 0x7f8c4b, shoes: 0x3b3b3b, skin: 0xb07a52, deck: '#8ac926' },
];
/* Lädt den Kopf-Scan einmal und schneidet die Schultern ab */
CF.loadHead = () => CF._head || (CF._head = new Promise(resolve => {
  const tl = new THREE.TextureLoader();
  const map = tl.load('assets/models/head/color.jpg'); map.encoding = THREE.sRGBEncoding;
  const nor = tl.load('assets/models/head/normal.jpg');
  const material = new THREE.MeshStandardMaterial({ map, normalMap: nor, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.55 });
  new THREEX.GLTFLoader().load('assets/models/head/LeePerrySmith.glb', gl => {
    let src = null; gl.scene.traverse(o => { if (o.isMesh && !src) src = o; });
    const g0 = src.geometry.index ? src.geometry.toNonIndexed() : src.geometry;
    const pos = g0.attributes.position, keep = [];
    for (let i = 0; i < pos.count; i += 3) if (Math.min(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2)) > -1.6) keep.push(i);
    const geometry = new THREE.BufferGeometry();
    for (const k of Object.keys(g0.attributes)) {
      const a = g0.attributes[k], n = a.itemSize, arr = new a.array.constructor(keep.length * 3 * n);
      keep.forEach((i, j) => { for (let v = 0; v < 3 * n; v++) arr[j * 3 * n + v] = a.array[i * n + v]; });
      geometry.setAttribute(k, new THREE.BufferAttribute(arr, n));
    }
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox, scale = 0.285 / (bb.max.y - bb.min.y);
    resolve({ geometry, material, scale, offsetY: -bb.min.y * scale - 0.02, offsetZ: -0.01 });
  }, undefined, () => resolve(null));
}));
CF.makeSkater = () => {
  const OUTFITS = CF.OUTFITS;
  let mats = {};
  const root = new THREE.Group();        // Position + Yaw + Neigung
  root.rotation.order = 'YXZ';
  const boardPivot = new THREE.Group();  // Flip-Rotationen
  const body = new THREE.Group();        // Charakter (seitlich aufs Board gedreht)
  const rig = {};

  function mat(c, r = 0.8) { return new THREE.MeshStandardMaterial({ color: c, roughness: r }); }
  function cap(r, l, m) { const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 12), m); g.castShadow = true; return g; }

  function deckTexture(color) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 128, 512);
    g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 6; i++) g.fillRect(0, 70 + i * 66, 128, 12);
    g.save(); g.translate(64, 256); g.rotate(-Math.PI / 2); g.font = '900 64px Impact, Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#111'; g.strokeText('FLOW', 0, 0); g.fillStyle = '#fff'; g.fillText('FLOW', 0, 0); g.restore();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  function buildBoard(o) {
    const shape = new THREE.Shape(); const w = 0.105, L = 0.41;
    shape.moveTo(-w, -L + w); shape.absarc(0, -L + w, w, Math.PI, 0, false); shape.lineTo(w, L - w); shape.absarc(0, L - w, w, 0, Math.PI, false); shape.lineTo(-w, -L + w);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(Math.PI / 2); // jetzt liegt das Deck in XZ, Länge entlang Z
    const p = g.attributes.position; // Kicktails biegen
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), a = Math.abs(z); if (a > 0.27) p.setY(i, p.getY(i) + (a - 0.27) * 0.45); }
    g.computeVertexNormals();
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 0.22 + 0.5, p.getZ(i) / 0.84 + 0.5);
    mats.deck = new THREE.MeshStandardMaterial({ map: deckTexture(o.deck), roughness: 0.55 });
    mats.grip = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
    const deck = new THREE.Mesh(g, [mats.grip, mats.deckSide = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.7 })]); deck.position.y = 0.02; deck.castShadow = true;
    boardPivot.add(deck);
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.54), mats.deck); bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.0; boardPivot.add(bottom);
    const truckM = new THREE.MeshStandardMaterial({ color: 0xb0b7bf, metalness: 0.85, roughness: 0.3 });
    const wheelM = new THREE.MeshStandardMaterial({ color: 0xf5f0e1, roughness: 0.45 });
    for (const z of [-0.25, 0.25]) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.05), truckM); tr.position.set(0, -0.012, z); tr.castShadow = true; boardPivot.add(tr);
      for (const x of [-0.095, 0.095]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.032, 14), wheelM); wh.rotation.z = Math.PI / 2; wh.position.set(x, -0.042, z); wh.castShadow = true; boardPivot.add(wh);
      }
    }
  }

  /* ---------- Realistischer Körper ---------- */
  // Hautton der Scan-Textur (linear) + Variationen für verschiedene Skater
  const SKIN = new THREE.Color().setRGB(0.517, 0.30, 0.255);
  const TONES = [[1, 1, 1], [0.6, 0.48, 0.4], [1.04, 1.0, 0.95], [0.74, 0.6, 0.5], [0.95, 0.9, 0.85], [0.48, 0.36, 0.29], [1.02, 0.97, 0.92], [0.8, 0.68, 0.58]];
  // Rotationskörper mit elliptischem Querschnitt (Profil: [[radius, y], ...])
  function lathe(profile, mat, sx = 1, sz = 1, seg = 20) {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    g.scale(sx, 1, sz);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function sph(r, mat, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.scale.set(sx, sy, sz); m.castShadow = true; return m; }
  function capsule(r, l, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), mat); m.castShadow = true; return m; }

  function hand(mat) {
    const h = new THREE.Group();
    const palm = sph(0.045, mat, 0.9, 1.05, 0.4); palm.position.y = -0.04; h.add(palm);
    const fx = [-0.024, -0.008, 0.008, 0.024], fl = [0.042, 0.05, 0.048, 0.038];
    fx.forEach((x, i) => {
      const f = new THREE.Group(); f.position.set(x, -0.083, 0.002); f.rotation.x = 0.35; h.add(f);
      const p1 = capsule(0.0085, fl[i] * 0.55, mat); p1.position.y = -fl[i] * 0.28; f.add(p1);
      const j = new THREE.Group(); j.position.y = -fl[i] * 0.55; j.rotation.x = 0.5; f.add(j);
      const p2 = capsule(0.0078, fl[i] * 0.4, mat); p2.position.y = -fl[i] * 0.22; j.add(p2);
    });
    const th = new THREE.Group(); th.position.set(-0.035, -0.035, 0.012); th.rotation.set(0.4, 0, 0.7); h.add(th);
    const t1 = capsule(0.01, 0.035, mat); t1.position.y = -0.025; th.add(t1);
    return h;
  }
  function sneaker(upperMat, soleMat, laceMat) {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(-0.105, 0.0); sh.lineTo(0.15, 0.0); sh.quadraticCurveTo(0.19, 0.005, 0.185, 0.035); sh.quadraticCurveTo(0.175, 0.06, 0.13, 0.065);
    sh.lineTo(0.03, 0.095); sh.lineTo(-0.05, 0.105); sh.quadraticCurveTo(-0.1, 0.1, -0.11, 0.07); sh.quadraticCurveTo(-0.118, 0.03, -0.105, 0.0);
    const ug = new THREE.ExtrudeGeometry(sh, { depth: 0.085, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 8 });
    ug.rotateY(-Math.PI / 2); ug.translate(0.0425, 0.02, 0);
    const up = new THREE.Mesh(ug, upperMat); up.castShadow = true; g.add(up);
    const ss = new THREE.Shape(); ss.moveTo(-0.115, 0); ss.lineTo(0.17, 0); ss.quadraticCurveTo(0.2, 0.0, 0.198, 0.024); ss.lineTo(-0.12, 0.024); ss.lineTo(-0.115, 0);
    const sg = new THREE.ExtrudeGeometry(ss, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    sg.rotateY(-Math.PI / 2); sg.translate(0.05, 0, 0);
    const sole = new THREE.Mesh(sg, soleMat); sole.castShadow = true; g.add(sole);
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.01), laceMat); l.position.set(0, 0.112 - i * 0.008, 0.035 + i * 0.024); l.rotation.x = -0.35; g.add(l); }
    return g;
  }

  // Glied: oberer Teil (top) → Gelenk (joint) → unterer Teil, optional Fuß/Hand
  function limb(parent, x, y, upperLen, lowerLen, prUp, prLow, mUp, mLow, end) {
    const top = new THREE.Group(); top.position.set(x, y, 0); parent.add(top);
    top.add(lathe(prUp, mUp, 1, 0.92));
    const joint = new THREE.Group(); joint.position.y = -upperLen; top.add(joint);
    const jn = sph(prLow[0][0] * 0.97, mUp, 1, 1, 0.92); jn.position.y = 0.005; joint.add(jn);
    joint.add(lathe(prLow, mLow, 1, 0.92));
    let foot = null;
    if (end === 'foot') { foot = sneaker(mats.shoes, mats.sole, mats.lace); foot.position.set(0, -lowerLen - 0.075, 0.0); joint.add(foot); }
    if (end === 'hand') {
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.05, 10), mats.skin); wrist.position.y = -lowerLen - 0.01; joint.add(wrist);
      const h = hand(mats.skin); h.position.y = -lowerLen - 0.02; joint.add(h); foot = h;
    }
    return { top, joint, foot };
  }

  function buildBody(o) {
    const fab = CF.fabric || (CF.fabric = (() => {
      const nm = (n, r) => { const t = CF.World.photo(n + '_nor_gl', 1, false); t.repeat.set(r, r); return t; };
      return { cloth: nm('cloth', 4), denim: nm('denim', 3), leather: nm('leather', 2) };
    })());
    const fm = (c, n, r, ns = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, normalMap: n, normalScale: new THREE.Vector2(ns, ns) });
    mats.hoodie = fm(o.hoodie, fab.cloth, 0.95); mats.hoodieDark = fm(new THREE.Color(o.hoodie).multiplyScalar(0.72), fab.cloth, 0.95);
    mats.pants = fm(o.pants, fab.denim, 0.9, 1.2);
    mats.skin = new THREE.MeshStandardMaterial({ color: SKIN.clone(), roughness: 0.58 });
    mats.cap = fm(o.cap, fab.cloth, 0.8, 0.6); mats.shoes = fm(o.shoes, fab.leather, 0.55, 0.7);
    mats.sole = new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.75 });
    mats.lace = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.8 });
    mats.belt = new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 0.5 });
    mats.string = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
    mats.glass = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.05, metalness: 0.6, envMapIntensity: 1.5 });
    mats.frame = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35 });
    mats.headSkin = null;
    // Charakter blickt lokal nach +Z, das Board liegt entlang lokaler X-Achse
    body.rotation.y = -Math.PI / 2;
    const hips = new THREE.Group(); hips.position.y = 0.9; body.add(hips); rig.hips = hips;
    // Becken / Jeans + Gürtel
    hips.add(lathe([[0.001, -0.17], [0.11, -0.165], [0.15, -0.12], [0.162, -0.05], [0.158, 0.02], [0.152, 0.05]], mats.pants, 1, 0.72));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.014, 6, 28), mats.belt); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.72, 1); belt.position.y = 0.03; hips.add(belt);
    const thigh = [[0.088, 0.02], [0.086, -0.06], [0.078, -0.2], [0.066, -0.36], [0.06, -0.44]];
    const shin = [[0.06, 0], [0.062, -0.08], [0.054, -0.26], [0.056, -0.38], [0.064, -0.44], [0.066, -0.445]];
    rig.legF = limb(hips, -0.09, -0.06, 0.44, 0.44, thigh, shin, mats.pants, mats.pants, 'foot');
    rig.legB = limb(hips, 0.09, -0.06, 0.44, 0.44, thigh, shin, mats.pants, mats.pants, 'foot');
    // Oberkörper mit Hoodie
    const torso = new THREE.Group(); torso.position.y = 0.04; hips.add(torso); rig.torso = torso;
    const tp = [[0.001, -0.06], [0.15, -0.06], [0.162, -0.02], [0.158, 0.06], [0.165, 0.16], [0.18, 0.28], [0.19, 0.38], [0.188, 0.44], [0.16, 0.5], [0.1, 0.535], [0.07, 0.55]];
    const chest = lathe(tp, mats.hoodie, 1.0, 0.64, 28); torso.add(chest);
    // leichte Stofffalten
    const cp = chest.geometry.attributes.position;
    for (let i = 0; i < cp.count; i++) { const y = cp.getY(i), x = cp.getX(i), z = cp.getZ(i); const f = 1 + Math.sin(y * 38 + Math.atan2(z, x) * 3) * 0.012 * (y < 0.3 ? 1 : 0.3); cp.setX(i, x * f); cp.setZ(i, z * f); }
    chest.geometry.computeVertexNormals();
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.02, 8, 28), mats.hoodieDark); hem.rotation.x = Math.PI / 2; hem.scale.set(1.0, 0.64, 1); hem.position.y = -0.045; torso.add(hem);
    for (const sx of [-1, 1]) { const sh = sph(0.064, mats.hoodie, 1.1, 0.85, 0.95); sh.position.set(sx * 0.17, 0.445, 0); torso.add(sh); }
    const pocket = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.12, 20, 1, true, -0.75, 1.5), mats.hoodieDark);
    pocket.scale.set(1.0, 1, 0.66); pocket.position.y = 0.1; torso.add(pocket);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.042, 10, 22), mats.hoodie); hood.position.set(0, 0.53, -0.04); hood.rotation.x = Math.PI / 2.3; hood.scale.set(1.1, 1, 1); torso.add(hood);
    const hoodBack = sph(0.11, mats.hoodie, 1.05, 0.75, 0.55); hoodBack.position.set(0, 0.49, -0.12); torso.add(hoodBack);
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 6), mats.string); st.position.set(sx * 0.035, 0.44, 0.122); st.rotation.z = sx * 0.08; torso.add(st); }
    // Hals + Kopf
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.09, 14), mats.skin); neck.position.y = 0.57; torso.add(neck);
    const head = new THREE.Group(); head.position.y = 0.6; torso.add(head); rig.head = head;
    attachHead(head, o);
    // Arme mit Ärmeln, Bündchen und Händen
    const upperArm = [[0.066, 0.02], [0.064, -0.06], [0.056, -0.2], [0.05, -0.3]];
    const foreArm = [[0.05, 0.0], [0.051, -0.08], [0.045, -0.22], [0.043, -0.24], [0.046, -0.255]];
    rig.armL = limb(torso, -0.215, 0.45, 0.3, 0.26, upperArm, foreArm, mats.hoodie, mats.hoodie, 'hand');
    rig.armR = limb(torso, 0.215, 0.45, 0.3, 0.26, upperArm, foreArm, mats.hoodie, mats.hoodie, 'hand');
    for (const a of [rig.armL, rig.armR]) { const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.01, 6, 16), mats.hoodieDark); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.252; a.joint.add(cuff); }
  }

  /* Gescannter Kopf (Lee Perry-Smith, Infinite Realities, CC BY 3.0) mit Cap + Sonnenbrille */
  function attachHead(head, o) {
    // Platzhalter, bis der Scan geladen ist
    const ph = sph(0.1, mats.skin, 0.9, 1.15, 1); ph.position.y = 0.13; head.add(ph);
    CF.loadHead().then(asset => {
      if (!asset) return; // Platzhalter bleibt, falls der Scan fehlt
      head.remove(ph);
      mats.headSkin = asset.material.clone();
      const g = new THREE.Group(); g.scale.setScalar(asset.scale); g.position.set(0, asset.offsetY, asset.offsetZ); head.add(g);
      const m = new THREE.Mesh(asset.geometry, mats.headSkin); m.castShadow = true; m.receiveShadow = true; g.add(m);
      // Cap (rückwärts) – in Scan-Einheiten
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.06, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), mats.cap);
      dome.scale.set(1.0, 0.95, 1.12); dome.position.set(-0.05, 2.15, 0.12); dome.castShadow = true; g.add(dome);
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.96, 0.12, 6, 32), mats.cap); band.rotation.x = Math.PI / 2; band.scale.set(1, 1.12, 1); band.position.set(-0.05, 2.62, 0.12); g.add(band);
      const brimShape = new THREE.Shape(); brimShape.absellipse(0, 0, 1.45, 1.25, 0, Math.PI, true);
      const brim = new THREE.Mesh(new THREE.ExtrudeGeometry(brimShape, { depth: 0.08, bevelEnabled: false }), mats.cap);
      brim.rotation.x = Math.PI / 2 - 0.12; brim.position.set(-0.05, 2.62, -2.05); brim.castShadow = true; g.add(brim);
      const btn = sph(0.18, mats.cap); btn.position.set(-0.05, 4.05, 0.12); g.add(btn);
      // Sonnenbrille
      const glasses = new THREE.Group(); glasses.position.set(-0.05, 1.68, 2.32); g.add(glasses);
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), mats.glass);
        lens.rotation.x = Math.PI / 2; lens.scale.set(1.05, 0.55, 0.75); lens.position.set(sx * 0.68, 0, -0.38); glasses.add(lens);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 20), mats.frame); rim.scale.set(1.05, 0.75, 1); rim.position.set(sx * 0.68, 0, 0.06); glasses.add(rim);
        const temple = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 2.2), mats.frame); temple.position.set(sx * 1.62, 0.05, -1.05); temple.rotation.y = sx * 0.12; glasses.add(temple);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.08), mats.frame); bridge.position.set(0, 0.12, 0.06); glasses.add(bridge);
      applyTone();
    });
  }
  let tone = TONES[0];
  function applyTone() {
    mats.skin.color.copy(SKIN).multiply(new THREE.Color(tone[0], tone[1], tone[2]));
    if (mats.headSkin) mats.headSkin.color.setRGB(tone[0], tone[1], tone[2]);
  }

  function setOutfit(i) {
    const o = OUTFITS[i % OUTFITS.length];
    mats.hoodie.color.setHex(o.hoodie); mats.hoodieDark.color.setHex(o.hoodie).multiplyScalar(0.72);
    mats.pants.color.setHex(o.pants); mats.cap.color.setHex(o.cap); mats.shoes.color.setHex(o.shoes);
    tone = TONES[i % TONES.length]; applyTone();
    mats.deck.map = deckTexture(o.deck); mats.deck.needsUpdate = true;
    return o.name;
  }

  function init(scene, idx = 0) {
    const o = OUTFITS[idx % OUTFITS.length];
    buildBoard(o); buildBody(o); setOutfit(idx);
    boardPivot.position.y = 0.075;
    body.position.y = 0.1;
    root.add(boardPivot); root.add(body);
    scene.add(root);
    root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  }

  /* 2-Knochen-IK in der Charakterebene: Fuß soll in Höhe footY (relativ zur Hüfte) stehen */
  function legIK(leg, hipY, footX, footY, L = 0.44) {
    const dx = footX, dy = hipY - footY;
    const d = Math.min(Math.hypot(dx, dy), 2 * L - 0.001);
    const bend = Math.acos(d / (2 * L));
    leg.top.rotation.z = Math.atan2(dx, dy);
    leg.top.rotation.x = -bend;
    leg.joint.rotation.x = 2 * bend;
    if (leg.foot) leg.foot.rotation.x = -bend;
  }

  let t = 0, crouchS = 0, pushS = 0, airS = 0;
  const lerp = (a, b, k) => a + (b - a) * k;

  /* Animations-Update. st = Zustand vom Spieler */
  function animate(dt, st) {
    t += dt;
    const k = 1 - Math.exp(-dt * 14);
    crouchS = lerp(crouchS, st.crouch ? 1 : (st.grab ? 0.9 : 0), k);
    pushS = lerp(pushS, st.pushing ? 1 : 0, 1 - Math.exp(-dt * 6));
    airS = lerp(airS, st.air ? 1 : 0, k);
    const hipY = 0.9 - crouchS * 0.28 - pushS * 0.1;
    rig.hips.position.y = hipY;
    // Füße auf dem Board (Board-Achse = lokale X)
    const footY = 0.0;
    legIK(rig.legF, hipY, -0.15, footY + 0.02);
    if (pushS > 0.05) { // Hinterer Fuß schiebt am Boden
      const ph = Math.sin(t * 7.5);
      legIK(rig.legB, hipY, 0.18 + ph * 0.28 * pushS, footY - 0.12 * pushS);
      rig.legB.top.rotation.x -= 0.35 * pushS;
    } else legIK(rig.legB, hipY, 0.15, footY + 0.02);
    // Oberkörper
    rig.torso.rotation.z = (st.lean || 0) * 0.25;
    rig.torso.rotation.x = 0.15 + crouchS * 0.45 + pushS * 0.2;
    rig.head.rotation.x = -0.15 - crouchS * 0.3;
    rig.head.rotation.y = -0.9 + pushS * 0.3; // Blick in Fahrtrichtung
    // Arme
    const sway = Math.sin(t * 2.2) * 0.05;
    let la = 0.35 + airS * 0.9 + sway, ra = 0.35 + airS * 0.9 - sway;
    rig.armL.top.rotation.set(-0.2, 0, -la); rig.armR.top.rotation.set(-0.2, 0, ra);
    rig.armL.joint.rotation.x = -0.4; rig.armR.joint.rotation.x = -0.4;
    if (st.grab) { // Hand greift ans Board
      const arm = st.grab === 'Melon Grab' ? rig.armL : rig.armR;
      arm.top.rotation.set(0.9, 0, st.grab === 'Melon Grab' ? -0.1 : 0.1); arm.joint.rotation.x = -0.2;
    }
    if (st.grindBalance !== undefined) { // Balance-Arme
      rig.armL.top.rotation.z = -1.2 - st.grindBalance * 0.5; rig.armR.top.rotation.z = 1.2 - st.grindBalance * 0.5;
    }
    body.rotation.x = 0; body.rotation.z = 0; body.position.y = 0.1;
  }

  /* Sturz-Pose */
  function bailPose(p) { // p 0..1
    body.rotation.z = -Math.min(1, p * 2.5) * 1.45;
    body.position.y = 0.1 + Math.sin(Math.min(1, p * 2.5) * Math.PI) * 0.3 - Math.min(1, p * 2.5) * 0.05;
    rig.hips.position.y = 0.75;
    legIK(rig.legF, 0.75, -0.2, 0.25); legIK(rig.legB, 0.75, 0.25, 0.1);
    rig.armL.top.rotation.set(0, 0, -2.2); rig.armR.top.rotation.set(0, 0, 2.0);
  }

  return { init, animate, bailPose, setOutfit, OUTFITS, root, boardPivot, body };
};
CF.Skater = CF.makeSkater();
