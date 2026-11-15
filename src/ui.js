// lines of the fire/earth/water heroes map to vo_<id>_<kind>; Varukh's per-hero taunts to vo_varukh_vs_<id>_NN
function heroLineKey(text) {
  for (const id of ['fire', 'earth', 'water']) {
    const d = HEROES[id], L = d.lines;
    let i = L.intro.indexOf(text); if (i >= 0) return `vo_${id}_intro_0${i + 1}`;
    i = L.ult.indexOf(text); if (i >= 0) return `vo_${id}_ult_0${i + 1}`;
    if (text === L.low) return `vo_${id}_lowhp`;
    if (text === L.awaken) return `vo_${id}_awaken`;
    if (text === L.win) return `vo_${id}_victory`;
    i = d.taunt.indexOf(text); if (i >= 0) return `vo_varukh_vs_${id}_0${i + 1}`;
  }
  if (text === 'Not... today!') return `vo_${Hero.id === 'wind' ? 'tavi' : Hero.id}_beam_win`;
  if (text === 'Burn away!') return 'vo_varukh_wave';
  return null;
}
const VO_LINES = {
  "Then I'll be a hurricane.": 'vo_tavi_intro_01', 'The sky belongs to no one. Least of all you.': 'vo_tavi_intro_02',
  'Winds, answer me!': 'vo_tavi_tempest_01', 'Ride the storm with me!': 'vo_tavi_tempest_02', "This is the sky's answer!": 'vo_tavi_tempest_03',
  'Not yet... not like this!': 'vo_tavi_lowhp', '...I hear it now. The whole sky is with me.': 'vo_tavi_awaken',
  'Not this time!': 'vo_tavi_beam_start', 'The wind... does not break!': 'vo_tavi_beam_win', "He's spent. Now!": 'vo_tavi_spent',
  'The sky... is free again.': 'vo_tavi_victory',
  'Little breeze... I will snuff you out.': 'vo_varukh_intro_01', 'The wind bends. The flame devours.': 'vo_varukh_intro_02',
  'Another monk who thinks the sky is theirs?': 'vo_varukh_intro_03', 'Let the heavens fall!': 'vo_varukh_nova_01',
  'Kneel beneath the burning sky!': 'vo_varukh_nova_02', 'Burn away, little breeze!': 'vo_varukh_wave',
  'There is nowhere the wind can hide!': 'vo_varukh_nowhere', 'Enough! Feel the true heat of the pyre!': 'vo_varukh_phase2_01',
  'You fan the flames, little breeze. Now burn!': 'vo_varukh_phase2_02', 'Feeble!': 'vo_varukh_beam_win', 'Ash returns to ash.': 'vo_varukh_victory',
};
'use strict';
/* ============================================================
   UI: button icons, HUD, prompts, subtitles, letterbox, cut-ins
   ============================================================ */
const Icons = {
  face(l, c) { return `<svg class="i-btn" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.5" fill="#15131c" stroke="${c}" stroke-width="2"/><circle cx="13" cy="13" r="8.5" fill="${c}" opacity=".18"/><text x="13" y="17.6" text-anchor="middle" font-size="13" font-weight="900" fill="${c}" font-family="Arial,sans-serif">${l}</text></svg>`; },
  bumper(l) { return `<svg class="i-btn wide" viewBox="0 0 38 24"><path d="M4 20 Q4 5 14 4 L30 4 Q35 4 35 10 L35 20 Z" fill="#15131c" stroke="#e8e8f0" stroke-width="2"/><text x="19.5" y="16.5" text-anchor="middle" font-size="10.5" font-weight="900" fill="#e8e8f0" font-family="Arial,sans-serif">${l}</text></svg>`; },
  trigger(l) { return `<svg class="i-btn" viewBox="0 0 26 30"><path d="M5 28 L5 10 Q5 2 13 2 Q21 2 21 10 L21 28 Z" fill="#15131c" stroke="#e8e8f0" stroke-width="2"/><text x="13" y="21" text-anchor="middle" font-size="9.5" font-weight="900" fill="#e8e8f0" font-family="Arial,sans-serif">${l}</text></svg>`; },
  stick(l, click) { return `<svg class="i-btn" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.5" fill="#15131c" stroke="#e8e8f0" stroke-width="2"/><circle cx="13" cy="13" r="6.5" fill="#2c2a36" stroke="#9a98a8" stroke-width="1.5"/><text x="13" y="16.3" text-anchor="middle" font-size="8.5" font-weight="900" fill="#fff" font-family="Arial,sans-serif">${l}${click ? '3' : ''}</text>${click ? '' : '<path d="M13 1.5 L15 4 L11 4 Z M13 24.5 L15 22 L11 22 Z M1.5 13 L4 11 L4 15 Z M24.5 13 L22 11 L22 15 Z" fill="#e8e8f0"/>'}</svg>`; },
  menu(l) { return `<svg class="i-btn wide" viewBox="0 0 34 22"><rect x="2" y="3" width="30" height="16" rx="8" fill="#15131c" stroke="#e8e8f0" stroke-width="2"/>${l === 'start' ? '<path d="M11 8h12M11 11h12M11 14h12" stroke="#e8e8f0" stroke-width="1.8"/>' : '<rect x="11" y="7" width="7" height="6" fill="none" stroke="#e8e8f0" stroke-width="1.5"/><rect x="15" y="9" width="7" height="6" fill="#15131c" stroke="#e8e8f0" stroke-width="1.5"/>'}</svg>`; },
  key(l) { const w = Math.max(24, 12 + l.length * 8); return `<svg class="i-key" viewBox="0 0 ${w} 26" style="width:${w * 0.9}px"><rect x="1" y="1" width="${w - 2}" height="24" rx="4" fill="#e9e4da"/><rect x="1" y="1" width="${w - 2}" height="20" rx="4" fill="#fbf8f2" stroke="#0d0b12" stroke-width="1.5"/><text x="${w / 2}" y="15.5" text-anchor="middle" font-size="${l.length > 2 ? 9.5 : 12}" font-weight="900" fill="#0d0b12" font-family="Arial,sans-serif">${l}</text></svg>`; },
  mouse(b) {
    const hl = '#2fd8ff';
    return `<svg class="i-btn" viewBox="0 0 22 30"><rect x="2" y="2" width="18" height="26" rx="9" fill="#fbf8f2" stroke="#0d0b12" stroke-width="1.6"/>
      ${b === 'L' ? `<path d="M11 2 A9 9 0 0 0 2 11 L2 13 L11 13 Z" fill="${hl}"/>` : ''}${b === 'R' ? `<path d="M11 2 A9 9 0 0 1 20 11 L20 13 L11 13 Z" fill="${hl}"/>` : ''}
      <path d="M11 2 V13 M2 13 H20" stroke="#0d0b12" stroke-width="1.4"/>${b === 'M' ? `<rect x="9" y="5" width="4" height="6" rx="2" fill="${hl}" stroke="#0d0b12"/>` : ''}${b === 'move' ? '<path d="M11 18 l0 6 M8 21 l6 0" stroke="#0d0b12" stroke-width="1.4"/>' : ''}</svg>`;
  },
};
const PAD = { A: Icons.face('A', '#4ad26a'), B: Icons.face('B', '#ef5a5a'), X: Icons.face('X', '#4a9dff'), Y: Icons.face('Y', '#f2c230'),
  LB: Icons.bumper('LB'), RB: Icons.bumper('RB'), LT: Icons.trigger('LT'), RT: Icons.trigger('RT'), LS: Icons.stick('L'), RS: Icons.stick('R'), R3: Icons.stick('R', true), START: Icons.menu('start'), BACK: Icons.menu('back') };
const K = Icons.key;
const BINDS = {
  move: { kb: [K('W') + K('A') + K('S') + K('D')], pad: [PAD.LS] },
  camera: { kb: [Icons.mouse('move')], pad: [PAD.RS] },
  jump: { kb: [K('Space')], pad: [PAD.A] },
  dash: { kb: [K('Shift')], pad: [PAD.B, PAD.LT] },
  block: { kb: [K('F')], pad: [PAD.LB] },
  light: { kb: [Icons.mouse('L'), K('J')], pad: [PAD.X] },
  heavy: { kb: [Icons.mouse('R'), K('K')], pad: [PAD.Y] },
  special: { kb: [K('E')], pad: [PAD.RB, PAD.RT] },
  lock: { kb: [K('Q'), Icons.mouse('M')], pad: [PAD.R3] },
  pause: { kb: [K('Esc')], pad: [PAD.START] },
  restart: { kb: [K('R')], pad: [PAD.BACK, PAD.A] },
  help: { kb: [K('H')], pad: [] },
  mute: { kb: [K('M')], pad: [] },
};
function iconsFor(act, dev) { const b = BINDS[act]; if (!b) return ''; const list = b[dev] && b[dev].length ? b[dev] : b.kb; return list.join('<i class="or">/</i>'); }
const UIIcons = {
  dev: null,
  refresh(dev) {
    if (dev === this.dev) return;
    this.dev = dev;
    document.querySelectorAll('.ic[data-act]').forEach(el => { el.innerHTML = iconsFor(el.dataset.act, dev); });
    if (HUD.promptAct) HUD.prompt(HUD.promptText, HUD.promptAct, 0, true);
  },
};

const FLOW_C = 2 * Math.PI * 34;
const HUD = {
  init() {
    this.el = {
      hp: $('php'), hpLag: $('phplag'), flow: $('pflow'), flowBox: $('pbars'), bhp: $('bhp'), bhpLag: $('bhplag'), post: $('bpost'), bbar: $('bossbar'), pbar: $('pbar'), gbar: $('pgbar'), guard: $('pguard'),
      combo: $('combo'), comboN: $('comboN'), comboR: $('comboR'), comboD: $('comboD'), banner: $('banner'), reticle: $('reticle'), hud: $('hud'), bossbar: $('bossbar'),
      lockTag: $('locktag'), ring: $('flowRingFg'), prompt: $('prompt'), sub: $('subtitle'), pip2: $('pip2'), postRow: $('postRow'),
    };
    this.hpLag = 1; this.bLag = 1; this.lastCombo = 0; this.lastBhp = 1; this.lastPhp = 1; this.promptT = 0; this.subT = 0;
  },
  banner(text, cls) {
    const b = this.el.banner;
    if (!text) { b.className = ''; return; }
    b.innerHTML = `<span>${text}</span>`; b.className = ''; void b.offsetWidth; b.className = 'show ' + (cls || '');
  },
  setHero() {
    const d = Hero.def;
    $('pname').innerHTML = `${d.name} <small>${d.title}</small>`;
    $('hcN').textContent = d.name; $('hcT').textContent = d.title; $('vsH').textContent = d.name; $('ultLbl').textContent = d.ult.tag;
    const pf = document.querySelector('.portrait .pface'); if (pf) pf.innerHTML = heroGlyph(Hero.id);
  },
  flowReady() { this.prompt(Hero.def.ult.tag + ' READY', 'special', 2.2); },
  prompt(text, act, dur, keep) {
    this.promptText = text; this.promptAct = act;
    this.el.prompt.innerHTML = `<span class="ic" data-act="${act}">${iconsFor(act, UIIcons.dev || 'kb')}</span><b>${text}</b>`;
    if (!keep) { this.el.prompt.classList.remove('show'); void this.el.prompt.offsetWidth; this.promptT = dur; }
    this.el.prompt.classList.add('show');
  },
  say(who, text, dur = 2.6) {
    const s = this.el.sub;
    s.innerHTML = `<b class="${who === 'VARUKH' ? 'boss' : 'hero'}">${who}</b><span>${text}</span>`;
    s.classList.remove('show'); void s.offsetWidth; s.classList.add('show');
    this.subT = dur;
    let k = VO_LINES[text];
    if (!k) k = heroLineKey(text);
    else if (who !== 'VARUKH' && Hero.id !== 'wind') k = k.replace('vo_tavi_', 'vo_' + Hero.id + '_');
    if (k) { Sfx.voice(k, who === 'VARUKH' ? 'boss' : 'hero'); if (Sfx.has(k)) this.subT = Math.max(dur, Sfx.bufs[k][0].duration + 0.5); }
  },
  pulse(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); },
  update(dt) {
    const p = G.player, b = G.boss, e = this.el;
    const hpk = p.hp / p.maxHp;
    if (hpk < this.lastPhp - 0.001) this.pulse(e.pbar, 'hit');
    this.lastPhp = hpk;
    this.hpLag = hpk < this.hpLag ? damp(this.hpLag, hpk, 3, dt) : hpk;
    e.hp.style.width = (hpk * 100) + '%'; e.hpLag.style.width = (this.hpLag * 100) + '%';
    e.flow.style.width = p.flow + '%';
    const gk = (p.guard ?? GUARD_MAX) / GUARD_MAX;
    e.guard.style.width = (gk * 100) + '%';
    e.gbar.classList.toggle('full', gk >= 0.999 && p.state !== 'block'); e.gbar.classList.toggle('low', gk < 0.35); e.gbar.classList.toggle('broken', p.state === 'guardbreak');
    e.ring.style.strokeDashoffset = FLOW_C * (1 - p.flow / 100);
    e.flowBox.classList.toggle('ready', p.flow >= 100);
    const bk = b.hp / b.maxHp;
    if (bk < this.lastBhp - 0.0001) this.pulse(e.bbar, 'hit');
    this.lastBhp = bk;
    this.bLag = bk < this.bLag ? damp(this.bLag, bk, 2.5, dt) : bk;
    e.bhp.style.width = (bk * 100) + '%'; e.bhpLag.style.width = (this.bLag * 100) + '%';
    e.post.style.width = (b.posture / b.maxPosture * 100) + '%';
    e.postRow.classList.toggle('hot', b.posture > 70);
    e.postRow.classList.toggle('broken', b.state === 'stagger');
    e.bossbar.classList.toggle('p2', b.phase === 2);
    e.pip2.classList.toggle('on', b.phase === 2);
    if (p.combo >= 2) {
      e.combo.classList.add('show');
      if (p.combo !== this.lastCombo) { e.comboN.textContent = p.combo; this.pulse(e.combo, 'pop'); }
      const ranks = [[40, 'TEMPEST', 's'], [25, 'SKYBREAKER', 'a'], [15, 'GALE', 'b'], [8, 'GUST', 'c'], [2, 'BREEZE', 'd']];
      const r = ranks.find(r => p.combo >= r[0]);
      e.comboR.textContent = r[1]; e.combo.dataset.rank = r[2];
      e.comboD.textContent = (p.comboDmg || 0).toLocaleString() + ' DMG';
    } else e.combo.classList.remove('show');
    this.lastCombo = p.combo;
    if (G.lockOn && b.alive && G.state === 'fight' && !Cam.shotQ) {
      const v = b.chest(new V3()).project(Render.camera);
      if (v.z < 1) { e.reticle.style.display = 'block'; e.reticle.style.left = ((v.x * 0.5 + 0.5) * 100) + '%'; e.reticle.style.top = ((-v.y * 0.5 + 0.5) * 100) + '%'; }
      else e.reticle.style.display = 'none';
    } else e.reticle.style.display = 'none';
    e.lockTag.innerHTML = `<span class="ic" data-act="lock">${iconsFor('lock', UIIcons.dev || 'kb')}</span>${G.lockOn ? 'LOCK ON' : 'FREE CAM'}`;
    if (this.promptT > 0) { this.promptT -= dt; if (this.promptT <= 0) { e.prompt.classList.remove('show'); this.promptAct = null; } }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) e.sub.classList.remove('show'); }
    // contextual prompts
    if (p.counterT > 0 && this.promptAct !== 'light') this.prompt('COUNTER', 'light', 0.9);
    if (p.state === 'launched' && p.st > 0.12 && this.promptAct !== 'dash') this.prompt('RECOVER', 'dash', 0.5);
    document.body.classList.toggle('cine', !!(Cam.shotQ || Cam.cine) && G.state !== 'title');
  },
};

/* ---------------- anime cut-in panel ---------------- */
const CutIn = {
  t: 0, dur: 0, rig: null,
  init() {
    this.cam = new THREE.PerspectiveCamera(18, 4, 0.05, 200);
    this.el = $('cutText');
  },
  play(rig, who, name, line, dur = 1.2) {
    this.rig = rig; this.who = who; this.t = 0; this.dur = dur;
    Render.cut.color.set(who === 'boss' ? 0xff5a1a : HC.teal);
    this.el.className = 'show ' + who;
    this.el.innerHTML = `<div class="cn">${name}</div><div class="cm">${line}</div>`;
    const ang = -Math.atan(0.28 * window.innerHeight / window.innerWidth) * 180 / Math.PI;
    this.el.style.setProperty('--ang', ang + 'deg');
    Sfx.cutIn(who === 'boss');
  },
  update(dt) {
    const R = Render.cut;
    if (this.t >= this.dur || !this.rig) { R.amt = damp(R.amt, 0, 14, dt); if (R.amt < 0.01) { R.amt = 0; this.el.className = ''; } return; }
    this.t += dt;
    const k = this.t / this.dur;
    R.amt = k < 0.12 ? easeOutF(k / 0.12) : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
    R.slide = k;
    const rig = this.rig;
    rig.root.updateMatrixWorld(true);
    const head = rig.headMesh.getWorldPosition(new V3());
    const fwd = dirOf(rig.root.rotation.y);
    const side = new V3(fwd.z, 0, -fwd.x);
    const sc = rig.root.scale.x;
    const d = (rig.model ? 1.45 : 1.9) * sc;
    this.cam.position.copy(head).addScaledVector(fwd, d).addScaledVector(side, -0.12 * sc * (1 - k * 0.5)); this.cam.position.y += 0.02 * sc;
    this.cam.lookAt(head.clone().addScaledVector(side, (rig.model ? 0.3 : 0.42) * sc).setY(head.y + (rig.model ? 0.03 : 0) * sc));
    this.cam.aspect = window.innerWidth / (window.innerHeight * 0.34);
    this.cam.fov = 17 - k * 3;
    this.cam.updateProjectionMatrix();
    R.cam = this.cam;
    if (k > 0.88) this.el.className = 'hide ' + this.who;
  },
};
