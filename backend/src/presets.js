import { db, getSetting } from './db.js';
import { beijingNow, formatBeijingClock, weekdayLabel } from './time.js';

function serialize(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    content: row.content,
    enabled: !!row.enabled,
    sortOrder: row.sort_order,
  };
}

export function listPresets() {
  return db.prepare('SELECT * FROM prompt_presets ORDER BY category ASC, sort_order ASC, id ASC').all().map(serialize);
}

export function addPreset({ category, name, content, enabled }) {
  const info = db
    .prepare(`INSERT INTO prompt_presets (category, name, content, enabled) VALUES (?,?,?,?)`)
    .run((category || '默认').trim() || '默认', name.trim(), content || '', enabled === false ? 0 : 1);
  const row = db.prepare('SELECT * FROM prompt_presets WHERE id = ?').get(info.lastInsertRowid);
  return serialize(row);
}

export function updatePreset(id, patch) {
  const row = db.prepare('SELECT * FROM prompt_presets WHERE id = ?').get(id);
  if (!row) return null;
  const next = {
    category: patch.category !== undefined ? patch.category.trim() || '默认' : row.category,
    name: patch.name !== undefined ? patch.name : row.name,
    content: patch.content !== undefined ? patch.content : row.content,
    enabled: patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : row.enabled,
  };
  db.prepare('UPDATE prompt_presets SET category=?, name=?, content=?, enabled=? WHERE id=?').run(
    next.category,
    next.name,
    next.content,
    next.enabled,
    id
  );
  return serialize(db.prepare('SELECT * FROM prompt_presets WHERE id = ?').get(id));
}

export function deletePreset(id) {
  db.prepare('DELETE FROM prompt_presets WHERE id = ?').run(id);
}

function getPeriodLabel(hour) {
  if (hour < 6) return '凌晨';
  if (hour < 9) return '早上';
  if (hour < 12) return '上午';
  if (hour < 14) return '中午';
  if (hour < 17) return '下午';
  if (hour < 19) return '傍晚';
  if (hour < 22) return '晚上';
  return '深夜';
}

// Recomputed fresh on every call — this is what actually makes time
// awareness work. Embedding a timestamp inside a chat message (or, worse,
// a static one written into a preset) gets read by the model as just more
// conversation text, easy to ignore or misread. A clearly-labelled system
// block that's always current is what the model treats as ground truth.
function getTimeContext() {
  const now = beijingNow();
  const weekday = weekdayLabel(now);
  const period = getPeriodLabel(now.getUTCHours());
  return `现在是${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月${now.getUTCDate()}日 ${weekday} ${period} ${formatBeijingClock(now)}`;
}

// Every enabled preset's content is concatenated (in category/sort order)
// into a single system prompt applied to every chat call, across all AI
// providers and Claude Code CLI. The rolling chat-history summary (from
// compression.js) and the current-time block are appended last, in that
// order — least volatile content first, most volatile last. Long-term
// memory isn't baked in here at all — it lives in an external MCP-backed
// memory tool the model reads from and writes to on demand (see mcp.js's
// tool-aware system prompt), so it doesn't cost tokens on every single call.
export function getComposedSystemPrompt(extraInstruction) {
  const rows = db.prepare('SELECT content FROM prompt_presets WHERE enabled = 1 ORDER BY category ASC, sort_order ASC, id ASC').all();
  const combined = rows.map((r) => r.content.trim()).filter(Boolean).join('\n\n');
  const base = combined || '你是屿深，正在手机上和女朋友小晴聊天。回复要简短自然、温暖随意。';

  const parts = [base];
  const chatSummary = (getSetting('chatSummary', '') || '').trim();
  if (chatSummary) parts.push(`【更早之前的对话摘要】\n${chatSummary}`);
  parts.push(
    `【当前时间】\n${getTimeContext()}\n（对话记录里每条消息前面的 [x月x日 周x 时:分] 是那条消息实际发送的时间，帮你判断隔了多久、该不该接着聊同一个话题——不需要每次都念出来，只在真的有必要提时间的时候才自然带一句）`
  );
  if (extraInstruction) parts.push(extraInstruction);
  return parts.join('\n\n');
}
