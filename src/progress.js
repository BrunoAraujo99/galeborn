'use strict';
/* ============================================================
   Progression: hero mastery XP, unlockable colours, titles and
   finisher effects. Saved locally, synced to the profile online.
   ============================================================ */
const MAX_LV = 10;
const LV_XP = [0, 0, 150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150]; // total xp needed for each level
const SKINS = [
  { n: 'CLASSIC', lv: 1 },
  { n: 'DUSK', lv: 2, tint: 0xd2bfff, main: 0xa98cff, pale: 0xe6dcff, glow: 0xc8b0ff },
  { n: 'FROST', lv: 5, tint: 0xd8f0ff, main: 0x9fe4ff, pale: 0xf2fbff, glow: 0xc8f0ff },
  { n: 'GILDED', lv: 8, tint: 0xffe6b0, main: 0xffc840, pale: 0xfff2c8, glow: 0xffe08a },
];
const TITLES = {
  wind: ['BREEZE WALKER', 'STORM DANCER', 'EYE OF THE TEMPEST'],
  fire: ['SPARK', 'FURNACE FIST', 'SUNBREAKER'],
  earth: ['PEBBLE', 'IRONROOT', 'MOUNTAIN THAT WALKS'],
  water: ['RIPPLE', 'UNDERTOW', 'TIDE ETERNAL'],
};
const TITLE_LV = [3, 6, 10];
const FINISHERS = [{ id: 'petals', n: 'PETAL STORM', lv: 4 }, { id: 'ink', n: 'INK SPLASH', lv: 7 }, { id: 'stars', n: 'STARFALL', lv: 9 }];

const Progress = {
  d: null,
  load() {
    if (this.d) return this.d;
    let d = null; try { d = JSON.parse(localStorage.getItem('galeborn.prog') || 'null'); } catch (e) {}
    d = d && typeof d === 'object' ? d : {};
    d.xp = d.xp || {}; d.sel = d.sel || {}; d.games = d.games || {};
    return (this.d = d);
  },
  save() {
    if (IS_BOT) return;
    try { localStorage.setItem('galeborn.prog', JSON.stringify(this.d)); } catch (e) {}
    clearTimeout(this.syncT); this.syncT = setTimeout(() => this.sync(), 1500);
  },
  sync() {
    if (!Api.me || !Api.token) return;
    Api.rpc('gb_progress_save', { p_token: Api.token, p_progress: { xp: this.d.xp, sel: this.d.sel, games: this.d.games }, p_title: this.titleOf(Hero.id) || '' }).catch(() => {});
  },
  // a server copy with more xp wins (new device, cleared storage)
  merge(remote) {
    if (!remote || !remote.xp) return;
    const d = this.load(); let ch = false;
    for (const h in remote.xp) if ((remote.xp[h] || 0) > (d.xp[h] || 0)) { d.xp[h] = remote.xp[h]; if (remote.sel && remote.sel[h]) d.sel[h] = remote.sel[h]; if (remote.games && remote.games[h]) d.games[h] = remote.games[h]; ch = true; }
    if (ch) { try { localStorage.setItem('galeborn.prog', JSON.stringify(d)); } catch (e) {} this.applyLocal(); }
  },
  xp(h) { return this.load().xp[h] || 0; },
  level(h) { const x = this.xp(h); let l = 1; while (l < MAX_LV && x >= LV_XP[l + 1]) l++; return l; },
  sel(h) { const d = this.load(); return (d.sel[h] = d.sel[h] || { skin: 0, title: -1, fin: -1 }); },
  skinOf(h) { const s = SKINS[this.sel(h).skin] || SKINS[0]; return this.level(h) >= s.lv ? s : SKINS[0]; },
  titleOf(h) { const i = this.sel(h).title; return i >= 0 && this.level(h) >= TITLE_LV[i] ? TITLES[h][i] : ''; },
  finOf(h) { const i = this.sel(h).fin; return i >= 0 && this.level(h) >= FINISHERS[i].lv ? FINISHERS[i].id : ''; },
  unlocksAt(h, lv) {
    const u = [];
    SKINS.forEach(s => { if (s.lv === lv) u.push(s.n + ' COLOURS'); });
    TITLE_LV.forEach((l, i) => { if (l === lv) u.push('TITLE: ' + TITLES[h][i]); });
    FINISHERS.forEach(f => { if (f.lv === lv) u.push('FINISHER: ' + f.n); });
    return u;
  },
  nextUnlock(h) { for (let l = this.level(h) + 1; l <= MAX_LV; l++) { const u = this.unlocksAt(h, l); if (u.length) return { lv: l, what: u[0] }; } return null; },
  // award xp after a fight; returns a summary for the end screen
  grant(kind, won, extra = {}) {
    if (IS_BOT) return null;
    const h = Hero.id, d = this.load(), before = this.level(h);
    let x = { online: won ? 120 : 60, bot: won ? 70 : 35, solo: won ? 150 : 50, training: 100 }[kind] || 30;
    if (kind === 'bot') x = Math.round(x * ({ easy: 0.6, normal: 1, hard: 1.4 }[extra.diff] || 1));
    const s = G.stats || {};
    const bonus = Math.min(60, (s.perfects || 0) * 3 + (s.moments || 0) * 8 + (s.punishes || 0) * 4);
    x += bonus;
    d.xp[h] = (d.xp[h] || 0) + x;
    const g = (d.games[h] = d.games[h] || { p: 0, w: 0 }); if (kind !== 'training') { g.p++; if (won) g.w++; }
    const after = this.level(h), un = [];
    for (let l = before + 1; l <= after; l++) un.push(...this.unlocksAt(h, l));
    this.save();
    return { h, gain: x, bonus, lv: after, up: after > before, unlocks: un };
  },
  endHtml(r) {
    if (!r) return '';
    const d = HEROES[r.h], x = this.xp(r.h), lo = LV_XP[r.lv], hi = LV_XP[Math.min(MAX_LV, r.lv + 1)];
    const k = r.lv >= MAX_LV ? 1 : (x - lo) / Math.max(1, hi - lo);
    return `<div class="xpLine"><span>${d.name} MASTERY · LV ${r.lv}${r.up ? ' <em>LEVEL UP!</em>' : ''}</span><b>+${r.gain} XP</b><i style="--k:${(k * 100).toFixed(0)}%"></i>${r.unlocks.length ? `<small>UNLOCKED: ${r.unlocks.join(' · ')}</small>` : ''}</div>`;
  },
  // ---- cosmetics on the fighters
  paint(rig, skin, base) {
    rig.tintHex = skin.tint || 0xffffff;
    if (rig.skinMat) rig.skinMat.color.setHex(rig.tintHex);
  },
  applyLocal() {
    const h = Hero.id, sk = this.skinOf(h);
    Hero.apply(h);
    if (sk.main) { HC.main = sk.main; HC.pale = sk.pale; HC.glow = sk.glow; HC.mid = sk.main; HC.aura = sk.main; C.wind.setHex(sk.main); }
    const p = G.player; if (p) { this.paint(p.rig, sk); for (const k in p.trails) p.trails[k].mat.uniforms.color.value.setHex(k === 'F' ? HC.pale : HC.main); }
    const t = this.titleOf(h);
    if ($('pname')) $('pname').innerHTML = `${Hero.def.name} <small>${t || Hero.def.title}</small>`;
  },
  hello() { const h = Hero.id; return { sk: this.sel(h).skin && this.skinOf(h).tint ? SKINS.indexOf(this.skinOf(h)) : 0, ti: this.titleOf(h), fi: this.finOf(h) }; },
  applyOpp(m) {
    if (!Opp.puppet) return;
    const sk = SKINS[m.sk | 0] || SKINS[0];
    this.paint(Opp.puppet.rig, sk);
    if (m.ti) document.querySelector('#bossbar small').textContent = m.ti + ' · ' + Opp.def.name;
    Opp.fin = m.fi || '';
  },
};

/* KO flourishes, unlocked by mastery */
const FinisherFX = {
  play(id, at) {
    if (!id || !at) return;
    if (id === 'petals') {
      const pink = new THREE.Color(0xff9ac8), wh = new THREE.Color(0xfff0f6);
      for (let i = 0; i < 4; i++) setTimeout(() => FX.burst(at.clone().add(new V3(rand(-1, 1), rand(0, 1.5), rand(-1, 1))), 40, { speed: 7, life: 2.2, s0: 0.3, s1: 0.2, c0: wh, c1: pink, up: 2, grav: 1.5, drag: 1.4 }), i * 120);
      FX.ringBill(at, 6, 0xff9ac8, 0.4); FX.popup(at.clone().add(new V3(0, 1.6, 0)), '✿', 'tag', Render.camera);
    } else if (id === 'ink') {
      Render.post.impact = 1; FX.impactLines(at, 36, 0x0a0610, 9, 0.45); FX.star(at, 7, 0x0a0610, 0.3); FX.shockwave(at, 0.9, 2.4, 0.7);
      FX.burst(at, 50, { speed: 14, life: 0.8, s0: 0.5, c0: new THREE.Color(0x1a1020), c1: new THREE.Color(0x000000), add: false, alpha: 0.9, grav: 10 });
    } else if (id === 'stars') {
      for (let i = 0; i < 8; i++) setTimeout(() => { const p = at.clone().add(new V3(rand(-3, 3), rand(0.5, 4), rand(-3, 3))); FX.star(p, rand(1.5, 3), 0xfff2b0, 0.35); FX.burst(p, 10, { speed: 4, life: 0.6, s0: 0.25, c0: C.white, c1: new THREE.Color(0xffe080) }); }, i * 90);
      FX.groundRing(at.clone().setY(0.05), 8, 0xffe080, 0.6);
    }
    Sfx.ting(2400);
  },
};
