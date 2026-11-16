const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); p.on('pageerror', e => console.log('PE', e.message)); p.on('console', m => console.log('C', m.text()));
  const files = process.argv.slice(3);
  await p.goto('file:///home/claude/duel/mock/preview.html'); const fs = require('fs'); await p.evaluate(([f, b]) => window.go(f, b), [files, files.map(f => fs.readFileSync(f).toString('base64'))]);
  await p.waitForFunction(n => window.done === n, files.length, { timeout: 120000 });
  await p.waitForTimeout(1500); console.log(await p.evaluate(() => window.info));
  await p.screenshot({ path: process.argv[2] }); await b.close();
})();
