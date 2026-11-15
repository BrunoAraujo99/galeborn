'use strict';
/* ============================================================
   Anime set pieces: awakened form, beam struggle, directed finisher,
   fight intro cards.
   ============================================================ */

/* ---------------- Awakened form: low-health power-up ---------------- */
const Awaken = {
  check() {
    const p = G.player, b = G.boss;
    if (G.state !== 'fight' || p.awake || !p.alive || p.hp >= 30) return;
    if (!['move', 'attack', 'dash', 'hit', 'down'].includes(p.state)) return;
    if (!b.alive || b.state === 'transition') return;
    this.start();
  },
  start() {
    const p = G.player;
    p.awake = true;
    const duel = G.mode === 'duel';
    p.hp = Math.min(p.maxHp, p.hp + (duel ? 12 : 25));
    p.flow = Math.max(p.flow, duel ? 35 : 50);
    p.invuln = Math.max(p.invuln, duel ? 1.0 : 1.6);
    if (duel) Duel.send({ t: 'cut', name: 'AWAKENING', sub: Hero.def.name + ' AWAKENS' });
    if (p.state === 'down' || p.state === 'hit') p.toMove();
    slowmo(0.25, 1.4);
    CutIn.play(p.rig, 'hero', 'AWAKENING', 'THE EYE OF THE STORM OPENS', 1.35);
    FX.speedBg(1.6); FX.eyeGlint(p.rig, HC.glow);
    setTimeout(() => HUD.say(Hero.def.name, Hero.def.lines.awaken, 2.8), 500);
    HUD.banner('AWAKENED', 'phase');
    Sfx.awaken(); Sfx.intensity = 3;
    const c = p.chest();
    FX.shockwave(c, 1, 2.2, 0.7); FX.impactLines(c, 26, HC.pale, 6, 0.4);
    FX.burst(c, 70, { speed: 16, life: 0.7, s0: 0.35, c0: C.white, c1: C.wind });
    FX.groundRing(p.pos.clone().setY(0.05), 9, HC.aura, 0.7, 0.8);
    Render.post.flash = 0.2; Render.post.aberr = 1.5;
    document.body.classList.add('awake');
    if (p.rig.model) p.rig.model.setAura(true);
    Sfx.loopOn('sfx_aura_loop', 0.35);
  },
  update(dt) {
    const p = G.player;
    if (!p.awake || !p.alive) return;
    // rising wind aura, drawn in chunky steps
    this.acc = (this.acc || 0) + dt;
    while (this.acc > 0.035) {
      this.acc -= 0.035;
      const a = rand(0, TAU), r = rand(0.25, 0.55);
      FX.add_.spawn(p.pos.x + Math.cos(a) * r, p.pos.y + rand(0.1, 1.7), p.pos.z + Math.sin(a) * r, Math.cos(a) * 0.6, rand(2.5, 4.5), Math.sin(a) * 0.6, 0.5, 0.22, 0.04, C.wind, C.windDeep, 1, -1, 0.9);
    }
    if (Math.random() < dt * 2.2) FX.groundRing(p.pos.clone().setY(0.05), 2.2, HC.aura, 0.45, 0.85);
  },
  reset() {
    G.player.awake = false;
    document.body.classList.remove('awake');
    if (G.player.rig.model) G.player.rig.model.setAura(false);
    Sfx.loopOff('sfx_aura_loop');
  },
};

/* ---------------- Beam struggle: wind lance vs pyre lance ---------------- */
function beamMesh(c0, c1, cc = 0xffffff) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1, 16, 1, true), swirlMaterial(c0, c1, { twist: 6, speed: 7, bands: 5, edge: 0.0, opacity: 0.85 }));
  core.position.y = shell.position.y = 0.5;
  core.renderOrder = 31; shell.renderOrder = 30;
  g.add(core, shell); g.userData.shell = shell;
  Render.scene.add(g);
  return g;
}
function placeBeam(g, a, b, t) {
  const d = b.clone().sub(a), len = d.length();
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  const w = 1 + Math.sin(t * 40) * 0.08;
  g.scale.set(w, Math.max(len, 0.01), w);
  g.userData.shell.material.uniforms.time.value = t;
}
const BeamStruggle = {
  st: null,
  start(boss, st) {
    const p = G.player;
    this.st = st;
    st.s = 0; st.t = 0; st.boss = boss;
    p.state = 'beam'; p.st = 0; p.buf = null; p.vel.set(0, Math.min(p.vel.y, 0), 0); p.faceBoss(true);
    st.fire = beamMesh(0xff8a20, 0xd02000, 0xffb060);
    st.wind = beamMesh(HC.aura, HC.beamEdge, HC.beamCore);
    const orb = new THREE.Mesh(FX.planeGeo, glowMaterial(0xffe6c8, 0.45)); orb.renderOrder = 45; Render.scene.add(orb); st.orb = orb;
    Sfx.boom(1.3); Sfx.clash(); Sfx.intensity = 3; Sfx.loopOn('sfx_beam_loop', 0.7);
    FX.shake(0.6); Render.post.flash = 0.25;
    FX.speedBg(7);
    HUD.say(Hero.def.name, 'Not this time!', 1.8);
    HUD.prompt('MASH TO OVERPOWER', 'light', 7);
    // side-on duel shot
    Cam.shot(8, (k, t) => {
      const bp = boss.pos.clone(), pp = p.pos.clone();
      const axis = new V3(bp.x - pp.x, 0, bp.z - pp.z); const L = axis.length(); axis.normalize();
      const side = new V3(-axis.z, 0, axis.x);
      const mid = pp.clone().lerp(bp, 0.5 + (st.s || 0) * 0.25);
      const sway = Math.sin(t * 0.6) * 0.15;
      return { pos: mid.clone().addScaledVector(side, Math.max(9, L * 1.05)).addScaledVector(axis, sway * 3).setY(1.6 + sway), look: mid.clone().setY(1.5), fov: 50 - Math.min(t, 6) * 1.2 };
    });
  },
  update(dt) {
    const st = this.st; if (!st) return true;
    const p = G.player, boss = st.boss;
    st.t += dt;
    if (p.state !== 'beam' || !p.alive) return this.finish(0);
    p.faceBoss(true);
    // boss pushes, player mashes
    st.s += dt * (0.3 + st.t * 0.04);
    if (p.buf === 'light' || p.buf === 'heavy' || p.buf === 'jump') {
      p.buf = null; st.s -= p.awake ? 0.11 : 0.085;
      Sfx.whoosh(1.6, 0.25); FX.shake(0.15);
      if (st.clash) FX.burst(st.clash, 8, { speed: 10, life: 0.35, s0: 0.3, c0: C.white, c1: C.wind });
    }
    const hb = boss.rig.handPos('R', new V3()), hp = p.rig.handPos('R', new V3());
    hp.lerp(p.rig.handPos('L', new V3()), 0.5);
    const clash = hp.clone().lerp(hb, clamp(0.5 - st.s * 0.42, 0.06, 0.94));
    st.clash = clash;
    placeBeam(st.fire, hb, clash, st.t); placeBeam(st.wind, hp, clash, st.t + 1.3);
    st.orb.position.copy(clash); st.orb.quaternion.copy(Render.camera.quaternion);
    const pulse = 1.5 + Math.sin(st.t * 30) * 0.25 + Math.abs(st.s) * 0.5; st.orb.scale.setScalar(pulse);
    if (Math.random() < 0.6) FX.burst(clash, 2, { speed: 9, life: 0.35, s0: 0.22, c0: st.s > 0 ? C.fireHot : C.white, c1: st.s > 0 ? C.ember : C.wind });
    if (Math.random() < dt * 8) FX.burst(clash, 1, { speed: 2, life: 0.8, s0: 0.8, s1: 1.8, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.4, up: 1 });
    Render.post.aberr = Math.max(Render.post.aberr, 0.4 + Math.abs(st.s) * 0.6);
    boss.pose('throwR', 20); boss.glowR = 1;
    if (st.s <= -1) return this.finish(-1);
    if (st.s >= 1) return this.finish(1);
    if (st.t > 7) return this.finish(st.s < 0 ? -1 : 1);
    return false;
  },
  finish(result) {
    const st = this.st; if (!st) return true;
    const p = G.player, boss = st.boss;
    this.end(st);
    if (p.state === 'beam') p.toMove();
    if (result < 0) {
      // wind overpowers fire
      const c = boss.chest(new V3()), dir = boss.pos.clone().sub(p.pos).setY(0).normalize();
      const w = beamMesh(0xffffff, HC.teal); const hp = p.chest();
      const far = c.clone().addScaledVector(dir, 6);
      FX.add(null, 0.5, (e, k) => { placeBeam(w, hp, hp.clone().lerp(far, Math.min(1, k * 3)), k * 3); w.scale.x = w.scale.z = 1.6 * (1 - k); if (k >= 1) { Render.scene.remove(w); } });
      Render.post.impact = 1; Render.post.flash = 0.3; FX.speedBg(0.8);
      Sfx.boom(1.8); Sfx.breakS(); Sfx.P("sfx_beam_win", 1);
      FX.shockwave(c, 1, 2.2, 0.8); FX.impactLines(c, 30, 0xffffff, 8, 0.4);
      const res = boss.takeDamage(110, 120, c, dir, { big: true, knock: 14, src: 'beam' });
      if (res) p.onDealtHit(res, c, dir, true, 0.2, 'finisher');
      HUD.say(Hero.def.name, Hero.is('wind') ? 'The wind... does not break!' : 'Not... today!', 2.2);
      HUD.banner('OVERPOWERED', 'break');
      p.gainFlow(35);
    } else if (result > 0) {
      const dir = p.pos.clone().sub(boss.pos).setY(0).normalize();
      FX.burst(p.chest(), 40, { speed: 14, life: 0.6, s0: 0.4, c0: C.fireHot, c1: C.ember });
      Sfx.fireHit();
      p.invuln = 0; p.dodgeInv = 0;
      p.tryHit(28, dir, 'launch', boss.pos);
      HUD.say('VARUKH', 'Feeble!', 1.6);
    }
    Sfx.intensity = p.awake ? 3 : 2;
    return true;
  },
  end(st) {
    Sfx.loopOff('sfx_beam_loop', 0.3);
    if (!st || st.ended) return;
    st.ended = true;
    FX.sbgT = Math.min(FX.sbgT, 0.25);
    for (const g of [st.fire, st.wind, st.orb]) if (g) Render.scene.remove(g);
    if (Cam.shotQ) Cam.shotQ.dur = Math.min(Cam.shotQ.dur, Cam.shotQ.t + 0.35);
    HUD.el.prompt.classList.remove('show'); HUD.promptT = 0;
    if (G.player.state === 'beam') G.player.toMove();
    this.st = null;
  },
};

/* ---------------- Directed finisher ---------------- */
function directedFinisher() {
  const b = G.boss, p = G.player;
  G.state = 'ending'; G.endT = 0; G.won = true;
  Sfx.musicCut(); Sfx.intensity = 0;
  slowmo(0.06, 1.25);
  Render.post.impact = 1; Render.post.aberr = 2;
  FX.sbgT = 0; FX.speedBg(1.5); FX.eyeGlint(p.rig);
  HUD.banner('', '');
  const c0 = b.chest(new V3());
  FX.impactLines(c0, 22, 0xffffff, 9, 0.5);
  Sfx.ting(2400);
  const axis = new V3(b.pos.x - p.pos.x, 0, b.pos.z - p.pos.z).normalize();
  const side = new V3(-axis.z, 0, axis.x);
  let exploded = false;
  Cam.cine = (dt, cam) => {
    G.endT += dt;
    const k = G.endT;
    const mid = p.pos.clone().lerp(b.pos, 0.5);
    if (k < 1.45) {
      // low, tight side angle that creeps in while time crawls
      const d = 4.4 - k * 0.9;
      cam.position.copy(mid).addScaledVector(side, d).addScaledVector(axis, -0.6 + k * 0.4).setY(0.55 + k * 0.15);
      Cam.look.copy(mid).setY(1.45);
      cam.lookAt(Cam.look);
      Cam.roll = 0.12;
    } else {
      if (!exploded) {
        exploded = true;
        Cam.roll = 0;
        const c = b.chest(new V3());
        Render.post.flash = 0.55; Render.post.impact = 1;
        FX.shake(1.4); Sfx.boom(2); Sfx.roar();
        FX.burst(c, 160, { speed: 26, life: 1.1, s0: 0.6, c0: C.fireHot, c1: C.ember, drag: 2 });
        FX.burst(c, 40, { speed: 6, life: 2.2, s0: 1.4, s1: 3.4, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.5, up: 2 });
        FX.shockwave(c, 1.2, 3, 1); FX.groundRing(b.pos.clone().setY(0.05), 14, 0xff8a40, 0.9, 0.8);
        World.crater(b.pos.clone(), 9, true); World.damageAt(b.pos.clone(), 12, 999);
        slowmo(0.35, 1.6);
        if (p.alive) { p.state = 'victory'; p.st = 0; p.yaw = yawOf(-axis.x, -axis.z); }
        setTimeout(() => { Sfx.victory(); HUD.say(Hero.def.name, Hero.def.lines.win, 2.6); }, 700);
      }
      // hero walks away from the blast toward the camera, fire blooming behind
      const t = k - 1.45;
      const front = p.pos.clone().addScaledVector(axis, -4.6 - t * 0.4).addScaledVector(side, 1.2).setY(1.1 + t * 0.15);
      cam.position.lerp(front, k < 1.5 ? 1 : 1 - Math.exp(-3 * dt));
      Cam.look.lerp(p.pos.clone().addScaledVector(axis, 2.5).setY(1.5), k < 1.5 ? 1 : 1 - Math.exp(-4 * dt));
      cam.lookAt(Cam.look);
      if (Math.random() < 0.5) { const a = rand(0, TAU); FX.add_.spawn(b.pos.x + Math.cos(a) * 2, rand(0.2, 3), b.pos.z + Math.sin(a) * 2, Math.cos(a) * 2, rand(2, 6), Math.sin(a) * 2, 1, 0.4, 0.05, C.fireHot, C.ember, 0.5, -1); }
    }
  };
  setTimeout(() => { if (G.won) showEnd(true); }, 5200);
}

/* ---------------- Fight intro: hero card, boss card, VS ---------------- */
function introCine(dt, cam) {
  G.introT += dt;
  const t = G.introT, p = G.player, b = G.boss;
  const ev = (at) => G.introPrev < at && t >= at;
  if (ev(0.25)) { $('heroCard').classList.add('show'); Sfx.bigWhoosh(); Sfx.hv('name', 1, 0); }
  if (ev(1.0)) FX.eyeGlint(p.rig);
  if (ev(2.2)) { $('heroCard').classList.remove('show'); }
  if (ev(2.6)) { $('nameCard').classList.add('show'); Sfx.roar(); setTimeout(() => Sfx.bv('name', 1, 0), 900); FX.shake(0.4); }
  if (ev(4.4)) { $('nameCard').classList.remove('show'); }
  if (ev(4.6)) { $('vsCard').classList.add('show'); if (!Sfx.P('sfx_vs', 1)) { Sfx.boom(1.2); Sfx.clash(); } Sfx.stinger('stinger_intro_vs'); FX.shake(0.5); Render.post.impact = 1; Sfx.intensity = 1; }
  if (ev(5.6)) $('vsCard').classList.remove('show');
  G.introPrev = t;
  if (t < 2.3) {
    // hero: slow push-in from the front, low angle
    const f = dirOf(p.yaw), s = new V3(f.z, 0, -f.x);
    const d = 3.2 - t * 0.5;
    cam.position.copy(p.pos).addScaledVector(f, d).addScaledVector(s, -0.6).setY(1.0 + t * 0.08);
    cam.lookAt(p.pos.x, 1.35, p.pos.z);
    p.rig.setPose(HERO_POSES.idle, 6);
  } else if (t < 4.6) {
    const u = t - 2.3;
    const ang = -0.6 + u * 0.35;
    cam.position.set(b.pos.x + Math.sin(ang) * (4.2 + u * 0.5), 1.4 + u * 0.35, b.pos.z + Math.cos(ang) * (4.2 + u * 0.5));
    cam.lookAt(b.pos.x, 2.2, b.pos.z);
    if (u > 0.5 && b.rig.target.head[0] > -0.5) b.rig.setPose(BOSS_POSES.roar, 4);
  } else {
    // both in frame, pulled wide, then settle behind the hero
    const u = t - 4.6;
    if (u < 1.0) {
      const mid = p.pos.clone().lerp(b.pos, 0.5);
      const axis = new V3(b.pos.x - p.pos.x, 0, b.pos.z - p.pos.z).normalize(); const side = new V3(-axis.z, 0, axis.x);
      cam.position.copy(mid).addScaledVector(side, 11 + u * 1.5).setY(2.2);
      cam.lookAt(mid.x, 1.5, mid.z);
    } else {
      Cam.snapBehind();
      const k = clamp((u - 1.0) / 0.6, 0, 1);
      cam.position.lerp(Cam.pos, k); cam.lookAt(Cam.look);
    }
  }
}
const INTRO_LEN = 6.2;
