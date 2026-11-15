const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__heroModel !== undefined, null, { timeout: 60000 }).catch(() => {});
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/k_${n}.png` });
  await page.click('#playBtn'); await page.waitForTimeout(500);
  await page.evaluate(() => __G.beginFight()); await page.waitForTimeout(1200);
  await page.evaluate(() => { __G.boss.cool = 999; });
  await S('fight');
  // rush with speed bg
  await page.evaluate(() => { const p = __G.player; p.pos.set(__G.boss.pos.x + 5, 0, __G.boss.pos.z + 3); p.state = 'move'; p.dashDir = new THREE.Vector3(-1,0,0); p.startRush(); });
  await page.waitForTimeout(250); await S('rush');
  await page.waitForTimeout(1500);
  // smoke + sparks
  await page.evaluate(() => { const c = __G.player.pos.clone().setY(1); FX.burst(c, 40, { speed: 8, life: 1.2, s0: 0.5, c0: C.fireHot, c1: C.ember }); FX.burst(c, 20, { speed: 3, life: 1.5, s0: 1, s1: 2.5, c0: C.smokeL, c1: C.smoke, add: false, alpha: 0.5, up: 1 }); });
  await page.waitForTimeout(400); await S('particles');
  // impact frame
  await page.evaluate(() => { Render.post.impact = 1; }); await page.waitForTimeout(30); await S('impact');
  console.log('ERRORS', [...new Set(errs)].join('\n'));
  await browser.close();
})();
