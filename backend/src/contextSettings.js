import { getSetting, setSetting } from './db.js';

// Shared "上下文" settings — how many recent messages the AI gets to read
// each turn, and how often the memory scheduler reviews them to jot down
// anything worth keeping long-term. Centralized here since the message
// count in particular used to be a handful of hardcoded constants
// manually kept in sync across chat.js/proactive.js/scheduledMessages.js/
// compression.js.
const DEFAULT_CONTEXT_MESSAGE_LIMIT = 30;
const DEFAULT_MEMORY_SAVE_MESSAGE_THRESHOLD = 30;

// `value || fallback` looks right but silently breaks for a genuinely
// valid 0 — 0 is falsy, so it'd fall back to the default instead of
// clamping to min. This only ever falls back on a non-numeric input.
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function getContextMessageLimit() {
  const raw = getSetting('contextMessageLimit', String(DEFAULT_CONTEXT_MESSAGE_LIMIT));
  return clampInt(raw, 10, 100, DEFAULT_CONTEXT_MESSAGE_LIMIT);
}

// How many new chat messages need to pile up before the memory scheduler
// reviews the backlog (see memoryScheduler.js) — replaces the old fixed
// wall-clock interval so a quiet week and a chatty afternoon both get
// reviewed at the same natural cadence instead of on a clock.
export function getMemorySaveMessageThreshold() {
  const raw = getSetting('memorySaveMessageThreshold', String(DEFAULT_MEMORY_SAVE_MESSAGE_THRESHOLD));
  return clampInt(raw, 1, 300, DEFAULT_MEMORY_SAVE_MESSAGE_THRESHOLD);
}

export function readContextSettings() {
  return {
    contextMessageLimit: getContextMessageLimit(),
    memorySaveMessageThreshold: getMemorySaveMessageThreshold(),
  };
}

export function setContextSettings({ contextMessageLimit, memorySaveMessageThreshold }) {
  if (contextMessageLimit !== undefined) {
    setSetting('contextMessageLimit', String(clampInt(contextMessageLimit, 10, 100, DEFAULT_CONTEXT_MESSAGE_LIMIT)));
  }
  if (memorySaveMessageThreshold !== undefined) {
    setSetting(
      'memorySaveMessageThreshold',
      String(clampInt(memorySaveMessageThreshold, 1, 300, DEFAULT_MEMORY_SAVE_MESSAGE_THRESHOLD))
    );
  }
  return readContextSettings();
}
