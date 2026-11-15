'use strict';
/* ============================================================
   Procedural humanoid rig built from primitives.
   Visual layer only: swap this file for real models later.
   Pose convention: model faces +Z. Limbs hang along -Y.
     shoulder/hip X rotation: negative = swing forward
     left side is +X, right side is -X
   ============================================================ */
const JOINTS = ['hips', 'torso', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR'];
const ZERO3 = [0, 0, 0];

class Rig {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.j = {};
    this.cur = {}; this.target = {};
    for (const n of JOINTS) { this.cur[n] = [0, 0, 0]; this.target[n] = [0, 0, 0]; }
    this.cur.hipsY = 0; this.target.hipsY = 0;
    this.rate = 14;
    this.addHips = [0, 0];
    this.mats = [];
    this.build(spec);
    this.chains = [];
  }
  mesh(geo, mat, parent, pos, rot, scale, outline = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    parent.add(m);
    if (outline && this.spec.outline) addOutline(m, this.spec.outline);
    return m;
  }
  joint(name, parent, pos) {
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    parent.add(g);
    this.j[name] = g;
    return g;
  }
  build(s) {
    const cyl = (r0, r1, h, seg = 10) => new THREE.CylinderGeometry(r0, r1, h, seg);
    const hips = this.joint('hips', this.root, [0, s.hipH, 0]);
    this.hipBase = s.hipH;
    // pelvis
    this.mesh(new THREE.SphereGeometry(s.waist * 1.05, 12, 8), s.mPants, hips, [0, 0, 0], null, [1, 0.7, 0.85]);
    const torso = this.joint('torso', hips, [0, 0.04, 0]);
    this.chest = this.mesh(cyl(s.chestTop, s.waist, s.torsoLen, 12), s.mTop, torso, [0, s.torsoLen / 2, 0], null, [1, 1, 0.78]);
    // sash / belt
    this.mesh(cyl(s.waist * 1.08, s.waist * 1.1, 0.09, 12), s.mSash, torso, [0, 0.05, 0], null, [1, 1, 0.82]);
    const head = this.joint('head', torso, [0, s.torsoLen + 0.04, 0]);
    this.mesh(cyl(0.05 * s.neck, 0.06 * s.neck, 0.1, 8), s.mSkin, head, [0, 0.03, 0], null, null, false);
    this.headMesh = this.mesh(new THREE.SphereGeometry(s.headR, 18, 14), s.mSkin, head, [0, s.headR + 0.05, 0.01], null, [0.95, 1.05, 1]);
    this.headTop = new THREE.Object3D(); this.headTop.position.set(0, s.headR * 1.6 + 0.05, 0); head.add(this.headTop);
    for (const side of [1, -1]) {
      const L = side > 0 ? 'L' : 'R';
      const sh = this.joint('sh' + L, torso, [side * s.shoulderW, s.torsoLen - 0.05, 0]);
      this.mesh(new THREE.SphereGeometry(s.armR * 1.25, 10, 8), s.mTop, sh, [0, 0, 0]);
      this.mesh(cyl(s.armR, s.armR * 0.88, s.upperArm, 8), s.mArm, sh, [0, -s.upperArm / 2, 0]);
      const el = this.joint('el' + L, sh, [0, -s.upperArm, 0]);
      this.mesh(cyl(s.armR * 0.88, s.armR * 0.75, s.foreArm, 8), s.mFore, el, [0, -s.foreArm / 2, 0]);
      const hand = this.mesh(new THREE.SphereGeometry(s.handR, 10, 8), s.mHand, el, [0, -s.foreArm - s.handR * 0.6, 0]);
      this['hand' + L] = hand;
      const hip = this.joint('hip' + L, hips, [side * s.hipW, -0.02, 0]);
      this.mesh(cyl(s.legR, s.legR * 0.85, s.thigh, 8), s.mPants, hip, [0, -s.thigh / 2, 0]);
      const kn = this.joint('kn' + L, hip, [0, -s.thigh, 0]);
      this.mesh(cyl(s.legR * 0.85, s.legR * 0.65, s.shin, 8), s.mShin, kn, [0, -s.shin / 2, 0]);
      this['foot' + L] = this.mesh(new THREE.BoxGeometry(s.legR * 1.5, 0.08, s.legR * 2.6), s.mFoot, kn, [0, -s.shin - 0.02, s.legR * 0.5]);
    }
    if (s.extras) s.extras(this, s);
  }
  setPose(p, rate) {
    for (const n of JOINTS) { const v = p[n] || ZERO3; const t = this.target[n]; t[0] = v[0]; t[1] = v[1]; t[2] = v[2]; }
    this.target.hipsY = p.hipsY || 0;
    if (rate) this.rate = rate;
  }
  snap() { for (const n of JOINTS) { const c = this.cur[n], t = this.target[n]; c[0] = t[0]; c[1] = t[1]; c[2] = t[2]; } this.cur.hipsY = this.target.hipsY; }
  update(dt) {
    const k = 1 - Math.exp(-this.rate * dt);
    for (const n of JOINTS) {
      const c = this.cur[n], t = this.target[n];
      c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k; c[2] += (t[2] - c[2]) * k;
      this.j[n].rotation.set(c[0], c[1], c[2]);
    }
    const ad = this.addHips;
    if (ad) { this.j.hips.rotation.x += ad[0]; this.j.hips.rotation.y += ad[1]; ad[0] = 0; ad[1] = 0; }
    this.cur.hipsY += (this.target.hipsY - this.cur.hipsY) * k;
    this.j.hips.position.y = this.hipBase + this.cur.hipsY;
    if (this.model) this.model.update(dt);
  }
  handPos(L, out = new V3()) { this.root.updateMatrixWorld(); return this['hand' + L].getWorldPosition(out); }
  footPos(L, out = new V3()) { return this['foot' + L].getWorldPosition(out); }
  setFlash(v) {
    for (const m of this.flashMats || []) m.emissive.setRGB(v, v, v);
  }
}

/* verlet chain rendered as a flat ribbon (scarf, cape, ponytail) */
class Chain {
  constructor(n, seg, width, mat, opts = {}) {
    this.n = n; this.seg = seg; this.width = width;
    this.p = Array.from({ length: n }, () => new V3());
    this.q = Array.from({ length: n }, () => new V3());
    this.ribbon = new Ribbon(n, mat);
    this.ribbon.mesh.castShadow = true;
    this.grav = opts.grav ?? 9; this.damping = opts.damping ?? 0.94;
    this.taper = opts.taper ?? 0.3; this.flutter = opts.flutter ?? 1;
    this.inited = false; this.t = rand(0, 10);
  }
  reset(anchor) { for (let i = 0; i < this.n; i++) { this.p[i].copy(anchor); this.p[i].y -= i * this.seg; this.q[i].copy(this.p[i]); } this.inited = true; }
  update(dt, anchor, back, side, cam) {
    if (!this.inited) this.reset(anchor);
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    const P = this.p, Q = this.q;
    P[0].copy(anchor); Q[0].copy(anchor);
    const d2 = dt * dt;
    for (let i = 1; i < this.n; i++) {
      const p = P[i], q = Q[i];
      const vx = (p.x - q.x) * this.damping, vy = (p.y - q.y) * this.damping, vz = (p.z - q.z) * this.damping;
      q.copy(p);
      const fl = Math.sin(this.t * 9 + i * 0.9) * 2.2 * this.flutter * (i / this.n);
      p.x += vx + (back.x * 3 + side.x * fl) * d2;
      p.y += vy - this.grav * d2 + Math.cos(this.t * 7 + i) * fl * 0.5 * d2;
      p.z += vz + (back.z * 3 + side.z * fl) * d2;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < this.n; i++) {
        const a = P[i - 1], b = P[i];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5;
        const k = (d - this.seg) / d;
        if (i === 1) { b.x -= dx * k; b.y -= dy * k; b.z -= dz * k; }
        else { b.x -= dx * k * 0.5; b.y -= dy * k * 0.5; b.z -= dz * k * 0.5; a.x += dx * k * 0.5; a.y += dy * k * 0.5; a.z += dz * k * 0.5; }
      }
      P[0].copy(anchor);
      for (let i = 1; i < this.n; i++) if (P[i].y < 0.03) P[i].y = 0.03;
    }
    const w = this.width, tp = this.taper;
    this.ribbon.build(P, this.n, t => w * (1 - t * (1 - tp)), cam, side);
  }
}

/* ---------------- Hero: "Tavi", wind dancer of the Hollow Sky ---------------- */
function makeHeroRig() {
  const mSkin = toon(0xf0c8a0), mTop = toon(0x2b3a86), mArm = toon(0x2b3a86), mFore = toon(0xe9e3d3);
  const mPants = toon(0xe9e3d3), mShin = toon(0x3a3240), mFoot = toon(0x2a2228), mSash = toon(0x1fd1b8);
  const mHair = toon(0x1a1c2c), mHand = toon(0xf0c8a0);
  const spec = {
    outline: 0.018, hipH: 0.93, torsoLen: 0.5, chestTop: 0.2, waist: 0.15, headR: 0.135, neck: 1,
    shoulderW: 0.22, armR: 0.055, upperArm: 0.29, foreArm: 0.27, handR: 0.055, hipW: 0.1, legR: 0.075,
    thigh: 0.44, shin: 0.43,
    mSkin, mTop, mArm, mFore, mPants, mShin, mFoot, mSash, mHand,
    extras(rig, s) {
      const head = rig.j.head;
      // spiky anime hair
      const hairBase = rig.mesh(new THREE.SphereGeometry(s.headR * 1.08, 14, 10, 0, TAU, 0, Math.PI * 0.55), mHair, head, [0, s.headR + 0.07, -0.01], [-0.25, 0, 0]);
      const spikes = [[0, 0.2, -0.08, -0.9, 0], [0.09, 0.17, -0.06, -0.7, -0.6], [-0.09, 0.17, -0.06, -0.7, 0.6], [0.05, 0.22, 0.04, -0.2, -0.3], [-0.05, 0.22, 0.04, -0.2, 0.3], [0.12, 0.1, 0.05, 0.3, -1.1], [-0.12, 0.1, 0.05, 0.3, 1.1], [0, 0.14, 0.11, 0.9, 0]];
      for (const [x, y, z, rx, rz] of spikes) rig.mesh(new THREE.ConeGeometry(0.05, 0.2, 5), mHair, head, [x, y + 0.08, z], [rx, 0, rz]);
      // headband
      rig.mesh(new THREE.TorusGeometry(s.headR * 1.0, 0.016, 6, 20), mSash, head, [0, s.headR + 0.1, 0.0], [Math.PI / 2 + 0.15, 0, 0], null, false);
      // eyes (simple bright slits for readability)
      const eyeM = new THREE.MeshBasicMaterial({ color: 0x0e1a2a });
      for (const sx of [1, -1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.01), eyeM); e.position.set(sx * 0.05, s.headR + 0.06, s.headR * 0.95); head.add(e); }
      // shoulder wraps + arm guards
      for (const L of ['L', 'R']) rig.mesh(new THREE.CylinderGeometry(s.armR * 1.05, s.armR * 1.05, 0.12, 8), mSash, rig.j['el' + L], [0, -s.foreArm * 0.6, 0]);
      // flowing tunic skirt
      rig.mesh(new THREE.CylinderGeometry(s.waist * 1.08, s.waist * 1.7, 0.36, 12, 1, true), mTop, rig.j.hips, [0, -0.15, 0], null, [1, 1, 0.85]);
      rig.flashMats = [mSkin, mTop, mArm, mFore, mPants];
      // scarf (two tails) + ponytail
      const scarfMat = new THREE.MeshBasicMaterial({ color: 0x22e0c4, side: THREE.DoubleSide });
      rig.scarfA = new Chain(10, 0.16, 0.075, scarfMat, { grav: 6, flutter: 1.2, taper: 0.6 });
      rig.scarfB = new Chain(8, 0.15, 0.06, scarfMat, { grav: 6, flutter: 1.4, taper: 0.5 });
      rig.tail = new Chain(5, 0.08, 0.05, new THREE.MeshBasicMaterial({ color: 0x1a1c2c, side: THREE.DoubleSide }), { grav: 12, flutter: 0.4, taper: 0.3 });
      rig.chains = [rig.scarfA, rig.scarfB, rig.tail];
    },
  };
  const rig = new Rig(spec);
  rig.anchorFns = [
    (o) => rig.j.torso.localToWorld(o.set(0.04, s_(rig).torsoLen + 0.02, -0.14)),
    (o) => rig.j.torso.localToWorld(o.set(-0.05, s_(rig).torsoLen + 0.0, -0.14)),
    (o) => rig.j.head.localToWorld(o.set(0, 0.26, -0.13)),
  ];
  return rig;
}
const s_ = rig => rig.spec;

/* ---------------- Boss: "Varukh, the Cinder Warden" ---------------- */
function makeBossRig() {
  const mArmor = toon(0x2c2529), mUnder = toon(0x4b1d15), mSkin = toon(0x5a3a33);
  const mHand = toon(0x3a2a28, { emissive: 0x000000 });
  const mSash = toon(0x7a1a10);
  const mBone = toon(0xd9c9a6);
  const crack = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
  const spec = {
    outline: 0.022, hipH: 0.92, torsoLen: 0.58, chestTop: 0.3, waist: 0.2, headR: 0.14, neck: 1.6,
    shoulderW: 0.3, armR: 0.085, upperArm: 0.3, foreArm: 0.29, handR: 0.09, hipW: 0.13, legR: 0.1,
    thigh: 0.42, shin: 0.43,
    mSkin, mTop: mArmor, mArm: mUnder, mFore: mArmor, mPants: mUnder, mShin: mArmor, mFoot: mArmor, mSash, mHand,
    extras(rig, s) {
      const head = rig.j.head, torso = rig.j.torso;
      // mask + horns
      rig.mesh(new THREE.BoxGeometry(0.2, 0.18, 0.06), mBone, head, [0, s.headR + 0.05, s.headR * 0.85]);
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xffb030 });
      for (const sx of [1, -1]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.02), eyeM); e.position.set(sx * 0.045, s.headR + 0.08, s.headR * 0.85 + 0.035); e.rotation.z = sx * -0.25; head.add(e);
        rig.mesh(new THREE.ConeGeometry(0.035, 0.32, 6), mBone, head, [sx * 0.12, s.headR + 0.2, -0.02], [-0.4, 0, sx * -0.7]);
        rig.mesh(new THREE.ConeGeometry(0.025, 0.18, 6), mBone, head, [sx * 0.22, s.headR + 0.36, -0.08], [-0.6, 0, sx * -0.2]);
      }
      rig.eyeMat = eyeM;
      // pauldrons
      for (const L of ['L', 'R']) {
        const sx = L === 'L' ? 1 : -1;
        rig.mesh(new THREE.SphereGeometry(0.17, 10, 8, 0, TAU, 0, Math.PI / 2), mArmor, rig.j['sh' + L], [sx * 0.03, 0.02, 0], [0, 0, sx * -0.35], [1.1, 0.8, 1.1]);
        rig.mesh(new THREE.ConeGeometry(0.03, 0.14, 5), mBone, rig.j['sh' + L], [sx * 0.08, 0.13, 0], [0, 0, sx * -0.5]);
        // glowing gauntlets
        const g = new THREE.Mesh(new THREE.SphereGeometry(s.handR * 1.25, 10, 8), crack);
        g.position.set(0, -s.foreArm - s.handR * 0.6, 0); g.userData.noGhost = true;
        rig.j['el' + L].add(g);
        rig['glow' + L] = g;
      }
      // molten core + cracks
      rig.core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), crack);
      rig.core.position.set(0, s.torsoLen * 0.62, s.chestTop * 0.78);
      torso.add(rig.core);
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), crack);
        c.position.set(Math.cos(i * 1.3) * 0.09, s.torsoLen * 0.62 + Math.sin(i * 1.3) * 0.09, s.chestTop * 0.74);
        c.rotation.z = i * 1.3 + Math.PI / 2;
        torso.add(c);
      }
      // armored skirt (tassets)
      rig.mesh(new THREE.CylinderGeometry(s.waist * 1.15, s.waist * 1.75, 0.38, 8, 1, true), mArmor, rig.j.hips, [0, -0.15, 0]);
      rig.crackMat = crack;
      rig.flashMats = [mArmor, mUnder, mSkin, mBone];
      const capeMat = new THREE.MeshBasicMaterial({ color: 0x5c120c, side: THREE.DoubleSide });
      rig.capeA = new Chain(7, 0.17, 0.2, capeMat, { grav: 10, flutter: 0.6, taper: 1.2 });
      rig.chains = [rig.capeA];
    },
  };
  const rig = new Rig(spec);
  rig.anchorFns = [(o) => rig.j.torso.localToWorld(o.set(0, s_(rig).torsoLen - 0.02, -0.22))];
  return rig;
}

/* update chains for a rig */
function updateRigChains(rig, dt, cam) {
  if (!rig.chains || !rig.chains.length) return;
  rig.root.updateMatrixWorld(true);
  const yaw = rig.root.rotation.y;
  const back = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const side = new V3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1);
  const a = new V3();
  rig.chains.forEach((c, i) => { rig.anchorFns[i](a); c.update(dt, a, back, side, cam); });
}

/* ---------------- Pose libraries ---------------- */
const HERO_POSES = {
  idle: { hipsY: -0.07, hips: [0, 0.35, 0], torso: [0.08, -0.15, 0], head: [0, -0.2, 0], shL: [-0.7, 0, 0.25], elL: [-1.3, 0, 0], shR: [-0.25, 0, -0.35], elR: [-1.6, 0, 0], hipL: [-0.35, 0, 0.12], knL: [0.45, 0, 0], hipR: [0.3, 0, -0.12], knR: [0.35, 0, 0] },
  jump: { hipsY: 0.05, torso: [0.15, 0, 0], shL: [-0.4, 0, 1.1], elL: [-0.4, 0, 0], shR: [-0.4, 0, -1.1], elR: [-0.4, 0, 0], hipL: [-1.3, 0, 0], knL: [1.8, 0, 0], hipR: [-0.5, 0, 0], knR: [1.2, 0, 0] },
  flip: { hipsY: 0.1, torso: [0.5, 0, 0], head: [0.3, 0, 0], shL: [-1.2, 0, 0.6], elL: [-1.2, 0, 0], shR: [-1.2, 0, -0.6], elR: [-1.2, 0, 0], hipL: [-1.9, 0, 0.1], knL: [2.3, 0, 0], hipR: [-1.9, 0, -0.1], knR: [2.3, 0, 0] },
  fall: { torso: [-0.05, 0, 0], shL: [-0.2, 0, 0.8], elL: [-0.3, 0, 0], shR: [-0.2, 0, -0.8], elR: [-0.3, 0, 0], hipL: [-0.6, 0, 0.1], knL: [0.9, 0, 0], hipR: [-0.1, 0, -0.1], knR: [0.5, 0, 0] },
  dash: { hipsY: -0.05, torso: [0.75, 0, 0], head: [-0.5, 0, 0], shL: [1.1, 0, 0.35], elL: [-0.2, 0, 0], shR: [1.1, 0, -0.35], elR: [-0.2, 0, 0], hipL: [-0.9, 0, 0], knL: [1.3, 0, 0], hipR: [0.7, 0, 0], knR: [1.1, 0, 0] },
  backstep: { hipsY: -0.1, torso: [-0.3, 0, 0], shL: [-0.9, 0, 0.6], elL: [-0.8, 0, 0], shR: [-0.9, 0, -0.6], elR: [-0.8, 0, 0], hipL: [-0.9, 0, 0], knL: [0.9, 0, 0], hipR: [0.2, 0, 0], knR: [0.8, 0, 0] },
  // light combo (wind, strike)
  L1w: { hipsY: -0.1, hips: [0, 0.6, 0], torso: [0, 0.5, 0], shR: [0.4, 0, -0.5], elR: [-2.0, 0, 0], shL: [-1.2, 0, 0.3], elL: [-0.6, 0, 0], hipL: [-0.5, 0, 0], knL: [0.6, 0, 0], hipR: [0.4, 0, 0], knR: [0.5, 0, 0] },
  L1: { hipsY: -0.16, hips: [0, -0.3, 0], torso: [0.12, -0.6, 0], shR: [-1.6, 0.3, 0.15], elR: [-0.05, 0, 0], shL: [-0.2, 0, 0.7], elL: [-1.6, 0, 0], hipL: [-0.8, 0, 0], knL: [0.6, 0, 0], hipR: [0.6, 0, 0], knR: [0.15, 0, 0] },
  L2w: { hipsY: -0.12, hips: [0, -0.6, 0], torso: [0.1, -0.4, 0], shL: [-0.4, 0, 1.2], elL: [-0.3, 0, 0], shR: [-0.4, 0, -1.2], elR: [-0.3, 0, 0], hipL: [-0.3, 0, 0], knL: [0.7, 0, 0], hipR: [0.3, 0, 0], knR: [0.6, 0, 0] },
  L2: { hipsY: 0.02, hips: [0, 0.4, 0.15], torso: [0, 0.2, 0.45], shL: [-0.3, 0, 1.4], elL: [0, 0, 0], shR: [0.4, 0, -0.9], elR: [-0.6, 0, 0], hipL: [0.1, 0, 0.15], knL: [0.2, 0, 0], hipR: [-0.5, 0.2, -1.35], knR: [0.05, 0, 0] },
  L3w: { hipsY: -0.2, hips: [0, 0.2, 0], torso: [-0.15, 0.2, 0], shL: [0.3, 0, 0.3], elL: [-2.2, 0, 0], shR: [0.3, 0, -0.3], elR: [-2.2, 0, 0], hipL: [-0.6, 0, 0], knL: [1.0, 0, 0], hipR: [0.4, 0, 0], knR: [0.9, 0, 0] },
  L3: { hipsY: -0.26, hips: [0, 0, 0], torso: [0.3, 0, 0], head: [-0.2, 0, 0], shL: [-1.6, 0, -0.18], elL: [0, 0, 0], shR: [-1.6, 0, 0.18], elR: [0, 0, 0], hipL: [-1.0, 0, 0.1], knL: [1.0, 0, 0], hipR: [0.8, 0, -0.1], knR: [0.05, 0, 0] },
  L4w: { hipsY: -0.3, hips: [0, 0.8, 0], torso: [0.3, 0.6, 0], shL: [-0.2, 0, 1.0], elL: [-0.8, 0, 0], shR: [0.6, 0, -0.6], elR: [-0.8, 0, 0], hipL: [-0.9, 0, 0], knL: [1.5, 0, 0], hipR: [0.4, 0, 0], knR: [1.4, 0, 0] },
  L4: { hipsY: 0.2, hips: [0, -0.2, 0], torso: [-0.5, -0.3, 0], head: [0.3, 0, 0], shL: [-0.1, 0, 1.5], elL: [0, 0, 0], shR: [0.4, 0, -1.3], elR: [0, 0, 0], hipL: [0.35, 0, 0.1], knL: [0.25, 0, 0], hipR: [-2.6, 0, -0.05], knR: [0, 0, 0] },
  // aerial
  A1: { torso: [0.3, -0.5, 0], shR: [-1.6, 0.2, 0], elR: [0, 0, 0], shL: [-0.3, 0, 1.0], elL: [-1.0, 0, 0], hipL: [-1.4, 0, 0], knL: [2.0, 0, 0], hipR: [-0.4, 0, 0], knR: [0.9, 0, 0] },
  A2: { torso: [0.1, 0.6, -0.3], shL: [-1.6, -0.2, 0], elL: [0, 0, 0], shR: [-0.3, 0, -1.0], elR: [-1.0, 0, 0], hipL: [-1.5, 0, 0.2], knL: [0.1, 0, 0], hipR: [-0.3, 0, 0], knR: [1.6, 0, 0] },
  A3: { hipsY: 0.1, torso: [0.9, 0, 0], head: [-0.4, 0, 0], shL: [-2.6, 0, 0.3], elL: [0, 0, 0], shR: [-2.6, 0, -0.3], elR: [0, 0, 0], hipL: [-0.6, 0, 0], knL: [1.8, 0, 0], hipR: [0.4, 0, 0], knR: [1.6, 0, 0] },
  charge: { hipsY: -0.32, hips: [0, 1.0, 0], torso: [0.25, 0.6, 0], head: [0, -1.1, 0], shL: [0.5, 0, 0.5], elL: [-2.0, 0, 0], shR: [0.6, 0, -0.1], elR: [-2.1, 0, 0], hipL: [-1.1, 0, 0.2], knL: [1.5, 0, 0], hipR: [0.6, 0, -0.2], knR: [0.9, 0, 0] },
  release: { hipsY: -0.3, hips: [0, -0.5, 0], torso: [0.25, -0.4, 0], head: [0, 0.2, 0], shL: [-1.55, 0.2, -0.1], elL: [0, 0, 0], shR: [-1.55, -0.2, 0.1], elR: [0, 0, 0], hipL: [-1.1, 0, 0.1], knL: [1.1, 0, 0], hipR: [0.9, 0, -0.1], knR: [0.05, 0, 0] },
  slam: { hipsY: 0.1, torso: [0.6, 0, 0], shL: [-2.9, 0, 0.35], elL: [-0.2, 0, 0], shR: [-2.9, 0, -0.35], elR: [-0.2, 0, 0], hipL: [-1.6, 0, 0], knL: [2.2, 0, 0], hipR: [-1.4, 0, 0], knR: [2.2, 0, 0] },
  slamLand: { hipsY: -0.45, torso: [0.7, 0, 0], head: [-0.4, 0, 0], shL: [-1.2, 0, 0.9], elL: [0, 0, 0], shR: [-1.2, 0, -0.9], elR: [0, 0, 0], hipL: [-1.5, 0, 0.3], knL: [2.2, 0, 0], hipR: [0.3, 0, -0.3], knR: [1.8, 0, 0] },
  hit: { hipsY: -0.05, torso: [-0.55, 0, 0.1], head: [-0.4, 0, 0], shL: [-0.6, 0, 0.9], elL: [-0.5, 0, 0], shR: [-0.6, 0, -0.9], elR: [-0.5, 0, 0], hipL: [-0.2, 0, 0], knL: [0.4, 0, 0], hipR: [0.3, 0, 0], knR: [0.3, 0, 0] },
  launched: { torso: [-0.9, 0, 0], head: [-0.4, 0, 0], shL: [-0.4, 0, 1.4], elL: [-0.3, 0, 0], shR: [-0.4, 0, -1.4], elR: [-0.3, 0, 0], hipL: [-0.6, 0, 0], knL: [1.0, 0, 0], hipR: [-0.2, 0, 0], knR: [0.6, 0, 0] },
  down: { hipsY: -0.72, hips: [-1.45, 0, 0], torso: [-0.1, 0, 0], head: [0.3, 0, 0], shL: [-0.2, 0, 0.6], elL: [-0.2, 0, 0], shR: [-0.2, 0, -0.6], elR: [-0.2, 0, 0], hipL: [-0.1, 0, 0.1], knL: [0.3, 0, 0], hipR: [0.1, 0, -0.1], knR: [0.1, 0, 0] },
  special: { hipsY: 0.1, torso: [-0.3, 0, 0], head: [-0.4, 0, 0], shL: [-0.3, 0, 2.3], elL: [0, 0, 0], shR: [-0.3, 0, -2.3], elR: [0, 0, 0], hipL: [-0.9, 0, 0.1], knL: [1.6, 0, 0], hipR: [-0.1, 0, -0.1], knR: [0.9, 0, 0] },
  counter: { hipsY: -0.3, hips: [0, 0.4, 0], torso: [0.4, -0.8, 0], shR: [-1.7, 0, 0], elR: [0, 0, 0], shL: [0.6, 0, 0.8], elL: [-0.4, 0, 0], hipL: [-1.2, 0, 0], knL: [1.3, 0, 0], hipR: [0.9, 0, 0], knR: [0.2, 0, 0] },
  victory: { hipsY: 0, torso: [-0.1, 0, 0], head: [-0.2, 0, 0], shR: [-3.0, 0, -0.2], elR: [-0.2, 0, 0], shL: [0.1, 0, 0.3], elL: [-1.6, 0, 0], hipL: [-0.05, 0, 0.1], knL: [0.05, 0, 0], hipR: [0.15, 0, -0.1], knR: [0.1, 0, 0] },
};

const BOSS_POSES = {
  idle: { hipsY: -0.1, torso: [0.15, -0.2, 0], head: [-0.05, 0.15, 0], shL: [-0.5, 0, 0.45], elL: [-1.3, 0, 0], shR: [-0.3, 0, -0.5], elR: [-1.5, 0, 0], hipL: [-0.35, 0, 0.2], knL: [0.5, 0, 0], hipR: [0.35, 0, -0.2], knR: [0.45, 0, 0] },
  throwW: { hipsY: -0.15, torso: [-0.1, 0.8, 0], shR: [0.7, 0, -0.9], elR: [-1.6, 0, 0], shL: [-1.2, 0, 0.3], elL: [-0.4, 0, 0], hipL: [-0.5, 0, 0.2], knL: [0.6, 0, 0], hipR: [0.4, 0, -0.2], knR: [0.5, 0, 0] },
  throwR: { hipsY: -0.2, torso: [0.25, -0.6, 0], shR: [-1.7, 0.3, 0], elR: [0, 0, 0], shL: [0.4, 0, 0.6], elL: [-1.2, 0, 0], hipL: [-0.7, 0, 0.2], knL: [0.6, 0, 0], hipR: [0.6, 0, -0.2], knR: [0.2, 0, 0] },
  throwL: { hipsY: -0.2, torso: [0.25, 0.6, 0], shL: [-1.7, -0.3, 0], elL: [0, 0, 0], shR: [0.4, 0, -0.6], elR: [-1.2, 0, 0], hipL: [-0.7, 0, 0.2], knL: [0.6, 0, 0], hipR: [0.6, 0, -0.2], knR: [0.2, 0, 0] },
  slamW: { hipsY: 0.05, torso: [-0.35, 0, 0], head: [-0.3, 0, 0], shL: [-2.9, 0, 0.4], elL: [-0.5, 0, 0], shR: [-2.9, 0, -0.4], elR: [-0.5, 0, 0], hipL: [-0.2, 0, 0.2], knL: [0.2, 0, 0], hipR: [0.1, 0, -0.2], knR: [0.2, 0, 0] },
  slam: { hipsY: -0.45, torso: [0.9, 0, 0], head: [-0.5, 0, 0], shL: [-1.4, 0, 0.1], elL: [-0.2, 0, 0], shR: [-1.4, 0, -0.1], elR: [-0.2, 0, 0], hipL: [-1.3, 0, 0.3], knL: [1.9, 0, 0], hipR: [0.4, 0, -0.3], knR: [1.6, 0, 0] },
  rushW: { hipsY: -0.35, torso: [0.6, -0.5, 0], head: [-0.5, 0.4, 0], shR: [0.9, 0, -0.4], elR: [-1.8, 0, 0], shL: [-0.8, 0, 0.6], elL: [-1.4, 0, 0], hipL: [-1.0, 0, 0.2], knL: [1.4, 0, 0], hipR: [0.7, 0, -0.2], knR: [1.0, 0, 0] },
  rush: { hipsY: -0.2, torso: [0.8, 0, 0], head: [-0.6, 0, 0], shL: [0.9, 0, 0.4], elL: [-0.6, 0, 0], shR: [0.9, 0, -0.4], elR: [-0.6, 0, 0], hipL: [-1.0, 0, 0], knL: [1.2, 0, 0], hipR: [0.7, 0, 0], knR: [1.2, 0, 0] },
  punchA: { hipsY: -0.22, torso: [0.3, -0.7, 0], shR: [-1.65, 0.3, 0], elR: [0, 0, 0], shL: [-0.4, 0, 0.6], elL: [-1.7, 0, 0], hipL: [-0.8, 0, 0.2], knL: [0.7, 0, 0], hipR: [0.6, 0, -0.2], knR: [0.2, 0, 0] },
  punchB: { hipsY: -0.22, torso: [0.3, 0.8, 0], shL: [-1.4, -0.6, 0.4], elL: [-0.4, 0, 0], shR: [-0.4, 0, -0.6], elR: [-1.7, 0, 0], hipL: [-0.7, 0, 0.2], knL: [0.3, 0, 0], hipR: [0.6, 0, -0.2], knR: [0.7, 0, 0] },
  upperW: { hipsY: -0.45, torso: [0.5, -0.4, 0], shR: [0.6, 0, -0.3], elR: [-2.2, 0, 0], shL: [-0.6, 0, 0.6], elL: [-1.2, 0, 0], hipL: [-1.1, 0, 0.2], knL: [1.6, 0, 0], hipR: [0.5, 0, -0.2], knR: [1.3, 0, 0] },
  upper: { hipsY: 0.05, torso: [-0.4, -0.3, 0], head: [-0.3, 0, 0], shR: [-2.9, 0, -0.1], elR: [-0.3, 0, 0], shL: [0.2, 0, 0.7], elL: [-1.2, 0, 0], hipL: [-0.2, 0, 0.2], knL: [0.2, 0, 0], hipR: [0.4, 0, -0.2], knR: [0.1, 0, 0] },
  channel: { hipsY: -0.2, torso: [-0.2, 0, 0], head: [-0.2, 0, 0], shL: [-1.2, 0, 1.0], elL: [-0.6, 0, 0], shR: [-1.2, 0, -1.0], elR: [-0.6, 0, 0], hipL: [-0.3, 0, 0.35], knL: [0.5, 0, 0], hipR: [0.3, 0, -0.35], knR: [0.5, 0, 0] },
  crouch: { hipsY: -0.45, torso: [0.6, 0, 0], head: [-0.4, 0, 0], shL: [0.6, 0, 0.5], elL: [-0.6, 0, 0], shR: [0.6, 0, -0.5], elR: [-0.6, 0, 0], hipL: [-1.4, 0, 0.3], knL: [2.0, 0, 0], hipR: [-1.2, 0, -0.3], knR: [2.0, 0, 0] },
  leap: { hipsY: 0.1, torso: [0.3, 0, 0], shL: [-2.6, 0, 0.6], elL: [-0.6, 0, 0], shR: [-2.6, 0, -0.6], elR: [-0.6, 0, 0], hipL: [-1.6, 0, 0.1], knL: [2.2, 0, 0], hipR: [-1.0, 0, -0.1], knR: [1.8, 0, 0] },
  spin: { hipsY: -0.25, torso: [0.1, 0, 0], head: [0, 0, 0], shL: [-1.55, 0, 0.1], elL: [0, 0, 0], shR: [-1.55, 0, -0.1], elR: [0, 0, 0], hipL: [-0.4, 0, 0.4], knL: [0.6, 0, 0], hipR: [0.3, 0, -0.4], knR: [0.6, 0, 0] },
  spinArms: { hipsY: -0.25, torso: [0.1, 0, 0], shL: [-0.1, 0, 1.55], elL: [0, 0, 0], shR: [-0.1, 0, -1.55], elR: [0, 0, 0], hipL: [-0.4, 0, 0.4], knL: [0.6, 0, 0], hipR: [0.3, 0, -0.4], knR: [0.6, 0, 0] },
  roar: { hipsY: -0.15, torso: [-0.5, 0, 0], head: [-0.6, 0, 0], shL: [-0.6, 0, 1.4], elL: [-0.9, 0, 0], shR: [-0.6, 0, -1.4], elR: [-0.9, 0, 0], hipL: [-0.4, 0, 0.4], knL: [0.5, 0, 0], hipR: [0.4, 0, -0.4], knR: [0.5, 0, 0] },
  flinch: { hipsY: -0.12, torso: [-0.35, 0.2, 0], head: [-0.4, 0, 0], shL: [-0.3, 0, 0.7], elL: [-1.0, 0, 0], shR: [-0.3, 0, -0.7], elR: [-1.0, 0, 0], hipL: [-0.3, 0, 0.2], knL: [0.5, 0, 0], hipR: [0.4, 0, -0.2], knR: [0.4, 0, 0] },
  stagger: { hipsY: -0.48, torso: [0.75, 0, 0.1], head: [0.4, 0, 0], shL: [-0.2, 0, 0.3], elL: [-0.3, 0, 0], shR: [-0.6, 0, -0.2], elR: [-0.2, 0, 0], hipL: [-1.5, 0, 0.2], knL: [1.6, 0, 0], hipR: [0.3, 0, -0.1], knR: [2.2, 0, 0] },
  dead: { hipsY: -0.62, torso: [1.1, 0, 0.2], head: [0.6, 0, 0], shL: [0.2, 0, 0.2], elL: [-0.2, 0, 0], shR: [0.2, 0, -0.2], elR: [-0.2, 0, 0], hipL: [-1.6, 0, 0.3], knL: [2.4, 0, 0], hipR: [-1.6, 0, -0.3], knR: [2.4, 0, 0] },
};
