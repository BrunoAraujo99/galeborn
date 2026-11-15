const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  await p.goto('file:///home/claude/duel/dist/galeborn.html');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await p.evaluate(() => Quality.set('low'));
  await p.click('#botBtn'); await p.waitForTimeout(800);
  await p.evaluate(() => Select.confirm()); await p.waitForTimeout(500);
  await p.click('[data-bot="easy"]');
  await p.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  await p.evaluate(() => {
    window.__brk = 0; window.__hz = 0; window.__zm = 0;
    const ob = Clarity.onBroke.bind(Clarity); Clarity.onBroke = () => { __brk++; ob(); };
    const pl = __G.player, orig = pl.update.bind(pl);
    pl.update = function (dt, a) {
      __hz = Math.max(__hz, Clarity.heat); __zm = Math.max(__zm, Clarity.zoom);
      if (this.alive && this.state === 'move' && horizDist(this.pos, Opp.pos) > 2.2) { const d = Opp.pos.clone().sub(this.pos).setY(0).normalize(); this.pos.addScaledVector(d, dt * 8); this.faceBoss && this.faceBoss(true); }
      window.__acc = (window.__acc || 0) + dt; if (window.__acc > 0.05) { window.__acc = 0; this.bufferInputs({ light: true }); }
      return orig(dt, a);
    };
  });
  for (let i = 0; i < 16; i++) {
    await p.waitForTimeout(5000);
    console.log(await p.evaluate(() => `t=${G.time.toFixed(1)} myHp=${Math.round(__G.player.hp)} botHp=${Opp.hp} brk=${__brk} heatMax=${__hz.toFixed(1)} zoomMax=${__zm.toFixed(2)} botState=${Opp.puppet.state}`));
  }
  console.log('ERRORS', errs.slice(0,15).join('\n'));
  await b.close();
})();
