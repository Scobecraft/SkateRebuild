/* Concrete Flow – Welt: Megapark (eigenes Design), Oberflächen-Physikdaten, Grafik */
window.CF = window.CF || {};
CF.World = (() => {
  const surfaces = [];   // begehbare Volumen mit Höhenprofil
  const bowls = [];      // eingelassene Bowls (negatives Höhenfeld)
  const rails = [];      // grindbare Segmente
  const spawns = [];
  let scene;
  /* Ebenen: 'park' (Megapark), 'env' (Umgebung), 'custom' (Map-Editor), 'ghost' (Vorschau) */
  let cap = null, curLayer = 'park', parkOn = true;
  const groups = {};
  let activeSurfaces = [];
  const activeRails = [];
  const okLayer = o => o.layer !== 'ghost' && (o.layer !== 'park' || parkOn);
  function refresh() { activeSurfaces = surfaces.filter(okLayer); activeRails.length = 0; for (const r of rails) if (okLayer(r)) activeRails.push(r); }
  function add(o) { (cap ? cap.group : (groups[curLayer] || scene)).add(o); }

  /* ---------------- Höhenprofile (u = Abstand vom unteren Ende in Metern) ---------------- */
  const Prof = {
    flat: h => ({ len: null, f: () => [h, 0], curved: false }),
    linear: (m, h0 = 0) => ({ f: u => [h0 + m * u, m], curved: false }),
    circ: R => ({ f: u => { const q = Math.sqrt(Math.max(1e-4, R * R - u * u)); return [R - q, u / q]; }, curved: true }),
    rollin: (R, mMax) => { // Kreis-Übergang, dann gerade Steilwand
      const ut = R * Math.sin(Math.atan(mMax)), ht = R * (1 - Math.cos(Math.atan(mMax)));
      return { curved: true, f: u => {
        if (u <= ut) { const q = Math.sqrt(R * R - u * u); return [R - q, u / q]; }
        return [ht + (u - ut) * mMax, mMax];
      } };
    },
  };

  /* ---------------- Physik-Abfragen ---------------- */
  function evalSurf(s, x, z) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return null;
    let u;
    if (s.axis === 'x') u = s.rev ? s.x1 - x : x - s.x0; else u = s.rev ? s.z1 - z : z - s.z0;
    const [h, m] = s.prof.f(Math.min(u, s.len));
    const sg = s.rev ? -1 : 1;
    return s.axis === 'x' ? { h, gx: m * sg, gz: 0 } : { h, gx: 0, gz: m * sg };
  }
  function evalBase(x, z) {
    if (parkOn) for (const b of bowls) {
      const dx = x - b.x, dz = z - b.z, r = Math.hypot(dx, dz);
      if (r >= b.R) continue;
      if (r <= b.r0) return { h: -b.D, gx: 0, gz: 0, bowl: b };
      const w = r - b.r0, q = Math.sqrt(Math.max(1e-4, b.Rt * b.Rt - w * w));
      const h = -b.D + b.Rt - q, m = w / q;
      return { h, gx: m * dx / r, gz: m * dz / r, bowl: b };
    }
    return { h: 0, gx: 0, gz: 0 };
  }
  function groundAt(x, z, maxY) {
    let best = evalBase(x, z); best.surf = null;
    for (const s of activeSurfaces) {
      const e = evalSurf(s, x, z);
      if (e && e.h > best.h && e.h <= maxY) { best = e; best.surf = s; }
    }
    return best;
  }
  function blocked(x, z, y, step) {
    if (Math.abs(x) > 119 || Math.abs(z) > 99) return true;
    for (const s of activeSurfaces) {
      const e = evalSurf(s, x, z);
      if (e && e.h > y + step) return true;
    }
    return false;
  }

  /* ---------------- Texturen (prozedural) ---------------- */
  function canvasTex(w, h, draw, repeat = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return t;
  }
  function noise(g, w, h, amt, alpha = 1) {
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; d[i + 3] = 255 * alpha; }
    g.putImageData(img, 0, 0);
  }
  function concrete(base, opts = {}) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { // Flecken
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.035})`;
        const r = 4 + Math.random() * 40; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 7); g.fill();
      }
      noise(g, w, h, 26);
      if (opts.joints) { g.strokeStyle = 'rgba(30,30,30,0.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }
      if (opts.cracks) for (let i = 0; i < 3; i++) {
        g.strokeStyle = 'rgba(20,20,20,0.35)'; g.lineWidth = 1.2; g.beginPath();
        let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y);
        for (let k = 0; k < 12; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke();
      }
    });
  }
  function wood() {
    return canvasTex(512, 512, (g, w, h) => {
      const planks = 8;
      for (let i = 0; i < planks; i++) {
        const c = 150 + Math.random() * 40;
        g.fillStyle = `rgb(${c},${c * 0.72 | 0},${c * 0.45 | 0})`; g.fillRect(0, i * h / planks, w, h / planks);
        for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(80,45,20,${Math.random() * 0.2})`; g.beginPath();
          const y = i * h / planks + Math.random() * h / planks; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y); g.stroke(); }
        g.fillStyle = 'rgba(40,20,10,0.6)'; g.fillRect(0, i * h / planks, w, 2);
      }
      noise(g, w, h, 14);
    });
  }
  function grass() {
    return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4f7a35'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${90 + Math.random() * 70},${20 + Math.random() * 30},0.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); } }, 60);
  }
  function graffiti(seed) {
    const words = ['CONCRETE FLOW', 'FLOW', 'GRIND', 'SK8 CREW', 'NO LIMITS', 'MEGA', 'DROP IN', 'RIDE ON', 'KICKFLIP', 'SESSION'];
    const pals = [['#ff3d7f', '#ffd23f', '#1b1b1b'], ['#3ddcff', '#7cff6b', '#14213d'], ['#ff8c42', '#fff275', '#3a0ca3'], ['#c77dff', '#80ffdb', '#240046']];
    return canvasTex(1024, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const p = pals[seed % pals.length];
      for (let i = 0; i < 6; i++) { g.fillStyle = p[i % 2] + '55'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 60 + Math.random() * 120, 20 + Math.random() * 50, Math.random(), 0, 7); g.fill(); }
      g.font = 'italic 900 120px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 18; g.strokeStyle = p[2]; const word = words[seed % words.length];
      g.save(); g.translate(w / 2, h / 2); g.rotate(-0.06); g.strokeText(word, 0, 0);
      const grd = g.createLinearGradient(0, -60, 0, 60); grd.addColorStop(0, p[1]); grd.addColorStop(1, p[0]);
      g.fillStyle = grd; g.fillText(word, 0, 0); g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(word, 0, 0); g.restore();
      for (let i = 0; i < 30; i++) { g.fillStyle = p[0]; g.fillRect(Math.random() * w, h * 0.7 + Math.random() * h * 0.3, 2, 6 + Math.random() * 30); }
    });
  }

  /* ---------------- Materialien (CC0-Fototexturen von Poly Haven, 2K) ---------------- */
  const M = {};
  const loader = new THREE.TextureLoader();
  let maxAniso = 8;
  function photo(name, repeat = 1, color = true) {
    const t = loader.load(`assets/textures/${name}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = maxAniso;
    if (color) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function pbr(name, repeat, opts = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({
      map: photo(name + '_diff', repeat), normalMap: photo(name + '_nor_gl', repeat, false),
      roughnessMap: photo(name + '_rough', repeat, false), roughness: 1, metalness: 0,
      normalScale: new THREE.Vector2(1, 1),
    }, opts));
  }
  function makeMaterials(renderer) {
    maxAniso = renderer.capabilities.getMaxAnisotropy();
    M.ground = pbr('ground', 1, { color: 0xe8e6e2 });
    M.ramp = pbr('ramp', 1, { color: 0xf2f0ea, normalScale: new THREE.Vector2(0.6, 0.6) });
    M.side = pbr('ramp', 1, { color: 0xc9c6bf });
    M.dark = pbr('brick', 1.6, { color: 0xffffff });
    M.wood = pbr('wood', 1, { color: 0xfff4e6 });
    M.asphalt = pbr('asphalt', 1.2, { color: 0xd8d8d8 });
    M.paintRed = pbr('ramp', 1, { color: 0xc8402e });
    M.paintBlue = pbr('ramp', 1, { color: 0x3f7fc4 });
    M.paintYellow = pbr('ramp', 1, { color: 0xf2b632 });
    M.metal = new THREE.MeshStandardMaterial({ color: 0xd5dbe1, metalness: 1, roughness: 0.22 });
    M.metalDark = new THREE.MeshStandardMaterial({ color: 0x50565e, metalness: 0.9, roughness: 0.35 });
    M.bowl = pbr('ramp', 1, { color: 0xf2f0ea, side: THREE.DoubleSide, normalScale: new THREE.Vector2(0.6, 0.6) });
    M.grass = pbr('grass', 350, { color: 0xd8e8c8 });
    macroVariation(M.ground, 0.03, 0.28); macroVariation(M.ramp, 0.06, 0.18); macroVariation(M.side, 0.06, 0.2);
    macroVariation(M.bowl, 0.08, 0.18); macroVariation(M.grass, 0.012, 0.45); macroVariation(M.wood, 0.05, 0.2);
  }

  /* ---------------- Geometrie aus Profil ---------------- */
  // Erzeugt Mesh für ein Profilvolumen. Lokale Koordinaten: u (Profilachse), h (Höhe), e (Breite).
  function profileMeshes(s, topMat, sideMat) {
    const N = s.prof.curved ? 28 : 1;
    const samples = [];
    for (let i = 0; i <= N; i++) { const u = s.len * i / N; const [h, m] = s.prof.f(u); samples.push({ u, h, m }); }
    const depth = s.axis === 'x' ? s.z1 - s.z0 : s.x1 - s.x0;
    const toWorld = (u, h, e) => s.axis === 'x'
      ? [s.rev ? s.x1 - u : s.x0 + u, h, s.z0 + e]
      : [s.x0 + e, h, s.rev ? s.z1 - u : s.z0 + u];
    const dirWorld = (nu, nh, ne) => s.axis === 'x' ? [s.rev ? -nu : nu, nh, ne] : [ne, nh, s.rev ? -nu : nu];

    function builder() {
      const pos = [], nor = [], uv = [];
      return {
        // ns: drei lokale Normalen, uvs: drei UV-Paare, nc: Normale für die Winding-Prüfung
        tri(a, b, c, ns, uvs, nc) {
          const A = toWorld(...a), B = toWorld(...b), C = toWorld(...c), Nw = dirWorld(...nc);
          const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ac = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
          const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
          const NN = ns.map(v => dirWorld(...v));
          const order = (cr[0] * Nw[0] + cr[1] * Nw[1] + cr[2] * Nw[2] < 0) ? [0, 2, 1] : [0, 1, 2];
          const P = [A, B, C];
          for (const i of order) { pos.push(...P[i]); nor.push(...NN[i]); uv.push(uvs[i][0] * 0.25, uvs[i][1] * 0.25); }
        },
        geo() { const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; },
      };
    }
    // Oberseite mit glatten Normalen
    const top = builder();
    let arc = 0;
    for (let i = 0; i < N; i++) {
      const a = samples[i], b = samples[i + 1];
      const na = norm([-a.m, 1, 0]), nb = norm([-b.m, 1, 0]), nm = norm([-(a.m + b.m) / 2, 1, 0]);
      const da = arc; arc += Math.hypot(b.u - a.u, b.h - a.h); const db = arc;
      top.tri([a.u, a.h, 0], [b.u, b.h, 0], [b.u, b.h, depth], [na, nb, nb], [[0, da], [0, db], [depth, db]], nm);
      top.tri([a.u, a.h, 0], [b.u, b.h, depth], [a.u, a.h, depth], [na, nb, na], [[0, da], [depth, db], [depth, da]], nm);
    }
    // Seiten
    const side = builder();
    const quad = (p, n, uvs) => { side.tri(p[0], p[1], p[2], [n, n, n], [uvs[0], uvs[1], uvs[2]], n); side.tri(p[0], p[2], p[3], [n, n, n], [uvs[0], uvs[2], uvs[3]], n); };
    for (const e of [0, depth]) {
      const n = [0, 0, e === 0 ? -1 : 1];
      for (let i = 0; i < N; i++) {
        const a = samples[i], b = samples[i + 1];
        quad([[a.u, 0, e], [b.u, 0, e], [b.u, b.h, e], [a.u, a.h, e]], n, [[a.u, 0], [b.u, 0], [b.u, b.h], [a.u, a.h]]);
      }
    }
    const L = samples[N], F = samples[0];
    if (L.h > 0.001) quad([[L.u, 0, 0], [L.u, 0, depth], [L.u, L.h, depth], [L.u, L.h, 0]], [1, 0, 0], [[0, 0], [depth, 0], [depth, L.h], [0, L.h]]);
    if (F.h > 0.001) quad([[0, 0, 0], [0, 0, depth], [0, F.h, depth], [0, F.h, 0]], [-1, 0, 0], [[0, 0], [depth, 0], [depth, F.h], [0, F.h]]);

    const mt = new THREE.Mesh(top.geo(), topMat), ms = new THREE.Mesh(side.geo(), sideMat);
    for (const m of [mt, ms]) { m.castShadow = true; m.receiveShadow = true; add(m); }
    return mt;
  }
  function norm(v) { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; }

  /* Unsichtbares Hindernis (Laternen, Props) */
  function collider(x, z, w, d, h) { const s = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, axis: 'x', rev: false, prof: Prof.flat(h), len: w, invisible: true, layer: curLayer }; surfaces.push(s); if (cap) cap.surfaces.push(s); refresh(); }

  /* Makro-Variation gegen sichtbare Textur-Wiederholung + leichte Verschmutzung */
  function macroVariation(mat, scale = 0.035, amount = 0.22) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uMacroScale = { value: scale }; sh.uniforms.uMacroAmt = { value: amount };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform float uMacroScale, uMacroAmt;
        float mh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float mn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mh(i),mh(i+vec2(1,0)),f.x), mix(mh(i+vec2(0,1)),mh(i+vec2(1,1)),f.x), f.y); }
        float mfbm(vec2 p){ return mn(p)*.55 + mn(p*2.3+7.)*.3 + mn(p*5.1+3.)*.15; }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        float mv = mfbm(vWPos.xz * uMacroScale);
        float stain = smoothstep(.62, .8, mfbm(vWPos.xz * uMacroScale * 3.1 + 11.));
        diffuseColor.rgb *= (1.0 - uMacroAmt * .5) + uMacroAmt * mv;
        diffuseColor.rgb *= 1.0 - stain * .18;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (0.9 + 0.2 * mv), 0.0, 1.0);`);
    };
  }

  /* Bäume: Stamm mit Rinde + Krone aus Blattbüscheln (Alpha-Karten), instanziert */
  function leafTexture() {
    return canvasTex(512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 520; i++) {
        const x = w / 2 + (Math.random() - 0.5) * w * 0.85 * Math.random() * 1.6, y = h / 2 + (Math.random() - 0.5) * h * 0.85 * Math.random() * 1.6;
        if (Math.hypot(x - w / 2, y - h / 2) > w * 0.47) continue;
        const l = 10 + Math.random() * 14, r = Math.random() * Math.PI * 2;
        const gcol = 70 + Math.random() * 70;
        g.fillStyle = `rgb(${30 + Math.random() * 40 | 0},${gcol | 0},${20 + Math.random() * 25 | 0})`;
        g.save(); g.translate(x, y); g.rotate(r); g.beginPath(); g.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(20,40,10,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke(); g.restore();
      }
    });
  }
  function buildTrees() {
    const leafMap = leafTexture();
    const leafMat = new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: 0xd8ecc0 });
    const barkMat = new THREE.MeshStandardMaterial({ map: photo('bark_diff', 1), normalMap: photo('bark_nor_gl', 1, false), roughness: 0.95 });
    barkMat.map.repeat.set(2, 3); barkMat.normalMap.repeat.set(2, 3);
    const variants = [];
    for (let v = 0; v < 4; v++) {
      const H = 5 + v * 1.4;
      const trunkParts = [], leafParts = [];
      const trunk = new THREE.CylinderGeometry(0.16, 0.32, H, 9, 3); trunk.translate(0, H / 2, 0);
      const tp = trunk.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.sin(y * 1.3 + v) * 0.08); }
      trunk.computeVertexNormals(); trunkParts.push(trunk);
      const clusters = 6 + v * 2;
      for (let c = 0; c < clusters; c++) {
        const cy = H * 0.62 + Math.random() * H * 0.45, ang = Math.random() * Math.PI * 2, rr = 0.6 + Math.random() * 1.6;
        const cx = Math.cos(ang) * rr, cz = Math.sin(ang) * rr;
        if (c < 4) { const br = new THREE.CylinderGeometry(0.04, 0.09, rr * 1.3, 5); br.translate(0, rr * 0.65, 0); br.rotateZ(-Math.PI / 2.6); br.rotateY(-ang); br.translate(0, cy - 0.8, 0); trunkParts.push(br); }
        for (let k = 0; k < 4; k++) {
          const sz = 2.2 + Math.random() * 1.6;
          const p = new THREE.PlaneGeometry(sz, sz);
          p.rotateX(Math.random() * Math.PI); p.rotateY(Math.random() * Math.PI); p.rotateZ(Math.random() * 0.6);
          p.translate(cx + (Math.random() - 0.5), cy + (Math.random() - 0.5) * 0.8, cz + (Math.random() - 0.5));
          // Normalen nach außen biegen (weichere Beleuchtung)
          const pn = p.attributes.normal, pp = p.attributes.position;
          for (let i = 0; i < pn.count; i++) { const nx = pp.getX(i), ny = pp.getY(i) - H * 0.8, nz = pp.getZ(i); const l = Math.hypot(nx, ny, nz) || 1; pn.setXYZ(i, nx / l, ny / l, nz / l); }
          leafParts.push(p);
        }
      }
      variants.push({ trunk: THREEX.mergeBufferGeometries(trunkParts.map(g => g.toNonIndexed())), leaves: THREEX.mergeBufferGeometries(leafParts) });
    }
    const spots = [];
    for (let i = 0; i < 220; i++) {
      let x, z; do { x = (Math.random() - 0.5) * 460; z = (Math.random() - 0.5) * 420; } while (Math.abs(x) < 127 && Math.abs(z) < 107);
      spots.push([x, z]);
    }
    const dummy = new THREE.Object3D();
    variants.forEach((v, vi) => {
      const mine = spots.filter((_, i) => i % 4 === vi);
      const it = new THREE.InstancedMesh(v.trunk, barkMat, mine.length), il = new THREE.InstancedMesh(v.leaves, leafMat, mine.length);
      mine.forEach(([x, z], i) => {
        const s = 0.8 + Math.random() * 0.6;
        dummy.position.set(x, 0, z); dummy.rotation.set(0, Math.random() * Math.PI * 2, 0); dummy.scale.set(s, s * (0.9 + Math.random() * 0.3), s); dummy.updateMatrix();
        it.setMatrixAt(i, dummy.matrix); il.setMatrixAt(i, dummy.matrix);
        il.setColorAt(i, new THREE.Color().setHSL(0.24 + Math.random() * 0.06, 0.45, 0.45 + Math.random() * 0.12));
      });
      for (const m of [it, il]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    });
  }

  /* ---------------- Bau-Helfer ---------------- */
  function addSurf(o) {
    const s = Object.assign({ rev: false, top: M.ramp, sideMat: M.side }, o);
    const span = s.axis === 'x' ? s.x1 - s.x0 : s.z1 - s.z0;
    s.len = span; s.layer = curLayer;
    surfaces.push(s); if (cap) cap.surfaces.push(s);
    refresh();
    if (!s.invisible) profileMeshes(s, s.top, s.sideMat);
    return s;
  }
  function box(x0, x1, z0, z1, h, opts = {}) {
    const s = addSurf(Object.assign({ x0, x1, z0, z1, axis: 'x', prof: Prof.flat(h), top: M.ramp }, opts));
    if (opts.edges) for (const e of opts.edges) {
      const y = h + 0.02;
      if (e === 'x0') rail([x0, y, z0 + 0.3], [x0, y, z1 - 0.3], { metal: !!opts.coping, r: 0.035, mat: opts.coping ? M.metal : M.metalDark });
      if (e === 'x1') rail([x1, y, z0 + 0.3], [x1, y, z1 - 0.3], { metal: !!opts.coping, r: 0.035, mat: opts.coping ? M.metal : M.metalDark });
      if (e === 'z0') rail([x0 + 0.3, y, z0], [x1 - 0.3, y, z0], { metal: !!opts.coping, r: 0.035, mat: opts.coping ? M.metal : M.metalDark });
      if (e === 'z1') rail([x0 + 0.3, y, z1], [x1 - 0.3, y, z1], { metal: !!opts.coping, r: 0.035, mat: opts.coping ? M.metal : M.metalDark });
    }
    return s;
  }
  // Rampe / Quarterpipe / Kicker: rising = Richtung, in die es nach oben geht ('+x','-x','+z','-z')
  function ramp(x0, x1, z0, z1, rising, prof, opts = {}) {
    const axis = rising[1], rev = rising[0] === '-';
    return addSurf(Object.assign({ x0, x1, z0, z1, axis, rev, prof }, opts));
  }
  function rail(a, b, opts = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dx = B.x - A.x, dz = B.z - A.z, lenXZ = Math.hypot(dx, dz);
    const r = { a: A, b: B, dx, dz, lenXZ, ux: dx / lenXZ, uz: dz / lenXZ, len3: A.distanceTo(B), metal: opts.metal !== false, id: opts.id || null, name: opts.name || null };
    r.layer = curLayer; rails.push(r); if (cap) cap.rails.push(r);
    if (opts.visual === false) return r;
    const rad = opts.r || 0.045;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, r.len3, 12), opts.mat || M.metal);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.position.y -= rad;
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.castShadow = true; add(m);
    if (opts.posts) {
      const n = Math.max(2, Math.round(lenXZ / 3) + 1);
      for (let i = 0; i < n; i++) {
        const t = 0.04 + 0.92 * i / (n - 1), p = A.clone().lerp(B, t);
        const base = groundAt(p.x, p.z, p.y - 0.15).h, hh = p.y - base;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, hh, 8), opts.mat || M.metal);
        post.position.set(p.x, base + hh / 2, p.z); post.castShadow = true; add(post);
      }
    }
    return r;
  }
  function bowl(x, z, R, D, opts = {}) {
    const Rt = D / 0.985, wRim = Math.sqrt(Rt * Rt - (Rt - D) * (Rt - D)), r0 = R - wRim;
    const b = { x, z, R, D, Rt, r0, name: opts.name };
    bowls.push(b);
    const pts = [new THREE.Vector2(0.001, -D)];
    for (let i = 0; i <= 26; i++) { const w = wRim * i / 26; pts.push(new THREE.Vector2(r0 + w, -D + Rt - Math.sqrt(Rt * Rt - w * w))); }
    const g = new THREE.LatheGeometry(pts, 64);
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 0.25, p.getZ(i) * 0.25);
    const m = new THREE.Mesh(g, opts.mat || M.bowl); m.position.set(x, 0, z); m.receiveShadow = true; add(m);
    // Pool-Kacheln am Rand
    const tile = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.35, 64, 1, true),
      new THREE.MeshStandardMaterial({ map: tiles(opts.tile || '#2f8fc4'), roughness: 0.4, side: THREE.DoubleSide }));
    tile.position.set(x, -0.2, z); add(tile);
    // Coping als Rail-Ring
    const segs = 28;
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      rail([x + Math.cos(a0) * R, 0.03, z + Math.sin(a0) * R], [x + Math.cos(a1) * R, 0.03, z + Math.sin(a1) * R], { r: 0.05, id: 'coping', name: 'Coping' });
    }
    return b;
  }
  function tiles(color) {
    const t = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { g.fillStyle = color; g.fillRect(i * 32 + 2, 2, 28, h - 4); } });
    t.repeat.set(8, 1); return t;
  }
  function stairsVisual(x0, x1, zTop, zBot, hTop, steps) {
    const dz = (zBot - zTop) / steps, dh = hTop / steps;
    for (let i = 0; i < steps; i++) {
      const h = hTop - i * dh;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, Math.abs(dz)), M.side);
      m.position.set((x0 + x1) / 2, h / 2, zTop + dz * (i + 0.5)); m.castShadow = m.receiveShadow = true; add(m);
    }
  }
  function decal(tex, w, h, pos, rotY, rotX = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(...pos); m.rotation.set(rotX, rotY, 0, 'YXZ'); add(m); return m;
  }
  function textSign(text, sub, color) {
    return canvasTex(1024, 256, (g, w, h) => {
      g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 40, w, 40);
      g.fillStyle = '#fff'; g.font = '900 110px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText(text, w / 2, 130);
      g.font = '700 40px Arial, sans-serif'; g.fillText(sub, w / 2, 200);
    });
  }

  /* Lichtquellen für die Nacht (werden von CF.Env geschaltet) */
  const lamps = [];      // {pos, target, type:'flood'|'post', head}
  const nightMats = [];  // emissive Materialien (Fenster, Lampenköpfe)

  /* ---------------- Umgebung ---------------- */
  function environment() {
    // Rasen außen
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), M.grass); gr.rotation.x = -Math.PI / 2; gr.position.y = -0.03; gr.receiveShadow = true; scene.add(gr);
    // Parkboden mit Löchern für Bowls
    const shape = new THREE.Shape(); shape.moveTo(-120, -100); shape.lineTo(120, -100); shape.lineTo(120, 100); shape.lineTo(-120, 100); shape.lineTo(-120, -100);
    for (const b of bowls) { const h = new THREE.Path(); h.absarc(b.x, -b.z, b.R, 0, Math.PI * 2, true); shape.holes.push(h); }
    const fg = new THREE.ShapeGeometry(shape, 48);
    const uv = fg.attributes.uv, p = fg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 0.25, p.getY(i) * 0.25);
    const floor = new THREE.Mesh(fg, M.ground); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const fg2 = new THREE.PlaneGeometry(240, 200, 24, 20); const uv2 = fg2.attributes.uv, p2 = fg2.attributes.position; for (let i = 0; i < uv2.count; i++) uv2.setXY(i, p2.getX(i) * 0.25, p2.getY(i) * 0.25);
    const flat = new THREE.Mesh(fg2, M.ground); flat.rotation.x = -Math.PI / 2; flat.receiveShadow = true; flat.visible = false; scene.add(flat);
    floors.park = floor; floors.flat = flat;
    // Bodenmarkierungen
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2e6c2, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    for (const [x, z, w, d] of [[-30, -10, 160, 0.3], [40, 10, 0.3, 120], [-70, 75, 80, 0.3]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d || 0.3), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); scene.add(m);
    }
    // Außenmauern (begrenzen den Park) mit Graffiti
    const wallH = 4.5;
    box(-122, -120, -102, 102, wallH, { top: M.dark, sideMat: M.dark });
    box(120, 122, -102, 102, wallH, { top: M.dark, sideMat: M.dark });
    box(-120, 120, -102, -100, wallH, { top: M.dark, sideMat: M.dark });
    box(-120, 120, 100, 102, wallH, { top: M.dark, sideMat: M.dark });
    let gi = 0;
    for (let x = -105; x <= 105; x += 26) { decal(graffiti(gi++), 18, 4.5, [x, 2.4, 99.95], Math.PI); decal(graffiti(gi++), 18, 4.5, [x, 2.4, -99.95], 0); }
    for (let z = -80; z <= 80; z += 30) { decal(graffiti(gi++), 18, 4.5, [-119.95, 2.4, z], Math.PI / 2); decal(graffiti(gi++), 18, 4.5, [119.95, 2.4, z], -Math.PI / 2); }

    // Skyline: Gebäude mit Fassadentextur, nachts leuchtende Fenster
    const facadeClones = [];
    const facadeMap = photo('facade_diff', 1), facadeNor = photo('facade_nor_gl', 1, false);
    // Klone teilen sich das Bild, müssen nach dem Laden aber selbst neu hochgeladen werden
    for (const t of [facadeMap, facadeNor]) { const img = t.source; const iv = setInterval(() => { if (img.data && img.data.complete !== false && img.data.width) { facadeClones.forEach(c => { c.needsUpdate = true; }); clearInterval(iv); } }, 200); }
    function windowTex(cols, rows) {
      return canvasTex(256, 512, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        const cw = w / cols, rh = h / rows;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (Math.random() < 0.38) {
          const warm = Math.random() < 0.8;
          g.fillStyle = warm ? `rgb(255,${190 + Math.random() * 50 | 0},${120 + Math.random() * 60 | 0})` : 'rgb(170,200,255)';
          g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x * cw + cw * 0.18, y * rh + rh * 0.2, cw * 0.64, rh * 0.55);
        }
        g.globalAlpha = 1;
      });
    }
    const winTexes = [windowTex(8, 24), windowTex(10, 30), windowTex(6, 20)];
    const tints = [0xd8d2c8, 0xb9c2cc, 0xcfc0a8, 0x9aa3ad, 0xe6e1d8];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + Math.random() * 0.08, d = 270 + Math.random() * 230;
      const w = 22 + Math.random() * 26, dpt = 18 + Math.random() * 20, h = 28 + Math.random() * 95;
      const map = facadeMap.clone(); facadeClones.push(map); map.repeat.set(w / 6, h / 6);
      const nor = facadeNor.clone(); facadeClones.push(nor); nor.repeat.set(w / 6, h / 6);
      const em = winTexes[i % 3].clone(); em.needsUpdate = true; em.repeat.set(Math.max(1, w / 24), Math.max(1, h / 60));
      const mat = new THREE.MeshStandardMaterial({ map, normalMap: nor, color: tints[i % tints.length], roughness: 0.85, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0 });
      nightMats.push({ mat, day: 0, night: 1.6 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), mat);
      m.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); m.rotation.y = -a + Math.PI / 2; m.castShadow = false; scene.add(m);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 3 + Math.random() * 4, dpt * 0.3), M.metalDark);
      roof.position.set(m.position.x, h + 1.5, m.position.z); roof.rotation.y = m.rotation.y; scene.add(roof);
    }
    buildTrees();
    // Flutlichtmasten am Rand
    const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff1d0, emissiveIntensity: 0 });
    nightMats.push({ mat: headMat, day: 0, night: 3 });
    for (const [x, z, tx, tz] of [[-118, -98, -70, -60], [118, -98, 60, -50], [-118, 98, -60, 50], [118, 98, 70, 50], [0, -98, 0, -55], [0, 98, -5, 45], [-118, 0, -50, 10], [118, 0, 40, -5]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 18, 8), M.metalDark); pole.position.set(x, 9, z); pole.castShadow = true; scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1), headMat); head.position.set(x, 18, z); head.lookAt(tx, 0, tz); scene.add(head);
      lamps.push({ type: 'flood', pos: new THREE.Vector3(x, 18, z), target: new THREE.Vector3(tx, 0, tz) });
      collider(x, z, 0.6, 0.6, 18);
    }
    // Laternen im Park
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0 });
    nightMats.push({ mat: bulbMat, day: 0, night: 2.2 });
    for (const [x, z] of [[-6, 4], [24, 34], [-48, 44], [30, -36], [56, 30], [56, -68], [-74, -20], [-80, 60], [86, 12], [-50, -48]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 8), M.metalDark); post.position.set(x, 3, z); post.castShadow = true; scene.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), M.metalDark); arm.position.set(x + 0.5, 6, z); scene.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), bulbMat); bulb.position.set(x + 1.05, 5.85, z); scene.add(bulb);
      lamps.push({ type: 'post', pos: new THREE.Vector3(x + 1.05, 5.7, z) });
      collider(x, z, 0.3, 0.3, 6);
    }
  }

  /* ---------------- Der Megapark (eigenes Layout) ---------------- */
  function buildPark() {
    /* --- Zone 1: MEGA-LINE (Norden) --- */
    // Drop-in-Turm (16 m)
    box(-114, -102, -72, -60, 16, { top: M.wood, sideMat: M.paintRed });
    for (let y = 2; y < 16; y += 3.5) decal(textSign('MEGA', 'DROP-IN 16 M', '#c8402e'), 8, 2, [-108, y, -59.97], 0);
    // Roll-in (Holz, Kreisübergang + 50°-Steilwand)
    const ri = Prof.rollin(12, 1.2);
    let riLen = 0; while (ri.f(riLen)[0] < 16) riLen += 0.01;
    ramp(-102, -102 + riLen, -72, -60, '-x', ri, { top: M.wood, sideMat: M.paintRed });
    // Mega-Kicker
    const kR = 14, kH = 3.2, kLen = Math.sqrt(kR * kR - (kR - kH) * (kR - kH));
    ramp(-55, -55 + kLen, -71, -61, '+x', Prof.circ(kR), { top: M.wood, sideMat: M.paintRed });
    // Landung: Knuckle-Deck + Landehügel
    box(-36, -27.4, -73, -59, 4.95, { top: M.wood, sideMat: M.paintRed, edges: ['z0', 'z1'], coping: true });
    ramp(-27.4, -15, -73, -59, '-x', Prof.linear(0.4), { top: M.wood, sideMat: M.paintRed });
    decal(textSign('GAP', 'MEGA GAP · 20 M', '#2c6fb7'), 10, 2.5, [-36.02, 2.5, -66], -Math.PI / 2);
    // Giga-Quarter (7,5 m)
    const qR = 8, qH = 7.5, qLen = Math.sqrt(qR * qR - (qR - qH) * (qR - qH));
    ramp(30, 30 + qLen, -78, -54, '+x', Prof.circ(qR), { top: M.wood, sideMat: M.paintBlue });
    box(30 + qLen, 46, -78, -54, qH, { top: M.wood, sideMat: M.paintBlue });
    rail([30 + qLen, qH + 0.03, -77.6], [30 + qLen, qH + 0.03, -54.4], { r: 0.06, name: 'Giga-Coping' });
    // Seitliche Hips am Giga-Quarter
    ramp(20, 30, -86, -78, '+x', Prof.linear(0.35), { top: M.ramp });
    ramp(20, 30, -54, -46, '+x', Prof.linear(0.35), { top: M.ramp });
    // Lange Down-Rail neben der Line
    rail([-12, 1.2, -50], [14, 1.2, -50], { posts: true, name: 'Mega-Rail' });

    /* --- Zone 2: HALFPIPE (Nordosten) --- */
    const hR = 4.3, hH = 3.9, hLen = Math.sqrt(hR * hR - (hR - hH) * (hR - hH));
    ramp(70 - hLen, 70, -62, -38, '-x', Prof.circ(hR), { top: M.ramp });
    ramp(86, 86 + hLen, -62, -38, '+x', Prof.circ(hR), { top: M.ramp });
    box(58, 70 - hLen, -62, -38, hH, { top: M.ramp });
    box(86 + hLen, 98, -62, -38, hH, { top: M.ramp });
    rail([70 - hLen, hH + 0.03, -61.6], [70 - hLen, hH + 0.03, -38.4], { r: 0.05, name: 'Coping' });
    rail([86 + hLen, hH + 0.03, -61.6], [86 + hLen, hH + 0.03, -38.4], { r: 0.05, name: 'Coping' });
    // Mini-Ramp daneben
    const mR = 2.6, mH = 1.6, mLen = Math.sqrt(mR * mR - (mR - mH) * (mR - mH));
    ramp(70 - mLen, 70, -30, -18, '-x', Prof.circ(mR));
    ramp(80, 80 + mLen, -30, -18, '+x', Prof.circ(mR));
    box(66, 70 - mLen, -30, -18, mH); box(80 + mLen, 84, -30, -18, mH);
    rail([70 - mLen, mH + 0.03, -29.6], [70 - mLen, mH + 0.03, -18.4], { r: 0.04, name: 'Coping' });
    rail([80 + mLen, mH + 0.03, -29.6], [80 + mLen, mH + 0.03, -18.4], { r: 0.04, name: 'Coping' });
    decal(textSign('HALFPIPE', 'VERT ZONE', '#2c6fb7'), 12, 3, [78, 6.5, -62.5], 0);

    /* --- Zone 3: BOWLS (Südosten) --- */
    bowl(72, 48, 9, 3.2, { name: 'Big Bowl', tile: '#2f8fc4' });
    bowl(96, 70, 5.5, 1.9, { name: 'Mini Bowl', tile: '#e0552d' });
    bowl(98, 30, 6.5, 2.4, { name: 'Pool', tile: '#3cb371' });

    /* --- Zone 4: STREET PLAZA (Mitte/Süden) --- */
    // Plattform mit Treppe und Handrails
    box(-44, -20, 8, 30, 1.6, { top: M.ramp, edges: ['x0'] });
    ramp(-44, -20, 2, 8, '+z', Prof.linear(1.6 / 6));                    // Auffahrt
    ramp(-44, -20, 30, 36.5, '-z', Prof.linear(1.6 / 6.5), { invisible: true }); // Treppe (Physik)
    stairsVisual(-44, -20, 30, 36.5, 1.6, 8);
    rail([-41, 2.28, 30.2], [-41, 0.72, 36.5], { posts: true, id: 'handrail', name: 'Handrail' });
    rail([-23, 2.28, 30.2], [-23, 0.72, 36.5], { posts: true, id: 'handrail', name: 'Handrail' });
    rail([-32, 2.28, 30.2], [-32, 0.72, 36.5], { posts: true, id: 'handrail', name: 'Handrail' });
    // Ledges
    box(-12, -10.8, 12, 32, 0.5, { edges: ['x0', 'x1'], sideMat: M.paintYellow });
    box(-4, -2.8, 12, 26, 0.65, { edges: ['x0', 'x1'], sideMat: M.paintYellow });
    // Manual-Pad
    box(4, 10, 14, 22, 0.28, { edges: ['x0', 'x1', 'z0', 'z1'] });
    // Flatbars
    rail([16, 0.45, 26], [16, 0.45, 44], { posts: true, name: 'Flatbar' });
    rail([-16, 0.45, 52], [-2, 0.45, 52], { posts: true, name: 'Flatbar' });
    // Funbox mit Ledges
    box(-26, -12, 60, 66, 1.2, { edges: ['x0', 'x1'] });
    ramp(-26, -12, 66, 70.5, '-z', Prof.linear(1.2 / 4.5));
    ramp(-26, -12, 55.5, 60, '+z', Prof.linear(1.2 / 4.5));
    rail([-19, 1.75, 60.2], [-19, 1.75, 65.8], { posts: true, name: 'Funbox-Rail' });
    // Kicker-to-Bank
    ramp(22, 25.5, 56, 62, '+x', Prof.linear(1.3 / 3.5), { sideMat: M.paintYellow });
    ramp(34, 40, 52, 66, '-x', Prof.linear(0.45));
    box(40, 44, 52, 66, 2.7);
    // Hubba (abfallende Ledge) neben Treppe
    ramp(-47, -44.2, 30, 36.5, '-z', Prof.linear(0.9 / 6.5, 0.6), { sideMat: M.paintYellow, top: M.paintYellow });
    rail([-44.2, 1.52, 30.1], [-44.2, 0.62, 36.4], { metal: false, r: 0.03, mat: M.metalDark, name: 'Hubba' });
    // Kleine Kicker
    ramp(-60, -56, -6, 0, '-x', Prof.linear(0.28));
    ramp(4, 7, 70, 76, '-z', Prof.linear(0.35));
    // Pyramide / Spine
    ramp(-70, -64, 20, 34, '+x', Prof.linear(0.3));
    ramp(-62, -56, 20, 34, '-x', Prof.linear(0.3));
    box(-64, -62, 20, 34, 1.8, { edges: ['z0', 'z1'], top: M.ramp });
    decal(textSign('STREET PLAZA', 'CONCRETE FLOW MEGAPARK', '#3a3f4a'), 14, 3.5, [-32, 3.5, 7.98], Math.PI);

    /* --- Zone 5: Banks am Rand --- */
    ramp(-110, 110, 88, 94, '+z', Prof.circ(9), { top: M.ramp });
    box(-110, 110, 94, 100, Prof.circ(9).f(6)[0]);
    ramp(-120, -112, -40, 80, '-x', Prof.circ(10));

    spawns.push(
      { id: 'plaza', name: 'Street Plaza', x: 0, z: 40, yaw: Math.PI },
      { id: 'mega', name: 'Mega-Turm (Drop-In)', x: -109, z: -66, yaw: Math.PI / 2, y: 16 },
      { id: 'half', name: 'Halfpipe', x: 78, z: -50, yaw: Math.PI / 2 },
      { id: 'bowl', name: 'Bowls', x: 72, z: 60, yaw: Math.PI },
      { id: 'giga', name: 'Giga-Quarter', x: -2, z: -66, yaw: Math.PI / 2 },
    );
  }

  const floors = {};
  function build(sc, renderer) {
    scene = sc;
    groups.park = new THREE.Group(); groups.custom = new THREE.Group(); scene.add(groups.park); scene.add(groups.custom);
    makeMaterials(renderer);
    curLayer = 'park'; buildPark();
    curLayer = 'env'; environment();
    curLayer = 'park';
    refresh();
  }

  /* ================= Map-Editor: Objekt-Katalog ================= */
  // Param: [min, max, Schritt, Standard, Bezeichnung]
  const PIECES = {
    kicker:   { name: 'Kicker', cat: 'Rampen', params: { w: [1, 8, 0.5, 3, 'Breite'], l: [1.5, 6, 0.5, 3, 'Länge'], h: [0.3, 2.5, 0.1, 1, 'Höhe'] },
      build(p, H) { H.ramp(0, 0, p.w, p.l, '+z', Prof.linear(p.h / p.l)); } },
    quarter:  { name: 'Quarterpipe', cat: 'Rampen', params: { w: [2, 24, 1, 8, 'Breite'], h: [1, 7, 0.25, 2.5, 'Höhe'], deck: [1, 4, 0.5, 2, 'Deck'] },
      build(p, H) { const R = p.h / 0.985, L = Math.sqrt(R * R - (R - p.h) * (R - p.h)), T = L + p.deck;
        H.ramp(0, -T / 2 + L / 2, p.w, L, '+z', Prof.circ(R)); H.box(0, -T / 2 + L + p.deck / 2, p.w, p.deck, p.h);
        H.rail([-p.w / 2 + 0.2, p.h + 0.03, -T / 2 + L], [p.w / 2 - 0.2, p.h + 0.03, -T / 2 + L], { r: 0.05, name: 'Coping' }); } },
    bank:     { name: 'Bank', cat: 'Rampen', params: { w: [2, 20, 1, 6, 'Breite'], l: [2, 10, 0.5, 5, 'Länge'], h: [0.5, 3, 0.1, 1.5, 'Höhe'], deck: [0, 4, 0.5, 1.5, 'Deck'] },
      build(p, H) { const T = p.l + p.deck; H.ramp(0, -T / 2 + p.l / 2, p.w, p.l, '+z', Prof.linear(p.h / p.l)); if (p.deck > 0) H.box(0, -T / 2 + p.l + p.deck / 2, p.w, p.deck, p.h); } },
    halfpipe: { name: 'Halfpipe', cat: 'Rampen', params: { w: [4, 24, 1, 10, 'Breite'], h: [1.2, 5, 0.25, 3, 'Höhe'], flat: [2, 14, 1, 6, 'Flat'], deck: [1, 3, 0.5, 2, 'Deck'] },
      build(p, H) { const R = p.h / 0.985, L = Math.sqrt(R * R - (R - p.h) * (R - p.h)), f = p.flat / 2;
        for (const sg of [-1, 1]) {
          H.ramp(0, sg * (f + L / 2), p.w, L, sg > 0 ? '+z' : '-z', Prof.circ(R)); H.box(0, sg * (f + L + p.deck / 2), p.w, p.deck, p.h);
          H.rail([-p.w / 2 + 0.2, p.h + 0.03, sg * (f + L)], [p.w / 2 - 0.2, p.h + 0.03, sg * (f + L)], { r: 0.05, name: 'Coping' });
        } } },
    spine:    { name: 'Spine', cat: 'Rampen', params: { w: [2, 16, 1, 6, 'Breite'], h: [0.6, 3, 0.1, 1.5, 'Höhe'], l: [1.5, 5, 0.5, 3, 'Länge'] },
      build(p, H) { H.ramp(0, -p.l / 2, p.w, p.l, '+z', Prof.circ(p.l * 1.4)); H.ramp(0, p.l / 2, p.w, p.l, '-z', Prof.circ(p.l * 1.4));
        const hh = Prof.circ(p.l * 1.4).f(p.l)[0]; H.rail([-p.w / 2 + 0.2, hh + 0.03, 0], [p.w / 2 - 0.2, hh + 0.03, 0], { r: 0.05, name: 'Spine' }); } },
    funbox:   { name: 'Funbox', cat: 'Obstacles', params: { w: [2, 10, 0.5, 4, 'Breite'], top: [1, 8, 0.5, 3, 'Plateau'], h: [0.3, 1.5, 0.1, 0.7, 'Höhe'], r: [1.5, 4, 0.5, 2.5, 'Rampenlänge'] },
      build(p, H) { H.box(0, 0, p.w, p.top, p.h); H.ramp(0, -p.top / 2 - p.r / 2, p.w, p.r, '+z', Prof.linear(p.h / p.r)); H.ramp(0, p.top / 2 + p.r / 2, p.w, p.r, '-z', Prof.linear(p.h / p.r));
        for (const sx of [-1, 1]) H.rail([sx * p.w / 2, p.h + 0.02, -p.top / 2 + 0.2], [sx * p.w / 2, p.h + 0.02, p.top / 2 - 0.2], { r: 0.035, metal: false, mat: M.metalDark, name: 'Funbox' }); } },
    pyramid:  { name: 'Pyramide', cat: 'Obstacles', params: { top: [1, 6, 0.5, 2.5, 'Plateau'], h: [0.4, 2, 0.1, 0.9, 'Höhe'], r: [1.5, 4, 0.5, 2.5, 'Rampenlänge'] },
      build(p, H) { H.box(0, 0, p.top, p.top, p.h); const o = p.top / 2 + p.r / 2, m = Prof.linear(p.h / p.r);
        H.ramp(0, -o, p.top, p.r, '+z', m); H.ramp(0, o, p.top, p.r, '-z', m); H.ramp(-o, 0, p.r, p.top, '+x', m); H.ramp(o, 0, p.r, p.top, '-x', m); } },
    box:      { name: 'Box / Manual-Pad', cat: 'Obstacles', params: { w: [1, 10, 0.5, 3, 'Breite'], l: [1, 12, 0.5, 5, 'Länge'], h: [0.15, 1.5, 0.05, 0.4, 'Höhe'] },
      build(p, H) { H.box(0, 0, p.w, p.l, p.h, { sideMat: M.side });
        const y = p.h + 0.02, W = p.w / 2, L = p.l / 2;
        for (const [a, b] of [[[-W, y, -L + 0.2], [-W, y, L - 0.2]], [[W, y, -L + 0.2], [W, y, L - 0.2]], [[-W + 0.2, y, -L], [W - 0.2, y, -L]], [[-W + 0.2, y, L], [W - 0.2, y, L]]])
          H.rail(a, b, { r: 0.035, name: 'Box' }); } },
    ledge:    { name: 'Ledge', cat: 'Obstacles', params: { l: [2, 20, 0.5, 8, 'Länge'], h: [0.3, 1.2, 0.05, 0.5, 'Höhe'], w: [0.4, 1.5, 0.1, 0.6, 'Tiefe'] },
      build(p, H) { H.box(0, 0, p.w, p.l, p.h, { sideMat: M.paintYellow });
        for (const sx of [-1, 1]) H.rail([sx * p.w / 2, p.h + 0.02, -p.l / 2 + 0.2], [sx * p.w / 2, p.h + 0.02, p.l / 2 - 0.2], { r: 0.035, metal: false, mat: M.metalDark, name: 'Ledge' }); } },
    rail:     { name: 'Rail', cat: 'Obstacles', params: { l: [2, 24, 0.5, 6, 'Länge'], h: [0.2, 1.2, 0.05, 0.45, 'Höhe'] },
      build(p, H) { H.rail([0, p.h, -p.l / 2], [0, p.h, p.l / 2], { posts: true, name: 'Rail' }); } },
    stairs:   { name: 'Treppe + Handrail', cat: 'Obstacles', params: { w: [2, 10, 0.5, 5, 'Breite'], h: [0.6, 3, 0.1, 1.4, 'Höhe'], top: [2, 6, 0.5, 3, 'Plattform'] },
      build(p, H) { const L = p.h / 0.27, T = p.top + L, z0 = -T / 2;
        H.box(0, z0 + p.top / 2, p.w, p.top, p.h);
        H.ramp(0, z0 + p.top + L / 2, p.w, L, '-z', Prof.linear(p.h / L), { invisible: true });
        const n = Math.max(3, Math.round(p.h / 0.17));
        for (let i = 0; i < n; i++) { const hh = p.h - i * p.h / n; H.visBox(0, z0 + p.top + (i + 0.5) * L / n, p.w, L / n, hh, M.side); }
        H.rail([0, p.h + 0.8, z0 + p.top + 0.15], [0, 0.8, z0 + T], { posts: true, id: 'handrail', name: 'Handrail' });
        H.rail([-p.w / 2, p.h + 0.02, z0 + 0.2], [-p.w / 2, p.h + 0.02, z0 + p.top - 0.1], { r: 0.035, metal: false, mat: M.metalDark, name: 'Plattform' }); } },
    spawn:    { name: 'Startpunkt', cat: 'Spezial', params: {}, single: true,
      build(p, H) { H.marker(); } },
  };
  const PROP_TYPES = { barrier: 'Betonbarriere', bench: 'Holzbank', seating: 'Sitzbank', trash: 'Mülleimer', planter: 'Pflanzkasten', hydrant: 'Hydrant' };
  for (const k in PROP_TYPES) PIECES['prop_' + k] = { name: PROP_TYPES[k], cat: 'Props', params: {}, prop: k,
    build(p, H) { H.prop(k); } };

  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x6bff8f, transparent: true, opacity: 0.38, depthWrite: false });
  function buildPiece(def, layer = 'custom') {
    const P = PIECES[def.t]; if (!P) return null;
    const p = {}; for (const k in P.params) p[k] = def.p && def.p[k] !== undefined ? +def.p[k] : P.params[k][3];
    const c = { def, group: new THREE.Group(), surfaces: [], rails: [] };
    c.group.userData.piece = c;
    const rot = ((def.r | 0) % 4 + 4) % 4, X = def.x, Z = def.z;
    const R = (lx, lz) => { let x = lx, z = lz; for (let i = 0; i < rot; i++) { const t = x; x = z; z = -t; } return [X + x, Z + z]; };
    const DIRS = ['+z', '+x', '-z', '-x'], rd = d => DIRS[(DIRS.indexOf(d) + rot) % 4];
    const rect = (cx, cz, w, l) => { const [x, z] = R(cx, cz), odd = rot % 2, W = odd ? l : w, L = odd ? w : l; return [x - W / 2, x + W / 2, z - L / 2, z + L / 2]; };
    const H = {
      box: (cx, cz, w, l, h, o) => { const [x0, x1, z0, z1] = rect(cx, cz, w, l); return box(x0, x1, z0, z1, h, o); },
      ramp: (cx, cz, w, l, d, prof, o) => { const [x0, x1, z0, z1] = rect(cx, cz, w, l); return ramp(x0, x1, z0, z1, rd(d), prof, o); },
      rail: (a, b, o) => { const [ax, az] = R(a[0], a[2]), [bx, bz] = R(b[0], b[2]); return rail([ax, a[1], az], [bx, b[1], bz], o); },
      visBox: (cx, cz, w, l, h, mat) => { const [x0, x1, z0, z1] = rect(cx, cz, w, l); const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat); m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; add(m); },
      prop: k => { if (CF.Props) CF.Props.placeProp(k, X, Z, rot * Math.PI / 2, { grind: ['barrier', 'bench', 'seating'].includes(k), metal: k === 'seating' }); },
      marker: () => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xff6b35, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(X, 0.03, Z); add(ring);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 16), new THREE.MeshBasicMaterial({ color: 0xff6b35 }));
        const [ax, az] = R(0, 1.4); arrow.position.set(ax, 0.3, az); arrow.rotation.set(Math.PI / 2, 0, 0); arrow.rotation.order = 'YXZ'; arrow.rotation.y = rot * Math.PI / 2; add(arrow);
        c.isMarker = true;
      },
    };
    const prevCap = cap, prevLayer = curLayer; cap = c; curLayer = layer;
    try { P.build(p, H); } finally { cap = prevCap; curLayer = prevLayer; }
    if (layer === 'ghost') { c.group.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } }); scene.add(c.group); }
    else groups.custom.add(c.group);
    refresh();
    return c;
  }
  function removePiece(c) {
    if (!c) return;
    for (const s of c.surfaces) { const i = surfaces.indexOf(s); if (i >= 0) surfaces.splice(i, 1); }
    for (const r of c.rails) { const i = rails.indexOf(r); if (i >= 0) rails.splice(i, 1); }
    c.group.traverse(o => { if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); });
    c.group.removeFromParent();
    refresh();
  }
  let customPieces = [], customSpawn = null;
  function setPark(on) {
    parkOn = on; groups.park.visible = on;
    if (floors.park) { floors.park.visible = on; floors.flat.visible = !on; }
    refresh();
  }
  function clearCustom() { for (const c of customPieces) removePiece(c); customPieces = []; customSpawn = null; }
  function loadMap(map) {
    clearCustom();
    setPark(!map || map.base !== 'leer');
    if (!map) return;
    for (const d of map.pieces || []) { const c = buildPiece(d); if (c) customPieces.push(c); }
    const sp = (map.pieces || []).find(d => d.t === 'spawn');
    customSpawn = sp ? { id: 'custom', name: 'Start', x: sp.x, z: sp.z, yaw: (sp.r | 0) * Math.PI / 2 } : { id: 'custom', name: 'Start', x: 0, z: 0, yaw: 0 };
  }
  function defaultSpawn() { return customSpawn || spawns[0]; }

  return { build, groundAt, blocked, rails: activeRails, spawns, surfaces, bowls, M, lamps, nightMats, collider, addBox: (...a) => box(...a), rail: (...a) => rail(...a), photo,
    PIECES, buildPiece, removePiece, setPark, loadMap, clearCustom, defaultSpawn, refresh, add: o => add(o),
    withLayer(layer, fn) { const p = curLayer; curLayer = layer; try { return fn(); } finally { curLayer = p; refresh(); } },
    get parkOn() { return parkOn; }, get customPieces() { return customPieces; }, set customPieces(v) { customPieces = v; },
    get customGroup() { return groups.custom; } };
})();
