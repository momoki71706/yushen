import { getSetting, setSetting } from './db.js';

// Shared "上下文" settings — how many recent messages the AI gets to read
// each turn, and how often the memory scheduler reviews them to jot down
// anything worth keeping long-term. Centralized here since the message
// count in particular used to be a handful of hardcoded constants
// manually kept in sync across chat.js/proactive.js/scheduledMessages.js/
// compression.js.
const DEFAULT_CONTEXT_MESSAGE_LIMIT = 30;
const DEFAULT_MEMORY_SAVE_INTERVAL_HOURS = 6;

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

export function getMemorySaveIntervalHours() {
  const raw = getSetting('memorySaveIntervalHours', String(DEFAULT_MEMORY_SAVE_INTERVAL_HOURS));
  return clampInt(raw, 1, 48, DEFAULT_MEMORY_SAVE_INTERVAL_HOURS);
}

export function readContextSettings() {
  return {
    contextMessageLimit: getContextMessageLimit(),
    memorySaveIntervalHours: getMemorySaveIntervalHours(),
  };
}

export function setContextSettings({ contextMessageLimit, memorySaveIntervalHours }) {
  if (contextMessageLimit !== undefined) {
    setSetting('contextMessageLimit', String(clampInt(contextMessageLimit, 10, 100, DEFAULT_CONTEXT_MESSAGE_LIMIT)));
  }
  if (memorySaveIntervalHours !== undefined) {
    setSetting('memorySaveIntervalHours', String(clampInt(memorySaveIntervalHours, 1, 48, DEFAULT_MEMORY_SAVE_INTERVAL_HOURS)));
  }
  return readContextSettings();
}
