// בדיקות לוגיקה: כל לוח חצים פתיר, ובוט שמשחק Match-3 (שלבים, קומבו, פריטים מיוחדים).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { plan, build } from '../src/forge.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-logic-')) + '/';
const b = await chromium.launch();
const errs = [];
// arrows
{
  const f = dir + 'a.html'; fs.writeFileSync(f, build(plan({ seed: 'x', genre: 'arrows', theme: 'fantasy' })));
  const p = await b.newPage({ viewport: { width: 420, height: 800 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + f); await p.click('#play');
  const r = await p.evaluate(() => {
    let bad = 0, total = 0, startFree = 0;
    for (let k = 0; k < 300; k++) {
      const n = 4 + (k % 6), g = generate(n, 0.75); N = n; board = g; total += g.filter(v => v !== -1).length;
      startFree += board.filter((d, i) => d !== -1 && blocker(i) === -1).length;
      let progress = true;
      while (progress) { progress = false; for (let i = 0; i < n * n; i++) if (board[i] !== -1 && blocker(i) === -1) { board[i] = -1; progress = true; } }
      if (board.some(v => v !== -1)) bad++;
    }
    return { bad, avgArrows: total / 300, avgFreeAtStart: startFree / 300 };
  });
  console.log('arrows', r);
  if (r.bad) { console.log('❌ נמצאו לוחות חצים לא פתירים'); process.exit(1); }
  // play a real level through clicks
  await p.evaluate(() => newLevel());
  for (let s = 0; s < 200; s++) {
    const pos = await p.evaluate(() => { const i = board.findIndex((d, i) => d !== -1 && blocker(i) === -1); return i < 0 ? null : [bx + (i % N + 0.5) * cs, by + (((i / N) | 0) + 0.5) * cs, level]; });
    if (!pos) break; await p.mouse.click(pos[0], pos[1]);
  }
  await p.waitForTimeout(1200);
  console.log('arrows after solving lvl1 -> level', await p.evaluate(() => [level, G.score, hearts]));
}
// match3
{
  const f = dir + 'm.html'; fs.writeFileSync(f, build(plan({ seed: 'y', genre: 'match3', theme: 'ocean' })));
  const p = await b.newPage({ viewport: { width: 420, height: 800 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + f); await p.click('#play'); await p.waitForTimeout(800);
  let made = 0;
  for (let m = 0; m < 90; m++) {
    await p.waitForFunction(() => phase === 'idle' && settled() || G.state !== 'play', null, { timeout: 8000 });
    const st = await p.evaluate(() => G.state);
    if (st === 'pause') { console.log('  level up', await p.evaluate(() => [level, G.score, moves])); await p.click('#cont'); continue; }
    if (st === 'over') { console.log('  game over', await p.evaluate(() => [level, G.score])); await p.waitForSelector('#again'); await p.click('#again'); continue; }
    const mv = await p.evaluate(() => {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (!inB(x + dx, y + dy)) continue;
        if (grid[y][x].sp === 'bomb') return [x, y, dx, dy];
        swapCells([x, y], [x + dx, y + dy]); const ok = runs().length; swapCells([x, y], [x + dx, y + dy]);
        if (ok) return [x, y, dx, dy];
      }
      return null;
    });
    if (!mv) { console.log('no move found'); break; }
    const [x, y, dx, dy] = mv;
    const c = await p.evaluate(([x, y]) => [bx + (x + .5) * cs, by + (y + .5) * cs, cs], [x, y]);
    await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + dx * c[2], c[1] + dy * c[2], { steps: 4 }); await p.mouse.up();
    made++;
  }
  await p.waitForTimeout(600);
  console.log('match3', made, 'moves ->', await p.evaluate(() => ({ score: G.score, level, moves, state: G.state, specials: grid.flat().filter(c => c.sp).map(c => c.sp) })));
}
if (errs.length) { console.log('❌ שגיאות:', errs); process.exit(1); }
await b.close();
console.log('✅ בדיקות הלוגיקה עברו');
