import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, trimTrailingAssistantTurns } from './providers.js';
import { classifyReplyForRetry, withReplyRetry } from './persona.js';
import { getContextMessageLimit, getMemorySaveIntervalHours } from './contextSettings.js';
import { saveMemory } from './localTools.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often the scheduler wakes up to check

// Lines that just mean "nothing new to remember this round" — a valid,
// expected answer, not something to retry or treat as an error.
const NOTHING_NEW_PATTERN = /^(无|没有|没什么|nothing|none)[。.!！]?$/i;

const MEMORY_EXTRACTION_INSTRUCTION = `【整理记忆】请回顾最近这段对话，挑出其中以后值得长期记住的信息——比如小晴的喜好/忌讳、纪念日或重要日期、你们之间的约定、她生活里的重要变化、说过的走心的话。

每条写成一句简洁的中文陈述句，一行一条，不要编号、不要加多余的说明文字。如果已经记住过的内容，不用重复写。如果没有什么新的、值得记的内容，只输出"无"。`;

async function maybeSaveMemory() {
  try {
    const intervalMs = getMemorySaveIntervalHours() * 3600000;
    const lastSavedAt = getSetting('lastMemorySaveAt', '');
    if (lastSavedAt && Date.now() - new Date(lastSavedAt).getTime() < intervalMs) return;

    // Always stamp this check, whether or not anything new gets saved —
    // otherwise a quiet stretch with nothing memory-worthy would just
    // re-trigger (and re-spend a call on) every single check cycle.
    setSetting('lastMemorySaveAt', new Date().toISOString());

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;

    const rawHistory = db
      .prepare('SELECT from_who, text FROM chat_messages ORDER BY id DESC LIMIT ?')
      .all(getContextMessageLimit())
      .reverse()
      .map((r) => ({ from: r.from_who, text: r.text }));
    if (!rawHistory.length) return;
    const history = trimTrailingAssistantTurns(rawHistory);
    if (!history.length) return;

    const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, MEMORY_EXTRACTION_INSTRUCTION));
    // Still empty/broken after a retry — a canned fallback/error line
    // ("爸比现在不在线哦") is not extracted memory content, don't save it.
    if (classifyReplyForRetry(reply.text).bad) return;

    const lines = (reply.text || '')
      .split('\n')
      .map((l) => l.trim().replace(/^(?:[-•]\s*|\d+[.、)）]\s*)/, ''))
      .filter((l) => l && !NOTHING_NEW_PATTERN.test(l));

    lines.forEach((line) => saveMemory(line, 'auto'));
  } catch (err) {
    console.error('[memory] error:', err.message);
  }
}

export function startMemoryScheduler() {
  setInterval(maybeSaveMemory, CHECK_INTERVAL_MS);
}
