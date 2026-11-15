const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__heroModel !== undefined, null, { timeout: 60000 }).catch(() => {});
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/w_${n}.png` });
  const until = async (fn, n = 60) => { for (let i = 0; i < n; i++) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(150); } return false; };
  await page.click('#playBtn'); await page.waitForTimeout(300);
  await page.evaluate(() => { __G.beginFight(); Quality.auto = false; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = __G.boss; b.cool = 999; b.update = (function (u) { return function (dt) { this.cool = 999; return u.call(this, dt); }; })(b.update); });
  const log = async (l) => console.log(l, await page.evaluate(() => `p=${__G.player.state} bossHp=${Math.round(__G.boss.hp)} moments=${G.stats.moments || 0} last=${document.querySelector('#moment .mn') ? document.querySelector('#moment .mn').textContent : ''}`));
  // 1. pursuit: finisher-like launch then dash
  await page.evaluate(() => { const b = __G.boss, p = __G.player; p.pos.set(b.pos.x, 0, b.pos.z + 3); p.faceBoss(true); const dir = new THREE.Vector3(0, 0, -1); const res = b.takeDamage(20, 5, b.chest(), dir, { big: true, knock: 15 }); p.onDealtHit(res, b.chest(), dir, true, 0.05, 'finisher'); p.buf = 'dash'; p.bufT = 0.3; });
  await until(() => __G.player.state === 'pursuit');
  await page.waitForTimeout(300); await S('pursuit1'); await log('pursuit1');
  await until(() => __G.player.state !== 'pursuit');
  for (let k = 0; k < 2; k++) { await page.evaluate(() => { const p = __G.player; p.buf = 'dash'; p.bufT = 0.3; }); await until(() => __G.player.state === 'pursuit'); await until(() => __G.player.state !== 'pursuit'); }
  await page.waitForTimeout(400); await S('pursuit3'); await log('pursuit3');
  await page.waitForTimeout(2500);
  // 2. vault: airborne dash into a pillar
  await page.evaluate(() => { const p = __G.player; const P = World.dpillars.find(q => !q.broken); const d = new THREE.Vector3(P.x, 0, P.z).normalize(); p.state = 'move'; p.pos.set(P.x - d.x * 3, 2.5, P.z - d.z * 3); p.vel.set(0, 0, 0); p.grounded = false; p.startDash(d, true); });
  await until(() => (__G.player.vaultT || 0) > 0, 40);
  await page.waitForTimeout(200); await S('vault'); await log('vault');
  await page.evaluate(() => { const p = __G.player; p.buf = 'light'; p.bufT = 0.3; });
  await page.waitForTimeout(1200); await log('skyfall?');
  await page.waitForTimeout(2000);
  // 3. return to sender
  await page.evaluate(() => { const b = __G.boss, p = __G.player; p.state = 'move'; p.pos.set(b.pos.x, 0, b.pos.z + 8); p.grounded = true; p.vel.set(0,0,0);
    const pr = new Projectile({ pos: p.chest().add(new THREE.Vector3(0, 0, -1.5)), vel: new THREE.Vector3(0, 0, 1), r: 0.5, owner: 'boss', dmg: 10, post: 0, life: 3, kind: 'fireball' }); G.proj.push(pr); pr.deflect(); });
  await until(() => (document.querySelector('#moment .mn') || {}).textContent === 'RETURN TO SENDER', 40);
  await page.waitForTimeout(200); await S('return'); await log('return');
  await page.waitForTimeout(2000);
  // 4. interrupt
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state = 'idle'; b.cool = 0; });
  await page.evaluate(() => { const b = __G.boss; b.update = Object.getPrototypeOf(b).update; b.cool = 0; });
  await until(() => __G.boss.state === 'attack', 40);
  await page.evaluate(() => { const b = __G.boss, p = __G.player; const dir = new THREE.Vector3(0, 0, -1); b.at = 0.1; const res = b.takeDamage(20, 5, b.chest(), dir, { big: true, src: 'melee' }); p.onDealtHit(res, b.chest(), dir, true, 0.05, ''); });
  await page.waitForTimeout(300); await S('interrupt'); await log('interrupt');
  // 5. graze
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state = 'idle'; b.cool = 999; b.update = (function (u) { return function (dt) { this.cool = 999; return u.call(this, dt); }; })(b.update);
    const p = __G.player; p.state = 'move'; p.invuln = 0; const c = p.chest(); G.proj.push(new Projectile({ pos: c.clone().add(new THREE.Vector3(1.1, 0, -6)), vel: new THREE.Vector3(0, 0, 14), r: 0.5, owner: 'boss', dmg: 10, post: 0, life: 2, kind: 'fireball' })); });
  await until(() => (G.stats.grazes || 0) > 0, 40);
  await log('graze ' + await page.evaluate(() => G.stats.grazes));
  console.log('ERRORS', [...new Set(errs)].join('\n'));
  await browser.close();
})();
