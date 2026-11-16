'use strict';
/* ============================================================
   Projectiles + hazards shared by both fighters
   ============================================================ */
const G = {
  proj: [], hazards: [], lockOn: true, timeScale: 1, tsTarget: 1, slowT: 0,
  bossScale: 1, bossScaleTarget: 1, hitstop: 0, time: 0, state: 'title',
  stats: null,
};

function hitstop(s) { if (G.mode === 'duel') s = Math.min(s, 0.16); G.hitstop = Math.max(G.hitstop, s); }
function slowmo(scale, dur) {
  // in a duel the other player keeps real time, so slow-motion is only a short accent
  if (G.mode === 'duel') { scale = Math.max(scale, 0.7); dur *= 0.4; } G.tsTarget = scale; G.timeScale = Math.min(G.timeScale, scale); G.slowT = Math.max(G.slowT, dur); }

/* player hurtbox test: sphere vs player capsule */
function playerOverlap(c, r) {
  const p = G.player;
  _hpA.set(p.pos.x, p.pos.y + 0.25, p.pos.z); _hpB.set(p.pos.x, p.pos.y + 1.45, p.pos.z);
  return segPointDist(c, _hpA, _hpB) < r + 0.42;
}
const _hpA = new V3(), _hpB = new V3();

class Projectile {
  constructor(o) {
    this.pos = o.pos.clone(); this.vel = o.vel.clone();
    this.r = o.r; this.owner = o.owner; this.dmg = o.dmg; this.post = o.post || 0;
    this.life = o.life; this.kind = o.kind; this.hits = o.hits || 1; this.tick = o.tick || 0;
    this.tickT = 0; this.dead = false; this.age = 0; this.dodged = false; this.reflected = false;
    this.grav = o.grav || 0; this.knock = o.knock || null; this.big0 = !!o.big;
    this.obj = new THREE.Group();
    this.obj.position.copy(this.pos);
    Render.scene.add(this.obj);
    this.build();
  }
  build() {
    const k = this.kind;
    if (k === 'fireball') {
      this.core = new THREE.Mesh(new THREE.SphereGeometry(this.r * 0.75, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
      this.shell = new THREE.Mesh(new THREE.SphereGeometry(this.r * 1.05, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.glow = new THREE.Mesh(FX.planeGeo, glowMaterial(0xff7a20, 0.9));
      this.glow.scale.setScalar(this.r * 6);
      this.obj.add(this.core, this.shell, this.glow);
    } else if (k === 'gust') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 6, 20), new THREE.MeshBasicMaterial({ color: HC.pale, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      const m2 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 24), m.material);
      this.rings = [m, m2];
      this.obj.add(m, m2);
      this.glow = new THREE.Mesh(FX.planeGeo, glowMaterial(0x66ffee, 0.6)); this.glow.scale.setScalar(3); this.obj.add(this.glow);
    } else if (k === 'lance') {
      this.swirl = swirlMaterial(0xeaffff, 0x2aa8ff, { twist: 3, speed: 6, bands: 3, edge: 0.2, opacity: 1 });
      const g = new THREE.CylinderGeometry(this.r * 0.55, this.r * 1.25, 4.2, 20, 1, true);
      g.rotateX(Math.PI / 2);
      this.cyl = new THREE.Mesh(g, this.swirl);
      this.cyl2 = new THREE.Mesh(g, swirlMaterial(0xffffff, 0x40ffe0, { twist: -2, speed: -8, bands: 2, edge: 0.2, opacity: 0.6 }));
      this.cyl2.scale.setScalar(0.7);
      this.obj.add(this.cyl, this.cyl2);
      this.glow = new THREE.Mesh(FX.planeGeo, glowMaterial(0x80ffff, 0.8)); this.glow.scale.setScalar(this.r * 5); this.obj.add(this.glow);
      this.obj.lookAt(this.pos.clone().add(this.vel));
    } else if (k === 'firebolt') {
      this.core = new THREE.Mesh(new THREE.SphereGeometry(this.r * 0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
      const tail = new THREE.ConeGeometry(this.r * 0.7, this.r * 4, 10, 1, true); tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -this.r * 2);
      this.shell = new THREE.Mesh(tail, new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.glow = new THREE.Mesh(FX.planeGeo, glowMaterial(0xff8a30, 0.9)); this.glow.scale.setScalar(this.r * 5);
      this.obj.add(this.core, this.shell, this.glow);
      this.obj.lookAt(this.pos.clone().add(this.vel));
    } else if (k === 'boulder') {
      const g = new THREE.DodecahedronGeometry(this.r, 0);
      this.rock = new THREE.Mesh(g, toon(0x8a7560));
      this.rock.userData.ownGeo = true;
      this.obj.add(this.rock);
    } else if (k === 'jet') {
      this.swirl = swirlMaterial(0xf0ffff, 0x2a7cff, { twist: 4, speed: 10, bands: 4, edge: 0.2, opacity: 1 });
      const g = new THREE.CylinderGeometry(this.r * 0.45, this.r * 0.9, 5, 16, 1, true); g.rotateX(Math.PI / 2);
      this.cyl = new THREE.Mesh(g, this.swirl);
      this.glow = new THREE.Mesh(FX.planeGeo, glowMaterial(0x60b0ff, 0.8)); this.glow.scale.setScalar(this.r * 4);
      this.obj.add(this.cyl, this.glow);
      this.obj.lookAt(this.pos.clone().add(this.vel));
    }
  }
  deflect() {
    const b = G.boss;
    this.owner = 'player'; this.reflected = true; this.dodged = false;
    const tgt = b.chest(new V3());
    this.vel.subVectors(tgt, this.pos).normalize().multiplyScalar(34);
    this.dmg = Math.round(this.dmg * 2.4); this.post = 16; this.life = 1.2; this.grav = 0;
    this.core.material.color.set(HC.glow);
    this.shell.material.color.set(0x30d0ff);
    this.glow.material.uniforms.color.value.set(0x60e0ff);
  }
  update(dt, cam) {
    if (this.dead) return;
    this.age += dt; this.life -= dt;
    this.vel.y -= this.grav * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.obj.position.copy(this.pos);
    if (this.glow) this.glow.quaternion.copy(cam.quaternion);
    const k = this.kind;
    if (k === 'fireball') {
      const s = 1 + Math.sin(this.age * 40) * 0.08; this.shell.scale.setScalar(s);
      const n = dt > 0 ? 3 : 0;
      for (let i = 0; i < n; i++) {
        const rf = this.reflected;
        FX.add_.spawn(this.pos.x + rand(-0.2, 0.2), this.pos.y + rand(-0.2, 0.2), this.pos.z + rand(-0.2, 0.2), -this.vel.x * 0.1 + rand(-1, 1), rand(0, 1.5), -this.vel.z * 0.1 + rand(-1, 1), 0.35, this.r * 1.6, 0.05, rf ? C.white : C.fireHot, rf ? C.windDeep : C.ember, 2, -1);
      }
    } else if (k === 'gust') {
      this.rings[0].rotation.z += dt * 20; this.rings[1].rotation.z -= dt * 14;
      this.obj.lookAt(this.pos.x + this.vel.x, this.pos.y + this.vel.y, this.pos.z + this.vel.z);
      const s = 1 + this.age * 1.5; this.obj.scale.setScalar(s);
      if (dt > 0) FX.burst(this.pos, 2, { speed: 3, life: 0.3, s0: 0.25, c0: C.white, c1: C.windDeep, jitter: 0.5 });
    } else if (k === 'lance') {
      this.swirl.uniforms.time.value += dt; this.cyl2.material.uniforms.time.value += dt;
      this.cyl.rotation.z += dt * 12;
      if (dt > 0) FX.burst(this.pos, 4, { speed: 6, life: 0.35, s0: 0.35, c0: C.white, c1: C.wind, jitter: this.r });
      const sc = Math.min(1, this.age * 8); this.obj.scale.setScalar(sc);
    } else if (k === 'firebolt') {
      if (dt > 0) FX.add_.spawn(this.pos.x + rand(-0.15, 0.15), this.pos.y + rand(-0.15, 0.15), this.pos.z + rand(-0.15, 0.15), -this.vel.x * 0.08, rand(0, 1.2), -this.vel.z * 0.08, 0.3, this.r * 1.4, 0.05, C.fireHot, C.ember, 2, -1);
    } else if (k === 'boulder') {
      this.rock.rotation.x += dt * 9; this.rock.rotation.y += dt * 4;
      if (dt > 0 && Math.random() < 0.5) FX.burst(this.pos, 1, { speed: 2, life: 0.5, s0: 0.4, s1: 0.9, c0: C.dust, c1: C.dust, add: false, alpha: 0.4 });
    } else if (k === 'jet') {
      this.swirl.uniforms.time.value += dt;
      if (dt > 0) FX.burst(this.pos, 3, { speed: 5, life: 0.35, s0: 0.3, c0: C.white, c1: C.windDeep, jitter: this.r, grav: 12 });
      const sc = Math.min(1, this.age * 10); this.obj.scale.setScalar(sc);
    }
    // collisions
    const b = G.boss, p = G.player;
    if (this.owner === 'boss') {
      if (!this.dodged && playerOverlap(this.pos, this.r)) {
        const dir = this.vel.clone().setY(0).normalize();
        const res = p.tryHit(this.dmg, dir, 'light', this.pos);
        if (res === 'hit') { FX.hitSpark(this.pos, dir, false, true); Sfx.fireHit(); return this.explode(); }
        if (res === 'dodged' || res === 'immune') this.dodged = true;
      }
    } else if (this.owner === 'player' && b.alive) {
      const d = segPointDist(this.pos, b.capA, b.capB);
      if (d < this.r + b.radius) {
        if (k === 'jet' && !this.slowed) { this.slowed = true; this.vel.multiplyScalar(0.25); this.life += 0.25; }
        this.tickT -= dt;
        if (this.tickT <= 0) {
          this.tickT = this.tick;
          const dir = this.vel.clone().setY(0).normalize();
          const big = this.reflected || this.big0 || ((k === 'lance' || k === 'jet') && this.hits === 1);
          const res = b.takeDamage(this.dmg, this.post, this.pos, dir, { big, src: k, knock: this.knock });
          if (res) G.player.onDealtHit(res, this.pos.clone(), dir, big, (k === 'lance' || k === 'jet') && !big ? 0.04 : big ? 0.09 : 0.05, this.reflected ? 'reflect' : '');
          if (res && this.reflected) Moment.fire('RETURN TO SENDER', 'HIS OWN FLAME', this.pos.clone(), dir, 2);
          this.hits--;
          if (this.hits <= 0) return this.explode();
        }
      }
    }
    const PL = World.pillarAt(this.pos, this.r * 0.8);
    if (PL) {
      const d = this.vel.clone().setY(0).normalize(); World.hitPillar(PL, k === 'lance' || k === 'boulder' ? 70 : k === 'gust' || k === 'firebolt' ? 15 : k === 'jet' ? 30 : this.reflected ? 60 : 34, d, this.pos);
      // your wind brings a pillar down on him
      if (this.owner === 'player' && !this.netGhost && PL.broken && b.alive && Math.hypot(b.pos.x - PL.x, b.pos.z - PL.z) < PL.r + b.radius + 3.5) {
        const dir = new V3(b.pos.x - PL.x, 0, b.pos.z - PL.z).normalize();
        const res = b.takeDamage(38, 35, b.chest(new V3()), dir, { big: true, knock: 9, src: 'topple' });
        if (res) { G.player.onDealtHit(res, b.chest(new V3()), dir, true, 0.12, 'topple'); Moment.fire('TOPPLE', 'THE SPIRE FALLS ON HIM', b.chest(new V3()), dir, 2); }
      }
      if (this.kind === 'fireball') Sfx.fireHit(); return this.explode();
    }
    if (this.pos.y < 0.15 && this.vel.y < 0) { if (k === 'fireball') World.crater(this.pos, 2, true); return this.explode(); }
    if (this.life <= 0 || Math.hypot(this.pos.x, this.pos.z) > ARENA_R + 30) return this.explode(true);
  }
  explode(quiet) {
    if (this.dead) return;
    this.dead = true;
    const fire = (this.kind === 'fireball' || this.kind === 'firebolt') && !this.reflected;
    if (this.kind === 'boulder' && !quiet) { World.spawnDebris(this.pos.clone(), 6, 1.0, 'floor'); FX.burst(this.pos, 16, { speed: 6, life: 0.8, s0: 0.6, s1: 1.4, c0: C.dust, c1: C.dust, add: false, alpha: 0.5 }); FX.shake(0.35); Sfx.boom(0.6); }
    if (!quiet || this.kind === 'lance') {
      FX.burst(this.pos, fire ? 26 : 30, { speed: fire ? 9 : 12, life: 0.45, s0: 0.45, c0: fire ? C.fireHot : C.white, c1: fire ? C.ember : C.wind, drag: 4 });
      if (fire) FX.burst(this.pos, 8, { speed: 2, life: 0.9, s0: 0.8, s1: 1.8, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.4, up: 1.5 });
      FX.ringBill(this.pos, fire ? 2.4 : 3.2, fire ? 0xff8030 : HC.pale, 0.22);
    }
    Render.scene.remove(this.obj);
    this.obj.traverse(o => { if (o.material && o.material.dispose) o.material.dispose(); if (o.geometry && o.geometry !== FX.planeGeo) o.geometry.dispose(); });
  }
}

/* ---------- hazards (boss time scale) ---------- */
class FireRing {
  constructor(center, speed, maxR, dmg, height = 1.3) {
    this.c = center.clone(); this.c.y = 0; this.speed = speed; this.maxR = maxR; this.dmg = dmg; this.r = 0.5; this.done = false; this.hit = false; this.t = 0; this.h = height;
    this.mat = swirlMaterial(0xffc040, 0xff3a00, { twist: 0.35, speed: 2.5, bands: 90, edge: 0.1, opacity: 0.6 });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 96, 1, true), this.mat);
    this.mesh.position.set(this.c.x, height / 2, this.c.z);
    this.mesh.renderOrder = 16;
    this.ground = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(this.c.x, 0.05, this.c.z);
    Render.scene.add(this.mesh, this.ground);
  }
  update(dt) {
    this.t += dt;
    this.r += this.speed * dt;
    const fade = 1 - clamp((this.r - this.maxR * 0.75) / (this.maxR * 0.25), 0, 1);
    this.mesh.scale.set(this.r, 1, this.r);
    this.ground.scale.setScalar(this.r);
    this.mat.uniforms.time.value += dt; this.mat.uniforms.opacity.value = fade * 0.6;
    this.ground.material.opacity = 0.8 * fade;
    if (dt > 0) for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      FX.add_.spawn(this.c.x + Math.cos(a) * this.r, rand(0, this.h), this.c.z + Math.sin(a) * this.r, Math.cos(a) * 2, rand(1, 4), Math.sin(a) * 2, 0.4, 0.5 * fade, 0.05, C.fireHot, C.ember, 2, -2);
    }
    for (const P of World.dpillars) {
      if (P.broken || (this.hitP && this.hitP.has(P))) continue;
      if (Math.abs(Math.hypot(P.x - this.c.x, P.z - this.c.z) - this.r) < 1.0) { (this.hitP || (this.hitP = new Set())).add(P); World.hitPillar(P, 30, new V3(P.x - this.c.x, 0, P.z - this.c.z).normalize(), new V3(P.x, 0.8, P.z)); }
    }
    const p = G.player;
    if (!this.hit && fade > 0.3) {
      const d = horizDist(p.pos, this.c);
      if (Math.abs(d - this.r) < 0.7 && p.pos.y < this.h - 0.3) {
        const dir = new V3(p.pos.x - this.c.x, 0, p.pos.z - this.c.z).normalize();
        const res = p.tryHit(this.dmg, dir, 'launch', p.pos);
        if (res) { this.hit = true; if (res === 'hit') { FX.hitSpark(p.pos.clone().setY(1), dir, false, true); Sfx.fireHit(); } }
      }
    }
    if (this.r >= this.maxR) this.dispose();
  }
  dispose() { this.done = true; Render.scene.remove(this.mesh, this.ground); this.mat.dispose(); this.mesh.geometry.dispose(); this.ground.geometry.dispose(); this.ground.material.dispose(); }
}

class Pillar {
  constructor(pos, delay, dmg) {
    this.p = pos.clone(); this.p.y = 0; this.delay = delay; this.dmg = dmg; this.t = 0; this.done = false; this.hit = false; this.erupted = false;
    this.decal = new THREE.Mesh(FX.planeGeo, decalMaterial(0xff4a10));
    this.decal.rotation.x = -Math.PI / 2; this.decal.position.set(this.p.x, 0.04, this.p.z); this.decal.scale.setScalar(3.4);
    this.decal.renderOrder = 12;
    this.mat = swirlMaterial(0xffd060, 0xff3000, { twist: 4, speed: 5, bands: 5, edge: 0.08 });
    this.col = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 9, 24, 1, true), this.mat);
    this.col.position.set(this.p.x, 4.5, this.p.z); this.col.visible = false; this.col.renderOrder = 16;
    Render.scene.add(this.decal, this.col);
  }
  update(dt) {
    this.t += dt;
    const u = this.decal.material.uniforms;
    u.time.value += dt; u.progress.value = clamp(this.t / this.delay, 0, 1);
    if (!this.erupted && this.t >= this.delay) {
      this.erupted = true; this.col.visible = true;
      const near = horizDist(G.player.pos, this.p);
      FX.shake(clamp(0.5 - near * 0.03, 0.1, 0.5));
      Sfx.fireHit();
      FX.burst(this.p.clone().setY(0.3), 30, { speed: 12, dir: new V3(0, 1, 0), spread: 0.4, life: 0.6, s0: 0.6, c0: C.fireHot, c1: C.ember, drag: 2 });
      FX.burst(this.p.clone().setY(0.5), 10, { speed: 3, life: 1.2, s0: 1, s1: 2.5, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.45, up: 3 });
      FX.groundRing(this.p, 3, 0xff6a20, 0.4);
      World.crater(this.p, 3.4); World.damageAt(this.p, 1.6, 150); FX.shockwave(this.p.clone().setY(1), 0.3, 0.8);
    }
    if (this.erupted) {
      const k = (this.t - this.delay) / 0.7;
      this.col.scale.set(1 - k * 0.4, Math.min(1, k * 7), 1 - k * 0.4);
      this.col.position.y = 4.5 * Math.min(1, k * 7);
      this.mat.uniforms.time.value += dt; this.mat.uniforms.opacity.value = 1 - k;
      u.opacity.value = 1 - k;
      if (!this.hit && k < 0.45) {
        const p = G.player;
        if (horizDist(p.pos, this.p) < 1.55 && p.pos.y < 6) {
          const dir = new V3(p.pos.x - this.p.x, 0, p.pos.z - this.p.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize();
          const res = p.tryHit(this.dmg, dir, 'launch', p.pos);
          if (res) { this.hit = true; if (res === 'hit') FX.hitSpark(p.pos.clone().setY(1), dir, true, true); }
        }
      }
      if (k >= 1) this.dispose();
    }
  }
  dispose() { this.done = true; Render.scene.remove(this.decal, this.col); this.decal.material.dispose(); this.mat.dispose(); this.col.geometry.dispose(); }
}

class Meteor {
  constructor(p, delay) {
    this.p = p.clone(); this.delay = delay; this.t = 0; this.done = false; this.hit = false;
    this.decal = makeDecal(0xff4010); this.decal.position.set(p.x, 0.05, p.z); this.decal.scale.setScalar(4.6);
    const from = new V3(rand(-1, 1), 1, rand(-1, 1)).normalize().multiplyScalar(40);
    this.start = p.clone().add(from);
    this.rock = new THREE.Group();
    this.rock.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xffd080 })));
    this.glow = new THREE.Mesh(FX.planeGeo, glowMaterial(0xff6a20, 1)); this.glow.scale.setScalar(6); this.rock.add(this.glow);
    this.rock.position.copy(this.start);
    Render.scene.add(this.rock);
  }
  update(dt) {
    this.t += dt;
    const k = clamp(this.t / this.delay, 0, 1);
    const u = this.decal.material.uniforms; u.progress.value = k; u.time.value = this.t;
    this.rock.position.lerpVectors(this.start, this.p, k * k);
    this.rock.rotation.x += dt * 6; this.glow.quaternion.copy(Render.camera.quaternion);
    if (dt > 0) for (let i = 0; i < 4; i++) FX.add_.spawn(this.rock.position.x + rand(-0.4, 0.4), this.rock.position.y + rand(-0.4, 0.4), this.rock.position.z + rand(-0.4, 0.4), rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.5, 1.0, 0.1, C.fireHot, C.ember, 1, 0);
    if (k >= 1) {
      this.done = true;
      Render.scene.remove(this.rock); this.rock.traverse(o => { if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== FX.planeGeo) o.geometry.dispose(); });
      killDecal(this.decal);
      const c = this.p;
      Sfx.fireHit(); Sfx.boom(0.5);
      FX.shake(clamp(0.6 - horizDist(G.player.pos, c) * 0.03, 0.15, 0.6));
      FX.burst(c.clone().setY(0.4), 40, { speed: 13, life: 0.6, s0: 0.6, c0: C.fireHot, c1: C.ember });
      FX.burst(c.clone().setY(0.6), 10, { speed: 3, life: 1.3, s0: 1.2, s1: 2.6, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.45, up: 2 });
      FX.groundRing(c, 3.4, 0xff7020, 0.35); FX.shockwave(c.clone().setY(0.5), 0.3, 0.9);
      World.crater(c, 4); World.damageAt(c, 2.3, 140);
      const pl = G.player;
      if (horizDist(pl.pos, c) < 2.4 && pl.pos.y < 3) {
        const dir = new V3(pl.pos.x - c.x, 0, pl.pos.z - c.z); if (dir.lengthSq() < 0.01) dir.set(1, 0, 0); dir.normalize();
        const r = pl.tryHit(16, dir, 'launch', c);
        if (r === 'hit') FX.hitSpark(pl.chest(), dir, true, true);
      }
    }
  }
  dispose() { this.done = true; Render.scene.remove(this.rock); killDecal(this.decal); }
}

/* generic ground telegraph that a boss attack controls directly */
function makeDecal(color, rect) {
  const m = new THREE.Mesh(FX.planeGeo, decalMaterial(color, rect));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.renderOrder = 12;
  Render.scene.add(m);
  return m;
}
function killDecal(m) { if (!m) return; Render.scene.remove(m); m.material.dispose(); }
