const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__heroModel !== undefined, null, { timeout: 60000 }).catch(() => {});
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/q_${n}.png` });
  await page.click('#playBtn');
  const waitIntro = async (t) => { for (let i = 0; i < 80; i++) { if (await page.evaluate(() => G.introT) >= t) return; await page.waitForTimeout(150); } };
  await waitIntro(0.9); await S('intro_hero');
  await waitIntro(3.2); await S('intro_boss');
  await waitIntro(4.9); await S('intro_vs');
  await page.evaluate(() => __G.beginFight()); await page.waitForTimeout(1000);
  // awakening
  await page.evaluate(() => { __G.boss.cool = 999; __G.player.hp = 25; });
  await page.waitForTimeout(900); await S('awaken_cut');
  await page.waitForTimeout(2500); await S('awaken_aura');
  console.log('awake', await page.evaluate(() => __G.player.awake + ' hp ' + __G.player.hp));
  // beam struggle
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state = 'idle'; b.phase = 2; b.hp = b.maxHp * 0.43; b.beamPending = true; b.cool = 0; const p = __G.player; p.state='move'; p.pos.set(b.pos.x, 0, b.pos.z + 9); });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => __G.player.state === 'beam')) break; await page.waitForTimeout(200); }
  console.log('beam state', await page.evaluate(() => __G.player.state));
  await page.waitForTimeout(300); await S('beam1'); for (let i = 0; i < 12; i++) { await page.evaluate(() => { const p = __G.player; if (p.state === 'beam') { p.buf = 'light'; p.bufT = 0.3; } }); await page.waitForTimeout(60); } await S('beam1b');
  for (let i = 0; i < 40; i++) { await page.evaluate(() => { const p = __G.player; if (p.state === 'beam') { p.buf = 'light'; p.bufT = 0.3; } }); await page.waitForTimeout(60); }
  await S('beam2');
  for (let i = 0; i < 80; i++) { const st = await page.evaluate(() => __G.player.state); if (st !== 'beam') break; await page.evaluate(() => { __G.player.buf = 'light'; __G.player.bufT = 0.3; }); await page.waitForTimeout(60); }
  console.log('after beam', await page.evaluate(() => __G.player.state + ' bossHp ' + Math.round(__G.boss.hp) + ' boss ' + __G.boss.state + ' php ' + __G.player.hp));
  await page.waitForTimeout(400); await S('beam_win');
  await page.waitForTimeout(2500);
  // finisher
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.state = 'idle'; b.hp = 5; b.cool = 999; b.pos.y = 0; const p = __G.player; p.state = 'move'; p.pos.set(b.pos.x, 0, b.pos.z + 3); p.faceBoss(true); b.takeDamage(50, 0, b.chest(), new THREE.Vector3(0,0,-1), { big: true }); });
  await page.waitForTimeout(500); await S('fin1');
  for (let i = 0; i < 60; i++) { if (await page.evaluate(() => G.endT) > 2.2) break; await page.waitForTimeout(150); }
  await S('fin2');
  console.log('ERRORS', [...new Set(errs)].join('\n'));
  await browser.close();
})();
