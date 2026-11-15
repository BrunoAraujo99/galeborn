const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const mk = async (tag) => {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(tag + ' ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errs.push(tag + ' PAGEERR: ' + e.message + ' ' + e.stack));
    await page.goto('file:///home/claude/duel/dist/galeborn.html');
    await page.waitForFunction(() => window.__G && __G.player && __G.player.rig.model, null, { timeout: 90000 });
    await page.evaluate(() => Quality.set('low'));
    return page;
  };
  const A = await mk('A'), B = await mk('B');
  await A.exposeFunction('__netOut', m => B.evaluate(m => window.__netIn && window.__netIn(m), m).catch(() => {}));
  await B.exposeFunction('__netOut', m => A.evaluate(m => window.__netIn && window.__netIn(m), m).catch(() => {}));
  const setHero = (pg, id) => pg.evaluate(id => new Promise(r => G.setHero(id, r)), id);
  await setHero(A, 'wind'); await setHero(B, 'fire');
  await A.evaluate(() => Duel.begin({ id: 't1', kind: 'friend', side: 1, me_hero: 'wind', opp: { id: 'b', name: 'BOBBY', hero: 'fire' }, test: true }, TestLink));
  await B.evaluate(() => Duel.begin({ id: 't1', kind: 'friend', side: 2, me_hero: 'fire', opp: { id: 'a', name: 'ALICE', hero: 'wind' }, test: true }, TestLink));
  await A.waitForFunction(() => Duel.started, null, { timeout: 30000 });
  await B.waitForFunction(() => Duel.started, null, { timeout: 30000 });
  console.log('both started');
  await B.evaluate(() => { window.__log=[]; const o=Duel.rx.bind(Duel); Duel.rx=m=>{ if(m.t==='hit'){ const before=__G.player.hp; o(m); __log.push(m.k+':'+m.d+' hp '+before+'->'+__G.player.hp+' st='+__G.player.state+' inv='+__G.player.invuln.toFixed(2)+' dinv='+(__G.player.dodgeInv||0).toFixed(2)+' gs='+G.state);} else o(m); }; });
  await A.evaluate(() => { window.__sent=0; const o=Opp.takeDamage.bind(Opp); Opp.takeDamage=(...a)=>{const r=o(...a); __sent++; window.__last=JSON.stringify([a[0],a[4]&&a[4].src, !!r]); return r;}; });
  await A.screenshot({ path: '/tmp/claude-0/shots/d_A0.png' }); 
  // B stands still; move A next to B's puppet
  await A.evaluate(() => { const p = __G.player, o = Opp.puppet.pos; p.pos.set(o.x, 0, o.z + 2.2); p.faceBoss(true); });
  await A.waitForTimeout(800);
  const hpB0 = await B.evaluate(() => __G.player.hp);
  for (let k = 0; k < 4; k++) { await A.evaluate(() => { const p = __G.player; p.buf = 'light'; p.bufT = 0.4; }); await A.waitForTimeout(600); }
  await A.waitForTimeout(800);
  const hpB1 = await B.evaluate(() => __G.player.hp);
  console.log('B hp', hpB0, '->', hpB1, 'A sees opp hp', await A.evaluate(() => Opp.hp));
  await A.screenshot({ path: '/tmp/claude-0/shots/d_A1.png' }); await B.screenshot({ path: '/tmp/claude-0/shots/d_B1.png' });
  // dodge test: B rolls (invuln) while A hits
  await B.evaluate(() => { __G.player.invuln = 2; });
  await A.evaluate(() => { const p = __G.player, o = Opp.puppet.pos; p.pos.set(o.x, 0, o.z + 2.2); p.faceBoss(true); p.toMove(); p.buf = 'light'; p.bufT = 0.4; });
  await A.waitForTimeout(1200);
  // KO: drop B to 1 hp and hit
  await B.evaluate(() => { __G.player.awake = true; __G.player.hp = 1; __G.player.invuln = 0; });
  await A.evaluate(() => { const p = __G.player, o = Opp.puppet.pos; p.pos.set(o.x, 0, o.z + 2.2); p.faceBoss(true); p.toMove(); p.buf = 'heavy'; p.bufT = 0.5; });
  await A.waitForTimeout(1500);
  for (let k = 0; k < 3; k++) { await A.evaluate(() => { const p = __G.player; if (Duel.ended) return; const o = Opp.puppet.pos; p.pos.set(o.x, 0, o.z + 2.2); p.faceBoss(true); p.buf = 'light'; p.bufT = 0.4; }); await A.waitForTimeout(700); }
  await A.waitForTimeout(4000);
  console.log('B log', await B.evaluate(()=>__log.join('\n')), 'A td calls', await A.evaluate(()=>__sent+' '+__last));
  console.log('A', await A.evaluate(() => `ended=${Duel.ended} won=${G.won} state=${G.state} end=${$('endPanel').className} title=${$('endTitle').textContent}`));
  console.log('B', await B.evaluate(() => `ended=${Duel.ended} won=${G.won} state=${G.state} end=${$('endPanel').className} title=${$('endTitle').textContent}`));
  await A.screenshot({ path: '/tmp/claude-0/shots/d_A2.png' }); await B.screenshot({ path: '/tmp/claude-0/shots/d_B2.png' });
  // leave back to solo
  await A.evaluate(() => Duel.leave());
  console.log('A after leave', await A.evaluate(() => `mode=${G.mode} bossVarukh=${G.boss === G.realBoss}`));
  console.log('ERRORS\n' + errs.filter(e => !/deprecated|GPU stall|WebGL|TUNNEL|ERR_/.test(e)).slice(0, 20).join('\n'));
  await browser.close();
})();
