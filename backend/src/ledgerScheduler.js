import { db, getSetting, setSetting } from './db.js';
import { beijingNow, formatBeijingClock } from './time.js';
import { writeLedgerNag, writeLedgerCardMessage } from './ledgerAi.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { classifyReplyForRetry, estimateTokens } from './persona.js';

const CHECK_INTERVAL_MS = 60 * 1000;
const NAG_WINDOW_START_HOUR = 20;
const NAG_WINDOW_END_HOUR = 22;
// Spread across most of the day (not the small hours) so a refresh doesn't
// land while she's asleep and go unnoticed until the next one anyway.
const CARD_WINDOW_START_HOUR = 9;
const CARD_WINDOW_END_HOUR = 23;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayISOBeijing(bNow) {
  const y = bNow.getUTCFullYear();
  const m = String(bNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// (y, m, d, hh, mm) are Beijing wall-clock fields — same helper diaryScheduler
// uses to turn a chosen wall-clock moment back into a real epoch.
function beijingWallClockToEpoch(y, m, d, hh, mm) {
  return Date.UTC(y, m - 1, d, hh, mm) - BEIJING_OFFSET_MS;
}

function ensureNagFireEpoch(bNow, todayISO) {
  if (getSetting('ledgerNagFireDate', '') === todayISO) {
    const stored = Number(getSetting('ledgerNagFireAt', ''));
    if (Number.isFinite(stored)) return stored;
  }
  const startMinutes = NAG_WINDOW_START_HOUR * 60;
  const endMinutes = NAG_WINDOW_END_HOUR * 60;
  const fireMinutes = startMinutes + Math.random() * (endMinutes - startMinutes);
  const fireEpoch = beijingWallClockToEpoch(
    bNow.getUTCFullYear(),
    bNow.getUTCMonth() + 1,
    bNow.getUTCDate(),
    Math.floor(fireMinutes / 60) % 24,
    Math.floor(fireMinutes % 60)
  );
  setSetting('ledgerNagFireDate', todayISO);
  setSetting('ledgerNagFireAt', String(fireEpoch));
  return fireEpoch;
}

const insertChatNag = db.prepare(
  "INSERT INTO chat_messages (from_who, text, kind, time_label, tokens) VALUES ('them', ?, 'text', ?, ?)"
);

// Between 20:00-22:00, if today hasn't produced a single ledger_entries row
// yet, has him ask about it in chat once — same "pick one random moment in
// the window, resolve once per day" shape as diaryScheduler's daily write.
export async function maybeNagAboutLedger() {
  try {
    const bNow = beijingNow();
    const todayISO = todayISOBeijing(bNow);
    if (getSetting('lastLedgerNagDate', '') === todayISO) return;

    const fireEpoch = ensureNagFireEpoch(bNow, todayISO);
    if (Date.now() < fireEpoch) return;

    const hasEntryToday = db.prepare('SELECT 1 FROM ledger_entries WHERE date_iso = ? LIMIT 1').get(todayISO);
    if (hasEntryToday) {
      setSetting('lastLedgerNagDate', todayISO);
      return;
    }

    const result = await writeLedgerNag();
    if (!result) return; // no provider configured yet — keep waiting
    if (result.failed || classifyReplyForRetry(result.text || '').bad) return; // retry on the next tick

    insertChatNag.run(result.text, formatBeijingClock(), estimateTokens(result.text));
    setSetting('lastLedgerNagDate', todayISO);
    if (pushConfigured) await sendPushToAll({ title: '屿深', body: result.text });
  } catch (err) {
    console.error('[ledger] nag scheduler error:', err.message);
  }
}

function ensureCardFireEpochs(bNow, todayISO) {
  if (getSetting('ledgerCardMessageDate', '') === todayISO) {
    try {
      return JSON.parse(getSetting('ledgerCardMessageFireAts', '[]'));
    } catch {
      return [];
    }
  }
  const count = Math.random() < 0.5 ? 1 : 2;
  const startMinutes = CARD_WINDOW_START_HOUR * 60;
  const endMinutes = CARD_WINDOW_END_HOUR * 60;
  const epochs = [];
  for (let i = 0; i < count; i++) {
    const fireMinutes = startMinutes + Math.random() * (endMinutes - startMinutes);
    epochs.push(
      beijingWallClockToEpoch(
        bNow.getUTCFullYear(),
        bNow.getUTCMonth() + 1,
        bNow.getUTCDate(),
        Math.floor(fireMinutes / 60) % 24,
        Math.floor(fireMinutes % 60)
      )
    );
  }
  epochs.sort((a, b) => a - b);
  setSetting('ledgerCardMessageDate', todayISO);
  setSetting('ledgerCardMessageFireAts', JSON.stringify(epochs));
  return epochs;
}

// Refreshes the 记账 card's subtitle 1-2 times a day at random moments —
// replaces the old static rotating-string placeholder with something that
// actually reads her recent entries/budget. Skips quietly (tries again next
// tick) if nothing's been logged yet or the call fails.
export async function maybeRefreshLedgerCardMessage() {
  try {
    const bNow = beijingNow();
    const todayISO = todayISOBeijing(bNow);
    const epochs = ensureCardFireEpochs(bNow, todayISO);
    if (!epochs.length || Date.now() < epochs[0]) return;

    const result = await writeLedgerCardMessage();
    if (!result) return; // no provider configured yet — keep waiting
    if (result.failed) return; // retry next tick

    // Pop the fired epoch either way — "nothing to say yet" (no entries at
    // all) still counts as this slot resolved, not a failure to retry.
    setSetting('ledgerCardMessageFireAts', JSON.stringify(epochs.slice(1)));
    if (result.text && !classifyReplyForRetry(result.text).bad) {
      setSetting('ledgerCardMessage', result.text);
    }
  } catch (err) {
    console.error('[ledger] card-message scheduler error:', err.message);
  }
}

export function startLedgerScheduler() {
  setInterval(() => {
    maybeNagAboutLedger();
    maybeRefreshLedgerCardMessage();
  }, CHECK_INTERVAL_MS);
}
