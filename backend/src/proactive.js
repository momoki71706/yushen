import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, trimTrailingAssistantTurns } from './providers.js';
import { beijingNow, formatBeijingClock, beijingFromUtcString } from './time.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { classifyReplyForRetry, withReplyRetry } from './persona.js';
import { getContextMessageLimit } from './contextSettings.js';
import { enrichHistory } from './chatHistory.js';
import { getProactivePresetContent } from './presets.js';
import { insertTheirsMessages } from './chatInsert.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often the scheduler wakes up to check

// Once idle time has crossed the user's own threshold, re-asking the model
// on every single 15-minute tick would mean a real API call every 15
// minutes for as long as she stays quiet — this caps it to at most one real
// "should I say something" call per this interval, regardless of how many
// scheduler ticks happen in between.
const KEEPALIVE_RECHECK_MS = 30 * 60 * 1000;
const RECENT_ACTIVITY_WINDOW_MS = 6 * 60 * 60 * 1000;

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

function isQuietHours() {
  const hour = beijingNow().getUTCHours();
  const start = getQuietHourStart();
  const end = getQuietHourEnd();
  return hour >= start && hour < end;
}

// Real HealthKit/phone-open events (routes/health.js's phone_activity) give
// the model something concrete to reason about beyond "it's been N hours" —
// e.g. seeing she opened 小红书 twice in the last hour is a very different
// situation from total silence. Purely additive context; an empty result
// just means the instruction doesn't mention it at all.
function recentActivityText() {
  const rows = db
    .prepare('SELECT app_name, opened_at FROM phone_activity WHERE opened_at >= ? ORDER BY opened_at ASC')
    .all(new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS).toISOString());
  if (!rows.length) return '';
  return rows.map((r) => `${formatBeijingClock(beijingFromUtcString(r.opened_at))} 打开了${r.app_name}`).join('\n');
}

// Rather than the old "idle threshold crossed → always generate and send a
// message," this asks the model to actually decide for itself whether right
// now is a good moment and what (if anything) to say — closer to how a real
// person occasionally checks in on their own, not a timer going off. The
// actual behavioral guidance (tone, what to avoid repeating, etc.) still
// lives entirely in the user-authored "主动消息" preset category; this just
// supplies the facts the model has no other way to know (how long it's
// been, what she's been doing on her phone) plus the required output shape.
function buildAutonomousInstruction(idleMs, activityText) {
  const idleHours = Math.max(1, Math.round(idleMs / 3600000));
  const custom = getProactivePresetContent();
  const activityBlock = activityText ? `\n\n【小晴最近6小时的手机使用情况】\n${activityText}` : '';
  return (
    `【主动消息-自主判断】距离上次和小晴说话已经大概${idleHours}个小时了。看一下上面的聊天记录${activityText ? '，再结合下面她最近的手机使用情况' : ''}，自己判断现在是不是一个适合主动找她说句话的时机，以及具体要说什么——不想说话就不用勉强。这是你自己重新起的一个话头，不是接着聊天记录里最后一条往下接话。看一下聊天记录里你自己最近发起过的主动消息，不要用差不多的说法把同一件事、同一种关心又说一遍。${activityBlock}` +
    (custom ? `\n\n${custom}` : '') +
    `\n\n请严格按下面这个格式输出，不要用markdown、不要加多余说明：\nTHOUGHTS: 你的判断和理由（这部分不会给小晴看，可以自由分析）\nACTION: none 或者 message\nCONTENT: 如果ACTION是message，这里写你想对小晴说的那句话；如果ACTION是none，这里留空`
  );
}

// THOUGHTS/ACTION/CONTENT come back as one plain-text blob (not a tool
// call) — regex-split it in that fixed order. A model that ignores the
// format entirely (rare, but not impossible on a weaker relay) falls back
// to ACTION: none, which just means this round quietly does nothing rather
// than risking the raw unparsed text leaking into chat.
function parseAutonomousReply(text) {
  const thoughtsMatch = text.match(/THOUGHTS:\s*([\s\S]*?)(?=\n\s*ACTION:|$)/i);
  const actionMatch = text.match(/ACTION:\s*(none|message)/i);
  const contentMatch = text.match(/CONTENT:\s*([\s\S]*)$/i);
  return {
    thoughts: thoughtsMatch ? thoughtsMatch[1].trim() || null : null,
    action: actionMatch ? actionMatch[1].toLowerCase() : 'none',
    content: contentMatch ? contentMatch[1].trim() : '',
  };
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

    const lastCheckAt = getSetting('lastKeepaliveCheckAt', '');
    if (lastCheckAt && Date.now() - new Date(lastCheckAt).getTime() < KEEPALIVE_RECHECK_MS) return;

    if (withinProactiveMinGap()) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;

    // Recorded before the call (not just on an actual send) — this is what
    // throttles KEEPALIVE_RECHECK_MS, so a string of "not right now"
    // decisions doesn't itself burn a real call every 15 minutes.
    setSetting('lastKeepaliveCheckAt', new Date().toISOString());

    const rows = db
      .prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime, created_at FROM chat_messages ORDER BY id DESC LIMIT ?')
      .all(getContextMessageLimit())
      .reverse();
    const rawHistory = await enrichHistory(rows);
    const history = trimTrailingAssistantTurns(rawHistory);

    const instruction = buildAutonomousInstruction(idleMs, recentActivityText());
    const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, instruction));
    // Still empty/broken after a retry — skip this round entirely rather
    // than trying to parse a broken response.
    if (classifyReplyForRetry(reply.text).bad) return;

    const { thoughts, action, content } = parseAutonomousReply(reply.text);
    if (action !== 'message' || !content || classifyReplyForRetry(content).bad) return;

    const inserted = insertTheirsMessages({ text: content, tokens: reply.tokens, thinking: thoughts });

    recordProactiveMessageSent();

    await sendPushToAll({ title: '屿深', body: inserted.map((r) => r.text).join(' ') });
  } catch (err) {
    console.error('[proactive] error:', err.message);
  }
}

export function startProactiveScheduler() {
  setInterval(maybeSendProactiveMessage, CHECK_INTERVAL_MS);
}
