'use strict';
/* ============================================================
   Arena stages: Lantern Strait (sunset), Thunderhead Spire (storm),
   Frostbell Pass (snow). Painted equirect skies, per-arena floors,
   Meshy props as one instanced draw call each, shader weather.
   Arena ids stay ruins / moonwell / galespire so online matches agree.
   ============================================================ */
const STAGE_OF = { ruins: 'sunset', moonwell: 'storm', galespire: 'snow' };
const Stage = {
  groups: {}, cur: null, models: {}, pkit: {}, sky: null, skyTex: {}, floorTex: {}, flashT: 0, t: 0,
  // hide the old sky-ruins scenery; keep the dais, destructible pillars, boss fire ring and lights
  init(pre) {
    const keep = new Set([World.top, World.fireRing, World.sun && World.sun.target]);
    for (const P of World.dpillars) keep.add(P.group);
    for (const o of Render.scene.children) { if (pre.has(o) || keep.has(o) || o.isLight) continue; o.visible = false; o.userData.oldDecor = true; }
    const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), mat); this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    Render.scene.add(this.sky);
    for (const k of ['fx/spike', 'earth/spike']) this.model(k).then(M => { if (M && !this.spikeM) { this.spikeM = M; M.mat.userData.shared = true; } });
    // boss phase 2 palette shift also warms the painted sky
    const ap = World.applyPalette.bind(World);
    World.applyPalette = k => { ap(k); if (this.sky) this.sky.material.color.setRGB(1, 1 - 0.45 * k, 1 - 0.6 * k); };
  },
  /* ---------- models: one geometry + toon material per prop, base at y=0, unit height ---------- */
  b64(key) { return typeof ARENA_B64 !== 'undefined' ? ARENA_B64[key] : null; },
  model(key) {
    if (this.models[key]) return this.models[key];
    const parse = buf => new Promise(res => new THREE.GLTFLoader().parse(buf, '', g => {
      let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) return res(null);
      const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox();
      const b = geo.boundingBox, h = b.max.y - b.min.y;
      geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(1 / h, 1 / h, 1 / h);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const m0 = mesh.material, map = m0.map || null;
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
      const mat = toon(0xffffff, { map });
      res({ geo, mat, w: (b.max.x - b.min.x) / h, d: (b.max.z - b.min.z) / h });
    }, () => res(null)));
    let p;
    if (typeof ASSET_WEB !== 'undefined') p = fetch('arenas/' + key + '.glb').then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? parse(b) : null).catch(() => null);
    else { const s = this.b64(key); if (!s) p = Promise.resolve(null); else { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); p = parse(u8.buffer); } }
    return (this.models[key] = p);
  },
  // place many copies of a model as one InstancedMesh; items: [x, y, z, rotY, height, xzScale?]
  inst(group, key, items, o = {}) {
    return this.model(key).then(M => {
      if (!M) { if (o.fallback) o.fallback(); return; }
      const mat = o.emissive ? toon(0xffffff, { map: M.mat.map, emissive: new THREE.Color(o.emissive), emissiveMap: M.mat.map }) : M.mat;
      const im = new THREE.InstancedMesh(M.geo, mat, items.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      items.forEach((it, i) => { const h = it[4], xs = it[5] || 1; q.setFromAxisAngle(up, it[3]); s.set(h * xs, h * (it[6] || 1), h * xs); m.compose(new THREE.Vector3(it[0], it[1], it[2]), q, s); im.setMatrixAt(i, m); });
      im.castShadow = o.shadow !== false; im.receiveShadow = !!o.receive; im.frustumCulled = false;
      group.add(im);
    });
  },
  // primitives merged into one mesh per material (for things without a model)
  merged(group, parts, mat, o = {}) {
    const geos = parts.map(([geo, x, y, z, rx, ry, rz, sx, sy, sz]) => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1))); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
    const m = new THREE.Mesh(mergeGeos(geos), mat); m.castShadow = !!o.shadow; m.receiveShadow = !!o.receive; group.add(m); if (o.outline) addOutline(m, o.outline); return m;
  },
  /* ---------- modelled breakable pillars ----------
     Each arena can ship <arena>/pillar_a, pillar_b and pillar_stump. The model is cut into horizontal
     bands at load, and the bands are the "drums" the existing crumble code throws, so breaking, collision,
     vaults and topples behave exactly as before. Missing models keep the procedural pillar. */
  PILLAR_H: 9.4, PILLAR_W: 2.6, STUMP_H: 1.7, BANDS: 5,
  slice(geo, n) {
    const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    g.computeBoundingBox(); const y0 = g.boundingBox.min.y, hy = (g.boundingBox.max.y - y0) || 1;
    const lists = Array.from({ length: n }, () => []);
    for (let t = 0; t < P.count / 3; t++) { const y = (P.getY(3 * t) + P.getY(3 * t + 1) + P.getY(3 * t + 2)) / 3; lists[Math.min(n - 1, Math.max(0, Math.floor((y - y0) / hy * n)))].push(t); }
    return lists.filter(l => l.length).map(l => {
      const k = l.length * 3, pa = new Float32Array(k * 3), na = new Float32Array(k * 3), ua = new Float32Array(k * 2);
      l.forEach((t, j) => { for (let v = 0; v < 3; v++) { const s = 3 * t + v, d = 3 * j + v; pa.set([P.getX(s), P.getY(s), P.getZ(s)], d * 3); if (N) na.set([N.getX(s), N.getY(s), N.getZ(s)], d * 3); if (U) ua.set([U.getX(s), U.getY(s)], d * 2); } });
      const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(pa, 3)); b.setAttribute('normal', new THREE.BufferAttribute(na, 3)); b.setAttribute('uv', new THREE.BufferAttribute(ua, 2));
      b.computeBoundingBox(); const c = new THREE.Vector3(); b.boundingBox.getCenter(c); b.translate(-c.x, -c.y, -c.z); b.computeBoundingSphere();
      return { geo: b, c };
    });
  },
  // unit-height model -> geometry at a target height, footprint capped so it still matches the collision circle
  fit(M, h, wmax, wmin = 0) { const g = M.geo.clone(), wd = Math.max(M.w, M.d, 1e-3), xz = Math.max(Math.min(h, wmax / wd), wmin / wd); g.scale(xz, h, xz); return g; },
  pillarKit(id) {
    if (this.pkit[id]) return this.pkit[id];
    return (this.pkit[id] = Promise.all(['pillar_a', 'pillar_b', 'pillar_stump', 'pillar_stump_b'].map(k => this.model(id + '/' + k))).then(([A, B, S, SB]) => {
      if (!A) return null;
      const stump = M => M ? { geo: this.fit(M, this.STUMP_H, this.PILLAR_W, 1.9), map: M.mat.map } : null;
      // never thinner than the collision circle (r 1.0), never wider than the old base
      const vars = [[A, S], [B || A, SB || S]].map(([M, St]) => ({ map: M.mat.map, bands: this.slice(this.fit(M, this.PILLAR_H, this.PILLAR_W, 2.0), this.BANDS), stump: stump(St) }));
      return { vars };
    }));
  },
  skinPillar(P, i, kit) {
    const v = kit.vars[i % kit.vars.length], mat = toon(0xffffff, { map: v.map }); mat.transparent = true; mat.opacity = 1;
    const rot = i * 1.7, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), drums = [];
    for (const b of v.bands) {
      const m = new THREE.Mesh(b.geo, mat); m.position.copy(b.c).applyQuaternion(q); m.quaternion.copy(q);
      m.castShadow = m.receiveShadow = true; addOutline(m, 0.035);
      m.userData.home = { p: m.position.clone(), q: m.quaternion.clone(), parent: P.group }; m.visible = false; P.group.add(m); drums.push(m);
    }
    let stump = null;
    if (v.stump) { stump = new THREE.Mesh(v.stump.geo, toon(0xffffff, { map: v.stump.map })); stump.quaternion.copy(q); stump.castShadow = stump.receiveShadow = true; addOutline(stump, 0.035); stump.visible = false; P.group.add(stump); stump.material.transparent = true; }
    return { drums, mats: [mat].concat(stump ? [stump.material] : []), stump };
  },
  // switch every pillar between its procedural look and this arena's model (pillars must be standing)
  applyPillars(id, kit) {
    if (World.dpillars.some(P => P.broken)) World.resetEnv();
    World.dpillars.forEach((P, i) => {
      if (typeof Perf !== 'undefined') Perf.unmergePillar(P);
      if (!P.proc) P.proc = { drums: P.drums, mats: P.mats, parts: P.group.children.filter(o => o.isMesh) };
      if (P.skin) { for (const d of P.skin.drums) d.visible = false; if (P.skin.stump) P.skin.stump.visible = false; }
      P.skins = P.skins || {};
      const sk = kit ? (P.skins[id] = P.skins[id] || this.skinPillar(P, i, kit)) : null;
      for (const o of P.proc.parts) o.visible = !sk;
      P.skin = sk; P.drums = sk ? sk.drums : P.proc.drums; P.mats = sk ? sk.mats : P.proc.mats; P.stump = sk ? sk.stump : null;
      if (sk) for (const d of sk.drums) d.visible = true;
      P.rune.visible = !sk; P.fade = 1; P.outlineVis = undefined;
      for (const m of P.mats) { m.opacity = 1; m.depthWrite = true; }
      if (typeof Perf !== 'undefined' && Perf.ready) Perf.mergePillar(P);
    });
  },
  /* Brannoc's stone spike: shared model geometry, scaled per spike */
  spikeMesh(h, r) {
    const M = this.spikeM; if (!M) return null;
    const m = new THREE.Mesh(M.geo, M.mat), xz = (2 * r) / Math.max(M.w, M.d, 1e-3);
    m.scale.set(xz, h, xz); m.castShadow = true; addOutline(m, 0.012);
    return m;
  },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; },
  tex(c, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; },
  // equirect sky: top row = zenith, middle = horizon, bottom = below horizon
  paintSky(stops, below, paint) {
    const [c, x] = this.canvas(2048, 1024), H = 512;
    const g = x.createLinearGradient(0, 0, 0, H); for (const [k, col] of stops) g.addColorStop(k, col);
    x.fillStyle = g; x.fillRect(0, 0, 2048, H);
    const g2 = x.createLinearGradient(0, H, 0, 1024); g2.addColorStop(0, stops[stops.length - 1][1]); g2.addColorStop(0.15, below); g2.addColorStop(1, below);
    x.fillStyle = g2; x.fillRect(0, H, 2048, 512);
    if (paint) paint(x, 2048, H);
    return this.tex(c);
  },
  /* ---------- weather: falling points / rain streaks animated in the vertex shader ---------- */
  weather(group, kind, n, o) {
    const area = o.area || 60, H = o.height || 26, pos = new Float32Array(n * (kind === 'rain' ? 6 : 3)), seed = new Float32Array(n * (kind === 'rain' ? 2 : 1)), tip = kind === 'rain' ? new Float32Array(n * 2) : null;
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * area, y = Math.random() * H, z = (Math.random() - 0.5) * area, s = Math.random();
      if (kind === 'rain') { pos.set([x, y, z, x, y, z], i * 6); seed[i * 2] = seed[i * 2 + 1] = s; tip[i * 2] = 0; tip[i * 2 + 1] = 1; }
      else { pos.set([x, y, z], i * 3); seed[i] = s; }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    if (tip) geo.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
    const u = { time: { value: 0 }, speed: { value: o.speed }, height: { value: H }, base: { value: o.base ?? -2 }, size: { value: o.size || 0.2 }, scale: { value: Render.pointScale || 500 }, color: { value: new THREE.Color(o.color) }, drift: { value: o.drift || 0.6 }, len: { value: o.len || 1.2 }, opacity: { value: o.opacity ?? 0.85 } };
    const vs = `uniform float time, speed, height, base, size, scale, drift, len; attribute float seed; ${tip ? 'attribute float tip;' : ''}
      void main(){ vec3 p = position; p.y = base + mod(p.y - time * speed * (0.8 + 0.4 * seed), height);
        p.x += sin(time * 0.6 + seed * 31.0) * drift; p.z += cos(time * 0.5 + seed * 17.0) * drift;
        ${tip ? 'p.y -= tip * len; p.x += tip * len * 0.12;' : ''}
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        ${tip ? '' : 'gl_PointSize = min(size * scale / max(-mv.z, 0.5), 14.0);'} }`;
    const fs = tip ? `uniform vec3 color; uniform float opacity; void main(){ gl_FragColor = vec4(color, opacity); }`
      : `uniform vec3 color; uniform float opacity; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(d)); gl_FragColor = vec4(color, a * opacity); }`;
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const obj = tip ? new THREE.LineSegments(geo, mat) : new THREE.Points(geo, mat); obj.frustumCulled = false; obj.renderOrder = 6;
    obj.userData.weather = u; group.add(obj); return obj;
  },
  floorCanvas(base, paint) { const [c, x] = this.canvas(1024, 1024); x.fillStyle = base; x.fillRect(0, 0, 1024, 1024); paint(x, 1024); return this.tex(c); },
  rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; },

  /* ======================= LANTERN STRAIT · sunset ======================= */
  sunset(G0) {
    const R = ARENA_R, rnd = this.rnd(7);
    this.skyTex.sunset = this.paintSky([[0, '#1c0b48'], [0.35, '#5a1e86'], [0.62, '#c8307e'], [0.8, '#ff6a5a'], [0.92, '#ffaa5a'], [1, '#ffd58a']], '#c85a6a', (x, w, H) => {
      const sx = w * 0.3, sy = H * 0.86, r = 70;
      const g = x.createRadialGradient(sx, sy, 10, sx, sy, r * 6); g.addColorStop(0, 'rgba(255,236,190,.95)'); g.addColorStop(1, 'rgba(255,120,90,0)'); x.fillStyle = g; x.fillRect(0, 0, w, H * 1.2);
      x.fillStyle = '#fff4cc'; x.beginPath(); x.arc(sx, sy, r, 0, 7); x.fill();
      x.fillStyle = '#ff8a6a'; for (let i = 0; i < 5; i++) x.fillRect(sx - r, sy + r * (0.2 + i * 0.17), r * 2, 3 + i * 2);
      x.globalAlpha = 0.5; for (let i = 0; i < 40; i++) { const y = H * (0.35 + rnd() * 0.5), xx = rnd() * w; x.fillStyle = rnd() < 0.5 ? '#ffb0c8' : '#ff8aa8'; x.beginPath(); x.ellipse(xx, y, 80 + rnd() * 220, 4 + rnd() * 9, 0, 0, 7); x.fill(); }
      x.globalAlpha = 1; x.fillStyle = '#fff'; for (let i = 0; i < 200; i++) x.fillRect(rnd() * w, rnd() * H * 0.3, 2, 2);
    });
    this.floorTex.sunset = this.floorCanvas('#9e6a62', (x, s) => {
      const c = s / 2; x.strokeStyle = '#6e3a40'; x.lineWidth = 5;
      for (let r = 70; r < 512; r += 64) { x.beginPath(); x.arc(c, c, r, 0, 7); x.stroke(); }
      for (let a = 0; a < 32; a++) { x.beginPath(); x.moveTo(c + Math.cos(a / 32 * 6.283) * 70, c + Math.sin(a / 32 * 6.283) * 70); x.lineTo(c + Math.cos(a / 32 * 6.283) * 512, c + Math.sin(a / 32 * 6.283) * 512); x.stroke(); }
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '255,200,170' : '90,30,50'},${rnd() * .12})`; x.fillRect(rnd() * s, rnd() * s, 20 + rnd() * 40, 20 + rnd() * 40); }
      x.strokeStyle = '#ffd27a'; x.lineWidth = 9; x.beginPath(); x.arc(c, c, 120, 0, 7); x.stroke(); x.beginPath(); x.arc(c, c, 480, 0, 7); x.stroke();
      x.lineWidth = 4; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; x.beginPath(); x.arc(c + Math.cos(a) * 300, c + Math.sin(a) * 300, 22, 0, 7); x.stroke(); }
    });
    // platform underside: plum rock with a gold-trimmed lacquer rim
    this.merged(G0, [[new THREE.ConeGeometry(R + 2, 26, 9, 3), 0, -13.5, 0, Math.PI, 0.2]], toon(0x4a1f3e), { outline: 0.2 });
    this.merged(G0, [[new THREE.TorusGeometry(R + 2, 0.32, 6, 72), 0, 0.02, 0, Math.PI / 2]], toon(0xffc860, { emissive: 0x6a3a00 }));
    // sea of light far below
    const sea = new THREE.Mesh(new THREE.CircleGeometry(440, 48), new THREE.MeshBasicMaterial({ color: 0xff8a7a }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -30; G0.add(sea);
    // sea stacks on the horizon
    const stacks = []; for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, d = 90 + rnd() * 120, h = 30 + rnd() * 50; stacks.push([new THREE.ConeGeometry(6 + rnd() * 10, h, 6), Math.cos(a) * d, h / 2 - 30, Math.sin(a) * d, 0, rnd() * 3]); }
    this.merged(G0, stacks, toon(0x3a1446));
    // gates ring the edge, lantern posts between them, a pagoda landmark out at sea
    const gates = [], posts = [], lamps = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + 0.26;
      gates.push([Math.cos(a) * (R + 1.2), 0, Math.sin(a) * (R + 1.2), -a + Math.PI / 2, 8.5]);
      const b = a + TAU / 12;
      posts.push([Math.cos(b) * (R + 1.0), 0, Math.sin(b) * (R + 1.0), -b - Math.PI / 2, 3.4]);
    }
    this.inst(G0, 'sunset/gate', gates, { fallback: () => this.placeholderGates(G0, gates) });
    this.inst(G0, 'sunset/lantern_post', posts, { emissive: 0x2a1408 });
    this.inst(G0, 'sunset/pagoda', [[-70, -32, -150, 0.6, 105], [150, -32, 60, 2.2, 70]], { shadow: false, emissive: 0x200810 });
    // lantern strings sag between the gate tops (one draw call)
    for (let i = 0; i < 6; i++) for (let k = 1; k < 9; k++) { const a = (i + k / 9) / 6 * TAU + 0.26, sag = Math.sin(k / 9 * Math.PI) * 2.0; lamps.push([new THREE.SphereGeometry(0.22, 8, 6), Math.cos(a) * (R + 1.2), 7.4 - sag, Math.sin(a) * (R + 1.2)]); }
    this.merged(G0, lamps, new THREE.MeshBasicMaterial({ color: 0xffc870 }));
    this.weather(G0, 'snow', 420, { speed: 0.7, color: 0xffb8d8, size: 0.16, drift: 2.2, height: 18, area: 56, opacity: 0.9 });
    this.weather(G0, 'snow', 160, { speed: -0.6, base: -1, color: 0xffd27a, size: 0.12, drift: 1.2, height: 10, area: 40, add: true });
    return {
      pal: { fog: 0xd0607a, hemiS: 0xff9ac0, hemiG: 0x5a2a6a, sunC: 0xffb886, cloud: 0xffb0c8, top: 0x1c0b48, mid: 0xc8307e, hor: 0xffaa5a, sun: 0xfff0c0 },
      sunI: 2.4, hemiI: 1.15, sunPos: [-22, 20, -14], fog: [45, 260], floorSide: 0x5a2a3a,
      pillar: [0xb02a3a, 0x2a1430, 0xffd27a], debris: 0xc8a888, exposure: 1,
    };
  },
  placeholderGates(G0, gates) {
    const parts = [], beams = [];
    for (const [x, , z, ry, h] of gates) for (const s of [-1, 1]) parts.push([new THREE.CylinderGeometry(0.4, 0.48, h, 10), x + Math.cos(ry) * s * 2.6, h / 2, z - Math.sin(ry) * s * 2.6]);
    this.merged(G0, parts, toon(0xb02a3a), { shadow: true });
  },

  /* ======================= THUNDERHEAD SPIRE · storm ======================= */
  storm(G0) {
    const R = ARENA_R, rnd = this.rnd(11);
    this.skyTex.storm = this.paintSky([[0, '#05071a'], [0.4, '#141a44'], [0.75, '#26307a'], [0.92, '#3c4aa0'], [1, '#5a5aa8']], '#141634', (x, w, H) => {
      for (let i = 0; i < 90; i++) { const xx = rnd() * w, y = H * (0.15 + rnd() * 0.8), r = 60 + rnd() * 170; const g = x.createRadialGradient(xx, y, 0, xx, y, r); g.addColorStop(0, `rgba(${rnd() < 0.3 ? '110,60,170' : '40,46,110'},.6)`); g.addColorStop(1, 'rgba(20,20,60,0)'); x.fillStyle = g; x.fillRect(xx - r, y - r, r * 2, r * 2); }
      const bolt = (bx, by, len, wid) => { x.strokeStyle = '#e8fbff'; x.shadowColor = '#3df2ff'; x.shadowBlur = 24; x.lineWidth = wid; x.beginPath(); let px = bx, py = by; x.moveTo(px, py); for (let i = 0; i < 12; i++) { px += (rnd() - .5) * 44; py += len / 12; x.lineTo(px, py); if (rnd() < .25 && wid > 2) { x.stroke(); bolt(px, py, len * 0.4, wid * 0.5); x.beginPath(); x.moveTo(px, py); } } x.stroke(); x.shadowBlur = 0; };
      bolt(w * 0.22, H * 0.25, H * 0.7, 5); bolt(w * 0.64, H * 0.35, H * 0.6, 4); bolt(w * 0.88, H * 0.2, H * 0.5, 3);
    });
    this.floorTex.storm = this.floorCanvas('#2c3150', (x, s) => {
      const c = s / 2; x.strokeStyle = '#1a1d33'; x.lineWidth = 7; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * 128); x.lineTo(s, i * 128); x.moveTo(i * 128, 0); x.lineTo(i * 128, s); x.stroke(); }
      for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '90,100,160' : '10,12,30'},${rnd() * .18})`; x.fillRect(rnd() * s, rnd() * s, 30 + rnd() * 60, 30 + rnd() * 60); }
      x.shadowBlur = 16; x.strokeStyle = '#3df2ff'; x.shadowColor = '#3df2ff'; x.lineWidth = 6; x.beginPath(); x.arc(c, c, 260, 0, 7); x.stroke();
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; let px = c + Math.cos(a) * 260, py = c + Math.sin(a) * 260; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 7; j++) { px += Math.cos(a) * 32 + (rnd() - .5) * 36; py += Math.sin(a) * 32 + (rnd() - .5) * 36; x.lineTo(px, py); } x.stroke(); }
      x.strokeStyle = '#ff3d9a'; x.shadowColor = '#ff3d9a'; x.lineWidth = 6; x.beginPath(); x.arc(c, c, 485, 0, 7); x.stroke(); x.shadowBlur = 0;
    });
    this.merged(G0, [[new THREE.ConeGeometry(R + 2, 30, 7, 3), 0, -15.5, 0, Math.PI, 0.5]], toon(0x1c2040), { outline: 0.2 });
    // crags rise out of the abyss around the platform; rune pylons stand on the edge
    const crags = [], pylons = [];
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + rnd() * 0.3, d = R + 5 + rnd() * 8, h = 22 + rnd() * 22; crags.push([Math.cos(a) * d, -20, Math.sin(a) * d, rnd() * 6, h, 0.9 + rnd() * 0.6]); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; pylons.push([Math.cos(a) * (R + 1.0), 0, Math.sin(a) * (R + 1.0), -a + Math.PI / 2, 4.2]); }
    const cragsB = crags.filter((c, i) => i % 2), cragsA = crags.filter((c, i) => !(i % 2));
    this.inst(G0, 'storm/crag_b', cragsB.map(c => [c[0], c[1], c[2], c[3], c[4] * 0.8, c[5] * 1.1]), { emissive: 0x0a1a2a });
    crags.length = 0; crags.push(...cragsA);
    this.inst(G0, 'storm/crag', crags, { emissive: 0x0a1a2a, fallback: () => this.merged(G0, crags.map(c => [new THREE.ConeGeometry(2.5, c[4], 5), c[0], c[1] + c[4] / 2, c[2]]), toon(0x262a46), { outline: 0.08 }) });
    this.inst(G0, 'storm/rune_pylon', pylons, { emissive: 0x103040 });
    this.inst(G0, 'storm/watchtower', [[60, -40, -130, 0.4, 150, 1.0, 1.25]], { shadow: false, emissive: 0x081828 });
    this.weather(G0, 'rain', 1300, { speed: 26, color: 0xa8d8ff, height: 26, area: 60, len: 1.3, opacity: 0.4, drift: 0 });
    this.weather(G0, 'snow', 160, { speed: -0.3, base: 0, color: 0x3df2ff, size: 0.1, drift: 1.2, height: 6, area: 34, add: true });
    // pooled lightning bolt for strikes
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0, fog: false });
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), this.boltMat); this.bolt.frustumCulled = false; this.bolt.renderOrder = 8; G0.add(this.bolt);
    return {
      pal: { fog: 0x262c60, hemiS: 0x7a88ff, hemiG: 0x2a1040, sunC: 0xa8d8ff, cloud: 0x5a6898, top: 0x05071a, mid: 0x26307a, hor: 0x5a5aa8, sun: 0xdde8ff },
      sunI: 2.5, hemiI: 1.25, sunPos: [18, 26, -16], fog: [35, 220], floorSide: 0x1a1d33,
      pillar: [0x2e3352, 0x161a30, 0x3df2ff], debris: 0x3c4466, storm: true,
    };
  },
  strike(pos) {
    if (!this.bolt) return;
    const pts = []; let x = pos.x + rand(-6, 6), z = pos.z + rand(-6, 6);
    for (let y = 46; y > 0.2; y -= 3.2) { pts.push(new THREE.Vector3(x, y, z)); const k = y / 46; x = lerp(pos.x, x, k) + rand(-1.4, 1.4) * k; z = lerp(pos.z, z, k) + rand(-1.4, 1.4) * k; }
    pts.push(new THREE.Vector3(pos.x, 0.05, pos.z));
    this.bolt.geometry.dispose(); this.bolt.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.28, 5);
    this.boltT = 0.32; this.flashT = 0.35; Render.post.flash = Math.max(Render.post.flash, 0.35);
  },

  /* ======================= FROSTBELL PASS · snow ======================= */
  snow(G0) {
    const R = ARENA_R, rnd = this.rnd(23);
    this.skyTex.snow = this.paintSky([[0, '#14205a'], [0.35, '#3a5ac0'], [0.65, '#8aaef8'], [0.85, '#f0c8e8'], [1, '#fde8f0']], '#dfe8ff', (x, w, H) => {
      x.globalAlpha = 1; x.fillStyle = '#fff'; for (let i = 0; i < 260; i++) x.fillRect(rnd() * w, rnd() * H * 0.45, 2, 2);
      for (let k = 0; k < 4; k++) { x.globalAlpha = 0.42; const y0 = H * (0.12 + k * 0.07); const g = x.createLinearGradient(0, y0, 0, y0 + H * 0.25); g.addColorStop(0, 'rgba(61,242,180,0)'); g.addColorStop(0.5, k % 2 ? '#ff7ad8' : '#3df2b4'); g.addColorStop(1, 'rgba(61,242,180,0)'); x.fillStyle = g;
        x.beginPath(); x.moveTo(0, y0); for (let i = 0; i <= 40; i++) x.lineTo(i / 40 * w, y0 + Math.sin(i * 0.5 + k * 1.7) * 30); for (let i = 40; i >= 0; i--) x.lineTo(i / 40 * w, y0 + H * 0.22 + Math.sin(i * 0.5 + k + 1) * 26); x.fill(); }
      x.globalAlpha = 1;
    });
    this.floorTex.snow = this.floorCanvas('#eef3ff', (x, s) => {
      const c = s / 2;
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(140,160,230,${rnd() * .1})`; x.beginPath(); x.ellipse(rnd() * s, rnd() * s, 20 + rnd() * 70, 8 + rnd() * 22, rnd() * 3, 0, 7); x.fill(); }
      const g = x.createRadialGradient(c, c, 20, c, c, 180); g.addColorStop(0, '#8ae0ff'); g.addColorStop(0.8, '#4a96dc'); g.addColorStop(1, '#c8ecff'); x.fillStyle = g; x.beginPath(); x.arc(c, c, 180, 0, 7); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3; for (let k = 0; k < 12; k++) { let px = c, py = c, a = rnd() * 6.283; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 4; j++) { px += Math.cos(a) * 42; py += Math.sin(a) * 42; a += rnd() - .5; x.lineTo(px, py); } x.stroke(); }
      x.strokeStyle = '#8a6ad8'; x.lineWidth = 9; x.beginPath(); x.arc(c, c, 482, 0, 7); x.stroke();
    });
    this.merged(G0, [[new THREE.ConeGeometry(R + 2, 14, 10, 2), 0, -7.5, 0, Math.PI, 0.1]], toon(0xc8d8f8), { outline: 0.15 });
    // the platform sits on a snowfield; pines stand below, crystals ring the edge, a bell shrine on a far peak
    const field = new THREE.Mesh(new THREE.CircleGeometry(420, 48), toon(0xe8eeff)); field.rotation.x = -Math.PI / 2; field.position.y = -9; field.receiveShadow = false; G0.add(field);
    const peaks = []; for (let i = 0; i < 12; i++) { const a = rnd() * 6.283, d = 120 + rnd() * 120, h = 40 + rnd() * 70; peaks.push([new THREE.ConeGeometry(30 + rnd() * 30, h, 6), Math.cos(a) * d, h / 2 - 9, Math.sin(a) * d, 0, rnd() * 3]); }
    this.merged(G0, peaks, toon(0xd8e2ff));
    const pines = [], ice = [];
    for (let i = 0; i < 18; i++) { const a = rnd() * TAU, d = R + 7 + rnd() * 26; pines.push([Math.cos(a) * d, -9, Math.sin(a) * d, rnd() * 6, 9 + rnd() * 7]); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; ice.push([Math.cos(a) * (R + 1.2), 0, Math.sin(a) * (R + 1.2), rnd() * 6, 3.2 + rnd() * 2.6]); }
    this.inst(G0, 'snow/pine_cluster', pines, { shadow: false });
    this.inst(G0, 'snow/ice_crystals', ice, { emissive: 0x204060 });
    const drifts = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2 + TAU / 16; drifts.push([Math.cos(a) * (R + 1.4), -0.2, Math.sin(a) * (R + 1.4), -a + Math.PI / 2, 2.6, 1.3, 0.8]); }
    this.inst(G0, 'snow/snow_drift_lantern', drifts, { emissive: 0x101820 });
    this.inst(G0, 'snow/bell_shrine', [[-40, -9, -120, 0.3, 46]], { shadow: false });
    this.weather(G0, 'snow', 1500, { speed: 2.2, color: 0xffffff, size: 0.17, drift: 1.4, height: 24, area: 64, opacity: 0.95 });
    return {
      pal: { fog: 0xb8c4f0, hemiS: 0xb0caff, hemiG: 0x6a74c8, sunC: 0xffe0c0, cloud: 0xf0e0ff, top: 0x14205a, mid: 0x8aaef8, hor: 0xfde8f0, sun: 0xfff0e0 },
      sunI: 2.3, hemiI: 1.3, sunPos: [-20, 16, -18], fog: [45, 260], floorSide: 0x9aaee8,
      pillar: [0x9ad8f0, 0xf4f8ff, 0x8a6ad8], debris: 0xcfe6f2,
    };
  },

  /* ---------- switching ---------- */
  show(arenaId) {
    const id = STAGE_OF[arenaId] || 'sunset';
    if (!this.groups[id]) { const g = new THREE.Group(); g.name = 'stage_' + id; this.groups[id] = g; g.userData.cfg = this[id](g); Render.scene.add(g); }
    for (const k in this.groups) this.groups[k].visible = k === id;
    this.cur = id; const cfg = this.groups[id].userData.cfg;
    this.sky.material.map = this.skyTex[id]; this.sky.material.needsUpdate = true;
    const top = World.top; if (top && Array.isArray(top.material)) { top.material[1].map = this.floorTex[id]; top.material[1].color.set(0xffffff); top.material[1].needsUpdate = true; top.material[0].color.set(cfg.floorSide); top.material[2].color.set(cfg.floorSide); }
    World.sun.intensity = cfg.sunI; World.sun.position.set(...cfg.sunPos); World.hemi.intensity = cfg.hemiI;
    Render.scene.fog.near = cfg.fog[0]; Render.scene.fog.far = cfg.fog[1];
    this.pillarKit(id).then(kit => { if (this.cur === id && this.pillarsFor !== id) { this.pillarsFor = id; this.applyPillars(id, kit); } });
    for (const P of World.dpillars) { const ms = P.proc ? P.proc.mats : P.mats; ms[0].color.set(cfg.pillar[0]); ms[1].color.set(cfg.pillar[1]); }
    for (const P of World.dpillars) if (P.rune) P.rune.material.color.set(cfg.pillar[2]);
    if (cfg.debris && World.stoneMat) World.stoneMat.color.set(cfg.debris);
    return cfg;
  },
  update(dt) {
    this.t += dt;
    const g = this.cur && this.groups[this.cur]; if (!g) return;
    for (const c of g.children) if (c.userData.weather) { c.userData.weather.time.value = this.t; c.userData.weather.scale.value = Render.pointScale || 500; }
    if (this.boltT > 0) { this.boltT -= dt; this.boltMat.opacity = this.boltT > 0 ? (Math.sin(this.boltT * 90) > -0.3 ? 1 : 0.2) : 0; }
    if (this.flashT > 0 || this.cur === 'storm') {
      this.flashT = Math.max(0, this.flashT - dt);
      // distant sheet lightning every few seconds in the storm
      if (this.cur === 'storm' && Math.random() < dt * 0.25) this.flashT = Math.max(this.flashT, 0.18);
      const f = this.flashT > 0 ? 1 + 0.9 * Math.abs(Math.sin(this.flashT * 40)) : 1;
      if (this.sky) this.sky.material.color.setScalar(Math.min(f, 2));
    }
  },
};
