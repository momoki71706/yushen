import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, pickKey } from './providers.js';
import { getEnabledTools, runAnthropicToolLoop, runOpenAiToolLoop } from './mcp.js';
import { getLocalTools } from './localTools.js';
import { getMemorySaveMessageThreshold } from './contextSettings.js';
import { enrichHistory } from './chatHistory.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often the scheduler wakes up to check

// Long-term memory isn't stored by this app at all — it lives in whatever
// external MCP server the user has registered as their memory tool (see
// 工具管理 in the sidebar). This job periodically nudges the model to look
// back over everything that's piled up since the last review — chat,
// diary, and letters — and actually call that tool for anything worth
// keeping, since otherwise saving only ever happens if the model happens
// to reach for it mid-chat on its own.
const MEMORY_REVIEW_INSTRUCTION = `【定时记忆整理】请回顾下面这些还没有被整理过的新内容——包括聊天记录，也可能包括日记和信件——如果有什么以后值得长期记住的信息——比如小晴的喜好/忌讳、纪念日或重要日期、你们之间的约定、她生活里的重要变化、说过的走心的话——请调用你可以用的记忆相关工具，把这些内容分别记录下来。已经记住过的内容不用重复记。如果没有什么新的、值得记的内容，就不用调用任何工具。`;

const insertMemoryLog = db.prepare('INSERT INTO memory_log (tool_name, summary) VALUES (?, ?)');

// Every real (non-local, non-error) tool call is treated as a memory save
// — the only MCP server this app ever expects registered is a memory one
// (see 工具管理), so this same filter applies whether the call happened
// during this scheduled review pass or live mid-chat (see routes/chat.js),
// which previously only reached the 记忆库 panel via this scheduler and
// never logged calls the model made on its own during a normal reply.
export function logMemoryToolTrace(toolTrace, localTools) {
  if (!toolTrace?.length) return;
  const localToolNames = new Set((localTools || getLocalTools()).map((t) => t.qualifiedName));
  for (const trace of toolTrace) {
    if (trace.isError || localToolNames.has(trace.name)) continue;
    insertMemoryLog.run(trace.name, summarizeToolInput(trace.input));
  }
}

function cursor(key) {
  return Number(getSetting(key, '0')) || 0;
}

// Tool call inputs vary by whatever the registered memory MCP server's
// schema looks like — this just picks the most readable field it can find
// rather than assuming one exact shape.
function summarizeToolInput(input) {
  if (!input || typeof input !== 'object') return String(input ?? '');
  const preferredKeys = ['content', 'text', 'memory', 'note', 'summary', 'value'];
  for (const key of preferredKeys) {
    if (typeof input[key] === 'string' && input[key].trim()) return input[key].trim();
  }
  return JSON.stringify(input);
}

// Diary entries and comments are a separate thread from the main chat —
// pulled in as extra reference text (not fake chat turns) so the review
// pass sees what's been written there too, not just the chat window.
function collectNewDiaryText(sinceEntryId, sinceCommentId) {
  const entries = db.prepare('SELECT * FROM diary_entries WHERE id > ? ORDER BY id ASC').all(sinceEntryId);
  const comments = db
    .prepare(
      `SELECT diary_comments.*, diary_entries.date_label AS entry_date_label
       FROM diary_comments JOIN diary_entries ON diary_entries.id = diary_comments.entry_id
       WHERE diary_comments.id > ? ORDER BY diary_comments.id ASC`
    )
    .all(sinceCommentId);

  const lines = [
    ...entries.map((e) => `[日记 ${e.date_label}] ${e.author === 'me' ? '小晴' : '屿深'} 写道：${e.excerpt}`),
    ...comments.map((c) => `[日记留言 ${c.entry_date_label}] ${c.author === 'me' ? '小晴' : '屿深'}：${c.text}`),
  ];

  return {
    text: lines.join('\n'),
    maxEntryId: entries.length ? entries[entries.length - 1].id : sinceEntryId,
    maxCommentId: comments.length ? comments[comments.length - 1].id : sinceCommentId,
  };
}

function collectNewLetterText(sinceId) {
  const rows = db.prepare('SELECT * FROM letters WHERE id > ? ORDER BY id ASC').all(sinceId);
  return {
    text: rows.map((l) => `[信 ${l.unlock_date}] ${l.sender} 写给 ${l.recipient}：${l.body}`).join('\n'),
    maxId: rows.length ? rows[rows.length - 1].id : sinceId,
  };
}

// Real HealthKit snapshots pushed in via an iOS Shortcut (routes/health.js)
// — folded in the same way as diary/letters so the review pass can decide
// whether a day's sleep/steps/heart-rate/period data is worth a long-term
// memory, using whatever memory tool is already connected (see 工具管理).
function collectNewHealthText(sinceId) {
  const rows = db.prepare('SELECT * FROM health_logs WHERE id > ? ORDER BY id ASC').all(sinceId);
  const lines = rows.map((r) => {
    const sleepHours = r.sleep_minutes ? `${Math.floor(r.sleep_minutes / 60)}h${r.sleep_minutes % 60}m` : '未知';
    return (
      `[健康数据 ${r.date_iso}] 睡眠 ${r.sleep_start || '?'}→${r.sleep_end || '?'}（${sleepHours}），` +
      `步数 ${r.steps}，心率均${r.heart_rate_avg}（${r.heart_rate_min}-${r.heart_rate_max}），` +
      `经期${r.is_period ? '是' : '否'}${r.note ? `，备注：${r.note}` : ''}`
    );
  });
  return {
    text: lines.join('\n'),
    maxId: rows.length ? rows[rows.length - 1].id : sinceId,
  };
}

async function maybeSaveMemory() {
  try {
    const lastChatId = cursor('memoryLastChatId');
    const maxChatId = (db.prepare('SELECT MAX(id) AS maxId FROM chat_messages').get()?.maxId) || 0;
    if (maxChatId - lastChatId < getMemorySaveMessageThreshold()) return;

    // Nothing to call into without an MCP-connected memory tool — running
    // this with only local tools (schedule_message) available would just
    // burn a call for no possible outcome. Bail out WITHOUT advancing any
    // cursor, so the backlog is still there to review once a memory tool
    // actually gets connected.
    if (getSetting('mcpToolsEnabled', '0') !== '1') return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;
    const apiKey = pickKey(provider.keys);
    if (!apiKey) return;

    const rows = db
      .prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime, created_at FROM chat_messages WHERE id > ? ORDER BY id ASC')
      .all(lastChatId);
    if (!rows.length) return;
    // Unlike a reply-continuation call, this is a review pass over whatever
    // piled up — it has no need to end on a "me" turn, and this app's
    // proactive/AI-initiated messages (letters, diary reactions, nags) mean
    // the tail is often "them" anyway. Trimming those away here could
    // discard most or all of the batch and made the review silently bail
    // (no save, no cursor advance) whenever that happened.
    const history = await enrichHistory(rows);
    if (!history.length) return;

    const localTools = getLocalTools();
    const tools = [...localTools, ...(await getEnabledTools())];
    if (!tools.length) return;

    const lastDiaryEntryId = cursor('memoryLastDiaryEntryId');
    const lastDiaryCommentId = cursor('memoryLastDiaryCommentId');
    const lastLetterId = cursor('memoryLastLetterId');
    const lastHealthId = cursor('memoryLastHealthId');
    const diary = collectNewDiaryText(lastDiaryEntryId, lastDiaryCommentId);
    const letter = collectNewLetterText(lastLetterId);
    const health = collectNewHealthText(lastHealthId);
    const extra = [diary.text, letter.text, health.text].filter(Boolean).join('\n');
    const instruction = extra ? `${MEMORY_REVIEW_INSTRUCTION}\n\n以下是这段时间里的日记、信件和健康数据，也一并参考：\n${extra}` : MEMORY_REVIEW_INSTRUCTION;

    const result =
      provider.type === 'openai'
        ? await runOpenAiToolLoop(history, apiKey, provider.baseUrl, provider.selectedModel, tools, instruction)
        : await runAnthropicToolLoop(history, apiKey, provider.selectedModel, provider.baseUrl || undefined, tools, instruction);
    // Whatever was worth keeping just got saved via a tool call against
    // the registered memory server — there's no local storage step and no
    // reply text to show anyone; this never touches the visible chat. What
    // does get logged (for the 记忆库 panel + in-app popup) is a record of
    // that call itself — every real (non-local, non-error) tool call this
    // specific pass makes is by construction a memory save, since saving
    // memories is this whole prompt's only purpose.
    logMemoryToolTrace(result.toolTrace, localTools);

    // Advance every cursor now that this batch has actually been reviewed
    // — this is also what lets compression.js safely fold these chat
    // messages into the rolling summary afterwards, since nothing gets
    // compressed away before it's had a chance to be remembered.
    setSetting('memoryLastChatId', String(maxChatId));
    setSetting('memoryLastDiaryEntryId', String(diary.maxEntryId));
    setSetting('memoryLastDiaryCommentId', String(diary.maxCommentId));
    setSetting('memoryLastLetterId', String(letter.maxId));
    setSetting('memoryLastHealthId', String(health.maxId));
  } catch (err) {
    console.error('[memory] error:', err.message);
  }
}

export function startMemoryScheduler() {
  setInterval(maybeSaveMemory, CHECK_INTERVAL_MS);
}
