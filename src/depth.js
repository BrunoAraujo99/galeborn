'use strict';
/* ============================================================
   Stage 3 depth: element matchups, burst escape, projectile clashes,
   directional launchers.
   ============================================================ */
// water quenches fire, fire eats wind, wind erodes earth, earth dams water
const ELEM_BEATS = { water: 'fire', fire: 'wind', wind: 'earth', earth: 'water' };
const ELEM_BONUS = 1.12;
const elemMult = (att, def) => (ELEM_BEATS[att] === def ? ELEM_BONUS : 1);
const PROJ_ELEM = { fireball: 'fire', firebolt: 'fire', gust: 'wind', lance: 'wind', boulder: 'earth', jet: 'water' };
const PROJ_POW = { fireball: 1, firebolt: 1, gust: 1, lance: 2, boulder: 2, jet: 2 };

/* back + strike: a rising launcher for every hero */
const LAUNCHERS = {
  wind: { w: 'upperW', s: 'upperF', dur: 0.5, a0: 0.11, a1: 0.2, dmg: 11, post: 8, reach: 1.3, r: 1.45, lunge: 6, cancel: 0.28, big: true, knock: 13, launcher: true, slash: { tilt: 1.5, y: 1.2 }, trail: 'R', pitch: 0.85, gust: false },
  fire: { w: 'upperW', s: 'upperF', dur: 0.5, a0: 0.1, a1: 0.19, dmg: 11, post: 8, reach: 1.3, r: 1.45, lunge: 7, cancel: 0.28, big: true, knock: 13, launcher: true, slash: { tilt: 1.5, y: 1.2 }, trail: 'R', pitch: 0.85, elem: 'pillar' },
  earth: { w: 'axeW', s: 'upperF', dur: 0.56, a0: 0.15, a1: 0.24, dmg: 13, post: 10, reach: 1.4, r: 1.5, lunge: 5, cancel: 0.32, big: true, armor: true, knock: 13, launcher: true, trail: 'B', pitch: 0.7, elem: 'rock' },
  water: { w: 'whipW', s: 'upperF', dur: 0.5, a0: 0.11, a1: 0.2, dmg: 10, post: 8, reach: 2.0, r: 1.4, lunge: 5, cancel: 0.28, big: true, knock: 13, launcher: true, slash: { tilt: 1.5, y: 1.2 }, trail: 'R', pitch: 0.9, elem: 'splash' },
};
const launcherFor = id => LAUNCHERS[id] || LAUNCHERS.wind;
// is the stick held away from the opponent?
function backInput(p, wish, hasWish) {
  const b = G.boss;
  if (!hasWish || !b.alive || horizDist(p.pos, b.pos) > 8) return false;
  const d = p.bossDir().normalize(), w = wish.clone().normalize();
  return d.x * w.x + d.z * w.z < -0.55;
}

/* ---------------- burst: spend a full gauge to break out of a combo ---------------- */
const Burst = {
  can(p) { return p.alive && G.state === 'fight' && (p.burst || 0) >= 100 && (p.state === 'hit' || p.state === 'launched'); },
  gain(p, n) {
    const was = p.burst || 0; p.burst = Math.min(100, was + n);
    if (was < 100 && p.burst >= 100) { Sfx.P('sfx_flow_full', 0.45) || Sfx.ting(2600); if (typeof HUD !== 'undefined' && HUD.burstReady) HUD.burstReady(); }
  },
  fire(p) {
    p.burst = 0;
    const air = !p.grounded;
    Sfx.loopOff('sfx_charge_loop');
    p.toMove(); p.invuln = 0.7; p.combo = 0;
    if (air) { p.vel.set(0, 6, 0); p.jumps = 1; p.airDashes = 0; } else p.vel.set(0, 0, 0);
    const c = p.chest();
    FX.shockwave(c, 0.6, 2.2, 0.6); FX.groundRing(p.pos.clone().setY(0.06), 7, HC.aura, 0.45); FX.ringBill(c, 6, HC.pale, 0.3);
    FX.burst(c, 60, { speed: 18, life: 0.5, s0: 0.45, c0: C.white, c1: C.wind });
    FX.impactLines(c, 22, HC.glow, 5, 0.25);
    FX.popup(c.clone().add(new V3(0, 1, 0)), 'BURST!', 'break', Render.camera);
    Render.post.flash = 0.3; Render.post.aberr = 1.4; FX.shake(0.6); hitstop(0.08); Sfx.boom(1); Sfx.bigWhoosh();
    G.stats.bursts = (G.stats.bursts || 0) + 1;
    const b = G.boss;
    if (b.alive && horizDist(p.pos, b.pos) < 5.5) {
      const dir = new V3(b.pos.x - p.pos.x, 0, b.pos.z - p.pos.z).normalize();
      if (!Duel.active && b.state === 'attack' && b.atk && !['nova', 'beam'].includes(b.atk.name)) { b.cancelAttack(); b.state = 'flinch'; b.st = -0.4; }
      b.takeDamage(4, 12, b.chest(new V3()), dir, { big: true, knock: 12, src: 'burst' });
    }
  },
};

/* ---------------- projectiles meeting in mid-air ---------------- */
const ProjClash = {
  update() {
    const L = G.proj;
    for (const a of L) {
      if (a.dead || a.owner !== 'player') continue;
      for (const b of L) {
        if (b.dead || (b.owner !== 'boss' && b.owner !== 'ghost') || b.reflected) continue;
        if (a.pos.distanceTo(b.pos) > a.r + b.r + 0.25) continue;
        const ea = PROJ_ELEM[a.kind], eb = PROJ_ELEM[b.kind], pa = PROJ_POW[a.kind] || 1, pb = PROJ_POW[b.kind] || 1;
        const w = pa > pb ? 1 : pb > pa ? -1 : ELEM_BEATS[ea] === eb ? 1 : ELEM_BEATS[eb] === ea ? -1 : 0;
        const at = a.pos.clone().lerp(b.pos, 0.5);
        FX.star(at, 3.5, 0xffffff, 0.18); FX.shockwave(at, 0.35, 1); FX.impactLines(at, 14, 0xffffff, 3, 0.18);
        FX.burst(at, 30, { speed: 12, life: 0.4, s0: 0.35, c0: C.white, c1: w < 0 ? C.ember : C.wind });
        Sfx.P('sfx_clash', 0.6) || Sfx.deflect(); hitstop(0.05); FX.shake(0.25);
        FX.popup(at.clone().add(new V3(0, 0.6, 0)), w > 0 ? 'OVERPOWER' : w < 0 ? 'OVERPOWERED' : 'CLASH', 'tag small', Render.camera);
        G.stats.clashes = (G.stats.clashes || 0) + 1;
        if (w >= 0) b.explode(); else b.dmg = Math.max(1, Math.round(b.dmg * 0.6));
        if (w <= 0) { a.explode(); break; }
        a.dmg = Math.max(1, Math.round(a.dmg * 0.6));
        G.player.gainFlow(4);
      }
    }
  },
};
