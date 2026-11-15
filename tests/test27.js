const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => Quality.set('low'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/claude-0/shots/menu.png' });
  await page.click('#trainBtn'); await page.waitForTimeout(600);
  await page.evaluate(() => Select.confirm());
  await page.waitForFunction(() => Training.active && G.state === 'fight', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/claude-0/shots/train1.png' });
  const L = async () => page.evaluate(() => `lesson=${Training.idx} title=${$('trTitle').textContent} prog=${$('trProg').querySelectorAll('i.on').length}`);
  console.log(await L());
  // cheat each lesson's condition and verify advance
  const cheats = [
    () => { G.stats.perfects = (G.stats.perfects || 0) + 3; },
    () => { Training.ev.pursuit = 1; },
    null, null,
    () => { G.stats.bursts = (G.stats.bursts || 0) + 1; },
    () => { Training.ev.heavy = 1; },
  ];
  for (let i = 0; i < 6; i++) {
    if (cheats[i]) await page.evaluate(`(${cheats[i].toString()})()`);
    else {
      // wait for a real rush and block/parry it
      const r = await page.evaluate(i => new Promise(res => { const t0 = performance.now();
        const P = __G.player; if (!P.__w) { P.__w = 1; const ob = P.bufferInputs.bind(P); P.bufferInputs = a => ob(Object.assign({}, a, { block: !!window.__blk })); }
        const iv = setInterval(() => { const b = __G.boss, p = __G.player, d = horizDist(b.pos, p.pos);
        p.faceBoss(true);
        if (i === 2) window.__blk = b.state === 'attack';
        if (i === 3) { window.__blk = b.state === 'attack' && d < 2.6; }
        if (Training.idx !== i || performance.now() - t0 > 150000) { clearInterval(iv); window.__blk = false; res(Training.idx + ' ev=' + JSON.stringify(Training.ev)); } }, 20); }), i);
      console.log('  real lesson', i, '->', r);
    }
    await page.waitForFunction(i => Training.idx > i || !Training.active, i, { timeout: 60000 }).catch(() => console.log('stuck at', i));
    console.log(await L());
    if (i === 2) await page.screenshot({ path: '/tmp/claude-0/shots/train3.png' });
  }
  await page.waitForTimeout(4500);
  console.log('after', await page.evaluate(() => `active=${Training.active} gs=${G.state} mode=${G.mode} trained=${localStorage.getItem('galeborn.trained')}`));
  console.log('ERR', errs.join('\n')); await b.close();
})();
