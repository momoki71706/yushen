import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, trimTrailingAssistantTurns } from './providers.js';
import { beijingNow } from './time.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { classifyReplyForRetry, withReplyRetry } from './persona.js';
import { getContextMessageLimit } from './contextSettings.js';
import { enrichHistory } from './chatHistory.js';
import { getProactivePresetContent } from './presets.js';
import { insertTheirsMessages } from './chatInsert.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often the scheduler wakes up to check

// Defaults for the settings below live in routes/push.js (source of truth
// for what a fresh install behaves like); read fresh on every check so a
// change in the settings panel takes effect on the next cycle without a
// restart.
function getIdleThresholdMs() {
  return Number(getSetting('proactiveIdleThresholdMinutes', '240')) * 60000;
}
function getMinGapMs() {
  return Number(getSetting('proactiveMinGapMinutes', '180')) * 60000;
}

// Shared across every scheduler that can send an unprompted "them" chat
// message (idle chit-chat, read-but-unanswered follow-ups, ledger nags,
// diary-reaction asides) so they don't independently fire within the same
// window and read as two messages about the same thing sent seconds apart.
export function proactiveMessagingEnabled() {
  return getSetting('proactiveMessagesEnabled', '0') === '1';
}

export function withinProactiveMinGap() {
  const lastProactiveAt = getSetting('lastProactiveMessageAt', '');
  if (!lastProactiveAt) return false;
  return Date.now() - new Date(lastProactiveAt).getTime() < getMinGapMs();
}

export function recordProactiveMessageSent() {
  setSetting('lastProactiveMessageAt', new Date().toISOString());
}
function getQuietHourStart() {
  return Number(getSetting('proactiveQuietHourStart', '0'));
}
function getQuietHourEnd() {
  return Number(getSetting('proactiveQuietHourEnd', '8'));
}

// The actual behavioral guidance (how to phrase it, what to avoid
// repeating, etc.) lives entirely in the user-authored "主动消息" preset
// category (see presets.js's getProactivePresetContent) instead of being
// hardcoded here — this just supplies the bare fact of how long it's
// been quiet, since the model has no other way to know that.
function buildProactiveInstruction(idleMs) {
  const idleHours = Math.max(1, Math.round(idleMs / 3600000));
  const base = `【主动消息】距离上次和小晴说话已经大概${idleHours}个小时了，现在想主动给她发一条消息。这是你自己重新起的一个话头，不是接着聊天记录里最后一条往下接话。`;
  const custom = getProactivePresetContent();
  return custom ? `${base}\n\n${custom}` : base;
}

function isQuietHours() {
  const hour = beijingNow().getUTCHours();
  const start = getQuietHourStart();
  const end = getQuietHourEnd();
  return hour >= start && hour < end;
}

async function maybeSendProactiveMessage() {
  try {
    if (!proactiveMessagingEnabled()) return;
    if (!pushConfigured) return;
    if (isQuietHours()) return;

    const last = db.prepare('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 1').get();
    if (!last) return;
    const idleMs = Date.now() - new Date(`${last.created_at}Z`).getTime();
    if (idleMs < getIdleThresholdMs()) return;

    if (withinProactiveMinGap()) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;

    const rows = db
      .prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime, created_at FROM chat_messages ORDER BY id DESC LIMIT ?')
      .all(getContextMessageLimit())
      .reverse();
    const rawHistory = await enrichHistory(rows);
    const history = trimTrailingAssistantTurns(rawHistory);

    const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, buildProactiveInstruction(idleMs)));
    // Still empty/broken after a retry — skip this round rather than push
    // an internal error line ("钥匙好像失效了") as if it were a real message.
    if (classifyReplyForRetry(reply.text).bad) return;

    const inserted = insertTheirsMessages(reply);

    recordProactiveMessageSent();

    await sendPushToAll({ title: '屿深', body: inserted.map((r) => r.text).join(' ') });
  } catch (err) {
    console.error('[proactive] error:', err.message);
  }
}

export function startProactiveScheduler() {
  setInterval(maybeSendProactiveMessage, CHECK_INTERVAL_MS);
}
