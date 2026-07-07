import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider } from './providers.js';
import { beijingNow } from './time.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { classifyReplyForRetry, withReplyRetry, estimateTokens } from './persona.js';
import { insertTheirsMessages } from './chatInsert.js';

// Checked often enough that a burst of late-night app-opens gets noticed
// within a few minutes, not left until the next quarter-hour.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LATE_NIGHT_START_HOUR = 23; // 23:00
const LATE_NIGHT_END_HOUR = 5; // until 05:00
const MIN_OPENS_TO_NUDGE = 3; // this many unseen opens since the last nudge before saying anything
const MIN_RENUDGE_GAP_MS = 45 * 60 * 1000; // don't nudge again this soon after the last one

function isLateNight(bNow) {
  const hour = bNow.getUTCHours();
  return hour >= LATE_NIGHT_START_HOUR || hour < LATE_NIGHT_END_HOUR;
}

function buildNudgeInstruction(appNames, openCount) {
  return `【深夜刷手机提醒】现在是深夜，小晴最近反复打开了：${appNames.join('、')}（最近打开了 ${openCount} 次），看起来还没睡。请以你一贯的人设，自然地说一句让她放下手机去睡觉的话（不超过20字），可以带点管她/宠溺的语气，不要写得像系统提醒，不要提到"监控""记录""次数"这类暴露程序逻辑的说法。只输出这句话本身。`;
}

async function maybeNudgeLateNightPhoneUse() {
  try {
    if (getSetting('proactiveMessagesEnabled', '0') !== '1') return;
    if (!pushConfigured) return;

    const bNow = beijingNow();
    if (!isLateNight(bNow)) return;

    const lastNudgeAt = getSetting('lastPhoneNudgeAt', '');
    if (lastNudgeAt && Date.now() - new Date(lastNudgeAt).getTime() < MIN_RENUDGE_GAP_MS) return;

    const sinceId = Number(getSetting('lastPhoneNudgeActivityId', '0')) || 0;
    const rows = db.prepare('SELECT * FROM phone_activity WHERE id > ? ORDER BY id ASC').all(sinceId);
    if (rows.length < MIN_OPENS_TO_NUDGE) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;

    const appNames = [...new Set(rows.map((r) => r.app_name))];
    // A minimal reference note, not the real chat history — this is a
    // fresh remark, not a reply, and an empty messages array would be
    // rejected outright by every provider API.
    const history = [{ from: 'me', text: `（深夜手机使用情况，仅供参考）\n${appNames.join('、')} 最近共打开 ${rows.length} 次` }];
    const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, buildNudgeInstruction(appNames, rows.length)));
    if (classifyReplyForRetry(reply.text).bad) return;

    const inserted = insertTheirsMessages({ ...reply, tokens: reply.tokens ?? estimateTokens(reply.text) });

    setSetting('lastPhoneNudgeAt', new Date().toISOString());
    setSetting('lastPhoneNudgeActivityId', String(rows[rows.length - 1].id));
    if (pushConfigured) await sendPushToAll({ title: '屿深', body: inserted.map((r) => r.text).join(' ') });
  } catch (err) {
    console.error('[phone-activity] error:', err.message);
  }
}

export function startPhoneActivityScheduler() {
  setInterval(maybeNudgeLateNightPhoneUse, CHECK_INTERVAL_MS);
}
