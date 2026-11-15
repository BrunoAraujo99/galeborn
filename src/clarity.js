/* ---------------- Clarity: keeps fast PvP exchanges readable ----------------
   heat = how dense the current exchange is (hits per second, decaying). When it runs hot in a duel:
   - small-hit effects (shake, impact lines, aberration, FOV kicks) are toned down so silhouettes stay visible
   - the camera pulls back and up to frame both fighters
   - hitstun on the receiving side decays through a long string, and after a long lock the victim BREAKS AWAY
     (short invulnerable hop back), so spam can't hold someone forever and every exchange has a clear end */
const Clarity = {
  heat: 0, zoom: 0,
  BREAK_HITS: 9, BREAK_TIME: 3.0,
  on() { return G.mode === 'duel' && Duel.active; },
  hit(big) { if (this.on()) this.heat = Math.min(this.heat + (big ? 1.4 : 1), 8); },
  busy() { return this.on() && this.heat > 2.2; },
  fx(x) { return this.busy() ? x * 0.4 : x; },
  update(dt) {
    this.heat = Math.max(0, this.heat - dt * 1.5);
    const t = this.on() ? clamp((this.heat - 1.2) / 3.5, 0, 1) : 0;
    this.zoom = damp(this.zoom, t, t > this.zoom ? 3 : 0.8, dt);
  },
  // defender side: track the string we're stuck in. Returns true when we should break away instead of taking the hit.
  chain(p) {
    const now = G.time;
    if (now - (p.chainT ?? -9) > 0.75) { p.chainN = 0; p.chainT0 = now; }
    p.chainN++; p.chainT = now;
    return p.chainN > this.BREAK_HITS || (p.chainN > 5 && now - p.chainT0 > this.BREAK_TIME);
  },
  stun(p, base) { return base * Math.max(0.55, 1 - 0.07 * Math.max(0, (p.chainN || 0) - 3)); },
  breakAway(p, dir) {
    p.chainN = 0; p.chainT = -9;
    p.toMove(); p.invuln = 0.55; p.grounded = true;
    p.vel.set(dir.x * 12, 3.5, dir.z * 12);
    const c = p.chest();
    FX.shockwave(c, 0.5, 1.6); FX.impactLines(c, 12, 0xffffff, 3, 0.2);
    FX.popup(c.clone().add(new V3(0, 1.2, 0)), 'BREAK AWAY', 'tag', Render.camera);
    Sfx.P('sfx_dodge', 0.8) || Sfx.whoosh(1.4, 0.3);
    this.heat = 0;
    if (Duel.active) Duel.send({ t: 'brk' });
  },
  // attacker side: the opponent slipped out of our string
  onBroke() {
    const p = G.player;
    if (p.state === 'attack') p.moveBlocked = true;
    FX.popup(Opp.chest().add(new V3(0, 1.2, 0)), 'ESCAPED', 'tag small', Render.camera);
    this.heat = 0;
  },
};
