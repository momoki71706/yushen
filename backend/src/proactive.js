import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, trimTrailingAssistantTurns } from './providers.js';
import { formatBeijingClock, beijingNow } from './time.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { classifyReplyForRetry, withReplyRetry } from './persona.js';
import { getContextMessageLimit } from './contextSettings.js';
import { describeForHistory } from './chatHistory.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often the scheduler wakes up to check

// Defaults for the settings below live in routes/push.js (source of truth
// for what a fresh install behaves like); read fresh on every check so a
// change in the settings panel takes effect on the next cycle without a
// restart.
function getIdleThresholdMs() {
  return Number(getSetting('proactiveIdleThresholdHours', '4')) * 3600000;
}
function getMinGapMs() {
  return Number(getSetting('proactiveMinGapHours', '3')) * 3600000;
}
function getQuietHourStart() {
  return Number(getSetting('proactiveQuietHourStart', '0'));
}
function getQuietHourEnd() {
  return Number(getSetting('proactiveQuietHourEnd', '8'));
}

function buildProactiveInstruction(idleMs) {
  const idleHours = Math.max(1, Math.round(idleMs / 3600000));
  return `【主动消息】你已经大概${idleHours}个小时没有和小晴说话了，现在想主动给她发一条消息——可以是突然想她了、单纯分享点什么、或者结合当前时间段问候关心一下（比如早安/午安/晚安）。

这是你自己重新起的一个话头，不是接着聊天记录里最后一条往下接话——不要对最后一条消息的具体内容做出回应、评价、或接话，除非那件事本身就值得你隔了这么久之后主动问一句后续。默认就当作是过了一段安静的时间后，你自己突然想起她、想说说话。

要符合你一贯的人设和说话风格，简短自然。绝对不要提到"系统""触发""很久没上线""自动"这类会暴露这是程序生成的说法，就当作是你自己真的想说话。只输出这条消息本身，不要加任何前后缀。`;
}

function isQuietHours() {
  const hour = beijingNow().getUTCHours();
  const start = getQuietHourStart();
  const end = getQuietHourEnd();
  return hour >= start && hour < end;
}

async function maybeSendProactiveMessage() {
  try {
    if (getSetting('proactiveMessagesEnabled', '0') !== '1') return;
    if (!pushConfigured) return;
    if (isQuietHours()) return;

    const last = db.prepare('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 1').get();
    if (!last) return;
    const idleMs = Date.now() - new Date(`${last.created_at}Z`).getTime();
    if (idleMs < getIdleThresholdMs()) return;

    const lastProactiveAt = getSetting('lastProactiveMessageAt', '');
    if (lastProactiveAt && Date.now() - new Date(lastProactiveAt).getTime() < getMinGapMs()) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;

    const rawHistory = db
      .prepare('SELECT from_who, text, kind, attachment_name FROM chat_messages ORDER BY id DESC LIMIT ?')
      .all(getContextMessageLimit())
      .reverse()
      .map((r) => ({ from: r.from_who, text: describeForHistory(r) }));
    const history = trimTrailingAssistantTurns(rawHistory);

    const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, buildProactiveInstruction(idleMs)));
    // Still empty/broken after a retry — skip this round rather than push
    // an internal error line ("钥匙好像失效了") as if it were a real message.
    if (classifyReplyForRetry(reply.text).bad) return;

    db.prepare(
      'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking) VALUES (?,?,?,?,?,?)'
    ).run('them', reply.text, 'text', formatBeijingClock(), reply.tokens, reply.thinking || null);

    setSetting('lastProactiveMessageAt', new Date().toISOString());

    await sendPushToAll({ title: '屿深', body: reply.text });
  } catch (err) {
    console.error('[proactive] error:', err.message);
  }
}

export function startProactiveScheduler() {
  setInterval(maybeSendProactiveMessage, CHECK_INTERVAL_MS);
}
