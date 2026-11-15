const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + '\n' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForTimeout(2500);
  const S = async n => page.screenshot({ path: `/tmp/claude-0/shots/${n}.png` });
  await S('01_title');
  await page.click('#playBtn');
  await page.waitForTimeout(1500); await S('02_intro');
  await page.waitForTimeout(2500); await S('03_fight');
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); } requestAnimationFrame(f); }));
  console.log('fps', fps);
  // run toward boss and combo
  await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(170); if (i === 2) await S('04_combo'); }
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyK'); await page.waitForTimeout(900); await S('05_charge'); await page.keyboard.up('KeyK'); await page.waitForTimeout(120); await S('06_lance');
  await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('Space'); await page.waitForTimeout(150); await S('07_djump');
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(150); await page.keyboard.press('KeyJ'); await page.waitForTimeout(150); await S('08_air');
  await page.keyboard.press('KeyK'); await page.waitForTimeout(400); await S('09_slam');
  const st = await page.evaluate(() => ({ hp: __G.boss.hp, post: __G.boss.posture, combo: __G.stats.maxCombo, pstate: __G.player.state, bstate: __G.boss.state }));
  console.log(JSON.stringify(st));
  for (const atk of ['volley', 'wave', 'rush', 'eruption', 'leap']) {
    await page.evaluate(a => { const b = __G.boss; b.cancelAttack(); b.atk = b[a](); b.atk.name = a; b.state = 'attack'; b.at = 0; b.prevAt = -1; __G.player.hp = 100; }, atk);
    await page.waitForTimeout(700); await S('10_' + atk);
    await page.waitForTimeout(1500);
  }
  // perfect dodge test
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.atk = b.rush(); b.state = 'attack'; b.at = 0; b.prevAt = -1; });
  await page.waitForTimeout(950);
  await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(200); await S('11_dodge');
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(150); await S('12_counter');
  console.log('perfect', await page.evaluate(() => __G.stats.perfect + ' counters ' + __G.stats.counters));
  await page.waitForTimeout(1500);
  // phase 2
  await page.evaluate(() => { const b = __G.boss; b.hp = b.maxHp * 0.52; __G.player.hp = 100; });
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(100);
  await page.evaluate(() => { const b = __G.boss; b.pendingPhase = true; });
  await page.waitForTimeout(1300); await S('13_phase2');
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const b = __G.boss; b.cancelAttack(); b.atk = b.spiral(); b.state = 'attack'; b.at = 0; b.prevAt = -1; __G.player.hp = 100; });
  await page.waitForTimeout(1600); await S('14_spiral');
  await page.waitForTimeout(2500);
  // special
  await page.evaluate(() => { __G.player.flow = 100; __G.player.hp = 100; });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400); await S('15_special_a');
  await page.waitForTimeout(800); await S('15_special_b');
  await page.waitForTimeout(1500); await S('15_special_c');
  await page.waitForTimeout(1500);
  // posture break
  await page.evaluate(() => { const b = __G.boss; if (b.state==='held'||b.state==='fall') return; b.posture = 99; });
  await page.evaluate(() => { const b = __G.boss; b.takeDamage(5, 5, b.chest(), new THREE.Vector3(0,0,1), {}); });
  await page.waitForTimeout(500); await S('16_break');
  // victory
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const b = __G.boss; b.hp = 1; b.takeDamage(30, 0, b.chest(), new THREE.Vector3(0,0,1), {big:true}); });
  await page.waitForTimeout(2500); await S('17_victory_cine');
  await page.waitForTimeout(3500); await S('18_victory');
  console.log('state', await page.evaluate(() => __G.state));
  // restart and lose
  await page.keyboard.press('KeyR'); await page.waitForTimeout(4000);
  await page.evaluate(() => { __G.player.hp = 5; const b = __G.boss; b.cancelAttack(); b.atk = b.wave(); b.state = 'attack'; b.at = 0; b.prevAt = -1; __G.player.pos.set(b.pos.x+1.5,0,b.pos.z+1.5); });
  await page.waitForTimeout(4500); await S('19_defeat');
  console.log('state', await page.evaluate(() => __G.state));
  console.log('ERRORS:\n' + [...new Set(errs)].slice(0, 30).join('\n'));
  await browser.close();
})();
