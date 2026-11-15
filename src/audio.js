'use strict';
/* ============================================================
   Procedural audio: all sounds synthesized (no asset files)
   ============================================================ */
const Sfx = {
  ctx: null, master: null, music: null, muted: false, musicOn: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = this.masterVol ?? 0.7; this.master.connect(comp);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 1; this.sfxBus.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol ?? 0.55; this.music.connect(this.master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // light reverb for space
    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.6, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3); }
    this.verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.22; this.verb.connect(vg); vg.connect(this.master);
    this.startMusic();
    this.loadSamples();
  },
  get t() { return this.ctx ? this.ctx.currentTime : 0; },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : (this.masterVol ?? 0.7); },
  env(g, t0, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  },
  noise(dur, f0, f1, q, type, gain, delay = 0, attack = 0.005, out) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = rand(0.9, 1.1);
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + dur);
    const g = ctx.createGain(); this.env(g, t0, attack, gain, dur);
    src.connect(f); f.connect(g); g.connect(out || this.sfxBus); g.connect(this.verb);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  },
  tone(type, f0, f1, dur, gain, delay = 0, attack = 0.004, out) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 10), t0 + dur);
    const g = ctx.createGain(); this.env(g, t0, attack, gain, dur);
    o.connect(g); g.connect(out || this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  // ---------- sample layer (embedded clips; synth is the fallback) ----------
  bufs: {}, vo: null,
  loadSamples() {
    const src = typeof AUDIO_B64 !== 'undefined' ? AUDIO_B64 : null;
    if (!this.ctx || !src || this._loading) return;
    this._loading = true;
    for (const name in src) {
      const bin = atob(src[name]), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      // numbered dialogue lines are distinct clips; any other _NN suffix is a random variant
      const key = /^vo_.*_(intro|ult|tempest|nova|phase2)_\d\d$|^vo_varukh_vs_\w+_\d\d$/.test(name) ? name : name.replace(/_\d\d$/, '');
      this.ctx.decodeAudioData(u8.buffer).then(b => { (this.bufs[key] = this.bufs[key] || []).push(b); if (key === this._wantMusic) this.playMusic(key); }).catch(() => {});
    }
  },
  samplesOn() { return Object.keys(this.bufs).length > 20; },
  pickMusic(I) {
    if (!this.samplesOn()) return;
    this.loopOn('sfx_ambient_loop', 0.3);
    const want = I <= 0 ? 'music_title' : I === 1 ? 'music_phase1' : I === 2 ? 'music_phase2' : (this.has('music_awakened') ? 'music_awakened' : 'music_phase2');
    if (this._wantMusic !== want || !this.track) this.playMusic(want);
  },
  has(key) { return !!(this.bufs[key] && this.bufs[key].length); },
  // play a clip (random variant). opts: vol, rate, delay, bus, loop, verb
  play(key, o = {}) {
    if (!this.ctx || !this.has(key)) return null;
    const list = this.bufs[key];
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this['_last_' + key]) i = (i + 1) % list.length;
    this['_last_' + key] = i;
    const ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = list[i]; s.loop = !!o.loop;
    s.playbackRate.value = (o.rate || 1) * (o.jitter === false ? 1 : rand(0.96, 1.04));
    const g = ctx.createGain(); g.gain.value = o.vol ?? 1;
    s.connect(g); g.connect(o.bus || this.sfxBus); if (o.verb) { const vg = ctx.createGain(); vg.gain.value = o.verb; g.connect(vg); vg.connect(this.verb); }
    s.start(t0);
    return { src: s, gain: g, stop(fade = 0.15) { try { g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3); s.stop(ctx.currentTime + fade + 0.05); } catch (e) {} } };
  },
  // spoken line: one voice at a time per speaker
  // prio: 2 = scripted dialogue line, 1 = shout/roar, 0 = effort grunt.
  // A voice never interrupts a higher-priority one that is still playing, and grunts stay quiet while anyone speaks a line.
  speaking(who, prio) {
    const now = this.ctx.currentTime;
    for (const w of who ? [who] : ['hero', 'boss']) { const v = this['_vo_' + w]; if (v && v.end > now && v.prio >= prio) return true; }
    return false;
  },
  voice(key, who, prio = 2) {
    if (!this.ctx || !this.has(key)) return false;
    if (this.speaking(who, prio + (prio === 2 ? 0 : 1))) return false;
    if (prio === 0 && this.speaking(null, 2)) return false;
    if (!this.voBus) { this.voBus = this.ctx.createGain(); this.voBus.gain.value = 1.15; this.voBus.connect(this.master); }
    const cur = this['_vo_' + who]; if (cur) cur.stop(0.08);
    const h = this.play(key, { bus: this.voBus, jitter: false, verb: 0.25, vol: prio === 0 ? 0.75 : 1 });
    h.prio = prio; h.end = this.ctx.currentTime + h.src.buffer.duration;
    this['_vo_' + who] = h;
    if (prio < 2) return true;
    // duck music under dialogue
    if (this.music) { const g = this.music.gain, t = this.ctx.currentTime, v = this.musicVol ?? 0.55; g.cancelScheduledValues(t); g.setTargetAtTime(v * 0.45, t, 0.05); g.setTargetAtTime(v, t + this['_vo_' + who].src.buffer.duration, 0.4); }
    return true;
  },
  // streamed music track with crossfade (falls back to the synth sequencer when absent)
  playMusic(key, fade = 1.2) {
    this._wantMusic = key;
    if (!this.has(key)) { if (this.track && this.samplesOn()) { this.track.stop(fade); this.track = null; } return false; }
    if (this.track && this.track.key === key) return true;
    if (this.track) this.track.stop(fade);
    this.track = this.looper(key, fade); this.synthMusic = false;
    return true;
  },
  // music tracks are not seamless loops: start a fresh copy before the end and crossfade the seam
  looper(key, fade) {
    const XF = 1.6, self = this;
    const L = { key, cur: null, timer: 0, dead: false,
      next(fin) {
        if (L.dead) return;
        const h = self.play(key, { bus: self.music, jitter: false, vol: 0.0001 });
        if (!h) return;
        h.gain.gain.setTargetAtTime(1, self.ctx.currentTime, fin / 3);
        if (L.cur) L.cur.stop(XF);
        L.cur = h;
        const dur = h.src.buffer.duration;
        L.timer = setTimeout(() => L.next(XF), Math.max(5, dur - XF) * 1000);
      },
      stop(f = 0.5) { L.dead = true; clearTimeout(L.timer); if (L.cur) L.cur.stop(f); },
    };
    L.next(fade);
    return L;
  },
  // element version of a hero sound (fire/earth/water); wind uses the base set
  el(kind, vol = 1, o) { const id = typeof Hero !== 'undefined' ? Hero.id : 'wind'; return id !== 'wind' && this.P(`sfx_${id}_${kind}`, vol, o); },
  // sample-first helper: returns true when a clip played (then the synth version is skipped)
  P(key, vol = 1, o = {}) { return !!this.play(key, Object.assign({ vol }, o)); },
  // hero voice (efforts and shouts) with a per-kind cooldown so they don't spam
  hv(kind, chance = 1, cd = 0.35) {
    if (Math.random() > chance || !this.ctx) return false;
    const id = typeof Hero !== 'undefined' ? (Hero.id === 'wind' ? 'tavi' : Hero.id) : 'tavi', key = `vo_${id}_${kind}`;
    const now = this.ctx.currentTime; this._hvT = this._hvT || {};
    if (now - (this._hvT.hero || -9) < cd || !this.has(key)) return false;
    const ok = this.voice(key, 'hero', /^(attack|heavy|hurt|jump|ko)$/.test(kind) ? 0 : 1);
    if (ok) this._hvT.hero = now; return ok;
  },
  bv(kind, chance = 1, cd = 0.6) {
    if (Math.random() > chance || !this.ctx) return false;
    const now = this.ctx.currentTime; this._hvT = this._hvT || {};
    if (now - (this._hvT.boss || -9) < cd || !this.has('vo_varukh_' + kind)) return false;
    const ok = this.voice('vo_varukh_' + kind, 'boss', /^(attack|hurt)$/.test(kind) ? 0 : kind === 'defeat' || kind === 'taunt' ? 2 : 1);
    if (ok) this._hvT.boss = now; return ok;
  },
  loopOn(key, vol = 0.6) { this._loops = this._loops || {}; if (this._loops[key] || !this.has(key)) return; this._loops[key] = this.play(key, { loop: true, vol, jitter: false }); },
  loopOff(key, fade = 0.2) { if (this._loops && this._loops[key]) { this._loops[key].stop(fade); this._loops[key] = null; } },
  // ---------- game sounds ----------
  whoosh(p = 1, v = 0.45) { if (this.P('sfx_swing_light', v * 1.3, { rate: clamp(0.75 + p * 0.2, 0.75, 1.3) })) return; this.noise(0.2 / p + 0.05, 500 * p, 2600 * p, 1.4, 'bandpass', v); },
  bigWhoosh() { if (this.P('sfx_whoosh_big', 0.7)) return; this.noise(0.5, 200, 1800, 1.0, 'bandpass', 0.6); this.noise(0.35, 3000, 600, 0.8, 'bandpass', 0.25, 0.1); },
  hit(s = 1) { if (this.P(s >= 1.6 ? 'sfx_hit_crit' : s >= 1.15 ? 'sfx_hit_heavy' : 'sfx_hit_light', clamp(0.55 + s * 0.3, 0.5, 1.2))) { if (s >= 1.2) this.bv('hurt', 0.35, 1.6); return; }
    this.tone('sine', 190, 42, 0.16 + 0.12 * s, 0.85 * Math.min(s, 1.4));
    this.noise(0.07 + 0.07 * s, 4200, 500, 0.8, 'lowpass', 0.55 * s);
    this.tone('triangle', 1400 * rand(0.9, 1.1), 300, 0.05, 0.12);
    if (s > 1.2) this.noise(0.5, 900, 80, 0.7, 'lowpass', 0.5);
  },
  slash() { if (this.P('sfx_wind_blade', 0.6)) return; this.noise(0.12, 6000, 1800, 2.5, 'bandpass', 0.35); },
  fireball() { if (this.P('sfx_fireball_cast', 0.75)) return; this.noise(0.45, 260, 1400, 0.9, 'lowpass', 0.5); this.tone('sawtooth', 90, 60, 0.3, 0.08); },
  fireHit() { if (this.P('sfx_fire_impact', 0.85)) return; this.noise(0.5, 1800, 200, 0.6, 'lowpass', 0.7); this.tone('sine', 120, 40, 0.3, 0.6); },
  boom(s = 1) { if (this.P('sfx_boom', clamp(0.45 + s * 0.45, 0.4, 1.2), { rate: s > 1 ? 0.85 : 1 })) { if (s >= 1) this.P('sfx_crater', 0.6); return; }
    this.tone('sine', 95, 26, 0.9 * s, 1.0);
    this.noise(1.1 * s, 1400, 60, 0.7, 'lowpass', 0.9);
    this.noise(0.15, 5000, 1500, 0.5, 'highpass', 0.3);
  },
  ting(f = 2600) { if (this.P('sfx_counter', 0.3, { rate: clamp(f / 2200, 0.6, 1.5) })) return; this.tone('sine', f, f * 0.98, 0.5, 0.35); this.tone('sine', f * 1.5, f * 1.49, 0.35, 0.15, 0.01); },
  glint() { if (this.P('sfx_deflect', 0.3, { rate: 1.35 })) return; this.tone('sine', 3200, 3000, 0.18, 0.18); this.tone('triangle', 1600, 1500, 0.12, 0.08); },
  roar() { if (this.bv('roar', 1, 0.2)) return;
    this.tone('sawtooth', 140, 55, 1.6, 0.35, 0, 0.08);
    this.tone('sawtooth', 147, 58, 1.6, 0.25, 0, 0.08);
    this.noise(1.6, 900, 120, 0.8, 'bandpass', 0.6, 0, 0.1);
  },
  flow() { if (this.P('sfx_perfect_dodge', 0.9)) { this.ting(3400); return; } this.tone('sine', 300, 1600, 0.45, 0.3); this.noise(0.6, 800, 4000, 3, 'bandpass', 0.25); this.ting(3400); },
  jump() { this.hv('jump', 0.35); if (this.P('sfx_jump', 0.6)) return; this.noise(0.18, 900, 3500, 1.5, 'bandpass', 0.3); },
  land() { if (this.P('sfx_land', 0.7)) return; this.noise(0.12, 800, 150, 0.7, 'lowpass', 0.3); },
  charge(level) { if (this.has('sfx_charge_loop')) return; this.tone('sine', 220 + level * 400, 260 + level * 420, 0.08, 0.06); },
  deflect() { if (this.P('sfx_deflect', 0.9)) return; this.ting(1900); this.noise(0.25, 4000, 900, 1, 'bandpass', 0.4); this.tone('square', 600, 1200, 0.1, 0.06); },
  playerHurt() { this.hv('hurt', 1, 0.25); if (this.P('sfx_hurt', 0.8)) return; this.tone('square', 300, 90, 0.18, 0.12); this.noise(0.25, 2000, 300, 0.7, 'lowpass', 0.6); },
  breakS() { if (this.P('sfx_posture_break', 1)) { this.bv('stagger', 1, 0.2); return; } this.boom(0.8); this.ting(1200); this.noise(0.6, 6000, 1000, 0.6, 'highpass', 0.35); },
  crumble() { if (this.P('sfx_pillar_crumble', 0.9)) return; this.noise(1.2, 700, 60, 0.6, 'lowpass', 0.9); this.tone('sine', 70, 30, 0.8, 0.7); for (let i = 0; i < 6; i++) this.noise(0.08, 2500, 600, 1, 'bandpass', 0.25, 0.1 + i * 0.09); },
  cutIn(boss) { if (this.P(boss ? 'sfx_cutin_boss' : 'sfx_cutin_hero', 0.9)) return; this.noise(0.35, 400, 5000, 1.2, 'bandpass', 0.5); this.ting(boss ? 900 : 2200); this.tone(boss ? 'sawtooth' : 'triangle', boss ? 110 : 330, boss ? 70 : 660, 0.5, 0.15); },
  clash() { if (this.P('sfx_clash', 1)) { this.hit(1.3); return; } this.ting(1500); this.ting(2300); this.noise(0.3, 7000, 1500, 0.8, 'highpass', 0.6); this.tone('square', 800, 300, 0.15, 0.12); this.hit(1.3); },
  ui() { if (this.P('sfx_ui_move', 0.6, { jitter: false })) return; this.tone('triangle', 880, 880, 0.08, 0.12); },
  // ---------- score moments ----------
  musicCut() { if (!this.ctx) return; const g = this.music.gain; g.cancelScheduledValues(this.ctx.currentTime); g.setTargetAtTime(0, this.ctx.currentTime, 0.02); },
  musicRestore() { if (!this.ctx) return; const g = this.music.gain; g.cancelScheduledValues(this.ctx.currentTime); g.setTargetAtTime(this.musicVol ?? 0.55, this.ctx.currentTime, 0.3); },
  riser(dur = 1.4) {
    if (this.P('sfx_riser', 0.8, { bus: this.music })) { this.taiko(dur, 1.2); return; }
    this.noise(dur, 300, 6000, 2, 'bandpass', 0.35, 0, dur * 0.9, this.music);
    this.tone('sawtooth', 110, 440, dur, 0.08, 0, dur * 0.9, this.music);
    this.taiko(dur, 1.2); this.taiko(dur, 1.0, 0.7);
  },
  awaken() {
    this.musicCut();
    if (this.P('sfx_awaken', 1)) { setTimeout(() => this.musicRestore(), 1300); return; }
    this.tone('sine', 220, 880, 1.2, 0.3); this.noise(1.4, 500, 7000, 2.5, 'bandpass', 0.4);
    [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', 330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), 1.6, 0.09, 0.25 + i * 0.09));
    setTimeout(() => this.musicRestore(), 1300);
  },
  defeat() {
    if (this.track) { this.track.stop(0.8); this.track = null; this._wantMusic = 'none'; }
    this.P('stinger_defeat', 1, { bus: this.music, jitter: false, delay: 0.3 });
  },
  stinger(key) { return this.P(key, 1, { bus: this.music, jitter: false }); },
  victory() {
    this.musicRestore();
    if (this.track) { this.track.stop(0.6); this.track = null; this._wantMusic = 'none'; }
    if (this.P('stinger_victory', 1, { bus: this.music, jitter: false })) return;
    const ch = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]];
    ch.forEach((c, i) => c.forEach(s => { const f = 220 * Math.pow(2, s / 12); this.tone('triangle', f, f, i === 3 ? 2.6 : 0.55, 0.08, i * 0.42, 0.01, this.music); this.tone('sine', f * 2, f * 2, i === 3 ? 2.2 : 0.4, 0.03, i * 0.42, 0.01, this.music); }));
    for (let i = 0; i < 4; i++) this.taiko(i * 0.42, i === 3 ? 1.3 : 0.8);
  },
  // ---------- music: procedural taiko + drone ----------
  startMusic() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.intensity = 0; // 0 = calm, 1 = fight, 2 = phase 2
    const drone = ctx.createGain(); drone.gain.value = 0.0; drone.connect(this.music);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.connect(drone);
    [55, 55.4, 82.4].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); });
    this.drone = drone; this.droneLp = lp;
    this.step = 0; this.nextT = ctx.currentTime + 0.1;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    this.melody = scale;
    this._timer = setInterval(() => this.schedule(), 50);
  },
  schedule() {
    const ctx = this.ctx; if (!ctx) return;
    const I = this.intensity;
    const bpm = I >= 3 ? 140 : I >= 2 ? 128 : 104;
    const sp = 60 / bpm / 4;
    this.drone.gain.setTargetAtTime(this.musicOn && !this.track && !this.samplesOn() ? (I === 0 ? 0.05 : 0.08) : 0, ctx.currentTime, 0.5);
    this.droneLp.frequency.setTargetAtTime(I >= 2 ? 600 : 320, ctx.currentTime, 1);
    while (this.nextT < ctx.currentTime + 0.2) {
      this.pickMusic(I);
      if (this.musicOn && I > 0 && !this.track && !this.samplesOn()) this.playStep(this.step % 32, this.nextT - ctx.currentTime, I);
      this.step++; this.nextT += sp;
    }
  },
  taiko(delay, v, f = 1) {
    this.tone('sine', 120 * f, 46 * f, 0.45, 0.7 * v, delay, 0.002, this.music);
    this.noise(0.06, 1800, 400, 0.6, 'lowpass', 0.3 * v, delay, 0.001, this.music);
  },
  rim(delay, v) { this.noise(0.04, 5000, 3000, 2, 'bandpass', 0.25 * v, delay, 0.001, this.music); },
  pluck(delay, semis, v) {
    const f = 220 * Math.pow(2, semis / 12);
    this.tone('triangle', f, f * 0.995, 0.5, 0.09 * v, delay, 0.003, this.music);
    this.tone('sine', f * 2, f * 2, 0.25, 0.03 * v, delay, 0.003, this.music);
  },
  playStep(s, d, I) {
    const big = [0, 6, 10, 16, 22, 26, 28];
    if (big.includes(s)) this.taiko(d, s % 16 === 0 ? 1 : 0.7);
    if (I >= 2 && (s % 4 === 2)) this.taiko(d, 0.4, 1.6);
    if (I >= 3 && (s % 2 === 1)) this.taiko(d, 0.3, 2.1);
    if (s % 4 === 0 || (I >= 2 && s % 2 === 0)) this.rim(d, s % 8 === 4 ? 1 : 0.5);
    const mel = [0, -1, 2, -1, 4, -1, 3, 2, 0, -1, 2, -1, 5, 4, 3, -1, 0, -1, 2, -1, 4, -1, 6, 5, 4, -1, 3, -1, 2, 1, 0, -1];
    const m = mel[s];
    if (m >= 0 && (s % 2 === 0 || I >= 2)) this.pluck(d, this.melody[m] + (I >= 3 ? 5 : I >= 2 ? 2 : 0), 1);
    if (I >= 3 && m >= 0 && s % 4 === 0) this.pluck(d, this.melody[m] + 17, 0.6);
  },
};

/* ============================================================
   Input: keyboard + mouse (pointer lock) + gamepad, unified
   ============================================================ */
const Input = {
  keys: {}, kp: new Set(), mb: {}, mp: new Set(), mdx: 0, mdy: 0,
  prevPad: [], padConnected: false, lastDevice: 'kb',
  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', e => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.kp.add(e.code);
      this.keys[e.code] = true; this.lastDevice = 'kb';
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mb = {}; });
    canvas.addEventListener('mousedown', e => { this.mb[e.button] = true; this.mp.add(e.button); this.lastDevice = 'kb'; e.preventDefault(); });
    window.addEventListener('mouseup', e => { this.mb[e.button] = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas) { this.mdx += e.movementX; this.mdy += e.movementY; }
    });
    window.addEventListener('gamepadconnected', () => { this.padConnected = true; });
  },
  lock() {
    try { if (document.pointerLockElement !== this.canvas && this.canvas.requestPointerLock) { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* not allowed in this frame */ }
  },
  unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} },
  poll() {
    const k = this.keys, kp = this.kp, mp = this.mp;
    const a = {
      mx: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
      my: (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0),
      cx: this.mdx * 0.0026 + ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0)) * 0.045,
      cy: this.mdy * 0.0022 + ((k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0)) * 0.03,
      jump: kp.has('Space'),
      dash: kp.has('ShiftLeft') || kp.has('ShiftRight'),
      light: mp.has(0) || kp.has('KeyJ'),
      heavy: mp.has(2) || kp.has('KeyK'),
      heavyHeld: !!(this.mb[2] || k.KeyK),
      special: kp.has('KeyE') || kp.has('KeyL'),
      lock: kp.has('KeyQ') || mp.has(1),
      pause: kp.has('Escape') || kp.has('KeyP'),
      confirm: kp.has('Enter') || kp.has('Space') || mp.has(0),
      restart: kp.has('KeyR'),
      mute: kp.has('KeyM'),
      help: kp.has('KeyH'),
      any: kp.size > 0 || mp.size > 0,
      up: kp.has('ArrowUp') || kp.has('KeyW'), down: kp.has('ArrowDown') || kp.has('KeyS'),
      left: kp.has('ArrowLeft') || kp.has('KeyA'), right: kp.has('ArrowRight') || kp.has('KeyD'),
      accept: kp.has('Enter') || kp.has('Space'), back: kp.has('Escape'),
    };
    // gamepad (standard mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (pad) {
      const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const pr = i => b(i) && !this.prevPad[i];
      const dz = v => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0), rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
      if (Math.abs(lx) + Math.abs(ly) > 0) { a.mx = lx; a.my = -ly; }
      a.cx += rx * 0.05; a.cy += ry * 0.035;
      a.jump = a.jump || pr(0);
      a.dash = a.dash || pr(1) || pr(4) || pr(6);
      a.light = a.light || pr(2);
      a.heavy = a.heavy || pr(3);
      a.heavyHeld = a.heavyHeld || b(3);
      a.special = a.special || pr(5) || pr(7);
      a.lock = a.lock || pr(11) || pr(10);
      a.pause = a.pause || pr(9);
      a.confirm = a.confirm || pr(0) || pr(9);
      a.restart = a.restart || pr(8);
      a.up = a.up || pr(12); a.down = a.down || pr(13); a.left = a.left || pr(14); a.right = a.right || pr(15);
      a.accept = a.accept || pr(0); a.back = a.back || pr(1);
      let anyPad = false;
      for (let i = 0; i < pad.buttons.length; i++) if (pr(i)) anyPad = true;
      if (anyPad || Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.3) this.lastDevice = 'pad';
      a.any = a.any || anyPad;
      this.prevPad = pad.buttons.map(x => x.pressed);
      this.padConnected = true;
    }
    const ml = Math.hypot(a.mx, a.my);
    if (ml > 1) { a.mx /= ml; a.my /= ml; }
    a.cx *= this.sens ?? 1; a.cy *= (this.sens ?? 1) * (this.invY ? -1 : 1);
    return a;
  },
  endFrame() { this.kp.clear(); this.mp.clear(); this.mdx = 0; this.mdy = 0; },
};
