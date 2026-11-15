'use strict';
/* ============================================================
   Camera, HUD, game flow and main loop
   ============================================================ */
const Cam = {
  yaw: 0, pitch: 0.16, bias: 0, side: 1, pos: new V3(0, 4, 16), look: new V3(), cine: null, roll: 0, shotQ: null,
  // base gameplay camera: frames both fighters, over-the-shoulder, low and wide
  base(dt, a, outPos, outLook) {
    const p = G.player, b = G.boss;
    const lockOK = G.lockOn && b.alive && b.state !== 'dead';
    const dPB = horizDist(p.pos, b.pos);
    if (lockOK && dPB > 0.5) {
      const desired = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
      this.bias = clamp(this.bias - a.cx, -1.1, 1.1);
      this.bias = damp(this.bias, 0, 0.5, dt);
      this.yaw = dampAngle(this.yaw, desired + this.bias, dPB < 3 ? 1.5 : 4, dt);
      // shoulder side follows lateral movement so the boss stays in view
      const right = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const lat = p.vel.x * right.x + p.vel.z * right.z;
      if (Math.abs(lat) > 4) this.sideT = lat > 0 ? -1 : 1;
    } else this.yaw -= a.cx;
    this.side = damp(this.side, this.sideT ?? 1, 1.5, dt);
    this.pitch = clamp(this.pitch + a.cy, -0.12, 1.05);
    const sep = lockOK ? dPB : 0;
    const dist = clamp(5.4 + sep * 0.32, 5.4, 14);
    const right = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const lat = (lockOK ? 1.25 : 0.6) * this.side;
    const focus = new V3(p.pos.x, p.pos.y * 0.75 + 1.45, p.pos.z).addScaledVector(right, lat);
    outLook.copy(focus);
    if (lockOK) {
      const bc = b.chest(new V3());
      outLook.lerp(bc, clamp(0.35 + sep * 0.012, 0.35, 0.55));
      if (b.pos.y > 1) outLook.y = lerp(outLook.y, bc.y, 0.3);
    }
    const pitch = this.pitch;
    outPos.set(focus.x + Math.sin(this.yaw) * Math.cos(pitch) * dist, focus.y + Math.sin(pitch) * dist + 0.3, focus.z + Math.cos(this.yaw) * Math.cos(pitch) * dist);
    if (outPos.y < 0.45) outPos.y = 0.45;
    // keep the camera inside the arena and out of standing pillars
    const r = Math.hypot(outPos.x, outPos.z), R = ARENA_R + 6;
    if (r > R) { outPos.x *= R / r; outPos.z *= R / r; }
  },
  // cinematic shot: fn(k, t) -> {pos, look, fov}
  shot(dur, fn, opts = {}) { this.shotQ = { t: 0, dur, fn, cut: opts.cut !== false, outT: opts.out ?? 0.3 }; },
  impactShot(point, dir, dur = 0.75, close = 5.6) {
    const side = new V3(-dir.z, 0, dir.x);
    if (side.dot(new V3(Math.sin(this.yaw), 0, Math.cos(this.yaw))) < 0) side.negate();
    const center = point.clone();
    this.shot(dur, (k) => {
      const ang = k * 0.35;
      const s2 = side.clone().applyAxisAngle(new V3(0, 1, 0), ang);
      const pos = center.clone().addScaledVector(s2, close - k * 0.8).addScaledVector(dir, -1.2);
      pos.y = Math.max(0.8, center.y - 0.3 + k * 0.4);
      return { pos, look: center.clone().setY(center.y + 0.2), fov: 50 - k * 4 };
    });
  },
  update(dt, a) {
    const cam = Render.camera;
    if (this.cine) { this.cine(dt, cam); this.applyShake(dt, cam); return; }
    const want = new V3(), look = new V3();
    this.base(dt, a, want, look);
    // chase lag: a slightly underdamped spring trails the hero, so fast moves outrun the camera for a beat
    const hp = G.player.pos;
    if (!this.lagA) { this.lagA = hp.clone(); this.lagV = new V3(); }
    const lagOn = !(Settings.v && Settings.v.camLag === false);
    if (this.lagA.distanceTo(hp) > 4) this.lagA.sub(hp).setLength(1.5).add(hp);
    if (dt > 0) {
      const w = 15, z = 0.62, h = Math.min(dt, 1 / 30);
      this.lagV.x += ((hp.x - this.lagA.x) * w * w - this.lagV.x * 2 * z * w) * h;
      this.lagV.y += ((hp.y - this.lagA.y) * w * w - this.lagV.y * 2 * z * w) * h;
      this.lagV.z += ((hp.z - this.lagA.z) * w * w - this.lagV.z * 2 * z * w) * h;
      this.lagA.addScaledVector(this.lagV, h);
    }
    const off = this.lagA.clone().sub(hp); off.y *= 0.5;
    if (off.length() > 1.5) off.setLength(1.5);
    if (!lagOn) off.set(0, 0, 0);
    this.lagAmt = off.length();
    want.add(off); look.addScaledVector(off, 0.3);
    this.pos.lerp(want, 1 - Math.exp(-11 * dt));
    this.look.lerp(look, 1 - Math.exp(-12 * dt));
    let P = this.pos, L = this.look, fovAdd = 0;
    const S = this.shotQ;
    if (S) {
      S.t += dt;
      const k = clamp(S.t / S.dur, 0, 1);
      const r = S.fn(k, S.t);
      let w = S.cut ? 1 : clamp(S.t / 0.15, 0, 1);
      const outStart = S.dur - S.outT;
      if (S.t > outStart) w *= 1 - clamp((S.t - outStart) / S.outT, 0, 1);
      w = w * w * (3 - 2 * w);
      P = this.pos.clone().lerp(r.pos, w); L = this.look.clone().lerp(r.look, w);
      if (r.fov) fovAdd = (r.fov - Render.baseFov) * w;
      if (S.t >= S.dur) this.shotQ = null;
    }
    cam.position.copy(P);
    for (const PL of World.dpillars) {
      const dx = cam.position.x - PL.x, dz = cam.position.z - PL.z, d = Math.hypot(dx, dz), min = PL.r + 1.3;
      if (d < min && cam.position.y < (PL.broken ? 2.5 : 10.5)) { const k = (min - d) / Math.max(d, 1e-3); cam.position.x += dx * k; cam.position.z += dz * k; }
    }
    cam.lookAt(L);
    this.fovShot = fovAdd;
    // fade pillars that block the view of the hero
    const pp = G.player.pos;
    for (const PL of World.dpillars) {
      const occl = !PL.broken && seg2Dist(PL.x, PL.z, cam.position.x, cam.position.z, pp.x, pp.z) < PL.r + 0.6 && horizDist(cam.position, new V3(PL.x, 0, PL.z)) < horizDist(cam.position, pp);
      PL.fade = damp(PL.fade, occl ? 0.25 : 1, 10, dt);
      for (const m of PL.mats) { m.opacity = PL.fade; m.depthWrite = PL.fade > 0.95; }
      const ov = PL.fade > 0.9; if (PL.outlineVis !== ov) { PL.outlineVis = ov; PL.group.traverse(o => { if (o.userData.isOutline && !o.userData.inBatch) o.visible = ov; }); }
    }
    this.applyShake(dt, cam);
  },
  applyShake(dt, cam) {
    FX.shakeT = Math.max(0, FX.shakeT - dt * 1.8);
    const t = FX.shakeT * FX.shakeT, T = G.time * 60;
    if (t > 0.0001) {
      cam.position.x += (Math.sin(T * 1.7) + Math.sin(T * 3.1) * 0.5) * t * 0.35;
      cam.position.y += (Math.sin(T * 2.3 + 1) + Math.sin(T * 4.3) * 0.5) * t * 0.35;
      cam.rotateZ(Math.sin(T * 1.3 + 2) * t * 0.04);
    }
    this.roll = damp(this.roll, 0, 5, dt);
    if (Math.abs(this.roll) > 0.001) cam.rotateZ(this.roll);
    FX.fovKick = damp(FX.fovKick, 0, 6, dt);
    const f = clamp(Render.baseFov + FX.fovKick + (this.fovShot || 0), 30, 100);
    if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); }
  },
  dutch(a) { this.roll += a; },
  snapBehind() {
    const p = G.player, b = G.boss;
    this.yaw = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z); this.bias = 0; this.pitch = 0.16; this.shotQ = null;
    const want = new V3(), look = new V3();
    this.base(0, { cx: 0, cy: 0 }, want, look);
    this.pos.copy(want); this.look.copy(look);
    if (this.lagA) { this.lagA.copy(p.pos); this.lagV.set(0, 0, 0); }
  },
};

const $ = id => document.getElementById(id);
/* ---------------- game flow ---------------- */
G.flowStep = function () {
  const p = G.player;
  G.bossScaleTarget = 0.12; G.bossScale = 0.12; G.flowT = 1.4;
  p.counterT = 1.4; p.gainFlow(22);
  G.stats.perfect++;
  Sfx.flow();
  Render.post.tintAmt = 0.75; Render.post.aberr = 1;
  FX.ghost(p.rig, 0xffffff);
  FX.ringBill(p.chest(), 4, 0xffffff, 0.3);
  FX.popup(p.chest().add(new V3(0, 0.9, 0)), 'FLOW STEP', 'tag', Render.camera);
  HUD.banner('COUNTER!', 'flow');
  Kit.onFlowStep(p);
  if (!p.grounded) Moment.fire('SKY STEP', 'DODGED ON THIN AIR', null, null, 1);
};
G.onVictory = function () {
  if (!Training.active) { const f = Progress.finOf(Hero.id); if (f) setTimeout(() => FinisherFX.play(f, G.boss.chest(new V3())), 250); }
  if (typeof directedFinisher === 'function') return directedFinisher();
  G.state = 'ending';
  slowmo(0.12, 1.8);
  Render.post.impact = 1; Render.post.flash = 0.8;
  FX.shake(1);
  Sfx.boom(1.5); Sfx.intensity = 0;
  HUD.banner('', '');
  G.endT = 0; G.won = true;
  const b = G.boss, p = G.player;
  FX.shockwave(b.chest(new V3()), 1, 2.5, 0.9); FX.impactLines(b.chest(new V3()), 30, 0xffffff, 8, 0.4);
  Cam.cine = (dt, cam) => {
    G.endT += dt;
    const k = G.endT;
    const mid = b.pos.clone().lerp(p.pos, 0.5);
    const ang = Cam.yaw + k * 0.25;
    const d = 9 + k * 0.6;
    cam.position.lerp(new V3(mid.x + Math.sin(ang) * d, 2.2 + k * 0.4, mid.z + Math.cos(ang) * d), 1 - Math.exp(-3 * dt));
    Cam.look.lerp(mid.clone().setY(1.6), 1 - Math.exp(-4 * dt));
    cam.lookAt(Cam.look);
  };
  setTimeout(() => { if (G.won && G.player.alive) { G.player.state = 'victory'; HUD.say(Hero.def.name, Hero.def.lines.win, 2.4); } }, 1800);
  setTimeout(() => { if (G.won) showEnd(true); }, 4200);
};
G.onDefeat = function (why) {
  if (Duel.active) return Duel.finish(false, why);
  if (Training.active) { const p = G.player; p.alive = true; p.hp = p.maxHp; p.toMove(); p.invuln = 1; return; }
  G.state = 'ending'; G.won = false;
  slowmo(0.25, 1.2);
  Render.post.flash = 0.3; Sfx.intensity = 0; Sfx.defeat();
  HUD.banner('', '');
  setTimeout(() => HUD.say('VARUKH', 'Ash returns to ash.', 2.2), 400);
  setTimeout(() => { if (!G.won) showEnd(false); }, 2600);
};
function rank() {
  const s = G.stats;
  let pts = 0;
  pts += s.time < 120 ? 3 : s.time < 180 ? 2 : s.time < 260 ? 1 : 0;
  pts += s.dmgTaken < 25 ? 3 : s.dmgTaken < 50 ? 2 : s.dmgTaken < 80 ? 1 : 0;
  pts += Math.min(3, s.perfect);
  pts += s.maxCombo >= 25 ? 2 : s.maxCombo >= 12 ? 1 : 0;
  pts += Math.min(2, s.deflects);
  return pts >= 11 ? 'S' : pts >= 8 ? 'A' : pts >= 5 ? 'B' : 'C';
}
function showEnd(win) {
  G.state = win ? 'victory' : 'defeat';
  $('hud').classList.remove('show');
  Input.unlock();
  const s = G.stats;
  $('endTitle').textContent = win ? 'VICTORY' : 'DEFEATED';
  $('endSub').textContent = win ? 'The Cinder Warden falls. The winds are yours.' : 'The embers swallow the sky… rise again.';
  $('endPanel').className = 'panel show ' + (win ? 'win' : 'lose');
  const xr = Progress.grant('solo', win);
  const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
  $('endStats').innerHTML = `
    <div><span>Time</span><b>${m}:${String(sec).padStart(2, '0')}</b></div>
    <div><span>Max combo</span><b>${s.maxCombo}</b></div>
    <div><span>Flow steps</span><b>${s.perfect}</b></div>
    <div><span>Deflects</span><b>${s.deflects}</b></div>
    <div><span>Posture breaks</span><b>${s.breaks}</b></div>
    <div><span>Damage taken</span><b>${Math.round(s.dmgTaken)}</b></div>
    <div><span>Highlights</span><b>${s.moments || 0}</b></div><div><span>Grazes</span><b>${s.grazes || 0}</b></div>` + (win ? `<div class="rank"><span>Rank</span><b>${rank()}</b></div>` : '') + Progress.endHtml(xr);
}
G.reset = function () {
  for (const p of G.proj) p.explode(true);
  for (const h of G.hazards) if (!h.done) h.dispose();
  G.proj.length = 0; G.hazards.length = 0;
  FX.clear();
  G.player.reset(); G.boss.cancelAttack(); G.boss.reset();
  G.timeScale = G.tsTarget = 1; G.slowT = 0; G.bossScale = G.bossScaleTarget = 1; G.hitstop = 0; G.flowT = 0;
  G.stats = { time: 0, maxCombo: 0, perfect: 0, deflects: 0, breaks: 0, dmgTaken: 0, counters: 0, specials: 0 };
  World.mixTarget = 0; World.mix = 0.0001; World.applyPalette(0); World.resetEnv(); Render.waves = [];
  Object.assign(Render.post, { impact: 0, aberr: 0, speed: 0, flash: 0, tintAmt: 0, lowHp: 0 });
  Cam.cine = null; Cam.shotQ = null; G.won = false; Cam.roll = 0;
  Awaken.reset(); Kit.reset(); Blitz.reset(); FlameTrail.reset(); Tempo.reset(); ['sfx_charge_loop', 'sfx_beam_loop', 'sfx_aura_loop'].forEach(k => Sfx.loopOff(k)); BeamStruggle.end(BeamStruggle.st); Sfx.musicRestore && Sfx.musicRestore();
  ['heroCard', 'vsCard', 'nameCard'].forEach(id => $(id) && $(id).classList.remove('show'));
  $('endPanel').className = 'panel';
  if (G.state !== 'title') $('hud').classList.add('show');
  HUD.banner('', '');
  HUD.hpLag = 1; HUD.bLag = 1;
};
G.startIntro = function () {
  G.reachedP2 = false;
  G.reset();
  G.state = 'intro'; G.introT = 0;
  Sfx.init(); Sfx.intensity = 0; Sfx.loopOn('sfx_ambient_loop', 0.3);
  $('title').classList.add('hide');
  $('hud').classList.add('show');
  const b = G.boss;
  b.state = 'intro';
  G.introPrev = 0;
  Cam.cine = introCine;
};
G.beginFight = function (quick) {
  ['heroCard', 'vsCard', 'nameCard'].forEach(id => $(id).classList.remove('show'));
  Cam.cine = null; Cam.snapBehind(); Sfx.intensity = 1;
  G.state = 'fight'; G.boss.state = 'idle'; G.boss.cool = 1.0;
  HUD.banner('FIGHT', 'fight');
  if (!quick) setTimeout(() => { if (G.state === 'fight') HUD.say('VARUKH', pick(Hero.def.taunt || ['Little breeze... I will snuff you out.', 'The wind bends. The flame devours.', 'Another monk who thinks the sky is theirs?']), 3); }, 900);
  if (!quick) setTimeout(() => { if (G.state === 'fight') HUD.say(Hero.def.name, pick(Hero.def.lines.intro), 2.6); }, 4100);
  G.saidLow = false;
  Sfx.boom(0.6);
  Input.lock();
};

/* ---------------- hero swap: rebuild the player around another model ---------------- */
G.setHero = function (id, cb) {
  Hero.apply(id);
  if (!IS_BOT) try { localStorage.setItem('galeborn.hero', id); } catch (e) {}
  const old = G.player;
  if (old) {
    Render.scene.remove(old.rig.root);
    for (const c of old.rig.allChains || old.rig.chains) Render.scene.remove(c.ribbon.mesh);
    for (const k in old.trails) Render.scene.remove(old.trails[k].ribbon.mesh);
  }
  const p = G.player = new Player();
  p.rig.allChains = [...p.rig.chains];
  const tok = (G.heroTok = (G.heroTok || 0) + 1);
  HeroModel.load(id, g => {
    if (tok !== G.heroTok) return;
    if (g) { attachHeroModel(p.rig, g); if (p.rig.allChains) p.rig.allChains.push(...p.rig.chains.filter(c => !p.rig.allChains.includes(c))); }
    window.__heroModel = !!p.rig.model;
    p.reset();
    if (old) { p.pos.copy(old.pos); p.yaw = old.yaw; }
    $('hud').dataset.hero = id;
    HUD.setHero && HUD.setHero();
    if (!IS_BOT) Progress.applyLocal();
    if (cb) cb();
  });
};

function setHelp(show) {
  $('help').classList.toggle('show', show);
}

/* ---------------- main loop ---------------- */
function main() {
  Render.init();
  FX.init(Render.scene);
  World.build(Render.scene);
  Settings.load();
  Input.init(Render.r.domElement);
  HUD.init();
  CutIn.init();
  Menu.init(); Settings.apply(); Select.build(); if (!IS_BOT) { Lobby.init(); Profile.init(); } SpeedLines.init();
  try { const h = localStorage.getItem('galeborn.hero'); if (HEROES[h]) Hero.apply(h); } catch (e) {}
  G.setHero(Hero.id);
  G.boss = new Boss();
  { const seen = new Set(); G.boss.rig.root.traverse(o => { if (o.isMesh && o.material && o.material.isMeshToonMaterial && !seen.has(o.material)) { seen.add(o.material); addRim(o.material, 0xff8a40, 0.4, 0.6); } }); }
  G.reset();
  Perf.init();
  Cam.yaw = 0.6; Cam.pos.set(10, 6, 14);
  const canvas = Render.r.domElement;
  canvas.addEventListener('click', () => { if (G.state === 'fight' && !G.paused) Input.lock(); });
  $('playBtn').addEventListener('click', () => { Sfx.init(); Select.open('ranked'); });
  $('heroBtn').addEventListener('click', () => { Sfx.ui(); if (Duel.active) { Duel.leave(); G.reset(); G.state = 'title'; $('title').classList.remove('hide'); $('hud').classList.remove('show'); $('endPanel').className = 'panel'; } else Select.open(); });
  $('retryBtn').addEventListener('click', () => { Sfx.ui(); if (Duel.active && Duel.match && Duel.match.kind !== 'ranked' && Duel.match.kind !== 'bot') return Duel.requestRematch(); if (Duel.active) { $('endPanel').className = 'panel'; Lobby.again(); } else G.startIntro(); });
  document.addEventListener('pointerlockchange', () => { $('clickLock').classList.toggle('show', !document.pointerLockElement && G.state === 'fight' && !G.paused && Input.lastDevice === 'kb'); });
  function togglePause(v) {
    G.menuOpen = v;
    if (G.state === 'fight' && !Duel.active) { G.paused = v; if (v) Input.unlock(); else Input.lock(); }
    $('pause').classList.toggle('show', v);
    $('pause').classList.toggle('titlemode', G.state !== 'fight');
    if (v) { Menu.idx = G.state === 'fight' ? 7 : 0; Menu.render(); }
  }
  G.togglePause = togglePause;
  $('settingsBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); togglePause(true); });
  let last = performance.now();
  window.__G = G;
  function frame(now, botRaw) {
    if (!IS_BOT) requestAnimationFrame(frame);
    const elapsed = IS_BOT ? botRaw : (now - last) / 1000;
    const raw = Math.min(elapsed, 1 / 20); last = now;
    Quality.tick(Math.min(elapsed, 1)); Perf.tick(Math.min(elapsed, 1));
    G.time += raw;
    const a = IS_BOT ? BotAI.input(raw) : Input.poll();
    if (a.mute) Sfx.setMuted(!Sfx.muted);
    if (a.help) setHelp(!$('help').classList.contains('show'));
    $('deviceHint').textContent = Input.lastDevice === 'pad' ? 'pad' : 'kb';
    document.body.dataset.device = Input.lastDevice;
    UIIcons.refresh(Input.lastDevice);
    if (G.menuOpen) {
      Menu.nav(a);
      if (a.pause || (a.back && !a.pause)) togglePause(false);
      Object.assign(a, { pause: false, confirm: false, light: false, jump: false, lock: false });
    }
    if (G.state === 'select') {
      if (!G.menuOpen) Select.nav(a);
      // showcase camera: hero front, slightly low, slow drift
      const p = G.player, cam = Render.camera, f = dirOf(p.yaw + Math.sin(G.time * 0.35) * 0.18), r = new V3(-f.z, 0, f.x);
      // hero stands right of centre so the info panel has room on the left
      cam.position.copy(p.pos).addScaledVector(f, 4.9).addScaledVector(r, 1.0).setY(1.15);
      cam.lookAt(p.pos.clone().addScaledVector(r, 1.0).setY(0.85));
      cam.fov = 40; cam.updateProjectionMatrix();
      G.player.state = Select.cheer > 0 ? 'victory' : 'move'; Select.cheer -= raw; G.player.vel.set(0, 0, 0);
      G.player.update(raw, { mx: 0, my: 0 });
      G.boss.rig.setPose(BOSS_POSES.idle, 4); G.boss.update(raw * 0.0001 + 1e-6);
      FX.update(raw, cam); G.player.lateUpdate(raw, cam); G.boss.lateUpdate(raw, cam);
    } else if (G.state === 'title') {
      if (a.confirm && !a.lock && !G.menuOpen && !$('lobby').classList.contains('show') && !$('board').classList.contains('show')) { Sfx.init(); Select.open(Lobby.pendingRoom ? 'friend' : 'ranked'); }
      Cam.yaw += raw * 0.08;
      const cam = Render.camera;
      cam.position.set(Math.sin(Cam.yaw) * 17, 4.5, Math.cos(Cam.yaw) * 17);
      cam.lookAt(0, 2.2, 0);
      G.boss.rig.setPose(BOSS_POSES.idle, 4); G.boss.update(raw * 0.0001 + 1e-6);
    } else if (G.state === 'victory' || G.state === 'defeat') {
      if (!Duel.active && (a.restart || a.confirm)) G.startIntro();
    } else if (G.state === 'intro') {
      if (!Duel.active && (G.introT > INTRO_LEN || (G.introT > 0.4 && (a.confirm || a.light || a.jump)))) G.beginFight();
    }
    if ((G.state === 'fight') && a.pause && !G.menuOpen) togglePause(true);
    if (G.state === 'fight' && a.lock) { G.lockOn = !G.lockOn; Sfx.ui(); }
    const simActive = (G.state === 'fight' || G.state === 'intro' || G.state === 'ending' || G.state === 'victory' || G.state === 'defeat') && !G.paused;
    let sim = 0;
    if (simActive) {
      if (G.hitstop > 0) { G.hitstop -= raw; sim = 0; }
      else {
        if (G.slowT > 0) { G.slowT -= raw; if (G.slowT <= 0) G.tsTarget = 1; }
        G.timeScale = damp(G.timeScale, G.tsTarget, G.tsTarget < G.timeScale ? 30 : 4, raw);
        sim = raw * G.timeScale * (G.state === 'fight' ? G.pace : 1);
      }
      if (G.flowT > 0) { G.flowT -= raw; if (G.flowT <= 0 && G.player.state !== 'special') G.bossScaleTarget = 1; }
      G.bossScale = damp(G.bossScale, G.bossScaleTarget, G.bossScaleTarget > G.bossScale ? 3 : 20, raw);
      const pdt = sim, bdt = sim * G.bossScale * (G.boss.phase === 2 ? 1.12 : 1);
      if (G.state === 'fight') {
        G.stats.time += raw;
        const pl = G.player;
        if (pl.alive && pl.hp < 30) { G.beatT = (G.beatT || 0) - raw; if (G.beatT <= 0) { G.beatT = 0.85; if (!Sfx.P('sfx_heartbeat', 0.8, { jitter: false })) { Sfx.tone('sine', 60, 40, 0.12, 0.5); Sfx.tone('sine', 55, 38, 0.12, 0.4, 0.18); } } if (!G.saidLow) { G.saidLow = true; HUD.say(Hero.def.name, Hero.def.lines.low, 2.2); } }
      }
      if (G.state === 'fight') { Awaken.check(); Awaken.update(pdt); Kit.update(pdt); FlameTrail.update(pdt); }
      G.player.bufferInputs(a);
      Blitz.tick(raw);
      if (Blitz.active) Blitz.update(raw);
      else { Duel.mirror = Duel.active; G.player.update(pdt, a); Duel.mirror = false; G.boss.update(Duel.active ? sim : bdt); }
      Duel.tick(raw);
      for (const p of G.proj) { p.update(p.owner === 'boss' ? bdt : pdt, Render.camera); if (!p.dead && p.owner === 'boss') Graze.check(p, G.player); }
      ProjClash.update(); Arena.update(pdt); Tempo.update(pdt); Training.update(pdt);
      for (let i = G.proj.length - 1; i >= 0; i--) if (G.proj[i].dead) G.proj.splice(i, 1);
      // wind cancels fire: player projectiles destroy fireballs
      for (const p of G.proj) if (p.owner === 'player' && !p.dead && p.kind !== 'fireball') for (const q of G.proj) if (q.owner === 'boss' && !q.dead && p.pos.distanceTo(q.pos) < p.r + q.r) { q.explode(); Sfx.deflect(); G.player.gainFlow(4); }
      for (const h of G.hazards) if (!h.done) h.update(bdt);
      for (let i = G.hazards.length - 1; i >= 0; i--) if (G.hazards[i].done) G.hazards.splice(i, 1);
      FX.update(sim * (0.35 + 0.65 * G.bossScale), Render.camera);
      G.player.lateUpdate(pdt, Render.camera);
      G.boss.lateUpdate(bdt, Render.camera);
    } else if (G.state === 'title') {
      FX.update(raw, Render.camera);
      G.boss.lateUpdate(raw, Render.camera);
      G.player.lateUpdate(raw, Render.camera);
    }
    World.update(raw, G.time, simActive ? sim : raw);
    CutIn.update(raw);
    if (G.state !== 'title' && G.state !== 'select') Cam.update(raw, G.paused ? { cx: 0, cy: 0 } : a);
    FX.updateSpeedBg(raw, Render.camera); SpeedLines.update(raw);
    // post fx decay
    const P = Render.post;
    // impact frames: a big hit holds two hard ink frames (negative, then positive), then cuts back
    if (P.impact >= 0.95 && !(G.impHold > 0) && !G.impUsed) { G.impHold = 0.1; G.impUsed = true; Sfx.P('sfx_impact_frame', 0.7); }
    if (G.impHold > 0) { G.impHold -= raw; P.impact = 1; P.impactInv = G.impHold > 0.05 ? 1 : 0; if (G.impHold <= 0) { P.impact = 0; P.impactInv = 0; } }
    else { G.impUsed = false; P.impactInv = 0; P.impact = Math.max(0, Math.min(P.impact, 0.94) - raw * 8); }
    P.flash = Math.max(0, P.flash - raw * 3);
    P.aberr = Math.max(0, P.aberr - raw * 4);
    const dashing = G.player.state === 'dash' || G.player.state === 'special' || (G.player.state === 'slam' && G.player.slamDiving);
    P.speed = damp(P.speed, dashing ? 0.7 : 0, dashing ? 20 : 6, raw);
    P.tintAmt = damp(P.tintAmt, G.flowT > 0 || G.player.state === 'special' ? 0.55 : 0, 6, raw);
    P.lowHp = damp(P.lowHp, G.player.hp < 30 && G.player.alive ? 0.6 + Math.sin(G.time * 6) * 0.25 : 0, 4, raw);
    if (G.state !== 'title') HUD.update(raw);
    if (!IS_BOT) Render.render(G.time);
    Input.endFrame();
  }
  if (IS_BOT) { Quality.set && Quality.set('low'); Quality.tick = () => {}; BotAI.init(frame); }
  else requestAnimationFrame(frame);
}
window.addEventListener('load', () => {
  try { main(); }
  catch (e) { console.error(e); const el = document.getElementById('err'); el.textContent = 'Failed to start: ' + e.message; el.style.display = 'block'; }
});
