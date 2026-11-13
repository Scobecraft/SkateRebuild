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

  function limb(parent, x, y, upperLen, lowerLen, r, mUp, mLow, footMat) {
    const top = new THREE.Group(); top.position.set(x, y, 0); parent.add(top);
    const up = cap(r, upperLen - 2 * r, mUp); up.position.y = -upperLen / 2; top.add(up);
    const joint = new THREE.Group(); joint.position.y = -upperLen; top.add(joint);
    const low = cap(r * 0.9, lowerLen - 2 * r, mLow); low.position.y = -lowerLen / 2; joint.add(low);
    let foot = null;
    if (footMat) { foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.27), footMat); foot.position.set(0, -lowerLen - 0.02, 0.04); foot.castShadow = true; joint.add(foot); }
    return { top, joint, foot };
  }

  function buildBody(o) {
    const fab = CF.fabric || (CF.fabric = (() => {
      const nm = n => { const t = CF.World.photo(n + '_nor_gl', 1, false); t.repeat.set(3, 3); return t; };
      return { cloth: nm('cloth'), denim: nm('denim'), leather: nm('leather') };
    })());
    const fm = (c, n, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r, normalMap: n, normalScale: new THREE.Vector2(0.8, 0.8) });
    mats.hoodie = fm(o.hoodie, fab.cloth, 0.92); mats.pants = fm(o.pants, fab.denim, 0.88);
    mats.skin = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.55 });
    mats.cap = fm(o.cap, fab.cloth, 0.85); mats.shoes = fm(o.shoes, fab.leather, 0.6);
    // Charakter blickt lokal nach +Z, das Board liegt entlang lokaler X-Achse
    body.rotation.y = -Math.PI / 2;
    const hips = new THREE.Group(); hips.position.y = 0.9; body.add(hips); rig.hips = hips;
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.2), mats.pants); pelvis.castShadow = true; hips.add(pelvis);
    rig.legF = limb(hips, -0.11, -0.04, 0.44, 0.44, 0.065, mats.pants, mats.pants, mats.shoes);
    rig.legB = limb(hips, 0.11, -0.04, 0.44, 0.44, 0.065, mats.pants, mats.pants, mats.shoes);
    const torso = new THREE.Group(); torso.position.y = 0.06; hips.add(torso); rig.torso = torso;
    const chest = cap(0.17, 0.3, mats.hoodie); chest.scale.set(1.1, 1, 0.75); chest.position.y = 0.27; torso.add(chest);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 8, 16), mats.hoodie); hood.position.set(0, 0.54, -0.06); hood.rotation.x = Math.PI / 2.4; torso.add(hood);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02), mat(new THREE.Color(o.hoodie).multiplyScalar(0.75).getHex())); pocket.position.set(0, 0.18, 0.13); torso.add(pocket);
    const head = new THREE.Group(); head.position.y = 0.72; torso.add(head); rig.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), mats.skin); skull.scale.set(0.95, 1.08, 1); skull.castShadow = true; head.add(skull);
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.cap); capTop.position.y = 0.02; head.add(capTop);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.015, 0.12), mats.cap); brim.position.set(0, 0.035, -0.15); head.add(brim); // Cap rückwärts
    const eyeM = mat(0x111111, 0.3);
    for (const x of [-0.04, 0.04]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeM); e.position.set(x, 0.0, 0.108); head.add(e); }
    rig.armL = limb(torso, -0.22, 0.47, 0.3, 0.3, 0.05, mats.hoodie, mats.hoodie, null);
    rig.armR = limb(torso, 0.22, 0.47, 0.3, 0.3, 0.05, mats.hoodie, mats.hoodie, null);
    for (const a of [rig.armL, rig.armR]) { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mats.skin); hand.position.y = -0.32; a.joint.add(hand); }
  }

  function setOutfit(i) {
    const o = OUTFITS[i % OUTFITS.length];
    mats.hoodie.color.setHex(o.hoodie); mats.pants.color.setHex(o.pants); mats.cap.color.setHex(o.cap);
    mats.shoes.color.setHex(o.shoes); mats.skin.color.setHex(o.skin);
    mats.deck.map = deckTexture(o.deck); mats.deck.needsUpdate = true;
    return o.name;
  }

  function init(scene, idx = 0) {
    const o = OUTFITS[idx % OUTFITS.length];
    buildBoard(o); buildBody(o);
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
