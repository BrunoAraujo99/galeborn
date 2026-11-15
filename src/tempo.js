'use strict';
/* ============================================================
   Anti-mash: timing over speed, stale moves, punishes.
   ============================================================ */
const Tempo = {
  recent: [], decayT: 0,
  reset() { this.recent.length = 0; this.decayT = 0; },
  // how many times this exact move landed among the last hits
  count(m) { let n = 0; for (const x of this.recent) if (x === m) n++; return n; },
  // one repeat is free, then each repeat takes 12% off (floor 55%)
  mult(m) { const n = this.count(m); return n <= 1 ? 1 : Math.max(0.55, 1 - (n - 1) * 0.12); },
  land(m) { this.recent.push(m); if (this.recent.length > 16) this.recent.shift(); this.decayT = 2.5; },
  update(dt) { if (this.recent.length && (this.decayT -= dt) <= 0) { this.recent.shift(); this.decayT = 1.2; } },
  // feedback
  perfect(p, at) {
    Sfx.ting(2900); Sfx.P('sfx_hit_crit', 0.35);
    FX.star(at, 2.6, 0xffffff, 0.12); FX.ringBill(at, 2.6, 0xffffff, 0.16);
    Render.post.flash = Math.max(Render.post.flash, 0.08);
    G.stats.perfects = (G.stats.perfects || 0) + 1;
  },
  stale(at) { Sfx.P('sfx_deflect', 0.25, { rate: 0.6 }); },
  // we hit someone stuck in recovery
  punish(at) {
    Sfx.P('sfx_hit_crit', 0.9) || Sfx.boom(0.6); Sfx.ting(1500);
    FX.popup(at.clone().add(new V3(0, 1.3, 0)), 'PUNISH!', 'break', Render.camera);
    FX.impactLines(at, 18, 0xffe27a, 4, 0.2); Render.post.flash = Math.max(Render.post.flash, 0.15); FX.shake(0.4);
    G.stats.punishes = (G.stats.punishes || 0) + 1;
  },
};
