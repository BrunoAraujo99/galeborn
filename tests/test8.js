const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__heroModel !== undefined, null, { timeout: 60000 }).catch(() => {});
  console.log('model', await page.evaluate(() => window.__heroModel));
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/m_${n}.png` });
  await page.click('#playBtn'); await page.waitForTimeout(500);
  await page.evaluate(() => __G.beginFight());
  await page.waitForTimeout(1500);
  // close-up camera helper: freeze boss, place camera in front of hero
  const pose = async (name, setup) => {
    await page.evaluate(setup);
    await page.waitForTimeout(1200);
    await S(name);
  };
  await page.evaluate(() => { __G.boss.cool = 999; __G.boss.update = function(){}; });
  await pose('idle', () => {});
  await page.keyboard.down('w'); await page.waitForTimeout(2500); await S('run'); await page.keyboard.up('w');
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => { const p = __G.player; p.buf = 'light'; p.bufT = 1; }); await page.waitForTimeout(700); await S('light' + i); }
  await page.evaluate(() => { const p = __G.player; p.buf = 'jump'; p.bufT = 1; }); await page.waitForTimeout(500); await S('jump');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const p = __G.player; p.buf = 'dash'; p.bufT = 1; }); await page.waitForTimeout(300); await S('dash');
  console.log('ERRORS', [...new Set(errs)].filter(e => !e.includes('deprecated')).join('\n'));
  await browser.close();
})();
