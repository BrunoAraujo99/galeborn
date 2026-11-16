// Injected into the game page to stage "after" look mockups from a frozen fight moment.
window.MK = {
  added: [],
  snapshot() { this.world = Render.scene.children.slice(); },
  clearAdded() { for (const o of this.added) Render.scene.remove(o); this.added = []; },
  add(o) { Render.scene.add(o); this.added.push(o); return o; },
  // hide the old arena: everything that existed before the hit, except fighters, lights and particle systems
  hideWorld(v = false) {
    const keep = new Set([__G.player.rig.root, Opp.puppet.rig.root]);
    for (const o of this.world) { if (keep.has(o) || o.isLight || o.isPoints || o.type === 'Object3D') continue; o.visible = v; }
  },
  restore() { this.clearAdded(); this.hideWorld(true); Render.scene.background = null; },
  freezeFX(dt = 0.016, n = 1) { for (let i = 0; i < n; i++) FX.update(dt, Render.camera); },
  // anime fighting-game framing: narrow lens, camera just behind the player's shoulder, both fighters large
  // anime fighting-game framing: narrower lens, 3/4 view of both fighters, camera close enough that bodies fill ~40% of frame height
  camNew(fov = 38, dist = 6.4, h = 1.55, side = 0.42) {
    const p = __G.player.pos, o = Opp.pos;
    const d = new THREE.Vector3(o.x - p.x, 0, o.z - p.z).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
    const mid = new THREE.Vector3((p.x + o.x) / 2, 0, (p.z + o.z) / 2);
    const back = d.clone().multiplyScalar(-Math.cos(side)).addScaledVector(r, Math.sin(side));
    const cam = Render.camera;
    cam.position.copy(mid).addScaledVector(back, dist).setY(h);
    cam.lookAt(mid.x, 1.35 + Math.max(0, o.y - 0.5) * 0.5, mid.z); cam.fov = fov; cam.updateProjectionMatrix();
    Render.baseFov = fov; if (Render.onResize) Render.onResize(); if (FX.onResize) FX.onResize();
    // key light comes from over the camera's shoulder so faces read; the theme's sun colour stays
    const f = new THREE.Vector3(); cam.getWorldDirection(f);
    World.sun.position.set(mid.x - f.x * 20 + r.x * 12, 26, mid.z - f.z * 20 + r.z * 12); World.sun.target.position.copy(mid); World.sun.target.updateMatrixWorld();
  },
  camWide() { const cam = Render.camera, p = __G.player.pos; const r = Math.hypot(p.x, p.z) > 0.5 ? Math.atan2(p.z, p.x) : 0.8; cam.position.set(Math.cos(r) * 11, 10, Math.sin(r) * 11); cam.lookAt(0, 0.5, 0); cam.fov = 55; cam.updateProjectionMatrix(); },
  lockCam() { if (!this.camLocked) { this.camLocked = true; Cam.update = () => {}; } },
  skyTex(stops, paint) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, c.height); for (const [k, col] of stops) g.addColorStop(k, col);
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    if (paint) paint(x, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  },
  mat(color, o) { return toon(color, o); },
  glow(color, op = 1) { return new THREE.MeshBasicMaterial({ color, transparent: op < 1, opacity: op, fog: false }); },
  mesh(geo, mat, x, y, z, outline) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (outline) addOutline(m, outline); return m; },
  floor(radius, color, tex) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 72), [toon(color), toon(0xffffff, { map: tex }), toon(color)]);
    m.position.y = -0.5; m.receiveShadow = true; return this.add(m);
  },
  floorTex(base, paint) {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 1024, 1024); paint(x, 1024);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  },
  particles(n, area, color, size, yr = [0, 20], drift) {
    const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - .5) * area; a[i * 3 + 1] = yr[0] + Math.random() * (yr[1] - yr[0]); a[i * 3 + 2] = (Math.random() - .5) * area; }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return this.add(new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: .9, depthWrite: false })));
  },
  lights(o) {
    const sun = World.sun, hemi = World.hemi;
    sun.color.set(o.sun); sun.intensity = o.sunI; sun.position.set(...o.sunPos); hemi.color.set(o.sky); hemi.groundColor.set(o.ground); hemi.intensity = o.hemiI;
    Render.scene.fog = new THREE.Fog(o.fog, o.fogN, o.fogF);
    Render.post.sat = o.sat ?? 1.3; Render.post.strength = o.bloom ?? 1.1;
  },
  rimFighters(color, s) {
    for (const root of [__G.player.rig.root, Opp.puppet.rig.root]) root.traverse(m => {
      if (!m.isMesh || m.userData.isOutline || !m.material || Array.isArray(m.material)) return;
      if (!m.userData.mkMat) { m.userData.mkMat = m.material; }
      const mm = m.userData.mkMat.clone(); mm.userData = {}; mm.onBeforeCompile = m.userData.mkMat.onBeforeCompile;
      if (mm.isMeshToonMaterial || mm.isMeshStandardMaterial) { addRim(mm, color, s, 0.55); m.material = mm; }
    });
  },
  // a heavier, colour-coded impact at the clash point
  bigImpact(colA, colB) {
    const p = __G.player.pos, o = Opp.pos;
    const hit = new THREE.Vector3((p.x * 0.35 + o.x * 0.65), 1.2 + o.y * 0.6, (p.z * 0.35 + o.z * 0.65));
    const dir = new THREE.Vector3(o.x - p.x, 0, o.z - p.z).normalize();
    FX.burst(hit, 34, { speed: 20, dir, spread: 1.3, life: 0.4, s0: 0.55, c0: new THREE.Color(0xffffff), c1: new THREE.Color(colA), drag: 6 });
    FX.burst(hit, 22, { speed: 15, dir: dir.clone().negate(), spread: 1.2, life: 0.4, s0: 0.45, c0: new THREE.Color(0xfff2a0), c1: new THREE.Color(colB), drag: 6 });
    FX.star(hit, 1.7, colA, 0.3);
    FX.impactLines(hit, 8, colA, 2.4, 0.4);
    FX.slash(hit.clone().setY(1.0), Math.atan2(dir.x, dir.z), 0.9, 1.1, colA, 0.5, 2.0);
    FX.groundRing(hit.clone().setY(0.05), 2.4, colB, 0.5);
    this.freezeFX(0.035, 2);
  },
};
