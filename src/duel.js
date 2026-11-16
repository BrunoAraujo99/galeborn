'use strict';
/* ============================================================
   DUEL: player vs player over a realtime link.
   Each client simulates its own fighter. The opponent is a Puppet
   (rig + model replayed from snapshots). Attacks are resolved on the
   attacker's side against the puppet and sent as hits; the victim
   applies them through its normal tryHit (so dodges, armor, counters
   all still work) and answers 'miss' when it dodged.
   The Opp adapter stands in for the boss so all player code works as-is.
   ============================================================ */
const PVP_SCALE = 0.32;      // hero attacks were tuned for a 1500 HP boss
const SNAP_HZ = 15;
const _o3 = new V3();

class Puppet {
  constructor(def) {
    this.def = def;
    this.rig = makeHeroRig();
    Render.scene.add(this.rig.root);
    for (const c of this.rig.chains) Render.scene.add(c.ribbon.mesh);
    this.allChains = [...this.rig.chains];
    const P = def.pal;
    this.trails = { L: new Trail(14, P.main, 0.16), R: new Trail(14, P.main, 0.16), F: new Trail(14, P.pale, 0.2), B: new Trail(14, P.main, 0.16) };
    for (const k in this.trails) Render.scene.add(this.trails[k].ribbon.mesh);
    this.snaps = []; this.pos = new V3(0, 0, -9); this.vel = new V3(); this.yaw = 0;
    this.state = 'move'; this.hp = def.stats.hp; this.maxHp = def.stats.hp; this.flow = 0; this.ghostT = 0;
    this.rig.root.position.copy(this.pos);
    HeroModel.load(def.id, g => {
      if (!g || this.disposed) return;
      attachHeroModel(this.rig, g, def);
      for (const c of this.rig.chains) if (!this.allChains.includes(c)) this.allChains.push(c);
    });
  }
  push(s) { s.rt = performance.now(); this.snaps.push(s); if (this.snaps.length > 40) this.snaps.shift(); }
  update(dt) {
    const S = this.snaps, rig = this.rig;
    if (!S.length) { rig.update(dt); return; }
    const tr = performance.now() - 1000 / SNAP_HZ * 1.6; // render slightly in the past and interpolate
    let a = S[S.length - 1], b = a;
    for (let i = S.length - 1; i > 0; i--) if (S[i - 1].rt <= tr) { a = S[i - 1]; b = S[i]; break; }
    const k = b.rt > a.rt ? clamp((tr - a.rt) / (b.rt - a.rt), 0, 1) : 1;
    this.pos.set(lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k), lerp(a.p[2], b.p[2], k));
    this.yaw = a.y + angDiff(a.y, b.y) * k;
    const L = S[S.length - 1];
    this.state = L.s; this.hp = L.hp; this.maxHp = L.mh; this.flow = L.fl; this.vel.set(L.v[0], L.v[1], L.v[2]); this.awake = !!L.aw;
    rig.root.position.copy(this.pos); rig.root.rotation.y = this.yaw;
    const pose = { hipsY: b.j[33] };
    JOINTS.forEach((n, i) => { pose[n] = [b.j[i * 3], b.j[i * 3 + 1], b.j[i * 3 + 2]]; });
    rig.setPose(pose, 30);
    rig.clipReq = b.c || null;
    if (b.sm) { rig.smear = b.sm[0]; rig.smearLimb = b.sm[1]; }
    if (rig.model) rig.model.setAura(this.awake);
    rig.update(dt);
    rig.root.updateMatrixWorld(true);
    const t = this.trails, tmp = _o3;
    t.L.emit = !!(L.tr & 1); t.R.emit = !!(L.tr & 2); t.F.emit = !!(L.tr & 4); t.B.emit = !!(L.tr & 8);
    t.L.push(rig.handPos('L', tmp)); t.R.push(rig.handPos('R', tmp)); t.F.push(rig.footPos('R', tmp)); t.B.push(rig.footPos('L', tmp));
    this.ghostT -= dt;
    if ((this.state === 'dash' || this.state === 'rush' || this.state === 'pursuit') && this.ghostT <= 0) { this.ghostT = 0.04; FX.ghost(rig, this.def.pal.mid); }
  }
  lateUpdate(dt, cam) { updateRigChains(this.rig, dt, cam); for (const k in this.trails) this.trails[k].update(cam); }
  dispose() {
    this.disposed = true;
    Render.scene.remove(this.rig.root);
    for (const c of this.allChains) Render.scene.remove(c.ribbon.mesh);
    for (const k in this.trails) Render.scene.remove(this.trails[k].ribbon.mesh);
  }
}
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

/* stands in for G.boss while a duel runs */
const Opp = {
  puppet: null, def: null, radius: 0.55, alive: true, state: 'idle', phase: 1, posture: 0, maxPosture: 100,
  hp: 100, maxHp: 100, knock: new V3(), yaw: 0, cool: 0, held: false,
  capA: new V3(), capB: new V3(),
  get pos() { return this.puppet ? this.puppet.pos : _o3.set(0, 0, -9); },
  get rig() { return this.puppet.rig; },
  chest(out = new V3()) { const p = this.pos; return out.set(p.x, p.y + 1.2, p.z); },
  takeDamage(dmg, post, point, dir, o = {}) {
    if (!this.alive || !Duel.started || Duel.ended) return null;
    const ps = this.puppet.state;
    if (ps === 'special' || ps === 'dead') return null;
    const p = G.player;
    const mult = (p.awake ? 1.3 : 1) * (o.src === 'burn' ? 1 : Hero.def.stats.dmg) * PVP_SCALE * elemMult(Hero.id, this.def.id);
    const d = Math.max(1, Math.round(dmg * mult));
    const k = o.src === 'burn' ? 'chip' : o.src === 'burst' ? 'burst' : o.pull ? 'pull' : o.spike ? 'spike' : o.src === 'special' && o.noFlinch ? 'held' : o.big && (o.knock || 0) >= 9 ? 'launch' : o.big ? 'heavy' : 'light';
    Duel.send({ t: 'hit', d, k, dir: [r3(dir.x), r3(dir.z)] });
    this.hp = Math.max(0, this.hp - d); this.puppet.hp = this.hp;
    return { dmg: d, broke: false };
  },
  setHeld(v) { this.held = v; },
  update(dt) {
    if (!this.puppet) return;
    this.puppet.update(dt);
    const p = this.puppet.pos;
    this.capA.set(p.x, p.y + 0.3, p.z); this.capB.set(p.x, p.y + 1.6, p.z);
    this.knock.copy(this.puppet.vel);
    this.yaw = this.puppet.yaw; this.hp = this.puppet.hp; this.maxHp = this.puppet.maxHp;
    this.state = ['hit', 'launched', 'down'].includes(this.puppet.state) ? 'stagger' : 'idle';
  },
  lateUpdate(dt, cam) { if (this.puppet) this.puppet.lateUpdate(dt, cam); },
  reset() {}, cancelAttack() {}, toPlayer() { return G.player.pos.clone().sub(this.pos); },
};
const r3 = v => Math.round(v * 1000) / 1000;

/* mirrored effects: while the local fighter updates, these FX calls are also sent to the opponent */
const MIRROR_FX = ['windBlade', 'groundRing', 'shockwave', 'ringBill', 'star', 'impactLines', 'sfxWord'];
function serArg(a) { return a && a.isVector3 ? { v: [r3(a.x), r3(a.y), r3(a.z)] } : a; }
function deserArg(a) { return a && a.v ? new V3(a.v[0], a.v[1], a.v[2]) : a; }

const Duel = {
  active: false, started: false, ended: false, mirror: false,
  install() {
    if (this.installed) return; this.installed = true;
    for (const n of MIRROR_FX) {
      const orig = FX[n];
      FX[n] = function (...args) { if (Duel.mirror && Duel.active) Duel.send({ t: 'fx', f: n, a: args.map(serArg) }); return orig.apply(FX, args); };
    }
  },
  // match: { id, kind, side, me_hero, opp: { id, name, rating, hero } }
  begin(match, LinkClass = SupaLink) {
    this.install();
    this.match = match; this.active = true; this.started = false; this.ended = false; this.reported = false;
    this.gotHello = false; this.helloT = 0; this.sendT = 0; this.cdT = -1; this.lastRx = performance.now();
    this.gotCos = false; this.round = 1; this.wins = [0, 0]; this.matchDone = false; this.rmMe = false; this.rmOpp = false;
    G.mode = 'duel';
    const odef = HEROES[match.opp.hero] || HEROES.wind;
    if (!G.realBoss) G.realBoss = G.boss;
    G.realBoss.rig.root.visible = false;
    G.boss = Opp;
    Opp.puppet = new Puppet(odef); Opp.def = odef; Opp.alive = true; Opp.hp = Opp.maxHp = odef.stats.hp; Opp.held = false;
    G.reset();
    Arena.set(Arena.pickFor(match.id)); Arena.roundStart();
    const p = G.player;
    this.place();
    this.renderRounds();
    document.querySelector('#bossbar .bn').textContent = match.opp.name;
    if (!this.bossEmb) this.bossEmb = $('bbEmb').innerHTML; $('bbEmb').innerHTML = heroGlyph(match.opp.hero); NEON.setOpp(match.opp.hero);
    $('postRow').style.display = 'none'; document.body.classList.add('duel');
    document.querySelector('#bossbar small').textContent = odef.name + ' · ' + odef.title + (match.opp.rating ? ' · ' + (isFinite(+match.opp.rating) ? tierOf(match.opp.rating).name + ' ' : '') + match.opp.rating : '');
    $('title').classList.add('hide'); $('hud').classList.add('show'); $('lobby').classList.remove('show');
    this.link = new LinkClass(match.id, m => this.rx(m));
    G.state = 'intro'; G.introT = 0;
    Sfx.init(); Sfx.intensity = 0;
    HUD.banner('CONNECTING', 'flow');
    const me = p;
    Cam.cine = (dt, cam) => {
      const a = G.time * 0.15, mid = me.pos.clone().lerp(Opp.pos, 0.5);
      cam.position.set(mid.x + Math.sin(a) * 13, 4.5, mid.z + Math.cos(a) * 13); cam.lookAt(mid.x, 1.3, mid.z);
    };
  },
  send(m) { if (this.link) this.link.send(m); },
  rx(m) {
    if (!this.active) return;
    this.lastRx = performance.now();
    const p = G.player;
    switch (m.t) {
      case 'h': if (!this.gotHello) { this.gotHello = true; this.send(Object.assign({ t: 'h' }, Progress.hello())); } if (!this.gotCos) { this.gotCos = true; Progress.applyOpp(m); } break;
      case 'fin': FinisherFX.play(m.f, p.chest()); break;
      case 's': Opp.puppet.push(m); break;
      case 'hit': {
        if (!this.started || this.ended || !p.alive) return;
        const dir = new V3(m.dir[0], 0, m.dir[1]);
        if (m.k === 'chip') {
          p.hp -= m.d; FX.dmgNumber(p.chest(), m.d, 'burn');
          if (p.hp <= 0) { p.hp = 1; p.tryHit(1, dir, 'light', 'pvp'); }
          return;
        }
        // both strikes landed in the same instant: clash instead of trading damage
        if (m.k !== 'held' && m.k !== 'burst' && p.state === 'attack' && p.move && p.st >= p.move.a0 - 0.05 && p.st <= p.move.a1 + 0.06) {
          const at = p.chest().lerp(Opp.chest(), 0.5), f = Opp.pos.clone().sub(p.pos).setY(0).normalize();
          this.send({ t: 'clash', at: [r3(at.x), r3(at.y), r3(at.z)] }); duelClash(at, f); return;
        }
        const res = p.tryHit(m.d, dir, m.k === 'held' ? 'light' : m.k, 'pvp');
        if (m.k === 'held' && res === 'hit') { p.stunDur = 0.45; p.vel.set(0, p.vel.y, 0); }
        if (res === 'dodged' || res === 'immune' || res === 'blocked') this.send({ t: 'miss', why: res });
        if (res === 'parried') this.send({ t: 'parried' });
        break;
      }
      case 'pun': Tempo.punish(Opp.chest()); break;
      case 'brk': Clarity.onBroke(); break;
      case 'miss':
        // our strike was blocked: the string is broken, and a blocked big hit leaves us wide open
        if (m.why === 'blocked' && p.state === 'attack' && p.move) {
          p.moveBlocked = true;
          if ((p.move.big || p.move.finisher) && !p.move.armor) { p.state = 'hit'; p.st = 0; p.stunDur = 0.42; p.openT = 0.5; p.vel.set(-p.fwd().x * 3, p.vel.y, -p.fwd().z * 3); FX.popup(p.chest().add(new V3(0, 1.1, 0)), 'OPEN!', 'tag small', Render.camera); }
        }
        FX.popup(Opp.chest().add(new V3(0, 0.9, 0)), m.why === 'dodged' ? 'DODGED' : 'BLOCKED', 'tag small', Render.camera); break;
      case 'parried': {
        // our strike was parried: we're thrown off balance and open to their counter
        if (!p.alive) break;
        Sfx.loopOff('sfx_charge_loop'); for (const k in p.trails) p.trails[k].emit = false;
        p.state = 'hit'; p.st = 0; p.stunDur = 0.62; p.move = null; p.vel.set(0, Math.min(p.vel.y, 0), 0);
        const c = p.chest().lerp(Opp.chest(), 0.4);
        FX.popup(c.clone().add(new V3(0, 0.9, 0)), 'PARRIED', 'break', Render.camera); FX.star(c, 3.5, 0xffffff, 0.2);
        Sfx.P('sfx_deflect', 0.9) || Sfx.ting(2200); FX.shake(0.35); Render.post.aberr = 1;
        break;
      }
      case 'gb': FX.popup(Opp.chest().add(new V3(0, 1.1, 0)), 'GUARD BREAK', 'break', Render.camera); Sfx.P('sfx_posture_break', 0.9) || Sfx.boom(0.6); FX.shake(0.3); break;
      case 'fx': { const f = FX[m.f]; if (f && !(Clarity.busy() && (m.f === 'impactLines' || m.f === 'burst') && Math.random() < 0.6)) { this.mirror = false; f.apply(FX, m.a.map(deserArg)); } break; }
      case 'pr': G.proj.push(new Projectile({ pos: new V3(...m.pos), vel: new V3(...m.vel), r: m.r, owner: 'ghost', dmg: 0, life: m.life, kind: m.kind })); break;
      case 'cut': CutIn.play(Opp.rig, 'boss', m.name, m.sub, 1.1); FX.speedBg(1.1, true); break;
      case 'ult': this.ultVisual(Opp.def.pal, new V3(m.at[0], 0, m.at[1])); break;
      case 'clash': { const at = new V3(...m.at), f = Opp.pos.clone().sub(p.pos).setY(0).normalize(); duelClash(at, f); if (Opp.puppet) Opp.hp = Opp.puppet.hp; break; }
      case 'ko': if (!this.ended) this.finish(true, m.why); break;
      case 'bye': if (!this.matchDone && (this.started || this.round > 1)) { this.ended = false; this.finish(true, 'OPPONENT LEFT'); } break;
      case 'rm': this.rmOpp = true; if (this.matchDone) this.rematchCheck(); break;
    }
  },
  // per frame, after the local fighter updated
  tick(raw) {
    if (!this.active) return;
    if (this.link && this.link.tick) this.link.tick(raw);
    const p = G.player;
    if (!this.started) {
      this.helloT -= raw;
      if (this.helloT <= 0 && this.link && this.link.status === 'open') { this.helloT = 0.5; this.send(Object.assign({ t: 'h' }, Progress.hello())); }
      if (this.gotHello && this.cdT < 0) { this.cdT = 3; HUD.banner('3', 'flow'); Sfx.P('sfx_vs', 0.8); Sfx.stinger('stinger_intro_vs'); }
      if (this.cdT >= 0) {
        const before = Math.ceil(this.cdT); this.cdT -= raw; const after = Math.ceil(this.cdT);
        if (after !== before && after > 0) { HUD.banner(String(after), 'flow'); Sfx.ui(); }
        if (this.cdT <= 0) this.go();
      }
    }
    // our snapshot
    this.sendT -= raw;
    if (this.sendT <= 0 && this.link && this.link.status === 'open') {
      this.sendT = 1 / SNAP_HZ;
      const j = [];
      for (const n of JOINTS) { const r = p.rig.j[n].rotation; j.push(r3(r.x), r3(r.y), r3(r.z)); }
      j.push(r3(p.rig.j.hips.position.y - p.rig.hipBase));
      const t = p.trails;
      this.send({ t: 's', p: [r3(p.pos.x), r3(p.pos.y), r3(p.pos.z)], v: [r3(p.vel.x), r3(p.vel.y), r3(p.vel.z)], y: r3(p.yaw), s: p.state, hp: Math.round(p.hp), mh: p.maxHp, fl: Math.round(p.flow),
        j, c: p.lastClip ? [p.lastClip[0], r3(p.lastClip[1])] : null, sm: p.rig.lastSmear || null, aw: p.awake ? 1 : 0,
        tr: (t.L.emit ? 1 : 0) | (t.R.emit ? 2 : 0) | (t.F.emit ? 4 : 0) | (t.B.emit ? 8 : 0) });
    }
    // our new projectiles appear on the other side as harmless ghosts
    for (const pr of G.proj) if (pr.owner === 'player' && !pr.netSent) { pr.netSent = true; this.send({ t: 'pr', pos: [pr.pos.x, pr.pos.y, pr.pos.z], vel: [pr.vel.x, pr.vel.y, pr.vel.z], r: pr.r, life: pr.life, kind: pr.kind }); }
    // opponent vanished
    if ((this.started || this.round > 1) && !this.matchDone && performance.now() - this.lastRx > 8000) { this.ended = false; this.finish(true, 'OPPONENT DISCONNECTED'); }
  },
  go() {
    this.started = true; this.cdT = -1;
    Cam.cine = null; Cam.snapBehind();
    G.state = 'fight'; Sfx.intensity = 1;
    HUD.banner(this.round === 1 ? 'DUEL' : 'FIGHT', 'fight'); Sfx.boom(0.6);
    if (this.round === 1) { const A = ARENAS[Arena.id]; setTimeout(() => { if (this.active) HUD.prompt(A.name + ' · ' + A.sub, null, 2.4); }, 1600); }
    const adv = elemMult(Hero.id, Opp.def.id) > 1 ? 'ELEMENT ADVANTAGE ▲' : elemMult(Opp.def.id, Hero.id) > 1 ? 'ELEMENT DISADVANTAGE ▼' : '';
    if (adv) setTimeout(() => { if (this.active) FX.popup(G.player.chest().add(new V3(0, 1.1, 0)), adv, 'tag', Render.camera); }, 900);
    if (this.round === 1) G.stats.time = 0;
    Arena.roundStart();
    Input.lock();
  },
  ultVisual(pal, at) {
    const mats = [swirlMaterial(pal.main, pal.deep, { twist: 3, speed: 4, bands: 5, edge: 0.1 }), swirlMaterial(pal.mid, pal.deep2, { twist: -2, speed: -6, bands: 3, edge: 0.1 })];
    const grp = new THREE.Group();
    const g1 = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 2.0, 16, 32, 1, true), mats[0]);
    const g2 = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 1.4, 16, 32, 1, true), mats[1]);
    g1.position.y = g2.position.y = 8; grp.add(g1, g2); grp.position.copy(at);
    FX.add(grp, 1.8, (e, k) => {
      const s = Math.min(1, e.t * 5) * (k > 0.85 ? (1 - k) / 0.15 : 1);
      grp.scale.set(s, Math.min(1, e.t * 4), s); grp.rotation.y += 0.25;
      for (const m of mats) m.uniforms.time.value = e.t;
      mats[0].uniforms.opacity.value = s * 0.42; mats[1].uniforms.opacity.value = s * 0.3;
    });
  },
  // local fighter went down (called from G.onDefeat) or opponent KO'd
  finish(won, why) {
    if (this.ended) return;
    this.ended = true;
    if (!won) this.send({ t: 'ko', why });
    const forfeit = !!(why && /LEFT|DISCONNECT/.test(why));
    if (!forfeit) this.wins[won ? 0 : 1]++;
    this.renderRounds();
    G.state = 'ending'; G.won = won;
    if (won) { Opp.alive = false; slowmo(0.2, 1.2); Render.post.impact = 1; FX.shake(0.8); Sfx.boom(1.4); }
    else { slowmo(0.3, 1); Render.post.flash = 0.3; }
    if (!forfeit && this.wins[0] < 2 && this.wins[1] < 2) {
      HUD.banner(why || (won ? 'ROUND ' + this.round : 'ROUND LOST'), won ? 'fight' : 'flow');
      if (won) { Sfx.stinger && Sfx.stinger('stinger_round'); Clips.mark('ROUND ' + this.round + ' K.O.', 4); }
      const r = this.round;
      setTimeout(() => { if (this.active && this.ended && !this.matchDone && this.round === r) this.nextRound(); }, 2900);
      return;
    }
    this.matchDone = true;
    if (won && !forfeit) Clips.mark('MATCH K.O.', 6, 3.2);
    if (won) { const f = Progress.finOf(Hero.id); if (f) { setTimeout(() => FinisherFX.play(f, Opp.chest()), 250); this.send({ t: 'fin', f }); } }
    this.xpRes = Progress.grant(this.match.kind === 'bot' ? 'bot' : 'online', won, { diff: Lobby.lastDiff });
    Sfx.intensity = 0; if (won) setTimeout(() => Sfx.victory(), 700); else Sfx.defeat();
    HUD.banner(won ? (why || 'K.O.') : 'DEFEAT', won ? 'fight' : 'flow');
    if (won) setTimeout(() => { if (G.player.alive) G.player.state = 'victory'; HUD.say(Hero.def.name, Hero.def.lines.win, 2.4); }, 900);
    this.result = null;
    this.reportResult(won);
    setTimeout(() => this.showEnd(), 2600);
  },
  async reportResult(won) {
    const m = this.match;
    if (m.test || !Api.me) return;
    const winner = won ? Api.me.id : m.opp.id;
    for (let i = 0; i < 6; i++) {
      try {
        const r = await Api.report(m.id, winner);
        if (!r.pending) { this.result = r; this.renderResult(); Api.ensure().catch(() => {}); return; }
      } catch (e) { console.warn('report failed', e.message); }
      await new Promise(res => setTimeout(res, i < 3 ? 2500 : 11000));
    }
  },
  showEnd() {
    const won = G.won, m = this.match;
    $('endTitle').textContent = won ? 'VICTORY' : 'DEFEAT';
    $('endSub').textContent = `vs ${m.opp.name} · ${(HEROES[m.opp.hero] || HEROES.wind).name}`;
    $('retryBtn').textContent = m.kind === 'ranked' ? 'FIND NEXT DUEL' : m.kind === 'bot' ? 'REMATCH' : this.rmOpp ? 'REMATCH · THEY\'RE READY' : 'REMATCH';
    $('heroBtn').textContent = 'MAIN MENU';
    this.renderResult();
    $('endPanel').className = 'panel show ' + (won ? 'win' : 'lose');
    G.state = won ? 'victory' : 'defeat';
    Input.unlock();
    Clips.showEnd();
  },
  renderResult() {
    const r = this.result, m = this.match;
    const s = G.stats;
    let rate = m.kind === 'bot' ? `<div><span>Bot · ${m.opp.rating}</span><b>unranked</b></div>` : m.kind !== 'ranked' ? '<div><span>Friendly duel</span><b>unranked</b></div>' : r ? `<div><span>Rating</span><b>${(r.winner === Api.me?.id ? '+' : '−') + (r.delta || 0)}</b></div>` : '<div><span>Rating</span><b>…</b></div>';
    $('endStats').innerHTML = rate + `<div><span>Rounds</span><b>${this.wins[0]} – ${this.wins[1]}</b></div><div><span>Time</span><b>${Math.round(s.time)}s</b></div><div><span>Best combo</span><b>${s.maxCombo}</b></div><div><span>Perfect dodges</span><b>${s.perfect}</b></div><div><span>Highlights</span><b>${s.moments || 0}</b></div>` + Progress.endHtml(this.xpRes);
  },
  place() {
    const side = this.match.side === 1 ? 1 : -1, p = G.player;
    p.pos.set(0, 0, 9 * side); p.yaw = side > 0 ? Math.PI : 0;
    Opp.puppet.pos.set(0, 0, -9 * side); Opp.puppet.yaw = side > 0 ? 0 : Math.PI;
    Opp.puppet.rig.root.position.copy(Opp.puppet.pos); Opp.puppet.rig.root.rotation.y = Opp.puppet.yaw;
  },
  renderRounds() {
    const pip = n => [0, 1].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    $('rounds').innerHTML = `<span class="me">${pip(this.wins[0])}</span><b><small>ROUND</small>${Math.min(this.round, 3)}</b><span class="op">${pip(this.wins[1])}</span>`;
  },
  nextRound() {
    this.round++; this.ended = false; this.started = false;
    for (const pr of G.proj) pr.explode(true); G.proj.length = 0; FX.clear();
    const keep = G.stats; G.player.reset(); G.stats = keep;
    G.timeScale = G.tsTarget = 1; G.slowT = 0; G.hitstop = 0; G.won = false; G.flowT = 0; G.bossScale = G.bossScaleTarget = 1;
    Awaken.reset(); Kit.reset(); Blitz.reset(); FlameTrail.reset(); Sfx.loopOff('sfx_charge_loop');
    Object.assign(Render.post, { impact: 0, aberr: 0, speed: 0, flash: 0, lowHp: 0 });
    World.resetEnv();
    this.place();
    Opp.alive = true; Opp.hp = Opp.maxHp; if (Opp.puppet) { Opp.puppet.hp = Opp.maxHp; Opp.puppet.snaps.length = 0; }
    Cam.snapBehind && Cam.snapBehind();
    G.state = 'intro'; this.cdT = 3.2;
    this.renderRounds();
    HUD.banner(this.wins[0] === 1 && this.wins[1] === 1 ? 'FINAL ROUND' : 'ROUND ' + this.round, 'flow'); Sfx.P('sfx_vs', 0.6);
  },
  // friendly rematch on the same connection: both players have to ask
  requestRematch() {
    if (!this.matchDone || this.rmMe) return;
    this.rmMe = true; this.send({ t: 'rm' });
    $('retryBtn').textContent = 'WAITING FOR OPPONENT…';
    this.rematchCheck();
  },
  rematchCheck() {
    if (!this.rmMe) { if (this.rmOpp && $('endPanel').classList.contains('show')) $('retryBtn').textContent = 'REMATCH · THEY\'RE READY'; return; }
    if (!this.rmOpp) return;
    // both agreed: restart the set
    this.rmMe = this.rmOpp = false; this.matchDone = false; this.round = 0; this.wins = [0, 0];
    $('endPanel').className = 'panel'; $('hud').classList.add('show');
    G.stats = { time: 0, maxCombo: 0, perfect: 0, deflects: 0, breaks: 0, dmgTaken: 0, counters: 0, specials: 0 };
    Clips.reset(); this.ended = true; this.nextRound();
    Input.lock();
  },
  // leave the duel and restore solo mode
  leave() {
    if (!this.active) return;
    this.send({ t: 'bye' });
    if (this.link) this.link.close(); this.link = null;
    if (Opp.puppet) Opp.puppet.dispose(); Opp.puppet = null;
    for (const pr of G.proj) if (pr.owner === 'ghost') pr.explode(true);
    G.boss = G.realBoss; G.boss.rig.root.visible = true;
    document.querySelector('#bossbar .bn').textContent = 'VARUKH';
    if (this.bossEmb) $('bbEmb').innerHTML = this.bossEmb; NEON.setOpp(null); $('postRow').style.display = ''; document.body.classList.remove('duel');
    document.querySelector('#bossbar small').textContent = 'THE CINDER WARDEN';
    $('retryBtn').textContent = 'FIGHT AGAIN'; $('heroBtn').textContent = 'CHANGE HERO';
    this.active = false; this.started = false; G.mode = 'solo';
    Arena.set('ruins'); $('rounds').innerHTML = '';
    Cam.cine = null;
  },
};
