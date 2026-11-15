const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  const t0 = Date.now();
  await p.goto('http://localhost:8765/');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  console.log('model ready ms', Date.now() - t0);
  await p.evaluate(() => Sfx.init());
  await p.waitForTimeout(6000);
  console.log(await p.evaluate(() => 'audio keys ' + Object.keys(Sfx.bufs).length));
  await p.click('#botBtn'); await p.waitForTimeout(500); await p.evaluate(() => Select.confirm()); await p.click('[data-bot="easy"]');
  await p.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  await p.waitForTimeout(4000);
  console.log(await p.evaluate(() => `bot duel ok opp=${Duel.match.opp.name} dist=${horizDist(__G.player.pos, Opp.pos).toFixed(1)}`));
  console.log('ERR', errs.filter(e => !/TUNNEL|ERR_/.test(e)).join('\n'));
  await b.close();
})();
