'use strict';
/* ============================================================
   Player: Tavi, wind dancer. Movement, dodge, combos, heavy, air, special
   ============================================================ */
// per-hero light / air strings live in movesets.js (MOVESETS)
const COUNTER_MOVE = { w: 'counter', s: 'counter', dur: 0.5, a0: 0.05, a1: 0.14, dmg: 36, post: 30, reach: 1.2, r: 1.7, lunge: 0, cancel: 0.3, big: true, slash: { tilt: 0.1, y: 1.3 }, trail: 'R', pitch: 0.7, counter: true };

const GRAV = 34, RUN_SPEED = 9.5, JUMP_V = 12.2, JUMP2_V = 11.2;

class Player {
  constructor() {
    this.rig = makeHeroRig();
    Render.scene.add(this.rig.root);
    for (const c of this.rig.chains) Render.scene.add(c.ribbon.mesh);
    this.trails = { L: new Trail(14, HC.main, 0.16), R: new Trail(14, HC.main, 0.16), F: new Trail(14, HC.pale, 0.2), B: new Trail(14, HC.main, 0.16) };
    for (const k in this.trails) Render.scene.add(this.trails[k].ribbon.mesh);
    this.reset();
  }
  reset() {
    this.pos = new V3(0, 0, 9); this.vel = new V3(); this.yaw = Math.PI;
    this.maxHp = Hero.def.stats.hp; this.hp = this.maxHp; this.flow = 0;
    this.state = 'move'; this.st = 0; this.grounded = true; this.jumps = 0; this.airDashes = 0; this.airHits = 0;
    this.comboIdx = 0; this.comboT = 0; this.buf = null; this.bufT = 0;
    this.invuln = 0; this.dodgeInv = 0; this.perfectWin = 0; this.perfectUsed = false; this.counterT = 0;
    this.guard = GUARD_MAX; this.guardRegenT = 0; this.blockCd = 0; this.blockStunT = 0; this.parryUsed = false; this.blockHeld = false; this.burst = 0;
    this.move = null; this.moveHit = false; this.ghostT = 0; this.runPh = 0; this.chargeLv = 0;
    this.combo = 0; this.comboTimer = 0; this.alive = true; this.hurtFlash = 0;
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.set(0, this.yaw, 0);
    this.rig.setPose(HERO_POSES.idle); this.rig.snap(); this.rig.update(0);
    for (const c of this.rig.chains) c.inited = false;
    for (const k in this.trails) { this.trails[k].pts.length = 0; this.trails[k].emit = false; }
  }
  get ms() { return moveset(Hero.id); }
  fwd(out = new V3()) { return dirOf(this.yaw, out); }
  chest(out = new V3()) { return out.set(this.pos.x, this.pos.y + 1.2, this.pos.z); }
  wishDir(a) {
    const cy = Cam.yaw;
    const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    return new V3(rx * a.mx + fx * a.my, 0, rz * a.mx + fz * a.my);
  }
  bufferInputs(a) {
    if (!this.alive || G.state !== 'fight') return;
    const set = n => { this.buf = n; this.bufT = 0.34; };
    if (a.light) {
      set('light');
      // pressing again before the current strike even lands = mashing
      if (this.state === 'attack' && this.move && !this.move.counter && this.st < this.move.a0 - 0.02) this.mashed = true;
      this.lightAt = this.state === 'attack' ? this.st : -1;
    }
    if (a.heavy) set('heavy');
    if (a.dash) set('dash');
    if (a.jump) set('jump');
    if (a.special) set('special');
    if (a.block && !this.blockHeld) set('block');
    this.blockHeld = !!a.block;
  }
  take(n) { if (this.buf === n) { this.buf = null; return true; } return false; }
  bossDir(out = new V3()) { const b = G.boss; return out.set(b.pos.x - this.pos.x, 0, b.pos.z - this.pos.z); }
  faceBoss(force) {
    const b = G.boss; if (!b.alive) return false;
    const d = this.bossDir();
    const dist = d.length();
    if (force || G.lockOn || dist < 7) { this.yaw = yawOf(d.x, d.z); return true; }
    return false;
  }

  update(dt, a) {
    if (dt <= 0) return;
    this.st += dt;
    this.bufT -= dt; if (this.bufT <= 0) this.buf = null;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeInv = Math.max(0, this.dodgeInv - dt);
    this.perfectWin = Math.max(0, this.perfectWin - dt);
    this.comboT -= dt; if (this.comboT <= 0 && this.state !== 'attack') this.comboIdx = 0;
    if (this.counterT > 0) this.counterT -= dt / Math.max(G.timeScale, 0.2);
    this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
    this.rushCd = Math.max(0, (this.rushCd || 0) - dt);
    this.openT = Math.max(0, (this.openT || 0) - dt);
    this.vaultT = Math.max(0, (this.vaultT || 0) - dt); this.vaultCd = Math.max(0, (this.vaultCd || 0) - dt);
    if (this.pursuitT > 0) this.pursuitT -= dt; else if (this.state !== 'pursuit') this.pursuitN = 0;
    // emergent moves: pursuit after a launch, vault off a pillar in mid-air
    if (this.buf === 'dash' && Pursuit.can(this)) { this.buf = null; Pursuit.start(this); }
    if (!this.grounded && this.buf === 'jump' && (this.state === 'move' || this.state === 'attack')) { const P = World.pillarAt(this.pos, 0.85); if (P) Vault.check(this, P, false); }
    const wish = this.wishDir(a);
    const hasWish = wish.lengthSq() > 0.01;
    Guard.update(this, dt);
    if (this.buf === 'block' && Burst.can(this)) { this.buf = null; Burst.fire(this); }
    const S = this.state;

    if (S === 'move') this.updMove(dt, a, wish, hasWish);
    else if (S === 'dash') this.updDash(dt, a);
    else if (S === 'block') this.updBlock(dt, a, wish, hasWish);
    else if (S === 'parry') { this.rig.setPose(HERO_POSES.parry, 30); this.vel.x = damp(this.vel.x, 0, 12, dt); this.vel.z = damp(this.vel.z, 0, 12, dt); if (this.take('light') && this.counterT > 0 && G.boss.alive) this.startCounter(); else if (this.st > 0.34) this.toMove(); }
    else if (S === 'guardbreak') { this.rig.setPose(this.st < 0.9 ? HERO_POSES.guardBroken : HERO_POSES.idle, this.st < 0.9 ? 20 : 8); this.vel.x = damp(this.vel.x, 0, 6, dt); this.vel.z = damp(this.vel.z, 0, 6, dt); if (this.st > 1.1) { this.guard = GUARD_MAX * 0.5; this.toMove(); } }
    else if (S === 'rush') this.updRush(dt);
    else if (S === 'attack') this.updAttack(dt, a, wish);
    else if (S === 'charge') this.updCharge(dt, a);
    else if (S === 'release') this.updRelease(dt);
    else if (S === 'slam') this.updSlam(dt);
    else if (S === 'slamLand') { this.rig.setPose(HERO_POSES.slamLand, 20); this.vel.x = damp(this.vel.x, 0, 10, dt); this.vel.z = damp(this.vel.z, 0, 10, dt); if (this.st > 0.32 || (this.st > 0.18 && (this.buf === 'dash' || this.buf === 'jump'))) this.toMove(); }
    else if (S === 'hit') { this.rig.setPose(HERO_POSES.hit, 25); this.vel.x = damp(this.vel.x, 0, 6, dt); this.vel.z = damp(this.vel.z, 0, 6, dt); if (this.st > this.stunDur) this.toMove(); }
    else if (S === 'launched') this.updLaunched(dt);
    else if (S === 'down') { this.rig.setPose(HERO_POSES.down, 12); this.vel.set(0, 0, 0); if (this.st > 0.6 || (this.st > 0.25 && (this.buf === 'dash' || this.buf === 'jump'))) { this.buf = null; this.invuln = 0.6; this.toMove(); Sfx.whoosh(1.2, 0.3); } }
    else if (S === 'special') this.updSpecial(dt);
    else if (S === 'pursuit') Pursuit.update(this, dt);
    else if (S === 'beam') { this.rig.setPose(HERO_POSES.release, 20); this.vel.x = 0; this.vel.z = 0; }
    else if (S === 'dead') { this.rig.setPose(HERO_POSES.down, 8); this.vel.x = damp(this.vel.x, 0, 4, dt); this.vel.z = damp(this.vel.z, 0, 4, dt); }
    else if (S === 'victory') { this.rig.setPose(HERO_POSES.victory, 6); this.vel.set(0, Math.min(this.vel.y, 0), 0); }

    this.physics(dt);
    this.visuals(dt);
  }

  toMove() { if (this.state === 'charge') Sfx.loopOff('sfx_charge_loop'); this.state = 'move'; this.st = 0; this.move = null; for (const k in this.trails) this.trails[k].emit = false; }

  /* ---------------- free movement ---------------- */
  updMove(dt, a, wish, hasWish) {
    const g = this.grounded;
    const RS = RUN_SPEED * Hero.def.stats.speed * (this.awake ? 1.15 : 1);
    const tgtX = wish.x * RS, tgtZ = wish.z * RS;
    const acc = g ? 16 : 5;
    this.vel.x = damp(this.vel.x, tgtX, acc, dt);
    this.vel.z = damp(this.vel.z, tgtZ, acc, dt);
    if (hasWish) this.yaw = dampAngle(this.yaw, yawOf(wish.x, wish.z), g ? 16 : 8, dt);
    else if (G.lockOn && G.boss.alive && g) { const d = this.bossDir(); this.yaw = dampAngle(this.yaw, yawOf(d.x, d.z), 8, dt); }
    // actions
    if (this.buf === 'special' && this.flow >= 100) { this.buf = null; return this.startSpecial(); }
    if (this.buf === 'block' && g && this.blockCd <= 0) { this.buf = null; return this.startBlock(); }
    if (this.take('dash') && (g || this.airDashes < this.ms.airDashes)) return this.startDash(wish, hasWish);
    if (this.take('jump')) {
      if (g) { this.vel.y = JUMP_V; this.grounded = false; this.jumps = 1; Sfx.jump(); FX.burst(this.pos.clone().setY(0.1), 10, { speed: 4, flat: true, life: 0.4, s0: 0.5, s1: 1.2, c0: C.dust, c1: C.dust, add: false, alpha: 0.4 }); }
      else if (this.jumps < 2) {
        this.vel.y = JUMP2_V; this.jumps = 2; Sfx.whoosh(1.6, 0.4);
        FX.groundRing(this.pos.clone().setY(this.pos.y - 0.06), 2.2, HC.pale, 0.3, 0.7);
        FX.burst(this.pos.clone(), 16, { speed: 7, dir: new V3(0, -1, 0), spread: 1.2, flat: false, life: 0.35, s0: 0.3, c0: C.white, c1: C.wind });
        if (hasWish) { this.vel.x = wish.x * RUN_SPEED * 1.05; this.vel.z = wish.z * RUN_SPEED * 1.05; }
      }
    }
    if (this.take('light')) {
      if (this.counterT > 0 && G.boss.alive) return this.startCounter();
      if (g && backInput(this, wish, hasWish)) return this.startAttack(launcherFor(Hero.id), false, wish, hasWish);
      if (g) { if (this.comboT <= 0) this.comboIdx = 0; return this.startAttack(this.ms.light[this.comboIdx % this.ms.light.length], false, wish, hasWish); }
      if (this.airHits < this.ms.air.length) return this.startAttack(this.ms.air[this.airHits], true, wish, hasWish);
    }
    if (this.take('heavy')) {
      if (g) { this.state = 'charge'; this.st = 0; this.chargeLv = 0; Sfx.whoosh(0.6, 0.25); Sfx.loopOn('sfx_charge_loop', 0.5); return; }
      return this.startSlam(wish, hasWish);
    }
    // pose
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (g) {
      if (sp > 1.2) {
        this.runPh += sp * dt * 1.15;
        const s = Math.sin(this.runPh), c = Math.cos(this.runPh), k = clamp(sp / RUN_SPEED, 0, 1);
        this.rig.locoSp = sp;
        this.rig.setPose({
          hipsY: -0.06 + Math.abs(c) * 0.07 * k, torso: [0.15 + 0.4 * k, -s * 0.18, 0], head: [-0.1 - 0.3 * k, s * 0.12, 0],
          hipL: [-s * 1.05 * k - 0.15, 0, 0.04], knL: [Math.max(0, c) * 1.5 * k + 0.25, 0, 0],
          hipR: [s * 1.05 * k - 0.15, 0, -0.04], knR: [Math.max(0, -c) * 1.5 * k + 0.25, 0, 0],
          shL: [lerp(s * 0.8, 1.05, k * k), 0, 0.3], elL: [lerp(-1.2, -0.25, k * k), 0, 0],
          shR: [lerp(-s * 0.8, 1.05, k * k), 0, -0.3], elR: [lerp(-1.2, -0.25, k * k), 0, 0],
        }, 18);
        if (k > 0.8 && Math.random() < dt * 14) FX.norm.spawn(this.pos.x + rand(-0.2, 0.2), 0.1, this.pos.z + rand(-0.2, 0.2), -this.vel.x * 0.1, rand(0.3, 1), -this.vel.z * 0.1, 0.5, 0.35, 0.9, C.dust, C.dust, 2, 0, 0.35);
      } else {
        const br = Math.sin(G.time * 2.4) * 0.03;
        const p = Object.assign({}, HERO_POSES.idle); p.torso = [0.08 + br, -0.15, 0]; p.hipsY = -0.07 - br * 0.5;
        this.rig.setPose(p, 10);
      }
    } else {
      this.rig.setPose(this.vel.y > 2 ? (this.jumps >= 2 ? HERO_POSES.flip : HERO_POSES.jump) : HERO_POSES.fall, this.jumps >= 2 && this.vel.y > 2 ? 18 : 9);
      if (this.jumps >= 2 && this.vel.y > 0) this.rig.addHips[0] = -(1 - this.vel.y / JUMP2_V) * TAU;
    }
  }

  /* ---------------- dash / dodge ---------------- */
  startDash(wish, hasWish) {
    let dir;
    this.backstep = false;
    if (hasWish) dir = wish.clone().normalize();
    else { dir = this.fwd().negate(); this.backstep = true; }
    this.dashDir = dir; this.state = 'dash'; this.st = 0;
    const dk = this.ms.dash;
    this.dashKind = this.backstep ? 'back' : (dk === 'charge' && !this.grounded) ? 'sky' : dk; this.dashHit = false; this.dropT = 0;
    Sfx.P(this.grounded ? 'sfx_dash' : 'sfx_air_dash', 0.8);
    this.dodgeInv = this.dashKind === 'glide' ? 0.34 : this.dashKind === 'charge' ? 0.12 : 0.26; this.perfectWin = this.dashKind === 'charge' ? 0.1 : 0.2; this.perfectUsed = false;
    if (this.dashKind === 'charge') { Sfx.el('swing_heavy', 0.7); FX.shake(0.2); World.spawnDebris && World.spawnDebris(this.pos.clone(), 3, 0.5, 'floor'); }
    if (!this.grounded) { this.airDashes++; this.vel.y = 0; }
    if (!this.backstep) this.yaw = yawOf(dir.x, dir.z);
    Sfx.whoosh(1.5, 0.5);
    FX.fovKick += 7; Render.post.speed = Math.max(Render.post.speed, 0.6);
    FX.burst(this.pos.clone().setY(this.pos.y + 0.9), 18, { speed: 8, dir: dir.clone().negate(), spread: 0.7, life: 0.3, s0: 0.3, c0: C.white, c1: C.wind });
    if (this.grounded) FX.groundRing(this.pos, 2, HC.pale, 0.25);
  }
  updDash(dt, a) {
    const dk = this.dashKind;
    const D = dk === 'glide' ? 0.42 : dk === 'charge' ? 0.36 : 0.3, k = this.st / D;
    const sp = (dk === 'glide' ? lerp(27, 9, k * k) : dk === 'charge' ? lerp(24, 10, k * k * k) : lerp(30, 7, k * k)) * (this.backstep ? 0.75 : 1);
    if (dk === 'flame' && this.grounded) { this.dropT -= dt; if (this.dropT <= 0) { this.dropT = 0.055; FlameTrail.drop(this.pos); } }
    if (dk === 'glide' && Math.random() < dt * 30) FX.burst(this.pos.clone().setY(0.15), 2, { speed: 4, dir: this.dashDir.clone().negate(), spread: 1, life: 0.35, s0: 0.3, c0: C.white, c1: C.windDeep, grav: 10 });
    if (dk === 'charge' && !this.dashHit && G.boss.alive && horizDist(this.pos, G.boss.pos) < G.boss.radius + 1.3 && Math.abs(G.boss.pos.y - this.pos.y) < 1.8) {
      this.dashHit = true;
      const b = G.boss, hp = b.chest(new V3());
      const res = b.takeDamage(12, 12, hp, this.dashDir.clone(), { big: true, src: 'melee', knock: 7 });
      if (res) { this.onDealtHit(res, hp, this.dashDir, true, 0.08, ''); FX.popup(hp.clone().add(new V3(0, 0.9, 0)), 'STONE RUSH', 'tag small', Render.camera); }
      this.st = Math.max(this.st, D * 0.75);
    }
    this.vel.x = this.dashDir.x * sp; this.vel.z = this.dashDir.z * sp;
    if (!this.grounded) this.vel.y = Math.max(this.vel.y, -1);
    this.rig.setPose(this.backstep ? HERO_POSES.backstep : HERO_POSES.dash, 30);
    this.ghostT -= dt;
    if (this.ghostT <= 0 && this.st < 0.24) { this.ghostT = 0.035; FX.ghost(this.rig, this.perfectUsed ? 0xffffff : HC.mid); }
    if (this.st > 0.05 && this.buf === 'light' && !this.backstep && (this.rushCd || 0) <= 0 && this.counterT <= 0) { this.buf = null; return this.startRush(); }
    if (this.st > 0.16) {
      if (this.buf === 'light' || this.buf === 'heavy' || this.buf === 'jump') return this.toMove();
    }
    if (this.st >= D) this.toMove();
  }

  /* ---------------- block / parry ---------------- */
  startBlock() {
    this.state = 'block'; this.st = 0; this.parryUsed = false; this.blockStunT = 0; this.move = null;
    for (const k in this.trails) this.trails[k].emit = false;
    this.faceBoss(false);
    Sfx.whoosh(1.9, 0.22);
    FX.ringBill(this.chest().addScaledVector(this.fwd(), 0.5), 1.6, HC.pale, 0.12);
  }
  updBlock(dt, a, wish, hasWish) {
    this.rig.setPose(HERO_POSES.guard, 30);
    this.blockStunT = Math.max(0, this.blockStunT - dt);
    if (this.blockStunT > 0) { this.vel.x = damp(this.vel.x, 0, 5, dt); this.vel.z = damp(this.vel.z, 0, 5, dt); return; }
    const sp = 2.4;
    this.vel.x = damp(this.vel.x, wish.x * sp, 12, dt); this.vel.z = damp(this.vel.z, wish.z * sp, 12, dt);
    if (!this.faceBoss(false) && hasWish) this.yaw = dampAngle(this.yaw, yawOf(wish.x, wish.z), 6, dt);
    if (this.take('dash')) { this.toMove(); return this.startDash(wish, hasWish); }
    if (this.buf === 'jump') { this.toMove(); this.blockCd = 0.15; return; }
    if (!this.blockHeld && this.st > PARRY_WIN) { this.blockCd = this.parryUsed ? 0 : this.st < 0.4 ? 0.3 : 0.12; this.toMove(); }
  }

  /* ---------------- Gale Rush: dash-through slash with delayed cut ---------------- */
  startRush() {
    const b = G.boss;
    FX.speedBg(0.55);
    const start = this.pos.clone();
    let dir = this.dashDir.clone(), len = 7;
    if (b.alive && horizDist(this.pos, b.pos) < 10) {
      dir = this.bossDir().normalize();
      len = horizDist(this.pos, b.pos) + b.radius + 2.6;
    }
    const end = start.clone().addScaledVector(dir, len);
    const r = Math.hypot(end.x, end.z), R = ARENA_R - 0.8;
    if (r > R) { end.x *= R / r; end.z *= R / r; }
    this.rushA = start; this.rushB = end; this.rushDir = dir; this.rushHit = false; this.rushCut = false;
    this.state = 'rush'; this.st = 0; this.rushCd = 0.9;
    this.yaw = yawOf(dir.x, dir.z); this.dodgeInv = 0.35; this.vel.set(0, 0, 0);
    Sfx.bigWhoosh(); Sfx.slash();
    FX.fovKick += 8;
    this.trails.R.emit = true; this.trails.L.emit = true;
    // side-on cinematic freeze shot
    const mid = start.clone().lerp(end, 0.5), side = new V3(-dir.z, 0, dir.x);
    if (side.dot(new V3(Math.sin(Cam.yaw), 0, Math.cos(Cam.yaw))) < 0) side.negate();
    Cam.shot(0.75, (k) => ({ pos: mid.clone().addScaledVector(side, 7.5 - k).setY(1.3), look: mid.clone().addScaledVector(dir, k * 0.6).setY(1.4), fov: 55 }), { out: 0.25 });
  }
  updRush(dt) {
    const t = this.st, T = 0.14;
    if (t < T) {
      const k = easeOutF(t / T);
      const prev = this.pos.clone();
      this.pos.lerpVectors(this.rushA, this.rushB, k); this.pos.y = Math.max(this.pos.y, 0);
      this.rig.setPose(HERO_POSES.dash, 40);
      FX.ghost(this.rig, HC.main);
      for (let i = 0; i < 6; i++) { const f = Math.random(); const q = prev.clone().lerp(this.pos, f); FX.add_.spawn(q.x, q.y + rand(0.4, 1.6), q.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.4, 0.3, 0, C.white, C.wind, 3, 0, 1); }
      this.vel.set(0, 0, 0);
      return;
    }
    if (!this.rushCut) {
      this.rushCut = true;
      this.pos.copy(this.rushB); this.pos.y = Math.max(0, this.pos.y);
      this.rig.setPose(HERO_POSES.counter, 40);
      this.yaw = yawOf(this.rushDir.x, this.rushDir.z);
      this.trails.R.emit = this.trails.L.emit = false;
      // the slash line hangs in the air before the cut lands
      const len = this.rushA.distanceTo(this.rushB);
      const g = new THREE.Group(); g.position.copy(this.rushA.clone().lerp(this.rushB, 0.5)).setY(1.35);
      g.rotation.y = yawOf(this.rushDir.x, this.rushDir.z);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, len), FX.lineMat(0xffffff)); m.rotation.x = Math.PI / 2; m.userData.ownGeo = true;
      const m2 = new THREE.Mesh(new THREE.PlaneGeometry(0.07, len), m.material); m2.rotation.set(Math.PI / 2, 0, Math.PI / 2); m2.scale.set(1, 1, 1); m2.rotation.z = 0; m2.rotation.y = Math.PI / 2;
      g.add(m, m2);
      FX.add(g, 0.42, (e, k) => { const w = k < 0.6 ? 1 : 1 + (k - 0.6) * 40; m.scale.set(w, 1, 1); m2.scale.set(w, 1, 1); m.material.uniforms.opacity.value = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; });
      Sfx.glint();
      const b = G.boss;
      this.rushHit = b.alive && segPointDist(b.chest(new V3()).setY(1.35), this.rushA.clone().setY(1.35), this.rushB.clone().setY(1.35)) < b.radius + 1.2;
    }
    if (t >= 0.36 && this.rushHit) {
      this.rushHit = false;
      const b = G.boss;
      const hp = b.chest(new V3()); hp.y = 1.6;
      const res = b.takeDamage(30, 20, hp, this.rushDir.clone(), { big: true, src: 'rush', knock: 6 });
      if (res) {
        this.onDealtHit(res, hp, this.rushDir, true, 0.12, 'rush');
        FX.windBlade(hp, yawOf(this.rushDir.x, this.rushDir.z), 0.8, 3.2, 0xffffff, true, false, 0.5);
        FX.windBlade(hp, yawOf(this.rushDir.x, this.rushDir.z), -0.8, 3.2, HC.main, true, true, 0.5);
        FX.burst(hp, 50, { speed: 18, life: 0.5, s0: 0.4, c0: C.white, c1: C.wind });
      }
    }
    this.rig.setPose(t < 0.45 ? HERO_POSES.counter : HERO_POSES.idle, t < 0.45 ? 40 : 8);
    this.vel.x = 0; this.vel.z = 0;
    if (t > 0.58 || (t > 0.42 && (this.buf === 'dash' || this.buf === 'jump'))) this.toMove();
  }

  /* ---------------- attacks ---------------- */
  startAttack(m, air, wish, hasWish, grade = '') {
    this.state = 'attack'; this.st = 0; this.move = m; this.moveHit = false; this.moveAir = air; this.slashDone = false;
    this.grade = grade; this.mashed = false; this.whiffLag = 0; this.moveBlocked = false;
    if (grade === 'perfect') FX.ghost(this.rig, 0xffffff);
    if (m.big || m.finisher) { Sfx.hv('heavy', 0.8, 1.4); Sfx.el('swing_heavy', 0.75) || Sfx.P('sfx_swing_heavy', 0.75); } else Sfx.hv('attack', 0.3, 0.7);
    const b = G.boss;
    if (!this.faceBoss(false) && hasWish) this.yaw = yawOf(wish.x, wish.z);
    // lunge to close distance, stop short of the boss
    let lv = 0;
    if (b.alive) {
      const dist = horizDist(this.pos, b.pos) - b.radius - 0.9;
      lv = clamp(dist / Math.max(m.a1, 0.1), 0, m.lunge * (air ? 1.4 : 2.2));
      if (dist > 6) lv = m.lunge;
    } else lv = m.lunge * 0.5;
    this.lungeV = lv;
    if (air) { this.airHits++; this.vel.y = Math.max(this.vel.y * 0.2, 2.5); }
    if (!Sfx.el(m.big || m.finisher ? 'swing_heavy' : 'swing_light', 0.7)) Sfx.whoosh(m.pitch || 1, 0.42);
    if (!air && !m.counter && !m.launcher) this.comboIdx = (this.comboIdx + 1) % this.ms.light.length;
    this.comboT = m.dur + 0.4;
  }
  startCounter() {
    const b = G.boss;
    Sfx.P('sfx_counter', 1); Sfx.hv('counter', 1, 0);
    FX.speedBg(0.45); FX.eyeGlint(this.rig);
    FX.ghost(this.rig, 0xffffff);
    const bf = dirOf(b.yaw);
    this.pos.set(b.pos.x - bf.x * (b.radius + 1.3), Math.max(0, this.pos.y), b.pos.z - bf.z * (b.radius + 1.3));
    this.clampArena();
    this.counterT = 0;
    this.startAttack(COUNTER_MOVE, !this.grounded, new V3(), false);
    this.faceBoss(true);
    this.lungeV = 0;
    Sfx.ting(3000); Sfx.bigWhoosh();
    FX.burst(this.chest(), 30, { speed: 10, life: 0.4, s0: 0.35, c0: C.white, c1: C.wind });
    FX.popup(this.chest().add(new V3(0, 0.8, 0)), 'ZEPHYR COUNTER', 'tag', Render.camera);
    G.stats.counters++;
  }
  updAttack(dt, a, wish) {
    const m = this.move, t = this.st;
    const fwd = this.fwd();
    // pose
    if (t < m.a0) this.rig.setPose(HERO_POSES[m.w], 26);
    else if (t < m.cancel + 0.05) this.rig.setPose(HERO_POSES[m.s], 38);
    // soft tracking: strikes curve toward a nearby boss until they land
    if (t < m.a1 && G.boss.alive) { const d = this.bossDir(); if (d.length() < m.reach + G.boss.radius + 3) this.yaw = dampAngle(this.yaw, yawOf(d.x, d.z), 14, dt); }
    // anime smear: stretch the striking limb and leave an afterimage as the blow lands
    if (t >= m.a0 - 0.02 && t < m.a1) { this.rig.smear = m.big ? 1.3 : 1; this.rig.smearLimb = m.trail; if (!this.smeared) { this.smeared = true; FX.ghost(this.rig, m.big ? 0xffffff : HC.main); } }
    else if (t < m.a0) this.smeared = false;
    else this.rig.setPose(this.moveAir ? HERO_POSES.fall : HERO_POSES.idle, 7);
    if (m.spinY && t >= m.a0 && t < m.a1 + 0.05) this.rig.addHips[1] = (t - m.a0) / (m.a1 + 0.05 - m.a0) * TAU * (m.spinTurns || 0.5);
    if (m.flip && t < m.a1) this.rig.addHips[0] = -clamp(t / m.a1, 0, 1) * TAU;
    // motion
    if (t < m.a1) { this.vel.x = fwd.x * this.lungeV; this.vel.z = fwd.z * this.lungeV; }
    else { this.vel.x = damp(this.vel.x, 0, 14, dt); this.vel.z = damp(this.vel.z, 0, 14, dt); }
    if (this.moveAir) this.vel.y = damp(this.vel.y, m.dive ? (m.spike ? -9 : -4) : 0.6, 10, dt);
    // trails
    const trailOn = t > m.a0 - 0.04 && t < m.a1 + 0.06;
    for (const k in this.trails) this.trails[k].emit = trailOn && (k === m.trail || (m.trail === 'B' && (k === 'L' || k === 'R')));
    // strike moment
    if (!this.slashDone && t >= m.a0) {
      this.slashDone = true;
      const c = this.pos.clone().addScaledVector(fwd, 0.7); c.y += m.slash ? m.slash.y : 1.2;
      if (m.slash) FX.windBlade(c, this.yaw, m.slash.tilt, m.big ? 2.9 : 2.1, m.counter ? 0xffffff : HC.main, m.big, m.slash.flip, m.big ? 4 : 2.2);
      if (Hero.id === 'wind') Sfx.slash();
      if (m.elem) elemStrike(this, m, c, fwd);
      if (m.rise && this.grounded) { this.vel.y = m.rise; this.grounded = false; }
      if (m.gust || (this.awake && Hero.id === 'wind' && (m.finisher || m.flip || m.spinY))) {
        const sp = this.pos.clone().addScaledVector(fwd, 0.8); sp.y += 1.2;
        let v = fwd.clone().multiplyScalar(28);
        if (G.boss.alive && (G.lockOn || horizDist(this.pos, G.boss.pos) < 12)) v = G.boss.chest(new V3()).sub(sp).normalize().multiplyScalar(28);
        G.proj.push(new Projectile({ pos: sp, vel: v, r: 0.8, owner: 'player', dmg: 8, post: 3, life: 0.5, kind: 'gust' }));
        Sfx.el('projectile', 0.6);
      }
      if (m.big) { FX.fovKick += 5; FX.burst(c, 20, { speed: 9, dir: fwd, spread: 0.6, life: 0.35, s0: 0.35, c0: C.white, c1: C.wind }); }
    }
    // active frames
    if (t >= m.a0 && t <= m.a1) {
      const c = this.pos.clone().addScaledVector(fwd, m.reach); c.y += this.moveAir ? 0.9 : 1.15;
      if (!this.moveHit) this.tryStrike(m, c, fwd);
      this.tryDeflect(c, m.r);
    }
    // cancels
    // landing a hit opens the cancel window early
    // whiffing near the opponent (or getting blocked) costs your string: no strike-cancel, extra recovery
    const near = G.boss.alive && horizDist(this.pos, G.boss.pos) < 6;
    const whiffed = (!this.moveHit || this.moveBlocked) && !this.moveAir && near && !m.counter;
    if (t >= (this.moveHit ? Math.min(m.cancel, m.a1 + 0.03) : m.cancel)) {
      const lightOk = !whiffed && !(this.mashed && t < m.cancel + 0.1);
      const grade = this.mashed ? 'mash' : (this.moveHit && !this.moveBlocked && this.lightAt >= m.a0 - 0.02) ? 'perfect' : '';
      if (this.buf === 'light' && lightOk) {
        if (!this.moveAir && this.grounded && !m.launcher && !m.counter && backInput(this, wish, wish.lengthSq() > 0.01)) { this.buf = null; return this.startAttack(launcherFor(Hero.id), false, wish, true, grade); }
        if (this.counterT > 0 && G.boss.alive) { this.buf = null; return this.startCounter(); }
        if (!this.moveAir && this.grounded && !m.counter) { this.buf = null; return this.startAttack(this.ms.light[this.comboIdx % this.ms.light.length], false, wish, wish.lengthSq() > 0.01, grade); }
        if (this.moveAir && this.airHits < this.ms.air.length) { this.buf = null; return this.startAttack(this.ms.air[this.airHits], true, wish, wish.lengthSq() > 0.01, grade); }
      }
      if (this.buf === 'heavy' && !whiffed) { this.buf = null; if (this.grounded) { this.state = 'charge'; this.st = 0; this.chargeLv = 0; return; } return this.startSlam(wish, wish.lengthSq() > 0.01); }
      if (this.buf === 'dash' && (this.grounded || this.airDashes < this.ms.airDashes) && (!whiffed || t >= m.dur)) { this.buf = null; this.toMove(); return this.startDash(wish, wish.lengthSq() > 0.01); }
      if (this.buf === 'block' && !whiffed && this.grounded && !this.moveAir && this.blockCd <= 0) { this.buf = null; return this.startBlock(); }
      if (this.buf === 'jump' && !whiffed && (this.grounded || this.jumps < 2)) { this.toMove(); return; }
      if (this.buf === 'special' && this.flow >= 100) { this.buf = null; return this.startSpecial(); }
    }
    if (t >= m.dur) {
      if (whiffed && !this.whiffLag) { this.whiffLag = m.big || m.finisher ? 0.28 : 0.13; this.comboIdx = 0; }
      if (t >= m.dur + this.whiffLag) { if (m.finisher) this.comboIdx = 0; this.toMove(); }
      else { this.rig.setPose(HERO_POSES.idle, 6); this.vel.x = damp(this.vel.x, 0, 10, dt); this.vel.z = damp(this.vel.z, 0, 10, dt); }
    }
  }
  // stuck in the end of a move: a hit here is a punish
  recovering() { return (this.state === 'attack' && this.move && !this.move.counter && this.st > this.move.a1 + 0.04) || (this.openT || 0) > 0; }
  tryStrike(m, c, fwd) {
    const b = G.boss;
    if (!b.alive) return;
    const d = segPointDist(c, b.capA, b.capB);
    const inAoe = m.aoe && horizDist(this.pos, b.pos) < m.aoe + b.radius && Math.abs(b.pos.y - this.pos.y) < 2.2;
    if (d < m.r + b.radius || inAoe) {
      this.moveHit = true;
      const hp = c.clone(); const cc = new V3(); { const t = clamp((c.y - b.capA.y) / (b.capB.y - b.capA.y), 0, 1); cc.lerpVectors(b.capA, b.capB, t); }
      hp.lerp(cc, 0.5);
      const sky = this.vaultT > 0 && this.moveAir;
      if (sky) this.vaultT = 0;
      const hdir = m.pull ? new V3(this.pos.x - b.pos.x, 0, this.pos.z - b.pos.z).normalize() : m.aoe ? new V3(b.pos.x - this.pos.x, 0, b.pos.z - this.pos.z).normalize() : fwd.clone();
      if (m.spike && !b.grounded) hdir.y = -1;
      const stale = Tempo.mult(m), gm = (this.grade === 'perfect' ? 1.2 : this.grade === 'mash' ? 0.85 : 1) * stale;
      this.meterMult = gm; this.hitLabel = this.grade === 'perfect' ? 'PERFECT' : stale < 0.9 ? 'STALE' : ''; this.hitKind = this.grade === 'perfect' ? 'gold' : stale < 0.9 ? 'stale' : '';
      const res = b.takeDamage(m.dmg * (sky ? 1.8 : 1) * gm, m.post * (sky ? 2 : 1) * gm, hp, hdir, { big: m.big || sky, src: 'melee', counter: m.counter, pull: m.pull, spike: m.spike, knock: sky ? 14 : m.counter ? 11 : m.pull ? m.pull : m.knock != null ? m.knock : m.finisher ? 15 : null });
      if (res) this.onDealtHit(res, hp, fwd, m.big || sky, sky ? 0.14 : m.counter ? 0.16 : m.big ? 0.1 : 0.06, sky ? 'skyfall' : m.counter ? 'counter' : m.finisher ? 'finisher' : m.launcher ? 'launcher' : '');
      if (res) { Tempo.land(m); if (this.grade === 'perfect') Tempo.perfect(this, hp); else if (stale < 0.9) Tempo.stale(hp); }
      this.meterMult = 1; this.hitLabel = ''; this.hitKind = '';
      if (res && sky) Moment.fire('SKYFALL', 'PILLAR VAULT → AIR STRIKE', hp, fwd, 2);
    }
  }
  tryDeflect(c, r) {
    for (const p of G.proj) {
      if (p.dead || p.owner !== 'boss' || p.kind !== 'fireball') continue;
      if (p.pos.distanceTo(c) < r + p.r + 0.45) {
        p.deflect();
        hitstop(0.08); FX.shake(0.3); Sfx.deflect();
        FX.star(p.pos, 3, HC.pale, 0.15);
        FX.popup(p.pos.clone().add(new V3(0, 0.6, 0)), 'DEFLECT!', 'tag', Render.camera); FX.impactLines(p.pos, 10, HC.pale, 2.5, 0.15); FX.shockwave(p.pos, 0.3, 0.8);
        this.gainFlow(10); G.stats.deflects++;
      }
    }
  }
  onDealtHit(res, point, dir, big, stop, tag = '') {
    Pursuit.arm(this, tag);
    Kit.onHit(this, res, point, dir, big, tag);
    if (res.interrupt) Moment.fire('INTERRUPT', 'HIS ATTACK SHATTERED', point, dir, 2);
    hitstop(stop);
    FX.shake(big ? 0.55 : 0.24);
    Sfx.hit(big ? 1.5 : 1);
    FX.hitSpark(point, dir, big, false);
    FX.impactLines(point, big ? 18 : 9, HC.glow, big ? 4.5 : 2.4, big ? 0.24 : 0.16);
    if (big) {
      Render.post.impact = Math.max(Render.post.impact, 1); Render.post.aberr = 1.2; Render.post.speed = Math.max(Render.post.speed, 1);
      FX.fovKick -= 6; FX.shockwave(point, 0.45, 1.2); FX.sfxWord(point, false);
      Cam.dutch((Math.random() < 0.5 ? -1 : 1) * 0.07);
    } else FX.fovKick -= 1.2;
    const label = this.hitLabel || { counter: 'COUNTER', finisher: 'FINISHER', splat: 'WALL SPLAT', slam: 'CRASH', reflect: 'RETURN', rush: 'GALE RUSH', pursuit: 'PURSUIT', skyfall: 'SKYFALL', topple: 'TOPPLE', launcher: 'LAUNCH' }[tag] || '';
    FX.dmgNumber(point, res.dmg, tag === 'counter' || tag === 'splat' ? 'gold' : this.hitKind || (big ? 'big' : ''), label);
    if (tag === 'counter' || tag === 'finisher' || tag === 'splat') {
      Cam.impactShot(point, dir, tag === 'splat' ? 0.9 : 0.7);
      slowmo(0.22, tag === 'counter' ? 0.5 : 0.38);
      FX.shockwave(point, 0.7, 1.6, 0.6);
    }
    const mm = this.meterMult || 1;
    this.gainFlow((big ? 6 : 3.5) * mm); Burst.gain(this, (big ? 3 : 1.5) * mm);
    this.combo++; this.comboTimer = 2.2; this.comboDmg = (this.combo === 1 ? 0 : (this.comboDmg || 0)) + res.dmg;
    G.stats.maxCombo = Math.max(G.stats.maxCombo, this.combo);
    if (res.broke) this.gainFlow(15);
  }
  gainFlow(n) { if (this.awake) n *= 1.4; const was = this.flow; this.flow = Math.min(100, this.flow + n); if (was < 100 && this.flow >= 100) { if (!Sfx.P('sfx_flow_full', 0.9)) Sfx.ting(1800); HUD.flowReady(); } }

  /* ---------------- heavy: charged Gale Lance ---------------- */
  updCharge(dt, a) {
    this.rig.setPose(HERO_POSES.charge, 14);
    this.vel.x = damp(this.vel.x, 0, 12, dt); this.vel.z = damp(this.vel.z, 0, 12, dt);
    if (G.lockOn && G.boss.alive) { const d = this.bossDir(); this.yaw = dampAngle(this.yaw, yawOf(d.x, d.z), 10, dt); }
    const lv = this.st < 0.45 ? 0 : this.st < 0.9 ? 1 : 2;
    if (lv > this.chargeLv) {
      this.chargeLv = lv; Sfx.ting(1400 + lv * 700);
      FX.groundRing(this.pos, 2.5 + lv, HC.pale, 0.35);
      FX.burst(this.chest(), 16, { speed: 6, life: 0.4, s0: 0.3, c0: C.white, c1: C.wind });
    }
    // wind converging into the palms
    const hL = this.rig.handPos('L'), hR = this.rig.handPos('R');
    const hc = hL.add(hR).multiplyScalar(0.5);
    const n = 2 + this.chargeLv * 2;
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), rr = rand(1.4, 2.8);
      const sx = hc.x + Math.cos(ang) * rr, sz = hc.z + Math.sin(ang) * rr, sy = hc.y + rand(-1, 1.2);
      FX.add_.spawn(sx, sy, sz, (hc.x - sx) * 3.4, (hc.y - sy) * 3.4, (hc.z - sz) * 3.4, 0.3, 0.12, 0.3, C.wind, C.white, 0, 0, 0.9);
    }
    if (Math.random() < dt * 8) Sfx.charge(this.chargeLv);
    if (this.take('dash')) { this.toMove(); return this.startDash(this.wishDir(a), Math.hypot(a.mx, a.my) > 0.1); }
    if (!a.heavyHeld || this.st > 1.8) {
      this.power = clamp((this.st - 0.12) / 0.8, 0, 1);
      this.state = 'release'; this.st = 0; this.released = false;
      Sfx.loopOff('sfx_charge_loop'); Sfx.P('sfx_charge_release', 0.6 + this.power * 0.5); Sfx.hv('heavy', 0.9);
    }
  }
  updRelease(dt) {
    this.rig.setPose(this.st < 0.06 ? HERO_POSES.charge : HERO_POSES.release, 36);
    const fwd = this.fwd();
    if (!this.released && this.st >= 0.06) {
      this.released = true;
      const pw = this.power;
      const sp = this.pos.clone().addScaledVector(fwd, 1.1); sp.y += 1.15;
      const recoil = heavyRelease(this, pw);
      this.vel.x = -fwd.x * recoil; this.vel.z = -fwd.z * recoil;
      FX.shake(0.25 + pw * 0.35); FX.fovKick += 6 + pw * 6; Render.post.speed = 0.5 + pw * 0.5; Render.post.aberr = 0.5 + pw;
      Sfx.bigWhoosh(); if (pw > 0.9) Sfx.boom(0.5);
      FX.ringBill(sp, 3 + pw * 2, HC.pale, 0.25);
      this.trails.L.emit = this.trails.R.emit = true;
    }
    this.vel.x = damp(this.vel.x, 0, 7, dt); this.vel.z = damp(this.vel.z, 0, 7, dt);
    if (this.st > 0.16) { this.trails.L.emit = this.trails.R.emit = false; }
    if (this.st > 0.3 && (this.buf === 'dash' || this.buf === 'jump' || this.buf === 'light')) return this.toMove();
    if (this.st > 0.52) this.toMove();
  }

  /* ---------------- air heavy: dive slam ---------------- */
  startSlam(wish, hasWish) {
    this.state = 'slam'; this.st = 0; this.slamDiving = false;
    if (!this.faceBoss(false) && hasWish) this.yaw = yawOf(wish.x, wish.z);
    Sfx.whoosh(0.7, 0.45);
  }
  updSlam(dt) {
    this.rig.setPose(HERO_POSES.slam, 22);
    if (this.st < 0.14) { this.vel.set(0, 1.5, 0); return; }
    if (!this.slamDiving) {
      this.slamDiving = true;
      const fwd = this.fwd();
      let h = 10;
      if (G.boss.alive) { const d = horizDist(this.pos, G.boss.pos) - G.boss.radius - 0.6; h = clamp(d / Math.max(this.pos.y / 30, 0.08), 0, 18); }
      this.vel.set(fwd.x * h, -32, fwd.z * h);
      this.trails.F.emit = true;
      Sfx.bigWhoosh();
    }
    this.rig.addHips[0] = this.st * 30;
    if (Math.random() < 0.8) FX.ghost(this.rig, HC.mid);
    if (this.grounded) {
      this.trails.F.emit = false;
      this.state = 'slamLand'; this.st = 0;
      const c = this.pos.clone();
      FX.shake(0.6); Sfx.boom(0.7); Sfx.hit(1.2);
      FX.groundRing(c, 6, HC.pale, 0.35); FX.groundRing(c, 4, 0xffffff, 0.25, 0.6);
      FX.burst(c.clone().setY(0.2), 40, { speed: 16, flat: true, life: 0.45, s0: 0.4, c0: C.white, c1: C.wind });
      FX.burst(c.clone().setY(0.2), 16, { speed: 7, flat: true, life: 0.8, s0: 0.8, s1: 2, c0: C.dust, c1: C.dust, add: false, alpha: 0.45 });
      Render.post.aberr = 1;
      FX.shockwave(c, 0.6, 1.3); World.crater(c, 4.5, false); World.damageAt(c, 4.5, 150);
      if (Hero.is('earth')) setTimeout(() => Kit.spikeAt(c, 6), 120);
      FX.impactLines(c.clone().setY(0.5), 14, HC.glow, 4, 0.22);
      const b = G.boss;
      if (b.alive && horizDist(c, b.pos) < 4.2 + b.radius && b.pos.y < 3) {
        const dir = new V3(b.pos.x - c.x, 0, b.pos.z - c.z).normalize();
        const hp = b.chest(new V3()); hp.y = 1.2;
        const res = b.takeDamage(28, 20, hp, dir, { big: true, src: 'slam' });
        if (res) this.onDealtHit(res, hp, dir, true, 0.1, 'slam');
      }
    }
  }

  /* ---------------- special: Tempest Ascension ---------------- */
  startSpecial() {
    if (!G.boss.alive || G.boss.state === 'transition' || G.boss.state === 'intro') return;
    this.flow = 0; this.state = 'special'; this.st = 0; this.spPhase = 0;
    this.faceBoss(true);
    this.vel.set(0, 0, 0);
    G.bossScaleTarget = 0.05; G.bossScale = 0.2;
    Sfx.flow(); Sfx.bigWhoosh(); Sfx.el('ult_cast', 1) || Sfx.P('sfx_tempest_cast', 1);
    CutIn.play(this.rig, 'hero', Hero.def.ult.name, Hero.def.ult.sub, 1.25);
    if (Duel.active) Duel.send({ t: 'cut', name: Hero.def.name + ' · ' + Hero.def.ult.name, sub: Hero.def.ult.sub });
    FX.speedBg(2.3); FX.eyeGlint(this.rig);
    HUD.say(Hero.def.name, pick(Hero.def.lines.ult), 2.2);
    const b = G.boss, me = this;
    Cam.shot(2.95, (k, t) => {
      const bp = b.pos.clone(), pp = me.pos.clone();
      const axis = new V3(bp.x - pp.x, 0, bp.z - pp.z).normalize();
      const side = new V3(-axis.z, 0, axis.x);
      if (t < 0.6) return { pos: pp.clone().addScaledVector(axis, 2.6).addScaledVector(side, 1.2).setY(pp.y + 0.6), look: pp.clone().setY(pp.y + 1.6), fov: 48 };
      if (t < 2.25) { const mid = pp.clone().lerp(bp, 0.55); const a = (t - 0.6) * 0.25; const s2 = side.clone().applyAxisAngle(new V3(0, 1, 0), a);
        return { pos: mid.clone().addScaledVector(s2, 15).setY(1.0), look: mid.clone().setY(5), fov: 64 }; }
      return { pos: bp.clone().addScaledVector(axis, -4).addScaledVector(side, 3).setY(12), look: bp.clone().setY(1.5), fov: 62 };
    }, { out: 0.35 });
    Render.post.flash = 0.6;
    G.stats.specials++;
  }
  updSpecial(dt) {
    const b = G.boss, t = this.st;
    this.invuln = 0.3;
    if (t < 0.6) {
      this.rig.setPose(HERO_POSES.special, 8);
      this.pos.y = damp(this.pos.y, 3.2, 4, dt); this.vel.set(0, 0, 0);
      for (let i = 0; i < 6; i++) { const ang = rand(0, TAU), rr = rand(2, 5); const c = this.chest(); FX.add_.spawn(c.x + Math.cos(ang) * rr, c.y + rand(-2, 2), c.z + Math.sin(ang) * rr, -Math.cos(ang) * rr * 3, rand(-1, 1), -Math.sin(ang) * rr * 3, 0.3, 0.15, 0.35, C.wind, C.white, 0, 0, 1); }
    }
    if (this.spPhase === 0 && t >= 0.6) {
      this.spPhase = 1;
      b.setHeld(true);
      this.tornado = new THREE.Group();
      const mats = [swirlMaterial(HC.main, HC.deep, { twist: 3, speed: 4, bands: 5, edge: 0.1 }), swirlMaterial(HC.mid, HC.deep2, { twist: -2, speed: -6, bands: 3, edge: 0.1 })];
      const g1 = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 2.0, 16, 32, 1, true), mats[0]);
      const g2 = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 1.4, 16, 32, 1, true), mats[1]);
      g1.position.y = g2.position.y = 8;
      this.tornado.add(g1, g2); this.tornado.position.copy(b.pos).setY(0);
      if (Duel.active) Duel.send({ t: 'ult', at: [b.pos.x, b.pos.z] });
      this.tornadoMats = mats;
      FX.add(this.tornado, 2.4, (e, k) => {
        const s = Math.min(1, e.t * 5) * (k > 0.85 ? (1 - k) / 0.15 : 1);
        this.tornado.scale.set(s, Math.min(1, e.t * 4), s);
        this.tornado.rotation.y += 0.25;
        mats[0].uniforms.time.value = e.t; mats[1].uniforms.time.value = e.t; mats[0].uniforms.opacity.value = s * 0.42; mats[1].uniforms.opacity.value = s * 0.3;
      });
      Sfx.bigWhoosh(); Sfx.boom(0.6); FX.shake(0.7);
      this.tickT = 0; this.ticks = 0;
    }
    if (this.spPhase === 1) {
      // hover and push both palms toward the storm
      this.rig.setPose(HERO_POSES.release, 12);
      this.faceBoss(true);
      this.tickT -= dt;
      if (this.tickT <= 0 && this.ticks < 16) {
        this.tickT = 0.1; this.ticks++;
        const hp = b.chest(new V3()).add(new V3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6)));
        const res = b.takeDamage(7, 2, hp, this.bossDir().normalize(), { src: 'special', noFlinch: true });
        if (res) { FX.hitSpark(hp, new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), false, false); Sfx.hit(0.6); FX.shake(0.2); FX.dmgNumber(hp, res.dmg, ''); FX.impactLines(hp, 6, HC.glow, 2, 0.12); this.combo++; this.comboTimer = 2.2; this.comboDmg = (this.comboDmg || 0) + res.dmg; }
      }
      for (let i = 0; i < 8; i++) { const ang = rand(0, TAU), rr = rand(1.5, 4.5), y = rand(0, 14); FX.add_.spawn(b.pos.x + Math.cos(ang) * rr, y, b.pos.z + Math.sin(ang) * rr, -Math.sin(ang) * 14, rand(2, 6), Math.cos(ang) * 14, 0.35, 0.3, 0.05, C.white, C.wind, 1, 0, 0.9); }
      if (t >= 2.25) {
        this.spPhase = 2;
        FX.ghost(this.rig, 0xffffff);
        this.pos.set(b.pos.x, b.pos.y + 6.5, b.pos.z).addScaledVector(this.bossDir().normalize(), -0.5);
        Sfx.bigWhoosh();
      }
    }
    if (this.spPhase === 2) {
      this.rig.setPose(HERO_POSES.slam, 30);
      this.pos.y -= 26 * dt;
      this.trails.F.emit = true;
      FX.ghost(this.rig, HC.pale);
      const top = b.pos.y + 2.6;
      if (this.pos.y <= top) {
        this.spPhase = 3; this.st = 2.5; this.trails.F.emit = false;
        const hp = b.chest(new V3());
        b.setHeld(false);
        const res = b.takeDamage(55, 60, hp, new V3(0, -1, 0), { big: true, src: 'special' });
        hitstop(0.22); Render.post.impact = 1; Render.post.flash = 0.5; Render.post.aberr = 1.5;
        FX.shake(1); Sfx.boom(1.2); Sfx.hit(1.8);
        FX.hitSpark(hp, new V3(0, -1, 0), true, false);
        FX.star(hp, 7, 0xffffff, 0.25);
        FX.groundRing(b.pos, 12, HC.pale, 0.6); FX.groundRing(b.pos, 8, 0xffffff, 0.4, 0.6);
        FX.burst(hp, 60, { speed: 24, life: 0.6, s0: 0.5, c0: C.white, c1: C.wind });
        if (res) { FX.dmgNumber(hp, res.dmg, 'gold', Hero.def.ult.tag); this.combo++; this.comboDmg = (this.comboDmg || 0) + res.dmg; }
        FX.shockwave(hp, 0.9, 2, 0.7); FX.impactLines(hp, 24, 0xffffff, 7, 0.3); FX.sfxWord(hp, false);
        World.crater(b.pos, 9, false); World.damageAt(b.pos, 7, 220);
        Kit.ultImpact(b, hp);
        Cam.impactShot(hp, this.fwd(), 1.0, 6); slowmo(0.2, 0.6);
        this.vel.set(-this.fwd().x * 6, 9, -this.fwd().z * 6);
        G.bossScaleTarget = 1;
      }
    }
    if (this.spPhase === 3) {
      this.rig.setPose(HERO_POSES.flip, 14);
      if (this.st > 2.75) { G.bossScaleTarget = 1; this.toMove(); }
    }
  }

  /* ---------------- getting hit ---------------- */
  tryHit(dmg, dir, kind, src) {
    if (!this.alive || this.state === 'special' || G.state !== 'fight') return '';
    if (this.dodgeInv > 0) {
      if (this.perfectWin > 0 && !this.perfectUsed) { this.perfectUsed = true; G.flowStep(); }
      return 'dodged';
    }
    if (this.invuln > 0) return 'immune';
    const gr = kind === 'burst' ? '' : Guard.check(this, dmg, dir, kind, src);
    if (gr) return gr;
    if (kind === 'burst') kind = 'heavy';
    if (this.state === 'guardbreak') dmg = Math.round(dmg * 1.25);
    if (this.recovering() && kind !== 'chip') {
      dmg = Math.round(dmg * 1.2);
      FX.popup(this.chest().add(new V3(0, 1.3, 0)), 'PUNISHED', 'tag', Render.camera); Sfx.P('sfx_hit_crit', 0.7);
      if (src === 'pvp' && Duel.active) Duel.send({ t: 'pun' });
    }
    if (Kit.armored(this) && kind !== 'launch' && this.hp > dmg * 0.5) {
      // stoneskin: take half, keep swinging
      dmg = Math.round(dmg * 0.5); this.hp -= dmg; this.hurtFlash = 0.6; G.stats.dmgTaken += dmg;
      FX.dmgNumber(this.chest(), dmg, 'hurt', 'ARMOR'); FX.burst(this.chest(), 12, { speed: 6, life: 0.4, s0: 0.4, c0: C.dust, c1: C.dust, add: false, alpha: 0.6 }); FX.shake(0.3); Sfx.hit(1.2);
      return 'hit';
    }
    this.hp -= dmg; this.hurtFlash = 1; Burst.gain(this, src === 'pvp' ? dmg * 4.5 : dmg * 0.9);
    G.stats.dmgTaken += dmg;
    this.combo = 0; this.counterT = 0;
    for (const k in this.trails) this.trails[k].emit = false;
    Sfx.playerHurt(); FX.shake(kind === 'light' ? 0.35 : 0.6); hitstop(kind === 'light' ? 0.06 : 0.1);
    Render.post.aberr = 1.2;
    FX.dmgNumber(this.chest(), dmg, 'hurt'); if (kind !== 'light') { FX.sfxWord(this.chest(), true); Cam.dutch(0.06); }
    this.yaw = yawOf(-dir.x, -dir.z);
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false; this.state = 'dead'; this.st = 0; Sfx.loopOff('sfx_charge_loop'); Sfx.hv('ko', 1, 0);
      this.vel.set(dir.x * 8, 8, dir.z * 8); this.grounded = false;
      G.onDefeat();
      return 'hit';
    }
    if (kind === 'pull') {
      // dragged toward the attacker by an undertow
      this.state = 'hit'; this.st = 0; this.stunDur = 0.55;
      this.vel.set(dir.x * 9, Math.max(this.vel.y, 0), dir.z * 9); this.yaw = yawOf(dir.x, dir.z);
      return 'hit';
    }
    if (kind === 'spike' && !this.grounded) {
      Sfx.loopOff('sfx_charge_loop');
      this.state = 'launched'; this.st = 0; this.vel.set(dir.x * 3, -22, dir.z * 3);
      return 'hit';
    }
    if (kind === 'spike') kind = 'heavy';
    if (kind === 'launch' || kind === 'heavy') {
      Sfx.loopOff('sfx_charge_loop'); setTimeout(() => Sfx.bv('taunt', 0.3, 10), 500);
      this.state = 'launched'; this.st = 0;
      this.vel.set(dir.x * 9, kind === 'launch' ? 11 : 7, dir.z * 9); this.grounded = false;
    } else {
      // in a duel a light hit only nudges, so a well-timed string can actually combo
      const kb = src === 'pvp' ? 2.2 : 7;
      this.state = 'hit'; this.st = 0; this.stunDur = src === 'pvp' ? 0.38 : 0.3;
      this.vel.set(dir.x * kb, Math.max(this.vel.y, 0), dir.z * kb);
    }
    return 'hit';
  }
  knockback(dir, power) {
    if (!this.alive) return;
    this.state = 'launched'; this.st = 0; this.grounded = false;
    this.vel.set(dir.x * power, 7, dir.z * power);
  }
  updLaunched(dt) {
    this.rig.setPose(HERO_POSES.launched, 12);
    this.vel.x = damp(this.vel.x, 0, 1.5, dt); this.vel.z = damp(this.vel.z, 0, 1.5, dt);
    if (this.st > 0.15 && this.take('dash')) {
      // air recovery
      this.toMove(); this.invuln = 0.45; this.vel.y = 7; this.jumps = 1; this.airDashes = 0;
      FX.ghost(this.rig, 0xffffff); Sfx.whoosh(1.4, 0.5);
      FX.burst(this.chest(), 20, { speed: 8, life: 0.35, s0: 0.3, c0: C.white, c1: C.wind });
      FX.popup(this.chest().add(new V3(0, 0.6, 0)), 'RECOVER', 'tag small', Render.camera);
      return;
    }
    if (this.grounded && this.st > 0.1) {
      this.state = 'down'; this.st = 0; FX.shake(0.2); Sfx.land();
      FX.burst(this.pos.clone().setY(0.2), 12, { speed: 4, flat: true, life: 0.6, s0: 0.6, s1: 1.4, c0: C.dust, c1: C.dust, add: false, alpha: 0.4 });
    }
  }

  /* ---------------- physics + visuals ---------------- */
  physics(dt) {
    const air = !this.grounded;
    let g = GRAV;
    if (this.state === 'attack' && this.moveAir) g = 4;
    if (this.state === 'dash' && air) g = 0;
    if (this.state === 'special' && this.spPhase < 2) g = 0;
    if (this.state === 'slam' && this.st < 0.14) g = 0;
    if (this.state === 'special' && this.spPhase === 2) g = 0;
    this.vel.y -= g * dt;
    if (this.vel.y < -40) this.vel.y = -40;
    const vyBefore = this.vel.y;
    this.pos.addScaledVector(this.vel, dt);
    const offEdge = Duel.active && Math.hypot(this.pos.x, this.pos.z) > ARENA_R + 2.1;
    if (offEdge && this.alive && this.pos.y < -7) return this.ringOut();
    if (this.pos.y <= 0 && !offEdge) {
      this.pos.y = 0;
      if (!this.grounded) {
        this.grounded = true; this.jumps = 0; this.airDashes = 0; this.airHits = 0;
        if (vyBefore < -14 && this.state === 'move') { Sfx.land(); FX.burst(this.pos.clone().setY(0.1), 10, { speed: 4, flat: true, life: 0.5, s0: 0.5, s1: 1.2, c0: C.dust, c1: C.dust, add: false, alpha: 0.35 }); }
        if (this.state === 'attack' && this.moveAir) this.toMove();
      }
      this.vel.y = 0;
    } else if (this.pos.y > 0.01) this.grounded = false;
    // boss pushout
    const b = G.boss;
    if (b.alive && this.state !== 'special' && this.state !== 'rush') {
      const dx = this.pos.x - b.pos.x, dz = this.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz), min = b.radius + 0.45;
      if (d < min && this.pos.y < b.pos.y + 2.8 && this.pos.y + 1.6 > b.pos.y) {
        const k = d > 0.001 ? (min - d) / d : 1;
        this.pos.x += dx * k; this.pos.z += dz * k;
      }
    }
    this.clampArena();
    const PW = World.collide(this.pos, 0.45);
    if (PW && !this.grounded && this.state === 'dash' && !this.backstep) Vault.check(this, PW, true);
  }
  clampArena() {
    const r = Math.hypot(this.pos.x, this.pos.z), R = ARENA_R - 0.6;
    if (r <= R) return;
    // in a duel a launched fighter can fly off the terrace: ring out
    if (Duel.active && G.state === 'fight' && (this.state === 'launched' || this.state === 'dead' || r > ARENA_R + 2.1)) return;
    if (Duel.active && r < ARENA_R + 2.1 && this.state !== 'move' && this.state !== 'dash') { const k = Math.max(R, r - 8 * (1 / 60)) / r; this.pos.x *= k; this.pos.z *= k; return; }
    this.pos.x *= R / r; this.pos.z *= R / r;
  }
  ringOut() {
    this.hp = 0; this.alive = false; this.state = 'dead'; this.st = 0; Sfx.loopOff('sfx_charge_loop');
    FX.popup(this.chest().add(new V3(0, 2, 0)), 'RING OUT', 'break', Render.camera); Sfx.bigWhoosh();
    G.onDefeat('RING OUT');
  }
  // pick a real animation clip for the model when one fits the state better than the procedural pose
  clipReq() {
    const S = this.state, st = this.st, m = this.rig.model;
    if (!m) return null;
    const D = k => (m.acts[k] ? m.acts[k].dur : 1);
    if (S === 'move') {
      if (this.grounded) return Math.hypot(this.vel.x, this.vel.z) <= 1.2 ? ['idle', G.time % D('idle')] : null;
      if (this.jumps >= 2 || (this.vaultT || 0) > 0) return null;
      const vy = this.vel.y;
      return ['jump', vy > 0 ? lerp(0.58, 0.8, 1 - clamp(vy / JUMP_V, 0, 1)) : lerp(0.84, 1.04, clamp(-vy / 16, 0, 1))];
    }
    if (S === 'hit') return ['hit', 0.12 + st * 2.2];
    if (S === 'launched') return ['knock', Math.min(0.25 + st * 1.4, 0.95)];
    if (S === 'down') return ['knock', Math.min(1.0 + st * 1.1, 1.55)];
    if (S === 'dead') return ['knock', Math.min(0.6 + st * 1.1, 2.45)];
    if (S === 'victory') return ['victory', st % D('victory')];
    if (S === 'charge') return ['cast', Math.min(0.35 + st * 0.9, 1.2) + Math.sin(G.time * 30) * 0.01];
    if (S === 'release') return ['cast', 1.62 + st * 1.4];
    if (S === 'beam') return ['cast', 1.05 + Math.sin(G.time * 24) * 0.04];
    if (S === 'special' && this.spPhase === 0) return ['cast', Math.min(0.3 + st * 1.4, 1.2)];
    if (S === 'dash' && !Hero.def.cloth && !this.backstep && this.grounded) return ['roll', 0.62 + clamp(st / 0.3, 0, 1) * 1.0];
    if (S === 'attack' && this.move && this.move.finisher && !this.moveAir) {
      const mv = this.move;
      return ['kick', st < mv.a0 ? lerp(0.85, 1.22, st / mv.a0) : st < mv.a1 ? lerp(1.22, 1.47, (st - mv.a0) / (mv.a1 - mv.a0)) : lerp(1.47, 1.95, clamp((st - mv.a1) / (mv.dur - mv.a1), 0, 1))];
    }
    return null;
  }
  visuals(dt) {
    const rig = this.rig;
    rig.clipReq = this.lastClip = this.blitzClip || this.clipReq();
    rig.lastSmear = rig.smear ? [Math.round(rig.smear * 100) / 100, rig.smearLimb] : null;
    rig.root.position.copy(this.pos);
    rig.root.rotation.y = this.yaw;
    rig.update(dt);
    rig.root.updateMatrixWorld(true);
    // trails follow hands/feet
    const tmp = new V3();
    this.trails.L.push(rig.handPos('L', tmp)); this.trails.R.push(rig.handPos('R', tmp));
    this.trails.F.push(rig.footPos('R', tmp)); this.trails.B.push(rig.footPos('L', tmp));
    rig.setFlash(this.hurtFlash * 0.6);
    const flicker = this.invuln > 0 && !this.blitzClip && this.state === 'move' && Math.floor(G.time * 30) % 2 === 0;
    rig.root.visible = !flicker;
  }
  lateUpdate(dt, cam) {
    updateRigChains(this.rig, dt, cam);
    for (const k in this.trails) this.trails[k].update(cam);
  }
}
