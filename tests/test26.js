const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file:///home/claude/duel/dist/galeborn.html');
  await page.waitForFunction(() => window.__G && __G.player.rig.model, null, { timeout: 90000 });
  await page.evaluate(() => { Quality.set('low'); __G.beginFight(); });
  await page.waitForFunction(() => G.state === 'fight', null, { timeout: 30000 });
  await page.evaluate(() => { const b = __G.boss; b.cool = 999; b.update = (function (u) { return function (dt) { this.cool = 999; return u.call(this, dt); }; })(b.update);
    window.__dn = []; const o = FX.dmgNumber; FX.dmgNumber = function (w, n, k, l) { __dn.push(n + (k ? '/' + k : '') + (l ? '/' + l : '')); return o.apply(FX, arguments); };
    // drive inputs by simulated presses on a game-time schedule
    window.__press = (mode) => { const p = __G.player; window.__mode = mode; window.__lastSt = -1; };
    const orig = __G.player.update.bind(__G.player);
    __G.player.update = function (dt, a) {
      const p = this; if (window.__mode && p.alive) {
        if (window.__mode === 'mash') { window.__acc = (window.__acc || 0) + dt; if (window.__acc > 0.05) { window.__acc = 0; p.bufferInputs({ light: true }); } }
        if (window.__mode === 'rhythm') { if (p.state === 'move' && p.buf !== 'light') p.bufferInputs({ light: true }); else if (p.state === 'attack' && p.moveHit && !p.__pressed) { p.__pressed = p.move; p.bufferInputs({ light: true }); } if (p.state === 'attack' && p.__pressed && p.__pressed !== p.move) p.__pressed = null; }
      }
      return orig(dt, a);
    };
  });
  const run = async (mode, ms) => {
    await page.evaluate(m => { const b = __G.boss, p = __G.player; p.toMove(); p.pos.set(b.pos.x, 0, b.pos.z + 2.6); p.faceBoss(true); window.__dn = []; Tempo.reset(); window.__h0 = b.hp; window.__t0 = G.time; window.__mode = m; }, mode);
    await page.waitForTimeout(ms);
    return page.evaluate(() => { window.__mode = null; return `dmg=${Math.round(__h0 - __G.boss.hp)} gameT=${(G.time - __t0).toFixed(1)} hits=${__dn.length} :: ${__dn.join(' ')}`; });
  };
  console.log('MASH  ', await run('mash', 9000));
  await page.waitForTimeout(1500);
  console.log('RHYTHM', await run('rhythm', 9000));
  // whiff: swing at air near boss but out of reach
  const w = await page.evaluate(() => new Promise(r => { const b = __G.boss, p = __G.player; p.toMove(); p.pos.set(b.pos.x + 5, 0, b.pos.z); p.yaw = 0; p.startAttack(p.ms.light[0], false, new THREE.Vector3(), false); p.lungeV = 0; const t0 = G.time; const iv = setInterval(() => { if (p.state !== 'attack') { clearInterval(iv); r('whiff attack lasted ' + (G.time - t0).toFixed(2) + ' (dur ' + p.ms.light[0].dur + ')'); } }, 20); }));
  console.log(w);
  console.log('ERR', errs.join('\n')); await b.close();
})();
