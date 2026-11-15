const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 540 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__heroModel !== undefined, null, { timeout: 60000 }).catch(() => {});
  await page.click('#playBtn'); await page.waitForTimeout(500);
  await page.evaluate(() => { __G.beginFight(); });
  await page.waitForTimeout(800);
  const keys = await page.evaluate((side) => {
    __G.boss.update = function(){}; __G.boss.rig.root.visible = false;
    document.querySelectorAll('#hud,.hud,#subtitle,#prompt').forEach(e => e.style.display = 'none');
    const p = __G.player; p.state = 'frozen'; p.pos.set(0, 0, 0); p.vel.set(0,0,0); p.yaw = 0;
    window.__side = 0;
    Cam.update = function () { const a = window.__side; Render.camera.position.set(Math.sin(a) * 3.6, 1.15, Math.cos(a) * 3.6); Render.camera.lookAt(0, 0.95, 0); Render.camera.fov = 40; Render.camera.updateProjectionMatrix(); };
    return Object.keys(HERO_POSES);
  });
  const only = process.argv[2] ? process.argv[2].split(',') : keys;
  for (const k of only) {
    for (const side of [0, 1.57]) {
      await page.evaluate(([k, side]) => { window.__side = side; const r = __G.player.rig; r.setPose(HERO_POSES[k]); r.snap(); r.rate = 1000; }, [k, side]);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `/tmp/claude-0/shots/p_${k}_${side ? 's' : 'f'}.png` });
    }
  }
  console.log(keys.join(','));
  console.log('ERRORS', errs.join('\n'));
  await browser.close();
})();
