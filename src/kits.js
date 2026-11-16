'use strict';
/* ============================================================
   Element kits: signature mechanics layered on the shared moveset.
     FIRE  (Soren)   HEAT     hits stack burn on Varukh, finishers IGNITE it
     EARTH (Brannoc) STONESKIN big moves have armor, slams/finishers erupt spikes
     WATER (Ysra)    UNDERTOW hits heal, perfect dodges leave a healing surge
   ============================================================ */
const _kv = new V3();
function spikeMesh(h, r) {
  const g = new THREE.ConeGeometry(r, h, 5, 1);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, toon(0x8a7a5a));
  m.castShadow = true; addOutline(m, 0.05);
  return m;
}
const Kit = {
  heat: 0, burnT: 0, ignT: 0,
  reset() { this.heat = 0; this.burnT = 0; this.updateHeatHud(); },
  // ---- called when any player attack lands on Varukh
  onHit(p, res, point, dir, big, tag) {
    const id = Hero.id;
    if (id === 'fire' && tag !== 'burn') {
      if ((tag === 'finisher' || tag === 'counter' || tag === 'skyfall' || tag === 'slam' || tag === 'special') && this.heat >= 3) this.ignite(point, dir);
      else { this.heat = Math.min(10, this.heat + (big ? 2 : 1)); this.updateHeatHud(); }
    }
    if (id === 'water' && p.alive) {
      const h = Math.min(6, res.dmg * 0.12);
      if (h > 0.2) { p.hp = Math.min(p.maxHp, p.hp + h); if (big) Sfx.P('sfx_heal', 0.4); if (big) FX.popup(p.chest().add(new V3(0, 0.8, 0)), '+' + Math.round(h), 'tag small heal', Render.camera); }
      FX.burst(point, 8, { speed: 6, life: 0.4, s0: 0.25, c0: C.white, c1: C.windDeep, grav: 10 });
    }
    if (id === 'earth' && tag === 'finisher') this.spikeAt(G.boss.pos.clone(), 1, dir);
  },
  // ---- per-frame
  update(dt) {
    const b = G.boss;
    if (Hero.id === 'fire' && this.heat > 0 && b.alive) {
      this.burnT -= dt;
      if (Math.random() < dt * this.heat * 3) { const c = b.chest(_kv); FX.add_.spawn(c.x + rand(-1, 1), c.y + rand(-1.2, 1), c.z + rand(-1, 1), rand(-0.5, 0.5), rand(2, 4), rand(-0.5, 0.5), 0.5, 0.3, 0.05, C.wind, C.windDeep, 1, 0, 1); }
      if (this.burnT <= 0) {
        this.burnT = 0.6;
        const res = b.takeDamage(Math.max(1, Math.round(this.heat * 0.7)), 0, b.chest(new V3()), new V3(0, 1, 0), { noFlinch: true, src: 'burn' });
        if (res) { FX.dmgNumber(b.chest(new V3()).add(new V3(rand(-0.6, 0.6), 1, 0)), res.dmg, 'burn'); Sfx.P('sfx_burn_tick', 0.35 + this.heat * 0.03); }
      }
      // heat slowly cools if you stop attacking
      this.cool = (this.cool || 0) + dt; if (this.cool > 3.5) { this.cool = 2.5; this.heat = Math.max(0, this.heat - 1); this.updateHeatHud(); }
    }
  },
  updateHeatHud() {
    const el = $('heat'); if (!el) return;
    el.classList.toggle('show', Hero.id === 'fire' && this.heat > 0);
    el.innerHTML = 'HEAT ' + '<i></i>'.repeat(this.heat) + '<s></s>'.repeat(10 - this.heat);
    this.cool = 0;
  },
  ignite(point, dir) {
    const n = this.heat; this.heat = 0; this.updateHeatHud();
    Sfx.P('sfx_ignite', 0.7 + n * 0.04);
    const b = G.boss, c = b.chest(new V3());
    const res = b.takeDamage(n * 6, n * 3, c, dir.clone(), { big: true, knock: 6 + n * 0.6, src: 'ignite' });
    FX.burst(c, 40 + n * 6, { speed: 16, life: 0.6, s0: 0.5, c0: C.white, c1: C.wind });
    FX.burst(c, 20, { speed: 6, life: 0.9, s0: 0.8, s1: 2, c0: C.windDeep, c1: C.windFade, add: false, alpha: 0.5 });
    FX.shockwave(c, 0.8, 1.8, 0.6); FX.groundRing(b.pos.clone().setY(0.05), 5 + n * 0.4, HC.aura, 0.5);
    Sfx.boom(0.9); if (Sfx.has && Sfx.has('sfx_fire_impact')) Sfx.play('sfx_fire_impact', { rate: 0.8 });
    if (res) FX.dmgNumber(c.clone().add(new V3(0, 1.2, 0)), res.dmg, 'gold', 'IGNITE');
    if (n >= 8) Moment.fire('SUPERNOVA', 'MAX HEAT IGNITION', c, dir, 2);
    else if (n >= 5) Moment.fire('IGNITION', n + ' HEAT DETONATED', null, null, 1);
  },
  // ---- earth: armor during heavy commitments
  armored(p) {
    if (Hero.id !== 'earth') return false;
    const S = p.state;
    return (S === 'attack' && p.move && (p.move.big || p.move.finisher || p.move.armor)) || (S === 'dash' && p.dashKind === 'charge') || S === 'charge' || S === 'release' || S === 'slam' || S === 'slamLand';
  },
  // ---- earth: stone spikes erupt (ring or single)
  spikeAt(at, n = 1, dir) {
    const b = G.boss;
    const pts = [];
    if (n === 1) pts.push(at.clone().setY(0));
    else for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(new V3(at.x + Math.cos(a) * 3.2, 0, at.z + Math.sin(a) * 3.2)); }
    for (const q of pts) {
      const h = n === 1 ? 4.2 : rand(2.6, 3.8), m = spikeMesh(h, n === 1 ? 0.9 : 0.6);
      m.position.copy(q); m.rotation.set(rand(-0.25, 0.25), rand(0, TAU), rand(-0.25, 0.25));
      FX.add(m, 1.4, (e, k) => { const s = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1; m.scale.set(1, Math.max(0.01, s), 1); });
      FX.burst(q.clone().setY(0.3), 14, { speed: 7, flat: true, life: 0.6, s0: 0.6, s1: 1.4, c0: C.dust, c1: C.dust, add: false, alpha: 0.5 });
    }
    FX.shake(0.5); Sfx.boom(0.7); Sfx.P('sfx_stone_spike', 1) || Sfx.P('sfx_pillar_crack', 1);
    if (b.alive && horizDist(at, b.pos) < (n === 1 ? 2.5 : 4.5) + b.radius) {
      const c = b.chest(new V3());
      const res = b.takeDamage(n === 1 ? 16 : 22, 14, c, new V3(0, 1, 0), { big: true, knock: 4, src: 'spike' });
      if (res) { FX.dmgNumber(c, res.dmg, 'big', 'STONE SPIKE'); FX.hitSpark(c, new V3(0, 1, 0), true, false, 'earth'); }
    }
  },
  // ---- water: perfect dodge restores health
  onFlowStep(p) {
    if (Hero.id !== 'water') return;
    p.hp = Math.min(p.maxHp, p.hp + 8); Sfx.P('sfx_heal', 0.8);
    FX.groundRing(p.pos.clone().setY(0.05), 4, HC.aura, 0.5); FX.groundRing(p.pos.clone().setY(0.05), 2.5, 0xffffff, 0.35, 0.6);
    FX.popup(p.chest().add(new V3(0, 1.3, 0)), '+8', 'tag small heal', Render.camera);
  },
  // ---- ultimate flavour on the final impact
  ultImpact(b, hp) {
    const id = Hero.id;
    if (id === 'fire') { this.heat = 10; this.ignite(hp, new V3(0, -1, 0)); for (let i = 0; i < 4; i++) setTimeout(() => FX.groundRing(b.pos.clone().setY(0.05), 6 + i * 3, HC.aura, 0.5), i * 90); }
    if (id === 'earth') this.spikeAt(b.pos.clone(), 9);
    if (id === 'water') { const p = G.player; p.hp = Math.min(p.maxHp, p.hp + 20); for (let i = 0; i < 5; i++) setTimeout(() => FX.groundRing(b.pos.clone().setY(0.05), 5 + i * 3.5, i % 2 ? 0xffffff : HC.aura, 0.55, 0.9), i * 110); FX.burst(hp, 60, { speed: 14, life: 1.0, s0: 0.5, c0: C.white, c1: C.windDeep, grav: 14 }); }
  },
};
