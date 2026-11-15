const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+' '+m.text()); });
  await p.goto('file:///home/claude/duel/dist/galeborn.html');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await p.evaluate(() => Quality.set('low'));
  await p.click('#botBtn'); await p.waitForTimeout(800);
  await p.evaluate(() => Select.confirm()); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/shots/b_menu.png' });
  await p.click('[data-bot="hard"]');
  await p.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  console.log('started vs', await p.evaluate(() => Duel.match.opp.name));
  await p.evaluate(() => { window.__st = {}; setInterval(() => { const q = __G.player; if (Opp.puppet) { window.__st[Opp.puppet.state] = (window.__st[Opp.puppet.state]||0)+1; q.pos.lerp(Opp.pos, 0.0); q.faceBoss(true); q.buf = Math.random()<0.2?'heavy':'light'; q.bufT = 0.3; } }, 120); window.__pops=[]; const o = FX.popup; FX.popup = function(w,t){ window.__pops.push(t); return o.apply(FX, arguments); }; });
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(3000);
    console.log(await p.evaluate(() => `t=${G.time.toFixed(1)} myHp=${Math.round(__G.player.hp)} botHp=${Opp.hp} botState=${Opp.puppet.state} dist=${horizDist(__G.player.pos, Opp.pos).toFixed(1)} ended=${Duel.ended}`));
    if (i === 3) await p.screenshot({ path: '/tmp/claude-0/shots/b_fight.png' });
  }
  console.log(await p.evaluate(() => JSON.stringify(window.__st) + ' pops=' + [...new Set(window.__pops)].join(','))); console.log('ERRORS', errs.filter(e => !/TUNNEL|ERR_|GPU stall/.test(e)).slice(0,15).join('\n'));
  await b.close();
})();
