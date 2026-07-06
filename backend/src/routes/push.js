import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { getVapidPublicKey, pushConfigured, saveSubscription, removeSubscription } from '../push.js';

const router = Router();

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey(), configured: pushConfigured });
});

router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'invalid subscription' });
  saveSubscription({ endpoint, keys });
  res.json({ ok: true });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) removeSubscription(endpoint);
  res.json({ ok: true });
});

// Defaults mirror what proactive.js used as hardcoded constants before
// these became adjustable — nothing changes for anyone who never opens
// the settings panel. Idle threshold / min gap are stored in minutes (not
// whole hours) so the 小时+分钟 scroll picker can express quarter-hours.
const PUSH_DEFAULTS = {
  idleThresholdMinutes: 240, // conversation has to be quiet this long before a proactive message is even considered
  minGapMinutes: 180, // don't send more than one proactive message this often, regardless of idle time
  quietHourStart: 0, // no proactive messages between quietHourStart and quietHourEnd (Beijing time)
  quietHourEnd: 8,
};

// `value || fallback` looks right but silently breaks for a genuinely
// valid 0 (e.g. quietHourStart: 0) — 0 is falsy, so it'd fall back to the
// default instead of clamping to min. This only ever falls back on a
// non-numeric input.
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function readPushSettings() {
  return {
    enabled: getSetting('proactiveMessagesEnabled', '0') === '1',
    idleThresholdMinutes: clampInt(getSetting('proactiveIdleThresholdMinutes', String(PUSH_DEFAULTS.idleThresholdMinutes)), 15, 2880, PUSH_DEFAULTS.idleThresholdMinutes),
    minGapMinutes: clampInt(getSetting('proactiveMinGapMinutes', String(PUSH_DEFAULTS.minGapMinutes)), 15, 2880, PUSH_DEFAULTS.minGapMinutes),
    quietHourStart: clampInt(getSetting('proactiveQuietHourStart', String(PUSH_DEFAULTS.quietHourStart)), 0, 23, PUSH_DEFAULTS.quietHourStart),
    quietHourEnd: clampInt(getSetting('proactiveQuietHourEnd', String(PUSH_DEFAULTS.quietHourEnd)), 0, 23, PUSH_DEFAULTS.quietHourEnd),
    diaryNotifyEnabled: getSetting('diaryNotifyEnabled', '0') === '1',
  };
}

router.get('/settings', (req, res) => {
  res.json(readPushSettings());
});

router.patch('/settings', (req, res) => {
  const { enabled, idleThresholdMinutes, minGapMinutes, quietHourStart, quietHourEnd, diaryNotifyEnabled } = req.body || {};
  if (enabled !== undefined) setSetting('proactiveMessagesEnabled', enabled ? '1' : '0');
  if (idleThresholdMinutes !== undefined) setSetting('proactiveIdleThresholdMinutes', String(clampInt(idleThresholdMinutes, 15, 2880, PUSH_DEFAULTS.idleThresholdMinutes)));
  if (minGapMinutes !== undefined) setSetting('proactiveMinGapMinutes', String(clampInt(minGapMinutes, 15, 2880, PUSH_DEFAULTS.minGapMinutes)));
  if (quietHourStart !== undefined) setSetting('proactiveQuietHourStart', String(clampInt(quietHourStart, 0, 23, PUSH_DEFAULTS.quietHourStart)));
  if (quietHourEnd !== undefined) setSetting('proactiveQuietHourEnd', String(clampInt(quietHourEnd, 0, 23, PUSH_DEFAULTS.quietHourEnd)));
  if (diaryNotifyEnabled !== undefined) setSetting('diaryNotifyEnabled', diaryNotifyEnabled ? '1' : '0');
  res.json(readPushSettings());
});

export default router;
