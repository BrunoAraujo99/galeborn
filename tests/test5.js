const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForTimeout(1500);
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/r3_${n}.png` });
  await S('title');
  await page.click('#playBtn'); await page.waitForTimeout(500);
  await page.evaluate(() => __G.beginFight());
  await page.waitForTimeout(1500); await S('hud');
  // gale rush
  await page.evaluate(() => { const p = __G.player; p.pos.set(0,0,0); __G.boss.pos.set(0,0,-6); __G.boss.cool = 9; p.state='dash'; p.dashDir=new THREE.Vector3(0,0,-1); p.startRush(); });
  await page.waitForTimeout(150);

  await page.waitForTimeout(500); await S('rush');
  await page.waitForTimeout(2500);
  console.log('rush', await page.evaluate(() => __G.boss.hp + ' ' + __G.player.state));
  // tempest cut-in
  await page.evaluate(() => { __G.player.flow = 100; __G.player.state='move'; __G.player.buf='special'; __G.player.bufT=1; });
  await page.waitForTimeout(700); await S('cutin');
  await page.waitForTimeout(9000);
  // nova
  await page.evaluate(() => { const b = __G.boss; b.phase = 2; b.state='idle'; b.cancelAttack(); b.pos.y=0; b.atk = b.nova(); b.atk.name='nova'; b.state='attack'; b.at=0; b.prevAt=-1; __G.player.hp=100; __G.player.state='move'; });
  await page.waitForTimeout(1500); await S('nova_a');
  await page.waitForTimeout(7000); await S('nova_b');
  await page.waitForTimeout(9000); await S('nova_c');
  console.log('nova', await page.evaluate(() => __G.boss.state + ' broken ' + World.dpillars.filter(p=>p.broken).length + ' php ' + __G.player.hp));
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state='idle'; b.pos.y=0; b.atk = b.meteor(); b.atk.name='meteor'; b.state='attack'; b.at=0; b.prevAt=-1; __G.player.hp=100; });
  await page.waitForTimeout(6000); await S('meteor');
  await page.waitForTimeout(8000);
  console.log('ERRORS', [...new Set(errs)].filter(e => !e.includes('deprecated')).join('\n'));
  await browser.close();
})();
