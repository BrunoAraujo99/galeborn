const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => Quality.set('low'));
  console.log(await page.evaluate(() => ['a','b','c','d','e','f'].map(x => x + ':' + Arena.pickFor(x)).join(' ')));
  await page.click('#botBtn'); await page.waitForTimeout(800);
  await page.evaluate(() => Select.confirm()); await page.waitForTimeout(500);
  // force a match id that lands on moonwell
  await page.evaluate(() => { const o = Date.now; let n = 0; Date.now = () => { const v = o(); return Arena.pickFor('bot-' + v) === 'galespire' ? v : v + (++n); }; });
  await page.evaluate(() => { const o = Date.now; let t = o(); while (Arena.pickFor('bot-' + t) !== 'galespire') t++; Date.now = () => t; setTimeout(() => { Date.now = o; }, 3000); });
  await page.click('[data-bot="easy"]');
  await page.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  console.log('arena', await page.evaluate(() => Arena.id + ' vents=' + Arena.vents.length + ' botArena=' + document.querySelector('iframe').contentWindow.eval('Arena.id')));
  await page.waitForTimeout(2500); await page.screenshot({ path: '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/gale1.png' });
  await page.waitForFunction(() => Arena.arrow && Arena.arrow.visible, null, { timeout: 90000 });
  const p0 = await page.evaluate(() => { const p = __G.player; p.pos.set(0, 0, 0); p.toMove(); return 0; });
  await page.waitForFunction(() => !!Arena.gust, null, { timeout: 30000 });
  await page.waitForTimeout(400); await page.screenshot({ path: '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/gale_gust.png' });
  await page.waitForFunction(() => !Arena.gust, null, { timeout: 30000 });
  console.log('after gust', await page.evaluate(() => 'moved ' + Math.hypot(__G.player.pos.x, __G.player.pos.z).toFixed(1) + ' arrow=' + Arena.arrow.visible));
  await page.waitForTimeout(8000);
  console.log('fight', await page.evaluate(() => `myHp=${Math.round(__G.player.hp)} botHp=${Opp.hp} round=${Duel.round} wins=${Duel.wins}`));
  console.log('ERR', errs.join('\n')); await b.close();
})();
