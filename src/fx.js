'use strict';
/* ============================================================
   Visual effects: particles, trails, swirls, telegraphs, slashes
   ============================================================ */
class Particles {
  constructor(max, additive) {
    this.max = max; this.next = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.sk = new Float32Array(max * 2); // per particle: random seed, life progress (smoke shape + erosion)
    g.setAttribute('sk', new THREE.BufferAttribute(this.sk, 2).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 800 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 pcolor; attribute vec2 sk; varying vec3 vC; varying float vA; varying vec2 vK; uniform float scale;
        void main(){ vC = pcolor; vA = alpha; vK = sk; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = alpha > 0.001 ? size * scale / max(-mv.z, 0.1) : 0.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: additive
        ? `varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = (sqrt(abs(d.x)) + sqrt(abs(d.y))) * 1.4142; float rc = length(d) * 2.0;
          // chunky four-point star spark with a small hot core
          float a = 1.0 - smoothstep(0.88, 1.0, r);
          float core = 1.0 - smoothstep(0.16, 0.24, rc);
          vec3 c = mix(vC, vec3(1.0, 0.97, 0.9), core * 0.5);
          float s = floor(vA * 4.0 + 0.5) / 4.0;
          gl_FragColor = vec4(c, a * s * 0.8); }`
        : `varying vec3 vC; varying float vA; varying vec2 vK;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
          // painted smoke puff: lumpy cloud outline, two-tone cel shading, breaks apart as it dies
          float sd = vK.x * 6.2832, a = atan(d.y, d.x);
          float lump = 0.86 + 0.07 * sin(a * 3.0 + sd) + 0.04 * sin(a * 6.0 + sd * 2.3);
          float edge = lump * (1.0 - 0.18 * vK.y);
          if (r > edge) discard;
          // dissolves into holes as it dies rather than fading flat
          if (n2(d * 3.2 + vK.x * 31.0) * 0.8 + 0.2 * (1.0 - r) < vK.y * vK.y * 0.85) discard;
          float term = dot(d, vec2(-0.7071, 0.7071)) + 0.07 * sin(a * 4.0 + sd * 1.7) - 0.05;
          vec3 c = term > 0.0 ? vC * 1.15 + 0.07 : vC * 0.78;
          c = mix(c, vC * 0.55, smoothstep(edge - 0.1, edge, r) * 0.5);
          float s = floor(vA * 3.0 + 0.6) / 3.0;
          gl_FragColor = vec4(c, s); }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 10;
    this.stepped = !additive;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 0, grav = 0, a0 = 1) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.c0[i3] = c0.r; this.c0[i3 + 1] = c0.g; this.c0[i3 + 2] = c0.b;
    this.c1[i3] = c1.r; this.c1[i3 + 1] = c1.g; this.c1[i3 + 2] = c1.b;
    this.drag[i] = drag; this.grav[i] = grav; this.a0[i] = a0;
    this.sk[i * 2] = Math.random(); this.sk[i * 2 + 1] = 0;
  }
  update(dt) {
    const P = this.pos, Vv = this.vel;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const i3 = i * 3;
      const k = 1 - Math.max(this.life[i], 0) / this.maxLife[i];
      const dr = Math.exp(-this.drag[i] * dt);
      Vv[i3] *= dr; Vv[i3 + 1] = Vv[i3 + 1] * dr - this.grav[i] * dt; Vv[i3 + 2] *= dr;
      P[i3] += Vv[i3] * dt; P[i3 + 1] += Vv[i3 + 1] * dt; P[i3 + 2] += Vv[i3 + 2] * dt;
      this.size[i] = lerp(this.s0[i], this.s1[i], k);
      this.col[i3] = lerp(this.c0[i3], this.c1[i3], k);
      this.col[i3 + 1] = lerp(this.c0[i3 + 1], this.c1[i3 + 1], k);
      this.col[i3 + 2] = lerp(this.c0[i3 + 2], this.c1[i3 + 2], k);
      this.alpha[i] = this.life[i] > 0 ? this.a0[i] * Math.min(1, (1 - k) * 3) : 0;
      this.sk[i * 2 + 1] = k;
    }
    // smoke / dust animate "on twos" like hand-drawn effects
    if (this.stepped) { this.acc = (this.acc || 0) + dt; if (this.acc < 1 / 12 && dt > 0) return; this.acc = 0; }
    const g = this.geo.attributes;
    g.position.needsUpdate = g.pcolor.needsUpdate = g.alpha.needsUpdate = g.size.needsUpdate = g.sk.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); }
}

/* camera-facing ribbon used for hand trails, scarves, capes */
class Ribbon {
  constructor(n, mat) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.p = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2), idx = [];
    for (let i = 0; i < n; i++) {
      uv[i * 4] = i / (n - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / (n - 1); uv[i * 4 + 3] = 1;
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
  }
  // pts: array of V3 length n. widthFn(t) -> half width. sideMode: 'cam' or V3 axis
  build(pts, count, widthFn, cam, fixedSide) {
    const n = this.n, P = this.p;
    const t = new V3(), s = new V3(), toCam = new V3();
    for (let i = 0; i < n; i++) {
      const j = Math.min(i, count - 1);
      const p = pts[j];
      if (fixedSide) s.copy(fixedSide);
      else {
        const a = pts[Math.max(j - 1, 0)], b = pts[Math.min(j + 1, count - 1)];
        t.subVectors(b, a); if (t.lengthSq() < 1e-8) t.set(0, 1, 0);
        toCam.subVectors(cam.position, p);
        s.crossVectors(t, toCam); if (s.lengthSq() < 1e-10) s.set(0, 1, 0); s.normalize();
      }
      const w = widthFn(i / (n - 1));
      P[i * 6] = p.x + s.x * w; P[i * 6 + 1] = p.y + s.y * w; P[i * 6 + 2] = p.z + s.z * w;
      P[i * 6 + 3] = p.x - s.x * w; P[i * 6 + 4] = p.y - s.y * w; P[i * 6 + 5] = p.z - s.z * w;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

function trailMaterial(color, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying vec2 vUv;
      void main(){ float a = pow(clamp(1.0 - vUv.x, 0.0, 1.0) + 1e-4, 1.6) * clamp(1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0), 0.0, 1.0); gl_FragColor = vec4(color * (1.0 + (1.0 - vUv.x)), a * opacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

class Trail {
  constructor(n, color, width) {
    this.n = n; this.width = width; this.pts = []; this.emit = false;
    this.mat = trailMaterial(color, 1);
    this.ribbon = new Ribbon(n, this.mat);
    this.ribbon.mesh.renderOrder = 30;
    this.ribbon.mesh.visible = false;
    this.buf = Array.from({ length: n }, () => new V3());
  }
  push(p) {
    if (this.emit) {
      this.pts.unshift(p.clone());
      if (this.pts.length > this.n) this.pts.length = this.n;
    } else if (this.pts.length) {
      this.pts.pop();
    }
  }
  update(cam) {
    const c = this.pts.length;
    if (c < 3) { this.ribbon.mesh.visible = false; return; }
    this.ribbon.mesh.visible = true;
    for (let i = 0; i < this.n; i++) this.buf[i].copy(this.pts[Math.min(i, c - 1)]);
    const w = this.width, frac = c / this.n;
    this.ribbon.build(this.buf, this.n, t => (t <= frac ? w * (1 - t / frac) : 0), cam);
  }
}

/* animated spiral-stripe material for cyclones, fire pillars, flame rings */
function swirlMaterial(color, color2, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, opacity: { value: o.opacity ?? 1 }, twist: { value: o.twist ?? 2 },
      speed: { value: o.speed ?? 3 }, bands: { value: o.bands ?? 4 },
      color: { value: new THREE.Color(color) }, color2: { value: new THREE.Color(color2) },
      edge: { value: o.edge ?? 0.15 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time, opacity, twist, speed, bands, edge; uniform vec3 color, color2; varying vec2 vUv;
      void main(){ float s = fract(vUv.x * bands + vUv.y * twist - time * speed);
        float band = smoothstep(0.0, 0.25, s) * smoothstep(1.0, 0.45, s);
        float fade = smoothstep(0.0, edge, vUv.y) * smoothstep(1.0, 1.0 - edge * 2.0, vUv.y);
        vec3 c = mix(color2, color, band);
        gl_FragColor = vec4(c * (0.7 + band), (0.25 + band) * fade * opacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/* ground telegraph (circle or rectangle) with fill progress */
function decalMaterial(color, rect = false) {
  return new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, opacity: { value: 1 }, color: { value: new THREE.Color(color) }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: rect
      ? `uniform float progress, opacity, time; uniform vec3 color; varying vec2 vUv;
        void main(){ float ex = min(vUv.y, 1.0 - vUv.y); float edge = smoothstep(0.12, 0.0, ex);
          float fill = step(vUv.x, progress) * 0.35; float chev = step(0.5, fract(vUv.x * 10.0 - time * 3.0)) * 0.1;
          gl_FragColor = vec4(color, (edge * 0.8 + fill + chev + 0.1) * opacity); }`
      : `uniform float progress, opacity, time; uniform vec3 color; varying vec2 vUv;
        void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
          float ring = smoothstep(0.88, 0.95, r) * smoothstep(1.0, 0.96, r);
          float fill = step(r, progress) * 0.38 + smoothstep(progress - 0.06, progress, r) * step(r, progress) * 0.6;
          float pulse = 0.08 + 0.05 * sin(time * 20.0);
          gl_FragColor = vec4(color * 1.6, (ring * 1.0 + fill + pulse) * opacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
}

/* curved slash arc geometry: uv.x = along arc, uv.y = radial */
function arcGeometry(r0, r1, theta, segs = 24) {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = -theta / 2 + t * theta;
    const taper = Math.sin(t * Math.PI) * 0.6 + 0.4;
    const rm = (r0 + r1) / 2, hw = (r1 - r0) / 2 * taper;
    pos.push(Math.cos(a) * (rm - hw), 0, Math.sin(a) * (rm - hw), Math.cos(a) * (rm + hw), 0, Math.sin(a) * (rm + hw));
    uv.push(t, 0, t, 1);
    if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function slashMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 1 }, head: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity, head; varying vec2 vUv;
      void main(){ float along = smoothstep(head - 1.0, head, vUv.x) * step(vUv.x, head);
        float core = clamp(1.0 - abs(vUv.y - 0.5) * 2.0, 0.0, 1.0); core = pow(core + 1e-4, 0.6);
        vec3 c = mix(color, vec3(1.0), smoothstep(0.6, 1.0, core) * 0.8);
        gl_FragColor = vec4(c * 1.8, along * core * opacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
function starMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 1 }, rot: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity, rot; varying vec2 vUv;
      void main(){ vec2 c = (vUv - 0.5) * 2.0; float r = length(c); float a = atan(c.y, c.x) + rot;
        float sp = pow(abs(cos(a * 2.0)), 40.0) + 0.5 * pow(abs(cos(a * 2.0 + 0.785)), 60.0);
        float s = smoothstep(1.0, 0.0, r / (0.12 + 0.88 * sp)); float core = smoothstep(0.3, 0.0, r);
        float v = max(core, s); gl_FragColor = vec4(mix(color, vec3(1.0), core) * 2.0, v * opacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
function glowMaterial(color, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying vec2 vUv;
      void main(){ float r = length(vUv - 0.5) * 2.0; float a = pow(max(1.0 - r, 0.0), 2.0); gl_FragColor = vec4(color * (1.0 + a), a * opacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

const ELEM_FX = {};
for (const [k, core, mid, acc] of [['wind', 0xffffff, 0x3df2ff, 0x8a6aff], ['fire', 0xfff2a0, 0xff7a2a, 0xff3d6a], ['earth', 0xfff4c0, 0xa8e048, 0xffb020], ['water', 0xeaf6ff, 0x3a9aff, 0xa070ff]])
  ELEM_FX[k] = { c0: new THREE.Color(core), c1: new THREE.Color(mid), c2: new THREE.Color(acc), mid, acc };
const C = {
  white: new THREE.Color(1, 1, 1), wind: new THREE.Color(0.55, 1.0, 0.95), windDeep: new THREE.Color(0.2, 0.7, 1.0),
  windFade: new THREE.Color(0.05, 0.25, 0.4), fire: new THREE.Color(1.0, 0.55, 0.12), fireHot: new THREE.Color(1.0, 0.9, 0.5),
  ember: new THREE.Color(1.0, 0.25, 0.03), smoke: new THREE.Color(0.18, 0.14, 0.14), smokeL: new THREE.Color(0.45, 0.4, 0.38),
  dust: new THREE.Color(0.75, 0.68, 0.58), black: new THREE.Color(0, 0, 0), red: new THREE.Color(1, 0.15, 0.1),
};

const FX = {
  list: [], shakeT: 0, fovKick: 0,
  init(scene) {
    this.scene = scene;
    this.add_ = new Particles(4000, true);
    this.norm = new Particles(1500, false);
    scene.add(this.add_.points, this.norm.points);
    // anime speed-line backdrop: a shell around the camera that swallows the distant world
    this.sbgMat = new THREE.ShaderMaterial({
      uniforms: { amt: { value: 0 }, time: { value: 0 }, colA: { value: new THREE.Color(HC.bgA) }, colB: { value: new THREE.Color(HC.teal) }, focus: { value: new THREE.Vector2(0, 0) } },
      vertexShader: `varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vV = (viewMatrix * vec4(wp.xyz - cameraPosition, 0.0)).xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float amt, time; uniform vec3 colA, colB; uniform vec2 focus; varying vec3 vV;
        float h(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          vec3 d = normalize(vV);
          vec2 s = d.xy / max(-d.z, 0.05) - focus;
          float ang = atan(s.y, s.x); float r = length(s);
          float st = floor(time * 14.0);            // streaks redraw on 14 fps steps
          float id = floor(ang * 34.0);
          float w = fract(ang * 34.0);
          float hh = h(id * 1.7 + st * 3.1);
          float line = step(0.5, hh) * step(abs(w - 0.5), 0.12 + 0.3 * h(id + st)) * step(0.25 + 0.4 * h(id * 3.3 + st), r);
          float band = step(0.82, h(id * 9.1 + st * 1.3));
          vec3 c = mix(colA, colB, smoothstep(0.0, 1.6, r) * 0.6);
          c = mix(c, colB * 1.4, band * 0.5);
          c = mix(c, vec3(1.0), line * 0.9);
          gl_FragColor = vec4(c, amt);
        }`,
      side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    });
    this.sbg = new THREE.Mesh(new THREE.SphereGeometry(42, 32, 16), this.sbgMat);
    this.sbg.renderOrder = -5; this.sbg.frustumCulled = false; this.sbg.visible = false;
    scene.add(this.sbg);
    this.sbgT = 0; this.sbgAmt = 0;
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 64);
    this.popLayer = document.getElementById('popups');
    this.onResize();
  },
  onResize() { if (this.add_) { this.add_.mat.uniforms.scale.value = Render.pointScale; this.norm.mat.uniforms.scale.value = Render.pointScale; } },
  clear() {
    for (const e of this.list) this.disposeE(e);
    this.list.length = 0;
    this.add_.clear(); this.norm.clear();
    this.popLayer.innerHTML = '';
  },
  disposeE(e) {
    if (e.obj) {
      e.obj.parent && e.obj.parent.remove(e.obj);
      e.obj.traverse(o => { if (o.material && o.material.dispose && !o.material.userData.shared) o.material.dispose(); if (o.geometry && o.userData.ownGeo) o.geometry.dispose(); });
    }
  },
  // generic timed effect
  add(obj, dur, fn, parent) {
    // effect budget: past the cap, the oldest timed effect finishes early
    if (obj && this.list.length > 140) { const old = this.list.find(e => e.obj && e.t < e.dur); if (old) old.t = old.dur; }
    if (obj) (parent || this.scene).add(obj);
    const e = { obj, t: 0, dur, fn };
    this.list.push(e);
    if (fn) fn(e, 0, 0);
    return e;
  },
  // fire a speed-line backdrop for dur seconds; fire = boss palette
  speedBg(dur, fire) {
    this.sbgT = Math.max(this.sbgT, dur);
    const u = this.sbgMat.uniforms;
    if (fire) { u.colA.value.setHex(0x3a0a06); u.colB.value.setHex(0xff7a2a); } else { u.colA.value.setHex(HC.bgA); u.colB.value.setHex(HC.teal); }
  },
  updateSpeedBg(raw, cam) {
    this.sbgT -= raw;
    this.sbgAmt = damp(this.sbgAmt, this.sbgT > 0 ? 1 : 0, this.sbgT > 0 ? 14 : 6, raw);
    const u = this.sbgMat.uniforms;
    u.amt.value = this.sbgAmt; u.time.value += raw;
    this.sbg.visible = this.sbgAmt > 0.01;
    this.sbgMat.depthWrite = this.sbgAmt > 0.6;
    this.sbg.position.copy(cam.position);
  },
  update(dt, cam) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t += dt;
      const k = Math.min(e.t / e.dur, 1);
      if (e.fn) e.fn(e, k, dt);
      if (e.obj && e.billboard) e.obj.quaternion.copy(cam.quaternion);
      if (e.t >= e.dur) { this.disposeE(e); this.list.splice(i, 1); }
    }
    this.add_.update(dt);
    this.norm.update(dt);
    const W = Render.waves || (Render.waves = []);
    for (let i = W.length - 1; i >= 0; i--) { W[i].t += dt; if (W[i].t >= W[i].dur) W.splice(i, 1); }
  },
  shake(a) { a *= this.shakeMul ?? 1; this.shakeT = Math.min(1.2, Math.max(this.shakeT, a)); },
  /* ---------- particle helpers ---------- */
  burst(p, n, o) {
    const sp = o.speed ?? 8, P = o.add === false ? this.norm : this.add_;
    if (this.particleMul && this.particleMul < 1 && n > 2) n = Math.ceil(n * this.particleMul);
    for (let i = 0; i < n; i++) {
      let dx = rand(-1, 1), dy = rand(-1, 1), dz = rand(-1, 1);
      if (o.dir) { dx = o.dir.x + dx * (o.spread ?? 0.5); dy = o.dir.y + dy * (o.spread ?? 0.5); dz = o.dir.z + dz * (o.spread ?? 0.5); }
      if (o.flat) dy = Math.abs(dy) * 0.3;
      const l = Math.hypot(dx, dy, dz) || 1, s = sp * rand(0.4, 1.1);
      P.spawn(p.x + rand(-1, 1) * (o.jitter ?? 0), p.y + rand(-1, 1) * (o.jitter ?? 0), p.z + rand(-1, 1) * (o.jitter ?? 0),
        dx / l * s, dy / l * s + (o.up ?? 0), dz / l * s, rand(0.6, 1) * (o.life ?? 0.5), o.s0 ?? 0.3, o.s1 ?? 0,
        o.c0 ?? C.white, o.c1 ?? C.wind, o.drag ?? 4, o.grav ?? 0, o.alpha ?? 1);
    }
  },
  hitSpark(p, dir, big, fire, el) {
    const E = !fire && el && ELEM_FX[el];
    if (E) return this.elemSpark(p, dir, big, E);
    const c0 = fire ? C.fireHot : C.white, c1 = fire ? C.ember : C.wind;
    this.burst(p, big ? 46 : 22, { speed: big ? 22 : 15, dir, spread: 1.1, life: 0.35, s0: big ? 0.45 : 0.3, c0, c1, drag: 7 });
    this.burst(p, big ? 10 : 4, { speed: big ? 9 : 7, life: big ? 0.55 : 0.4, s0: 0.5, s1: big ? 1.2 : 0.9, c0: fire ? C.smokeL : new THREE.Color(0.8, 0.95, 1), c1: fire ? C.smoke : new THREE.Color(0.5, 0.7, 0.8), drag: 5, add: false, alpha: 0.55, jitter: 0.25 });
    this.star(p, big ? 2.8 : 1.8, fire ? 0xffaa44 : HC.pale, big ? 0.14 : 0.09);
    if (big) this.ringBill(p, 3.5, fire ? 0xff8833 : HC.pale, 0.25);
  },
  // element-coloured impact: white-hot core, element body, accent fleck + ground flash on big hits
  elemSpark(p, dir, big, E) {
    this.burst(p, big ? 40 : 20, { speed: big ? 22 : 15, dir, spread: 1.1, life: 0.35, s0: big ? 0.5 : 0.32, c0: E.c0, c1: E.c1, drag: 7 });
    this.burst(p, big ? 16 : 7, { speed: big ? 12 : 8, dir, spread: 1.6, life: 0.45, s0: big ? 0.38 : 0.26, c0: E.c1, c1: E.c2, drag: 5 });
    this.burst(p, big ? 8 : 3, { speed: big ? 9 : 7, life: big ? 0.55 : 0.4, s0: 0.5, s1: big ? 1.15 : 0.85, c0: E.c1, c1: E.c2, drag: 5, add: false, alpha: 0.55, jitter: 0.25 });
    this.star(p, big ? 2.6 : 1.6, E.mid, big ? 0.15 : 0.09);
    if (big) { this.ringBill(p, 3.2, E.acc, 0.25); if (p.y < 2.5) this.groundRing(new THREE.Vector3(p.x, 0.05, p.z), 2.4, E.mid, 0.35); }
  },
  star(p, size, color, dur) {
    const m = new THREE.Mesh(this.planeGeo, starMaterial(color));
    m.position.copy(p); m.renderOrder = 40;
    const rot = rand(0, TAU);
    const e = this.add(m, dur, (e, k) => { const s = size * (0.6 + 0.6 * easeOutF(k)); m.scale.set(s, s, s); m.material.uniforms.opacity.value = 1 - k; m.material.uniforms.rot.value = rot; });
    e.billboard = true;
  },
  // anime eye glint on the hero (or a head flash on primitive rigs)
  eyeGlint(rig, color = HC.pale) {
    const eyes = rig.eyeL ? [rig.eyeL, rig.eyeR] : [rig.headMesh];
    eyes.forEach((e, i) => { const p = e.getWorldPosition(new V3()); setTimeout(() => this.star(p, 0.35 - i * 0.08, color, 0.32), i * 40); });
    Sfx.glint && Sfx.glint();
  },
  ringBill(p, size, color, dur) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(p); m.renderOrder = 35;
    const e = this.add(m, dur, (e, k) => { const s = size * easeOutF(k) + 0.2; m.scale.set(s, s, s); m.material.opacity = (1 - k); });
    e.billboard = true;
  },
  groundRing(p, size, color, dur, thick = 0.85) {
    const geo = thick === 0.85 ? this.ringGeo : new THREE.RingGeometry(thick, 1, 64);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    if (geo !== this.ringGeo) m.userData.ownGeo = true;
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, Math.max(p.y, 0) + 0.06, p.z); m.renderOrder = 25;
    this.add(m, dur, (e, k) => { const s = size * easeOutF(k) + 0.1; m.scale.set(s, s, s); m.material.opacity = (1 - k) * 0.9; });
  },
  slash(pos, yaw, tilt, radius, color, dur = 0.22, theta = 2.4, flip = false) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(arcGeometry(radius * 0.55, radius, theta), slashMaterial(color));
    m.userData.ownGeo = true;
    g.add(m);
    g.position.copy(pos);
    g.rotation.set(0, yaw, 0, 'YXZ');
    m.rotation.set(0, Math.PI / 2, 0);
    m.rotation.z = tilt;
    if (flip) m.scale.x = -1;
    this.add(g, dur, (e, k) => {
      m.material.uniforms.head.value = Math.min(1, k * 3.2) + 0.2;
      m.material.uniforms.opacity.value = 1 - Math.pow(k, 1.5);
      const s = 1 + k * 0.35; g.scale.set(s, s, s);
    });
  },
  ghost(rig, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    mat.userData.shared = true;
    if (rig.model) {
      const now = performance.now();
      if (now - (rig._ghostAt || 0) < 30 || this.list.length > 110) return; // ghost budget
      rig._ghostAt = now;
      const m = rig.model.bake(mat);
      this.add(m, 0.28, (e, k) => { mat.opacity = 0.4 * (1 - k); if (k >= 1) { mat.dispose(); if (m.userData.ghostSkel) m.userData.ghostSkel.dispose(); else m.geometry.dispose(); } });
      return;
    }
    const g = rig.root.clone(true);
    g.traverse(o => { if (o.isMesh) { if (o.userData.isOutline || o.userData.noGhost) o.visible = false; else o.material = mat; o.castShadow = false; } });
    mat.userData.shared = true;
    this.add(g, 0.28, (e, k) => { mat.opacity = 0.45 * (1 - k); if (k >= 1) mat.dispose(); });
  },
  popup(world, text, cls, cam) {
    const v = world.clone().project(cam);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'pop ' + (cls || '');
    el.textContent = text;
    el.style.left = ((v.x * 0.5 + 0.5) * 100 + rand(-2, 2)) + '%';
    el.style.top = ((-v.y * 0.5 + 0.5) * 100 + rand(-2, 2)) + '%';
    this.popLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  },
};
/* ---------- round 2: impact language ---------- */
Object.assign(FX, {
  shockwave(pos, size = 0.5, str = 1, dur = 0.45) {
    const W = Render.waves || (Render.waves = []);
    W.push({ pos: pos.clone(), size, str, dur, t: 0 });
    if (W.length > 4) W.shift();
  },
  lineMat(color) {
    return new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying vec2 vUv;
        void main(){ float a = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159) * (1.0 - abs(vUv.x - 0.5) * 2.0); gl_FragColor = vec4(color * 2.0, clamp(a, 0.0, 1.0) * opacity); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  },
  // anime impact lines radiating from the hit point
  impactLines(pos, n, color, size = 3, dur = 0.2) {
    const g = new THREE.Group(); g.position.copy(pos); g.renderOrder = 45;
    const mat = this.lineMat(color);
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const lines = [];
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group(); pivot.rotation.z = rand(0, TAU);
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 45;
      m.userData.len = rand(0.5, 1) * size; m.userData.w = rand(0.04, 0.12) * size * 0.4; m.userData.off = rand(0.2, 0.6) * size * 0.3;
      pivot.add(m); g.add(pivot); lines.push(m);
    }
    const e = this.add(g, dur, (e, k) => {
      for (const m of lines) { const L = m.userData.len * (0.4 + easeOutF(k) * 0.8); m.scale.set(m.userData.w * (1 - k), L, 1); m.position.y = m.userData.off + easeOutF(k) * m.userData.off * 2; }
      mat.uniforms.opacity.value = 1 - k * k;
      if (k >= 1) geo.dispose();
    });
    e.billboard = true;
  },
  // layered crescent wind blade that slices forward
  windBlade(pos, yaw, tilt, radius, color, big, flip, travel = 3) {
    const fwd = dirOf(yaw);
    const layers = big ? [[1, 0, 1], [0.82, -0.12, 0.6], [1.18, 0.12, 0.45]] : [[1, 0, 1], [0.85, -0.1, 0.5]];
    layers.forEach(([sc, rot, op], i) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(arcGeometry(radius * (big ? 0.42 : 0.5) * sc, radius * sc, big ? 2.9 : 2.5), slashMaterial(i === 0 ? color : HC.mid));
      m.userData.ownGeo = true;
      g.add(m); g.position.copy(pos);
      g.rotation.set(0, yaw, 0, 'YXZ');
      m.rotation.set(0, Math.PI / 2, 0); m.rotation.z = tilt + rot;
      if (flip) m.scale.x = -1;
      const dur = (big ? 0.34 : 0.24) + i * 0.04, base = pos.clone();
      this.add(g, dur, (e, k) => {
        const kk = Math.max(0, k - i * 0.08);
        m.material.uniforms.head.value = Math.min(1, kk * 3.4) + 0.25;
        m.material.uniforms.opacity.value = op * (1 - Math.pow(k, 1.4));
        const s = 1 + k * (big ? 0.6 : 0.35); g.scale.set(s, s * (1 - k * 0.3), s);
        g.position.copy(base).addScaledVector(fwd, easeOutF(k) * travel);
      });
    });
    // streaks along the arc
    const side = new V3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (let i = 0; i < (big ? 26 : 14); i++) {
      const a = rand(-1.2, 1.2), r = radius * rand(0.6, 1.05);
      const p = pos.clone().addScaledVector(fwd, Math.cos(a) * r * 0.6).addScaledVector(side, Math.sin(a) * r);
      p.y += Math.sin(tilt) * Math.sin(a) * r;
      this.add_.spawn(p.x, p.y, p.z, fwd.x * rand(8, 18) + side.x * Math.sin(a) * 4, rand(-1, 1), fwd.z * rand(8, 18) + side.z * Math.sin(a) * 4, rand(0.2, 0.35), rand(0.15, 0.35), 0, C.white, C.wind, 5, 0, 0.9);
    }
  },
  dmgNumber(world, n, kind, label) {
    const v = world.clone().project(Render.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'dnum ' + (kind || '');
    const dx = rand(-30, 30);
    el.style.left = ((v.x * 0.5 + 0.5) * 100) + '%';
    el.style.top = ((-v.y * 0.5 + 0.5) * 100) + '%';
    el.style.setProperty('--dx', dx + 'px');
    el.style.setProperty('--rot', rand(-10, 10) + 'deg');
    el.innerHTML = (label ? `<small>${label}</small>` : '') + `<span>${n}</span>`;
    this.popLayer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },
  sfxWord(world, fire) {
    const v = world.clone().project(Render.camera);
    if (v.z > 1) return;
    const words = fire ? ['KRAKK!', 'DOOM!', 'BWAM!', 'GRRAK!'] : ['SHHRAK!', 'VWOOSH!', 'FWAKK!', 'ZWING!', 'WHUMM!'];
    const el = document.createElement('div');
    el.className = 'sword ' + (fire ? 'fire' : '');
    el.textContent = pick(words);
    el.style.left = ((v.x * 0.5 + 0.5) * 100 + rand(-8, 8)) + '%';
    el.style.top = ((-v.y * 0.5 + 0.5) * 100 + rand(-12, -4)) + '%';
    el.style.setProperty('--rot', rand(-18, 18) + 'deg');
    this.popLayer.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },
});
function easeOutF(t) { return 1 - Math.pow(1 - t, 3); }
