import { db, getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider } from './providers.js';
import { formatBeijingClock } from './time.js';
import { sendPushToAll } from './push.js';

// Checked far more often than the idle-based proactive scheduler (15 min)
// since "in 5 minutes" needs to actually mean roughly 5 minutes, not
// "sometime in the next 15."
const CHECK_INTERVAL_MS = 60 * 1000;
const CONTEXT_MESSAGE_LIMIT = 20;

async function fireDueScheduledMessages() {
  try {
    const due = db.prepare('SELECT * FROM scheduled_messages WHERE sent = 0 AND fire_at <= ?').all(new Date().toISOString());
    if (!due.length) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;

    for (const row of due) {
      // Mark sent before generating the reply — if generation throws, we'd
      // rather silently miss one reminder than retry it every minute forever.
      db.prepare('UPDATE scheduled_messages SET sent = 1 WHERE id = ?').run(row.id);
      if (!provider) continue;

      const history = db
        .prepare('SELECT from_who, text FROM chat_messages ORDER BY id DESC LIMIT ?')
        .all(CONTEXT_MESSAGE_LIMIT)
        .reverse()
        .map((r) => ({ from: r.from_who, text: r.text }));

      const instruction = `【预约提醒】之前答应过要提醒一件事，内容是："${row.note}"。现在时间到了，请自然地把这条提醒带出来，符合你一贯的人设和语气，简短自然。不要提及"预约""系统""定时""提醒事项"这类暴露是程序生成的说法，就当作你自己想起来要说。只输出这条消息本身。`;

      try {
        const reply = await getReplyViaProvider(history, provider, instruction);
        if (!reply.text) continue;
        db.prepare(
          'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking) VALUES (?,?,?,?,?,?)'
        ).run('them', reply.text, 'text', formatBeijingClock(), reply.tokens, reply.thinking || null);
        await sendPushToAll({ title: '屿深', body: reply.text });
      } catch (err) {
        console.error(`[scheduled] failed to fire reminder #${row.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[scheduled] error:', err.message);
  }
}

export function startScheduledMessageChecker() {
  setInterval(fireDueScheduledMessages, CHECK_INTERVAL_MS);
}
