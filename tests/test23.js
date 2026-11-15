const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => Quality.set('low'));
  await page.evaluate(id => new Promise(r => G.setHero(id, r)), 'water');
  await page.evaluate(() => { __G.beginFight(); });
  await page.waitForFunction(() => G.state === 'fight', null, { timeout: 30000 });
  await page.evaluate(() => { const b = __G.boss; b.cool = 999; b.update = (function (u) { return function (dt) { this.cool = 999; return u.call(this, dt); }; })(b.update); });
  // launcher via back input
  const r1 = await page.evaluate(() => new Promise(res => { const p = __G.player, b = __G.boss; p.state = 'move'; p.pos.set(b.pos.x, 0, b.pos.z + 2.5); p.faceBoss(true);
    const d = p.bossDir().normalize().negate(); p.wishDir = () => d.clone(); p.buf = 'light'; p.bufT = 0.3;
    setTimeout(() => { const m = p.move && p.move.launcher; delete p.wishDir; setTimeout(() => res(`launcher=${m} pursuitT=${(p.pursuitT||0).toFixed(2)} bossY=${b.pos.y.toFixed(2)} knock=${b.knock.length().toFixed(1)}`), 250); }, 60); }));
  console.log(r1);
  await page.waitForTimeout(1500);
  // burst
  const r2 = await page.evaluate(() => new Promise(res => { const p = __G.player, b = __G.boss; p.state = 'move'; p.invuln = 0; p.dodgeInv = 0; p.pos.set(b.pos.x, 0, b.pos.z + 3); p.burst = 99;
    const r = p.tryHit(10, new THREE.Vector3(0, 0, 1), 'light', null); const full = p.burst; window.__th = []; const oth = p.tryHit.bind(p); p.tryHit = function () { window.__th.push(new Error().stack.split('\n')[2]); return oth.apply(null, arguments); }; p.buf = 'block'; p.bufT = 0.3;
    setTimeout(() => res(`hit=${r} burstAfterHit=${full} state=${p.state} inv=${p.invuln.toFixed(2)} burst=${p.burst} bursts=${G.stats.bursts} buf=${p.buf} hs=${G.hitstop} paused=${G.paused} blitz=${Blitz.active} gs=${G.state} ts=${G.timeScale.toFixed(2)} st=${p.st.toFixed(2)}`), 2500); }));
  console.log(r2);
  await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/claude-0/shots/burst.png' });
  await page.waitForTimeout(1200);
  // projectile clash: jet (pow 2, water) vs fireball
  const r3 = await page.evaluate(() => new Promise(res => { const V = THREE.Vector3;
    const a = new Projectile({ pos: new V(0, 1.5, 0), vel: new V(0, 0, -10), r: 0.6, owner: 'player', dmg: 10, life: 2, kind: 'jet', hits: 3, tick: 0.06 });
    const f = new Projectile({ pos: new V(0, 1.5, -3), vel: new V(0, 0, 10), r: 0.6, owner: 'boss', dmg: 10, life: 2, kind: 'fireball' });
    const c = new Projectile({ pos: new V(4, 1.5, 0), vel: new V(0, 0, -10), r: 0.5, owner: 'player', dmg: 10, life: 2, kind: 'firebolt' });
    const f2 = new Projectile({ pos: new V(4, 1.5, -3), vel: new V(0, 0, 10), r: 0.6, owner: 'boss', dmg: 10, life: 2, kind: 'fireball' });
    G.proj.push(a, f, c, f2);
    setTimeout(() => res(`jet dead=${a.dead} fireball dead=${f.dead} | firebolt dead=${c.dead} fireball2 dead=${f2.dead} clashes=${G.stats.clashes}`), 400); }));
  console.log(r3);
  await page.screenshot({ path: '/tmp/claude-0/shots/hud3.png' });
  console.log('ERR', errs.join('\n')); await b.close();
})();
