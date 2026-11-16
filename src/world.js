'use strict';
/* ============================================================
   World: the Sundered Spire — a floating stone dais above the clouds
   ============================================================ */
const World = {
  build(scene) {
    this.scene = scene;
    this.palette = {
      p1: { top: new THREE.Color(0x1d3f7a), mid: new THREE.Color(0x6f8fc8), hor: new THREE.Color(0xffb58a), sun: new THREE.Color(0xfff0c0), fog: new THREE.Color(0xc7a6a8), hemiS: new THREE.Color(0xbfd8ff), hemiG: new THREE.Color(0x6a4a3a), sunC: new THREE.Color(0xffe2c0), cloud: new THREE.Color(0xf6dcd6) },
      p2: { top: new THREE.Color(0x12040a), mid: new THREE.Color(0x4a0d12), hor: new THREE.Color(0xff5520), sun: new THREE.Color(0xff6a2a), fog: new THREE.Color(0x5a1a14), hemiS: new THREE.Color(0xff9a7a), hemiG: new THREE.Color(0x3a1008), sunC: new THREE.Color(0xff9a60), cloud: new THREE.Color(0x8a2a1a) },
    };
    this.mix = 0; this.mixTarget = 0;
    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, sunDir: { value: new V3(-0.4, 0.18, -0.9).normalize() }, time: { value: 0 } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top, mid, hor, sun, sunDir; uniform float time; varying vec3 vD;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){ float y = vD.y;
          vec3 c = mix(hor, mid, smoothstep(-0.05, 0.25, y)); c = mix(c, top, smoothstep(0.25, 0.85, y));
          float sd = max(dot(vD, sunDir), 0.0);
          c += sun * (pow(sd, 400.0) * 3.0 + pow(sd, 12.0) * 0.45);
          // painted streak clouds
          float band = sin(atan(vD.z, vD.x) * 7.0 + y * 30.0 + time * 0.02) * 0.5 + 0.5;
          float cl = smoothstep(0.02, 0.12, y) * smoothstep(0.32, 0.12, y) * smoothstep(0.55, 0.95, band);
          c = mix(c, hor * 1.15 + 0.08, cl * 0.35);
          // stars at top
          vec2 sp = floor(vD.xz / (y + 1.2) * 220.0); float st = step(0.997, h(sp)) * smoothstep(0.5, 0.9, y);
          c += st * 0.6 * (top.b > 0.2 ? 0.25 : 1.0);
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    sky.renderOrder = -10;
    scene.add(sky);
    scene.fog = new THREE.Fog(0xc7a6a8, 70, 330);
    // lights
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6a4a3a, 1.1);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffe2c0, 2.0));
    sun.position.set(-18, 34, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 100;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    // arena dais
    const tex = this.arenaTexture();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 2, ARENA_R + 2, 1, 64), [toon(0x8a7a6c), toon(0xffffff, { map: tex }), toon(0x8a7a6c)]);
    top.position.y = -0.5; top.receiveShadow = true; this.top = top;
    scene.add(top);
    const under = new THREE.Mesh(new THREE.ConeGeometry(ARENA_R + 2, 30, 18, 4), toon(0x5c4c44));
    under.position.y = -16; under.rotation.y = 0.3; under.rotation.x = Math.PI;
    scene.add(under); addOutline(under, 0.2);
    // rim stones
    const rimMat = toon(0x9c8b78);
    const rimGeos = [];
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU;
      const g = new THREE.BoxGeometry(2.6, 0.5, 1.0).toNonIndexed();
      g.applyMatrix4(new THREE.Matrix4().compose(new V3(Math.cos(a) * (ARENA_R + 1.6), 0.15, Math.sin(a) * (ARENA_R + 1.6)), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2), new V3(1, 1, 1)));
      rimGeos.push(g);
    }
    // one draw call for the whole ring (plus one for its ink outline)
    const rim = new THREE.Mesh(mergeGeos(rimGeos), rimMat);
    rim.castShadow = true; rim.receiveShadow = true; addOutline(rim, 0.035);
    scene.add(rim);
    // pillars, some broken
    const pillarMat = toon(0xb8a892), capMat = toon(0x7e6e60);
    this.pillars = [];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + 0.15;
      const broken = i % 3 === 1;
      const h = broken ? rand(3, 6) : rand(9, 12);
      const g = new THREE.Group();
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, h, 10), pillarMat);
      col.position.y = h / 2; col.castShadow = true; col.receiveShadow = true;
      addOutline(col, 0.05);
      g.add(col);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 2.6), capMat); base.position.y = 0.4; base.castShadow = true; g.add(base);
      if (!broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), capMat); cap.position.y = h + 0.3; cap.castShadow = true; g.add(cap); addOutline(cap, 0.05); }
      else { const chunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 10), pillarMat); chunk.position.set(1.6, 0.6, 0.4); chunk.rotation.set(0.2, 0.3, 1.45); chunk.castShadow = true; g.add(chunk); }
      // hanging banners (wind-catchers)
      if (!broken && i % 2 === 0) {
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.5, 1, 6), new THREE.MeshToonMaterial({ color: 0x1f8e88, side: THREE.DoubleSide, gradientMap: toonGradient() }));
        ban.position.set(0, h - 2.6, 1.0); g.add(ban); ban.userData.banner = true;
        this.pillars.push(ban);
      }
      g.position.set(Math.cos(a) * (ARENA_R + 1.0), 0, Math.sin(a) * (ARENA_R + 1.0));
      g.rotation.y = -a - Math.PI / 2;
      scene.add(g);
    }
    // floating islands + distant spires
    this.floaters = [];
    const rockMat = toon(0x7a6658), grassMat = toon(0x6f9a5a);
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), d = rand(45, 120), s = rand(1.5, 7);
      const g = new THREE.Group();
      const r = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.2, 6, 1), rockMat); r.rotation.x = Math.PI; r.position.y = -s * 1.1; g.add(r);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.02, s, s * 0.3, 6), grassMat); t.position.y = s * 0.1; g.add(t);
      for (const m of [r, t]) { const o = new THREE.Mesh(m.geometry, outlineMat(0.1 + s * 0.025, 0x2a1e30)); m.add(o); }
      g.position.set(Math.cos(a) * d, rand(-15, 25), Math.sin(a) * d);
      g.userData.base = g.position.y; g.userData.ph = rand(0, TAU);
      scene.add(g); this.floaters.push(g);
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU), d = rand(170, 260), h = rand(40, 120);
      const m = new THREE.Mesh(new THREE.ConeGeometry(rand(10, 22), h, 5), toon(0x6d5f78));
      m.position.set(Math.cos(a) * d, h / 2 - 50, Math.sin(a) * d);
      scene.add(m);
    }
    // sea of clouds below
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0xf6dcd6) }, fogC: { value: new THREE.Color() } },
      vertexShader: `varying vec2 vP; varying float vD; void main(){ vP = position.xy; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float time; uniform vec3 color, fogC; varying vec2 vP; varying float vD;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){ vec2 p = vP * 0.025 + vec2(time * 0.01, time * 0.004);
          float v = n(p) * 0.5 + n(p * 2.1) * 0.3 + n(p * 4.3) * 0.2;
          float t = smoothstep(0.35, 0.7, v);
          vec3 c = mix(color * 0.62, color, floor(t * 3.0) / 2.0);
          c = mix(c, fogC, smoothstep(80.0, 420.0, vD));
          gl_FragColor = vec4(c, 1.0); }`,
      fog: false,
    });
    const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.cloudMat);
    clouds.rotation.x = -Math.PI / 2; clouds.position.y = -42;
    scene.add(clouds);
    // fire ring for phase 2 (hidden until enraged)
    this.fireRingMat = swirlMaterial(0xff9a30, 0xff2200, { twist: 0.15, speed: 1.2, bands: 160, edge: 0.3, opacity: 0 });
    const fr = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 0.6, ARENA_R + 0.6, 3.5, 96, 1, true), this.fireRingMat);
    fr.position.y = 1.7; fr.renderOrder = 15;
    scene.add(fr);
    this.fireRing = fr;
    this.buildScenery();
    this.applyPalette(0);
    this.buildDestructibles();
  },
  arenaTexture() {
    const S = 1024, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = '#b6a48e'; g.fillRect(0, 0, S, S);
    const cx = S / 2, R = S / 2;
    // concentric tile rings
    const rings = [0.12, 0.26, 0.42, 0.58, 0.74, 0.9, 1.0];
    for (let i = rings.length - 1; i >= 1; i--) {
      const r0 = rings[i - 1] * R, r1 = rings[i] * R;
      const n = Math.floor(6 + i * 7);
      for (let k = 0; k < n; k++) {
        const a0 = k / n * TAU + i * 0.3, a1 = (k + 1) / n * TAU + i * 0.3;
        const shade = 160 + Math.floor(Math.random() * 30) - (i % 2) * 12;
        g.fillStyle = `rgb(${shade + 22},${shade + 8},${shade - 12})`;
        g.beginPath(); g.arc(cx, cx, r1 - 3, a0 + 0.006, a1 - 0.006); g.arc(cx, cx, r0 + 3, a1 - 0.006, a0 + 0.006, true); g.closePath(); g.fill();
      }
    }
    // central sigil: an original "four winds" emblem
    g.strokeStyle = 'rgba(40,110,120,0.85)'; g.lineWidth = 10;
    g.beginPath(); g.arc(cx, cx, R * 0.11, 0, TAU); g.stroke();
    g.lineWidth = 7;
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(cx, cx); g.rotate(k * Math.PI / 2);
      g.beginPath(); g.moveTo(0, -R * 0.03);
      g.bezierCurveTo(R * 0.12, -R * 0.06, R * 0.18, R * 0.04, R * 0.08, R * 0.1);
      g.bezierCurveTo(R * 0.04, R * 0.12, R * 0.0, R * 0.06, R * 0.05, R * 0.04);
      g.stroke(); g.restore();
    }
    g.strokeStyle = 'rgba(60,40,30,0.35)'; g.lineWidth = 4;
    g.beginPath(); g.arc(cx, cx, R * 0.42, 0, TAU); g.stroke();
    // grime + cracks
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,45,35' : '255,240,220'},${Math.random() * 0.08})`;
      const r = Math.random() * 12;
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, r, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(50,35,28,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      let x = Math.random() * S, y = Math.random() * S; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  },
  applyPalette(k) {
    const a = this.palette.p1, b = this.palette.p2, u = this.skyMat.uniforms;
    const L = (o, x, y) => o.copy(x).lerp(y, k);
    L(u.top.value, a.top, b.top); L(u.mid.value, a.mid, b.mid); L(u.hor.value, a.hor, b.hor); L(u.sun.value, a.sun, b.sun);
    L(this.scene.fog.color, a.fog, b.fog);
    L(this.hemi.color, a.hemiS, b.hemiS); L(this.hemi.groundColor, a.hemiG, b.hemiG); L(this.sun.color, a.sunC, b.sunC);
    L(this.cloudMat.uniforms.color.value, a.cloud, b.cloud);
    this.cloudMat.uniforms.fogC.value.copy(this.scene.fog.color);
    this.fireRingMat.uniforms.opacity.value = k * 0.55;
    this.fireRing.visible = k > 0.01;
    if (this.cloudSprites) {
      const cc = this.palette.p1.cloud.clone().lerp(new THREE.Color(0x7a2a20), k);
      for (const c of this.cloudSprites) c.material.color.copy(cc).multiplyScalar(c.userData.shade);
      for (const w of this.falls) { w.uniforms.color.value.copy(new THREE.Color(0xd8f4ff).lerp(new THREE.Color(0xff7a20), k)); w.uniforms.color2.value.copy(new THREE.Color(0x4aa8e0).lerp(new THREE.Color(0xc02800), k)); }
      this.streamMat.uniforms.opacity.value = 0.35 * (1 - k);
      this.moonMat.color.copy(new THREE.Color(0xe8e0f0).lerp(new THREE.Color(0xff6040), k));
    }
  },
  /* ---------------- scenery: clouds, waterfalls, sky temple, wind currents ---------------- */
  buildScenery() {
    const scene = this.scene;
    // soft painted cloud texture
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 60 + Math.random() * 30, r = 20 + Math.random() * 34;
      const gr = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(240,235,245,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(150,140,170,0.35)'; g.fillRect(0, 85, 256, 43);
    const ctex = new THREE.CanvasTexture(cv); ctex.colorSpace = THREE.SRGBColorSpace;
    this.cloudSprites = [];
    for (let i = 0; i < 70; i++) {
      const m = new THREE.SpriteMaterial({ map: ctex, transparent: true, depthWrite: false, fog: true });
      const sp = new THREE.Sprite(m);
      const a = rand(0, TAU), d = i < 30 ? rand(34, 90) : rand(90, 260);
      const s = i < 30 ? rand(18, 40) : rand(40, 110);
      sp.scale.set(s, s * 0.5, 1);
      sp.position.set(Math.cos(a) * d, i < 30 ? rand(-34, -14) : rand(-35, 25), Math.sin(a) * d);
      sp.userData = { a, d, sp: rand(0.003, 0.01) * (Math.random() < 0.5 ? -1 : 1), shade: rand(0.8, 1.05) };
      scene.add(sp); this.cloudSprites.push(sp);
    }
    // waterfalls pouring off the larger floating islands
    this.falls = [];
    const big = this.floaters.slice().sort((a, b) => b.children[0].geometry.parameters.radius - a.children[0].geometry.parameters.radius).slice(0, 5);
    for (const f of big) {
      const s = f.children[0].geometry.parameters.radius;
      const mat = swirlMaterial(0xd8f4ff, 0x4aa8e0, { twist: 0, speed: -1.6, bands: 3, edge: 0.0, opacity: 0.85 });
      mat.blending = THREE.NormalBlending;
      mat.fragmentShader = mat.fragmentShader.replace('gl_FragColor = vec4(c * (0.7 + band), (0.25 + band) * fade * opacity); }',
        'float st = step(0.5, fract(vUv.x * 9.0 + sin(vUv.y * 40.0 + time) * 0.05)); float fadeB = smoothstep(0.0, 0.35, vUv.y); gl_FragColor = vec4(mix(color2, color, max(band, st * 0.4)), (0.55 + band * 0.45) * fadeB * opacity); }');
      const geo = new THREE.CylinderGeometry(s * 0.22, s * 0.32, 60, 10, 1, true);
      const w = new THREE.Mesh(geo, mat);
      w.position.set(s * 0.55, -30, 0);
      f.add(w);
      this.falls.push(mat);
    }
    // distant sky temple on a great floating rock
    const T = new THREE.Group();
    const rockM = toon(0x6a5a50), wallM = toon(0xe8dcc8), roofM = toon(0x2b6f78), trimM = toon(0x8a3a2a);
    const lantern = new THREE.MeshBasicMaterial({ color: 0xffd890 });
    const base = new THREE.Mesh(new THREE.ConeGeometry(26, 60, 7), rockM); base.rotation.x = Math.PI; base.position.y = -30; T.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(26, 25, 4, 7), toon(0x6f9a5a)); top.position.y = 2; T.add(top);
    let y = 4;
    for (let k = 0; k < 5; k++) {
      const w = 14 - k * 2.4, h = 5 - k * 0.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), wallM); body.position.y = y + h / 2; T.add(body);
      for (let q = 0; q < 4; q++) { const lw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h * 0.35, 0.3), lantern); lw.position.set(Math.sin(q * Math.PI / 2) * w / 2, y + h * 0.5, Math.cos(q * Math.PI / 2) * w / 2); lw.rotation.y = q * Math.PI / 2; T.add(lw); }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, 3.2, 4, 1), roofM); roof.position.y = y + h + 1.4; roof.rotation.y = Math.PI / 4; T.add(roof);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.25, 0.5, w * 1.25), trimM); trim.position.y = y + h; T.add(trim);
      y += h + 2.6;
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 14, 6), trimM); spire.position.y = y + 6; T.add(spire);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(20, 0.9, 8, 64), new THREE.MeshBasicMaterial({ color: 0x7ff6ec })); halo.position.y = y - 6; halo.userData.halo = true; T.add(halo);
    T.position.set(-150, 18, -150); T.rotation.y = 0.6;
    scene.add(T); this.temple = T; this.halo = halo;
    // ringed moon
    this.moonMat = new THREE.MeshBasicMaterial({ color: 0xe8e0f0, fog: false });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 32, 16), this.moonMat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(38, 54, 64), new THREE.MeshBasicMaterial({ color: 0xc8b8e0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = 1.2; moon.add(ring);
    moon.position.set(140, 190, 320); scene.add(moon); this.moon = moon;
    // wind currents: dashed ribbons looping around the spire
    this.streamMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, opacity: { value: 0.35 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float time, opacity; varying vec2 vUv;
        void main(){ float d = fract(vUv.x * 14.0 - time * 0.6); float a = smoothstep(0.0, 0.1, d) * smoothstep(0.7, 0.3, d); gl_FragColor = vec4(vec3(0.85, 1.0, 1.0), a * opacity); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 5; i++) {
      const pts = []; const R = rand(40, 80), y0 = rand(-6, 22), ph = rand(0, TAU);
      for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU; pts.push(new V3(Math.cos(a + ph) * R * (1 + 0.15 * Math.sin(a * 3)), y0 + Math.sin(a * 2 + ph) * 8, Math.sin(a + ph) * R)); }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.35, 4, true), this.streamMat);
      scene.add(tube);
    }
    // a flock of sky birds
    this.birds = [];
    const birdM = new THREE.MeshBasicMaterial({ color: 0x2a2030, side: THREE.DoubleSide });
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.6, -1, 0.2, -0.3, 0, 0, 0, 0, 0, 0.6, 1, 0.2, -0.3, 0, 0, 0], 3));
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(bg, birdM); b.userData = { r: rand(30, 50), y: rand(12, 22), ph: rand(0, 0.6), off: new V3(rand(-4, 4), rand(-2, 2), rand(-4, 4)) }; scene.add(b); this.birds.push(b); }
    this.meteorT = 0;
  },
  updateScenery(dt, time) {
    for (const c of this.cloudSprites) { c.userData.a += c.userData.sp * dt; c.position.x = Math.cos(c.userData.a) * c.userData.d; c.position.z = Math.sin(c.userData.a) * c.userData.d; }
    for (const w of this.falls) w.uniforms.time.value = time;
    this.streamMat.uniforms.time.value = time;
    this.halo.rotation.x = Math.PI / 2 + Math.sin(time * 0.3) * 0.2; this.halo.rotation.y = time * 0.1;
    this.temple.position.y = 18 + Math.sin(time * 0.25) * 2;
    for (const b of this.birds) {
      const a = time * 0.25 + b.userData.ph;
      b.position.set(Math.cos(a) * b.userData.r + b.userData.off.x, b.userData.y + b.userData.off.y + Math.sin(time * 2 + b.userData.ph * 9) * 0.4, Math.sin(a) * b.userData.r + b.userData.off.z);
      b.rotation.y = -a; b.scale.set(1, 1 + Math.sin(time * 12 + b.userData.ph * 30) * 0.8, 1);
      b.visible = this.mix < 0.5;
    }
    // phase 2: meteors streak across the burning sky
    if (this.mix > 0.5) {
      this.meteorT -= dt;
      if (this.meteorT <= 0) {
        this.meteorT = rand(0.4, 1.4);
        const a = rand(0, TAU), d = rand(90, 200);
        const p = new V3(Math.cos(a) * d, rand(60, 120), Math.sin(a) * d), v = new V3(rand(-30, 30), -rand(40, 70), rand(-30, 30));
        const m = new THREE.Mesh(FX.planeGeo, glowMaterial(0xff7a30, 1)); m.scale.setScalar(6); m.position.copy(p);
        const e = FX.add(m, 2.2, (e, k) => { m.position.addScaledVector(v, 1 / 60); FX.add_.spawn(m.position.x, m.position.y, m.position.z, 0, 0, 0, 0.8, 4, 0.5, C.fireHot, C.ember, 0, 0, 0.9); });
        e.billboard = true;
      }
    }
  },

  /* ---------------- destructible pillars, debris, craters ---------------- */
  buildDestructibles() {
    this.dpillars = []; this.debris = []; this.craters = [];
    this.stoneMat = toon(0xc2b29c); this.stoneMat2 = toon(0x8e7e6e); this.floorMat = toon(0xb6a48e);
    const N = 6, R = ARENA_R * 0.66;
    const baseStone = this.stoneMat, baseStone2 = this.stoneMat2;
    for (let i = 0; i < N; i++) {
      this.stoneMat = baseStone.clone(); this.stoneMat2 = baseStone2.clone();
      for (const m of [this.stoneMat, this.stoneMat2]) { m.transparent = true; m.opacity = 1; }
      const a = i / N * TAU + Math.PI / N;
      const P = { x: Math.cos(a) * R, z: Math.sin(a) * R, r: 1.0, hp: 100, broken: false, drums: [], group: new THREE.Group() };
      P.group.position.set(P.x, 0, P.z);
      const H = 8.4, n = 4, dh = H / n;
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 2.5), this.stoneMat2); base.position.y = 0.3; base.castShadow = base.receiveShadow = true; P.group.add(base); addOutline(base, 0.04);
      for (let k = 0; k < n; k++) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.95, dh - 0.04, 12), this.stoneMat);
        d.position.y = 0.6 + dh * k + dh / 2; d.rotation.y = rand(0, TAU); d.castShadow = d.receiveShadow = true;
        addOutline(d, 0.045);
        P.group.add(d); P.drums.push(d);
      }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 2.3), this.stoneMat2); cap.position.y = 0.6 + H + 0.27; cap.castShadow = true; addOutline(cap, 0.04);
      P.group.add(cap); P.drums.push(cap);
      // glowing wind rune on each pillar
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0x40e8d8 }));
      rune.position.set(-Math.cos(a) * 0.93, 3.0, -Math.sin(a) * 0.93); rune.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
      P.group.add(rune); P.rune = rune;
      P.mats = [this.stoneMat, this.stoneMat2]; P.fade = 1;
      P.group.traverse(o => { if (o.isMesh) o.userData.home = { p: o.position.clone(), q: o.quaternion.clone(), parent: o.parent }; });
      this.scene.add(P.group);
      this.dpillars.push(P);
    }
    this.stoneMat = baseStone; this.stoneMat2 = baseStone2;
    this.crackTex = this.makeCrackTexture();
  },
  makeCrackTexture() {
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); const c = S / 2;
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    // green channel: scorch gradient
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(0,255,0,1)'); gr.addColorStop(0.45, 'rgba(0,180,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // red channel: cracks
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgb(255,0,0)'; g.lineCap = 'round';
    const branch = (x, y, a, len, w, depth) => {
      if (depth > 4 || len < 6) return;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      let px = x, py = y;
      const steps = 5;
      for (let i = 0; i < steps; i++) { a += rand(-0.35, 0.35); px += Math.cos(a) * len / steps; py += Math.sin(a) * len / steps; g.lineTo(px, py); }
      g.stroke();
      if (Math.random() < 0.7) branch(px, py, a + rand(-0.8, 0.8), len * 0.6, w * 0.65, depth + 1);
      branch(px, py, a + rand(-0.3, 0.3), len * 0.55, w * 0.7, depth + 1);
    };
    for (let i = 0; i < 11; i++) branch(c + rand(-10, 10), c + rand(-10, 10), i / 11 * TAU + rand(-0.2, 0.2), rand(90, 150), 9, 0);
    g.lineWidth = 6; g.beginPath(); g.arc(c, c, 40, 0, TAU); g.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace;
    return t;
  },
  crater(pos, size, hot = true) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.crackTex }, glow: { value: hot ? 1 : 0.0 }, fade: { value: 1 }, ember: { value: new THREE.Color(hot ? 0xff5a10 : 0x40d8ff) }, rot: { value: rand(0, TAU) } },
      vertexShader: `varying vec2 vUv; uniform float rot; void main(){ vec2 c = uv - 0.5; float s = sin(rot), co = cos(rot); vUv = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D tex; uniform float glow, fade; uniform vec3 ember; varying vec2 vUv;
        void main(){ vec4 t = texture2D(tex, vUv); float crack = t.r; float scorch = t.g;
          vec3 col = mix(vec3(0.16, 0.12, 0.1), vec3(0.03, 0.02, 0.02), crack);
          col += ember * 3.0 * glow * crack;
          float a = max(scorch * 0.55, crack * 0.95) * fade;
          gl_FragColor = vec4(col, a); }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    });
    const m = new THREE.Mesh(FX.planeGeo, mat);
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.03 + this.craters.length * 0.0005, pos.z); m.scale.setScalar(size);
    m.renderOrder = 11; m.userData.t = 0; m.userData.hot = hot;
    this.scene.add(m);
    this.craters.push(m);
    if (this.craters.length > 12) { const o = this.craters.shift(); this.scene.remove(o); o.material.dispose(); }
    // kicked-up floor chunks
    this.spawnDebris(pos, Math.round(size * 1.2), size * 0.35, 'floor');
  },
  spawnDebris(pos, n, spread, kind, dir) {
    for (let i = 0; i < n; i++) {
      const s = kind === 'floor' ? rand(0.18, 0.5) : rand(0.3, 0.7);
      const geo = new THREE.DodecahedronGeometry(s, 0);
      const m = new THREE.Mesh(geo, kind === 'floor' ? this.floorMat : this.stoneMat);
      m.castShadow = s > 0.38; m.userData.ownGeo = true;
      m.position.set(pos.x + rand(-spread, spread), Math.max(pos.y, 0) + s, pos.z + rand(-spread, spread));
      m.scale.set(1, rand(0.6, 1.2), rand(0.7, 1.3));
      const out = new V3(m.position.x - pos.x, 0, m.position.z - pos.z).normalize();
      const v = new V3(out.x * rand(2, 7), rand(6, 13), out.z * rand(2, 7));
      if (dir) v.addScaledVector(dir, rand(3, 8));
      this.addBody(m, v, s);
    }
  },
  addBody(m, v, s) {
    this.scene.add(m);
    this.debris.push({ m, v, w: new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), s, life: rand(6, 9), rest: false });
    if (this.debris.length > 60) { const o = this.debris.shift(); this.removeBody(o); }
  },
  removeBody(o) { this.scene.remove(o.m); if (o.m.userData.ownGeo) o.m.geometry.dispose(); },
  updateEnv(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life < 1) { d.m.position.y -= dt * d.s * 1.5; if (d.life <= 0) { this.removeBody(d); this.debris.splice(i, 1); } continue; }
      if (d.rest) continue;
      d.v.y -= 28 * dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
      const r = Math.hypot(d.m.position.x, d.m.position.z);
      const onDais = r < ARENA_R + 2;
      if (onDais && d.m.position.y < d.s * 0.6) {
        d.m.position.y = d.s * 0.6;
        if (Math.abs(d.v.y) < 2.5) { d.v.set(0, 0, 0); d.rest = true; }
        else { d.v.y = -d.v.y * 0.32; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); }
      }
      if (d.m.position.y < -40) d.life = 0.5;
    }
    for (const c of this.craters) {
      c.userData.t += dt;
      const u = c.material.uniforms;
      u.glow.value = c.userData.hot ? Math.max(0, 1 - c.userData.t / 7) : Math.max(0, 0.8 - c.userData.t / 1.5);
      if (c.userData.t > 40) u.fade.value = Math.max(0, 1 - (c.userData.t - 40) / 5);
    }
  },
  // area damage against the environment
  damageAt(pos, radius, power, dir) {
    for (const P of this.dpillars) {
      if (P.broken) continue;
      const d = Math.hypot(P.x - pos.x, P.z - pos.z);
      if (d < radius + P.r) {
        const k = dir ? dir.clone() : new V3(P.x - pos.x, 0, P.z - pos.z).normalize();
        this.hitPillar(P, power, k, pos);
      }
    }
  },
  hitPillar(P, power, dir, from) {
    if (P.broken) return false;
    P.hp -= power;
    const hp = new V3(P.x, from ? clamp(from.y, 0.8, 4) : 2, P.z);
    FX.burst(hp, 10, { speed: 6, life: 0.6, s0: 0.5, s1: 1.2, c0: C.dust, c1: C.dust, add: false, alpha: 0.5 });
    this.spawnDebris(hp, 2, 0.6, 'stone', dir);
    P.group.position.x = P.x + dir.x * 0.08; P.group.position.z = P.z + dir.z * 0.08;
    setTimeout(() => { P.group.position.x = P.x; P.group.position.z = P.z; }, 60);
    if (P.hp <= 0) { this.shatter(P, dir); return true; }
    return false;
  },
  shatter(P, dir) {
    P.broken = true; P.r = 1.1;
    P.rune.visible = false;
    Sfx.crumble(); FX.shake(0.6);
    const wp = new V3();
    P.drums.forEach((d, i) => {
      if (i === 0 && P.stump) { d.visible = false; P.stump.visible = true; return; }
      if (i === 0) { d.scale.y = 0.55; d.position.y -= d.geometry.parameters.height * 0.22; return; }
      d.getWorldPosition(wp);
      const q = new THREE.Quaternion(); d.getWorldQuaternion(q);
      P.group.remove(d);
      d.position.copy(wp); d.quaternion.copy(q);
      const v = new V3(dir.x * rand(4, 10) + rand(-2, 2), rand(1, 6) + i * 0.8, dir.z * rand(4, 10) + rand(-2, 2));
      this.debris.push({ m: d, v, w: new V3(rand(-3, 3), rand(-2, 2), rand(-3, 3)), s: 0.8, life: 12, rest: false, drum: true });
      this.scene.add(d);
    });
    const base = new V3(P.x, 1.5, P.z);
    FX.burst(base, 40, { speed: 9, life: 1.2, s0: 1.2, s1: 3, c0: C.dust, c1: C.smokeL, add: false, alpha: 0.5, up: 2, jitter: 1 });
    this.spawnDebris(base, 10, 1, 'stone', dir);
    FX.shockwave(base, 0.35, 0.8);
    FX.popup(new V3(P.x, 4, P.z), 'SHATTERED', 'tag small', Render.camera);
  },
  resetEnv() {
    for (const d of this.debris) { if (d.drum) this.scene.remove(d.m); else this.removeBody(d); }
    this.debris.length = 0;
    for (const c of this.craters) { this.scene.remove(c); c.material.dispose(); }
    this.craters.length = 0;
    for (const P of this.dpillars) {
      P.broken = false; P.hp = 100; P.r = 1.0; P.rune.visible = !P.skin;
      if (P.stump) P.stump.visible = false;
      P.group.position.set(P.x, 0, P.z);
      P.group.traverse(o => {});
      for (const d of P.drums) {
        const h = d.userData.home;
        if (d.parent !== P.group) { if (d.parent) d.parent.remove(d); P.group.add(d); }
        d.position.copy(h.p); d.quaternion.copy(h.q); d.scale.set(1, 1, 1); d.visible = true;
      }
    }
  },
  // push a circle (x,z,r) out of standing pillars; returns pillar hit or null
  collide(pos, r) {
    let hit = null;
    for (const P of this.dpillars) {
      const dx = pos.x - P.x, dz = pos.z - P.z, d = Math.hypot(dx, dz), min = P.r + r;
      if (d < min && pos.y < (P.broken ? 1.6 : 9)) {
        const k = d > 1e-4 ? (min - d) / d : 1;
        pos.x += dx * k; pos.z += dz * k; hit = P;
      }
    }
    return hit;
  },
  pillarAt(p, r) {
    for (const P of this.dpillars) if (!P.broken && Math.hypot(p.x - P.x, p.z - P.z) < P.r + r && p.y < 9) return P;
    return null;
  },
  update(dt, time, wdt) {
    if (this.debris) this.updateEnv(wdt);
    this.skyMat.uniforms.time.value = time;
    this.cloudMat.uniforms.time.value = time;
    this.fireRingMat.uniforms.time.value = time;
    if (Math.abs(this.mix - this.mixTarget) > 0.001) { this.mix = damp(this.mix, this.mixTarget, 1.2, dt); this.applyPalette(this.mix); }
    for (const f of this.floaters) f.position.y = f.userData.base + Math.sin(time * 0.4 + f.userData.ph) * 1.5;
    if (this.cloudSprites) this.updateScenery(dt, time);
    for (const b of this.pillars) b.rotation.x = Math.sin(time * 1.7 + b.parent.position.x) * 0.12;
    // ambient drifting motes
    if (wdt > 0 && Math.random() < 0.6) {
      const a = rand(0, TAU), d = rand(0, ARENA_R + 6);
      if (this.mix > 0.5) FX.add_.spawn(Math.cos(a) * d, rand(0, 2), Math.sin(a) * d, rand(-0.5, 0.5), rand(1, 3), rand(-0.5, 0.5), 3, 0.18, 0.05, C.fireHot, C.ember, 0.2, -0.2, 0.9);
      else FX.add_.spawn(Math.cos(a) * d, rand(0, 6), Math.sin(a) * d, rand(1, 2.5), rand(-0.1, 0.3), rand(-0.5, 0.5), 4, 0.1, 0.06, new THREE.Color(1, 0.95, 0.85), new THREE.Color(0.6, 0.55, 0.5), 0.1, 0, 0.5);
    }
  },
};
