import { db, getSetting } from './db.js';
import { beijingNow, formatBeijingClock, weekdayLabel } from './time.js';
import { MESSAGE_SPLIT_MARKER } from './persona.js';

// Reserved category name: presets filed under this are deliberately kept
// OUT of the normal always-on system prompt (getComposedSystemPrompt's
// base fold below excludes it) and instead only surface as the
// extraInstruction for the proactive idle-chat and read-unanswered
// follow-up schedulers — see getProactivePresetContent(). This is what
// lets 主动发消息 have its own user-authored instructions instead of the
// hardcoded paragraph that used to live in proactive.js/chatFollowUp.js,
// without that same text leaking into every ordinary chat reply too.
export const PROACTIVE_PRESET_CATEGORY = '主动消息';

export function getProactivePresetContent() {
  const rows = db
    .prepare('SELECT content FROM prompt_presets WHERE enabled = 1 AND category = ? ORDER BY sort_order ASC, id ASC')
    .all(PROACTIVE_PRESET_CATEGORY);
  return rows.map((r) => r.content.trim()).filter(Boolean).join('\n\n');
}

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

// The memory-review scheduler (memoryScheduler.js) only ever surfaces
// health data if an MCP memory tool is connected AND the model happens to
// judge a given day's numbers worth saving — neither is guaranteed, so
// relying on that path alone left the model blind to watch data most of
// the time. This instead puts the latest pushed snapshot directly in every
// system prompt, unconditionally, the same way the time block works.
function getHealthContext() {
  const row = db.prepare('SELECT * FROM health_logs ORDER BY date_iso DESC LIMIT 1').get();
  if (!row) return '';
  const sleepHours = row.sleep_minutes ? `${Math.floor(row.sleep_minutes / 60)}小时${row.sleep_minutes % 60}分钟` : '暂无数据';
  return (
    `【最近一次同步的健康数据（${row.date_iso}）】\n` +
    `睡眠：${row.sleep_start || '?'} → ${row.sleep_end || '?'}（${sleepHours}）\n` +
    `步数：${row.steps}\n` +
    `心率：均${row.heart_rate_avg}（${row.heart_rate_min}-${row.heart_rate_max}）` +
    `${row.heart_rate_resting ? `，静息${row.heart_rate_resting}` : ''}${row.heart_rate_active ? `，运动${row.heart_rate_active}` : ''}\n` +
    `经期：${row.is_period ? '是' : '否'}` +
    `${row.note ? `\n备注：${row.note}` : ''}` +
    `\n（不一定每次都要提，只在自然、相关的时候才结合这些数据说话）`
  );
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
  const rows = db
    .prepare('SELECT content FROM prompt_presets WHERE enabled = 1 AND category != ? ORDER BY category ASC, sort_order ASC, id ASC')
    .all(PROACTIVE_PRESET_CATEGORY);
  const combined = rows.map((r) => r.content.trim()).filter(Boolean).join('\n\n');
  const base = combined || '你是屿深，正在手机上和女朋友小晴聊天。回复要简短自然、温暖随意。';

  const parts = [base];
  const chatSummary = (getSetting('chatSummary', '') || '').trim();
  if (chatSummary) parts.push(`【更早之前的对话摘要】\n${chatSummary}`);
  parts.push(
    `【当前时间】\n${getTimeContext()}\n（对话记录里每条消息前面的 [x月x日 周x 时:分] 是那条消息实际发送的时间，只是给你自己看的参考标记，用来判断隔了多久、该不该接着聊同一个话题——你自己的回复里绝对不能出现这种方括号时间格式，也不要把这个格式抄进你说的话里当开场白。如果真的需要提一下时间，就用日常说话的方式自然带一句（比如"这么晚了""都下午了"），而不是报时间数字或者用方括号。大多数时候根本不用提。）`
  );
  const healthContext = getHealthContext();
  if (healthContext) parts.push(healthContext);
  parts.push(
    `【分段发送】真人聊天有时会连着发好几条短消息，而不是一次发一大段。如果这次回复那样说更自然，可以把每一段单独写一行，段与段之间插入 ${MESSAGE_SPLIT_MARKER} 隔开——每一段会各自变成一条独立的消息气泡发出去。只在真的有那种"一句一句往外蹦"的感觉时才这样用，不要为了用而用，也不要把一句完整的话硬拆成好几段；大多数时候正常一条消息就行。`
  );
  if (extraInstruction) parts.push(extraInstruction);
  return parts.join('\n\n');
}
