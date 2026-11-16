const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('C ' + m.text()); });
  await page.goto('file:///home/claude/duel/dist/pc/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  console.log(await page.evaluate(() => JSON.stringify({ audio: Object.keys(AUDIO_B64).length, arenas: Object.keys(ARENA_B64).length, hero: HERO_WIND_B64.length > 0, stageGroups: Object.keys(Stage.groups), props: Stage.groups.sunset.children.filter(c => c.isInstancedMesh).length })));
  console.log('ERR', errs.slice(0, 5).join('\n')); await b.close();
})();
