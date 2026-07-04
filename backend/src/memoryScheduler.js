import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, pickKey, trimTrailingAssistantTurns } from './providers.js';
import { getEnabledTools, runAnthropicToolLoop, runOpenAiToolLoop } from './mcp.js';
import { getLocalTools } from './localTools.js';
import { getContextMessageLimit, getMemorySaveIntervalHours } from './contextSettings.js';
import { describeForHistory } from './chatHistory.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often the scheduler wakes up to check

// Long-term memory isn't stored by this app at all — it lives in whatever
// external MCP server the user has registered as their memory tool (see
// 工具管理 in the sidebar). This job just periodically nudges the model to
// look back over the conversation and actually call that tool for
// anything worth keeping, since otherwise saving only ever happens if the
// model happens to reach for it mid-chat on its own.
const MEMORY_REVIEW_INSTRUCTION = `【定时记忆整理】请回顾最近这段对话，如果有什么以后值得长期记住的信息——比如小晴的喜好/忌讳、纪念日或重要日期、你们之间的约定、她生活里的重要变化、说过的走心的话——请调用你可以用的记忆相关工具，把这些内容分别记录下来。已经记住过的内容不用重复记。如果没有什么新的、值得记的内容，就不用调用任何工具。`;

async function maybeSaveMemory() {
  try {
    const intervalMs = getMemorySaveIntervalHours() * 3600000;
    const lastSavedAt = getSetting('lastMemorySaveAt', '');
    if (lastSavedAt && Date.now() - new Date(lastSavedAt).getTime() < intervalMs) return;

    // Always stamp this check, whether or not anything ends up saved —
    // otherwise a quiet stretch would just re-trigger (and re-spend a
    // call on) every single check cycle instead of waiting out the interval.
    setSetting('lastMemorySaveAt', new Date().toISOString());

    // Nothing to call into without an MCP-connected memory tool — running
    // this with only local tools (schedule_message) available would just
    // burn a call for no possible outcome.
    if (getSetting('mcpToolsEnabled', '0') !== '1') return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;
    const apiKey = pickKey(provider.keys);
    if (!apiKey) return;

    const rawHistory = db
      .prepare('SELECT from_who, text, kind, attachment_name FROM chat_messages ORDER BY id DESC LIMIT ?')
      .all(getContextMessageLimit())
      .reverse()
      .map((r) => ({ from: r.from_who, text: describeForHistory(r) }));
    if (!rawHistory.length) return;
    const history = trimTrailingAssistantTurns(rawHistory);
    if (!history.length) return;

    const tools = [...getLocalTools(), ...(await getEnabledTools())];
    if (!tools.length) return;

    if (provider.type === 'openai') {
      await runOpenAiToolLoop(history, apiKey, provider.baseUrl, provider.selectedModel, tools, MEMORY_REVIEW_INSTRUCTION);
    } else {
      await runAnthropicToolLoop(history, apiKey, provider.selectedModel, provider.baseUrl || undefined, tools, MEMORY_REVIEW_INSTRUCTION);
    }
    // Whatever was worth keeping just got saved via a tool call against
    // the registered memory server — there's no local storage step and no
    // reply text to show anyone; this never touches the visible chat.
  } catch (err) {
    console.error('[memory] error:', err.message);
  }
}

export function startMemoryScheduler() {
  setInterval(maybeSaveMemory, CHECK_INTERVAL_MS);
}
