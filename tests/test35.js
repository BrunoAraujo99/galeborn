const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/neon/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => { $('title').classList.add('hide'); $('hud').classList.add('show'); $('comboN').textContent = 7; $('comboD').textContent = '64 DMG'; $('combo').classList.add('show'); });
  await page.waitForTimeout(800);
  console.log(await page.evaluate(() => { const c = $('combo'), r = c.getBoundingClientRect(); return c.className + ' ' + getComputedStyle(c).opacity + ' ' + JSON.stringify(r); }));
  await page.screenshot({ path: S + '12_combo.png' });
  await b.close();
})();
