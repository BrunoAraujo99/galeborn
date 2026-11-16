// Frame-stepped clip capture: fixed 60 Hz game clock, a PNG every 2nd frame (30 fps video).
// usage: node clip/capture.js <html> <outdir> [hero] [opp]
const { chromium } = require('playwright');
const [html, out, hero = 'wind', opp = 'earth'] = process.argv.slice(2);
require('fs').mkdirSync(out, { recursive: true });
const INIT = () => {
  if (location.hash === '#bot') return;
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window);
  let manual = false, fake = 0, q = [];
  performance.now = () => manual ? fake : realNow();
  window.requestAnimationFrame = cb => { if (manual) { q.push(cb); return 1; } return realRAF(t => cb(manual ? fake : t)); };
  window.__manual = () => { fake = realNow(); manual = true; };
  const tick = () => new Promise(r => setTimeout(r, 0));
  window.__step = async (keys) => {
    for (const k of keys || []) Input.kp.add(k);
    fake += 1000 / 60; const cbs = q; q = []; for (const cb of cbs) cb(fake);
    await tick(); await new Promise(r => realRAF(() => r())); await tick(); await new Promise(r => realRAF(() => r())); await tick();
  };
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.addInitScript(INIT);
  await page.goto('file://' + html);
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 120000 });
  await page.evaluate(() => { Quality.set('high'); Quality.tick = () => {}; Settings.v.drs = false; Perf.scale = 1; Render.resize(); });
  await page.waitForTimeout(3000);
  await page.evaluate(([hero, opp]) => { if (hero !== 'wind') Hero.apply(hero); startBotMatch('dummy', opp); }, [hero, opp]);
  await page.waitForFunction(() => Duel.started && __G.state === 'fight' && Opp.puppet && Opp.puppet.snaps.length > 4, null, { timeout: 180000 });
  await page.addStyleTag({ content: '#endPanel,#trainBox{display:none !important}' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { Arena.set('ruins'); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    __manual();
    const p = __G.player, o = Opp.pos; const d = new THREE.Vector3(o.x, 0, o.z).normalize(); // stand on the outer side so the launch flies across open floor
    p.pos.set(o.x + d.x * 2.4, 0, o.z + d.z * 2.4); p.yaw = Math.atan2(-d.x, -d.z); __G.lockOn = true;
  });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) if (el.children.length === 0 && /lightning strikes|mind the edge|blizzard|ride them|pillars stand|no hazards/.test(el.textContent)) { el.style.visibility = 'hidden'; if (el.parentElement && el.parentElement.children.length < 3) el.parentElement.style.visibility = 'hidden'; }
    // fixed 3/4 spectator camera, same for before and after: frames both fighters side-on
    const cam = Render.camera; let mid = null;
    Cam.update = function (dt) {
      const p = __G.player.pos, o = Opp.pos, m = new THREE.Vector3((p.x + o.x) / 2, 0, (p.z + o.z) / 2);
      mid = mid ? mid.lerp(m, Math.min(1, dt * 4)) : m;
      const d = new THREE.Vector3(o.x - p.x, 0, o.z - p.z).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
      cam.position.copy(mid).addScaledVector(d, -1.6).addScaledVector(r, 6.4).setY(1.9);
      cam.lookAt(mid.x, 1.15, mid.z);
      this.applyShake(dt, cam);
    };
  });
  // warm-up so the camera settles
  for (let i = 0; i < 40; i++) await page.evaluate(() => __step());
  const SCRIPT = { 6: ['KeyJ'], 24: ['KeyJ'], 42: ['KeyJ'], 62: ['KeyJ'] }, HOLD = [56, 68];
  const N = +(process.env.N || 300); let shot = 0;
  for (let f = 0; f < N; f++) {
    if (f === HOLD[0]) await page.evaluate(() => { Input.keys.KeyS = true; });
    if (f === HOLD[1]) await page.evaluate(() => { Input.keys.KeyS = false; });
    await page.evaluate(k => __step(k), SCRIPT[f] || []);
    if (f % 30 === 0) console.log(f, await page.evaluate(() => Opp.hp + ' ' + Opp.puppet.state + ' p=' + __G.player.state + ' snaps=' + Opp.puppet.snaps.length + ' age=' + Math.round(performance.now() - Opp.puppet.snaps[Opp.puppet.snaps.length - 1].rt) + ' lag=' + Math.round(Opp.puppet.lag || 0) + ' d=' + Math.hypot(__G.player.pos.x - Opp.pos.x, __G.player.pos.z - Opp.pos.z).toFixed(1)));
    if (f % 2 === 0 && !process.env.NOSHOT) await page.screenshot({ path: `${out}/f${String(shot++).padStart(4, '0')}.png` });
  }
  console.log('frames', shot, 'oppHp', await page.evaluate(() => Opp.hp + ' arena ' + Arena.id), 'ERR', errs.slice(0, 5).join('\n'));
  await b.close();
})();
