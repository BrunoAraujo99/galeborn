'use strict';
/* ============================================================
   Performance: static batching (merge scenery that never moves into
   one mesh per material), dynamic resolution, effect budget.
   ============================================================ */
const Perf = {
  snap: null, t: 0, batched: false,
  // remember every candidate's world matrix; anything that moved by the check is left alone
  init() {
    const skip = new Set();
    const addTree = o => o && o.traverse(c => skip.add(c));
    for (const d of World.dpillars) addTree(d.group);
    for (const d of World.dpillars) this.unmergePillar(d);
    for (const f of World.floaters || []) addTree(f);
    if (World.temple) addTree(World.temple);
    if (typeof Stage !== 'undefined') { for (const k in Stage.groups) addTree(Stage.groups[k]); addTree(Stage.sky); }
    if (G.boss) addTree(G.boss.rig.root);
    if (G.player) addTree(G.player.rig.root);
    this.snap = [];
    Render.scene.updateMatrixWorld(true);
    Render.scene.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || skip.has(o) || !o.visible) return;
      if (Array.isArray(o.material) || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
      if (o.customDepthMaterial || o.morphTargetInfluences) return;
      const g = o.geometry, at = Object.keys(g.attributes);
      if (!g.attributes.position || !g.attributes.normal || at.some(k => !['position', 'normal', 'uv'].includes(k)) || g.morphAttributes.position) return;
      let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
      if (!vis) return;
      this.snap.push({ o, m: o.matrixWorld.clone() });
    });
    // anchored groups: things that move as a whole (floating islands, boss joints) merge in their own space
    this.anch = [];
    const anchors = [];
    for (const f of World.floaters || []) anchors.push([f, true]);
    if (World.temple) anchors.push([World.temple, true]);
    if (G.boss) for (const k in G.boss.rig.j) anchors.push([G.boss.rig.j[k], false]);
    const aset = new Set(anchors.map(a => a[0]));
    for (const [A, vcOK] of anchors) {
      A.updateMatrixWorld(true);
      const inv = A.matrixWorld.clone().invert();
      const list = [];
      const walk = o => { for (const c of o.children) { if (aset.has(c)) continue; if (c.isMesh && !c.isSkinnedMesh && !Array.isArray(c.material) && c.visible) { const g = c.geometry, at = Object.keys(g.attributes); if (g.attributes.normal && !at.some(k => !['position', 'normal', 'uv'].includes(k))) list.push({ o: c, m: inv.clone().multiply(c.matrixWorld) }); } walk(c); } };
      walk(A);
      if (list.length > 1) this.anch.push({ A, vcOK, list });
    }
    this.t = 0; this.batched = false;
  },
  tick(raw) {
    if (!this.batched && this.snap) { this.t += raw; if (this.t > 2.5) this.batch(); }
    this.drs(raw);
  },
  batch() {
    this.batched = true;
    const groups = new Map();
    let n = 0;
    for (const { o, m } of this.snap) {
      if (!o.parent || !o.visible || !o.matrixWorld.equals(m)) continue;
      const m0 = o.material;
      const vc = m0.isMeshToonMaterial && !m0.map && !m0.transparent && !m0.vertexColors && m0.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
      if (vc) o.userData.vcBatch = true;
      const key = (vc ? 'toonVC|' + (m0.gradientMap ? m0.gradientMap.uuid : '') + '|' + m0.side + '|' + m0.emissive.getHexString() + '|' + m0.flatShading + '|' + m0.fog : m0.uuid) + '|' + o.castShadow + '|' + o.receiveShadow + '|' + o.renderOrder + '|' + (o.userData.isOutline ? 1 : 0);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o); n++;
    }
    let made = 0, removed = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const s = list[0], vc = !!s.userData.vcBatch;
      const geo = mergeWorldGeos(list, vc);
      if (!geo) continue;
      let mat = s.material;
      if (vc) { mat = s.material.clone(); mat.color.set(0xffffff); mat.vertexColors = true; mat.userData.shared = true; }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = s.castShadow; mesh.receiveShadow = s.receiveShadow; mesh.renderOrder = s.renderOrder;
      mesh.userData.batched = true; if (s.userData.isOutline) mesh.userData.isOutline = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      Render.scene.add(mesh); made++;
      for (const o of list) { o.visible = false; o.matrixAutoUpdate = false; removed++; }
    }
    this.snap = null;
    // anchored merges
    for (const { A, vcOK, list } of this.anch) {
      A.updateMatrixWorld(true);
      const inv = A.matrixWorld.clone().invert();
      const by = new Map();
      for (const { o, m } of list) {
        if (!o.parent || !o.visible) continue;
        const rel = inv.clone().multiply(o.matrixWorld);
        if (!rel.equals(m) && rel.elements.some((x, i) => Math.abs(x - m.elements[i]) > 1e-4)) continue;
        const m0 = o.material;
        const vc = vcOK && m0.isMeshToonMaterial && !m0.map && !m0.transparent && m0.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
        const key = (vc ? 'vc|' + (m0.gradientMap ? m0.gradientMap.uuid : '') + m0.side + m0.emissive.getHexString() : m0.uuid) + '|' + o.castShadow + o.receiveShadow + o.renderOrder + (o.userData.isOutline ? 'o' : '');
        if (!by.has(key)) by.set(key, { vc, items: [] });
        by.get(key).items.push({ o, rel });
      }
      for (const { vc, items } of by.values()) {
        if (items.length < 2) continue;
        const fake = items.map(({ o, rel }) => ({ matrixWorld: rel, geometry: o.geometry, material: o.material }));
        const geo = mergeWorldGeos(fake, vc);
        if (!geo) continue;
        const s0 = items[0].o;
        let mat = s0.material;
        if (vc) { mat = s0.material.clone(); mat.color.set(0xffffff); mat.vertexColors = true; mat.userData.shared = true; }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = s0.castShadow; mesh.receiveShadow = s0.receiveShadow; mesh.renderOrder = s0.renderOrder;
        mesh.userData.batched = true; if (s0.userData.isOutline) { mesh.userData.isOutline = true; mesh.frustumCulled = s0.frustumCulled; }
        A.add(mesh); made++;
        for (const { o } of items) { o.visible = false; removed++; }
      }
    }
    this.anch = null;
    for (const P of World.dpillars) this.mergePillar(P);
    this.ready = true;
    if (!World._perfWrapped) {
      World._perfWrapped = true;
      const hit = World.hitPillar, reset = World.resetEnv;
      World.hitPillar = function (P, ...a) { Perf.unmergePillar(P); return hit.call(this, P, ...a); };
      World.resetEnv = function (...a) { for (const P of this.dpillars) Perf.unmergePillar(P); const r = reset.apply(this, a); for (const P of this.dpillars) Perf.mergePillar(P); return r; };
    }
    console.info(`[perf] batched ${removed} meshes into ${made}`);
  },
  // standing pillars: merged while intact, the real pieces come back the moment one is hit
  mergePillar(P) {
    if (P.merged || P.broken) return;
    P.group.updateMatrixWorld(true);
    const inv = P.group.matrixWorld.clone().invert(), by = new Map();
    P.group.traverse(o => {
      if (!o.isMesh || o.userData.batched || !o.visible || (o.parent !== P.group && !o.parent.visible) || Array.isArray(o.material) || !o.geometry.attributes.normal) return;
      const key = o.material.uuid + '|' + o.castShadow + o.receiveShadow + (o.userData.isOutline ? 'o' : '');
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(o);
    });
    const made = [], hidden = [];
    for (const items of by.values()) {
      if (items.length < 2) continue;
      const geo = mergeWorldGeos(items.map(o => ({ matrixWorld: inv.clone().multiply(o.matrixWorld), geometry: o.geometry, material: o.material })), false);
      if (!geo) continue;
      const s0 = items[0], mesh = new THREE.Mesh(geo, s0.material);
      mesh.castShadow = s0.castShadow; mesh.receiveShadow = s0.receiveShadow; mesh.userData.batched = true;
      if (s0.userData.isOutline) mesh.userData.isOutline = true;
      P.group.add(mesh); made.push(mesh);
      for (const o of items) { o.visible = false; o.userData.inBatch = true; hidden.push(o); }
    }
    P.merged = { made, hidden }; P.outlineVis = undefined;
  },
  unmergePillar(P) {
    if (!P.merged) return;
    for (const m of P.merged.made) { P.group.remove(m); m.geometry.dispose(); }
    for (const o of P.merged.hidden) { o.visible = true; o.userData.inBatch = false; }
    P.merged = null; P.outlineVis = undefined;
  },
  // dynamic resolution: trade sharpness for frame rate when the GPU falls behind
  scale: 1, acc: 0, n: 0, hold: 0, lastUp: -99,
  drs(raw) {
    if (Settings.v.drs === false) { if (this.scale !== 1) { this.scale = 1; Render.resize(); } return; }
    this.acc += raw; this.n++;
    this.hold -= raw;
    if (this.acc < 1) return;
    const fps = this.n / this.acc; this.acc = 0; this.n = 0;
    if (!(G.state === 'fight' || G.state === 'intro')) return;
    let s = this.scale;
    if (fps < 50) { s = Math.max(0.6, s - (fps < 38 ? 0.15 : 0.08)); if (G.time - this.lastUp < 4) this.hold = 25; }
    else if (fps > 57 && this.hold <= 0 && s < 1) { s = Math.min(1, s + 0.05); this.lastUp = G.time; }
    if (Math.abs(s - this.scale) > 0.001) { this.scale = s; Render.resize(); }
  },
};
// merge meshes (any geometry kind) into one non-indexed world-space geometry
function mergeWorldGeos(list, vc) {
  let total = 0;
  const parts = list.map(o => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; total += g.attributes.position.count; return [o, g]; });
  if (total > 400000) return null;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = vc ? new Float32Array(total * 3) : null;
  const nm = new THREE.Matrix3(), v = new V3();
  let off = 0;
  for (const [o, g] of parts) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    if (!N) return null;
    nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos.set([v.x, v.y, v.z], (off + i) * 3);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (off + i) * 3);
      if (U) { uv[(off + i) * 2] = U.getX(i); uv[(off + i) * 2 + 1] = U.getY(i); }
      if (col) { const c = o.material.color; col[(off + i) * 3] = c.r; col[(off + i) * 3 + 1] = c.g; col[(off + i) * 3 + 2] = c.b; }
    }
    off += P.count;
    if (g !== o.geometry) g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
