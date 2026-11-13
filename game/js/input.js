/* Concrete Flow – Eingabe: Controller (XInput/DualShock/DualSense via Gamepad-API), Maus, Tastatur + Vibration */
window.CF = window.CF || {};
CF.Input = (() => {
  const keys = {};
  const pressed = new Set();           // in diesem Frame neu gedrückte Tasten/Buttons
  const mouse = { down: false, x: 0, y: 0, rdown: false, lookX: 0, lookY: 0, wheel: 0 };
  const typed = []; // für versteckte Codes
  let gp = null, gpPrev = [], gpName = '';
  let vibrate = true;
  const DZ = 0.18;

  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed.add(e.code);
    if (e.ctrlKey || e.metaKey) { pressed.add('Ctrl+' + e.code); if (['KeyS', 'KeyZ', 'KeyY', 'KeyD'].includes(e.code) && document.body.classList.contains('editing')) e.preventDefault(); }
    if (e.key && e.key.length === 1) { typed.push(e.key.toLowerCase()); if (typed.length > 16) typed.shift(); }
    keys[e.code] = true;
    CF.Audio.init();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; mouse.x = mouse.y = 0; });
  addEventListener('mousedown', e => {
    CF.Audio.init();
    if (e.button === 0 && e.target.tagName === 'CANVAS') { mouse.down = true; mouse.x = mouse.y = 0; }
    if (e.button === 2) mouse.rdown = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) { mouse.down = false; mouse.x = mouse.y = 0; } if (e.button === 2) mouse.rdown = false; });
  addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  addEventListener('mousemove', e => {
    if (mouse.down || mouse.rdown) { mouse.lookX += e.movementX; mouse.lookY += e.movementY; }
    if (!mouse.down) return;
    mouse.x += e.movementX / 70; mouse.y += e.movementY / 70;
    const m = Math.hypot(mouse.x, mouse.y); if (m > 1) { mouse.x /= m; mouse.y /= m; }
  });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('gamepadconnected', e => { gpName = e.gamepad.id; CF.Audio.init(); CF.onGamepad && CF.onGamepad(true, e.gamepad.id); });
  addEventListener('gamepaddisconnected', () => { gpName = ''; CF.onGamepad && CF.onGamepad(false); });

  const dz = v => Math.abs(v) < DZ ? 0 : (v - Math.sign(v) * DZ) / (1 - DZ);

  function poll() {
    gp = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (gp) {
      gp.buttons.forEach((b, i) => { const v = b.pressed || b.value > 0.5; if (v && !gpPrev[i]) pressed.add('GP' + i); gpPrev[i] = v; });
    }
  }
  const btn = i => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
  const axis = i => gp && gp.axes[i] !== undefined ? dz(gp.axes[i]) : 0;

  /* ---------- Flick-Erkennung am rechten Stick ---------- */
  const flick = { st: 'idle', t: 0, visL: false, visR: false, centerT: 0 };
  function sector(x, y) {
    if (Math.hypot(x, y) < 0.62) return null;
    const a = Math.atan2(x, -y) * 180 / Math.PI; // 0 = oben, 90 = rechts, ±180 = unten
    if (a > -22.5 && a <= 22.5) return 'U';
    if (a > 22.5 && a <= 67.5) return 'UR';
    if (a > 67.5 && a <= 112.5) return 'R';
    if (a > 112.5 && a <= 157.5) return 'DR';
    if (a > -67.5 && a <= -22.5) return 'UL';
    if (a > -112.5 && a <= -67.5) return 'L';
    if (a > -157.5 && a <= -112.5) return 'DL';
    return 'D';
  }
  const DOWN = s => s === 'D' || s === 'DL' || s === 'DR';
  const UP = s => s === 'U' || s === 'UL' || s === 'UR';
  function updateFlick(dt, x, y, out) {
    const s = sector(x, y), m = Math.hypot(x, y);
    if (flick.st === 'idle') { if (DOWN(s)) flick.st = 'loaded'; return; }
    if (flick.st === 'loaded') {
      if (DOWN(s)) return;
      flick.st = 'leaving'; flick.t = 0; flick.visL = flick.visR = false; flick.centerT = 0;
    }
    flick.t += dt;
    if (s === 'L') flick.visL = true;
    if (s === 'R') flick.visR = true;
    if (UP(s)) {
      if (flick.visL && s !== 'UR') out.trick = 'tre';
      else if (flick.visR && s !== 'UL') out.trick = 'hard';
      else out.trick = s === 'U' ? 'ollie' : s === 'UL' ? 'kickflip' : 'heelflip';
      flick.st = 'idle'; return;
    }
    if (DOWN(s)) { flick.st = 'loaded'; return; }
    if (m < 0.25) {
      flick.centerT += dt;
      if (flick.centerT > 0.1) {
        if (flick.visL) out.trick = 'shove'; else if (flick.visR) out.trick = 'varial';
        flick.st = 'idle';
      }
    } else flick.centerT = 0;
    if (flick.t > 0.6) flick.st = 'idle';
  }

  /* Liefert den Eingabezustand für einen Frame */
  function sample(dt) {
    poll();
    const out = {};
    const lx = axis(0);
    out.steer = clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + lx, -1, 1);
    out.push = !!(keys.KeyW || btn(0) || btn(7));
    out.brake = !!(keys.KeyS || btn(1) || btn(6));
    out.grabIndy = !!(keys.KeyE || keys.ShiftLeft || btn(5));
    out.grabMelon = !!(keys.KeyQ || btn(4));
    // Rechter Stick: Controller > Maus > Pfeiltasten
    let rx = axis(2), ry = axis(3);
    if (Math.hypot(rx, ry) < 0.2) {
      if (mouse.down) { rx = mouse.x; ry = mouse.y; }
      else {
        rx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
        ry = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
        const m = Math.hypot(rx, ry); if (m > 1) { rx /= m; ry /= m; }
      }
    }
    out.rx = rx; out.ry = ry;
    updateFlick(dt, rx, ry, out);
    out.crouch = flick.st === 'loaded' || !!keys.Space;
    // Direkte Trick-Tasten (Tastatur)
    const map = { KeyJ: 'kickflip', KeyK: 'heelflip', KeyL: 'shove', KeyI: 'tre', KeyU: 'varial', KeyO: 'hard' };
    for (const k in map) if (pressed.has(k)) out.trick = map[k];
    if (pressed.has('Space')) out.trick = out.trick || 'ollie';
    out.reset = pressed.has('KeyR') || pressed.has('GP8');
    out.pause = pressed.has('Escape') || pressed.has('KeyP') || pressed.has('GP9');
    out.music = pressed.has('KeyM') || pressed.has('GP3');
    out.camera = pressed.has('KeyC') || pressed.has('GP11');
    out.goals = pressed.has('Tab') || pressed.has('GP2');
    out.photo = pressed.has('KeyF') || pressed.has('GP13');
    out.replay = pressed.has('KeyV') || pressed.has('GP12');
    return out;
  }

  /* Menü-Navigation */
  let navCool = 0;
  function menu(dt) {
    poll();
    navCool -= dt;
    let dir = 0;
    const ly = axis(1);
    if (pressed.has('ArrowUp') || pressed.has('KeyW') || pressed.has('GP12')) dir = -1;
    if (pressed.has('ArrowDown') || pressed.has('KeyS') || pressed.has('GP13')) dir = 1;
    if (!dir && Math.abs(ly) > 0.6 && navCool <= 0) { dir = Math.sign(ly); navCool = 0.25; }
    if (Math.abs(ly) < 0.3) navCool = 0;
    let side = 0;
    if (pressed.has('ArrowLeft') || pressed.has('KeyA') || pressed.has('GP14')) side = -1;
    if (pressed.has('ArrowRight') || pressed.has('KeyD') || pressed.has('GP15')) side = 1;
    return {
      dir, side,
      ok: pressed.has('Enter') || pressed.has('GP0'),
      back: pressed.has('Escape') || pressed.has('GP1') || pressed.has('GP9'),
    };
  }

  /* Haptisches Feedback (Dual-Rumble, z. B. Xbox-/PlayStation-Controller unter Windows) */
  let rumbleUntil = 0;
  function rumble(strong, weak, ms, force) {
    if (!vibrate || !gp) return;
    const now = performance.now();
    if (!force && now < rumbleUntil - 30) return;
    rumbleUntil = now + ms;
    const a = gp.vibrationActuator;
    try {
      if (a && a.playEffect) a.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) });
      else if (gp.hapticActuators && gp.hapticActuators[0]) gp.hapticActuators[0].pulse(Math.max(strong, weak), ms);
    } catch (e) { /* nicht unterstützt */ }
  }

  function endFrame() { pressed.clear(); mouse.lookX = mouse.lookY = 0; mouse.wheel = 0; }
  /* Rohzugriff (Freecam, Fotomodus, Replay, Admin) */
  const raw = {
    key: c => !!keys[c], pressed: c => pressed.has(c), btn, axis,
    get look() { return [mouse.lookX, mouse.lookY]; }, get wheel() { return mouse.wheel; },
    typed: s => { const t = typed.join(''); if (t.endsWith(s)) { typed.length = 0; return true; } return false; },
    poll,
  };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  return {
    sample, menu, endFrame, rumble, raw,
    get gamepadName() { return gpName; },
    get hasGamepad() { return !!gp; },
    set vibration(v) { vibrate = v; }, get vibration() { return vibrate; },
  };
})();
