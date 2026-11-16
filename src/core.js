'use strict';
/* ============================================================
   GALEBORN — core utilities, renderer, post-processing
   ============================================================ */
const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
const dampAngle = (a, b, rate, dt) => a + angleDiff(a, b) * (1 - Math.exp(-rate * dt));
const yawOf = (x, z) => Math.atan2(x, z);
const dirOf = (yaw, out = new V3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
const _sp = new V3(), _sa = new V3();
function segPointDist(p, a, b) {
  _sa.subVectors(b, a);
  const l2 = _sa.lengthSq();
  let t = l2 > 0 ? _sp.subVectors(p, a).dot(_sa) / l2 : 0;
  t = clamp(t, 0, 1);
  return _sp.copy(a).addScaledVector(_sa, t).distanceTo(p);
}
function seg2Dist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t - px, cz = az + dz * t - pz;
  return Math.sqrt(cx * cx + cz * cz);
}
const horizDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const ARENA_R = 16;

/* ---------------- Renderer + post (bloom, impact frames, speed lines) ---------------- */
const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const Render = {
  init() {
    const canvas = document.getElementById('game');
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = true;
    this.r = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
    this.baseFov = 40;
    this.post = {
      strength: 0.9, impact: 0, impactInv: 0, aberr: 0, speed: 0, flash: 0, sat: 1.08,
      tint: new THREE.Color(0.55, 0.85, 1.0), tintAmt: 0, lowHp: 0,
    };
    this.cut = { amt: 0, slide: 0, cam: null, color: new THREE.Color(0x40e0ff) };
    this.setupPost();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  setupPost() {
    const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.rtCut = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.levels = [];
    for (let i = 0; i < 3; i++) {
      this.levels.push([new THREE.WebGLRenderTarget(4, 4, rtOpts), new THREE.WebGLRenderTarget(4, 4, rtOpts)]);
    }
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.fsQuad.frustumCulled = false;
    this.fsScene.add(this.fsQuad);

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: 0.82 } },
      vertexShader: FS_VERT,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = clamp(c, 0.0, 16.0); float l = max(c.r, max(c.g, c.b));
          float k = max(l - threshold, 0.0) / max(l, 1e-4); gl_FragColor = vec4(c * k, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227;
          s += texture2D(tDiffuse, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tDiffuse, vUv - dir * 1.385).rgb * 0.316;
          s += texture2D(tDiffuse, vUv + dir * 3.231).rgb * 0.070; s += texture2D(tDiffuse, vUv - dir * 3.231).rgb * 0.070;
          gl_FragColor = vec4(s, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null },
        strength: { value: 0.9 }, impact: { value: 0 }, impactInv: { value: 0 }, aberr: { value: 0 }, speed: { value: 0 },
        flash: { value: 0 }, sat: { value: 1 }, tint: { value: new THREE.Color() }, tintAmt: { value: 0 },
        lowHp: { value: 0 }, time: { value: 0 }, aspect: { value: 1 },
        sw: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
        tCut: { value: null }, cutAmt: { value: 0 }, cutSlide: { value: 0 }, cutColor: { value: new THREE.Color() },
      },
      vertexShader: FS_VERT,
      fragmentShader: `
        uniform sampler2D tScene, tB0, tB1, tB2; uniform float strength, impact, impactInv, aberr, speed, flash, sat, tintAmt, lowHp, time, aspect;
        uniform vec3 tint; uniform vec4 sw[4]; uniform sampler2D tCut; uniform float cutAmt, cutSlide; uniform vec3 cutColor; varying vec2 vUv;
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        vec3 softClip(vec3 x){ vec3 o = x - 0.8; return mix(x, 0.8 + o / (1.0 + o / 0.25), step(0.8, x)); }
        void main(){
          vec2 uv = vUv;
          for (int i = 0; i < 4; i++) {
            vec4 s = sw[i];
            if (s.w > 0.001) {
              vec2 d = (uv - s.xy) * vec2(aspect, 1.0); float r = length(d);
              float ring = smoothstep(0.09, 0.0, abs(r - s.z));
              uv -= (d / max(r, 1e-4)) / vec2(aspect, 1.0) * ring * s.w * 0.04;
            }
          }
          vec2 c = uv - 0.5;
          float ab = aberr * 0.014;
          vec3 col;
          col.r = texture2D(tScene, uv + c * ab).r;
          col.g = texture2D(tScene, uv).g;
          col.b = texture2D(tScene, uv - c * ab).b;
          if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0); col = clamp(col, 0.0, 16.0);
          vec3 bl = texture2D(tB0, uv).rgb * 0.55 + texture2D(tB1, uv).rgb * 0.75 + texture2D(tB2, uv).rgb * 1.0;
          col += bl * strength;
          col = softClip(col);
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(lum), col, sat);
          col = mix(col, vec3(lum) * tint * 1.25 + col * 0.25, tintAmt);
          vec2 cc = vec2(c.x * aspect, c.y); float r = length(cc);
          if (cutAmt > 0.001) {
            vec2 q = vUv - 0.5;
            float dl = q.y - q.x * 0.28;
            float hw = 0.17 * cutAmt;
            float inside = step(abs(dl), hw);
            float edge = step(abs(dl), hw + 0.007) - inside;
            vec2 cu = vec2(vUv.x * 0.9 + 0.05 + (1.0 - cutSlide) * 0.04, 0.5 + dl / 0.34);
            vec3 ct = texture2D(tCut, cu).rgb;
            if (any(isnan(ct))) ct = vec3(0.0);
            float lines = step(0.55, hash(floor(vUv.x * 90.0 - dl * 40.0) + floor(time * 30.0)));
            vec3 bg = cutColor * (0.35 + 0.25 * lines);
            float cl = dot(ct, vec3(0.299, 0.587, 0.114));
            ct = mix(bg, ct, smoothstep(0.02, 0.12, cl) * 0.85 + 0.15);
            col *= 1.0 - 0.5 * cutAmt * (1.0 - inside);
            col = mix(col, ct * 1.1, inside);
            col = mix(col, vec3(1.0), edge);
          }
          if (speed > 0.001) {
            float ang = atan(cc.y, cc.x);
            float id = floor(ang * 28.0);
            float h = hash(id + floor(time * 18.0) * 7.13);
            float w = fract(ang * 28.0);
            float line = step(0.62, h) * smoothstep(0.5, 0.15, abs(w - 0.5)) * smoothstep(0.28 + h * 0.15, 0.75, r);
            col = mix(col, vec3(1.0), line * speed * 0.75);
          }
          col *= 1.0 - 0.55 * dot(c, c) * 1.6;
          col = mix(col, col * vec3(1.25, 0.25, 0.22), lowHp * smoothstep(0.15, 0.6, r));
          if (impact > 0.001) {
            float l2 = dot(col, vec3(0.299, 0.587, 0.114));
            float th = smoothstep(0.3, 0.42, l2);
            th = mix(th, 1.0 - th, impactInv);
            vec3 ink = mix(vec3(0.98, 0.94, 0.88), vec3(0.06, 0.02, 0.05), th);
            ink = mix(ink, vec3(0.95, 0.15, 0.1), step(0.75, l2) * 0.6 * (1.0 - impactInv));
            col = mix(col, ink, impact);
          }
          col = mix(col, vec3(1.0), flash);
          gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
  },
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.r.getPixelRatio();
    const ds = typeof Perf !== 'undefined' ? Perf.scale : 1;
    const W = Math.floor(w * pr * ds), H = Math.floor(h * pr * ds);
    this.rtScene.setSize(W, H);
    this.rtCut.setSize(W, Math.max(4, Math.floor(H * 0.34)));
    let lw = W >> 1, lh = H >> 1;
    for (const [a, b] of this.levels) { a.setSize(Math.max(lw, 1), Math.max(lh, 1)); b.setSize(Math.max(lw, 1), Math.max(lh, 1)); lw >>= 1; lh >>= 1; }
    this.compMat.uniforms.aspect.value = w / h;
    this.pointScale = H * 0.5 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    if (typeof FX !== 'undefined' && FX.onResize) FX.onResize();
  },
  pass(mat, target) {
    this.fsQuad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.fsScene, this.fsCam);
  },
  render(time) {
    const r = this.r;
    // medium/low: refresh the shadow map at half rate (fighters' shadows still track, scenery never moves)
    this.frameN = (this.frameN || 0) + 1;
    const q = typeof Settings !== 'undefined' ? Quality.level : 'high';
    r.shadowMap.autoUpdate = !(q === 'medium' || q === 'low');
    if (!r.shadowMap.autoUpdate) r.shadowMap.needsUpdate = (this.frameN & 1) === 0;
    r.setRenderTarget(this.rtScene);
    r.render(this.scene, this.camera);
    // bloom chain
    this.brightMat.uniforms.tDiffuse.value = this.rtScene.texture;
    this.pass(this.brightMat, this.levels[0][0]);
    let src = this.levels[0][0];
    for (let i = 0; i < 3; i++) {
      const [a, b] = this.levels[i];
      if (i > 0) { // downsample previous level into this level
        this.blurMat.uniforms.tDiffuse.value = src.texture;
        this.blurMat.uniforms.dir.value.set(1 / src.width, 0);
        this.pass(this.blurMat, a);
      }
      this.blurMat.uniforms.tDiffuse.value = a.texture;
      this.blurMat.uniforms.dir.value.set(1 / a.width, 0);
      this.pass(this.blurMat, b);
      this.blurMat.uniforms.tDiffuse.value = b.texture;
      this.blurMat.uniforms.dir.value.set(0, 1 / b.height);
      this.pass(this.blurMat, a);
      src = a;
    }
    if (this.cut.amt > 0.001 && this.cut.cam) {
      r.setRenderTarget(this.rtCut);
      r.render(this.scene, this.cut.cam);
    }
    const u = this.compMat.uniforms, p = this.post;
    u.tCut.value = this.rtCut.texture; u.cutAmt.value = this.cut.amt; u.cutSlide.value = this.cut.slide; u.cutColor.value.copy(this.cut.color);
    u.tScene.value = this.rtScene.texture;
    u.tB0.value = this.levels[0][0].texture;
    u.tB1.value = this.levels[1][0].texture;
    u.tB2.value = this.levels[2][0].texture;
    u.strength.value = p.strength; u.impact.value = p.impact * (1 - 0.85 * (this.cut ? this.cut.amt : 0)); u.impactInv.value = p.impactInv || 0; u.aberr.value = p.aberr;
    u.speed.value = p.speed; u.flash.value = p.flash * (1 - 0.75 * (this.cut ? this.cut.amt : 0)); u.sat.value = p.sat;
    u.tint.value.copy(p.tint); u.tintAmt.value = p.tintAmt; u.lowHp.value = p.lowHp; u.time.value = time;
    const waves = this.waves || [];
    for (let i = 0; i < 4; i++) {
      const w = waves[i], U = u.sw.value[i];
      if (!w) { U.set(0, 0, 0, 0); continue; }
      const v = w.pos.clone().project(this.camera);
      if (v.z > 1) { U.set(0, 0, 0, 0); continue; }
      const k = w.t / w.dur, e = 1 - Math.pow(1 - k, 3);
      U.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5, e * w.size, w.str * (1 - k));
    }
    this.pass(this.compMat, null);
  },
};

/* ---------------- Toon materials + outlines ---------------- */
let GRAD = null;
function toonGradient() {
  if (GRAD) return GRAD;
  const data = new Uint8Array([92, 255]);
  GRAD = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
  GRAD.needsUpdate = true;
  return GRAD;
}
// hard anime rim light on a toon material
function addRim(mat, color, strength = 0.6, edge = 0.62) {
  if (mat.userData.rim) return mat;
  mat.userData.rim = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.rimColor = { value: new THREE.Color(color) };
    sh.uniforms.rimStr = { value: strength };
    sh.fragmentShader = 'uniform vec3 rimColor; uniform float rimStr;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      `float rimF = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
       outgoingLight += rimColor * step(${edge.toFixed(2)}, rimF) * rimStr;
       #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'rim' + color + strength;
  mat.needsUpdate = true;
  return mat;
}
// merge non-indexed geometries that share position/normal/uv into one
function mergeGeos(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = geos[0].attributes[name].itemSize, arr = new Float32Array(n * size);
    let o = 0; for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}
function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGradient() }, opts));
}
const OUTLINE_MATS = {};
function outlineMat(th = 0.022, color = 0x14101a) {
  const key = th + '_' + color;
  if (OUTLINE_MATS[key]) return OUTLINE_MATS[key];
  OUTLINE_MATS[key] = new THREE.ShaderMaterial({
    uniforms: { th: { value: th }, color: { value: new THREE.Color(color) } },
    vertexShader: `uniform float th; void main(){ vec3 p = position + normal * th; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide,
  });
  OUTLINE_MATS[key].userData.shared = true;
  return OUTLINE_MATS[key];
}
function addOutline(mesh, th) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat(th));
  o.castShadow = false; o.receiveShadow = false;
  o.userData.isOutline = true;
  mesh.add(o);
  return o;
}
