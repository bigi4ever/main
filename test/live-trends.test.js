// בדיקת יחידה למחקר הטרנדים, עם לקוח API מדומה (בלי רשת ובלי מפתח).
import assert from 'node:assert/strict';
import { researchTrends } from '../src/live-trends.js';
import { GENRES } from '../src/trends.js';

function fakeClient(responses) {
  const calls = [];
  return { calls, beta: { messages: { create: async req => { calls.push(structuredClone(req)); return responses.shift(); } } } };
}

const scores = {
  summary: 'פאזל מוביל.',
  genres: GENRES.map((g, i) => ({ id: g.id, score: i === 0 ? 140 : 60 + i, trend: 'rising', evidence: 'נתון' })),
  emerging: [{ name: 'פאזל חצים', mechanic: 'מחליקים חצים', why: 'ויראלי' }],
};

// 1. זרימה רגילה כולל pause_turn
{
  const c = fakeClient([
    { stop_reason: 'pause_turn', content: [
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } },
      { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://a.example', title: 'A' }] },
    ] },
    { stop_reason: 'end_turn', content: [
      { type: 'web_search_tool_result', tool_use_id: 's2', content: [{ type: 'web_search_result', url: 'https://b.example', title: 'B' }] },
      { type: 'text', text: 'Puzzle is up 8%.' },
    ] },
    { stop_reason: 'end_turn', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(scores) }] },
  ]);
  const live = await researchTrends({ genres: GENRES, client: c });
  assert.equal(c.calls.length, 3);
  assert.equal(c.calls[1].messages.length, 2, 'אחרי pause_turn שולחים את תשובת העוזר בחזרה');
  assert.equal(c.calls[1].messages[1].role, 'assistant');
  assert.equal(c.calls[0].tools[0].type, 'web_search_20260209');
  assert.equal(c.calls[2].output_config.format.type, 'json_schema');
  assert.deepEqual(c.calls[2].output_config.format.schema.properties.genres.items.properties.id.enum, GENRES.map(g => g.id));
  assert.deepEqual(live.sources.map(s => s.url), ['https://a.example', 'https://b.example']);
  assert.equal(live.scores[GENRES[0].id].score, 100, 'ציון מוגבל ל-100');
  assert.equal(Object.keys(live.scores).length, GENRES.length);
  assert.equal(live.emerging[0].name, 'פאזל חצים');
  assert.match(live.report, /Puzzle/);
}

// 2. סירוב מטופל כשגיאה ברורה
{
  const c = fakeClient([{ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] }]);
  await assert.rejects(researchTrends({ genres: GENRES, client: c }), /נדחתה/);
}

// 3. JSON לא תקין
{
  const c = fakeClient([
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'report' }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] },
  ]);
  await assert.rejects(researchTrends({ genres: GENRES, client: c }), /JSON/);
}
console.log('✅ live-trends: כל הבדיקות עברו');
