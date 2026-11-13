/* Concrete Flow – Fotomodus */
window.CF = window.CF || {};
CF.Photo = (() => {
  const $ = id => document.getElementById(id);
  const FILTERS = [
    ['Keiner', 'none'], ['Schwarz-Weiß', 'grayscale(1) contrast(1.15)'], ['Warm', 'sepia(0.25) saturate(1.25) hue-rotate(-8deg)'],
    ['Kalt', 'saturate(0.9) hue-rotate(12deg) brightness(1.03)'], ['Vintage', 'sepia(0.55) contrast(0.9) brightness(1.05) saturate(0.85)'],
    ['Kontrast', 'contrast(1.35) saturate(1.2)'], ['Film', 'contrast(1.1) saturate(0.75) sepia(0.12)'],
  ];
  const st = { fov: 60, exposure: 1, filter: 0, vignette: true, hideSkater: false, logo: true, sel: 0, hidden: false };
  let camera, renderer, savedExposure = 1;
  const items = [
    { k: 'FOV', get: () => Math.round(st.fov) + '°', adj: d => { st.fov = Math.max(15, Math.min(110, st.fov + d * 5)); CF.FreeCam.fov = st.fov; } },
    { k: 'Belichtung', get: () => st.exposure.toFixed(2), adj: d => { st.exposure = Math.max(0.3, Math.min(2.5, st.exposure + d * 0.1)); } },
    { k: 'Filter', get: () => FILTERS[st.filter][0], adj: d => { st.filter = (st.filter + d + FILTERS.length) % FILTERS.length; } },
    { k: 'Vignette', get: () => st.vignette ? 'An' : 'Aus', adj: () => { st.vignette = !st.vignette; } },
    { k: 'Uhrzeit', get: () => CF.Env.timeString, adj: d => { CF.Env.setTime(CF.Env.st.time + d * 0.5); } },
    { k: 'Wetter', get: () => CF.Env.WEATHER[CF.Env.st.weather].name, adj: d => { const K = CF.Env.KEYS; CF.Env.setWeather(K[(K.indexOf(CF.Env.st.weather) + d + K.length) % K.length], true); } },
    { k: 'Skater', get: () => st.hideSkater ? 'Versteckt' : 'Sichtbar', adj: () => { st.hideSkater = !st.hideSkater; } },
    { k: 'Wasserzeichen', get: () => st.logo ? 'An' : 'Aus', adj: () => { st.logo = !st.logo; } },
  ];

  function enter(cam, rend) {
    camera = cam; renderer = rend;
    CF.FreeCam.start(camera); st.fov = camera.fov;
    savedExposure = st.exposure = 1;
    $('photo').classList.add('show'); st.hidden = false; $('photo').classList.remove('hidden');
    document.body.classList.add('photo-mode');
    CF.NPC.showTags(false);
    render();
  }
  function exit() {
    $('photo').classList.remove('show'); document.body.classList.remove('photo-mode');
    renderer.domElement.style.filter = ''; $('vignette').classList.remove('show');
    CF.Skater.root.visible = true; CF.NPC.showTags(true);
  }
  function update(dt) {
    const r = CF.Input.raw; r.poll();
    const P = k => r.pressed(k);
    if (P('ArrowUp') || P('GP12')) { st.sel = (st.sel - 1 + items.length) % items.length; CF.Audio.ui(); }
    if (P('ArrowDown') || P('GP13')) { st.sel = (st.sel + 1) % items.length; CF.Audio.ui(); }
    if (P('ArrowLeft') || P('GP14')) { items[st.sel].adj(-1); CF.Audio.ui(); }
    if (P('ArrowRight') || P('GP15')) { items[st.sel].adj(1); CF.Audio.ui(); }
    if (P('KeyH') || P('GP3')) { st.hidden = !st.hidden; $('photo').classList.toggle('hidden', st.hidden); }
    CF.FreeCam.update(dt, camera, { wheelFov: true });
    st.fov = CF.FreeCam.fov;
    renderer.domElement.style.filter = FILTERS[st.filter][1] === 'none' ? '' : FILTERS[st.filter][1];
    $('vignette').classList.toggle('show', st.vignette);
    CF.Skater.root.visible = !st.hideSkater;
    render();
    return { exit: P('Escape') || P('GP1'), shoot: P('Enter') || P('GP0') || P('KeyF') };
  }
  function render() {
    $('ph-list').innerHTML = items.map((it, i) => `<div class="ph-row${i === st.sel ? ' sel' : ''}"><span>${it.k}</span><span>◀ ${it.get()} ▶</span></div>`).join('');
  }
  /* Foto aufnehmen und speichern */
  function shoot(renderFn) {
    renderFn();
    const src = renderer.domElement;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    const f = FILTERS[st.filter][1];
    if (f !== 'none' && 'filter' in g) g.filter = f;
    g.drawImage(src, 0, 0); g.filter = 'none';
    if (st.vignette) {
      const gr = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    }
    if (st.logo) {
      const s = Math.round(c.height / 28);
      g.font = `italic 900 ${s}px Impact, Arial Black, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText('CONCRETE FLOW', c.width - s * 0.8 + 2, c.height - s * 0.6 + 2);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText('CONCRETE FLOW', c.width - s * 0.8, c.height - s * 0.6);
    }
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `ConcreteFlow_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.png`;
    c.toBlob(b => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
    $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go');
    CF.Audio.shutter();
    return name;
  }
  return { enter, exit, update, shoot, st };
})();
