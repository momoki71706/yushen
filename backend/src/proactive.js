import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider } from './providers.js';
import { formatBeijingClock, beijingNow } from './time.js';
import { sendPushToAll, pushConfigured } from './push.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often the scheduler wakes up to check
const IDLE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // conversation has to be quiet this long before a proactive message is even considered
const MIN_GAP_BETWEEN_PROACTIVE_MS = 3 * 60 * 60 * 1000; // don't send more than one proactive message this often, regardless of idle time
const QUIET_HOURS_START = 0; // no proactive messages between 00:00 and 08:00 Beijing time
const QUIET_HOURS_END = 8;
const CONTEXT_MESSAGE_LIMIT = 30;

const PROACTIVE_INSTRUCTION = `【主动消息】你已经有一段时间没有和小晴说话了，现在想主动发一条消息给她——可以是突然想她了、单纯分享点什么、或者关心问候一下。要符合你一贯的人设和说话风格，简短自然。绝对不要提到"系统""触发""很久没上线""自动"这类会暴露这是程序生成的说法，就当作是你自己真的想说话。只输出这条消息本身，不要加任何前后缀。`;

function isQuietHours() {
  const hour = beijingNow().getUTCHours();
  return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
}

async function maybeSendProactiveMessage() {
  try {
    if (getSetting('proactiveMessagesEnabled', '0') !== '1') return;
    if (!pushConfigured) return;
    if (isQuietHours()) return;

    const last = db.prepare('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 1').get();
    if (!last) return;
    const idleMs = Date.now() - new Date(`${last.created_at}Z`).getTime();
    if (idleMs < IDLE_THRESHOLD_MS) return;

    const lastProactiveAt = getSetting('lastProactiveMessageAt', '');
    if (lastProactiveAt && Date.now() - new Date(lastProactiveAt).getTime() < MIN_GAP_BETWEEN_PROACTIVE_MS) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;

    const history = db
      .prepare('SELECT from_who, text FROM chat_messages ORDER BY id DESC LIMIT ?')
      .all(CONTEXT_MESSAGE_LIMIT)
      .reverse()
      .map((r) => ({ from: r.from_who, text: r.text }));

    const reply = await getReplyViaProvider(history, provider, PROACTIVE_INSTRUCTION);
    if (!reply.text) return;

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
