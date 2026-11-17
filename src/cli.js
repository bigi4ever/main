#!/usr/bin/env node
// Game Forge: שורת פקודה.
//   node src/cli.js                 -> מחליט לבד ובונה משחק אחד
//   node src/cli.js --count 5       -> בונה 5 משחקים שונים
//   node src/cli.js --trends        -> מציג את דירוג הז'אנרים ואת סיכויי הבחירה
//   node src/cli.js --genre runner --theme space --difficulty hard --seed 42
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, writeGame, readManifest, loadGenres, genreWeight } from './forge.js';
import { THEMES } from './themes.js';
import { TRENDS_UPDATED } from './trends.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const has = name => args.includes('--' + name);
const outDir = path.resolve(opt('out', path.join(ROOT, 'games')));

if (has('help') || has('h')) {
  console.log(`Game Forge: מחולל משחקים אוטומטי

שימוש:
  node src/cli.js [--count N] [--genre ID] [--theme ID] [--difficulty easy|normal|hard] [--seed S] [--out DIR]
  node src/cli.js --trends

ז'אנרים: ${loadGenres().map(g => g.id).join(', ')}
נושאים:  ${THEMES.map(t => t.id).join(', ')}`);
  process.exit(0);
}

const made = readManifest(outDir);

if (has('trends')) {
  const gs = loadGenres(), total = gs.reduce((a, g) => a + genreWeight(g, made), 0);
  console.log(`\n📈 דירוג ז'אנרים (עודכן: ${TRENDS_UPDATED})\n`);
  for (const g of gs) {
    const n = made.filter(m => m.genre === g.id).length;
    const bar = '█'.repeat(Math.round(g.score / 5));
    console.log(`${g.id.padEnd(12)} ${String(g.score).padStart(3)} ${bar.padEnd(20)} נוצרו: ${n}  סיכוי הבא: ${Math.round(genreWeight(g, made) / total * 100)}%`);
    console.log(`${' '.repeat(17)}${g.name}: ${g.why}\n`);
  }
  process.exit(0);
}

const count = Math.max(1, parseInt(opt('count', '1'), 10) || 1);
const baseSeed = opt('seed', String(Date.now()));
for (let i = 0; i < count; i++) {
  const p = plan({
    seed: count > 1 ? `${baseSeed}-${i}` : baseSeed,
    genre: opt('genre'), theme: opt('theme'), difficulty: opt('difficulty'), made,
  });
  const file = writeGame(p, outDir);
  made.push(p);
  console.log(`\n🎮 ${p.title}  ${p.icon}`);
  console.log(`   ז'אנר: ${p.genreName} · נושא: ${p.themeName} · קושי: ${p.difficultyName} · seed: ${p.seed}`);
  console.log(`   🧠 למה: ${p.reason}`);
  console.log(`   📁 ${path.relative(process.cwd(), file)}`);
}
console.log(`\n🗂  גלריה: ${path.relative(process.cwd(), path.join(outDir, 'index.html'))}\n`);
