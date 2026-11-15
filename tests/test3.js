const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForTimeout(1200);
  await page.click('#playBtn'); await page.waitForTimeout(600);
  await page.evaluate(() => { __G.beginFight(); const b = __G.boss; b.hp = b.maxHp * 0.49; b.pendingPhase = true; });
  await page.waitForTimeout(12000);
  await page.evaluate(() => { const b = __G.boss; b.pos.set(0,0,-3); b.cancelAttack(); b.atk = b.wave(); b.state = 'attack'; b.at = 0; b.prevAt = -1; __G.player.hp = 100; });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/claude-0/shots/t3.png' });
  console.log(await page.evaluate(() => __G.boss.phase + ' ' + World.mix.toFixed(2)));
  console.log('ERRORS', [...new Set(errs)].filter(e => !e.includes('deprecated')).join('\n'));
  await browser.close();
})();
