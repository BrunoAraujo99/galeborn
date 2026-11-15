const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForTimeout(2000);
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/r3b_${n}.png` });
  await S('title');
  await page.click('#playBtn'); await page.waitForTimeout(500);
  await page.evaluate(() => __G.beginFight());
  await page.waitForTimeout(1200); await S('fight');
  await page.evaluate(() => { __G.player.flow = 100; __G.player.state='move'; __G.player.buf='special'; __G.player.bufT=1; });
  await page.waitForTimeout(900); await S('cutin');
  await page.waitForTimeout(8000);
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state='idle'; b.pos.y=0; b.hp = b.maxHp*0.45; b.pendingPhase = true; });
  await page.waitForTimeout(16000); await S('phase2');
  // nova with fast forward via direct time
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state='idle'; b.pos.y=0; b.atk = b.nova(); b.atk.name='nova'; b.state='attack'; b.at=0; b.prevAt=-1; __G.player.hp=100; __G.player.state='move';
    const P = World.dpillars.find(p => !p.broken); const d = new THREE.Vector3(P.x, 0, P.z).normalize(); __G.player.pos.set(P.x + d.x*1.6, 0, P.z + d.z*1.6); });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { const b = __G.boss; for (let k = 0; k < 20; k++) b.update(0.05); }); }
  await page.waitForTimeout(500); await S('nova_after');
  console.log('nova', await page.evaluate(() => __G.boss.state + ' broken ' + World.dpillars.filter(p=>p.broken).length + ' php ' + __G.player.hp + ' covered ' + __G.stats.covered));
  console.log('ERRORS', [...new Set(errs)].filter(e => !e.includes('deprecated')).join('\n'));
  await browser.close();
})();
