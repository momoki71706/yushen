import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, pickKey } from './providers.js';
import { getEnabledTools, runAnthropicToolLoop, runOpenAiToolLoop } from './mcp.js';
import { deviceControlEnabled } from './device.js';
import { getLocalTools } from './localTools.js';
import { estimateTokens } from './persona.js';

// Smultronställe (野草莓之地): a long-form story-generation space, deliberately
// separate from chat. It IS 屿深 at its core, but each "window" carries a
// governing instruction that takes priority (can hand him a new identity or
// scene), and it reads — but by default does NOT write — the Ombre Brain
// memory the rest of the app uses.

const STORY_CONTEXT_ENTRIES = 24; // how many recent instruction/story turns feed the next generation
const STORY_MAX_TOKENS = 3000;

// ---------- windows ----------
export function listWindows() {
  return db.prepare('SELECT * FROM smultron_windows ORDER BY id ASC').all();
}
export function getWindow(id) {
  return db.prepare('SELECT * FROM smultron_windows WHERE id = ?').get(id) || null;
}
export function createWindow(name) {
  const info = db.prepare('INSERT INTO smultron_windows (name) VALUES (?)').run(String(name || '新窗口').slice(0, 60));
  setActiveWindowId(info.lastInsertRowid);
  return getWindow(info.lastInsertRowid);
}
export function updateWindow(id, { name, instruction }) {
  const w = getWindow(id);
  if (!w) return null;
  db.prepare('UPDATE smultron_windows SET name = ?, instruction = ? WHERE id = ?').run(
    name !== undefined ? String(name).slice(0, 60) : w.name,
    instruction !== undefined ? String(instruction) : w.instruction,
    id
  );
  return getWindow(id);
}
export function deleteWindow(id) {
  db.prepare('DELETE FROM smultron_entries WHERE window_id = ?').run(id);
  db.prepare('DELETE FROM smultron_windows WHERE id = ?').run(id);
  if (getActiveWindowId() === Number(id)) {
    const first = db.prepare('SELECT id FROM smultron_windows ORDER BY id ASC LIMIT 1').get();
    setActiveWindowId(first ? first.id : 0);
  }
}
export function getActiveWindowId() {
  return Number(getSetting('smultronActiveWindowId', '0')) || 0;
}
export function setActiveWindowId(id) {
  setSetting('smultronActiveWindowId', String(id || 0));
}

// ---------- entries ----------
export function listEntries(windowId) {
  return db.prepare('SELECT * FROM smultron_entries WHERE window_id = ? ORDER BY id ASC').all(windowId);
}
function addEntry(windowId, role, text, tokens, thinking) {
  const info = db
    .prepare('INSERT INTO smultron_entries (window_id, role, text, tokens, thinking) VALUES (?,?,?,?,?)')
    .run(windowId, role, text, tokens ?? null, thinking || null);
  return db.prepare('SELECT * FROM smultron_entries WHERE id = ?').get(info.lastInsertRowid);
}

// ---------- instruction presets (the reusable 默认指令库) ----------
export function listPresets() {
  return db.prepare('SELECT * FROM smultron_presets ORDER BY sort_order ASC, id ASC').all();
}
export function createPreset({ name, content }) {
  const info = db
    .prepare('INSERT INTO smultron_presets (name, content) VALUES (?,?)')
    .run(String(name || '未命名设定').slice(0, 60), String(content || ''));
  return db.prepare('SELECT * FROM smultron_presets WHERE id = ?').get(info.lastInsertRowid);
}
export function updatePreset(id, { name, content }) {
  const p = db.prepare('SELECT * FROM smultron_presets WHERE id = ?').get(id);
  if (!p) return null;
  db.prepare('UPDATE smultron_presets SET name = ?, content = ? WHERE id = ?').run(
    name !== undefined ? String(name).slice(0, 60) : p.name,
    content !== undefined ? String(content) : p.content,
    id
  );
  return db.prepare('SELECT * FROM smultron_presets WHERE id = ?').get(id);
}
export function deletePreset(id) {
  db.prepare('DELETE FROM smultron_presets WHERE id = ?').run(id);
}

// ---------- generation ----------
function personaBase() {
  const rows = db.prepare("SELECT content FROM prompt_presets WHERE enabled = 1 AND category = '人设' ORDER BY sort_order ASC, id ASC").all();
  return rows.map((r) => r.content.trim()).filter(Boolean).join('\n\n');
}

function buildStorySystem(win) {
  const base = personaBase() || '你是屿深。';
  const parts = [
    base,
    win.instruction
      ? `【本窗口设定】（优先级高于以上人设——如果这里给你安排了新的身份、情境或规则，就以这里为准）\n${win.instruction.trim()}`
      : '',
    `【写作要求】
- 这是长篇、沉浸式的剧情创作，用连贯细腻的叙述文来写，不要分条、不要聊天气泡那种短句语气。
- 把屿深的动作、神态、心理、语言都写足、写细，让他鲜活立体。
- 绝对不要替小晴写她的内心想法或心理活动——你只能通过她的动作、表情、话语去观察和猜测，永远不能笃定地写出她在想什么、感受到什么。
- 每次输出一段完整、有推进的剧情，篇幅可以长，不要草草收尾。
- 你可以调用读取记忆的工具，参考记忆库里关于小晴的偏好和你们的过往，让剧情更贴合她。
- 小晴输入的内容是"导演指令"，用来推进或设定剧情走向，不是对话——你要据此往下写，而不是回复她。`,
  ];
  return parts.filter(Boolean).join('\n\n');
}

// Read-memory tools stay available so a generation can consult Ombre Brain
// preferences, but the save tool ('hold') is withheld here by default — this
// section only writes to memory when the user explicitly hits a window's
// 同步到记忆库 button (see syncWindowToMemory). control_device is offered only
// when the intimate-device master switch is on.
async function getStoryTools({ allowSave = false } = {}) {
  const local = deviceControlEnabled() ? getLocalTools().filter((t) => t.toolName === 'control_device') : [];
  let mcpTools = [];
  try {
    mcpTools = await getEnabledTools();
  } catch {
    mcpTools = [];
  }
  const filtered = allowSave ? mcpTools : mcpTools.filter((t) => t.toolName.toLowerCase() !== 'hold');
  return [...local, ...filtered];
}

function buildHistory(windowId, extraUserTurn) {
  const rows = db
    .prepare('SELECT role, text FROM smultron_entries WHERE window_id = ? ORDER BY id DESC LIMIT ?')
    .all(windowId, STORY_CONTEXT_ENTRIES)
    .reverse();
  const history = rows.map((r) => ({ from: r.role === 'story' ? 'them' : 'me', text: r.text }));
  // Providers want the turn sequence to end on a user turn — when continuing
  // with no fresh instruction (history ends on a 'story'/assistant turn),
  // append a lightweight nudge so the call is well-formed.
  if (extraUserTurn) history.push({ from: 'me', text: extraUserTurn });
  else if (history.length && history[history.length - 1].from === 'them') {
    history.push({ from: 'me', text: '（接着上面继续往下写，保持连贯自然）' });
  }
  return history;
}

async function runGeneration(win, { allowSave = false, extraInstruction = null } = {}) {
  const providerId = getSetting('activeProviderId', '');
  const provider = providerId ? getProviderWithKeys(providerId) : null;
  if (!provider) throw new Error('还没有配置 AI 供应商');
  const apiKey = pickKey(provider.keys);
  if (!apiKey) throw new Error('还没有设置 API Key');

  const tools = await getStoryTools({ allowSave });
  const systemBase = buildStorySystem(win);
  const history = buildHistory(win.id, allowSave ? extraInstruction : null);
  const opts = { systemBase, maxTokens: STORY_MAX_TOKENS };

  if (provider.type === 'openai') {
    return runOpenAiToolLoop(history, apiKey, provider.baseUrl, provider.selectedModel, tools, allowSave ? extraInstruction : null, opts);
  }
  return runAnthropicToolLoop(history, apiKey, provider.selectedModel, provider.baseUrl || undefined, tools, allowSave ? extraInstruction : null, opts);
}

// A fresh instruction ('' means "continue" with no new directive).
export async function generate(windowId, instruction) {
  const win = getWindow(windowId);
  if (!win) throw new Error('窗口不存在');
  const trimmed = String(instruction || '').trim();
  if (trimmed) addEntry(windowId, 'instruction', trimmed);
  const reply = await runGeneration(win);
  const story = addEntry(windowId, 'story', reply.text, reply.tokens ?? estimateTokens(reply.text), reply.thinking);
  return story;
}

// Drops the last generated passage and produces a new one for the same tail.
export async function regenerateLast(windowId) {
  const last = db.prepare("SELECT * FROM smultron_entries WHERE window_id = ? AND role = 'story' ORDER BY id DESC LIMIT 1").get(windowId);
  if (last) db.prepare('DELETE FROM smultron_entries WHERE id = ?').run(last.id);
  return generate(windowId, '');
}

// The window's 同步到记忆库 button: a one-off pass over this window's story that
// IS allowed to call the save ('hold') tool, so the user opts memories in
// per-window instead of the section ever writing on its own.
export async function syncWindowToMemory(windowId) {
  const win = getWindow(windowId);
  if (!win) throw new Error('窗口不存在');
  const instruction =
    '请回顾这个窗口里到目前为止的剧情，把其中值得长期记住的内容——比如小晴表现出的偏好/忌讳、你们约定的设定、重要的情节走向或情感变化——调用你的记忆工具（hold）保存到记忆库里。已经记过的不用重复。如果没有特别值得记的，就不用保存。只需简短说明你记了什么，不要续写剧情。';
  const reply = await runGeneration(win, { allowSave: true, extraInstruction: instruction });
  return { text: reply.text, toolTrace: reply.toolTrace || [] };
}

// ---------- export ----------
export function exportWindowMarkdown(windowId) {
  const win = getWindow(windowId);
  if (!win) return null;
  const entries = listEntries(windowId);
  const lines = [`# ${win.name}`, ''];
  if (win.instruction) lines.push(`> 设定：${win.instruction}`, '');
  for (const e of entries) {
    if (e.role === 'instruction') lines.push(`**【指令】${e.text}**`, '');
    else lines.push(e.text, '');
  }
  return lines.join('\n');
}
