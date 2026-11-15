'use strict';
/* ============================================================
   Stage 4: arenas, hazards, ring-outs, rounds, ranked tiers.
   ============================================================ */
const ARENAS = {
  ruins: { name: 'SKY RUINS', sub: 'pillars stand · no hazards' },
  moonwell: {
    name: 'MOONWELL TERRACE', sub: 'tide vents erupt · mind the edge', vents: true,
    pal: { top: 0x060a1e, mid: 0x1c2c62, hor: 0x6a72b8, sun: 0xdde8ff, fog: 0x28325e, hemiS: 0x9ab4ff, hemiG: 0x1a1a34, sunC: 0xb8c8ff, cloud: 0x5a6898 },
    floor: 0x9fb4e8,
  },
};
const ARENA_IDS = Object.keys(ARENAS);
const VENT_C = new THREE.Color(0x3aa8ff);
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const Arena = {
  id: 'ruins', vents: [], ventT: 0, cycle: -1, base: null,
  pickFor(matchId) { return ARENA_IDS[strHash(String(matchId)) % ARENA_IDS.length]; },
  set(id) {
    const A = ARENAS[id] || ARENAS.ruins; this.id = ARENAS[id] ? id : 'ruins';
    const p1 = World.palette.p1;
    if (!this.base) { this.base = {}; for (const k in p1) this.base[k] = p1[k].clone(); }
    for (const k in p1) p1[k].copy(this.base[k]);
    if (A.pal) for (const k in A.pal) p1[k].set(A.pal[k]);
    World.applyPalette(World.mix || 0);
    const fm = World.top && Array.isArray(World.top.material) ? World.top.material[1] : null;
    if (fm && fm.color) fm.color.set(A.floor || 0xffffff);
    this.buildVents(!!A.vents);
    if (this.lanterns) this.lanterns.visible = !!A.vents;
    else if (A.vents) this.buildLanterns();
  },
  buildLanterns() {
    const n = 16, g = new THREE.SphereGeometry(0.32, 10, 8), m = new THREE.MeshBasicMaterial({ color: 0xffd890 });
    const im = new THREE.InstancedMesh(g, m, n); const M = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU; M.makeTranslation(Math.cos(a) * (ARENA_R + 1.6), 1.25, Math.sin(a) * (ARENA_R + 1.6)); im.setMatrixAt(i, M); }
    this.lanterns = im; Render.scene.add(im);
  },
  buildVents(on) {
    if (!this.ventMeshes) {
      this.ventMeshes = [];
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + Math.PI / 4, pos = new V3(Math.cos(a) * 12, 0.04, Math.sin(a) * 12);
        const mat = new THREE.MeshBasicMaterial({ color: 0x4ad8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.2, 40), mat); ring.rotation.x = -Math.PI / 2; ring.position.copy(pos);
        Render.scene.add(ring); this.ventMeshes.push({ pos, ring, mat, warn: 0, erupt: 0, hit: false });
      }
    }
    for (const v of this.ventMeshes) v.ring.visible = on;
    this.vents = on ? this.ventMeshes : [];
  },
  roundStart() { this.ventT = 0; this.cycle = -1; for (const v of this.vents) { v.warn = 0; v.erupt = 0; } },
  // deterministic on both clients: the same vent fires for the same match + cycle
  update(dt) {
    if (!this.vents.length) return;
    for (const v of this.vents) {
      v.mat.opacity = 0.25 + Math.sin(G.time * 2 + v.pos.x) * 0.06 + v.warn * 0.5;
      v.ring.scale.setScalar(1 + v.warn * 0.15 * Math.sin(G.time * 30));
      if (v.erupt > 0) {
        v.erupt -= dt;
        if (Math.random() < dt * 40) FX.burst(v.pos.clone().setY(rand(0.3, 4)), 3, { speed: 6, life: 0.5, s0: 0.5, c0: C.white, c1: VENT_C, up: 10, grav: 14 });
        const p = G.player;
        if (!v.hit && p.alive && p.grounded && horizDist(p.pos, v.pos) < 2.4) {
          v.hit = true;
          const d = new V3(p.pos.x - v.pos.x, 0, p.pos.z - v.pos.z); if (d.lengthSq() < 0.01) d.set(1, 0, 0); d.normalize();
          const r = p.tryHit(6, d, 'launch', 'hazard');
          if (r === 'hit') { p.vel.y = 13; FX.popup(p.chest().add(new V3(0, 1, 0)), 'TIDE VENT', 'tag small', Render.camera); }
        }
      }
    }
    if (G.state !== 'fight') return;
    this.ventT += dt;
    const k = Math.floor(this.ventT / 6.5), ph = this.ventT - k * 6.5;
    if (k < 1) return;
    const v = this.vents[strHash((Duel.match ? Duel.match.id : 'solo') + ':' + Duel.round + ':' + k) % this.vents.length];
    if (k !== this.cycle) { this.cycle = k; v.hit = false; }
    if (ph < 1.4) v.warn = ph / 1.4;
    else if (v.warn > 0) {
      v.warn = 0; v.erupt = 0.7; v.hit = false;
      FX.groundRing(v.pos, 6, 0x4ad8ff, 0.45); FX.shockwave(v.pos.clone().setY(1), 0.5, 1.2);
      FX.burst(v.pos.clone().setY(0.5), 50, { speed: 8, life: 0.8, s0: 0.6, c0: C.white, c1: VENT_C, up: 22, grav: 18 });
      Sfx.P('sfx_water_projectile', 0.8) || Sfx.boom(0.5); FX.shake(0.2);
    }
  },
  // where is a vent about to blow? (for bots)
  danger(pos) { for (const v of this.vents) if ((v.warn > 0.2 || v.erupt > 0) && horizDist(pos, v.pos) < 3.2) return v.pos; return null; },
};

/* ---------------- ranked tiers ---------------- */
const TIERS = [[1450, 'ASCENDANT', '#ffd84a'], [1300, 'PARAGON', '#c58cff'], [1150, 'WARDEN', '#5ad1ff'], [1050, 'ADEPT', '#7be08a'], [-1e9, 'INITIATE', '#c8bca8']];
function tierOf(r) { for (const t of TIERS) if ((+r || 0) >= t[0]) return { name: t[1], color: t[2], min: t[0] }; return { name: 'INITIATE', color: '#c8bca8', min: 0 }; }
function tierTag(r) { const t = tierOf(r); return `<span class="tier" style="color:${t.color}">${t.name}</span>`; }
