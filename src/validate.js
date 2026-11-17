// בודק אוטומטי למשחק: בדיקת תחביר, ובדפדפן אמיתי (Playwright) משחק אקראי ואיסוף שגיאות ואותות.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const RESERVED = 'CFG T P S cv ctx W H DPR G keys rand randi pick clamp dist fmt store AC muted beep emojiCache drawEmoji roundRect fx burst floatText updFx drawFx $ov $card $hudR $hudL hud showCard hideCard menu startGame gameOver fit ptr last loop'.split(' ');

// בדיקה סטטית מהירה: תחביר, הגדרת game, והתנגשות עם שמות של זמן הריצה
export function staticCheck(code) {
  const errors = [];
  try { new vm.Script(`"use strict";\n${code}`); } catch (e) { errors.push(`SyntaxError: ${e.message}`); }
  if (!/\b(const|let|var)\s+game\s*=/.test(code)) errors.push('The code must define a top-level `const game = {...}`.');
  for (const m of code.matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (RESERVED.includes(m[1])) errors.push(`Top-level name \`${m[1]}\` redeclares a runtime global. Rename it.`);
  }
  for (const m of code.matchAll(/^(?:const|let|var)\s+([^=;]+?)\s*[=;]/gm)) {
    for (const n of m[1].split(',').map(s => s.trim().split(/[\s=]/)[0])) {
      if (RESERVED.includes(n)) errors.push(`Top-level name \`${n}\` redeclares a runtime global. Rename it.`);
    }
  }
  return [...new Set(errors)];
}

export function loadPlaywright() {
  for (const base of [import.meta.url, path.join(process.cwd(), 'x.js')]) {
    try { return createRequire(base)('playwright'); } catch {}
  }
  return null;
}

/**
 * משחק במשחק בדפדפן עם קלט אקראי. מחזיר שגיאות ואותות על ההתנהגות.
 * @returns {Promise<{available:boolean, errors:string[], warnings:string[], stats:object}>}
 */
export async function playtest(html, { seconds = 8 } = {}) {
  const pw = loadPlaywright();
  if (!pw) return { available: false, errors: [], warnings: ['Playwright לא מותקן, דילגתי על בדיקה בדפדפן'], stats: {} };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-play-'));
  const file = path.join(dir, 'game.html');
  fs.writeFileSync(file, html);
  const browser = await pw.chromium.launch();
  const errors = [], warnings = [];
  const stats = { maxScore: 0, gameOvers: 0, rounds: 0, blankFrames: 0, samples: 0 };
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 760 }, hasTouch: false });
    page.on('pageerror', e => errors.push(`Uncaught ${e.name || 'Error'}: ${e.message}${e.stack ? '\n' + e.stack.split('\n').slice(1, 4).join('\n') : ''}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    await page.goto('file://' + file);
    await page.waitForTimeout(400);
    const shape = await page.evaluate(() => {
      try { return { ok: typeof game === 'object', reset: typeof game.reset, update: typeof game.update, draw: typeof game.draw }; }
      catch (e) { return { ok: false, err: String(e) }; }
    });
    if (!shape.ok) errors.push('Global `game` object is missing.');
    else for (const f of ['reset', 'update', 'draw']) if (shape[f] !== 'function') errors.push(`game.${f} must be a function.`);
    if (errors.length) return { available: true, errors, warnings, stats };

    const end = Date.now() + seconds * 1000;
    let lastState = '';
    while (Date.now() < end) {
      const st = await page.evaluate(() => ({ state: G.state, score: G.score }));
      if (st.state !== lastState) { if (st.state === 'play') stats.rounds++; if (st.state === 'over') stats.gameOvers++; lastState = st.state; }
      if (typeof st.score === 'number') stats.maxScore = Math.max(stats.maxScore, st.score);
      const btn = await page.$('#ov:not(.hidden) .btn, #ov:not(.hidden) .choice');
      if (btn) { await btn.click().catch(() => {}); await page.waitForTimeout(80); continue; }
      const r = Math.random();
      const x = 20 + Math.random() * 350, y = 70 + Math.random() * 670;
      if (r < 0.45) await page.mouse.click(x, y);
      else if (r < 0.8) {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + rand(-120, 120), y + rand(-120, 120), { steps: 4 });
        await page.mouse.up();
      } else await page.keyboard.press(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'][Math.floor(Math.random() * 6)]);
      await page.waitForTimeout(60);
      if (Math.random() < 0.15) {
        stats.samples++;
        const blank = await page.evaluate(() => {
          const c = document.getElementById('c'), g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data, seen = new Set();
          for (let i = 0; i < d.length; i += 4 * 997) seen.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]);
          return seen.size < 3;
        });
        if (blank) stats.blankFrames++;
      }
    }
    if (stats.samples && stats.blankFrames === stats.samples) errors.push('The canvas looks blank (one flat colour) during play: draw() is not drawing the game.');
    if (stats.maxScore === 0) warnings.push('G.score never went above 0 during ~' + seconds + 's of random play.');
    if (stats.gameOvers === 0) warnings.push('No round ended (gameOver never called) during random play. Check that losing is possible.');
  } finally {
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { available: true, errors: [...new Set(errors)].slice(0, 12), warnings, stats };
}

function rand(a, b) { return a + Math.random() * (b - a); }
