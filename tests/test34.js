const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/neon/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => Quality.set('low'));
  
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.evaluate(() => $('pause').classList.remove('show'));
  await page.click('#soloBtn'); await page.waitForTimeout(2000);
  await page.evaluate(() => Select.confirm());
  await page.waitForFunction(() => __G.state === 'intro', null, { timeout: 60000 });
  
  await page.evaluate(() => { $('vsCard').classList.remove('show'); __G.beginFight(); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const p = __G.player; p.combo = 7; p.comboDmg = 64; p.comboT = 3; p.flow = 60; p.burst = 40; __G.boss.hp *= 0.5; }); for (let i=0;i<6;i++){ await page.evaluate(() => { Object.defineProperty(__G.player, 'combo', { get: () => 7, set: () => {}, configurable: true }); __G.player.comboDmg = 64; }); await page.waitForTimeout(80);} 
  await page.waitForTimeout(500); await page.screenshot({ path: S + '11_combo.png' });
  await page.evaluate(() => { showEnd(true); });
  await page.waitForFunction(() => $('endPanel').classList.contains('show'), null, { timeout: 90000 });
  await page.waitForTimeout(1500); await page.screenshot({ path: S + '6_end.png' });
  console.log('ERR', errs.join('\n')); await b.close();
})();
