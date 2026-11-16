const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/look/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/duel/dist/galeborn.html');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await p.evaluate(() => { Quality.set('high'); Quality.tick = () => {}; Perf.tick = () => {}; Perf.scale = 1; Render.resize(); });
  await p.evaluate(() => { const o = Date.now; let t = o(); while (Arena.pickFor('bot-' + t) !== 'ruins') t++; Date.now = () => t; setTimeout(() => { Date.now = o; }, 3000); });
  await p.click('#botBtn'); await p.waitForTimeout(800);
  await p.evaluate(() => Select.confirm()); await p.waitForTimeout(500);
  await p.click('[data-bot="easy"]');
  await p.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  console.log('opp', await p.evaluate(() => Duel.match.opp.hero));

  await p.waitForFunction(() => __G.state === 'fight', null, { timeout: 60000 });
  await p.evaluate(() => { const pl = __G.player; __G.lockOn = true;
    const o = pl.onDealtHit.bind(pl); pl.onDealtHit = (...a) => { o(...a); window.__hits = (window.__hits || 0) + 1; if (window.__hits >= 2) setTimeout(() => { __G.paused = true; }, 30); }; });
  await p.waitForTimeout(3000);
  for (let i = 0; i < 40 && !(await p.evaluate(() => __G.paused)); i++) { await p.keyboard.down('KeyJ'); await p.waitForTimeout(250); await p.keyboard.up('KeyJ'); await p.waitForTimeout(250); }
  console.log('paused', await p.evaluate(() => __G.paused + ' hits ' + window.__hits));
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: '#hud,#fps,#moment,#banner,#cutText,#popups{visibility:hidden !important}' });
  await p.screenshot({ path: OUT + 'before.png' });
  console.log(await p.evaluate(() => Render.scene.children.map((c, i) => { let n = 0; c.traverse(o => { if (o.geometry && o.geometry.attributes.position) n += o.geometry.attributes.position.count; }); return i + ':' + c.type + ':' + (c.name || '') + ':' + n + (c === __G.player.rig.root ? ':PLAYER' : '') + (Opp.puppet && c === Opp.puppet.rig.root ? ':OPP' : '') + (c === World.top ? ':TOP' : '') + (c === World.temple ? ':TEMPLE' : ''); }).join(' ')));
  console.log(await p.evaluate(() => JSON.stringify({ cam: Render.camera.position.toArray().map(v => +v.toFixed(2)), fov: Render.camera.fov, pl: __G.player.pos.toArray(), op: Opp.pos.toArray() })));
  console.log('ERR', errs.join('\n'));
  await b.close();
})();
