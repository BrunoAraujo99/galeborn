const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForTimeout(2000);
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/r3c_${n}.png` });
  await page.click('#playBtn'); await page.waitForTimeout(500);
  await page.evaluate(() => __G.beginFight());
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state='idle'; b.pos.y=0; b.hp = b.maxHp*0.45; b.pendingPhase = true; });
  for (let i = 0; i < 40; i++) { const st = await page.evaluate(() => __G.boss.state + ' ' + __G.boss.st.toFixed(2)); if (/transition (1\.[5-9]|2)/.test(st)) break; await page.waitForTimeout(400); }
  await S('roar1'); await page.waitForTimeout(1500); await S('roar2');
  console.log(await page.evaluate(() => __G.boss.state + ' ' + __G.boss.st.toFixed(2)));
  console.log('ERRORS', errs.join('\n'));
  await browser.close();
})();
