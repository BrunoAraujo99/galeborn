'use strict';
/* ============================================================
   Bots. A bot is a second copy of the game running in a hidden iframe
   (same file, "#bot"). It plays a full hero with the normal moveset and
   connects to the main page through the same duel protocol as an online
   opponent, so everything (hits, dodges, clashes, KOs) works the same.
   The iframe is driven frame by frame by the parent page.
   ============================================================ */
const IS_BOT = location.hash === '#bot';
const BOT_DIFF = {
  easy:   { react: 0.42, dodge: 0.22, combo: [1, 3], pause: [0.9, 1.7], heavy: 0.10, air: 0.10, ult: 0.15, recover: 0.2, chase: 0.25, block: 0.15, parry: 0, name: 'EASY' },
  normal: { react: 0.28, dodge: 0.5,  combo: [2, 4], pause: [0.5, 1.1], heavy: 0.2,  air: 0.2,  ult: 0.4,  recover: 0.5, chase: 0.55, block: 0.3, parry: 0.1, name: 'NORMAL' },
  hard:   { react: 0.16, dodge: 0.8,  combo: [3, 4], pause: [0.2, 0.55], heavy: 0.3, air: 0.3,  ult: 0.8,  recover: 0.85, chase: 0.9, block: 0.35, parry: 0.35, name: 'HARD' },
};
const BOT_NAMES = { wind: 'TAVI', fire: 'SOREN', earth: 'BRANNOC', water: 'YSRA' };

/* ---------------- parent side: owns the iframe ---------------- */
const BotHost = {
  frame: null, ready: false, onReady: [], link: null,
  ensure(cb) {
    if (this.ready) return cb && cb();
    if (cb) this.onReady.push(cb);
    if (this.frame) return;
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-10px;top:-10px;width:4px;height:4px;border:0;opacity:0;pointer-events:none';
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.src = location.href.split(/[?#]/)[0] + '#bot';
    document.body.appendChild(f); this.frame = f;
    window.addEventListener('message', e => {
      if (!this.frame || e.source !== this.frame.contentWindow || !e.data || !e.data.gb) return;
      const d = e.data;
      if (d.t === 'ready') { this.ready = true; const q = this.onReady; this.onReady = []; q.forEach(fn => fn()); }
      else if (d.t === 'net' && this.link) this.link.onMsg(d.m);
      else if (d.t === 'err') console.warn('bot:', d.msg);
    });
  },
  post(d) { if (this.frame && this.frame.contentWindow) this.frame.contentWindow.postMessage(Object.assign({ gb: 1 }, d), '*'); },
};
// duel link to the bot (same interface as SupaLink)
class BotLink {
  constructor(matchId, onMsg) {
    this.onMsg = onMsg; this.status = 'connecting'; BotHost.link = this;
    BotHost.ensure(() => { this.status = 'open'; BotHost.post({ t: 'start', cfg: Duel.match.bot }); });
  }
  send(m) { if (this.status === 'open') BotHost.post({ t: 'net', m }); }
  tick(raw) { if (this.status === 'open') BotHost.post({ t: 'tick', raw }); }
  close() { this.status = 'closed'; BotHost.post({ t: 'stop' }); if (BotHost.link === this) BotHost.link = null; }
}
function startBotMatch(diff = 'normal', heroId) {
  const opts = HERO_ORDER.filter(h => h !== Hero.id);
  const bh = heroId || pick(opts);
  const match = {
    id: 'bot-' + Date.now(), kind: 'bot', side: 1, me_hero: Hero.id, test: true,
    opp: { id: 'bot', name: BOT_NAMES[bh] + ' · BOT', hero: bh, rating: BOT_DIFF[diff].name },
    bot: { hero: bh, diff, oppHero: Hero.id, oppName: 'YOU' },
  };
  Lobby.lastKind = 'bot'; Lobby.lastDiff = diff;
  $('lobby').classList.remove('show');
  Duel.begin(match, BotLink);
}

/* ---------------- iframe side: runs the bot fighter ---------------- */
class ParentLink {
  constructor(matchId, onMsg) { this.status = 'open'; BotAI.rx = onMsg; }
  send(m) { parent.postMessage({ gb: 1, t: 'net', m }, '*'); }
  close() { this.status = 'closed'; }
}
const BotAI = {
  rx: null, cfg: null, D: BOT_DIFF.normal, nextAtk: 0, comboLeft: 0, pressT: 0, strafe: 1, strafeT: 0,
  threatT: -1, willDodge: false, dodged: false, seenProj: new WeakSet(), jumpT: 0,
  init(frameFn) {
    window.addEventListener('message', e => {
      const d = e.data; if (!d || !d.gb || e.source !== parent) return;
      if (d.t === 'tick') frameFn(performance.now(), d.raw);
      else if (d.t === 'net') { if (this.rx) this.rx(d.m); }
      else if (d.t === 'start') this.start(d.cfg);
      else if (d.t === 'stop') { if (Duel.active) { Duel.link = null; Duel.leave(); } }
    });
    parent.postMessage({ gb: 1, t: 'ready' }, '*');
  },
  start(cfg) {
    this.cfg = cfg; this.D = BOT_DIFF[cfg.diff] || BOT_DIFF.normal;
    this.nextAtk = 0; this.comboLeft = 0; this.threatT = -1;
    if (Duel.active) { Duel.link = null; Duel.leave(); }
    G.setHero(cfg.hero, () => {
      Duel.begin({ id: 'bot', kind: 'bot', side: 2, me_hero: cfg.hero, test: true, opp: { id: 'you', name: cfg.oppName, hero: cfg.oppHero } }, ParentLink);
      G.lockOn = true;
    });
  },
  blank() { return { mx: 0, my: 0, cx: 0, cy: 0, jump: false, dash: false, light: false, heavy: false, heavyHeld: false, block: false, special: false, lock: false, pause: false, confirm: false, restart: false, mute: false, help: false, any: false, up: false, down: false, left: false, right: false, accept: false, back: false }; },
  // world-space direction -> stick input relative to this page's camera
  steer(a, wx, wz) {
    const l = Math.hypot(wx, wz); if (l < 1e-4) return;
    wx /= l; wz /= l;
    const cy = Cam.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    a.mx = wx * rx + wz * rz; a.my = wx * fx + wz * fz;
  },
  input(raw) {
    const a = this.blank();
    const p = G.player, o = Opp, D = this.D;
    if (!Duel.active || !Duel.started || Duel.ended || !p.alive || !o.puppet) return a;
    const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, dist = Math.hypot(dx, dz);
    const ux = dx / (dist || 1), uz = dz / (dist || 1);
    const os = o.puppet.state, t = G.time;
    // ---- defence: the human starts a move close by -> maybe dodge after a human-like delay
    const threat = dist < 4.8 && ['attack', 'special', 'slam', 'counter', 'pursuit', 'dash'].includes(os) && os !== 'dash';
    // a parry earns a counter: take it
    if (p.state === 'parry') { if (p.st > 0.04) { a.light = true; this.steer(a, ux, uz); } return a; }
    if (threat) {
      if (this.threatT < 0) {
        this.threatT = t; this.dodged = false;
        const r = Math.random();
        this.defMode = r < D.parry ? 'parry' : r < D.parry + D.block ? 'block' : Math.random() < D.dodge ? 'dodge' : 'none';
        this.willDodge = this.defMode === 'dodge';
      }
      if (this.defMode === 'parry' && t - this.threatT > 0.03) { a.block = true; this.holdBlockT = t + 0.25; return a; }
      if (this.defMode === 'block' && t - this.threatT > D.react * 0.7) { a.block = true; this.holdBlockT = t + 0.35; return a; }
      if (this.willDodge && !this.dodged && t - this.threatT > D.react && (p.state === 'move' || p.state === 'attack')) {
        this.dodged = true; a.dash = true; this.steer(a, -uz * this.strafe - ux * 0.4, ux * this.strafe - uz * 0.4);
        this.nextAtk = t + 0.12; this.comboLeft = 0;
        return a;
      }
    } else this.threatT = -1;
    if (p.state === 'block' && t < (this.holdBlockT || 0)) { a.block = true; return a; }
    // incoming projectile -> sidestep
    for (const q of G.proj) {
      if (q.owner !== 'ghost' || q.dead || this.seenProj.has(q)) continue;
      const rx = p.pos.x - q.pos.x, rz = p.pos.z - q.pos.z, d = Math.hypot(rx, rz);
      const closing = (q.vel.x * rx + q.vel.z * rz) / ((Math.hypot(q.vel.x, q.vel.z) || 1) * (d || 1));
      if (d < 9 && closing > 0.9) {
        this.seenProj.add(q);
        if (Math.random() < D.dodge && p.state === 'move') { a.dash = true; this.steer(a, -rz * this.strafe, rx * this.strafe); return a; }
      }
    }
    // knocked into the air: air recovery
    if (Burst.can(p) && Math.random() < D.recover * raw * 4) { a.block = true; return a; }
    if (p.state === 'launched') { if (p.st > 0.2 && Math.random() < D.recover * raw * 5) a.dash = true; return a; }
    if (p.state === 'down') { if (Math.random() < D.recover * raw * 6) a.jump = true; return a; }
    // ---- offence
    if (p.flow >= 100 && dist < 9 && Math.random() < D.ult * raw * 2) { a.special = true; return a; }
    this.strafeT -= raw; if (this.strafeT <= 0) { this.strafeT = rand(1.2, 2.6); this.strafe = Math.random() < 0.5 ? 1 : -1; }
    // the human is launched: chase into the air
    if (os === 'launched' && p.pursuitT > 0 && Math.random() < D.chase) { a.dash = true; return a; }
    if (os === 'launched' && dist < 6 && Math.random() < D.chase * raw * 4) {
      if (p.grounded) { a.jump = true; this.steer(a, ux, uz); return a; }
      a.light = true; this.steer(a, ux, uz); return a;
    }
    if (dist > 8) {
      this.steer(a, ux + -uz * this.strafe * 0.25, uz + ux * this.strafe * 0.25);
      if (dist > 11 && Math.random() < raw * 0.7) a.dash = true;
      if (Math.random() < raw * 0.15) a.jump = true;
      return a;
    }
    if (t < this.nextAtk) {
      // spacing: circle the opponent at mid range between strings
      const want = dist < 3.2 ? -0.7 : dist > 5 ? 0.6 : 0;
      this.steer(a, ux * want - uz * this.strafe, uz * want + ux * this.strafe);
      return a;
    }
    if (dist > 2.9) { this.steer(a, ux, uz); if (dist > 4.5 && Math.random() < raw * 1.2) a.dash = true; return a; }
    // in range: run a string
    if (this.comboLeft <= 0) {
      this.comboLeft = Math.round(rand(D.combo[0], D.combo[1]));
      this.useHeavy = Math.random() < D.heavy; this.useAir = Math.random() < D.air;
      if (this.useAir && p.grounded) { a.jump = true; this.steer(a, ux, uz); return a; }
    }
    this.pressT -= raw;
    if (this.pressT <= 0 && (p.state === 'move' || p.state === 'attack')) {
      this.pressT = rand(0.16, 0.26);
      this.steer(a, ux, uz);
      if (this.useHeavy && this.comboLeft === 1) a.heavy = true;
      else if (this.comboLeft === 1 && Math.random() < D.air) { a.light = true; this.steer(a, -ux, -uz); }
      else a.light = true;
      this.comboLeft--;
      if (this.comboLeft <= 0) this.nextAtk = t + rand(D.pause[0], D.pause[1]);
    }
    return a;
  },
};
