const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/arena/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => { Quality.set('high'); Quality.tick = () => {}; Perf.tick = () => {}; Perf.scale = 1; Render.resize(); $('title').classList.add('hide'); __G.state = 'mock'; Cam.update = () => {}; });
  for (const id of ['ruins', 'moonwell', 'galespire']) {
    await page.evaluate(id => { Arena.set(id); const c = Render.camera; c.fov = 50; c.position.set(14, 10, 22); c.lookAt(0, 2, 0); c.updateProjectionMatrix(); }, id);
    await page.waitForTimeout(3000); await page.screenshot({ path: S + 'wide_' + id + '.png' });
    await page.evaluate(() => { const c = Render.camera; c.position.set(-4, 2.2, 9); c.lookAt(0, 5, -20); });
    await page.waitForTimeout(2500); await page.screenshot({ path: S + 'low_' + id + '.png' });
  }
  console.log('ERR', errs.join('\n')); await b.close();
})();
