'use strict';
/* ============================================================
   Hero select: browse the four fighters on the live 3D model
   ============================================================ */
const Select = {
  idx: 0, cheer: 0,
  open(mode) {
    if (mode) this.mode = mode; else if (!this.mode) this.mode = 'solo';
    G.reset();
    G.state = 'select';
    this.idx = Math.max(0, HERO_ORDER.indexOf(Hero.id));
    $('title').classList.add('hide'); $('hud').classList.remove('show'); $('endPanel').className = 'panel';
    $('select').classList.add('show');
    const p = G.player; p.pos.set(0, 0, 9); p.yaw = Math.PI;
    this.render(); this.cheer = 0;
    Input.unlock();
  },
  build() {
    const box = $('selCards');
    box.innerHTML = HERO_ORDER.map((id, i) => { const d = HEROES[id]; return `<div class="hcard" data-i="${i}" style="--hc:${d.css};--hc2:${d.css2}"><svg class="hg" viewBox="0 0 60 60">${heroGlyph(id)}</svg><b>${d.name}</b><span>${d.title}</span></div>`; }).join('');
    box.addEventListener('click', e => { const c = e.target.closest('.hcard'); if (!c) return; const i = +c.dataset.i; if (i === this.idx) this.confirm(); else this.pick(i); });
    $('selGo').addEventListener('click', () => this.confirm());
  },
  pick(i) {
    this.idx = (i + HERO_ORDER.length) % HERO_ORDER.length;
    const id = HERO_ORDER[this.idx];
    Sfx.ui(); Sfx.whoosh(1.2, 0.3);
    this.render();
    if (id !== Hero.id) G.setHero(id, () => { const p = G.player; p.pos.set(0, 0, 9); p.yaw = Math.PI; FX.burst(p.chest(), 40, { speed: 9, life: 0.6, s0: 0.35, c0: C.white, c1: C.wind }); FX.groundRing(p.pos.clone().setY(0.05), 3, HC.aura, 0.5); this.cheer = 0; });
  },
  render() {
    const d = HEROES[HERO_ORDER[this.idx]];
    document.querySelectorAll('#selCards .hcard').forEach((c, i) => c.classList.toggle('on', i === this.idx));
    const st = d.stats, bar = (v, max) => `<i style="width:${Math.round(clamp(v / max, 0.1, 1) * 100)}%"></i>`;
    $('selInfo').style.setProperty('--hc', d.css); $('selInfo').style.setProperty('--hc2', d.css2);
    $('selInfo').innerHTML = `<div class="sn">${d.name}</div><div class="st">${d.title}</div><p>${d.blurb}</p>
      <div class="ss"><span>VITALITY</span><em>${bar(st.hp, 115)}</em><span>POWER</span><em>${bar(st.dmg, 1.15)}</em><span>SPEED</span><em>${bar(st.speed, 1.05)}</em></div>
      <div class="sg">${d.sig}</div><div class="su">ULTIMATE · ${d.ult.name}</div>`;
  },
  nav(a) {
    if (a.left) this.pick(this.idx - 1);
    if (a.right) this.pick(this.idx + 1);
    if (a.accept || a.confirm) this.confirm();
    if (a.back) { $('select').classList.remove('show'); G.state = 'title'; $('title').classList.remove('hide'); }
  },
  confirm() {
    if (HERO_ORDER[this.idx] !== Hero.id) return; // still loading the model
    if (!G.player.rig.model && HERO_B64()[Hero.id]) return;
    $('select').classList.remove('show');
    Sfx.ui(); Sfx.bigWhoosh();
    if (this.mode === 'solo') G.startIntro(); else if (this.mode === 'training') Training.start(); else Lobby.open(this.mode);
  },
};
