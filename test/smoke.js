// בדיקת עשן: בונה משחק מכל ז'אנר, פותח בדפדפן, משחק כמה שניות ובודק שאין שגיאות.
// דורש playwright (npm i -D playwright, או גרסה מותקנת גלובלית).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { plan, build, loadGenres } from '../src/forge.js';
import { THEMES } from '../src/themes.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-smoke-'));
const shots = process.env.SHOTS;
const browser = await chromium.launch();
let failed = 0;

for (const g of loadGenres()) {
  for (const theme of [THEMES[0].id, THEMES[3].id]) {
    const p = plan({ seed: `smoke-${g.id}-${theme}`, genre: g.id, theme });
    const file = path.join(out, p.slug + '.html');
    fs.writeFileSync(file, build(p));
    const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('file://' + file);
    await page.waitForTimeout(300);
    const play = await page.$('#play');
    if (play) await play.click();
    // קלט אקראי: לחיצות, גרירות ומקשים
    for (let i = 0; i < 40; i++) {
      const x = 40 + Math.random() * 340, y = 120 + Math.random() * 640;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + Math.random() * 80 - 40, y - Math.random() * 300, { steps: 3 });
      await page.mouse.up();
      await page.keyboard.press(['Space', 'ArrowLeft', 'ArrowUp'][i % 3]);
      const choice = await page.$('#ov:not(.hidden) .choice'); if (choice) await choice.click();
      const again = await page.$('#ov:not(.hidden) #again'); if (again && i < 30) await again.click();
      await page.waitForTimeout(60);
    }
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, p.slug + '.png') }); }
    const ok = errors.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? '✅' : '❌'} ${g.id.padEnd(12)} ${theme.padEnd(8)} ${p.title}${ok ? '' : '\n   ' + errors.join('\n   ')}`);
    await page.close();
  }
}
await browser.close();
fs.rmSync(out, { recursive: true, force: true });
if (failed) { console.log(`\n${failed} כשלונות`); process.exit(1); }
console.log('\nכל המשחקים עלו ורצו בלי שגיאות.');
