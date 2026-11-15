const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => Quality.set('low'));
  for (const id of ['fire']) {
    await page.evaluate(id => new Promise(r => G.setHero(id, r)), id);
    await page.evaluate(() => { __G.beginFight(); });
    await page.waitForFunction(() => G.state === 'fight', null, { timeout: 30000 });
    await page.evaluate(() => { const b = __G.boss; b.cool = 999; b.update = (function (u) { return function (dt) { this.cool = 999; return u.call(this, dt); }; })(b.update); });
    const r = await page.evaluate(() => new Promise(res => { const p = __G.player, b = __G.boss; p.state = 'move'; p.pos.set(b.pos.x, 0, b.pos.z + 7); p.faceBoss(true); const h0 = b.hp;
      p.startDash(p.bossDir().normalize().negate(), true); setTimeout(() => { const n = FlameTrail.spots.length; p.state='move'; p.pos.set(b.pos.x, 0, b.pos.z + 7); p.faceBoss(true); p.power = 0.5; p.state = 'release'; p.st = 0; p.released = false; setTimeout(() => { const q = G.proj.map(q => q.kind + ':' + q.owner + ':' + q.pos.toArray().map(v=>v.toFixed(1)) + ':' + q.dead); setTimeout(() => res(`trail=${n} heavyDmg=${Math.round(h0 - b.hp)} ${q} boss=${b.pos.toArray().map(v=>v.toFixed(1))} r=${b.radius} pstate=${p.state}`), 1400); }, 100); }, 250); }));
    console.log(id, r);
  }
  console.log('ERR', errs.join('\n')); await b.close();
})();
