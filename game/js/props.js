/* Concrete Flow – Echte 3D-Props (CC0-Modelle von Poly Haven) mit Kollision und Grind-Kanten */
window.CF = window.CF || {};
CF.Props = (() => {
  const W = CF.World;
  const loader = new THREEX.GLTFLoader();
  const MODELS = {
    barrier: { file: 'concrete_road_barrier' },
    bench: { file: 'painted_wooden_bench' },
    seating: { file: 'modular_street_seating', nodes: ['crossbar', 'legs_double', 'legs_single', 'back_support_r', 'back_support_l', 'arm_rest_01', 'arm_rest_02', 'seat', 'seat_back'], offsetX: 1.16 },
    trash: { file: 'metal_trash_can', nodes: ['metal_trash_can', 'metal_trash_can_lid', 'metal_trash_can_handle_left', 'metal_trash_can_handle_right'] },
    hydrant: { file: 'fire_hydrant', nodes: ['fire_hydrant', 'fire_hydrant_cap_01', 'fire_hydrant_cap_02', 'fire_hydrant_cap_03', 'fire_hydrant_chain'] },
    planter: { file: 'planter_box_01' },
    fence: { file: 'modular_chainlink_fence', nodes: ['modular_chainlink_fence_double'] },
    post: { file: 'modular_chainlink_fence', nodes: ['modular_chainlink_fence_post'] },
  };
  const protos = {};

  function prepare(key, gltf) {
    const spec = MODELS[key];
    const g = new THREE.Group();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      if (spec.nodes && !spec.nodes.includes(o.name) && !(o.parent && spec.nodes.includes(o.parent.name))) return;
      const m = o.clone(); m.matrix.copy(o.matrixWorld); m.matrix.decompose(m.position, m.quaternion, m.scale);
      m.castShadow = true; m.receiveShadow = true;
      if (m.material) m.material.envMapIntensity = 0.8;
      g.add(m);
    });
    // Zentrieren (X/Z), Boden auf y = 0
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    g.children.forEach(m => { m.position.x -= c.x; m.position.z -= c.z; m.position.y -= box.min.y; });
    protos[key] = { group: g, size: box.getSize(new THREE.Vector3()) };
  }

  /* Platziert ein Prop. rotY in Vielfachen von 90°. opts.grind: obere Längskante grindbar */
  function place(scene, key, x, z, rotY = 0, opts = {}) {
    const p = protos[key]; if (!p) return;
    const o = p.group.clone(); o.position.set(x, W.groundAt(x, z, 0.1).h, z); o.rotation.y = rotY; scene.add(o);
    const sw = Math.abs(Math.cos(rotY)) > 0.5 ? p.size.x : p.size.z, sd = Math.abs(Math.cos(rotY)) > 0.5 ? p.size.z : p.size.x;
    const h = opts.h !== undefined ? opts.h : p.size.y;
    if (opts.solid !== false) W.collider(x, z, sw * (opts.shrink || 0.9), sd * (opts.shrink || 0.9), h);
    if (opts.grind) {
      const along = sw >= sd ? 'x' : 'z', L = Math.max(sw, sd) / 2 - 0.08, y = h + 0.01;
      const a = along === 'x' ? [x - L, y, z] : [x, y, z - L], b = along === 'x' ? [x + L, y, z] : [x, y, z + L];
      W.rail(a, b, { visual: false, metal: !!opts.metal, name: opts.name });
    }
  }

  function load(scene) {
    const need = [...new Set(Object.values(MODELS).map(m => m.file))];
    const cache = {};
    return Promise.all(need.map(f => new Promise(res => {
      loader.load(`assets/models/${f}/${f}.gltf`, gl => { cache[f] = gl; res(); }, undefined, e => { console.warn('Modell fehlt', f, e); res(); });
    }))).then(() => {
      for (const k in MODELS) if (cache[MODELS[k].file]) prepare(k, cache[MODELS[k].file]);
      layout(scene);
    });
  }

  function layout(scene) {
    // Reihe Betonbarrieren in der Plaza (grindbar, wie eine lange Ledge)
    for (let i = 0; i < 4; i++) place(scene, 'barrier', 27 + i * 1.56, 21, 0, { grind: true, h: 0.82, name: 'Barriere' });
    for (let i = 0; i < 3; i++) place(scene, 'barrier', -54, -18 + i * 1.56, Math.PI / 2, { grind: true, h: 0.82, name: 'Barriere' });
    // Holzbänke am Südrand (grindbare Sitzkante)
    for (const x of [-60, -30, 10, 34]) place(scene, 'bench', x, 85, Math.PI, { grind: true, h: 0.45, name: 'Bank' });
    // Moderne Sitzbänke
    for (const [x, z, r] of [[60, -72, 0], [60, -28, Math.PI], [-48, 0, Math.PI / 2], [46, 34, -Math.PI / 2], [-86, 46, Math.PI / 2]]) place(scene, 'seating', x, z, r, { grind: true, h: 0.45, metal: true, name: 'Sitzbank' });
    // Mülleimer neben Laternen
    for (const [x, z] of [[-4.5, 5.5], [25.5, 35.5], [-46.5, 45.5], [31.5, -34.5], [57.5, 31.5], [-72.5, -18.5], [-78.5, 61.5], [87.5, 13.5], [-48.5, -46.5]]) place(scene, 'trash', x, z);
    // Hydranten
    for (const [x, z] of [[-30, -16], [44, 47], [-96, 30], [20, -88]]) place(scene, 'hydrant', x, z);
    // Pflanzkästen an der Plattform
    for (let i = 0; i < 5; i++) place(scene, 'planter', -49.5, 11 + i * 4, Math.PI / 2);
    // Maschendrahtzaun hinter der Halfpipe und am Turm
    const fenceLine = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 1.95), rot = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n; place(scene, 'fence', x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, rot, { shrink: 1, h: 2.4 });
        place(scene, 'post', x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, rot, { solid: false });
      }
    };
    fenceLine(100, -64, 100, -36);
    fenceLine(-116, -80, -116, -56);
  }

  return { load };
})();
