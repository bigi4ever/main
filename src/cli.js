#!/usr/bin/env node
// Game Forge: שורת פקודה.
//   node src/cli.js                 -> מחליט לבד ובונה משחק אחד
//   node src/cli.js --count 5       -> בונה 5 משחקים שונים
//   node src/cli.js --trends        -> מציג את דירוג הז'אנרים ואת סיכויי הבחירה
//   node src/cli.js --refresh-trends -> מחקר טרנדים חי עם Claude וחיפוש ברשת
//   node src/cli.js --live --count 3 -> מרענן טרנדים אם עברו יותר מ-7 ימים, ואז בונה
//   node src/cli.js --invent [--idea "..."] -> ה-AI ממציא מכניקה חדשה, כותב, בודק ושומר אותה כתבנית
//   node src/cli.js --genre runner --theme space --difficulty hard --seed 42
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, build, writeGame, readManifest, loadGenres, genreWeight } from './forge.js';
import { invent, saveInvention, listInventions } from './invent.js';
import { THEMES } from './themes.js';
import { TRENDS_UPDATED, GENRES } from './trends.js';
import { researchTrends, saveLive, readLive, liveAgeDays, explainError, MAX_AGE_DAYS } from './live-trends.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const has = name => args.includes('--' + name);
const outDir = path.resolve(opt('out', path.join(ROOT, 'games')));

if (has('help') || has('h')) {
  console.log(`Game Forge: מחולל משחקים אוטומטי

שימוש:
  node src/cli.js [--count N] [--genre ID] [--theme ID] [--difficulty easy|normal|hard] [--seed S] [--out DIR]
  node src/cli.js --trends              דירוג הז'אנרים הנוכחי
  node src/cli.js --refresh-trends      מחקר טרנדים חי (דורש ANTHROPIC_API_KEY)
  node src/cli.js --invent [--idea "כיוון"]   ה-AI ממציא מכניקה חדשה (דורש ANTHROPIC_API_KEY)
  node src/cli.js --inventions          רשימת ההמצאות בספרייה
  node src/cli.js --live [...]          מרענן טרנדים אם הם ישנים מ-${MAX_AGE_DAYS} ימים, ואז בונה

ז'אנרים: ${loadGenres().map(g => g.id).join(', ')}
נושאים:  ${THEMES.map(t => t.id).join(', ')}`);
  process.exit(0);
}

const made = readManifest(outDir);

async function refresh() {
  try {
    const live = await researchTrends({ genres: GENRES, log: m => console.log(m) });
    saveLive(live);
    console.log(`✅ הטרנדים עודכנו (${live.sources.length} מקורות). ${live.summary}`);
    return true;
  } catch (e) {
    console.error(`⚠️  מחקר הטרנדים נכשל: ${explainError(e)}`);
    return false;
  }
}

if (has('refresh-trends')) {
  if (!(await refresh())) process.exit(1);
  args.push('--trends');
} else if (has('live')) {
  const age = liveAgeDays();
  if (age > MAX_AGE_DAYS) {
    console.log(age === Infinity ? '🌐 אין עדיין מחקר חי, מריץ עכשיו…' : `🌐 המחקר האחרון בן ${Math.floor(age)} ימים, מרענן…`);
    if (!(await refresh())) console.log('   ממשיך עם הציונים הקיימים.');
  } else console.log(`🌐 משתמש במחקר חי מלפני ${age < 1 ? 'פחות מיום' : Math.floor(age) + ' ימים'}.`);
}

if (has('inventions')) {
  const inv = listInventions();
  if (!inv.length) console.log('אין עדיין המצאות. הריצו: node src/cli.js --invent');
  for (const d of inv) console.log(`\n💡 ${d.name} (x-${d.id}) · משיכה ${d.appeal}/100 · ${d.created?.slice(0, 10) ?? ''}\n   ${d.pitch}\n   חדשנות: ${d.novelty}`);
  console.log('');
  process.exit(0);
}

if (has('invent')) {
  const genres = loadGenres().filter(g => !g.invention);
  const theme = THEMES.find(t => t.id === opt('theme')) || THEMES[Math.floor(Math.random() * THEMES.length)];
  const buildHtml = (design, code) => build({
    slug: 'invention-test', title: design.name, icon: '💡', howto: design.howto, genreName: design.name,
    template: 'inv:' + design.id, code, themeObj: theme, params: Object.fromEntries(design.params.map(p => [p.key, p.value])),
  });
  try {
    const r = await invent({ genres, buildHtml, emerging: readLive()?.emerging, idea: opt('idea', ''), log: m => console.log(m) });
    const dir = saveInvention(r.design, r.code, { fixRounds: r.rounds, reviewIssues: r.review.issues, playtest: r.test.stats, browserTested: r.test.available });
    console.log(`\n✅ הומצא: ${r.design.name}\n   ${r.design.pitch}\n   חוקים: ${r.design.rules}\n   חדשנות: ${r.design.novelty}\n   📁 ${path.relative(process.cwd(), dir)}`);
    const p = plan({ seed: opt('seed', String(Date.now())), genre: 'x-' + r.design.id, theme: theme.id, made });
    const file = writeGame(p, outDir);
    console.log(`\n🎮 ${p.title} ${p.icon}\n   📁 ${path.relative(process.cwd(), file)}\n   מעכשיו המחולל יכול לבחור בהמצאה הזו עם כל נושא.\n`);
    process.exit(0);
  } catch (e) {
    console.error(`\n⚠️  ההמצאה נכשלה: ${explainError(e)}`);
    if (e.partial) {
      const dir = path.join(ROOT, '.inventions-failed', e.partial.design.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'game.js'), e.partial.code);
      fs.writeFileSync(path.join(dir, 'design.json'), JSON.stringify({ ...e.partial.design, errors: e.partial.test.errors }, null, 2));
      console.error(`   הטיוטה נשמרה לבדיקה ב-${path.relative(process.cwd(), dir)}`);
    }
    process.exit(1);
  }
}

if (has('trends')) {
  const gs = loadGenres(), total = gs.reduce((a, g) => a + genreWeight(g, made), 0);
  const live = readLive();
  const arrow = { rising: '↗', stable: '→', falling: '↘' };
  console.log(live
    ? `\n📈 דירוג ז'אנרים: מחקר חי מ-${live.updated.slice(0, 10)}\n   ${live.summary}\n`
    : `\n📈 דירוג ז'אנרים: ציוני בסיס (${TRENDS_UPDATED}). להרצת מחקר חי: --refresh-trends\n`);
  for (const g of gs) {
    const n = made.filter(m => m.genre === g.id).length;
    const bar = '█'.repeat(Math.round(g.score / 5));
    console.log(`${g.id.padEnd(12)} ${String(g.score).padStart(3)} ${(arrow[g.trend] || ' ')} ${bar.padEnd(20)} נוצרו: ${n}  סיכוי הבא: ${Math.round(genreWeight(g, made) / total * 100)}%  [${g.source}]`);
    console.log(`${' '.repeat(17)}${g.name}: ${g.evidence || g.why}\n`);
  }
  if (live?.emerging?.length) {
    console.log("💡 ז'אנרים חמים שעוד אין להם תבנית:");
    for (const e of live.emerging) console.log(`   • ${e.name}: ${e.mechanic} (${e.why})`);
    console.log('');
  }
  if (live?.sources?.length) {
    console.log('🔗 מקורות:');
    for (const s of live.sources.slice(0, 8)) console.log(`   ${s.title}: ${s.url}`);
    console.log('');
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
