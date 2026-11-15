'use strict';
/* ============================================================
   Emergent "highlight" moments: situations that arise from normal
   play get recognized and given the full anime treatment.
     PURSUIT     dash right after launching him: blink ahead of his flight and strike back (chains x3)
     PILLAR VAULT  jump or dash into a pillar mid-air: kick off it toward him; next air strike = SKYFALL
     GRAZE       a fireball skims past you: time hiccups, Flow surges
     RETURN TO SENDER  a deflected fireball connects
     INTERRUPT   a heavy blow lands while he winds up: attack shattered
     TOPPLE      your wind brings a pillar down on top of him
     SKY STEP    a perfect dodge while airborne
   ============================================================ */
const Moment = {
  last: {}, gap: 0,
  // level 1: name slam + brief slow-mo; level 2: + impact frame, orbit camera, speed lines
  fire(name, sub, point, dir, level = 1) {
    const now = G.time;
    if (now - (this.last[name] || -99) < (level > 1 ? 0.8 : 1.5) || now < this.gap) return false;
    this.last[name] = now; this.gap = now + 0.5;
    if (G.stats) G.stats.moments = (G.stats.moments || 0) + 1;
    const el = $('moment');
    el.innerHTML = `<div class="mn">${name}</div>${sub ? `<div class="ms">${sub}</div>` : ''}`;
    el.className = ''; void el.offsetWidth; el.className = 'show lv' + level;
    clearTimeout(this.hideT); this.hideT = setTimeout(() => el.className = '', level > 1 ? 1500 : 1100);
    if (!Sfx.P(level > 1 ? 'sfx_moment_lv2' : 'sfx_moment_lv1', 0.9)) { Sfx.ting(level > 1 ? 1800 : 2600); Sfx.whoosh(1.8, 0.35); }
    const shout = { 'PURSUIT': 'pursuit', 'PURSUIT ×2': 'pursuit', 'TEMPEST CHASE ×3': 'chase3', 'SKYFALL': 'skyfall', 'PILLAR VAULT': 'vault', 'RETURN TO SENDER': 'return', 'INTERRUPT': 'interrupt', 'TOPPLE': 'topple' }[name];
    if (shout) Sfx.hv(shout, 1, 0);
    if (level > 1) Sfx.P('sfx_slowmo_in', 0.6);
    if (level > 1) {
      slowmo(0.18, 0.6);
      Render.post.impact = 1; Render.post.aberr = 1.6;
      FX.speedBg(0.7);
      if (point) {
        const d = (dir || new V3(0, 0, 1)).clone().setY(0); if (d.lengthSq() < 0.01) d.set(0, 0, 1); d.normalize();
        Cam.impactShot(point.clone(), d, 0.85, 4.8);
      }
    } else slowmo(0.35, 0.3);
    return true;
  },
};

/* ---------------- Pursuit: blink ahead of the launched boss and hit him back ---------------- */
const Pursuit = {
  // called by the player when a launching hit lands
  arm(p, tag) {
    if (['finisher', 'counter', 'rush', 'pursuit', 'splat', 'skyfall'].includes(tag)) { p.pursuitT = 0.7; }
  },
  can(p) { return p.pursuitT > 0 && G.boss.alive && G.boss.state !== 'transition' && (p.pursuitN || 0) < 3 && ['move', 'attack', 'dash', 'rush'].includes(p.state); },
  start(p) {
    const b = G.boss;
    p.pursuitT = 0; p.pursuitN = (p.pursuitN || 0) + 1;
    const fly = b.knock.length() > 0.6 ? b.knock.clone().setY(0).normalize() : b.pos.clone().sub(p.pos).setY(0).normalize();
    FX.ghost(p.rig, 0xffffff);
    FX.burst(p.chest(), 20, { speed: 10, life: 0.3, s0: 0.3, c0: C.white, c1: C.wind });
    // appear ahead of his flight path, facing back at him
    const ahead = b.pos.clone().addScaledVector(fly, b.radius + 2.2 + b.knock.length() * 0.08);
    ahead.x = clamp(ahead.x, -ARENA_R + 1, ARENA_R - 1); ahead.z = clamp(ahead.z, -ARENA_R + 1, ARENA_R - 1);
    p.pos.set(ahead.x, Math.max(0, b.pos.y + 0.2), ahead.z);
    p.vel.set(0, 0, 0);
    p.yaw = yawOf(-fly.x, -fly.z);
    p.state = 'pursuit'; p.st = 0; p.pursuitHit = false; p.pursuitDir = fly.clone().negate();
    p.invuln = Math.max(p.invuln, 0.4);
    if (!Sfx.P('sfx_pursuit_blink', 1)) { Sfx.whoosh(2.2, 0.5); Sfx.bigWhoosh(); }
    FX.ringBill(p.chest(), 3, HC.pale, 0.2);
    G.stats.pursuits = (G.stats.pursuits || 0) + 1;
  },
  update(p, dt) {
    const b = G.boss;
    p.rig.setPose(p.st < 0.08 ? HERO_POSES.L4w : HERO_POSES.L4, p.st < 0.08 ? 40 : 34);
    p.vel.x = 0; p.vel.z = 0; if (!p.grounded) p.vel.y = Math.max(p.vel.y, -2);
    p.rig.smear = 1.3; p.rig.smearLimb = 'F';
    if (!p.pursuitHit && p.st > 0.08) {
      p.pursuitHit = true;
      const dir = p.pursuitDir, c = b.chest(new V3());
      const n = p.pursuitN;
      FX.windBlade(c.clone().addScaledVector(dir, -0.4), yawOf(dir.x, dir.z), n % 2 ? 0.6 : -0.6, 3, 0xffffff, true, n % 2 === 0, 4);
      const res = b.takeDamage(16 + n * 6, 10 + n * 4, c, dir.clone(), { big: true, knock: n >= 3 ? 18 : 12, src: 'pursuit' });
      if (res) {
        p.onDealtHit(res, c, dir, true, 0.1, n >= 3 ? 'finisher' : 'pursuit');
        const names = ['PURSUIT', 'PURSUIT ×2', 'TEMPEST CHASE ×3'];
        Moment.fire(names[n - 1], n >= 3 ? 'THE WIND NEVER LETS GO' : 'BLINK STRIKE', c, dir, n >= 2 ? 2 : 1);
        if (n >= 3) { World.crater(b.pos.clone(), 4); FX.shake(0.8); p.pursuitT = 0; }
      }
    }
    if (p.st > 0.3) { p.toMove(); if (!p.grounded) p.vel.y = 5; }
  },
};

/* ---------------- Pillar vault: kick off a pillar mid-air ---------------- */
const Vault = {
  // returns true if a vault started
  check(p, P, force) {
    if (!P || p.grounded || p.pos.y < 0.4 || (p.vaultCd || 0) > 0) return false;
    if (!force && p.buf !== 'jump') return false;
    p.buf = null;
    const b = G.boss;
    const away = new V3(p.pos.x - P.x, 0, p.pos.z - P.z).normalize();
    let dir = away;
    if (b.alive) { const tb = b.pos.clone().sub(p.pos).setY(0).normalize(); dir = away.clone().lerp(tb, 0.75).normalize(); }
    p.vel.set(dir.x * 17, 10.5, dir.z * 17);
    p.yaw = yawOf(dir.x, dir.z);
    p.jumps = 1; p.airDashes = 0; p.airHits = 0;
    p.state = 'move'; p.st = 0; p.vaultT = 1.0; p.vaultCd = 0.5;
    p.invuln = Math.max(p.invuln, 0.25);
    const hit = new V3(P.x, p.pos.y, P.z).addScaledVector(away, P.r);
    FX.burst(hit, 22, { speed: 9, life: 0.4, s0: 0.35, c0: C.white, c1: C.wind });
    FX.burst(hit, 8, { speed: 3, life: 0.8, s0: 0.6, s1: 1.4, c0: C.dust, c1: C.dust, add: false, alpha: 0.4 });
    FX.ringBill(hit, 2.6, HC.pale, 0.25);
    FX.ghost(p.rig, HC.main);
    World.hitPillar(P, 12, away.clone().negate(), hit);
    if (!Sfx.P('sfx_vault_kick', 1)) { Sfx.jump(); Sfx.whoosh(1.4, 0.5); } FX.shake(0.25);
    Moment.fire('PILLAR VAULT', 'STRIKE BEFORE YOU LAND', null, null, 1);
    return true;
  },
};

/* ---------------- Graze: fireballs that barely miss ---------------- */
const Graze = {
  check(proj, p) {
    if (proj.grazed || proj.dodged || proj.owner !== 'boss' || !p.alive || p.invuln > 0 || p.state === 'special') return;
    const d = proj.pos.distanceTo(p.chest(_gv));
    if (d < proj.r + 1.15) proj.nearT = (proj.nearT || 0) + 1;
    else if (proj.nearT) {
      // it was close and has now passed without hitting
      proj.grazed = true;
      if ((G.time - (this.lastT || -9)) < 1.2) return;
      this.lastT = G.time;
      p.gainFlow(7);
      FX.ghost(p.rig, 0xffffff);
      FX.impactLines(p.chest(), 10, 0xffffff, 3, 0.18);
      FX.popup(p.chest().add(new V3(0, 0.9, 0)), 'GRAZE', 'tag small', Render.camera);
      if (!Sfx.P('sfx_graze', 0.9)) Sfx.glint();
      slowmo(0.4, 0.22);
      G.stats.grazes = (G.stats.grazes || 0) + 1;
      if (G.stats.grazes % 4 === 0) Moment.fire('RAZOR\'S EDGE', 'FOUR GRAZES', null, null, 1);
    }
  },
};
const _gv = new V3();
