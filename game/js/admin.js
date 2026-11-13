/* Concrete Flow – Verstecktes Admin-Modmenü
   Öffnen: auf der Tastatur "flowadmin" tippen, Strg+Umschalt+F10,
   oder am Controller LB + RB + LT + RT gedrückt halten und R3 klicken. */
window.CF = window.CF || {};
CF.Admin = (() => {
  const $ = id => document.getElementById(id);
  const M = () => CF.Mods;
  const cyc = (arr, v, d) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
  const st = { open: false, sel: 0, debug: false, spot: 0, unlocked: false };
  const onoff = v => v ? '<b class="on">AN</b>' : '<b class="off">AUS</b>';
  const items = [
    { k: 'God-Mode (keine Stürze)', get: () => onoff(M().noBail), adj: () => { M().noBail = !M().noBail; } },
    { k: 'Unendliche Grind-Balance', get: () => onoff(M().infBalance), adj: () => { M().infBalance = !M().infBalance; } },
    { k: 'Schwerkraft', get: () => ({ 0.35: 'Mond', 0.7: 'Leicht', 1: 'Normal', 1.6: 'Schwer' })[M().gravity], adj: d => { M().gravity = cyc([0.35, 0.7, 1, 1.6], M().gravity, d); } },
    { k: 'Pop-Stärke', get: () => M().pop + '×', adj: d => { M().pop = cyc([1, 1.5, 2, 3], M().pop, d); } },
    { k: 'Max. Tempo', get: () => M().speed + '×', adj: d => { M().speed = cyc([1, 1.5, 2, 3], M().speed, d); } },
    { k: 'Spielgeschwindigkeit', get: () => M().timeScale + '×', adj: d => { M().timeScale = cyc([0.25, 0.5, 1, 1.5], M().timeScale, d); } },
    { k: 'Uhrzeit', get: () => CF.Env.timeString, adj: d => CF.Env.setTime(CF.Env.st.time + d) },
    { k: 'Tageslänge', get: () => CF.Env.st.dayLength ? CF.Env.st.dayLength + ' Min' : 'Angehalten', adj: d => { CF.Env.st.dayLength = cyc([0, 2, 10, 24, 48], CF.Env.st.dayLength, d); } },
    { k: 'Wetter', get: () => CF.Env.WEATHER[CF.Env.st.weather].name, adj: d => { const K = CF.Env.KEYS; CF.Env.setWeather(K[(K.indexOf(CF.Env.st.weather) + d + K.length) % K.length]); } },
    { k: 'Auto-Wetter', get: () => onoff(CF.Env.st.auto), adj: () => { CF.Env.st.auto = !CF.Env.st.auto; } },
    { k: 'NPC-Anzahl', get: () => CF.NPC.count, adj: d => { CF.NPC.setCount(CF.NPC.count + d); } },
    { k: 'Teleport', get: () => CF.World.spawns[st.spot].name + ' (Enter)', adj: d => { st.spot = (st.spot + d + CF.World.spawns.length) % CF.World.spawns.length; }, act: () => CF.Game.teleport(CF.World.spawns[st.spot]) },
    { k: 'Level', get: () => 'Lv ' + CF.Progress.level, adj: d => { CF.Progress.setLevel(CF.Progress.level + d); CF.Game.refreshHUD(); } },
    { k: '+10.000 XP', get: () => 'Enter', act: () => CF.Progress.addXP(10000) },
    { k: 'Alle Skater freischalten', get: () => 'Enter', act: () => { CF.Progress.unlockAll(); CF.Game.toast('Alle Skater freigeschaltet'); } },
    { k: 'Alle Challenges abschließen', get: () => 'Enter', act: () => CF.Game.completeAll() },
    { k: '+50.000 Punkte', get: () => 'Enter', act: () => CF.Game.addScore(50000) },
    { k: 'Debug-Anzeige', get: () => onoff(st.debug), adj: () => { st.debug = !st.debug; $('debug').classList.toggle('show', st.debug); } },
    { k: 'Alle Mods zurücksetzen', get: () => 'Enter', act: () => { Object.assign(M(), { gravity: 1, pop: 1, speed: 1, noBail: false, infBalance: false, timeScale: 1 }); } },
    { k: 'Schließen', get: () => 'Esc', act: () => close() },
  ];
  function open() { st.open = true; st.sel = 0; $('admin').classList.add('show'); render(); CF.Audio.uiOk(); if (!st.unlocked) { st.unlocked = true; CF.Game.toast('🔧 Admin-Modmenü freigeschaltet'); } }
  function close() { st.open = false; $('admin').classList.remove('show'); }
  // Geheimer Zugang
  function checkSecret() {
    const r = CF.Input.raw;
    if (r.typed('flowadmin')) return true;
    if (r.pressed('F10') && r.key('ControlLeft') && r.key('ShiftLeft')) return true;
    if (r.btn(4) && r.btn(5) && r.btn(6) && r.btn(7) && r.pressed('GP11')) return true;
    return false;
  }
  function update() {
    const r = CF.Input.raw; r.poll();
    const P = k => r.pressed(k);
    if (P('ArrowUp') || P('GP12') || P('KeyW')) st.sel = (st.sel - 1 + items.length) % items.length;
    if (P('ArrowDown') || P('GP13') || P('KeyS')) st.sel = (st.sel + 1) % items.length;
    const it = items[st.sel];
    if ((P('ArrowLeft') || P('GP14') || P('KeyA')) && it.adj) it.adj(-1);
    if ((P('ArrowRight') || P('GP15') || P('KeyD')) && it.adj) it.adj(1);
    if (P('Enter') || P('GP0')) { if (it.act) it.act(); else if (it.adj) it.adj(1); CF.Audio.ui(); }
    if (P('Escape') || P('GP1')) close();
    if (st.open) render();
  }
  function render() {
    $('admin-list').innerHTML = items.map((it, i) => `<div class="ph-row${i === st.sel ? ' sel' : ''}"><span>${it.k}</span><span>${it.get()}</span></div>`).join('');
  }
  let fpsT = 0, frames = 0, fps = 0;
  function debug(dt, P) {
    if (!st.debug) return;
    frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    $('debug').textContent = `FPS ${fps} · ${P.state} · x ${P.x.toFixed(1)} y ${P.y.toFixed(2)} z ${P.z.toFixed(1)} · ${CF.Env.timeString} ${CF.Env.WEATHER[CF.Env.st.weather].name} · nass ${(CF.Env.wet * 100) | 0}%`;
  }
  return { open, close, checkSecret, update, debug, get isOpen() { return st.open; } };
})();
