// ממציא מכניקות: Claude מעצב מכניקת משחק חדשה, כותב את הקוד, בודק אותו בדפדפן ומתקן,
// עובר סקירת קוד מול העיצוב, ושומר את ההמצאה כתבנית חדשה בספרייה.
//
// 1. עיצוב   - סיעור מוחות פנימי של כמה רעיונות ובחירת הטוב ביותר (מסמך עיצוב במבנה קבוע)
// 2. קוד     - כתיבת game.js מול ה-API של זמן הריצה (RUNTIME.md + תבנית לדוגמה)
// 3. בדיקה   - בדיקה סטטית + משחק אקראי בדפדפן; שגיאות חוזרות ל-Claude לתיקון
// 4. סקירה   - Claude בודק את הקוד מול העיצוב (אפשר להפסיד? הניקוד עולה? מתאים לנייד?) ומתקן
// 5. שמירה   - src/inventions/<id>/{design.json, game.js}; מכאן המחולל יכול לבחור בה עם כל נושא
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { staticCheck, playtest } from './validate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const INV_DIR = path.join(ROOT, 'src', 'inventions');
const TPL = path.join(ROOT, 'src', 'templates');
const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MAX_FIX_ROUNDS = 3;

// ---------- ספריית ההמצאות ----------
export function listInventions() {
  if (!fs.existsSync(INV_DIR)) return [];
  return fs.readdirSync(INV_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(INV_DIR, d.name, 'design.json')) && fs.existsSync(path.join(INV_DIR, d.name, 'game.js')))
    .map(d => JSON.parse(fs.readFileSync(path.join(INV_DIR, d.name, 'design.json'), 'utf8')));
}

// ---------- מבנה מסמך העיצוב ----------
const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'short kebab-case English id, e.g. "gravity-swap"' },
    name: { type: 'string', description: 'Hebrew genre/mechanic name, 2-4 words' },
    pitch: { type: 'string', description: 'Hebrew, one sentence: the hook' },
    rules: { type: 'string', description: 'Hebrew: the complete rules, precise enough to implement (board/world, entities, what the player does, scoring, how difficulty ramps, how a round ends)' },
    novelty: { type: 'string', description: 'Hebrew: what is new compared with the existing genres' },
    inspiration: { type: 'string', description: 'Hebrew: which trends/genres it twists or combines' },
    controls: { type: 'string', enum: ['tap', 'drag', 'swipe', 'hold', 'tap+keys'] },
    howto: { type: 'string', description: 'Hebrew player instructions, 1-3 sentences. May use theme placeholders: {hero} (Hebrew noun with ה, e.g. "הטייס"), {place} (e.g. "החלל"), {in_place} ("בחלל"), {from_place} ("מהחלל"), {thing} (plural noun, e.g. "הכוכבים"), {adj} (adjective, e.g. "קוסמי"), {pickup} (emoji)' },
    titles: { type: 'array', items: { type: 'string' }, description: '3-5 Hebrew game titles; may use the same placeholders' },
    icon: { type: 'string', description: 'one emoji for the gallery, or the name of a theme field: hero, pickup, clickable' },
    appeal: { type: 'integer', description: 'honest estimate 0-100 of how popular this could be with casual players' },
    params: {
      type: 'array',
      description: 'tunable numbers the code reads from S.<key>',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'camelCase' },
          value: { type: 'number' },
          harder: { type: 'string', enum: ['higher', 'lower', 'none'], description: 'which direction makes the game harder' },
          description: { type: 'string' },
        },
        required: ['key', 'value', 'harder', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['id', 'name', 'pitch', 'rules', 'novelty', 'inspiration', 'controls', 'howto', 'titles', 'icon', 'appeal', 'params'],
  additionalProperties: false,
};

const CODE_SCHEMA = {
  type: 'object',
  properties: {
    code: { type: 'string', description: 'the complete game.js source' },
    notes: { type: 'string', description: 'one or two sentences on what changed / key design choices' },
  },
  required: ['code', 'notes'],
  additionalProperties: false,
};

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'string' }, description: 'real problems found (empty if none)' },
    changed: { type: 'boolean', description: 'true if code below differs from the input' },
    code: { type: 'string', description: 'the complete (possibly corrected) game.js source' },
  },
  required: ['issues', 'changed', 'code'],
  additionalProperties: false,
};

// ---------- הנחיות ----------
function systemPrompt() {
  const api = fs.readFileSync(path.join(TPL, 'RUNTIME.md'), 'utf8');
  const example = fs.readFileSync(path.join(TPL, 'arrows.game.js'), 'utf8');
  return `You are the lead game designer and programmer of Game Forge, a tool that generates small, polished HTML5 casual games for Hebrew-speaking players on phones and desktops.

You invent genuinely new casual game mechanics and implement them as a single game.js file for the Game Forge runtime. A great invention here is: learnable in 5 seconds, satisfying on every tap, has a clear goal and a clear way to lose, gets harder over time, and contains one twist that players have not seen in the usual genres. It must be fully implementable as one canvas game of roughly 150-450 lines, with emoji and shapes only.

<runtime_api>
${api}
</runtime_api>

<example_game file="arrows.game.js">
${example}
</example_game>`;
}

function designPrompt({ genres, inventions, emerging, idea }) {
  return `Invent ONE new casual game mechanic for Game Forge.

Existing genre templates (do not repeat these; a fresh twist or a surprising combination is fine):
${genres.map(g => `- ${g.id}: ${g.name}: ${g.why}`).join('\n')}
${inventions.length ? `\nMechanics already invented earlier (also avoid):\n${inventions.map(i => `- ${i.id}: ${i.name}: ${i.pitch}`).join('\n')}` : ''}
${emerging?.length ? `\nTrending right now according to our latest market research (good inspiration):\n${emerging.map(e => `- ${e.name}: ${e.mechanic} (${e.why})`).join('\n')}` : ''}
${idea ? `\nThe user asked for this direction: ${idea}` : ''}

Process: brainstorm at least five candidate mechanics, reject any that are too close to an existing genre, too complex to learn in seconds, or not feasible in one canvas file with emoji, then output only the strongest candidate as the design document. Write all player-facing text in natural Hebrew. Keep params to the 3-7 numbers that matter most for feel and difficulty.`;
}

function codePrompt(design) {
  return `Implement this design as a complete game.js for the Game Forge runtime.

<design>
${JSON.stringify(design, null, 2)}
</design>

The params arrive as S.<key> (already scaled for difficulty). Follow every rule in the runtime API, especially: define \`const game\`, do not redeclare runtime globals, guard draw() before reset(), separate Hebrew text and numbers in canvas text, one-finger playable on a 360x640 portrait phone. Give feedback (beep, burst, floatText) on every meaningful action, keep G.score updated, and call gameOver(score, extraHtml) when the round is lost. Return the full file.`;
}

function fixPrompt(errors, warnings) {
  return `The automated playtest in a real browser found problems. Fix all of them and return the full corrected file.

Errors:
${errors.map(e => `- ${e}`).join('\n')}
${warnings.length ? `\nWarnings from random-input play (fix if they reveal a real bug; random taps may simply be bad at the game):\n${warnings.map(w => `- ${w}`).join('\n')}` : ''}`;
}

function reviewPrompt(design, code, warnings) {
  return `Review this game.js against its design as a strict senior reviewer, then return the code (corrected if needed).

<design>
${JSON.stringify(design, null, 2)}
</design>

<game_js>
${code}
</game_js>
${warnings.length ? `\nSignals from an automated random-input playtest:\n${warnings.map(w => `- ${w}`).join('\n')}\n` : ''}
Check: Is every rule of the design implemented? Can the player actually lose (gameOver reachable) and does the score increase? Does difficulty ramp? Can a fresh round be started cleanly (reset() reinitialises everything)? Is it playable with one finger on a 360x640 phone, with targets ≥ 40px, nothing hidden under the top HUD? Is any Hebrew+number text drawn in a single fillText (must be split)? Any runtime-global redeclaration, undefined variable, or state used before reset()?
List only real issues. If there are none, return the code unchanged with changed=false.`;
}

// ---------- קריאות API ----------
async function call(client, params) {
  // סטרימינג, כי קוד מלא הוא פלט ארוך; finalMessage מחזיר את ההודעה המלאה
  const res = await client.beta.messages.stream({
    model: MODEL, max_tokens: 64000, betas: [FALLBACK_BETA], fallbacks: 'default', ...params,
  }).finalMessage();
  if (res.stop_reason === 'refusal') throw new Error(`הבקשה נדחתה (${res.stop_details?.category ?? 'ללא קטגוריה'})`);
  if (res.stop_reason === 'max_tokens') throw new Error('הפלט נחתך (max_tokens)');
  return res;
}
function json(res) {
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(text); } catch { throw new Error('הפלט אינו JSON תקין'); }
}

/** בונה HTML זמני להמצאה עם נושא ופרמטרים, לבדיקה */
function scaleParams(design, k = 1) {
  const out = {};
  for (const p of design.params) out[p.key] = p.harder === 'higher' ? p.value * k : p.harder === 'lower' ? p.value / k : p.value;
  return out;
}
export { scaleParams };

/**
 * מריץ את כל הצינור. מחזיר { design, code, rounds, review, test }.
 * @param {object} o
 * @param {Array} o.genres ז'אנרים קיימים
 * @param {(design:object, code:string)=>string} o.buildHtml בונה HTML לבדיקה
 * @param {object} [o.client] לקוח Anthropic (בבדיקות: מדומה)
 * @param {Array} [o.emerging] ז'אנרים חמים מהמחקר החי
 * @param {string} [o.idea] כיוון שהמשתמש ביקש
 * @param {(msg:string)=>void} [o.log]
 * @param {(html:string)=>Promise} [o.tester] ברירת מחדל: playtest בדפדפן
 */
export async function invent({ genres, buildHtml, client, emerging = [], idea = '', log = () => {}, tester = playtest }) {
  if (!client) {
    let Anthropic;
    try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); }
    catch { throw new Error('חסרה הספרייה @anthropic-ai/sdk. הריצו: npm install'); }
    client = new Anthropic();
  }
  const inventions = listInventions();
  // ה-system זהה בכל הקריאות, לכן נשמר במטמון (prompt caching) וחוסך בעלות
  const system = [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }];

  // 1. עיצוב
  log('🧠 שלב 1/4: ממציא מכניקה (סיעור מוחות ובחירת הרעיון החזק)…');
  const dres = await call(client, {
    system, output_config: { effort: 'high', format: { type: 'json_schema', schema: DESIGN_SCHEMA } },
    messages: [{ role: 'user', content: designPrompt({ genres, inventions, emerging, idea }) }],
  });
  const design = json(dres);
  design.id = String(design.id).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'invention';
  while (inventions.some(i => i.id === design.id) || fs.existsSync(path.join(INV_DIR, design.id))) design.id += '-2';
  design.params = design.params.filter(p => /^[A-Za-z_]\w*$/.test(p.key));
  log(`   💡 ${design.name}: ${design.pitch}`);

  // 2. קוד, 3. בדיקה ותיקון
  log('⌨️  שלב 2/4: כותב את הקוד…');
  const messages = [{ role: 'user', content: codePrompt(design) }];
  let res = await call(client, { system, output_config: { effort: 'high', format: { type: 'json_schema', schema: CODE_SCHEMA } }, messages });
  let code = json(res).code;
  let test, rounds = 0;
  for (;;) {
    log(`🧪 שלב 3/4: בודק בדפדפן${rounds ? ` (סבב תיקון ${rounds})` : ''}…`);
    const stat = staticCheck(code);
    test = stat.length ? { available: true, errors: stat, warnings: [], stats: {} } : await tester(buildHtml(design, code));
    if (!test.errors.length) break;
    log(`   ❌ ${test.errors.length} שגיאות: ${test.errors[0].split('\n')[0].slice(0, 120)}`);
    if (++rounds > MAX_FIX_ROUNDS) {
      const err = new Error(`המשחק לא עבר בדיקה אחרי ${MAX_FIX_ROUNDS} סבבי תיקון`);
      err.partial = { design, code, test };
      throw err;
    }
    // ממשיכים את אותה שיחה: מוסיפים את תשובת המודל במלואה, ואחריה את השגיאות
    messages.push({ role: 'assistant', content: res.content });
    messages.push({ role: 'user', content: fixPrompt(test.errors, test.warnings) });
    res = await call(client, { system, output_config: { effort: 'high', format: { type: 'json_schema', schema: CODE_SCHEMA } }, messages });
    code = json(res).code;
  }
  if (!test.available) log('   ⚠️ Playwright לא מותקן: עבר רק בדיקה סטטית');

  // 4. סקירת קוד מול העיצוב
  log('🔍 שלב 4/4: סקירת קוד מול העיצוב…');
  const rres = await call(client, {
    system, output_config: { effort: 'medium', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
    messages: [{ role: 'user', content: reviewPrompt(design, code, test.warnings) }],
  });
  const review = json(rres);
  if (review.issues.length) log(`   תוקנו ${review.issues.length} בעיות: ${review.issues.slice(0, 3).join(' | ')}`);
  if (review.changed && review.code && review.code !== code) {
    // הסקירה שינתה קוד: חובה לבדוק שוב. אם השינוי שבר משהו, חוזרים לגרסה שעברה בדיקה.
    const stat = staticCheck(review.code);
    const t2 = stat.length ? { errors: stat, warnings: [] } : await tester(buildHtml(design, review.code));
    if (!t2.errors.length) { code = review.code; test = { ...test, ...t2 }; }
    else log('   ⚠️ התיקון של הסקירה שבר את הבדיקה, נשאר עם הגרסה הקודמת');
  }
  return { design, code, rounds, review, test };
}

export function saveInvention(design, code, meta = {}) {
  const dir = path.join(INV_DIR, design.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'game.js'), `// הומצא אוטומטית ע"י Game Forge (${new Date().toISOString().slice(0, 10)}): ${design.name}\n// ${design.pitch}\n${code}\n`);
  fs.writeFileSync(path.join(dir, 'design.json'), JSON.stringify({ ...design, created: new Date().toISOString(), ...meta }, null, 2));
  return dir;
}
