const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('file:///home/claude/duel/dist/galeborn.html');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await p.evaluate(() => Quality.set('low'));
  await p.screenshot({ path: '/tmp/claude-0/shots/l_title.png' });
  await p.click('#friendBtn'); await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/claude-0/shots/l_sel.png' });
  await p.evaluate(() => Select.confirm()); await p.waitForTimeout(4000);
  await p.screenshot({ path: '/tmp/claude-0/shots/l_lobby.png' });
  console.log(await p.evaluate(() => $('lobby').innerText.slice(0, 400)));
  await b.close();
})();
