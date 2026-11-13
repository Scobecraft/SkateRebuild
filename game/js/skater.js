/* Concrete Flow – Realistische Skater (Microsoft Rocketbox Avatare, MIT-Lizenz) mit prozeduraler Skelett-Animation */
window.CF = window.CF || {};

/* Verfügbare Personen: Ordner, Textur-Präfix, Name, Deck-Farbe */
CF.OUTFITS = [
  { name: 'Jamal', file: 'Male_Adult_17', tex: 'm022', deck: '#e4572e' },
  { name: 'Lena', file: 'Female_Adult_17', tex: 'f006', deck: '#3a86ff' },
  { name: 'Marco', file: 'Male_Adult_09', tex: 'm017', deck: '#06d6a0' },
  { name: 'Tobi', file: 'Male_Adult_18', tex: 'm023', deck: '#ff006e' },
  { name: 'Sara', file: 'Female_Adult_13', tex: 'f019', deck: '#ffbe0b' },
  { name: 'Deniz', file: 'Male_Adult_06', tex: 'm011', deck: '#111111' },
  { name: 'Kim', file: 'Female_Adult_12', tex: 'f012', deck: '#457b9d' },
  { name: 'Felix', file: 'Male_Adult_16', tex: 'm019', deck: '#8ac926' },
  { name: 'Noah', file: 'Male_Adult_04', tex: 'm006', deck: '#c77dff' },
];

/* Lädt jede Person nur einmal (FBX + PBR-Texturen), nacheinander */
CF.loadPerson = (() => {
  const cache = {};
  const tl = new THREE.TextureLoader();            // eigene Texturen (ohne Basispfad)
  const mgr = new THREE.LoadingManager();
  // Die FBX-Datei verweist auf TGA-Dateien; die ersetzen wir unten durch eigene PBR-Materialien
  const dummy = { setPath() { return this; }, setCrossOrigin() { return this; }, setRequestHeader() { return this; }, load: () => new THREE.Texture() };
  mgr.addHandler(/\.tga$/i, dummy);
  const queue = [];
  let busy = false;
  function next() {
    if (busy || !queue.length) return;
    busy = true;
    const { o, resolve } = queue.shift();
    const dir = `assets/people/${o.file}/`;
    new THREEX.FBXLoader(mgr).load(dir + o.file + '.fbx', obj => {
      obj.traverse(m => {
        if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
        const mats = [].concat(m.material).map(src => {
          const key = src.name;
          if (/_opacity$/.test(key)) {
            const map = tl.load(dir + key + '_color.png'); map.encoding = THREE.sRGBEncoding;
            return new THREE.MeshStandardMaterial({ name: key, map, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7 });
          }
          const map = tl.load(dir + key + '_color.jpg'); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
          return new THREE.MeshStandardMaterial({
            name: key, map, normalMap: tl.load(dir + key + '_normal.jpg'), roughnessMap: tl.load(dir + key + '_rough.jpg'),
            roughness: 1, metalness: 0, envMapIntensity: 0.7,
          });
        });
        m.material = mats.length === 1 ? mats[0] : mats;
      });
      busy = false; resolve(obj); next();
    }, undefined, () => { busy = false; resolve(null); next(); });
  }
  return o => cache[o.file] || (cache[o.file] = new Promise(resolve => { queue.push({ o, resolve }); next(); }));
})();

CF.makeSkater = () => {
  const OUTFITS = CF.OUTFITS;
  const mats = {};
  const root = new THREE.Group();        // Position + Yaw + Neigung
  root.rotation.order = 'YXZ';
  const boardPivot = new THREE.Group();  // Flip-Rotationen
  const body = new THREE.Group();        // Charakter (seitlich aufs Board gedreht)
  const holder = new THREE.Group();      // trägt das Avatar-Modell (Ducken = absenken)
  let avatar = null, B = null, rest = null, loadToken = 0;

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
    g.rotateX(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), a = Math.abs(z); if (a > 0.27) p.setY(i, p.getY(i) + (a - 0.27) * 0.45); }
    g.computeVertexNormals();
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 0.22 + 0.5, p.getZ(i) / 0.84 + 0.5);
    mats.deck = new THREE.MeshStandardMaterial({ map: deckTexture(o.deck), roughness: 0.55 });
    mats.grip = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
    const deck = new THREE.Mesh(g, [mats.grip, new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.7 })]); deck.position.y = 0.02; deck.castShadow = true;
    boardPivot.add(deck);
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.54), mats.deck); bottom.rotation.x = Math.PI / 2; boardPivot.add(bottom);
    const truckM = new THREE.MeshStandardMaterial({ color: 0xb0b7bf, metalness: 0.85, roughness: 0.3 });
    const wheelM = new THREE.MeshStandardMaterial({ color: 0xf5f0e1, roughness: 0.45 });
    for (const z of [-0.25, 0.25]) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.05), truckM); tr.position.set(0, -0.012, z); tr.castShadow = true; boardPivot.add(tr);
      for (const x of [-0.095, 0.095]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.032, 14), wheelM); wh.rotation.z = Math.PI / 2; wh.position.set(x, -0.042, z); wh.castShadow = true; boardPivot.add(wh);
      }
    }
  }

  /* ---------- Avatar laden + Skelett vorbereiten ---------- */
  function loadAvatar(i) {
    const token = ++loadToken;
    CF.loadPerson(OUTFITS[i % OUTFITS.length]).then(src => {
      if (!src || token !== loadToken) return;
      if (avatar) holder.remove(avatar);
      avatar = THREEX.SkeletonUtils.clone(src);
      avatar.scale.setScalar(0.01); // Modell ist in Zentimetern
      holder.position.set(0, 0, 0);
      holder.add(avatar);
      const find = n => avatar.getObjectByName(n);
      const side = s => ({ thigh: find(`Bip01_${s}_Thigh`), calf: find(`Bip01_${s}_Calf`), foot: find(`Bip01_${s}_Foot`), toe: find(`Bip01_${s}_Toe0`),
        up: find(`Bip01_${s}_UpperArm`), fore: find(`Bip01_${s}_Forearm`), hand: find(`Bip01_${s}_Hand`) });
      B = { spine: find('Bip01_Spine'), spine1: find('Bip01_Spine1'), spine2: find('Bip01_Spine2'), neck: find('Bip01_Neck'), head: find('Bip01_Head'), L: side('L'), R: side('R'), fingers: [] };
      avatar.traverse(o => { if (o.isBone && /_Finger[1-4]\d?$/.test(o.name)) B.fingers.push(o); });
      rest = [];
      avatar.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
      root.updateMatrixWorld(true);
      const d = (a, b) => wp(a, new THREE.Vector3()).distanceTo(wp(b, new THREE.Vector3()));
      B.len = { thigh: d(B.L.thigh, B.L.calf), calf: d(B.L.calf, B.L.foot), up: d(B.L.up, B.L.fore), fore: d(B.L.fore, B.L.hand) };
      const base = wp(holder, new THREE.Vector3()).y;
      B.ankleH = wp(B.L.foot, new THREE.Vector3()).y - base;
    });
  }

  function setOutfit(i) {
    const o = OUTFITS[i % OUTFITS.length];
    mats.deck.map = deckTexture(o.deck); mats.deck.needsUpdate = true;
    loadAvatar(i);
    return o.name;
  }

  function init(scene, idx = 0) {
    const o = OUTFITS[idx % OUTFITS.length];
    buildBoard(o);
    boardPivot.position.y = 0.075;
    body.position.y = 0.1;
    body.rotation.y = -Math.PI / 2; // Charakter blickt lokal nach +Z, Board liegt entlang lokaler X-Achse
    body.add(holder);
    root.add(boardPivot); root.add(body);
    scene.add(root);
    setOutfit(idx);
  }

  /* ---------- Skelett-Helfer (Weltraum) ---------- */
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  function wp(o, v) { return o.getWorldPosition(v || new THREE.Vector3()); }
  // Dreht einen Knochen so, dass die Richtung zu seinem Kind-Knochen auf das Ziel zeigt
  function aim(bone, child, target) {
    const bp = wp(bone, _v1), cp = wp(child, _v2);
    const cur = cp.sub(bp), des = _v3.copy(target).sub(bp);
    if (cur.lengthSq() < 1e-10 || des.lengthSq() < 1e-10) return;
    _q1.setFromUnitVectors(cur.normalize(), des.normalize());
    bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
    bone.parent.getWorldQuaternion(_q3).invert();
    bone.quaternion.copy(_q3.multiply(_q2));
    bone.updateMatrixWorld(true);
  }
  // Rotation um eine Welt-Achse (Wirbelsäule, Kopf)
  function rotW(bone, axis, angle) {
    if (!angle) return;
    _q1.setFromAxisAngle(axis, angle);
    bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
    bone.parent.getWorldQuaternion(_q3).invert();
    bone.quaternion.copy(_q3.multiply(_q2));
    bone.updateMatrixWorld(true);
  }
  // Zwei-Knochen-IK mit Beugerichtung (pole)
  function ik2(a, b, c, target, la, lb, pole) {
    const A = wp(a, new THREE.Vector3());
    const dir = target.clone().sub(A); let d = dir.length();
    d = Math.min(Math.max(d, Math.abs(la - lb) + 1e-3), la + lb - 1e-3);
    dir.normalize();
    const x = (la * la - lb * lb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, la * la - x * x));
    const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const J = A.clone().add(dir.clone().multiplyScalar(x)).add(side.multiplyScalar(h));
    aim(a, b, J); aim(b, c, A.clone().add(dir.multiplyScalar(d)));
  }

  /* ---------- Animation ---------- */
  let t = 0, crouchS = 0, pushS = 0, airS = 0, grabS = 0;
  const lerp = (a, b, k) => a + (b - a) * k;
  const toW = (x, y, z) => body.localToWorld(new THREE.Vector3(x, y, z));
  const dirW = (x, y, z) => new THREE.Vector3(x, y, z).transformDirection(body.matrixWorld);

  function pose(st) {
    for (const [b, q] of rest) b.quaternion.copy(q);
    holder.position.y = -(0.07 + crouchS * 0.3 + pushS * 0.1); // Knie beugen = Körper absenken
    root.updateMatrixWorld(true);
    const right = dirW(1, 0, 0), fwd = dirW(0, 0, 1), up = dirW(0, 1, 0);
    // Oberkörper: leicht vorgebeugt, beim Ducken stärker, Lenken = seitliche Neigung
    const bend = 0.12 + crouchS * 0.35 + pushS * 0.18;
    for (const s of [B.spine, B.spine1, B.spine2]) { rotW(s, right, bend / 3); rotW(s, fwd, -(st.lean || 0) * 0.08); }
    rotW(B.spine1, up, 0.25 + pushS * 0.25); rotW(B.spine2, up, 0.15);   // Schultern Richtung Fahrt
    rotW(B.neck, up, 0.35); rotW(B.head, up, 0.45 - pushS * 0.2); rotW(B.head, right, -bend * 0.6); // Blick in Fahrtrichtung
    // Beine: Füße auf dem Board (Board-Achse = lokale X), Knie nach vorne
    const ank = B.ankleH + 0.01;
    const footF = toW(-0.2, ank, 0.02);
    let footB = toW(0.2, ank, 0.0);
    if (pushS > 0.05) { const ph = Math.sin(t * 7.5); footB = toW(0.22 + ph * 0.3 * pushS, ank - 0.11 * pushS, 0.16 * pushS); }
    for (const [leg, target, k] of [[B.R, footF, -1], [B.L, footB, 1]]) {
      const pole = fwd.clone().add(right.clone().multiplyScalar(0.35 * k)).normalize();
      ik2(leg.thigh, leg.calf, leg.foot, target, B.len.thigh, B.len.calf, pole);
      aim(leg.foot, leg.toe, wp(leg.foot).add(fwd.clone().multiplyScalar(0.15)).add(up.clone().multiplyScalar(-B.ankleH * 0.6))); // Fuß flach
    }
    // Arme
    const bal = st.grindBalance;
    for (const [arm, s] of [[B.L, 1], [B.R, -1]]) {
      const sh = wp(arm.up);
      let elbow, hand;
      if (bal !== undefined) { // Balance: Arme seitlich ausgestreckt
        const tilt = bal * 0.25 * s;
        elbow = sh.clone().add(right.clone().multiplyScalar(-s * 0.27)).add(up.clone().multiplyScalar(-0.05 + tilt));
        hand = elbow.clone().add(right.clone().multiplyScalar(-s * 0.25)).add(up.clone().multiplyScalar(0.02 + tilt * 1.2));
      } else {
        const sway = Math.sin(t * 2.1 + s) * 0.03, out = 0.1 + airS * 0.22, lift = -0.26 + airS * 0.2;
        elbow = sh.clone().add(right.clone().multiplyScalar(-s * out)).add(up.clone().multiplyScalar(lift)).add(fwd.clone().multiplyScalar(0.04 + sway));
        hand = elbow.clone().add(right.clone().multiplyScalar(-s * (0.04 + airS * 0.15))).add(up.clone().multiplyScalar(-0.24 + airS * 0.12)).add(fwd.clone().multiplyScalar(0.07));
      }
      if (st.grab && ((st.grab === 'Melon Grab') === (s > 0)) && grabS > 0.05) { // Hand greift ans Board
        const g = toW(s > 0 ? 0.05 : -0.05, 0.12, s > 0 ? -0.1 : 0.12);
        hand.lerp(g, grabS); elbow.lerp(sh.clone().lerp(g, 0.5).add(fwd.clone().multiplyScalar(0.12)), grabS);
      }
      const pole = elbow.clone().sub(sh).normalize().add(fwd.clone().multiplyScalar(-0.4));
      ik2(arm.up, arm.fore, arm.hand, hand, B.len.up, B.len.fore, pole);
    }
    for (const f of B.fingers) f.rotateZ(-0.3); // entspannte, leicht gekrümmte Finger
  }

  function animate(dt, st) {
    t += dt;
    const k = 1 - Math.exp(-dt * 14);
    crouchS = lerp(crouchS, st.crouch ? 1 : (st.grab ? 0.9 : 0), k);
    pushS = lerp(pushS, st.pushing ? 1 : 0, 1 - Math.exp(-dt * 6));
    airS = lerp(airS, st.air ? 1 : 0, k);
    grabS = lerp(grabS, st.grab ? 1 : 0, k);
    body.rotation.x = 0; body.rotation.z = 0; body.position.y = 0.1;
    if (B) pose(st);
  }

  /* Sturz-Pose: Körper kippt, Arme fangen ab */
  function bailPose(p) {
    const q = Math.min(1, p * 2.5);
    body.rotation.z = -q * 1.45;
    body.position.y = 0.1 + Math.sin(q * Math.PI) * 0.3 - q * 0.05;
    if (!B) return;
    for (const [b, r] of rest) b.quaternion.copy(r);
    holder.position.y = -0.25;
    root.updateMatrixWorld(true);
    const right = dirW(1, 0, 0), fwd = dirW(0, 0, 1);
    for (const s of [B.spine, B.spine1]) rotW(s, right, 0.35);
    for (const [arm, s] of [[B.L, 1], [B.R, -1]]) {
      const sh = wp(arm.up);
      const hand = sh.clone().add(right.clone().multiplyScalar(-s * 0.35)).add(fwd.clone().multiplyScalar(0.35));
      aim(arm.up, arm.fore, sh.clone().lerp(hand, 0.5)); aim(arm.fore, arm.hand, hand);
    }
  }

  return { init, animate, bailPose, setOutfit, OUTFITS, root, boardPivot, body };
};
CF.Skater = CF.makeSkater();
