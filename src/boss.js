'use strict';
/* ============================================================
   Boss: Varukh, the Cinder Warden. Telegraphed patterns, posture, 2 phases
   ============================================================ */
const BOSS_SCALE = 1.55;

class Boss {
  constructor() {
    this.rig = makeBossRig();
    this.rig.root.scale.setScalar(BOSS_SCALE);
    Render.scene.add(this.rig.root);
    for (const c of this.rig.chains) Render.scene.add(c.ribbon.mesh);
    this.light = new THREE.PointLight(0xff6a20, 0, 12, 2);
    Render.scene.add(this.light);
    this.radius = 0.95;
    this.capA = new V3(); this.capB = new V3();
    this.reset();
  }
  reset() {
    this.pos = new V3(0, 0, -5); this.yaw = 0; this.knock = new V3();
    this.maxHp = 1500; this.hp = this.maxHp; this.posture = 0; this.maxPosture = 100; this.postureDelay = 0;
    this.phase = 1; this.state = 'intro'; this.st = 0; this.atk = null; this.cool = 1.4; this.last = '';
    this.alive = true; this.flash = 0; this.held = false; this.pendingPhase = false; this.strafe = 1; this.strafeT = 0;
    this.glowL = 0; this.glowR = 0; this.coreGlow = 0.6; this.walkPh = 0; this.deadT = 0; this.novaDone = false; this.novaPending = false; this.beamDone = false; this.beamPending = false;
    this.rig.root.visible = true; this.rig.root.scale.setScalar(BOSS_SCALE); this.pendingBreak = false;
    for (const c of this.rig.chains) c.ribbon.mesh.visible = true;
    this.rig.setPose(BOSS_POSES.idle); this.rig.snap(); this.rig.update(0);
    this.sync();
    for (const c of this.rig.chains) c.inited = false;
  }
  fwd(o = new V3()) { return dirOf(this.yaw, o); }
  chest(o = new V3()) { return o.set(this.pos.x, this.pos.y + 2.0, this.pos.z); }
  pose(n, rate) { this.rig.setPose(BOSS_POSES[n], rate); }
  face(dt, rate) { const p = G.player.pos; this.yaw = dampAngle(this.yaw, yawOf(p.x - this.pos.x, p.z - this.pos.z), rate, dt); }
  toPlayer(o = new V3()) { const p = G.player.pos; return o.set(p.x - this.pos.x, 0, p.z - this.pos.z); }
  distP() { return horizDist(this.pos, G.player.pos); }
  ev(x) { return this.prevAt < x && this.at >= x; }
  glint(L) {
    const h = this.rig.handPos(L || 'R');
    FX.star(h, 2.8, 0xffcc66, 0.22); Sfx.glint();
  }
  setHeld(h) {
    this.held = h;
    if (h) { this.cancelAttack(); this.state = 'held'; this.st = 0; }
    else if (this.state === 'held') { this.state = 'fall'; this.st = 0; if (this.pendingBreak) { this.pendingBreak = false; this.breakPosture(); } }
  }
  cancelAttack() {
    if (this.atk && this.atk.cleanup) this.atk.cleanup();
    this.atk = null; this.glowL = this.glowR = 0;
  }

  takeDamage(dmg, post, point, dir, o = {}) {
    if (!this.alive || this.state === 'transition' || this.state === 'intro') return null;
    const mult = (this.state === 'stagger' ? 1.5 : 1) * (G.player.awake ? 1.3 : 1) * (o.src === 'burn' ? 1 : Hero.def.stats.dmg) * elemMult(Hero.id, 'fire');
    const d = Math.max(1, Math.round(dmg * mult * rand(0.92, 1.08)));
    this.hp -= d;
    this.flash = 1;
    let broke = false;
    if (this.state !== 'stagger') {
      this.posture += post * (this.phase === 2 ? 0.85 : 1);
      this.postureDelay = 1.6;
      if (this.posture >= this.maxPosture) broke = true;
    }
    // hit reaction: jolt + slide, super armor during attacks
    const armor = this.state === 'attack' ? 0.35 : 1;
    this.knock.addScaledVector(dir, (o.knock || (o.big ? 5 : 1.6)) * armor);
    if (o.knock) { this.knockSrc = 1; this.splatOK = 0.5; }
    this.knock.y = 0;
    const tc = this.rig.cur.torso; tc[0] -= (o.big ? 0.35 : 0.16); tc[1] += rand(-0.2, 0.2);
    this.rig.cur.head[0] -= 0.2;
    if (this.state === 'idle' && !o.noFlinch) { this.state = 'flinch'; this.st = 0; }
    let interrupt = false;
    if (o.big && this.state === 'attack' && this.atk && !['nova', 'beam'].includes(this.atk.name) && this.at < 0.5 && o.src !== 'special' && this.hp > 0) {
      this.cancelAttack(); this.state = 'flinch'; this.st = -0.35; interrupt = true;
      this.knock.addScaledVector(dir, 4);
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); return { dmg: d, broke: false, killed: true }; }
    if (broke) this.breakPosture();
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) this.pendingPhase = true;
    if (this.phase === 2 && !this.novaDone && this.hp <= this.maxHp * 0.3) this.novaPending = true;
    if (this.phase === 2 && !this.beamDone && this.hp <= this.maxHp * 0.44) this.beamPending = true;
    return { dmg: d, broke, interrupt };
  }
  breakPosture() {
    this.posture = 0;
    if (this.state === 'held') { this.pendingBreak = true; return; }
    this.cancelAttack();
    this.state = 'stagger'; this.st = 0;
    Sfx.breakS(); FX.shake(0.8); hitstop(0.14); slowmo(0.3, 0.45);
    Render.post.impact = 1; Render.post.flash = 0.35;
    const c = this.chest();
    FX.star(c, 6, 0xffeeaa, 0.3);
    FX.burst(c, 50, { speed: 18, life: 0.6, s0: 0.5, c0: C.fireHot, c1: C.ember });
    FX.popup(c.clone().add(new V3(0, 1, 0)), 'BREAK!', 'break', Render.camera);
    HUD.banner('POSTURE BROKEN', 'break');
    FX.shockwave(c, 0.8, 1.6, 0.6); FX.impactLines(c, 20, 0xffe0a0, 6, 0.3); Cam.impactShot(c, this.toPlayer().normalize().negate(), 0.9, 5);
    G.stats.breaks++;
  }
  die() {
    Sfx.bv('defeat', 1, 0);
    this.alive = false; this.cancelAttack(); this.state = 'dead'; this.st = 0; this.held = false;
    G.onVictory();
  }

  update(dt) {
    if (dt <= 0) { this.sync(); return; }
    this.st += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.postureDelay -= dt;
    if (this.postureDelay <= 0 && this.state !== 'stagger') this.posture = Math.max(0, this.posture - dt * 9);
    if (this.pendingPhase && ['idle', 'attack', 'flinch', 'stagger'].includes(this.state)) this.startTransition();
    const S = this.state;

    if (S === 'intro') { this.pose('idle', 6); }
    else if (S === 'idle') this.updIdle(dt);
    else if (S === 'flinch') { this.pose('flinch', 20); if (this.st > 0.22) { this.state = 'idle'; this.st = 0; } }
    else if (S === 'attack' && !this.atk) { this.state = 'idle'; this.st = 0; }
    else if (S === 'attack') {
      this.prevAt = this.at; this.at += dt;
      if (this.atk.update(this.at, dt)) { this.cancelAttack(); if (this.state === 'attack') { this.state = 'idle'; this.st = 0; } this.cool = this.phase === 2 ? rand(0.3, 0.6) : rand(0.6, 1.05); }
    }
    else if (S === 'stagger') {
      this.pose('stagger', 10);
      this.pos.y = Math.max(0, this.pos.y - dt * 20);
      if (Math.random() < dt * 10) FX.burst(this.chest().add(new V3(0, 0.5, 0)), 1, { speed: 1, life: 1.2, s0: 0.8, s1: 2, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.35, up: 2 });
      if (this.st > 3.0) { this.state = 'idle'; this.st = 0; this.cool = 0.4; Sfx.roar(); }
    }
    else if (S === 'held') {
      this.pose('flinch', 6);
      this.pos.y = damp(this.pos.y, 4.0, 3, dt);
      this.yaw += dt * 6;
    }
    else if (S === 'fall') {
      this.pose('stagger', 14);
      this.pos.y = Math.max(0, this.pos.y - dt * 22);
      if (this.pos.y <= 0 && this.st > 0.1) { FX.shake(0.5); Sfx.boom(0.6); FX.groundRing(this.pos, 5, 0xffaa66, 0.4); if (this.state === 'fall') { this.state = 'stagger'; this.st = 1.2; } }
    }
    else if (S === 'transition') this.updTransition(dt);
    else if (S === 'dead') this.updDead(dt);

    // knockback slide
    this.pos.x += this.knock.x * dt; this.pos.z += this.knock.z * dt;
    this.knock.multiplyScalar(Math.exp(-(this.knock.length() > 6 ? 3.5 : 6) * dt));
    if (this.knock.length() > 5 && Math.random() < 0.7) FX.burst(this.pos.clone().setY(0.2), 2, { speed: 3, flat: true, life: 0.7, s0: 0.8, s1: 1.8, c0: C.dust, c1: C.dust, add: false, alpha: 0.4 });
    this.splatOK = Math.max(0, (this.splatOK || 0) - dt);
    const PH = this.alive ? World.pillarAt(this.pos, this.radius) : null;
    if (PH) {
      const ks = this.knock.length();
      const dashing = this.state === 'attack' && this.atk && this.atk.name === 'rush';
      if (ks > 3.5 && this.splatOK > 0) {
        const dir = this.knock.clone().normalize();
        World.hitPillar(PH, 500, dir, this.chest());
        this.knock.multiplyScalar(-0.15);
        const c = this.chest();
        const res = this.takeDamage(40, 35, c, dir.clone().negate(), { big: true, noFlinch: true });
        if (res) G.player.onDealtHit(res, c, dir, true, 0.14, 'splat');
        HUD.banner('WALL SPLAT', 'break');
      } else if (dashing || this.state === 'transition') World.hitPillar(PH, 500, this.fwd(), this.chest());
    }
    World.collide(this.pos, this.radius);
    const r = Math.hypot(this.pos.x, this.pos.z), R = ARENA_R - 1.6;
    if (r > R) { this.pos.x *= R / r; this.pos.z *= R / r; }
    this.updGlow(dt);
    this.rig.update(dt);
    this.sync();
  }
  sync() {
    this.rig.root.position.copy(this.pos);
    if (G.hitstop > 0 && this.flash > 0.5) { this.rig.root.position.x += rand(-0.06, 0.06); this.rig.root.position.z += rand(-0.06, 0.06); }
    this.rig.root.rotation.y = this.yaw;
    this.capA.set(this.pos.x, this.pos.y + 0.55, this.pos.z);
    this.capB.set(this.pos.x, this.pos.y + (this.state === 'stagger' ? 1.9 : 2.6), this.pos.z);
    this.rig.setFlash(this.flash * 0.9);
    const lf = dirOf(this.yaw); this.light.position.set(this.pos.x + lf.x * 1.6, this.pos.y + 1.6, this.pos.z + lf.z * 1.6);
  }
  updGlow(dt) {
    const rig = this.rig;
    if (this.state === 'dead') { this.light.intensity = damp(this.light.intensity, 0, 2, dt); return; }
    const p2 = this.phase === 2;
    const base = this.state === 'stagger' ? 0.25 : p2 ? 1.0 : 0.65;
    const pulse = base + Math.sin(G.time * (p2 ? 9 : 4)) * 0.12;
    rig.crackMat.color.setRGB(1.0 * (0.4 + pulse * 0.7), 0.42 * (0.4 + pulse * 0.6), 0.1 * pulse);
    rig.core.scale.setScalar(0.8 + pulse * 0.6);
    this.light.intensity = (p2 ? 7 : 4) * pulse + (this.glowL + this.glowR) * 4;
    for (const L of ['L', 'R']) {
      const g = this['glow' + L];
      rig['glow' + L].scale.setScalar(0.75 + g * 0.55);
      if (g > 0.3 && Math.random() < dt * 40 * g) {
        const h = rig.handPos(L);
        FX.add_.spawn(h.x + rand(-0.15, 0.15), h.y, h.z + rand(-0.15, 0.15), rand(-0.5, 0.5), rand(1.5, 3.5), rand(-0.5, 0.5), 0.45, 0.45 * g + 0.15, 0.05, C.fireHot, C.ember, 1, -2);
      }
    }
    if (p2 && this.alive && Math.random() < dt * 10) {
      const c = this.chest();
      FX.add_.spawn(c.x + rand(-0.6, 0.6), c.y + rand(-1, 0.8), c.z + rand(-0.6, 0.6), rand(-0.4, 0.4), rand(1, 3), rand(-0.4, 0.4), 0.7, 0.3, 0.05, C.fireHot, C.ember, 1, -1);
    }
  }

  /* ---------------- idle: spacing + attack choice ---------------- */
  updIdle(dt) {
    this.face(dt, 5);
    const d = this.distP();
    const want = this.phase === 2 ? 5.5 : 6.5;
    const to = this.toPlayer().normalize();
    const tan = new V3(-to.z, 0, to.x).multiplyScalar(this.strafe);
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = rand(1.2, 2.5); this.strafe = Math.random() < 0.5 ? -1 : 1; }
    const approach = clamp((d - want) * 1.4, -3, this.phase === 2 ? 7 : 5.5);
    const vx = to.x * approach + tan.x * 1.6, vz = to.z * approach + tan.z * 1.6;
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    const sp = Math.hypot(vx, vz);
    this.walkPh += sp * dt * 1.6;
    const s = Math.sin(this.walkPh), k = clamp(sp / 4, 0, 1);
    const p = Object.assign({}, BOSS_POSES.idle);
    p.hipL = [-0.35 - s * 0.5 * k, 0, 0.2]; p.hipR = [0.35 + s * 0.5 * k, 0, -0.2];
    p.knL = [0.5 + Math.max(0, Math.cos(this.walkPh)) * 0.6 * k, 0, 0]; p.knR = [0.45 + Math.max(0, -Math.cos(this.walkPh)) * 0.6 * k, 0, 0];
    p.hipsY = -0.1 + Math.abs(Math.cos(this.walkPh)) * 0.04 * k;
    p.torso = [0.15 + Math.sin(G.time * 1.8) * 0.03, -0.2, 0];
    this.rig.setPose(p, 8);
    this.cool -= dt;
    if (this.cool <= 0 && G.player.alive && G.state === 'fight') this.chooseAttack(d);
  }
  chooseAttack(d) {
    const w = {};
    if (d > 10) Object.assign(w, { volley: 3, leap: 3, eruption: 2, rush: 2 });
    else if (d > 4.5) Object.assign(w, { rush: 3, wave: 2, volley: 2.5, eruption: 2, leap: 1 });
    else Object.assign(w, { wave: 3, rush: 2.5, leap: 1, eruption: 0.6 });
    if (this.phase === 2) { w.spiral = d < 9 ? 2.5 : 1; w.meteor = 2.2; }
    delete w[this.last];
    let tot = 0; for (const k in w) tot += w[k];
    let r = Math.random() * tot, choice = 'rush';
    for (const k in w) { r -= w[k]; if (r <= 0) { choice = k; break; } }
    // scripted ultimates take priority over the random pick
    if (this.novaPending) { this.novaPending = false; this.novaDone = true; choice = 'nova'; }
    else if (this.beamPending && G.player.alive && !['special', 'dead', 'launched', 'down'].includes(G.player.state)) { this.beamPending = false; this.beamDone = true; choice = 'beam'; }
    this.last = choice;
    this.atk = this[choice]();
    this.atk.name = choice;
    if (choice !== 'nova' && choice !== 'beam' && choice !== 'meteor') Sfx.bv('attack', 0.5, 2);
    if (choice === 'wave') Sfx.P('sfx_flame_wave', 0.9, { delay: 0.3 });
    if (choice === 'nova') Sfx.P('sfx_nova_charge', 1);
    if (choice === 'beam') Sfx.P('sfx_beam_charge', 1, { delay: 0.6 });
    this.state = 'attack'; this.at = 0; this.prevAt = -1;
  }

  /* ---------------- attacks ---------------- */
  volley() {
    const n = this.phase === 2 ? 5 : 3, gap = this.phase === 2 ? 0.3 : 0.38, t0 = 0.6;
    const dur = t0 + n * gap + 0.5;
    return {
      update: (t, dt) => {
        this.face(dt, 7);
        if (t < t0) { this.pose('throwW', 10); this.glowR = clamp(t / t0, 0, 1); }
        for (let i = 0; i < n; i++) {
          const tt = t0 + i * gap;
          if (this.ev(tt)) {
            const L = i % 2 ? 'L' : 'R';
            this.pose(L === 'R' ? 'throwR' : 'throwL', 30);
            const h = this.rig.handPos(L);
            const pl = G.player;
            const tgt = pl.chest(new V3());
            const speed = this.phase === 2 ? 21 : 17;
            const lead = h.distanceTo(tgt) / speed * 0.55;
            tgt.x += pl.vel.x * lead; tgt.z += pl.vel.z * lead; tgt.y -= 0.2;
            const v = tgt.sub(h).normalize().multiplyScalar(speed);
            G.proj.push(new Projectile({ pos: h, vel: v, r: 0.42, owner: 'boss', dmg: 11, life: 3, kind: 'fireball' }));
            Sfx.fireball();
            FX.burst(h, 12, { speed: 6, dir: v.clone().normalize(), spread: 0.6, life: 0.3, s0: 0.4, c0: C.fireHot, c1: C.ember });
            this.glowL = L === 'R' ? 1 : 0; this.glowR = L === 'R' ? 0 : 1;
          }
          if (this.ev(tt + gap * 0.55) && i < n - 1) this.pose(i % 2 ? 'throwW' : 'throwL', 12);
        }
        return t >= dur;
      },
    };
  }
  wave() {
    const doubleSlam = this.phase === 2;
    let decal = makeDecal(0xff4010);
    decal.scale.setScalar(8.4);
    const slam = (strength) => {
      this.pose('slam', 32);
      const c = this.pos.clone();
      FX.shake(clamp(0.8 - this.distP() * 0.03, 0.25, 0.8)); Sfx.boom(0.9); Sfx.fireHit();
      Render.post.aberr = 0.8;
      FX.groundRing(c, 5, 0xff8030, 0.35); FX.groundRing(c, 3, 0xffd080, 0.25, 0.6);
      FX.burst(c.clone().setY(0.3), 50, { speed: 14, flat: true, life: 0.55, s0: 0.6, c0: C.fireHot, c1: C.ember, drag: 3 });
      FX.burst(c.clone().setY(0.5), 14, { speed: 5, flat: true, life: 1.1, s0: 1, s1: 2.6, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.4, up: 1 });
      const pl = G.player;
      if (horizDist(pl.pos, c) < 3.6 && pl.pos.y < 2) {
        const dir = new V3(pl.pos.x - c.x, 0, pl.pos.z - c.z).normalize();
        pl.tryHit(18, dir, 'launch', c);
      }
      G.hazards.push(new FireRing(c, 11 * strength, 22, 15));
      FX.shockwave(c.clone().setY(0.5), 0.7, 1.4, 0.6); World.crater(c, 6.5); World.damageAt(c, 4, 160); Cam.dutch(0.08);
    };
    return {
      update: (t, dt) => {
        if (t < 0.75) {
          this.face(dt, 4); this.pose('slamW', 7); this.glowL = this.glowR = t / 0.75;
          if (decal) { decal.position.set(this.pos.x, 0.05, this.pos.z); decal.material.uniforms.progress.value = t / 0.75; decal.material.uniforms.time.value = t; }
          if (Math.random() < 0.6) { const a = rand(0, TAU), r = rand(1, 3.5); FX.add_.spawn(this.pos.x + Math.cos(a) * r, 0.1, this.pos.z + Math.sin(a) * r, 0, rand(2, 5), 0, 0.5, 0.4, 0.05, C.fireHot, C.ember, 1, 0); }
        }
        if (this.ev(0.75)) { killDecal(decal); decal = null; slam(1); this.glowL = this.glowR = 0.3; }
        if (doubleSlam) {
          if (t > 1.0 && t < 1.25) { this.pose('slamW', 14); this.glowL = this.glowR = 1; }
          if (this.ev(1.25)) slam(1.35);
        }
        return t >= (doubleSlam ? 2.1 : 1.6);
      },
      cleanup: () => killDecal(decal),
    };
  }
  rush() {
    const st = { phase: 'wind', dashT: 0, base: 0, dir: new V3(), hits: [false, false, false] };
    const punches = [{ at: 0.12, pose: 'punchA', wind: 'rushW', hand: 'R', dmg: 12, kind: 'light' }, { at: 0.52, pose: 'punchB', wind: 'throwW', hand: 'L', dmg: 12, kind: 'light' }, { at: 0.95, pose: 'upper', wind: 'upperW', hand: 'R', dmg: 19, kind: 'launch' }];
    let decal = makeDecal(0xff4010, true);
    const decalG = new THREE.Group(); Render.scene.add(decalG); decalG.add(decal);
    decal.rotation.set(-Math.PI / 2, 0, Math.PI / 2); decal.position.set(0, 0.05, 6); decal.scale.set(12, 2.2, 1);
    return {
      update: (t, dt) => {
        if (st.phase === 'wind') {
          this.face(dt, 10); this.pose('rushW', 9); this.glowR = t / 0.6;
          decalG.position.set(this.pos.x, 0, this.pos.z); decalG.rotation.y = this.yaw;
          decal.material.uniforms.progress.value = t / 0.6; decal.material.uniforms.time.value = t;
          if (this.ev(0.38)) this.glint('R');
          if (t >= 0.6) {
            st.phase = 'dash'; st.dashT = 0; this.fwd(st.dir);
            killDecal(decal); decal = null; Render.scene.remove(decalG);
            Sfx.whoosh(0.6, 0.6); Sfx.fireball();
          }
          return false;
        }
        if (st.phase === 'dash') {
          st.dashT += dt;
          // light homing
          const to = this.toPlayer().normalize();
          const cur = yawOf(st.dir.x, st.dir.z), tgt = yawOf(to.x, to.z);
          const ny = cur + clamp(angleDiff(cur, tgt), -1.5 * dt, 1.5 * dt);
          dirOf(ny, st.dir); this.yaw = ny;
          this.pos.addScaledVector(st.dir, 26 * dt);
          this.pose('rush', 20);
          if (Math.random() < 0.9) FX.ghost(this.rig, 0xff5a20);
          FX.burst(this.pos.clone().setY(0.3), 3, { speed: 3, flat: true, life: 0.5, s0: 0.6, s1: 1.4, c0: C.dust, c1: C.dust, add: false, alpha: 0.35 });
          // body hit during dash
          const pl = G.player;
          if (!st.bodyHit && horizDist(pl.pos, this.pos) < 1.8 && pl.pos.y < 2.5) {
            st.bodyHit = true;
            const r = pl.tryHit(10, st.dir.clone(), 'light', this.pos);
          }
          if (this.distP() < 2.7 || st.dashT > 0.5) { st.phase = 'combo'; st.base = t; }
          return false;
        }
        // three-hit combo
        const ct = t - st.base;
        for (let i = 0; i < 3; i++) {
          const P = punches[i];
          if (ct > P.at - 0.3 && ct < P.at) { this.pose(P.wind, 14); this.face(dt, 5); this['glow' + P.hand] = 1; }
          if (this.prevAt - st.base < P.at - 0.17 && ct >= P.at - 0.17) this.glint(P.hand);
          if (this.prevAt - st.base < P.at && ct >= P.at) {
            this.pose(P.pose, 38);
            const f = this.fwd();
            this.knock.addScaledVector(f, 9);
            Sfx.whoosh(0.7, 0.5);
            const hc = this.pos.clone().addScaledVector(f, 1.9); hc.y = 1.4;
            FX.windBlade(hc.clone().setY(1.5), this.yaw, i === 2 ? 1.5 : i === 1 ? -0.3 : 0.3, 2.6, 0xff8a30, i === 2, i === 1, 1.5);
            st.active = i; st.activeT = 0.12;
          }
        }
        if (st.activeT > 0) {
          st.activeT -= dt;
          const i = st.active, P = punches[i];
          const f = this.fwd();
          const hc = this.pos.clone().addScaledVector(f, 1.9); hc.y = 1.3;
          const pl = G.player;
          if (!st.hits[i] && pl.state === 'attack' && pl.move && pl.st >= pl.move.a0 - 0.03 && pl.st <= pl.move.a1 + 0.03) {
            const pc = pl.pos.clone().addScaledVector(pl.fwd(), pl.move.reach); pc.y += 1.15;
            if (pc.distanceTo(hc) < 2.3) { st.hits[i] = true; pl.moveHit = true; this.clash(hc.clone().lerp(pc, 0.5), f); }
          }
          if (!st.hits[i] && playerOverlap(hc, 1.35)) {
            const res = G.player.tryHit(P.dmg, f.clone(), P.kind, hc);
            if (res) st.hits[i] = true;
            if (res === 'hit') { FX.hitSpark(G.player.chest(), f, P.kind !== 'light', true); Sfx.fireHit(); }
          }
        }
        if (ct > 1.0) this.glowL = this.glowR = 0;
        return ct >= 1.55;
      },
      cleanup: () => { killDecal(decal); Render.scene.remove(decalG); },
    };
  }
  eruption() {
    const n = this.phase === 2 ? 7 : 4, gap = this.phase === 2 ? 0.3 : 0.42;
    return {
      update: (t, dt) => {
        this.face(dt, 4); this.pose('channel', 8); this.glowL = this.glowR = 0.9;
        if (this.ev(0.05)) Sfx.roar();
        for (let i = 0; i < n; i++) {
          if (this.ev(0.35 + i * gap)) {
            const pl = G.player;
            const p = pl.pos.clone().addScaledVector(pl.vel, 0.3); p.y = 0;
            const r = Math.hypot(p.x, p.z); if (r > ARENA_R - 1) p.multiplyScalar((ARENA_R - 1) / r);
            G.hazards.push(new Pillar(p, 0.85, 17));
          }
        }
        if (Math.random() < 0.5) { const h = this.rig.handPos(Math.random() < 0.5 ? 'L' : 'R'); FX.add_.spawn(h.x, h.y, h.z, rand(-1, 1), rand(3, 6), rand(-1, 1), 0.6, 0.5, 0.05, C.fireHot, C.ember, 1, 0); }
        return t >= 0.35 + n * gap + 0.9;
      },
    };
  }
  leap() {
    const st = { start: new V3(), tgt: new V3(), T: 0.95, landed: false };
    let shadow = null;
    return {
      update: (t, dt) => {
        if (t < 0.45) { this.face(dt, 8); this.pose('crouch', 10); this.glowL = this.glowR = t / 0.45; return false; }
        if (this.ev(0.45)) {
          st.start.copy(this.pos); st.tgt.copy(G.player.pos).setY(0);
          shadow = makeDecal(0xff4010); shadow.scale.setScalar(8.4);
          Sfx.bigWhoosh(); FX.shake(0.3);
          FX.burst(this.pos.clone().setY(0.2), 20, { speed: 8, flat: true, life: 0.6, s0: 0.8, s1: 1.8, c0: C.dust, c1: C.dust, add: false, alpha: 0.4 });
        }
        const k = clamp((t - 0.45) / st.T, 0, 1);
        if (!st.landed) {
          if (k < 0.5) {
            const pp = G.player.pos;
            const dx = pp.x - st.tgt.x, dz = pp.z - st.tgt.z, dl = Math.hypot(dx, dz), mx = 11 * dt;
            if (dl > 0.001) { st.tgt.x += dx / dl * Math.min(dl, mx); st.tgt.z += dz / dl * Math.min(dl, mx); }
          }
          this.pos.x = lerp(st.start.x, st.tgt.x, k); this.pos.z = lerp(st.start.z, st.tgt.z, k);
          this.pos.y = 4 * 8.5 * k * (1 - k);
          this.yaw = dampAngle(this.yaw, yawOf(st.tgt.x - st.start.x, st.tgt.z - st.start.z), 8, dt);
          this.pose('leap', 10);
          if (shadow) { shadow.position.set(st.tgt.x, 0.05, st.tgt.z); shadow.material.uniforms.progress.value = k; shadow.material.uniforms.time.value = t; }
          if (k >= 1) {
            st.landed = true; this.pos.y = 0; killDecal(shadow); shadow = null;
            this.pose('slam', 40);
            const c = this.pos.clone();
            FX.shake(clamp(1 - this.distP() * 0.04, 0.3, 1)); Sfx.boom(1.1); Render.post.aberr = 1;
            FX.groundRing(c, 7, 0xff8030, 0.4); FX.groundRing(c, 4.5, 0xffd080, 0.3, 0.6);
            FX.burst(c.clone().setY(0.3), 60, { speed: 16, flat: true, life: 0.6, s0: 0.7, c0: C.fireHot, c1: C.ember, drag: 3 });
            FX.burst(c.clone().setY(0.5), 20, { speed: 6, flat: true, life: 1.3, s0: 1.2, s1: 3, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.45, up: 1 });
            const pl = G.player;
            if (horizDist(pl.pos, c) < 4.2 && pl.pos.y < 2.5) {
              const dir = new V3(pl.pos.x - c.x, 0, pl.pos.z - c.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize();
              const r = pl.tryHit(22, dir, 'launch', c);
              if (r === 'hit') FX.hitSpark(pl.chest(), dir, true, true);
            }
            G.hazards.push(new FireRing(c, 13, 11, 12, 1.0));
            FX.shockwave(c.clone().setY(0.5), 0.9, 1.8, 0.7); World.crater(c, 8.5); World.damageAt(c, 5, 250); Cam.dutch(-0.1);
            FX.impactLines(c.clone().setY(1), 16, 0xffb060, 6, 0.25);
            this.glowL = this.glowR = 0;
            st.landT = t;
          }
          return false;
        }
        if (t - st.landT > 0.25) this.pose('idle', 5);
        return t - st.landT > 0.75;
      },
      cleanup: () => { killDecal(shadow); if (this.pos.y > 0 && this.state !== 'held') this.pos.y = 0; },
    };
  }
  spiral() {
    const beams = [], decals = [];
    const LEN = 14, SPIN = 2.5, t0 = 0.95, T = 2.7;
    const grp = new THREE.Group(); Render.scene.add(grp);
    for (let i = 0; i < 2; i++) {
      const dg = new THREE.Group(); const d = makeDecal(0xff4010, true);
      Render.scene.remove(d); dg.add(d); d.rotation.set(-Math.PI / 2, 0, Math.PI / 2); d.position.set(0, 0.05, LEN / 2); d.scale.set(LEN, 1.8, 1);
      grp.add(dg); decals.push(dg);
      const mat = swirlMaterial(0xffd070, 0xff3000, { twist: 0, speed: 9, bands: 8, edge: 0.0 });
      const g = new THREE.CylinderGeometry(0.55, 0.8, LEN, 16, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, LEN / 2);
      const m = new THREE.Mesh(g, mat); m.position.y = 0.9; m.visible = false; m.renderOrder = 16;
      const bg = new THREE.Group(); bg.add(m); grp.add(bg);
      beams.push({ g: bg, m, mat, cd: 0 });
    }
    let a0 = 0;
    return {
      update: (t, dt) => {
        grp.position.set(this.pos.x, 0, this.pos.z);
        if (t < t0) {
          this.face(dt, 6); this.pose('spinArms', 8); this.glowL = this.glowR = t / t0;
          a0 = this.yaw + Math.PI / 2;
          for (let i = 0; i < 2; i++) { decals[i].rotation.y = a0 + i * Math.PI; const u = decals[i].children[0].material.uniforms; u.progress.value = t / t0; u.time.value = t; }
          return false;
        }
        if (this.ev(t0)) { for (const d of decals) { killDecal(d.children[0]); } for (const b of beams) b.m.visible = true; Sfx.roar(); Sfx.fireball(); FX.shake(0.4); }
        const k = (t - t0) / T;
        const ang = a0 + (t - t0) * SPIN;
        this.yaw = ang - Math.PI / 2;
        this.pose('spinArms', 20);
        const fade = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1;
        const pl = G.player;
        for (let i = 0; i < 2; i++) {
          const b = beams[i], a = ang + i * Math.PI;
          b.g.rotation.y = a; b.mat.uniforms.time.value = t; b.mat.uniforms.opacity.value = fade;
          b.m.scale.set(1 + Math.sin(t * 30) * 0.08, 1 + Math.sin(t * 30) * 0.08, 1);
          b.cd -= dt;
          const ex = this.pos.x + Math.sin(a) * LEN, ez = this.pos.z + Math.cos(a) * LEN;
          if (Math.random() < 0.8) { const f = rand(0.1, 1); FX.add_.spawn(lerp(this.pos.x, ex, f), 0.9, lerp(this.pos.z, ez, f), rand(-1, 1), rand(1, 3), rand(-1, 1), 0.4, 0.6, 0.05, C.fireHot, C.ember, 2, -1); }
          if (fade > 0.5 && b.cd <= 0 && pl.pos.y < 1.55 && seg2Dist(pl.pos.x, pl.pos.z, this.pos.x, this.pos.z, ex, ez) < 0.95) {
            const dir = new V3(Math.cos(a), 0, -Math.sin(a));
            const r = pl.tryHit(15, dir, 'heavy', pl.pos);
            if (r) b.cd = 0.6;
            if (r === 'hit') { FX.hitSpark(pl.chest(), dir, true, true); Sfx.fireHit(); }
          }
        }
        return k >= 1;
      },
      cleanup: () => {
        for (const d of decals) killDecal(d.children[0]);
        for (const b of beams) { b.mat.dispose(); b.m.geometry.dispose(); }
        Render.scene.remove(grp);
        this.glowL = this.glowR = 0;
      },
    };
  }

  clash(at, f) {
    const pl = G.player;
    Sfx.clash(); hitstop(0.12); slowmo(0.2, 0.4); FX.shake(0.7);
    Render.post.flash = 0.35; Render.post.aberr = 1.5;
    FX.star(at, 5, 0xfff0c0, 0.25); FX.impactLines(at, 22, 0xfff0d0, 5, 0.3); FX.shockwave(at, 0.6, 1.5);
    FX.burst(at, 40, { speed: 18, life: 0.5, s0: 0.35, c0: C.fireHot, c1: C.ember }); FX.burst(at, 40, { speed: 18, life: 0.5, s0: 0.35, c0: C.white, c1: C.wind });
    FX.popup(at.clone().add(new V3(0, 0.8, 0)), 'CLASH!', 'break', Render.camera);
    this.knock.addScaledVector(f, -7);
    pl.vel.x = f.x * 12; pl.vel.z = f.z * 12; pl.toMove();
    pl.gainFlow(12); this.posture += 12; this.postureDelay = 1.6;
    Cam.impactShot(at, new V3(-f.z, 0, f.x), 0.6, 4.5);
    G.stats.clashes = (G.stats.clashes || 0) + 1;
    Blitz.maybe(at);
  }
  meteor() {
    const n = 9, gap = 0.26, t0 = 0.7;
    return {
      update: (t, dt) => {
        this.face(dt, 5);
        this.pose(t < t0 ? 'slamW' : 'roar', 8); this.glowL = this.glowR = 1;
        if (this.ev(0.1)) { Sfx.roar(); HUD.say('VARUKH', pick(['Let the heavens fall!', 'Kneel beneath the burning sky!']), 2); }
        if (t < t0 && Math.random() < 0.9) { const h = this.rig.handPos('R'); FX.add_.spawn(h.x, h.y, h.z, rand(-1, 1), rand(10, 18), rand(-1, 1), 0.5, 0.6, 0.1, C.fireHot, C.ember, 0, 0); }
        for (let i = 0; i < n; i++) {
          if (this.ev(t0 + i * gap)) {
            const pl = G.player;
            const p = i % 3 === 0 ? pl.pos.clone().addScaledVector(pl.vel, 0.5) : pl.pos.clone().add(new V3(rand(-7, 7), 0, rand(-7, 7)));
            p.y = 0; const r = Math.hypot(p.x, p.z); if (r > ARENA_R - 1) p.multiplyScalar((ARENA_R - 1) / r);
            G.hazards.push(new Meteor(p, 1.0));
          }
        }
        return t >= t0 + n * gap + 1.4;
      },
    };
  }
  beam() {
    const st = { started: false, init: false };
    return {
      update: (t, dt) => {
        if (!st.init) {
          st.init = true;
          CutIn.play(this.rig, 'boss', 'PYRE LANCE', 'A BEAM THAT ENDS ARGUMENTS', 1.0); FX.speedBg(1.1, true);
          HUD.say('VARUKH', Hero.is('wind') ? 'Burn away, little breeze!' : 'Burn away!', 2);
          Sfx.roar();
        }
        this.face(dt, 8);
        if (!st.started) {
          this.pose('throwW', 8); this.glowR = clamp(t / 1.1, 0, 1);
          if (Math.random() < 0.9) FX.burst(this.rig.handPos('R', new V3()), 2, { speed: 5, life: 0.4, s0: 0.4, c0: C.fireHot, c1: C.ember });
          if (t < 1.15) return false;
          const pl = G.player;
          if (!pl.alive || ['special', 'dead'].includes(pl.state)) return true;
          st.started = true; BeamStruggle.start(this, st);
          return false;
        }
        const done = BeamStruggle.update(dt);
        return done && t > 1.2;
      },
      cleanup: () => BeamStruggle.end(BeamStruggle.st),
    };
  }
  nova() {
    const st = { sun: null, decals: [], fired: false, start: this.pos.clone(), init: false };
    const T_RISE = 1.2, T_FIRE = 4.6;
    return {
      update: (t, dt) => {
        if (!st.init) {
          st.init = true;
          CutIn.play(this.rig, 'boss', 'CINDER NOVA', 'ULTIMATE · THE SKY ITSELF BURNS', 1.3); FX.speedBg(1.4, true);
          setTimeout(() => HUD.say('VARUKH', 'There is nowhere the wind can hide!', 2.6), 600);
          Sfx.roar();
          const g = new THREE.Group();
          const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
          const shell = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), swirlMaterial(0xffb040, 0xff3000, { twist: 2, speed: 2, bands: 6, edge: 0.0, opacity: 0.9 }));
          const glow = new THREE.Mesh(FX.planeGeo, glowMaterial(0xff7020, 0.55)); glow.scale.setScalar(5);
          g.add(core, shell, glow); g.scale.setScalar(0.01);
          Render.scene.add(g); st.sun = { g, core, shell, glow };
          const big = makeDecal(0xff3010); big.scale.setScalar(ARENA_R * 2); big.position.set(0, 0.04, 0); st.decals.push(big);
        }
        const prog = clamp((t - T_RISE) / (T_FIRE - T_RISE), 0, 1);
        // rise to the center of the sky
        const k = clamp(t / T_RISE, 0, 1);
        this.pos.x = lerp(st.start.x, 0, easeOutF(k)); this.pos.z = lerp(st.start.z, 0, easeOutF(k));
        this.pos.y = easeOutF(k) * 6 + Math.sin(t * 3) * 0.2 * k;
        this.face(dt, 4);
        this.pose('roar', 6); this.glowL = this.glowR = 1;
        if (st.sun) {
          const S = st.sun;
          S.g.position.set(this.pos.x, this.pos.y + 5.5, this.pos.z);
          const sc = 0.2 + prog * 3.2; S.g.scale.setScalar(sc);
          S.shell.material.uniforms.time.value = t; S.glow.quaternion.copy(Render.camera.quaternion);
          const flashing = t > T_FIRE - 0.45;
          S.core.material.color.set(flashing && Math.floor(t * 20) % 2 ? 0xffffff : 0xfff2c0);
          if (Math.random() < 0.9) { const a = rand(0, TAU), r = rand(6, 14); FX.add_.spawn(S.g.position.x + Math.cos(a) * r, S.g.position.y + rand(-6, 6), S.g.position.z + Math.sin(a) * r, -Math.cos(a) * r * 1.5, rand(-3, 3), -Math.sin(a) * r * 1.5, 0.6, 0.5, 0.1, C.fireHot, C.ember, 0, 0); }
          this.light.intensity = 8 + prog * 14;
        }
        const big = st.decals[0];
        if (big) { big.material.uniforms.progress.value = prog; big.material.uniforms.time.value = t; }
        // safe zones behind standing pillars
        if (this.ev(T_RISE)) {
          const standing = World.dpillars.filter(P => !P.broken);
          for (const P of standing) {
            const d = new V3(P.x, 0, P.z).normalize();
            const grp = new THREE.Group(); grp.position.set(P.x, 0, P.z); grp.rotation.y = yawOf(d.x, d.z);
            const dc = new THREE.Mesh(FX.planeGeo, decalMaterial(0x30e8ff, true)); dc.rotation.set(-Math.PI / 2, 0, Math.PI / 2); dc.position.set(0, 0.06, 3.2); dc.scale.set(4.6, 2.0, 1);
            grp.add(dc); Render.scene.add(grp); st.decals.push(grp);
          }
          HUD.prompt(standing.length ? 'TAKE COVER BEHIND A PILLAR' : 'DODGE AT THE FLASH', standing.length ? 'move' : 'dash', T_FIRE - T_RISE + 0.3);
        }
        for (const d of st.decals) if (d.children && d.children[0] && d.children[0].material.uniforms) { const u = d.children[0].material.uniforms; u.progress.value = prog; u.time.value = t; }
        if (this.ev(T_FIRE - 0.45)) { Sfx.glint(); Sfx.ting(800); }
        if (!st.fired && t >= T_FIRE) {
          st.fired = true;
          const c = st.sun.g.position.clone();
          Sfx.boom(2); Sfx.roar(); FX.shake(1.2); hitstop(0.1);
          Render.post.flash = 0.4; Render.post.impact = 0.8; Render.post.aberr = 2;
          FX.shockwave(new V3(0, 1, 0), 1.4, 2.5, 1.0); FX.shockwave(c, 1.0, 2, 0.8);
          FX.burst(c, 120, { speed: 40, life: 0.8, s0: 0.6, c0: C.fireHot, c1: C.ember, drag: 1.5 });
          for (let i = 0; i < 40; i++) { const a = rand(0, TAU), r = rand(2, ARENA_R); FX.burst(new V3(Math.cos(a) * r, 0.3, Math.sin(a) * r), 3, { speed: 6, dir: new V3(0, 1, 0), spread: 0.5, life: 0.8, s0: 0.8, c0: C.fireHot, c1: C.ember }); }
          FX.groundRing(new V3(0, 0, 0), ARENA_R + 2, 0xff7020, 0.8, 0.9);
          // who is shielded?
          const pl = G.player;
          const ox = this.pos.x, oz = this.pos.z;
          let cover = null;
          for (const P of World.dpillars) {
            if (P.broken) continue;
            const along = (P.x - ox) * (pl.pos.x - ox) + (P.z - oz) * (pl.pos.z - oz);
            if (along > 0 && Math.hypot(P.x - ox, P.z - oz) < Math.hypot(pl.pos.x - ox, pl.pos.z - oz) && seg2Dist(P.x, P.z, ox, oz, pl.pos.x, pl.pos.z) < P.r + 0.35) cover = P;
          }
          if (cover) { FX.popup(pl.chest().add(new V3(0, 1, 0)), 'SHIELDED', 'tag', Render.camera); G.stats.covered = 1; }
          else {
            const dir = new V3(pl.pos.x - ox, 0, pl.pos.z - oz).normalize();
            const r = pl.tryHit(45, dir, 'launch', pl.pos);
            if (r === 'hit') FX.hitSpark(pl.chest(), dir, true, true);
          }
          World.damageAt(new V3(0, 0, 0), ARENA_R + 5, 999);
          World.crater(new V3(0, 0, 0), 16);
          for (const d of st.decals) { if (d.isMesh) killDecal(d); else { Render.scene.remove(d); d.traverse(o => o.material && o.material.dispose && o.material.dispose()); } }
          st.decals.length = 0;
          const S = st.sun; FX.add(null, 0.5, (e, k) => { S.g.scale.setScalar(3.4 + k * 12); S.shell.material.uniforms.opacity.value = 1 - k; S.glow.material.uniforms.opacity.value = 0.55 * (1 - k); S.core.visible = k < 0.3; if (k >= 1) Render.scene.remove(S.g); });
          st.sun = null;
        }
        if (st.fired) {
          this.pos.y = Math.max(0, this.pos.y - dt * 9);
          this.pose('stagger', 6);
          if (this.pos.y <= 0 && t > T_FIRE + 0.8) { this.state = 'stagger'; this.st = 0.2; this.atk = null; HUD.say(Hero.def.name, 'He\'s spent. Now!', 2); return false; }
        }
        return false;
      },
      cleanup: () => {
        for (const d of st.decals) { if (d.isMesh) killDecal(d); else Render.scene.remove(d); }
        if (st.sun) Render.scene.remove(st.sun.g);
        if (this.state !== 'held') this.pos.y = 0;
      },
    };
  }

  /* ---------------- phase 2 transition ---------------- */
  startTransition() {
    G.reachedP2 = true;
    this.pendingPhase = false;
    this.cancelAttack();
    this.pos.y = 0;
    this.state = 'transition'; this.st = 0; this.roared = false;
    const b = this, a0 = Cam.yaw;
    Cam.shot(3.2, (k) => { const a = a0 + 0.8 - k * 1.1; const d = 7 - k * 1.5; return { pos: new V3(b.pos.x + Math.sin(a) * d, 0.7 + k * 0.6, b.pos.z + Math.cos(a) * d), look: b.chest(new V3()).setY(2.4), fov: 55 }; }, { out: 0.4 });
    HUD.banner('', '');
    CutIn.play(this.rig, 'boss', 'VARUKH', 'THE PYRE AWAKENS', 1.3); FX.speedBg(1.3, true); Sfx.riser && Sfx.riser(1.4);
    setTimeout(() => HUD.say('VARUKH', pick(['Enough! Feel the true heat of the pyre!', 'You fan the flames, little breeze. Now burn!']), 3), 900);
  }
  updTransition(dt) {
    const t = this.st;
    this.face(dt, 4);
    if (t < 1.4) { this.pose('crouch', 6); this.glowL = this.glowR = t / 1.4; if (Math.random() < 0.8) FX.burst(this.chest(), 2, { speed: 4, life: 0.6, s0: 0.5, c0: C.fireHot, c1: C.ember, up: 2 }); }
    else {
      this.pose('roar', 10);
      if (!this.roared) {
        this.roared = true; this.phase = 2;
        Sfx.roar(); Sfx.boom(1.2);
        FX.shake(1.1); Render.post.flash = 0.18; Render.post.impact = 0.3; Render.post.aberr = 1.2;
        World.mixTarget = 1; Sfx.intensity = 2;
        const c = this.pos.clone();
        FX.groundRing(c, 18, 0xff6a20, 0.8, 0.8); FX.groundRing(c, 10, 0xffd080, 0.6, 0.7);
        FX.burst(this.chest(), 60, { speed: 26, life: 0.7, s0: 0.4, c0: C.fireHot, c1: C.ember, drag: 2 });
        const pl = G.player;
        const dir = new V3(pl.pos.x - c.x, 0, pl.pos.z - c.z); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize();
        if (pl.alive && pl.state !== 'special') pl.knockback(dir, clamp(16 - horizDist(pl.pos, c), 4, 14));
        HUD.banner('VARUKH UNLEASHES THE PYRE', 'phase');
        FX.shockwave(this.chest(), 1.0, 2.2, 0.9); World.crater(c, 10); World.damageAt(c, 30, 45);
      }
      if (Math.random() < 0.9) FX.burst(this.chest(), 3, { speed: 12, life: 0.6, s0: 0.5, c0: C.fireHot, c1: C.ember });
    }
    if (t > 3.1) { this.state = 'idle'; this.st = 0; this.cool = 0.5; this.glowL = this.glowR = 0; }
  }
  updDead(dt) {
    const t = this.st;
    this.pose('dead', 4);
    this.pos.y = Math.max(0, this.pos.y - dt * 15);
    if (t > 1.2 && t < 3.2) {
      const k = (t - 1.2) / 2;
      this.rig.root.scale.setScalar(BOSS_SCALE * (1 - k * 0.15));
      for (let i = 0; i < 10; i++) { const c = this.chest(); FX.add_.spawn(c.x + rand(-1, 1), c.y + rand(-1.8, 1), c.z + rand(-1, 1), rand(-1, 1), rand(1, 5), rand(-1, 1), 1.4, 0.35, 0.05, C.fireHot, C.ember, 0.5, -1); }
      this.rig.crackMat.color.setRGB(1, 0.6 + k * 0.4, 0.3 + k * 0.6);
    }
    if (t > 3.2 && this.rig.root.visible) {
      this.rig.root.visible = false; for (const c of this.rig.chains) c.ribbon.mesh.visible = false;
      const c = this.chest();
      FX.burst(c, 90, { speed: 14, life: 1.3, s0: 0.4, c0: C.fireHot, c1: C.ember, drag: 1.5, up: 2 });
      FX.burst(c, 30, { speed: 4, life: 2, s0: 1.5, s1: 3.5, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.4, up: 2 });
      FX.ringBill(c, 8, 0xffaa55, 0.6); Sfx.boom(1.3); FX.shake(0.6);
    }
  }
  lateUpdate(dt, cam) { if (this.rig.root.visible) updateRigChains(this.rig, dt, cam); }
}
