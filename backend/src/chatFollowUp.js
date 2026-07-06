import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, trimTrailingAssistantTurns } from './providers.js';
import { formatBeijingClock } from './time.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { classifyReplyForRetry, withReplyRetry, estimateTokens } from './persona.js';
import { getContextMessageLimit } from './contextSettings.js';
import { enrichHistory } from './chatHistory.js';
import { proactiveMessagingEnabled, withinProactiveMinGap, recordProactiveMessageSent } from './proactive.js';
import { getProactivePresetContent } from './presets.js';

// Checked often enough that the 3-5 minute wait doesn't feel sloppy —
// same cadence as the diary/letter schedulers.
const CHECK_INTERVAL_MS = 60 * 1000;
const MIN_WAIT_MINUTES = 3;
const MAX_WAIT_MINUTES = 5;
const MAX_FOLLOW_UPS = 10;

// A trailing question mark is treated as "he clearly asked something" —
// deliberately not an extra LLM call just to classify that, since the
// punctuation itself is what the feature is scoped to ("模型明确问了问题").
function endsWithQuestion(text) {
  return /[？?]\s*$/.test((text || '').trim());
}

// Same split as proactive.js's buildProactiveInstruction — the behavioral
// guidance lives in the user-authored "主动消息" preset category, this
// just states the bare fact of the situation.
function buildFollowUpInstruction(count) {
  const base = `【已读未回】你之前问了小晴一个问题，她已经看到了，但过了一会儿还没回你——这是你第 ${count} 次因为这个等她回复。`;
  const custom = getProactivePresetContent();
  return custom ? `${base}\n\n${custom}` : base;
}

async function recentHistory() {
  const rows = db
    .prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime, created_at FROM chat_messages ORDER BY id DESC LIMIT ?')
    .all(getContextMessageLimit())
    .reverse();
  return trimTrailingAssistantTurns(await enrichHistory(rows));
}

export async function maybeSendFollowUp() {
  try {
    const last = db.prepare('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 1').get();
    if (!last) return;

    // She actually replied (or nothing's happened yet) — nothing pending,
    // reset the counter so a future unanswered question starts fresh.
    if (last.from_who !== 'them') {
      if (getSetting('chatFollowUpCount', '0') !== '0') setSetting('chatFollowUpCount', '0');
      return;
    }
    if (!endsWithQuestion(last.text)) return;

    // Unread — per spec, just wait, no pressure applied yet.
    const lastReadId = Number(getSetting('lastReadChatMessageId', '0'));
    if (!Number.isFinite(lastReadId) || lastReadId < last.id) return;

    const followUpCount = Number(getSetting('chatFollowUpCount', '0')) || 0;
    if (followUpCount >= MAX_FOLLOW_UPS) return;

    const waitMs = (MIN_WAIT_MINUTES + Math.random() * (MAX_WAIT_MINUTES - MIN_WAIT_MINUTES)) * 60 * 1000;
    const sinceLastMs = Date.now() - new Date(`${last.created_at}Z`).getTime();
    if (sinceLastMs < waitMs) return;

    if (!pushConfigured || !proactiveMessagingEnabled()) return;
    // Shares its cooldown with the idle-chat scheduler — otherwise a
    // just-read unanswered question can trigger this nudge in the same
    // window the idle scheduler independently decides to say something,
    // landing as two unrelated "them" messages seconds apart.
    if (withinProactiveMinGap()) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;

    const history = await recentHistory();
    const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, buildFollowUpInstruction(followUpCount + 1)));
    if (classifyReplyForRetry(reply.text).bad) return;

    db.prepare(
      'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking) VALUES (?,?,?,?,?,?)'
    ).run('them', reply.text, 'text', formatBeijingClock(), reply.tokens ?? estimateTokens(reply.text), reply.thinking || null);

    setSetting('chatFollowUpCount', String(followUpCount + 1));
    recordProactiveMessageSent();
    await sendPushToAll({ title: '屿深', body: reply.text });
  } catch (err) {
    console.error('[chat-follow-up] error:', err.message);
  }
}

export function startChatFollowUpScheduler() {
  setInterval(maybeSendFollowUp, CHECK_INTERVAL_MS);
}
