const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/pillars2/';
require('fs').mkdirSync(S, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') { const t = m.text(); if (!t.includes('deprecated')) errs.push('C ' + t); } });
  await page.goto('file:///home/claude/duel/dist/pc/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => { Quality.set('high'); Quality.tick = () => {}; Perf.scale = 1; Settings.v.drs = false; Render.resize(); });
  await page.waitForTimeout(4000);
  await page.click('#botBtn'); await page.waitForTimeout(800);
  await page.evaluate(() => Select.confirm()); await page.waitForTimeout(500);
  await page.click('[data-bot="easy"]');
  await page.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  await page.waitForFunction(() => __G.state === 'fight', null, { timeout: 60000 });
  await page.addStyleTag({ content: '#endPanel{display:none !important} #hud,#bossbar,.arenaBanner{opacity:0 !important}' });
  await page.evaluate(() => { BotAI.update = () => {}; Cam.update = () => {}; });
  const view = (k, far) => page.evaluate(([k, far]) => { const P = World.dpillars[k]; const c = Render.camera; const a = Math.atan2(P.z, P.x) + 0.35; c.position.set(Math.cos(a) * far, 3.2, Math.sin(a) * far); c.lookAt(P.x, 3.6, P.z); c.fov = 40; c.updateProjectionMatrix(); }, [k, far]);
  for (const id of ['ruins', 'moonwell', 'galespire']) {
    await page.evaluate(id => { Arena.set(id); Arena.roundStart(); }, id);
    await page.waitForTimeout(5000);
    await view(0, -2); await page.waitForTimeout(1200); await page.screenshot({ path: S + id + '_1.png' });
    await view(1, -2); await page.waitForTimeout(1200); await page.screenshot({ path: S + id + '_2.png' });
    console.log(id, await page.evaluate(() => { const P = World.dpillars[0]; Render.r.info.autoReset = true; return JSON.stringify({ skin: !!P.skin, merged: !!P.merged, ready: Perf.ready, calls: Render.r.info.render.calls }); }));
    await page.evaluate(() => { const P = World.dpillars[1]; World.hitPillar(P, 200, new THREE.Vector3(Math.sin(1), 0, Math.cos(1)), new THREE.Vector3(P.x, 2, P.z)); });
    await page.waitForTimeout(250); await page.screenshot({ path: S + id + '_3.png' });
    await page.waitForTimeout(3000); await page.screenshot({ path: S + id + '_4.png' });
    await page.evaluate(() => { const P = World.dpillars[1]; Kit.spikeAt(new THREE.Vector3(P.x * 0.55, 0, P.z * 0.55), 1); Kit.spikeAt(new THREE.Vector3(P.x * 0.5, 0, P.z * 0.5), 6); });
    await page.waitForTimeout(500); await page.screenshot({ path: S + id + '_5.png' });
    await page.evaluate(() => World.resetEnv()); await page.waitForTimeout(500);
  }
  console.log('ERR', errs.slice(0, 10).join('\n')); await b.close();
})();
