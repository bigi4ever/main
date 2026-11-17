// טרנדים בזמן אמת: Claude מחפש ברשת נתונים עדכניים על ז'אנרים של משחקים ומחזיר ציונים.
// שלב 1: מחקר עם חיפוש ברשת (דוח חופשי + מקורות).
// שלב 2: המרת הדוח לציונים במבנה JSON קבוע (structured outputs), כך שהפלט תמיד תקין.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LIVE_FILE = path.join(ROOT, 'trends.live.json');
export const MAX_AGE_DAYS = 7;
const MODEL = 'claude-opus-5-5';
// אם המודל מסרב לבקשה מסיבות בטיחות, השרת מריץ אותה אוטומטית על מודל חלופי.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export function readLive() {
  try { return JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8')); } catch { return null; }
}

export function liveAgeDays(live = readLive()) {
  if (!live?.updated) return Infinity;
  return (Date.now() - new Date(live.updated).getTime()) / 86400000;
}

function researchPrompt(genres, today) {
  return `Today is ${today}. You are a market analyst for a tool that auto-generates small HTML5 casual games (web + mobile browser).

Research, using web search, how popular each of these game genres is RIGHT NOW (the last ~3-6 months). Prefer hard data: Sensor Tower / AppMagic / data.ai genre reports, App Store and Google Play top charts, Steam tag trends, and web portals such as Poki and CrazyGames. Note whether each genre is rising, stable, or falling.

Genres to rate:
${genres.map(g => `- ${g.id}: ${g.name} (${g.tags.join(', ')})`).join('\n')}

Also name up to 5 OTHER casual genres or mechanics that are trending right now and could be built as a small single-file browser game (for example a new viral puzzle mechanic).

Write a concise report: for each genre, the evidence you found with numbers and dates where possible. Cite what you found; do not invent figures. If you found no direct data for a genre, say so.`;
}

const SCORE_SCHEMA = (ids) => ({
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'סיכום קצר בעברית (2-3 משפטים) של מצב השוק' },
    genres: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ids },
          score: { type: 'integer', description: 'popularity right now, 0-100' },
          trend: { type: 'string', enum: ['rising', 'stable', 'falling'] },
          evidence: { type: 'string', description: 'הנימוק בעברית, משפט אחד או שניים, עם נתון אם יש' },
        },
        required: ['id', 'score', 'trend', 'evidence'],
        additionalProperties: false,
      },
    },
    emerging: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם הז\'אנר בעברית' },
          mechanic: { type: 'string', description: 'המכניקה המרכזית, משפט אחד בעברית' },
          why: { type: 'string', description: 'למה הוא חם עכשיו, משפט אחד בעברית' },
        },
        required: ['name', 'mechanic', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'genres', 'emerging'],
  additionalProperties: false,
});

function checkRefusal(res, step) {
  if (res.stop_reason === 'refusal') {
    throw new Error(`הבקשה נדחתה בשלב ${step} (${res.stop_details?.category ?? 'ללא קטגוריה'})`);
  }
}

/**
 * מריץ מחקר טרנדים. מחזיר אובייקט שנשמר ל-trends.live.json.
 * @param {object} opts
 * @param {Array} opts.genres  רשימת הז'אנרים הנתמכים (מ-trends.js)
 * @param {object} [opts.client] לקוח Anthropic (לבדיקות אפשר להזריק לקוח מדומה)
 * @param {(msg:string)=>void} [opts.log]
 */
export async function researchTrends({ genres, client, log = () => {} }) {
  if (!client) {
    let Anthropic;
    try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); }
    catch { throw new Error('חסרה הספרייה @anthropic-ai/sdk. הריצו: npm install'); }
    client = new Anthropic();
  }
  const today = new Date().toISOString().slice(0, 10);
  const ids = genres.map(g => g.id);

  // ---- שלב 1: מחקר ברשת ----
  log('🔎 שלב 1: Claude מחפש ברשת נתונים עדכניים…');
  const messages = [{ role: 'user', content: researchPrompt(genres, today) }];
  let res;
  for (let round = 0; round < 5; round++) {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
      messages,
    });
    checkRefusal(res, 'המחקר');
    // חיפוש ארוך יכול לעצור באמצע (pause_turn): שולחים את התשובה בחזרה והשרת ממשיך מאותה נקודה
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content });
    log('   …ממשיך לחפש');
  }

  const sources = new Map();
  const blocks = messages.slice(1).flatMap(m => m.content).concat(res.content);
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) sources.set(r.url, r.title || r.url);
    }
  }
  const report = blocks.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!report) throw new Error('המחקר לא החזיר דוח');

  // ---- שלב 2: המרה לציונים ----
  log(`📊 שלב 2: מדרג את הז'אנרים (${sources.size} מקורות נקראו)…`);
  const res2 = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCORE_SCHEMA(ids) } },
    messages: [{
      role: 'user',
      content: `Convert this market research report into popularity scores (0-100) for each genre id: ${ids.join(', ')}.
Base scores only on the evidence in the report; when evidence for a genre is weak, keep its score moderate (50-70) and say so.
Write summary, evidence, and the emerging-genre fields in Hebrew.

<report>
${report}
</report>`,
    }],
  });
  checkRefusal(res2, 'הדירוג');
  const text = res2.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('פלט הדירוג אינו JSON תקין'); }

  const scores = {};
  for (const g of data.genres) {
    if (!ids.includes(g.id)) continue;
    scores[g.id] = { score: Math.max(0, Math.min(100, Math.round(g.score))), trend: g.trend, evidence: g.evidence };
  }
  return {
    updated: new Date().toISOString(),
    model: res2.model || MODEL,
    summary: data.summary,
    scores,
    emerging: data.emerging.slice(0, 5),
    sources: [...sources].slice(0, 25).map(([url, title]) => ({ url, title })),
    report,
  };
}

export function saveLive(live) {
  fs.writeFileSync(LIVE_FILE, JSON.stringify(live, null, 2));
}

// הודעת שגיאה מובנת למשתמש
export function explainError(e) {
  const name = e?.constructor?.name || '';
  const msg = String(e?.message || e);
  if (name === 'AuthenticationError' || /api[_ ]?key|authentication|auth/i.test(msg)) {
    return 'אין גישה ל-API של Claude. הגדירו מפתח: export ANTHROPIC_API_KEY=... (או התחברו עם ant auth login)';
  }
  if (name === 'RateLimitError') return 'חריגה ממגבלת הקצב של ה-API. נסו שוב בעוד דקה.';
  if (name === 'APIConnectionError') return 'אין חיבור ל-api.anthropic.com. בדקו את החיבור לרשת.';
  return msg;
}
