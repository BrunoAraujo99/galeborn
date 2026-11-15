const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + ' ' + e.stack));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => Quality.set('low'));
  const S = n => page.screenshot({ path: `/tmp/claude-0/shots/m_${n}.png` });
  for (const id of ['fire', 'earth', 'water', 'wind']) {
    await page.evaluate(id => new Promise(r => G.setHero(id, r)), id);
    await page.click('#soloBtn').catch(() => {}); await page.waitForTimeout(300);
    await page.evaluate(() => { Select && Select.confirm && $('select') && $('select').classList.contains('show') && Select.confirm(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { __G.beginFight(); Quality.auto = false; const b = __G.boss; b.cool = 999; if (!b._wrapped) { b._wrapped = 1; b.update = (function (u) { return function (dt) { this.cool = 999; return u.call(this, dt); }; })(b.update); } });
    await page.waitForTimeout(600);
    const press = async (n, wait) => { await page.evaluate(n => { const p = __G.player; p.buf = n; p.bufT = 0.3; }, n); await page.waitForTimeout(wait); };
    await page.evaluate(() => { const b = __G.boss, p = __G.player; p.state = 'move'; p.pos.set(b.pos.x, 0, b.pos.z + 3); p.faceBoss(true); });
    const hp0 = await page.evaluate(() => __G.boss.hp);
    const seen = [];
    for (let i = 0; i < 6; i++) { await press('light', 160); seen.push(await page.evaluate(() => __G.player.move ? __G.player.move.s : __G.player.state)); }
    await page.waitForTimeout(150); await S(id + '_combo');
    await page.waitForTimeout(800);
    const hp1 = await page.evaluate(() => __G.boss.hp);
    // heavy
    await page.evaluate(() => { const b = __G.boss, p = __G.player; p.state = 'move'; p.pos.set(b.pos.x, 0, b.pos.z + 7); p.faceBoss(true); p.buf = 'heavy'; p.bufT = 0.3; });
    await page.waitForTimeout(200);
    const kinds = await page.evaluate(() => new Promise(r => { const p = __G.player; const o = Input.poll; setTimeout(() => r(G.proj.map(q => q.kind).join(',')), 900); }));
    await page.waitForTimeout(150); await S(id + '_heavy');
    await page.waitForTimeout(1200);
    const hp2 = await page.evaluate(() => __G.boss.hp);
    // dash
    await page.evaluate(() => { const b = __G.boss, p = __G.player; p.state = 'move'; p.pos.set(b.pos.x, 0, b.pos.z + 5); p.faceBoss(true); p.startDash(p.bossDir().normalize(), true); });
    await page.waitForTimeout(120); const dk = await page.evaluate(() => __G.player.dashKind + ' trail=' + FlameTrail.spots.length + ' inv=' + __G.player.dodgeInv.toFixed(2)); await S(id + '_dash');
    await page.waitForTimeout(800);
    // block / parry / guard break
    const g = await page.evaluate(() => {
      const p = __G.player, b = __G.boss; p.state = 'move'; p.invuln = 0; p.dodgeInv = 0; p.pos.set(b.pos.x, 0, b.pos.z + 4); p.faceBoss(true);
      const dir = p.fwd().negate();
      p.startBlock(); const r1 = p.tryHit(10, dir, 'light', null);
      p.toMove(); p.startBlock(); p.st = 0.3; p.blockHeld = true; const r2 = p.tryHit(20, dir, 'heavy', null);
      const gAfter = Math.round(p.guard);
      let r3 = ''; for (let i = 0; i < 10 && p.state === 'block'; i++) { p.blockStunT = 0; r3 = p.tryHit(20, dir, 'heavy', null); }
      const s3 = p.state;
      p.toMove(); p.guard = 100; const r4 = p.tryHit(5, p.fwd(), 'light', null); // from behind
      return `parry=${r1} block=${r2} guard=${gAfter} last=${r3} state=${s3} behind=${r4}`;
    });
    await page.waitForTimeout(100); await S(id + '_guard');
    console.log(id, 'strings:', seen.join(' '), '| combo dmg', Math.round(hp0 - hp1), '| heavy', kinds, 'dmg', Math.round(hp1 - hp2), '| dash', dk, '|', g);
    await page.evaluate(() => { __G.player.hp = __G.player.maxHp; __G.player.toMove(); __G.player.blockHeld = false; });
    await page.waitForTimeout(1500);
  }
  console.log('ERRORS', errs.filter(e => !/TUNNEL|ERR_|GPU stall/.test(e)).slice(0, 15).join('\n'));
  await browser.close();
})();
