'use strict';
/* ============================================================
   Training room: short playable lessons against a held-back Varukh.
   ============================================================ */
const Training = {
  active: false, idx: 0, ev: {}, base: {}, atkT: 0, doneT: 0,
  lessons() {
    const I = a => `<span class="ic" data-act="${a}">${iconsFor(a, UIIcons.dev || 'kb')}</span>`;
    const elemLine = { water: 'You are water: you deal +12% to him.', fire: 'Fire against fire: no edge either way.', wind: 'Wind is fed by fire, so he has the edge on you. Keep moving.', earth: 'Earth against fire: no edge either way.' }[Hero.id] || '';
    return [
      { title: 'PERFECT STRINGS', need: 3, text: `Press ${I('light')} again right as each blow connects. A gold <b>PERFECT</b> hits harder. Mashing early makes the string weaker and slower.`, count: () => (G.stats.perfects || 0) - (this.base.perfects || 0) },
      { title: 'LAUNCH & CHASE', need: 1, text: `Hold <b>back</b> (away from him) + ${I('light')} to launch him, then ${I('dash')} right away to chase him into the air.`, count: () => this.ev.pursuit || 0 },
      { title: 'BLOCK', need: 2, attacks: true, text: `He is going to charge you. Hold ${I('block')} to block. A block only covers your front and drains the guard bar under your health.`, count: () => this.ev.blocked || 0 },
      { title: 'PARRY', need: 1, attacks: true, text: `Now <b>tap</b> ${I('block')} just before his hit lands. A parry staggers him: strike right after for a counter.`, count: () => this.ev.parried || 0 },
      { title: 'BURST', need: 1, attacks: true, setup: p => { p.burst = 100; }, text: `Your <b>BURST</b> gauge is full. Let his charge catch you, then press ${I('block')} while you are hit to break free.`, count: () => (G.stats.bursts || 0) - (this.base.bursts || 0) },
      { title: 'ELEMENTS', need: 1, text: `Water beats fire, fire beats wind, wind beats earth, earth beats water (+12% damage). Varukh is fire. ${elemLine} Hold ${I('heavy')} to charge your heavy and hit him with it.`, count: () => this.ev.heavy || 0 },
    ];
  },
  install() {
    if (this.installed) return; this.installed = true;
    const oc = Guard.check;
    Guard.check = function (...args) { const r = oc.apply(this, args); if (Training.active && r) Training.ev[r] = (Training.ev[r] || 0) + 1; return r; };
    const b = G.realBoss || G.boss, ot = b.takeDamage.bind(b);
    b.takeDamage = function (dmg, post, point, dir, o = {}) { const r = ot(dmg, post, point, dir, o); if (Training.active && r && ['lance', 'firebolt', 'boulder', 'jet'].includes(o.src)) Training.ev.heavy = (Training.ev.heavy || 0) + 1; return r; };
  },
  start() {
    this.install();
    G.mode = 'training'; this.active = true; this.idx = -1;
    G.reset();
    $('title').classList.add('hide'); $('hud').classList.add('show');
    document.querySelector('#bossbar .bn').textContent = 'VARUKH';
    document.querySelector('#bossbar small').textContent = 'TRAINING ROOM';
    const b = G.boss, p = G.player; b.pos.set(0, 0, -3); p.pos.set(0, 0, 4); p.yaw = Math.PI;
    Sfx.init();
    G.beginFight(true);
    $('trainBox').classList.add('show');
    this.next();
  },
  next() {
    this.idx++;
    const L = this.lessons();
    if (this.idx >= L.length) return this.finish();
    this.ev = {}; this.base = { perfects: G.stats.perfects || 0, bursts: G.stats.bursts || 0 };
    const l = L[this.idx]; this.atkT = 1.8; this.doneT = 0;
    if (l.setup) l.setup(G.player);
    $('trLes').textContent = `LESSON ${this.idx + 1} / ${L.length}`;
    $('trTitle').textContent = l.title; $('trText').innerHTML = l.text;
    this.render(0, l.need);
    HUD.banner(l.title, 'flow');
  },
  render(n, need) { $('trProg').innerHTML = Array.from({ length: need }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); },
  update(dt) {
    if (!this.active || G.state !== 'fight') return;
    const b = G.boss, p = G.player;
    // nobody dies in here
    if (p.hp < p.maxHp * 0.5) p.hp = p.maxHp;
    if (b.hp < b.maxHp * 0.6) b.hp = b.maxHp;
    b.pendingPhase = false;
    if (p.state === 'pursuit') this.ev.pursuit = 1;
    const L = this.lessons(), l = L[this.idx]; if (!l) return;
    // he only attacks when the lesson needs it, with room to react
    if (b.state !== 'attack') b.cool = 999;
    if (l.attacks && this.doneT <= 0) {
      if (b.state === 'idle') { this.atkT -= dt; if (this.atkT <= 0) { this.atkT = 2.8; this.forceRush(); } }
      if (l.title === 'BURST' && p.burst < 100 && !Burst.can(p) && p.state === 'move') p.burst = 100;
    }
    const n = Math.min(l.need, l.count());
    if (n !== this.lastN) { this.lastN = n; this.render(n, l.need); if (n > 0) Sfx.ting(1800 + n * 300); }
    if (n >= l.need && this.doneT <= 0) {
      this.doneT = 1.6; HUD.banner('CLEAR!', 'fight'); Sfx.P('sfx_flow_full', 0.8) || Sfx.ting(2600);
      FX.burst(p.chest(), 40, { speed: 10, life: 0.6, s0: 0.35, c0: C.white, c1: C.wind });
    }
    if (this.doneT > 0) { this.doneT -= dt; if (this.doneT <= 0) { this.lastN = -1; this.next(); } }
  },
  forceRush() {
    const b = G.boss;
    b.atk = b.rush(); b.atk.name = 'rush'; b.last = 'rush';
    b.state = 'attack'; b.at = 0; b.prevAt = -1;
    Sfx.bv && Sfx.bv('attack', 0.4, 2);
  },
  finish() {
    try { localStorage.setItem('galeborn.trained', '1'); } catch (e) {}
    HUD.banner('TRAINING COMPLETE', 'fight'); Sfx.victory && Sfx.victory();
    $('trTitle').textContent = 'ALL LESSONS CLEAR'; $('trText').innerHTML = 'Take it online, or warm up against a bot.'; $('trProg').innerHTML = '';
    $('trainBtn').classList.remove('new');
    setTimeout(() => { if (this.active) G.toTitle(); }, 3200);
  },
  stop() {
    if (!this.active) return;
    this.active = false; G.mode = 'solo';
    $('trainBox').classList.remove('show');
    document.querySelector('#bossbar small').textContent = 'THE CINDER WARDEN';
  },
};

/* back to the title screen from anywhere */
G.toTitle = function () {
  if (Duel.active) Duel.leave();
  Training.stop();
  G.reset(); G.state = 'title';
  $('hud').classList.remove('show'); $('title').classList.remove('hide'); $('select').classList.remove('show'); $('endPanel').className = 'panel';
  Input.unlock();
};
