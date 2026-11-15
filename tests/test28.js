const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => Quality.set('low'));
  // give some xp and win a bot match quickly via grant
  console.log(await page.evaluate(() => { const r = Progress.grant('solo', true); const r2 = Progress.grant('online', true); Progress.d.xp.wind = 2200; Progress.save(); return JSON.stringify(r) + ' lv=' + Progress.level('wind') + ' next=' + JSON.stringify(Progress.nextUnlock('wind')); }));
  await page.click('#profBtn'); await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/claude-0/shots/profile.png' });
  await page.click('.chip[data-act="skin"][data-v="3"]'); await page.waitForTimeout(300);
  await page.click('.chip[data-act="title"][data-v="1"]'); await page.waitForTimeout(300);
  await page.click('.chip[data-act="fin"][data-v="1"]'); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => `sel=${JSON.stringify(Progress.sel('wind'))} skin=${Progress.skinOf('wind').n} title=${Progress.titleOf('wind')} fin=${Progress.finOf('wind')} tint=${__G.player.rig.skinMat && __G.player.rig.skinMat.color.getHexString()} pname=${$('pname').textContent} hello=${JSON.stringify(Progress.hello())}`));
  await page.screenshot({ path: '/tmp/claude-0/shots/profile2.png' });
  await page.click('[data-act="close"]');
  // solo quick end screen
  await page.evaluate(() => { G.state = 'fight'; showEnd(true); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/claude-0/shots/endxp.png' });
  console.log('ERR', errs.join('\n')); await b.close();
})();
