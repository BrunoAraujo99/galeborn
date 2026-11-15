'use strict';
/* ============================================================
   Spectacle pass: game pace, laggy chase camera support, speed-line
   overlay, Blitz Exchange (flash-step brawl after a clash) and
   duel clashes.
   ============================================================ */
G.pace = 1.15; // everything in a fight runs a notch faster than real time

/* ---------------- screen speed lines: show when the camera is being outrun ---------------- */
const SpeedLines = {
  el: null, amt: 0, flick: 0, boost: 0,
  init() { this.el = document.getElementById('speedLines'); },
  kick(v) { this.boost = Math.max(this.boost, v); },
  update(raw) {
    if (!this.el) return;
    const p = G.player, fight = G.state === 'fight' || G.state === 'ending';
    const spd = Math.hypot(p.vel.x, p.vel.z);
    let want = 0;
    if (fight && !Cam.cine) want = clamp((Cam.lagAmt || 0) / 1.2, 0, 1) * 0.55 + clamp((spd - 13) / 14, 0, 1) * 0.45;
    if (Blitz.active) want = 0.9;
    this.boost = Math.max(0, this.boost - raw * 2.5);
    want = Math.max(want, this.boost);
    if (Settings && Settings.v && Settings.v.lines === false) want = 0;
    this.amt = damp(this.amt, want, want > this.amt ? 18 : 6, raw);
    this.flick -= raw;
    if (this.flick <= 0) { this.flick = 1 / 24; this.el.style.transform = `rotate(${rand(0, 360)}deg) scale(${1 + rand(0, 0.06)})`; }
    const o = this.amt < 0.03 ? 0 : this.amt;
    if (Math.abs((this.lastO || 0) - o) > 0.01) { this.el.style.opacity = o.toFixed(2); this.el.style.display = o > 0 ? '' : 'none'; this.lastO = o; }
  },
};

/* thin glowing streak between two points (flash-step trails) */
function streak(a, b, color, life = 0.3, w = 0.07) {
  const d = b.clone().sub(a), len = d.length();
  if (len < 0.01) return;
  const grp = new THREE.Group();
  const mk = (r, op) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); grp.add(m); return m; };
  const core = mk(w, 1), glow = mk(w * 3.5, 0.35);
  core.material.color.lerp(new THREE.Color(0xffffff), 0.6);
  grp.position.copy(a).addScaledVector(d, 0.5);
  grp.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  FX.add(grp, life, (e, k) => {
    const s = 1 - k; core.material.opacity = s; glow.material.opacity = 0.35 * s;
    grp.scale.set(1 - k * 0.8, 1, 1 - k * 0.8);
    if (k >= 1) for (const m of [core, glow]) { m.geometry.dispose(); m.material.dispose(); }
  });
}

/* ---------------- Blitz Exchange ----------------
   After a clash, sometimes both fighters vanish and trade blows at
   flash-step speed across the sky above the arena. The hero wins the
   exchange and slams Varukh back down. */
const Blitz = {
  active: false, pending: 0, lastT: -99, at: null,
  maybe(at) {
    if (this.active || this.pending > 0 || G.mode === 'duel' || G.state !== 'fight') return;
    const b = G.boss;
    if (!b.alive || b.hp < b.maxHp * 0.04 || G.time - this.lastT < 16) return;
    if (Math.random() > (b.phase === 2 ? 0.75 : 0.5)) return;
    this.pending = 0.42; this.at = at.clone();
  },
  tick(raw) {
    if (this.pending > 0) { this.pending -= raw; if (this.pending <= 0 && G.state === 'fight' && G.player.alive && G.boss.alive) this.start(); }
  },
  start() {
    const p = G.player, b = G.boss;
    this.active = true; this.t = 0; this.k = -1; this.lastT = G.time;
    const c = p.pos.clone().lerp(b.pos, 0.5).setY(0);
    const cr = Math.hypot(c.x, c.z), CR = ARENA_R - 9; if (cr > CR) { c.x *= CR / cr; c.z *= CR / cr; }
    this.c = c;
    const pts = []; let ang = rand(0, TAU);
    for (let i = 0; i < 6; i++) { ang += rand(1.7, 2.7); const r = rand(2.5, 6.5); pts.push(new V3(c.x + Math.sin(ang) * r, rand(2.2, 7), c.z + Math.cos(ang) * r)); }
    pts.push(new V3(c.x, 2.0, c.z));
    this.pts = pts;
    this.bCh = b.chest(new V3()).y - b.pos.y;
    b.cancelAttack(); b.state = 'idle'; b.knock.set(0, 0, 0);
    for (const q of G.proj) if (q.owner === 'boss' && !q.dead) q.explode(true);
    p.toMove(); p.invuln = 99; p.vel.set(0, 0, 0);
    for (const k in p.trails) p.trails[k].emit = false;
    G.tsTarget = 1; G.slowT = 0; G.timeScale = 1;
    FX.speedBg(2.3, false); SpeedLines.kick(1);
    FX.ghost(p.rig, 0xffffff); FX.ghost(b.rig, 0xff7a2a);
    HUD.banner('BLITZ', 'flow');
    Sfx.P('sfx_pursuit_blink', 1) || Sfx.bigWhoosh();
    this.view = c.clone().setY(3.5);
    let orbit = Math.atan2(Cam.pos.x - c.x, Cam.pos.z - c.z);
    Cam.cine = (dt, cam) => {
      orbit += dt * 0.55;
      const tgt = this.k >= 0 ? this.pts[Math.min(this.k, this.pts.length - 1)] : this.view;
      this.view.lerp(tgt, 1 - Math.exp(-7 * dt));
      cam.position.set(c.x + Math.sin(orbit) * 15, 5.5 + Math.sin(this.t * 2) * 1.2, c.z + Math.cos(orbit) * 15);
      cam.lookAt(this.view);
    };
  },
  exchange(k) {
    const p = G.player, b = G.boss, P = this.pts[k], last = k === this.pts.length - 1;
    const a = rand(0, TAU), d = new V3(Math.sin(a), 0, Math.cos(a));
    // leave afterimages and streak to the next clash point
    const pc0 = p.chest(), bc0 = b.chest();
    FX.ghost(p.rig, HC.main); FX.ghost(b.rig, 0xff7a2a);
    const pc1 = P.clone().addScaledVector(d, -0.75), bc1 = P.clone().addScaledVector(d, 0.85);
    streak(pc0, pc1, HC.main, 0.32); streak(bc0, bc1, 0xff7a2a, 0.32);
    p.pos.set(pc1.x, pc1.y - 1.2, pc1.z); p.yaw = yawOf(d.x, d.z); p.grounded = false;
    b.pos.set(bc1.x, bc1.y - this.bCh, bc1.z); b.yaw = yawOf(-d.x, -d.z);
    p.blitzClip = k % 2 ? ['kick', 0.42] : ['punch', 0.3 + (k % 3) * 0.2];
    p.rig.setPose(HERO_POSES[k % 2 ? 'L4' : 'L2'], 60);
    b.pose(['punchA', 'punchB', 'upper'][k % 3], 60);
    // the clash itself
    const big = last || k === 3;
    FX.star(P, big ? 6 : 4, 0xffffff, 0.22); FX.shockwave(P, 0.5, big ? 2 : 1.3, 0.4); FX.impactLines(P, big ? 26 : 16, 0xffffff, big ? 6 : 4, 0.25);
    FX.burst(P, 26, { speed: 16, life: 0.4, s0: 0.3, c0: C.white, c1: C.wind }); FX.burst(P, 22, { speed: 14, life: 0.4, s0: 0.3, c0: C.fireHot, c1: C.ember });
    FX.ringBill(P, big ? 5 : 3, HC.main, 0.25); FX.sfxWord(P, big);
    Sfx.clash(); FX.shake(big ? 0.8 : 0.45); Render.post.flash = big ? 0.45 : 0.22; Render.post.aberr = 1.3;
    if (big) { Render.post.impact = 1; hitstop(0.08); }
    const dmg = last ? 30 : 7;
    b.hp = Math.max(1, b.hp - dmg); b.posture = Math.min(b.maxPosture - 1, b.posture + (last ? 20 : 5)); b.postureDelay = 2;
    FX.dmgNumber(P, dmg, last ? 'crit' : 'hit');
    G.stats.dmgDealt = (G.stats.dmgDealt || 0) + dmg;
    if (k === 0) HUD.say(Hero.def.name, pick(['Keep up!', 'Too slow!', 'Over here!']), 1.4);
  },
  update(raw) {
    const p = G.player, b = G.boss;
    this.t += raw;
    const step = 0.24, k = Math.floor((this.t - 0.1) / step);
    if (k >= 0 && k !== this.k && k < this.pts.length) { this.k = k; this.exchange(k); }
    p.visuals(raw); b.rig.update(raw); b.sync();
    if (this.t > 0.1 + step * this.pts.length + 0.25) this.end();
  },
  end() {
    const p = G.player, b = G.boss, P = this.pts[this.pts.length - 1];
    this.active = false; p.blitzClip = null; p.invuln = 0.6;
    // Varukh is driven into the ground
    b.pos.set(P.x, 0, P.z);
    World.crater(b.pos.clone(), 7); World.damageAt(b.pos.clone(), 3, 120);
    FX.shockwave(b.pos.clone().setY(0.4), 0.8, 2.2, 0.6); FX.groundRing(b.pos.clone().setY(0.05), 8, HC.aura, 0.6);
    Sfx.boom(1.2); FX.shake(0.9);
    b.state = 'flinch'; b.st = -0.7;
    const away = p.pos.clone().sub(b.pos).setY(0); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
    p.pos.set(b.pos.x + away.x * 3, 2.4, b.pos.z + away.z * 3); p.vel.set(away.x * 5, 7, away.z * 5); p.grounded = false; p.toMove();
    p.gainFlow(25); p.faceBoss(true);
    Cam.cine = null; Cam.snapBehind();
    Moment.fire('BLITZ EXCHANGE', 'SEVEN STRIKES IN A HEARTBEAT', b.chest(), away.clone().negate(), 2);
    G.stats.blitz = (G.stats.blitz || 0) + 1;
  },
  reset() { if (this.active) { this.active = false; Cam.cine = null; G.player.blitzClip = null; } this.pending = 0; this.lastT = -99; },
};

/* ---------------- duel clash: both strikes land in the same instant ---------------- */
function duelClash(at, f) {
  const p = G.player;
  Sfx.clash(); hitstop(0.1); FX.shake(0.7);
  Render.post.flash = 0.35; Render.post.aberr = 1.5;
  FX.star(at, 5, 0xfff0c0, 0.25); FX.impactLines(at, 22, 0xfff0d0, 5, 0.3); FX.shockwave(at, 0.6, 1.5);
  FX.burst(at, 36, { speed: 18, life: 0.5, s0: 0.35, c0: C.white, c1: C.wind });
  if (Opp.def) { const c = new THREE.Color(Opp.def.pal.main); FX.burst(at, 30, { speed: 18, life: 0.5, s0: 0.35, c0: C.white, c1: c }); }
  FX.popup(at.clone().add(new V3(0, 0.8, 0)), 'CLASH!', 'break', Render.camera);
  p.toMove(); p.vel.x = -f.x * 11; p.vel.z = -f.z * 11; p.invuln = Math.max(p.invuln, 0.25);
  p.gainFlow(10); SpeedLines.kick(0.8);
  G.stats.clashes = (G.stats.clashes || 0) + 1;
}
