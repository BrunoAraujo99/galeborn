'use strict';
/* ============================================================
   Settings, quality presets, adaptive quality, FPS meter,
   pause/settings menu (mouse, keyboard and gamepad navigable)
   ============================================================ */
const QUALITY = {
  ultra: { label: 'ULTRA', pr: 2.0, samples: 4, shadow: 2048, soft: true, particles: 1 },
  high: { label: 'HIGH', pr: 1.5, samples: 4, shadow: 2048, soft: true, particles: 1 },
  medium: { label: 'MEDIUM', pr: 1.0, samples: 2, shadow: 1024, soft: true, particles: 0.85 },
  low: { label: 'LOW', pr: 0.75, samples: 0, shadow: 512, soft: false, particles: 0.6 },
};
const Q_ORDER = ['ultra', 'high', 'medium', 'low'];

const Settings = {
  v: { quality: 'auto', sens: 1, invertY: false, shake: 1, master: 0.7, music: 0.55, fps: true, camLag: true, lines: true },
  load() {
    try { const s = JSON.parse(localStorage.getItem('galeborn.settings') || '{}'); Object.assign(this.v, s); } catch (e) {}
  },
  save() { try { localStorage.setItem('galeborn.settings', JSON.stringify(this.v)); } catch (e) {} },
  apply() {
    const v = this.v;
    Input.sens = v.sens; Input.invY = v.invertY;
    FX.shakeMul = v.shake;
    Sfx.masterVol = v.master; Sfx.musicVol = v.music;
    if (Sfx.ctx) { Sfx.master.gain.setTargetAtTime(v.master, Sfx.ctx.currentTime, 0.05); Sfx.music.gain.setTargetAtTime(v.music, Sfx.ctx.currentTime, 0.05); }
    Quality.auto = v.quality === 'auto';
    if (!Quality.auto) Quality.set(v.quality); else if (!Quality.level) Quality.set('high');
    $('fps').classList.toggle('show', v.fps);
  },
};

const Quality = {
  level: null, auto: true, acc: 0, n: 0, fps: 60, low: 0, cool: 3, worst: 0,
  set(l) {
    if (!QUALITY[l]) l = 'high';
    this.level = l;
    const q = QUALITY[l], R = Render, r = R.r;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    for (const rt of [R.rtScene, R.rtCut]) if (rt.samples !== q.samples) { rt.samples = q.samples; rt.dispose(); }
    const sh = World.sun.shadow;
    if (sh.mapSize.x !== q.shadow) { sh.mapSize.set(q.shadow, q.shadow); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    const type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (r.shadowMap.type !== type) { r.shadowMap.type = type; R.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
    FX.particleMul = q.particles;
    R.resize();
    this.updateLabel();
  },
  updateLabel() { $('fps').dataset.q = (this.auto ? 'AUTO · ' : '') + QUALITY[this.level].label; },
  // called every frame with real elapsed time
  tick(raw) {
    this.acc += raw; this.n++;
    this.worst = Math.max(this.worst, raw);
    if (this.acc >= 0.5) {
      this.fps = this.n / this.acc;
      const el = $('fps');
      el.textContent = Math.round(this.fps) + ' FPS';
      el.classList.toggle('bad', this.fps < 45);
      this.acc = 0; this.n = 0; this.worst = 0;
      // adaptive: step down after ~3s of struggling during play (ignore hidden tabs and pauses)
      if (this.auto && G.state === 'fight' && !G.paused && document.visibilityState === 'visible') {
        this.cool -= 0.5;
        if (this.fps < 48) this.low += 0.5; else this.low = Math.max(0, this.low - 0.5);
        if (this.low >= 3 && this.cool <= 0) {
          const i = Q_ORDER.indexOf(this.level);
          if (i < Q_ORDER.length - 1) { this.set(Q_ORDER[i + 1]); HUD.prompt('QUALITY → ' + QUALITY[this.level].label, 'help', 2); }
          this.low = 0; this.cool = 5;
        }
      }
    }
  },
};

/* ---------------- pause / settings menu ---------------- */
const Menu = {
  open: false, idx: 0, rows: [],
  init() {
    const v = Settings.v;
    const pct = x => Math.round(x * 100) + '%';
    this.rows = [
      { key: 'quality', label: 'Graphics quality', type: 'choice', opts: ['auto', 'ultra', 'high', 'medium', 'low'], fmt: x => x.toUpperCase() },
      { key: 'fps', label: 'Show frame rate', type: 'toggle' },
      { key: 'sens', label: 'Camera sensitivity', type: 'range', min: 0.3, max: 2.5, step: 0.1, fmt: x => x.toFixed(1) + '×' },
      { key: 'invertY', label: 'Invert camera Y', type: 'toggle' },
      { key: 'camLag', label: 'Chase camera lag', type: 'toggle' },
      { key: 'lines', label: 'Speed lines', type: 'toggle' },
      { key: 'shake', label: 'Screen shake', type: 'range', min: 0, max: 1.5, step: 0.1, fmt: pct },
      { key: 'master', label: 'Master volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct },
      { key: 'music', label: 'Music volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct },
      { key: 'resume', label: 'Resume', type: 'button', act: () => G.togglePause(false) },
      { key: 'restart', label: 'Restart fight', type: 'button', act: () => { G.togglePause(false); G.startIntro(); } },
      { key: 'controls', label: 'Show controls', type: 'button', act: () => $('help').classList.toggle('show') },
    ];
    const box = $('settings');
    box.innerHTML = this.rows.map((r, i) => `<div class="srow ${r.type}" data-i="${i}"><span class="sl">${r.label}</span>${r.type === 'button' ? '' : `<span class="sv"><button class="sa" data-d="-1">◀</button><b></b><button class="sa" data-d="1">▶</button></span>`}</div>`).join('');
    box.addEventListener('click', e => {
      const row = e.target.closest('.srow'); if (!row) return;
      const i = +row.dataset.i; this.idx = i;
      const d = e.target.dataset.d ? +e.target.dataset.d : 1;
      this.change(i, d, true);
    });
    box.addEventListener('mousemove', e => { const row = e.target.closest('.srow'); if (row && +row.dataset.i !== this.idx) { this.idx = +row.dataset.i; this.render(); } });
    this.render();
  },
  change(i, d, click) {
    const r = this.rows[i], v = Settings.v;
    if (r.type === 'button') { if (click || d) r.act(); return; }
    if (r.type === 'toggle') v[r.key] = !v[r.key];
    else if (r.type === 'choice') { const k = r.opts.indexOf(v[r.key]); v[r.key] = r.opts[(k + d + r.opts.length) % r.opts.length]; }
    else v[r.key] = clamp(Math.round((v[r.key] + d * r.step) / r.step) * r.step, r.min, r.max);
    Settings.apply(); Settings.save(); Sfx.ui();
    this.render();
  },
  render() {
    const v = Settings.v;
    document.querySelectorAll('#settings .srow').forEach((el, i) => {
      const r = this.rows[i];
      el.classList.toggle('focus', i === this.idx);
      const b = el.querySelector('b'); if (!b) return;
      b.textContent = r.type === 'toggle' ? (v[r.key] ? 'ON' : 'OFF') : r.fmt ? r.fmt(v[r.key]) : v[r.key];
    });
  },
  // gamepad / keyboard navigation while paused
  nav(a) {
    if (a.up) { this.idx = (this.idx + this.rows.length - 1) % this.rows.length; this.render(); Sfx.ui(); }
    if (a.down) { this.idx = (this.idx + 1) % this.rows.length; this.render(); Sfx.ui(); }
    const r = this.rows[this.idx];
    if (a.left && r.type !== 'button') this.change(this.idx, -1);
    if (a.right && r.type !== 'button') this.change(this.idx, 1);
    if (a.accept) this.change(this.idx, 1, true);
  },
};
