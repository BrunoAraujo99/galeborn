const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///home/claude/duel/dist/galeborn.html');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await p.evaluate(() => Quality.set('low'));
  await p.evaluate(() => { G.startIntro(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { __G.beginFight(true); __G.boss.cool = 999; });
  await p.waitForTimeout(500);
  // dash and measure lag
  await p.evaluate(() => { const pl = __G.player; pl.buf = 'dash'; pl.bufT = 0.4; });
  let mx = 0; for (let i = 0; i < 10; i++) { await p.waitForTimeout(60); mx = Math.max(mx, await p.evaluate(() => Cam.lagAmt || 0)); }
  console.log('max cam lag during dash', mx.toFixed(2), 'pace', await p.evaluate(() => G.pace));
  await p.screenshot({ path: '/tmp/claude-0/shots/s_dash.png' });
  // force a clash -> blitz
  await p.evaluate(() => { Blitz.lastT = -99; const at = __G.player.chest().lerp(__G.boss.chest(), 0.5); const r = Math.random; Math.random = () => 0; Blitz.maybe(at); Math.random = r; });
  await p.waitForFunction(() => Blitz.active, null, { timeout: 10000 });
  for (const t of [450, 450, 500]) { await p.waitForTimeout(t); await p.screenshot({ path: `/tmp/claude-0/shots/s_blitz${t}_${Date.now()%1000}.png` }); }
  await p.waitForFunction(() => !Blitz.active, null, { timeout: 15000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-0/shots/s_after.png' });
  console.log(await p.evaluate(() => `state=${__G.player.state} pY=${__G.player.pos.y.toFixed(2)} boss=${__G.boss.state} hp=${Math.round(__G.boss.hp)} blitz=${G.stats.blitz} cine=${!!Cam.cine}`));
  console.log('ERRORS', errs.filter(e => !/TUNNEL|ERR_/.test(e)).join('\n'));
  await b.close();
})();
