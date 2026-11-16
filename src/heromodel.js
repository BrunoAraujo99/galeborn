'use strict';
const _e1 = new THREE.Euler();
/* ============================================================
   Hero 3D model (Meshy / Mixamo skeleton) driven by the procedural rig.
   The primitive rig keeps running invisibly and supplies the pose for
   every combat move; this layer retargets it onto the skinned model.
   The model's own clips (Running, Walking) blend in for locomotion.
   ============================================================ */
const HeroModel = {
  gltf: null,
  bufs: {},
  // web build: models are separate files fetched on demand (and cached)
  fetchBuf(id) {
    if (!this.bufs[id]) this.bufs[id] = fetch('heroes/' + id + '.glb').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    return this.bufs[id];
  },
  load(id, cb) {
    if (typeof ASSET_WEB !== 'undefined' && THREE.GLTFLoader) {
      this.fetchBuf(id).then(buf => new THREE.GLTFLoader().parse(buf.slice(0), '', g => { this.gltf = g; cb(g); }, e => { console.warn('hero model failed', e); cb(null); }))
        .catch(e => { console.warn('hero model fetch failed', e); cb(null); });
      return;
    }
    const b64 = HERO_B64()[id];
    if (!b64 || !THREE.GLTFLoader) return cb(null);
    try {
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      new THREE.GLTFLoader().parse(u8.buffer, '', g => { this.gltf = g; cb(g); }, e => { console.warn('hero model failed', e); cb(null); });
    } catch (e) { console.warn('hero model failed', e); cb(null); }
  },
};

function skinOutlineMat(th, color = 0x14101a) {
  const m = new THREE.ShaderMaterial({
    uniforms: { th: { value: th }, color: { value: new THREE.Color(color) } },
    vertexShader: `#include <common>
#include <skinning_pars_vertex>
uniform float th;
void main(){
#include <skinbase_vertex>
#include <beginnormal_vertex>
#include <skinnormal_vertex>
#include <begin_vertex>
#include <skinning_vertex>
  vec3 p = transformed + normalize(objectNormal) * th;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide,
  });
  return m;
}

const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3();

class ModelDriver {
  constructor(rig, gltf, def = Hero.def) {
    this.def = def;
    this.rig = rig;
    const scene = gltf.scene;
    this.scene = scene;
    // hide primitive meshes (keep joints for poses, hit points, effects)
    rig.root.traverse(o => { if (o.isMesh) o.visible = false; });
    rig.root.add(scene);
    rig.root.updateMatrixWorld(true);
    // material + outline
    let skin = null;
    scene.traverse(o => { if (o.isSkinnedMesh) skin = o; });
    this.skin = skin;
    const src = skin.material;
    const map = src.map;
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
    const mat = toon(0xffffff, { map, side: THREE.DoubleSide });
    skin.material = mat;
    rig.skinMat = mat; if (rig.tintHex) mat.color.setHex(rig.tintHex);
    skin.castShadow = true; skin.frustumCulled = false;
    const ol = new THREE.SkinnedMesh(skin.geometry, skinOutlineMat(0.008));
    ol.bind(skin.skeleton, skin.bindMatrix);
    ol.frustumCulled = false; ol.userData.isOutline = true;
    skin.parent.add(ol); ol.position.copy(skin.position); ol.quaternion.copy(skin.quaternion); ol.scale.copy(skin.scale);
    rig.flashMats = [mat];
    addRim(mat, def.pal.rim, 0.35, 0.68);
    // awakened aura: an inflated additive shell that shares the skeleton
    this.auraMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(def.pal.aura) } },
      vertexShader: `#include <common>
#include <skinning_pars_vertex>
uniform float time; varying float vF;
void main(){
#include <skinbase_vertex>
#include <beginnormal_vertex>
#include <skinnormal_vertex>
#include <begin_vertex>
#include <skinning_vertex>
  float st = floor(time * 12.0);
  float w = 0.03 + 0.012 * sin(st * 2.3 + transformed.y * 9.0);
  vec3 p = transformed + normalize(objectNormal) * w + vec3(0.0, 0.02 * fract(st * 0.37), 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * objectNormal);
  vF = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `uniform vec3 color; varying float vF; void main(){ float a = step(0.45, vF) * 0.55 + step(0.75, vF) * 0.35; gl_FragColor = vec4(color * (1.0 + step(0.75, vF)), a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const aura = new THREE.SkinnedMesh(skin.geometry, this.auraMat);
    aura.bind(skin.skeleton, skin.bindMatrix);
    aura.frustumCulled = false; aura.visible = false; aura.userData.noGhost = true; aura.renderOrder = 15;
    skin.parent.add(aura); aura.position.copy(skin.position); aura.quaternion.copy(skin.quaternion); aura.scale.copy(skin.scale);
    this.aura = aura;
    // bones
    const B = {};
    scene.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
    this.B = B;
    this.order = [];
    scene.traverse(o => { if (o.isBone) this.order.push(o); });
    this.armature = B.Hips.parent;
    for (const b of this.order) { b.userData.rest = b.quaternion.clone(); b.userData.restPos = b.position.clone(); }
    // calibration: bone orientation relative to the rig root at rest (primitive rig rest = identity)
    const rootQ = rig.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.calib = {};
    for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) this.calib[n] = rootQ.clone().multiply(B[n].getWorldQuaternion(new THREE.Quaternion()));
    const hipW = B.Hips.getWorldPosition(new V3());
    this.hipK = rig.root.worldToLocal(hipW).y / rig.hipBase;
    // limb chains: bone, child bone, from joint point, to joint point
    const s = rig.spec, j = rig.j;
    const P = (obj, x, y, z) => (out) => obj.localToWorld(out.set(x, y, z));
    this.limbs = [];
    for (const [L, M] of [['L', 'Left'], ['R', 'Right']]) {
      this.limbs.push([M + 'Arm', M + 'ForeArm', P(j['sh' + L], 0, 0, 0), P(j['el' + L], 0, 0, 0)]);
      this.limbs.push([M + 'ForeArm', M + 'Hand', P(j['el' + L], 0, 0, 0), P(j['el' + L], 0, -s.foreArm, 0)]);
      this.limbs.push([M + 'UpLeg', M + 'Leg', P(j['hip' + L], 0, 0, 0), P(j['kn' + L], 0, 0, 0)]);
      this.limbs.push([M + 'Leg', M + 'Foot', P(j['kn' + L], 0, 0, 0), P(j['kn' + L], 0, -s.shin, 0)]);
    }
    this.limbMap = {};
    for (const l of this.limbs) { l.push(B[l[1]].position.clone().normalize()); this.limbMap[l[0]] = l; }
    // anchor points that the game reads (hands, feet, head) now follow the model
    const anchor = (bone, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); bone.add(o); return o; };
    rig.handL = anchor(B.LeftHand, 0, 7, 0); rig.handR = anchor(B.RightHand, 0, 7, 0);
    rig.footL = anchor(B.LeftFoot, 0, 0, 5); rig.footR = anchor(B.RightFoot, 0, 0, 5);
    rig.headMesh = anchor(B.Head, 0, 10, 2);
    // anchors placed in rig-root space at rest, parented to bones so they follow the pose
    const at = (bone, x, y, z) => { const o = new THREE.Object3D(); bone.add(o); o.position.copy(bone.worldToLocal(rig.root.localToWorld(new V3(x, y, z)))); return o; };
    rig.eyeL = at(B.Head, 0.032, 1.6, 0.1); rig.eyeR = at(B.Head, -0.032, 1.6, 0.1);
    // cloth: scarf tails from the back of the neck, sash tails from the left hip (wind hero's outfit only)
    rig.tail.ribbon.mesh.visible = false;
    if (!def.cloth) {
      rig.scarfA.ribbon.mesh.visible = rig.scarfB.ribbon.mesh.visible = false;
      rig.chains = []; rig.anchorFns = [];
    } else {
    const scarfMat = new THREE.MeshBasicMaterial({ color: 0x4fb3a8, side: THREE.DoubleSide });
    const sashMat = new THREE.MeshBasicMaterial({ color: 0x6aa6d8, side: THREE.DoubleSide });
    rig.tail.ribbon.mesh.visible = false;
    const sashA = new Chain(8, 0.12, 0.1, sashMat, { grav: 7, flutter: 1.1, taper: 0.7 });
    const sashB = new Chain(6, 0.12, 0.08, sashMat, { grav: 7, flutter: 1.3, taper: 0.6 });
    for (const c of [sashA, sashB]) { c.ribbon.mesh.castShadow = true; if (rig.root.parent) rig.root.parent.add(c.ribbon.mesh); }
    rig.scarfA.ribbon.mesh.visible = rig.scarfB.ribbon.mesh.visible = true;
    rig.chains = [rig.scarfA, rig.scarfB, sashA, sashB];
    const aN1 = at(B.Spine2, 0.04, 1.43, -0.11), aN2 = at(B.Spine2, -0.04, 1.42, -0.11);
    const aS1 = at(B.Hips, 0.16, 1.0, -0.02), aS2 = at(B.Hips, 0.13, 0.99, 0.04);
    rig.anchorFns = [aN1, aN2, aS1, aS2].map(o => (out) => o.getWorldPosition(out));
    }
    // locomotion clips
    this.mixer = new THREE.AnimationMixer(scene);
    const clip = n => gltf.animations.find(a => a.name.toLowerCase().includes(n));
    const strip = c => { if (c) c.tracks = c.tracks.filter(t => !/Hips\.position/.test(t.name)); return c; };
    const run = strip(clip('run')), walk = strip(clip('walk'));
    this.run = run ? this.mixer.clipAction(run) : null;
    this.walk = walk ? this.mixer.clipAction(walk) : null;
    for (const a of [this.run, this.walk]) if (a) { a.play(); a.setEffectiveWeight(0); }
    this.locoW = 0; this.clipQ = {};
    // action clips (idle stance, jump, roll, hit, knockdown, cast, victory, kick) sampled on demand
    this.amixer = new THREE.AnimationMixer(scene);
    this.acts = {};
    for (const [k, n] of [['idle', 'idle'], ['jump', 'jump'], ['roll', 'roll'], ['hit', 'hit_'], ['knock', 'knock'], ['cast', 'cast'], ['victory', 'victor'], ['kick', 'roundhouse'], ['punch', 'punch']]) {
      const c = clip(n); if (!c) continue;
      const a = this.amixer.clipAction(c); a.play(); a.enabled = false;
      this.acts[k] = { a, dur: c.duration };
    }
    this.actW = 0; this.actQ = {}; this.xfQ = {}; this.xfT = 0; this.actKey = null; this.actHipY = 0;
    this.wq = {};
    rig.model = this;
  }
  // world-space target for a bone, then convert to its local rotation
  update(dt) {
    const rig = this.rig, B = this.B, j = rig.j;
    this.auraMat.uniforms.time.value += dt;
    // --- locomotion clip sampling
    const sp = rig.locoSp || 0; rig.locoSp = 0;
    this.locoW = damp(this.locoW, sp > 1.2 ? 1 : 0, sp > 1.2 ? 10 : 16, dt);
    const useClip = this.locoW > 0.01 && (this.run || this.walk);
    if (useClip) {
      const k = clamp((sp - 2.5) / 3, 0, 1);
      if (this.run) { this.run.setEffectiveWeight(this.walk ? k : 1); this.run.timeScale = clamp(sp / 5.2, 0.9, 1.75); }
      if (this.walk) { this.walk.setEffectiveWeight(this.run ? 1 - k : 1); this.walk.timeScale = clamp(sp / 1.6, 0.8, 1.6); }
      this.mixer.update(dt);
      for (const b of this.order) (this.clipQ[b.name] || (this.clipQ[b.name] = new THREE.Quaternion())).copy(b.quaternion);
    }
    // --- action clip sampling (rig.clipReq = [key, time])
    const req = rig.clipReq; rig.clipReq = null;
    const act = req && this.acts[req[0]];
    this.actW = damp(this.actW, act ? 1 : 0, act ? 16 : 12, dt);
    if (act) {
      if (req[0] !== this.actKey) {
        if (this.actKey && this.actW > 0.2) { for (const b of this.order) (this.xfQ[b.name] || (this.xfQ[b.name] = new THREE.Quaternion())).copy(this.actQ[b.name]); this.xfHip = this.actHipY; this.xfT = 0.12; }
        if (this.actKey && this.acts[this.actKey]) this.acts[this.actKey].a.enabled = false;
        this.actKey = req[0]; act.a.enabled = true; act.a.setEffectiveWeight(1);
      }
      act.a.time = clamp(req[1], 0, act.dur - 0.001);
      this.amixer.update(0);
      this.xfT = Math.max(0, this.xfT - dt);
      const xk = this.xfT / 0.12;
      for (const b of this.order) {
        const q = this.actQ[b.name] || (this.actQ[b.name] = new THREE.Quaternion());
        q.copy(b.quaternion); if (xk > 0) q.slerp(this.xfQ[b.name], xk);
      }
      this.actHipY = lerp(B.Hips.position.y, this.xfHip ?? B.Hips.position.y, xk);
    } else if (this.actW < 0.01 && this.actKey) { this.acts[this.actKey].a.enabled = false; this.actKey = null; }
    // --- retarget primitive pose
    rig.root.updateMatrixWorld(true);
    const armQ = this.armature.getWorldQuaternion(new THREE.Quaternion());
    const wq = this.wq;
    const worldOf = (name, q) => q.copy(j[name].getWorldQuaternion(_q3));
    for (const b of this.order) {
      const n = b.name.replace(/^mixamorig:?/, '');
      const pq = b.parent === this.armature ? armQ : (wq[b.parent.name] || armQ);
      const target = wq[b.name] || (wq[b.name] = new THREE.Quaternion());
      if (n === 'Hips') target.copy(j.hips.getWorldQuaternion(_q1)).multiply(this.calib.Hips);
      else if (n === 'Spine' || n === 'Spine1' || n === 'Spine2') {
        const f = n === 'Spine' ? 0.35 : n === 'Spine1' ? 0.7 : 1;
        _q1.copy(j.hips.getWorldQuaternion(_q3)).multiply(this.calib[n]);
        _q2.copy(j.torso.getWorldQuaternion(_q3)).multiply(this.calib[n]);
        target.copy(_q1).slerp(_q2, f);
      } else if (n === 'Neck') {
        _q1.copy(j.torso.getWorldQuaternion(_q3)).multiply(this.calib.Neck);
        _q2.copy(j.head.getWorldQuaternion(_q3)).multiply(this.calib.Neck);
        target.copy(_q1).slerp(_q2, 0.4);
      } else if (n === 'Head') target.copy(j.head.getWorldQuaternion(_q1)).multiply(this.calib.Head);
      else if (this.limbMap[n]) {
        const l = this.limbMap[n];
        target.copy(pq).multiply(b.userData.rest);
        const cur = _v1.copy(l[4]).applyQuaternion(target);
        const want = l[3](_v3).sub(l[2](_v2)).normalize();
        _q1.setFromUnitVectors(cur, want);
        target.premultiply(_q1);
      } else target.copy(pq).multiply(b.userData.rest);
      // local
      b.quaternion.copy(pq).invert().multiply(target);
    }
    // hips position: follow the primitive hips, scaled for leg length
    const hp = rig.root.worldToLocal(j.hips.getWorldPosition(_v1));
    hp.y *= this.hipK;
    const hw = rig.root.localToWorld(hp);
    const hl = this.armature.worldToLocal(hw);
    B.Hips.position.copy(hl);
    // --- blend locomotion clip on top (local space)
    if (useClip) {
      const w = this.locoW;
      for (const b of this.order) {
        const n = b.name.replace(/^mixamorig:?/, '');
        if (n === 'Hips') {
          // keep the game's facing/lean, take the clip's sway
          _q1.copy(b.userData.rest).invert().multiply(this.clipQ[b.name]);
          b.quaternion.multiply(_q2.identity().slerp(_q1, w));
          B.Hips.position.y = lerp(B.Hips.position.y, b.userData.restPos.y * 0.97, w);
          continue;
        }
        b.quaternion.slerp(this.clipQ[b.name], w * (n.startsWith('Spine') ? 0.6 : 1));
      }
    }
    // --- action clip on top of everything
    if (this.actKey && this.actW > 0.001) {
      const w = this.actW;
      for (const b of this.order) b.quaternion.slerp(this.actQ[b.name], w);
      B.Hips.position.y = lerp(B.Hips.position.y, this.actHipY, w);
      // hit whips also show on top of the model's own clips (hit reaction, knockdown)
      if (rig.ad) for (const n in rig.ad) {
        const bn = { torso: 'Spine2', head: 'Head', shL: 'LeftArm', shR: 'RightArm', hips: 'Hips' }[n], b = bn && B[bn]; if (!b) continue;
        const o = rig.ad[n].p; _e1.set(o[0] * w, o[1] * w, o[2] * w); b.quaternion.multiply(_q1.setFromEuler(_e1));
      }
    }
    // smear stretch on the striking limb
    const sm = rig.smear || 0; rig.smear = 0;
    this.smearAmt = damp(this.smearAmt || 0, sm, sm > this.smearAmt ? 60 : 18, dt);
    const limbBone = { R: 'RightForeArm', L: 'LeftForeArm', F: 'RightLeg', B: 'LeftLeg' };
    for (const k in limbBone) {
      const bn = B[limbBone[k]], on = k === rig.smearLimb ? this.smearAmt : 0;
      const st = 1 + 0.55 * on;
      bn.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
      const child = bn.children.find(c => c.isBone);
      if (child) child.scale.set(Math.sqrt(st), 1 / st, Math.sqrt(st));
    }
  }
  setAura(on) { this.aura.visible = on; }
  // freeze the current skinned pose into a static mesh (afterimages)
  // frozen copy of the current pose, skinned on the GPU (shares geometry, owns a static skeleton)
  bake(mat) {
    const skin = this.skin;
    skin.updateMatrixWorld(true); skin.skeleton.update();
    const sk = new THREE.Skeleton(skin.skeleton.bones.slice(), skin.skeleton.boneInverses);
    sk.boneMatrices.set(skin.skeleton.boneMatrices.subarray(0, sk.boneMatrices.length)); sk.update = () => {};
    const m = new THREE.SkinnedMesh(skin.geometry, mat);
    m.bindMode = skin.bindMode; m.bind(sk, skin.bindMatrix);
    m.matrixAutoUpdate = false; m.matrix.copy(skin.matrixWorld); m.matrixWorld.copy(skin.matrixWorld);
    m.frustumCulled = false; m.userData.ghostSkel = sk;
    return m;
  }
  bakeCPU(mat) {
    const skin = this.skin, geo = skin.geometry, pos = geo.attributes.position, n = pos.count;
    const out = new Float32Array(n * 3), v = new V3();
    skin.updateMatrixWorld(true); skin.skeleton.update();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i); skin.applyBoneTransform(i, v); v.applyMatrix4(skin.matrixWorld);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (geo.index) g.setIndex(geo.index);
    const m = new THREE.Mesh(g, mat);
    m.userData.ownGeo = true;
    return m;
  }
}

function attachHeroModel(rig, gltf, def) {
  try { new ModelDriver(rig, gltf, def); return true; } catch (e) { console.warn('hero model attach failed', e); return false; }
}
