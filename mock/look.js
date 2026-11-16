const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-claude/45214761-3904-53f4-8044-d56d16cf60da/scratchpad/look/';
const only = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/duel/dist/galeborn.html');
  await p.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await p.addScriptTag({ path: 'mock/look_page.js' }); await p.addScriptTag({ path: 'mock/themes.js' });
  await p.evaluate(() => { Quality.set('high'); Quality.tick = () => {}; Perf.tick = () => {}; Perf.scale = 1; Render.resize(); });
  await p.evaluate(() => { const o = Date.now; let t = o(); while (Arena.pickFor('bot-' + t) !== 'ruins') t++; Date.now = () => t; setTimeout(() => { Date.now = o; }, 3000); });
  await p.click('#botBtn'); await p.waitForTimeout(800);
  await p.evaluate(() => Select.confirm()); await p.waitForTimeout(500);
  await p.click('[data-bot="easy"]');
  await p.waitForFunction(() => Duel.started, null, { timeout: 120000 });
  console.log('opp', await p.evaluate(() => Duel.match.opp.hero));
  await p.waitForFunction(() => __G.state === 'fight', null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { __G.lockOn = true; MK.snapshot(); const pl = __G.player, o = pl.onDealtHit.bind(pl);
    pl.onDealtHit = (...a) => { o(...a); if (!window.__hit) { window.__hit = 1; setTimeout(() => { __G.paused = true; }, 40); } }; });
  for (let i = 0; i < 60 && !(await p.evaluate(() => __G.paused)); i++) { await p.keyboard.down('KeyJ'); await p.waitForTimeout(220); await p.keyboard.up('KeyJ'); await p.waitForTimeout(220); }
  console.log('frozen', await p.evaluate(() => __G.paused + ' d=' + Math.hypot(__G.player.pos.x - Opp.pos.x, __G.player.pos.z - Opp.pos.z).toFixed(2)));
  await p.addStyleTag({ content: '#hud,#fps,#moment,#banner,#cutText,#popups,#speedLines,#heat,#endPanel,.panel{visibility:hidden !important}' });
  await p.waitForTimeout(2500);
  const shot = async n => { await p.waitForTimeout(2200); await p.screenshot({ path: OUT + n + '.png' }); console.log('shot', n); };
  await shot('0_before');
  await p.evaluate(() => { MK.lockCam(); MK.camNew(); });
  await shot('1_scale');
  for (const t of ['sunset', 'storm', 'snow']) {
    if (only && only !== t) continue;
    await p.evaluate(t => { MK.restore(); FX.clear(); MK.hideWorld(false); THEMES[t](); MK.camNew(); MK.bigImpact(0x3df2ff, 0xff5a2a); }, t);
    await shot('2_' + t);
    await p.evaluate(() => MK.camWide()); await shot('3_' + t + '_wide');
  }
  console.log('ERR', errs.join('\n'));
  await b.close();
})();
