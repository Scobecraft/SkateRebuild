/* Concrete Flow – Map-Editor */
window.CF = window.CF || {};
CF.Editor = (() => {
  const W = CF.World;
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cf_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cf_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const GRID = 0.5, BOUND_X = 116, BOUND_Z = 96;
  const st = {
    active: false, map: null, tool: 'select', rot: 0, params: {}, selected: null, moving: null,
    cursor: new THREE.Vector3(), ghost: null, ghostKey: '', undo: [], redo: [], dirty: false,
    cam: { x: 0, z: 0, dist: 34, yaw: 0.6, pitch: 0.85 }, drag: null, paramSel: 0,
  };
  let camera, canvas, helper = null;
  const ray = new THREE.Raycaster(), mouseNDC = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const TOOL_KEYS = () => ['select', ...Object.keys(W.PIECES)];

  /* ---------------- Map-Verwaltung ---------------- */
  function allMaps() { return store.get('maps', {}); }
  function saveMap() {
    const maps = allMaps(); st.map.updated = Date.now(); maps[st.map.id] = st.map;
    if (!store.set('maps', maps)) { CF.Game.toast('⚠ Speichern fehlgeschlagen'); return; }
    st.dirty = false; renderTop(); CF.Game.toast(`💾 Map „${esc(st.map.name)}“ gespeichert`);
  }
  function deleteMap(id) { const m = allMaps(); delete m[id]; store.set('maps', m); }
  function newMap(base) {
    const n = Object.keys(allMaps()).length + 1;
    return { v: 1, id: 'm' + Date.now().toString(36), name: `Meine Map ${n}`, base, pieces: base === 'leer' ? [{ t: 'spawn', x: 0, z: 30, r: 2, p: {} }] : [{ t: 'spawn', x: 0, z: 40, r: 2, p: {} }] };
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  // Importierte Daten prüfen und bereinigen
  function sanitize(m) {
    if (!m || typeof m !== 'object' || !Array.isArray(m.pieces)) throw new Error('Keine gültige Concrete-Flow-Map');
    const out = { v: 1, id: 'm' + Date.now().toString(36), name: String(m.name || 'Importierte Map').slice(0, 40), base: m.base === 'leer' ? 'leer' : 'megapark', pieces: [] };
    for (const d of m.pieces.slice(0, 800)) {
      const P = W.PIECES[d && d.t]; if (!P) continue;
      const x = Math.max(-BOUND_X, Math.min(BOUND_X, +d.x || 0)), z = Math.max(-BOUND_Z, Math.min(BOUND_Z, +d.z || 0));
      const p = {}; for (const k in P.params) { const [mn, mx] = P.params[k]; const v = d.p && isFinite(+d.p[k]) ? +d.p[k] : P.params[k][3]; p[k] = Math.max(mn, Math.min(mx, v)); }
      out.pieces.push({ t: d.t, x, z, r: ((+d.r | 0) % 4 + 4) % 4, p });
    }
    if (!out.pieces.some(d => d.t === 'spawn')) out.pieces.unshift({ t: 'spawn', x: 0, z: 0, r: 0, p: {} });
    return out;
  }
  function exportMap(map) {
    const blob = new Blob([JSON.stringify(map, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (map.name.replace(/[^\w\-äöüÄÖÜß ]/g, '').trim() || 'map') + '.cfmap.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function importMap(cb) {
    const inp = $('ed-file'); inp.value = '';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      if (f.size > 2e6) { CF.Game.toast('⚠ Datei zu groß'); return; }
      f.text().then(t => { const m = sanitize(JSON.parse(t)); const maps = allMaps(); maps[m.id] = m; store.set('maps', maps); CF.Game.toast(`📥 Map „${esc(m.name)}“ importiert`); cb && cb(m); })
        .catch(e => CF.Game.toast('⚠ Import fehlgeschlagen: ' + esc(e.message)));
    };
    inp.click();
  }

  /* ---------------- Undo / Redo ---------------- */
  const snap = () => JSON.stringify(st.map.pieces);
  function pushUndo() { st.undo.push(snap()); if (st.undo.length > 100) st.undo.shift(); st.redo.length = 0; st.dirty = true; renderTop(); }
  function restore(json) { st.map.pieces = JSON.parse(json); select(null); rebuildAll(); st.dirty = true; renderTop(); }
  function undo() { if (!st.undo.length) return; st.redo.push(snap()); restore(st.undo.pop()); }
  function redo() { if (!st.redo.length) return; st.undo.push(snap()); restore(st.redo.pop()); }

  /* ---------------- Aufbau ---------------- */
  function rebuildAll() { W.loadMap(st.map); }
  function pieceOf(def) { return W.customPieces.find(c => c.def === def); }
  function placeDef(def) {
    const P = W.PIECES[def.t];
    if (P.single) { const old = st.map.pieces.find(d => d.t === def.t); if (old) removeDef(old, true); }
    st.map.pieces.push(def);
    const c = W.buildPiece(def); if (c) W.customPieces.push(c);
    return c;
  }
  function removeDef(def, silent) {
    const c = pieceOf(def); if (c) { W.removePiece(c); W.customPieces = W.customPieces.filter(x => x !== c); }
    st.map.pieces = st.map.pieces.filter(d => d !== def);
    if (!silent && st.selected === def) select(null);
  }
  function rebuildDef(def) { const c = pieceOf(def); if (c) { W.removePiece(c); W.customPieces = W.customPieces.filter(x => x !== c); } const n = W.buildPiece(def); if (n) W.customPieces.push(n); updateHelper(); }

  function select(def) {
    st.selected = def; st.moving = null;
    updateHelper(); renderProps();
  }
  function updateHelper() {
    if (helper) { helper.removeFromParent(); helper.geometry.dispose(); helper = null; }
    const c = st.selected && pieceOf(st.selected);
    if (c) { helper = new THREE.BoxHelper(c.group, 0xffd23f); helper.material.depthTest = false; helper.renderOrder = 5; W.customGroup.parent.add(helper); }
  }

  /* ---------------- Vorschau (Geist) ---------------- */
  function updateGhost() {
    const tool = st.moving ? st.moving.t : st.tool;
    if (tool === 'select') { clearGhost(); return; }
    const p = st.moving ? st.moving.p : (st.params[tool] || {});
    const r = st.moving ? st.moving.r : st.rot;
    const key = [tool, st.cursor.x, st.cursor.z, r, JSON.stringify(p)].join('|');
    if (key === st.ghostKey) return;
    clearGhost(); st.ghostKey = key;
    st.ghost = W.buildPiece({ t: tool, x: st.cursor.x, z: st.cursor.z, r, p }, 'ghost');
  }
  function clearGhost() { if (st.ghost) { W.removePiece(st.ghost); st.ghost = null; } st.ghostKey = ''; }

  /* ---------------- Ein- und Ausstieg ---------------- */
  function enter(map, cam, cvs) {
    camera = cam; canvas = cvs;
    st.map = map; st.active = true; st.undo = []; st.redo = []; st.dirty = false; st.tool = 'select'; st.selected = null; st.moving = null;
    for (const k in W.PIECES) if (!st.params[k]) { st.params[k] = {}; for (const pk in W.PIECES[k].params) st.params[k][pk] = W.PIECES[k].params[pk][3]; }
    rebuildAll();
    const sp = map.pieces.find(d => d.t === 'spawn'); if (sp) { st.cam.x = sp.x; st.cam.z = sp.z; }
    $('editor').classList.add('show'); document.body.classList.add('editing');
    renderPalette(); renderTop(); renderProps();
    canvas.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('pointermove', onMove);
    canvas.addEventListener('wheel', onWheel, { passive: true });
  }
  function exit() {
    st.active = false; clearGhost(); select(null);
    $('editor').classList.remove('show'); document.body.classList.remove('editing');
    canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); removeEventListener('pointermove', onMove);
    canvas.removeEventListener('wheel', onWheel);
  }
  function suspend() { clearGhost(); $('editor').classList.remove('show'); document.body.classList.remove('editing'); st.active = false; }
  function resume() { st.active = true; $('editor').classList.add('show'); document.body.classList.add('editing'); rebuildAll(); updateHelper(); }

  /* ---------------- Maus ---------------- */
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    mouseNDC.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouseNDC, camera);
  }
  function cursorFromRay() {
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) setCursor(hit.x, hit.z);
  }
  function setCursor(x, z) {
    st.cursor.set(Math.max(-BOUND_X, Math.min(BOUND_X, Math.round(x / GRID) * GRID)), 0, Math.max(-BOUND_Z, Math.min(BOUND_Z, Math.round(z / GRID) * GRID)));
    $('ed-pos').textContent = `X ${st.cursor.x.toFixed(1)}  Z ${st.cursor.z.toFixed(1)}`;
  }
  function pickPiece() {
    const hits = ray.intersectObjects(W.customGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.piece) o = o.parent; if (o) return o.userData.piece.def; }
    return null;
  }
  function onDown(ev) {
    if (!st.active || ev.target !== canvas) return;
    CF.Audio.init();
    st.drag = { b: ev.button, x: ev.clientX, y: ev.clientY, moved: false, shift: ev.shiftKey };
  }
  function onMove(ev) {
    if (!st.active) return;
    if (st.drag) {
      const dx = ev.clientX - st.drag.x, dy = ev.clientY - st.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) st.drag.moved = true;
      if (st.drag.b === 2 && !st.drag.shift) { st.cam.yaw -= dx * 0.006; st.cam.pitch = Math.max(0.25, Math.min(1.45, st.cam.pitch + dy * 0.005)); }
      else if (st.drag.b === 1 || (st.drag.b === 2 && st.drag.shift)) { pan(-dx * st.cam.dist * 0.0022, -dy * st.cam.dist * 0.0022); }
      st.drag.x = ev.clientX; st.drag.y = ev.clientY;
    }
    if (ev.target === canvas) { pick(ev); cursorFromRay(); }
  }
  function onUp(ev) {
    if (!st.active || !st.drag) return;
    const d = st.drag; st.drag = null;
    if (d.b === 0 && !d.moved && ev.target === canvas) { pick(ev); cursorFromRay(); primary(); }
    if (d.b === 2 && !d.moved && ev.target === canvas) { if (st.moving) cancelMove(); else select(null); }
  }
  function onWheel(ev) { if (st.active) st.cam.dist = Math.max(6, Math.min(140, st.cam.dist * (ev.deltaY > 0 ? 1.12 : 0.89))); }
  function pan(dr, df) {
    const fx = Math.sin(st.cam.yaw + Math.PI), fz = Math.cos(st.cam.yaw + Math.PI);
    st.cam.x += -fz * dr + fx * -df; st.cam.z += fx * dr + fz * -df;
    st.cam.x = Math.max(-BOUND_X, Math.min(BOUND_X, st.cam.x)); st.cam.z = Math.max(-BOUND_Z, Math.min(BOUND_Z, st.cam.z));
  }

  /* ---------------- Aktionen ---------------- */
  function primary() {
    if (st.moving) { // Verschieben abschließen
      pushUndo(); const def = st.moving.def;
      def.x = st.cursor.x; def.z = st.cursor.z; def.r = st.moving.r; st.moving = null; clearGhost();
      const c = pieceOf(def); if (c) c.group.visible = true; rebuildDef(def); CF.Audio.uiOk(); return;
    }
    if (st.tool === 'select') { select(pickPiece()); CF.Audio.ui(); return; }
    pushUndo();
    const def = { t: st.tool, x: st.cursor.x, z: st.cursor.z, r: st.rot, p: Object.assign({}, st.params[st.tool]) };
    placeDef(def); clearGhost(); CF.Audio.uiOk(); CF.Input.rumble(0.1, 0.3, 60);
    renderTop();
  }
  function rotate(d = 1) {
    if (st.moving) { st.moving.r = (st.moving.r + d + 4) % 4; return; }
    if (st.selected && st.tool === 'select') { pushUndo(); st.selected.r = (st.selected.r + d + 4) % 4; rebuildDef(st.selected); return; }
    st.rot = (st.rot + d + 4) % 4;
  }
  function del() { if (!st.selected) return; pushUndo(); removeDef(st.selected); CF.Audio.ui(); renderTop(); }
  function startMove() {
    if (!st.selected) return;
    st.moving = { def: st.selected, t: st.selected.t, r: st.selected.r, p: st.selected.p };
    const c = pieceOf(st.selected); if (c) c.group.visible = false;
    if (helper) helper.visible = false;
  }
  function cancelMove() { const c = st.moving && pieceOf(st.moving.def); if (c) c.group.visible = true; st.moving = null; clearGhost(); updateHelper(); }
  function duplicate() {
    if (!st.selected) return;
    pushUndo(); const d = st.selected;
    const nd = { t: d.t, x: Math.min(BOUND_X, d.x + 2), z: d.z, r: d.r, p: Object.assign({}, d.p) };
    placeDef(nd); select(nd); startMove();
  }
  function setTool(t) { if (st.moving) cancelMove(); st.tool = t; st.paramSel = 0; if (t !== 'select') select(null); renderPalette(); renderProps(); }
  function cycleTool(d) { const T = TOOL_KEYS(); setTool(T[(T.indexOf(st.tool) + d + T.length) % T.length]); }
  function adjustParam(d) {
    const tgt = st.selected && st.tool === 'select' ? st.selected : null;
    const type = tgt ? tgt.t : st.tool; if (type === 'select') return;
    const keys = Object.keys(W.PIECES[type].params); if (!keys.length) return;
    const k = keys[st.paramSel % keys.length], [mn, mx, step] = W.PIECES[type].params[k];
    const obj = tgt ? tgt.p : st.params[type];
    if (tgt) pushUndo();
    obj[k] = Math.round(Math.max(mn, Math.min(mx, obj[k] + d * step)) * 100) / 100;
    if (tgt) rebuildDef(tgt);
    renderProps();
  }

  /* ---------------- UI ---------------- */
  function renderTop() {
    if (!st.map) return;
    $('ed-name').value = st.map.name;
    $('ed-info').textContent = `${st.map.base === 'leer' ? 'Leere Fläche' : 'Megapark-Basis'} · ${st.map.pieces.length} Objekte${st.dirty ? ' · ungespeichert' : ''}`;
  }
  function renderPalette() {
    const cats = {};
    for (const [k, P] of Object.entries(W.PIECES)) (cats[P.cat] = cats[P.cat] || []).push([k, P.name]);
    let html = `<button class="ed-tool${st.tool === 'select' ? ' on' : ''}" data-t="select">🖱 Auswählen</button>`;
    let i = 1;
    for (const [cat, list] of Object.entries(cats)) {
      html += `<div class="ed-cat">${cat}</div>`;
      for (const [k, name] of list) { html += `<button class="ed-tool${st.tool === k ? ' on' : ''}" data-t="${k}">${i <= 9 ? `<kbd>${i}</kbd>` : ''}${name}</button>`; i++; }
    }
    $('ed-palette').innerHTML = html;
    $('ed-palette').querySelectorAll('.ed-tool').forEach(b => b.onclick = () => { setTool(b.dataset.t); CF.Audio.ui(); });
  }
  function renderProps() {
    const tgt = st.selected && st.tool === 'select' ? st.selected : null;
    const type = tgt ? tgt.t : st.tool;
    const box = $('ed-props');
    if (type === 'select' && !tgt) { box.innerHTML = '<div class="ed-ph">Klick auf ein Objekt, um es auszuwählen.<br>Oder links ein Objekt wählen und in die Welt setzen.</div>'; return; }
    const P = W.PIECES[type], obj = tgt ? tgt.p : st.params[type];
    let html = `<div class="ed-ptitle">${tgt ? '✎ ' : '＋ '}${P.name}</div>`;
    Object.entries(P.params).forEach(([k, [mn, mx, step, , label]], i) => {
      html += `<label class="ed-param${i === st.paramSel ? ' sel' : ''}"><span>${label}</span><input type="range" min="${mn}" max="${mx}" step="${step}" value="${obj[k]}" data-k="${k}"><b>${(+obj[k]).toFixed(step < 0.1 ? 2 : 1)} m</b></label>`;
    });
    if (!Object.keys(P.params).length) html += '<div class="ed-ph">Keine Einstellungen.</div>';
    html += `<div class="ed-ph">Drehung: ${((tgt ? tgt.r : st.rot) * 90)}°</div>`;
    if (tgt) html += `<div class="ed-btns"><button data-a="move">✥ Verschieben (G)</button><button data-a="rot">⟳ Drehen (R)</button><button data-a="dup">⧉ Duplizieren (Strg+D)</button><button data-a="del" class="danger">🗑 Löschen (Entf)</button></div>`;
    box.innerHTML = html;
    box.querySelectorAll('input[type=range]').forEach(inp => {
      inp.onchange = () => { if (tgt) pushUndo(); obj[inp.dataset.k] = +inp.value; if (tgt) rebuildDef(tgt); renderProps(); };
      inp.oninput = () => { inp.nextElementSibling.textContent = (+inp.value).toFixed(inp.step < 0.1 ? 2 : 1) + ' m'; if (!tgt) obj[inp.dataset.k] = +inp.value; };
    });
    box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => ({ move: startMove, rot: () => rotate(1), dup: duplicate, del })[b.dataset.a]());
  }
  function wireTop() {
    $('ed-name').oninput = () => { st.map.name = $('ed-name').value.slice(0, 40) || 'Map'; st.dirty = true; renderTop(); };
    $('ed-name').onkeydown = e => e.stopPropagation();
    $('ed-save').onclick = () => saveMap();
    $('ed-test').onclick = () => testRide();
    $('ed-export').onclick = () => exportMap(st.map);
    $('ed-undo').onclick = () => undo();
    $('ed-redo').onclick = () => redo();
    $('ed-exit').onclick = () => CF.Game.leaveEditor(st.dirty);
  }
  function testRide() { clearGhost(); select(null); CF.Game.testRide(st.map, { x: st.cursor.x, z: st.cursor.z }); }

  /* ---------------- Frame-Update (Tastatur, Controller, Kamera) ---------------- */
  function update(dt) {
    if (!st.active) return;
    const r = CF.Input.raw; r.poll();
    const P = k => r.pressed(k), K = r.key;
    const typing = document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text';
    if (!typing) {
      const ctrl = K('ControlLeft') || K('ControlRight');
      if (P('Ctrl+KeyZ')) undo();
      else if (P('Ctrl+KeyY')) redo();
      else if (P('Ctrl+KeyS')) saveMap();
      else if (P('Ctrl+KeyD')) duplicate();
      else if (ctrl) { /* andere Strg-Kombinationen ignorieren */ }
      else {
        const T = TOOL_KEYS();
        for (let i = 1; i <= 9; i++) if (P('Digit' + i)) setTool(T[i]);
        if (P('Digit0') || P('KeyV')) setTool('select');
        if (P('KeyR') || P('GP2')) rotate(K('ShiftLeft') ? -1 : 1);
        if (P('Delete') || P('Backspace') || (P('GP1') && st.selected && !st.moving)) del();
        if (P('KeyG')) startMove();
        if (P('KeyT') || P('GP3')) { testRide(); return; }
        if (P('GP4')) cycleTool(-1);
        if (P('GP5')) cycleTool(1);
        if (P('GP0') || P('Enter')) primary();
        if (P('BracketRight') || P('GP15')) adjustParam(1);
        if (P('BracketLeft') || P('GP14')) adjustParam(-1);
        if (P('GP12') || P('PageUp')) { st.paramSel = Math.max(0, st.paramSel - 1); renderProps(); }
        if (P('GP13') || P('PageDown')) { st.paramSel++; const t = st.selected ? st.selected.t : st.tool; const n = t === 'select' ? 1 : Object.keys(W.PIECES[t].params).length; st.paramSel = Math.min(Math.max(0, n - 1), st.paramSel); renderProps(); }
        if (P('Escape') || P('GP9') || (P('GP1') && !st.selected)) { if (st.moving) cancelMove(); else if (st.selected) select(null); else if (st.tool !== 'select') setTool('select'); else CF.Game.leaveEditor(st.dirty); }
        // Kamera: WASD/Pfeile schwenken, Q/E drehen
        const sp = st.cam.dist * 0.9 * dt * (K('ShiftLeft') ? 2.5 : 1);
        const fw = (K('KeyW') || K('ArrowUp') ? 1 : 0) - (K('KeyS') || K('ArrowDown') ? 1 : 0);
        const sd = (K('KeyD') || K('ArrowRight') ? 1 : 0) - (K('KeyA') || K('ArrowLeft') ? 1 : 0);
        if (fw || sd) pan(sd * sp, -fw * sp);
        if (K('KeyQ')) st.cam.yaw += dt * 1.6;
        if (K('KeyE')) st.cam.yaw -= dt * 1.6;
      }
      // Controller: linker Stick = Cursor (Kamera folgt), rechter Stick = Kamera drehen, LT/RT = Zoom
      const lx = r.axis(0), ly = r.axis(1);
      if (lx || ly) {
        const s = st.cam.dist * 0.7 * dt;
        pan(lx * s, ly * s);
        setCursor(st.cam.x, st.cam.z); cursorPad = true;
      }
      st.cam.yaw -= r.axis(2) * dt * 2; st.cam.pitch = Math.max(0.25, Math.min(1.45, st.cam.pitch + r.axis(3) * dt * 1.5));
      if (r.btn(6)) st.cam.dist = Math.min(140, st.cam.dist * (1 + dt * 1.5));
      if (r.btn(7)) st.cam.dist = Math.max(6, st.cam.dist * (1 - dt * 1.5));
    }
    // Kamera setzen
    const c = st.cam, cp = Math.cos(c.pitch);
    camera.position.set(c.x + Math.sin(c.yaw) * cp * c.dist, Math.sin(c.pitch) * c.dist + 1, c.z + Math.cos(c.yaw) * cp * c.dist);
    camera.lookAt(c.x, 0, c.z); camera.fov = 55; camera.updateProjectionMatrix();
    if (cursorPad) { $('ed-cross').classList.add('show'); } else $('ed-cross').classList.remove('show');
    updateGhost();
    if (helper) helper.update();
  }
  let cursorPad = false;
  addEventListener('mousemove', () => { cursorPad = false; });

  wireTop();
  return {
    enter, exit, suspend, resume, update, allMaps, deleteMap, newMap, exportMap, importMap, sanitize,
    get active() { return st.active; }, get map() { return st.map; }, get dirty() { return st.dirty; }, save: saveMap,
  };
})();
