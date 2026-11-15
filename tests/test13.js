const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__heroModel !== undefined, null, { timeout: 60000 }).catch(() => {});
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/s_${n}.png` });
  await page.click('#settingsBtn'); await page.waitForTimeout(600); await S('title_settings');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.click('#playBtn'); await page.waitForTimeout(300);
  await page.evaluate(() => __G.beginFight()); await page.waitForTimeout(1500); await S('fight');
  await page.keyboard.press('Escape'); await page.waitForTimeout(600); await S('pause');
  await page.keyboard.press('Escape'); await page.waitForTimeout(4000);
  console.log('quality', await page.evaluate(() => Quality.level + ' fps ' + Quality.fps.toFixed(1) + ' paused ' + G.paused + ' samples ' + Render.rtScene.samples + ' pr ' + Render.r.getPixelRatio()));
  await S('fight_low');
  // defeat after phase 2 -> checkpoint button
  await page.evaluate(() => { G.reachedP2 = true; __G.player.tryHit(999, new THREE.Vector3(0,0,1), 'launch'); });
  await page.waitForTimeout(6000); await S('defeat');
  console.log('p2 visible', await page.evaluate(() => getComputedStyle(document.getElementById('p2Btn')).display));
  await page.click('#p2Btn'); await page.waitForTimeout(3000); await S('p2');
  console.log('p2 state', await page.evaluate(() => G.state + ' boss ' + __G.boss.state + ' hp ' + __G.boss.hp + ' phase ' + __G.boss.phase));
  console.log('ERRORS', [...new Set(errs)].join('\n'));
  await browser.close();
})();
