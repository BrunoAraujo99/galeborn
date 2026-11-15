const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+' '+m.text()); });
  await p.goto('file:///home/claude/duel/dist/galeborn.html');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await p.evaluate(() => Quality.set('low'));
  await p.click('#botBtn'); await p.waitForTimeout(800);
  await p.evaluate(() => Select.confirm()); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/shots/b_menu.png' });
  await p.click('[data-bot="hard"]');
  await p.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  console.log('started vs', await p.evaluate(() => Duel.match.opp.name));
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(3000);
    console.log(await p.evaluate(() => `t=${G.time.toFixed(1)} myHp=${Math.round(__G.player.hp)} botHp=${Opp.hp} botState=${Opp.puppet.state} dist=${horizDist(__G.player.pos, Opp.pos).toFixed(1)} ended=${Duel.ended}`));
    if (i === 3) await p.screenshot({ path: '/tmp/claude-0/shots/b_fight.png' });
  }
  console.log('ERRORS', errs.filter(e => !/TUNNEL|ERR_|GPU stall/.test(e)).slice(0,15).join('\n'));
  await b.close();
})();
