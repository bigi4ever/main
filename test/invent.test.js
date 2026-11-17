// בדיקת קצה-לקצה לצינור ההמצאה, עם לקוח API מדומה (בלי רשת ובלי מפתח).
// בודק: עיצוב -> קוד שבור סטטית -> קוד שקורס בדפדפן -> קוד תקין -> סקירה ששוברת (חוזרים לגרסה הטובה)
// -> שמירה לספרייה -> המחולל רואה את ההמצאה ובונה ממנה משחק עם נושא.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { invent, saveInvention, INV_DIR } from '../src/invent.js';
import { plan, build, loadGenres } from '../src/forge.js';
import { playtest, loadPlaywright, staticCheck } from '../src/validate.js';
import { THEMES } from '../src/themes.js';

const design = {
  id: 'Test Catch!', name: 'תפיסה בדיקה', pitch: 'בדיקה.', rules: 'לוחצים על פריטים נופלים.', novelty: 'אין', inspiration: 'אין',
  controls: 'tap', howto: 'הצילו את {thing} {in_place}', titles: ['תפיסה {in_place}'], icon: 'pickup', appeal: 120,
  params: [{ key: 'speed', value: 120, harder: 'higher', description: 'מהירות' }, { key: 'bad key!', value: 1, harder: 'none', description: 'x' }],
};
const GOOD = `
let items, missed, spawnT, t;
const game = {
  reset() { items = []; missed = 0; spawnT = 0; t = 0; },
  down(x, y) {
    for (let i = items.length - 1; i >= 0; i--) {
      if (dist(x, y, items[i].x, items[i].y) < 34) { burst(items[i].x, items[i].y, P.accent); floatText(items[i].x, items[i].y, '+1'); items.splice(i, 1); G.score++; beep(700); return; }
    }
  },
  update(dt) {
    t += dt; spawnT -= dt;
    if (spawnT <= 0) { items.push({ x: rand(40, W - 40), y: 40, e: pick(T.enemies) }); spawnT = 0.5; }
    for (const it of items) it.y += S.speed * (1 + t / 20) * dt;
    for (let i = items.length - 1; i >= 0; i--) if (items[i].y > H - 20) { items.splice(i, 1); if (++missed >= 3) { gameOver(G.score, 'פספסת 3'); return; } }
  },
  draw() {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (!items) return;
    ctx.fillStyle = P.grid; ctx.fillRect(0, H - 20, W, 20);
    for (const it of items) drawEmoji(it.e, it.x, it.y, 40);
    drawFx();
    hud('⭐ ' + G.score, '❌ ' + missed);
  },
};`;
const CLASH = GOOD.replace('let items,', 'let W, items,');
const CRASH = GOOD.replace('t += dt;', 't += dt; notDefinedAnywhere();');

const msg = (obj, extra = {}) => ({ stop_reason: 'end_turn', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(obj) }], ...extra });
const hasPW = !!loadPlaywright();
const script = [
  msg(design),
  msg({ code: CLASH, notes: 'v1' }),
  ...(hasPW ? [msg({ code: CRASH, notes: 'v2' })] : []),
  msg({ code: GOOD, notes: 'v3' }),
  msg({ issues: ['בעיה מדומה'], changed: true, code: GOOD + '\nthis is not javascript' }),
];
const calls = [];
const client = { beta: { messages: { stream: req => { calls.push(structuredClone(req)); const r = script.shift(); return { finalMessage: async () => r }; } } } };

const theme = THEMES[2];
const buildHtml = (d, code) => build({ slug: 'inv-test', title: d.name, icon: '💡', howto: d.howto, genreName: d.name, template: 'inv:' + d.id, code, themeObj: theme, params: { speed: 120 } });
const logs = [];
const r = await invent({ genres: loadGenres(), buildHtml, client, emerging: [{ name: 'חם', mechanic: 'm', why: 'w' }], idea: 'משהו עם כבידה', log: m => logs.push(m) });

// עיצוב
assert.equal(r.design.id, 'test-catch', 'מזהה מנורמל');
assert.deepEqual(r.design.params.map(p => p.key), ['speed'], 'מפתח לא חוקי סונן');
assert.match(calls[0].messages[0].content, /משהו עם כבידה/);
assert.match(calls[0].messages[0].content, /חם: m/);
assert.equal(calls[0].system[0].cache_control.type, 'ephemeral', 'ה-system נשמר במטמון');
assert.equal(calls[0].output_config.format.type, 'json_schema');
assert.equal(calls[0].fallbacks, 'default');
// סבבי תיקון
assert.equal(r.rounds, hasPW ? 2 : 1);
const fix1 = calls[2].messages;
assert.equal(fix1.at(-2).role, 'assistant', 'תשובת המודל נשלחת בחזרה במלואה');
assert.equal(fix1.at(-2).content[0].type, 'thinking');
assert.match(fix1.at(-1).content, /redeclares a runtime global/);
if (hasPW) assert.match(calls[3].messages.at(-1).content, /notDefinedAnywhere/, 'שגיאת הדפדפן הגיעה ל-Claude');
// סקירה ששברה את הקוד -> נשארים עם הגרסה הטובה
assert.equal(r.code, GOOD);
assert.ok(logs.some(l => l.includes('שבר')));
assert.deepEqual(staticCheck(r.code), []);
if (hasPW) assert.ok(r.test.stats.maxScore >= 0 && r.test.available);

// שמירה, ושילוב במחולל
const dir = saveInvention(r.design, r.code, { fixRounds: r.rounds });
try {
  const g = loadGenres().find(x => x.id === 'x-test-catch');
  assert.ok(g, 'ההמצאה מופיעה כז\'אנר');
  assert.equal(g.score, 85, 'ציון המצאה מוגבל ל-85');
  const p = plan({ seed: 's', genre: 'x-test-catch', theme: 'space', difficulty: 'hard' });
  assert.equal(p.title, 'תפיסה בחלל');
  assert.equal(p.howto, 'הצילו את הכוכבים בחלל');
  assert.equal(p.icon, '⭐');
  assert.ok(Math.abs(p.params.speed - 120 * 1.22) < 1e-9, 'פרמטר הוקשה לפי רמת הקושי');
  const html = build(p);
  assert.ok(html.includes('notes') === false && html.includes('תפיסה בחלל'));
  if (hasPW) {
    const t = await playtest(html, { seconds: 4 });
    assert.deepEqual(t.errors, [], 'המשחק הבנוי רץ בלי שגיאות');
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
assert.ok(!fs.existsSync(path.join(INV_DIR, 'test-catch')));
console.log(`✅ invent: צינור ההמצאה עבר (${calls.length} קריאות מדומות, ${r.rounds} סבבי תיקון${hasPW ? ', כולל דפדפן' : ''})`);
