const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/arena/';
require('fs').mkdirSync(S, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') { const t = m.text(); if (!t.includes('deprecated')) errs.push('C ' + t); } });
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => { Quality.set('high'); Quality.tick = () => {}; Perf.tick = () => {}; Perf.scale = 1; Render.resize(); });
  await page.waitForTimeout(4000); await page.screenshot({ path: S + 'title.png' });
  await page.click('#botBtn'); await page.waitForTimeout(800);
  await page.evaluate(() => Select.confirm()); await page.waitForTimeout(500);
  await page.click('[data-bot="easy"]');
  await page.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  await page.waitForFunction(() => __G.state === 'fight', null, { timeout: 60000 });
  await page.addStyleTag({ content: '#endPanel{display:none !important}' });
  for (const id of ['ruins', 'moonwell', 'galespire']) {
    await page.evaluate(id => { Arena.set(id); Arena.roundStart(); }, id);
    await page.waitForTimeout(3500); await page.screenshot({ path: S + id + '.png' });
  }
  console.log(await page.evaluate(() => { let dc = 0; Render.r.info.autoReset = false; Render.r.info.reset(); Render.render && 0; return 'calls ' + Render.r.info.render.calls + ' tris ' + Render.r.info.render.triangles; }));
  console.log('ERR', errs.slice(0, 10).join('\n')); await b.close();
})();
