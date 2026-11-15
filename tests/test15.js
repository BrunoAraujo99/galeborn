const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || /warn/.test(m.type())) errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__heroModel !== undefined, null, { timeout: 90000 }).catch(() => {});
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/h_${n}.png`, timeout: 120000 });
  await page.evaluate(() => Quality.set('low'));
  await page.click('#playBtn'); await page.waitForTimeout(1500);
  for (const i of [0, 1, 2, 3]) {
    await page.evaluate(i => Select.pick(i), i);
    await page.waitForFunction(i => Hero.id === HERO_ORDER[i] && __G.player.rig.model, i, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await S('sel' + i);
    console.log('sel', i, await page.evaluate(() => `${Hero.id} model=${!!__G.player.rig.model} acts=${Object.keys(__G.player.rig.model ? __G.player.rig.model.acts : {}).join(',')} hp=${__G.player.maxHp}`));
  }
  // fight as each hero quickly
  for (const id of ['fire', 'earth', 'water', 'wind']) {
    await page.evaluate(id => Select.pick(HERO_ORDER.indexOf(id)), id);
    await page.waitForFunction(id => Hero.id === id && __G.player.rig.model, id, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => { Select.confirm(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { __G.beginFight(true); __G.boss.cool = 999; const b = __G.boss, p = __G.player; p.pos.set(b.pos.x, 0, b.pos.z + 3); p.faceBoss(true); });
    // combo of 4 lights
    for (let k = 0; k < 4; k++) { await page.evaluate(() => { const p = __G.player; p.buf = 'light'; p.bufT = 0.4; }); await page.waitForTimeout(700); }
    await S('fight_' + id);
    // ultimate
    await page.evaluate(() => { const p = __G.player; p.flow = 100; p.toMove(); p.buf = 'special'; p.bufT = 0.5; });
    await page.waitForTimeout(2500); await S('ult_' + id);
    await page.waitForTimeout(6000);
    // get hit (earth armor check) + knockdown
    console.log(id, await page.evaluate(() => { const p = __G.player; return `state=${p.state} hp=${Math.round(p.hp)}/${p.maxHp} bossHp=${Math.round(__G.boss.hp)} heat=${Kit.heat} moments=${G.stats.moments||0}`; }));
    await page.evaluate(() => { const p = __G.player; p.toMove(); p.invuln = 0; p.tryHit(10, new THREE.Vector3(0, 0, 1), 'launch'); });
    await page.waitForTimeout(600); await S('launch_' + id);
    await page.evaluate(() => { __G.player.hp = __G.player.maxHp; Select.open(); });
    await page.waitForTimeout(800);
  }
  console.log('ERRORS', errs.filter(e => !/deprecated|GPU stall|WebGL/.test(e)).join('\n'));
  await browser.close();
})();
