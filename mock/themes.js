// Three arena themes staged with primitives, as look targets for the real rebuild.
window.THEMES = {
  sunset() {
    const M = MK, R = 15;
    Render.scene.background = M.skyTex([[0, '#2a0f5c'], [0.35, '#a02a8a'], [0.62, '#ff4f6e'], [0.78, '#ffa04a'], [0.86, '#ffd27a'], [1, '#ff9a5a']], (x, w, h) => {
      // low sun with banded cut, long painted cloud streaks
      const sx = w * 0.62, sy = h * 0.74, r = h * 0.2;
      const g = x.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 3); g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,120,80,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ff7a5a'; for (let i = 0; i < 6; i++) x.fillRect(sx - r, sy + r * (0.15 + i * 0.16), r * 2, r * 0.05 + i * 1.6);
      x.globalAlpha = .55; x.fillStyle = '#ffb0c8'; for (let i = 0; i < 14; i++) { const y = h * (0.12 + Math.random() * 0.5), xx = Math.random() * w; x.beginPath(); x.ellipse(xx, y, 120 + Math.random() * 220, 6 + Math.random() * 10, 0, 0, Math.PI * 2); x.fill(); }
      x.globalAlpha = 1;
    });
    M.lights({ sun: 0xffb27a, sunI: 2.3, sunPos: [-10, 9, -30], sky: 0xff7ab0, ground: 0x5a2a6a, hemiI: 1.05, fog: 0xd8607a, fogN: 30, fogF: 160, rim: 0xffd080, rimS: 1.0, sat: 1.15, bloom: 1.0 });
    const tex = M.floorTex('#9e6a62', (x, s) => {
      x.strokeStyle = '#7e3a3a'; x.lineWidth = 6; for (let r = 60; r < 512; r += 70) { x.beginPath(); x.arc(512, 512, r, 0, 7); x.stroke(); }
      for (let a = 0; a < 24; a++) { x.beginPath(); x.moveTo(512, 512); x.lineTo(512 + Math.cos(a / 24 * 6.283) * 512, 512 + Math.sin(a / 24 * 6.283) * 512); x.stroke(); }
      x.fillStyle = '#ffd27a'; x.globalAlpha = .9; x.beginPath(); x.arc(512, 512, 54, 0, 7); x.fill();
      x.strokeStyle = '#ffd27a'; x.lineWidth = 10; x.beginPath(); x.arc(512, 512, 470, 0, 7); x.stroke(); x.globalAlpha = 1;
    });
    M.floor(R, 0x5a2a3a, tex);
    // sea of light below, with the sun's path
    const sea = M.add(new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0xff9a7a, fog: true })));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -14;
    // gate arches ring the platform: lacquer red posts, dark beams
    const red = M.mat(0xb8283a), dark = M.mat(0x2a1430), gold = M.glow(0xffd27a);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.3, cx = Math.cos(a) * (R + 1.2), cz = Math.sin(a) * (R + 1.2), rot = -a + Math.PI / 2;
      const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rot;
      for (const s of [-2.6, 2.6]) g.add(M.mesh(new THREE.CylinderGeometry(0.42, 0.5, 9, 10), red, s, 4.5, 0, 0.05));
      g.add(M.mesh(new THREE.BoxGeometry(7.6, 0.6, 0.9), dark, 0, 9.2, 0, 0.05));
      g.add(M.mesh(new THREE.BoxGeometry(6.4, 0.45, 0.6), red, 0, 7.8, 0, 0.04));
      g.add(M.mesh(new THREE.BoxGeometry(0.9, 1.0, 0.95), gold, 0, 8.5, 0));
      M.add(g);
    }
    // lantern strings between gates
    const lan = M.glow(0xffc060);
    for (let i = 0; i < 6; i++) for (let k = 1; k < 8; k++) {
      const a = (i + k / 8) / 6 * Math.PI * 2 + 0.3, sag = Math.sin(k / 8 * Math.PI) * 2.2;
      M.add(M.mesh(new THREE.SphereGeometry(0.2, 10, 8), lan, Math.cos(a) * (R + 1.2), 7.6 - sag, Math.sin(a) * (R + 1.2)));
    }
    // distant silhouetted sea-stacks and a great broken pagoda landmark
    const sil = M.mat(0x3a1446);
    for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, d = 60 + Math.random() * 80, h = 18 + Math.random() * 40; M.add(M.mesh(new THREE.ConeGeometry(4 + Math.random() * 7, h, 6), sil, Math.cos(a) * d, h / 2 - 14, Math.sin(a) * d)); }
    const P = new THREE.Group(); P.position.set(-40, -14, -90);
    for (let t = 0; t < 6; t++) { const w = 16 - t * 2.2, y = t * 9; P.add(M.mesh(new THREE.BoxGeometry(w * 0.6, 7, w * 0.6), sil, 0, y + 3.5, 0)); const roof = M.mesh(new THREE.ConeGeometry(w * 0.75, 3, 4), M.mat(0x5a1a4a), 0, y + 8, 0); roof.rotation.y = Math.PI / 4; P.add(roof); P.add(M.mesh(new THREE.BoxGeometry(w * 0.5, 0.6, 0.2), M.glow(0xffc060), 0, y + 4, w * 0.3)); }
    M.add(P);
    // drifting petals / embers
    M.particles(500, 70, 0xffb0d0, 0.18, [0, 14]);
    M.particles(160, 40, 0xffd27a, 0.12, [0, 8]);
  },
  storm() {
    const M = MK, R = 14;
    Render.scene.background = M.skyTex([[0, '#070a1e'], [0.4, '#1a1f4a'], [0.7, '#2c3a7a'], [0.85, '#4a5aa0'], [1, '#18183a']], (x, w, h) => {
      // heavy cloud masses with violet underglow
      for (let i = 0; i < 40; i++) { const xx = Math.random() * w, y = h * (0.05 + Math.random() * 0.45), r = 60 + Math.random() * 140; const g = x.createRadialGradient(xx, y, 0, xx, y, r); g.addColorStop(0, 'rgba(60,40,120,.55)'); g.addColorStop(1, 'rgba(20,20,60,0)'); x.fillStyle = g; x.fillRect(xx - r, y - r, r * 2, r * 2); }
      // forked lightning
      const bolt = (bx, by, len, wid) => { x.strokeStyle = '#e8fbff'; x.shadowColor = '#3df2ff'; x.shadowBlur = 30; x.lineWidth = wid; x.beginPath(); let px = bx, py = by; x.moveTo(px, py); for (let i = 0; i < 12; i++) { px += (Math.random() - .5) * 50; py += len / 12; x.lineTo(px, py); if (Math.random() < .3 && wid > 2) { const sx = px, sy = py; x.stroke(); bolt(sx, sy, len * 0.4, wid * 0.5); x.beginPath(); x.moveTo(sx, sy); } } x.stroke(); x.shadowBlur = 0; };
      bolt(w * 0.72, 0, h * 0.62, 6); bolt(w * 0.18, h * 0.05, h * 0.4, 3);
    });
    M.lights({ sun: 0x9fd8ff, sunI: 2.6, sunPos: [16, 24, -20], sky: 0x6a7aff, ground: 0x2a1040, hemiI: 1.25, fog: 0x2a2f66, fogN: 25, fogF: 140, rim: 0x6af2ff, rimS: 1.1, sat: 1.15, bloom: 1.05 });
    const tex = M.floorTex('#2e3350', (x, s) => {
      x.strokeStyle = '#1a1d33'; x.lineWidth = 8; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(0, i * 128); x.lineTo(1024, i * 128); x.moveTo(i * 128, 0); x.lineTo(i * 128, 1024); x.stroke(); }
      // glowing rune channel + cracks
      x.strokeStyle = '#3df2ff'; x.shadowColor = '#3df2ff'; x.shadowBlur = 18; x.lineWidth = 7; x.beginPath(); x.arc(512, 512, 300, 0, 7); x.stroke();
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; x.beginPath(); x.moveTo(512 + Math.cos(a) * 300, 512 + Math.sin(a) * 300); let px = 512 + Math.cos(a) * 300, py = 512 + Math.sin(a) * 300; for (let j = 0; j < 6; j++) { px += Math.cos(a) * 34 + (Math.random() - .5) * 40; py += Math.sin(a) * 34 + (Math.random() - .5) * 40; x.lineTo(px, py); } x.stroke(); }
      x.strokeStyle = '#ff3d9a'; x.shadowColor = '#ff3d9a'; x.lineWidth = 5; x.beginPath(); x.arc(512, 512, 470, 0, 7); x.stroke(); x.shadowBlur = 0;
    });
    M.floor(R, 0x1a1d33, tex);
    // jagged black crags circling the platform, a few crowned with lightning rods
    const rock = M.mat(0x262a46), rod = M.glow(0xbff8ff);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + Math.random() * 0.3, d = R + 3 + Math.random() * 6, h = 8 + Math.random() * 14;
      const c = M.mesh(new THREE.ConeGeometry(1.6 + Math.random() * 2, h, 5), rock, Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d, 0.08); c.rotation.z = (Math.random() - .5) * 0.3; M.add(c);
      if (i % 3 === 0) M.add(M.mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), rod, Math.cos(a) * d, h - 0.5, Math.sin(a) * d));
    }
    // landmark: a cracked stone tower in the storm's eye, struck by a bolt
    const T = new THREE.Group(); T.position.set(25, -6, -70);
    T.add(M.mesh(new THREE.CylinderGeometry(6, 9, 60, 8), M.mat(0x1c2040), 0, 30, 0, 0.3));
    T.add(M.mesh(new THREE.CylinderGeometry(9, 6, 5, 8), M.mat(0x30365e), 0, 62, 0, 0.3));
    for (let k = 0; k < 8; k++) T.add(M.mesh(new THREE.BoxGeometry(1.2, 3, 0.3), M.glow(0x3df2ff), Math.cos(k / 8 * 6.283) * 6.2, 50, Math.sin(k / 8 * 6.283) * 6.2));
    const pts = []; let bx = 0, by = 200; while (by > 64) { pts.push(new THREE.Vector3(bx, by, 0)); bx += (Math.random() - .5) * 10; by -= 10; }
    const boltG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.7, 5);
    T.add(new THREE.Mesh(boltG, M.glow(0xe8fbff)));
    M.add(T);
    // rain streaks
    const n = 1400, g = new THREE.BufferGeometry(), a = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { const x = (Math.random() - .5) * 60, y = Math.random() * 22, z = (Math.random() - .5) * 60; a.set([x, y, z, x + 0.15, y - 1.1, z + 0.1], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    M.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45 })));
    M.particles(200, 30, 0x3df2ff, 0.12, [0, 6]);
  },
  snow() {
    const M = MK, R = 15;
    Render.scene.background = M.skyTex([[0, '#1a2a6a'], [0.35, '#4a6ad0'], [0.62, '#9ab8ff'], [0.8, '#ffd0e8'], [1, '#e8f0ff']], (x, w, h) => {
      // aurora ribbons
      for (let k = 0; k < 3; k++) { x.globalAlpha = .45; const g = x.createLinearGradient(0, 0, 0, h * 0.5); g.addColorStop(0, 'rgba(61,242,180,0)'); g.addColorStop(0.5, k === 1 ? '#ff6ad0' : '#3df2b4'); g.addColorStop(1, 'rgba(61,242,180,0)'); x.fillStyle = g;
        x.beginPath(); x.moveTo(0, h * (0.1 + k * 0.08)); for (let i = 0; i <= 20; i++) x.lineTo(i / 20 * w, h * (0.12 + k * 0.08) + Math.sin(i * 0.7 + k) * 40); for (let i = 20; i >= 0; i--) x.lineTo(i / 20 * w, h * (0.3 + k * 0.08) + Math.sin(i * 0.7 + k + 1) * 30); x.fill(); }
      x.globalAlpha = 1; x.fillStyle = '#fff'; for (let i = 0; i < 160; i++) x.fillRect(Math.random() * w, Math.random() * h * 0.45, 2, 2);
    });
    M.lights({ sun: 0xffd8b0, sunI: 2.8, sunPos: [-20, 14, -18], sky: 0xa8c8ff, ground: 0x6a7ad0, hemiI: 1.4, fog: 0xb8c8ff, fogN: 35, fogF: 170, rim: 0xff9ad8, rimS: 0.9, sat: 1.12, bloom: 1.0 });
    const tex = M.floorTex('#eef4ff', (x, s) => {
      // packed snow with an ice-ringed frozen pond centre
      for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(150,170,230,${Math.random() * .1})`; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 60, 8 + Math.random() * 20, Math.random() * 3, 0, 7); x.fill(); }
      const g = x.createRadialGradient(512, 512, 30, 512, 512, 190); g.addColorStop(0, '#7ad8ff'); g.addColorStop(0.8, '#3a8ad0'); g.addColorStop(1, '#bfe8ff'); x.fillStyle = g; x.beginPath(); x.arc(512, 512, 190, 0, 7); x.fill();
      x.strokeStyle = '#ffffff'; x.lineWidth = 3; for (let k = 0; k < 14; k++) { x.beginPath(); x.moveTo(512, 512); let px = 512, py = 512, a = Math.random() * 6.283; for (let j = 0; j < 5; j++) { px += Math.cos(a) * 50; py += Math.sin(a) * 50; a += (Math.random() - .5); x.lineTo(px, py); } x.stroke(); }
      x.strokeStyle = '#7a5ad0'; x.lineWidth = 10; x.beginPath(); x.arc(512, 512, 470, 0, 7); x.stroke();
    });
    M.floor(R, 0x9aaee8, tex);
    // ice crystal clusters and snow-laden pines
    const ice = new THREE.MeshToonMaterial({ color: 0x8af0ff, gradientMap: toonGradient(), transparent: true, opacity: 0.85, emissive: 0x1a6aa0 });
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + 0.2, d = R + 1.5 + Math.random() * 3;
      for (let k = 0; k < 4; k++) { const h = 3 + Math.random() * 6; const c = M.mesh(new THREE.ConeGeometry(0.6 + Math.random() * 0.8, h, 5), ice, Math.cos(a) * d + (Math.random() - .5) * 2, h / 2 - 0.3, Math.sin(a) * d + (Math.random() - .5) * 2, 0.04); c.rotation.set((Math.random() - .5) * 0.6, 0, (Math.random() - .5) * 0.6); M.add(c); }
    }
    const pine = M.mat(0x1f5a6a), snow = M.mat(0xffffff);
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, d = R + 8 + Math.random() * 25, s = 1 + Math.random() * 1.5; const g = new THREE.Group(); g.position.set(Math.cos(a) * d, -1, Math.sin(a) * d); for (let t = 0; t < 3; t++) { g.add(M.mesh(new THREE.ConeGeometry((2.6 - t * 0.6) * s, 3.2 * s, 7), pine, 0, (2 + t * 2) * s, 0, 0.05)); g.add(M.mesh(new THREE.ConeGeometry((1.6 - t * 0.4) * s, 1.4 * s, 7), snow, 0, (3 + t * 2) * s, 0)); } M.add(g); }
    // landmark: a giant frozen bell shrine on a far peak
    const B = new THREE.Group(); B.position.set(-30, 0, -80);
    B.add(M.mesh(new THREE.ConeGeometry(30, 50, 7), M.mat(0xdfe8ff), 0, 10, 0, 0.3));
    B.add(M.mesh(new THREE.BoxGeometry(14, 14, 14), M.mat(0x5a3a8a), 0, 40, 0, 0.2));
    const roof = M.mesh(new THREE.ConeGeometry(14, 7, 4), M.mat(0xffffff), 0, 50, 0, 0.2); roof.rotation.y = Math.PI / 4; B.add(roof);
    B.add(M.mesh(new THREE.SphereGeometry(4.5, 16, 10, 0, 6.283, 0, 1.7), M.mat(0x8af0ff), 0, 41, 7.5));
    M.add(B);
    M.particles(1600, 60, 0xffffff, 0.16, [0, 22]);
  },
};
