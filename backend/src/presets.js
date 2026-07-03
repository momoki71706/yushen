import { db, getSetting } from './db.js';

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

// Every enabled preset's content is concatenated (in category/sort order)
// into a single system prompt applied to every chat call, across all AI
// providers and Claude Code CLI. The rolling chat-history summary (from
// compression.js) is appended last so it stays close to the actual
// conversation in the prompt.
export function getComposedSystemPrompt() {
  const rows = db.prepare('SELECT content FROM prompt_presets WHERE enabled = 1 ORDER BY category ASC, sort_order ASC, id ASC').all();
  const combined = rows.map((r) => r.content.trim()).filter(Boolean).join('\n\n');
  const base = combined || '你是屿深，正在手机上和女朋友小晴聊天。回复要简短自然、温暖随意。';

  const chatSummary = (getSetting('chatSummary', '') || '').trim();
  if (!chatSummary) return base;
  return `${base}\n\n【更早之前的对话摘要】\n${chatSummary}`;
}
