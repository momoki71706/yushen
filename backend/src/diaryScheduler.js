import { db, getSetting, setSetting } from './db.js';
import { beijingNow, weekdayLabel, formatBeijingClock } from './time.js';
import { writeDiaryEntry, reactToDiaryEntry, commentOnDiaryByRequest, moodColorFor } from './diaryAi.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { FALLBACK_REPLY, classifyReplyForRetry, estimateTokens } from './persona.js';
import { proactiveMessagingEnabled, withinProactiveMinGap, recordProactiveMessageSent } from './proactive.js';

// A diary comment/feedback attempt gets retried on the next couple of
// checks (one retry per minute-ish tick) before giving up for good — unlike
// maybeWriteDiary, which just keeps trying all day, these are tied to one
// specific triggering event and shouldn't retry forever.
const MAX_REACTION_ATTEMPTS = 3; // 1 original attempt + 2 retries

// Checked at the same cadence as scheduledMessages.js — the review-request
// path (comment_on_diary) fires within 1-5 minutes, so a coarser interval
// would make that feel sluggish even though the other two checks here
// (daily write, delayed reaction) don't need anything this tight.
const CHECK_INTERVAL_MS = 60 * 1000;
const WRITE_WINDOW_START_HOUR = 21;
const WRITE_WINDOW_END_HOUR = 24;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayISOBeijing(bNow) {
  const y = bNow.getUTCFullYear();
  const m = String(bNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diaryDateLabel(bNow) {
  return `${bNow.getUTCMonth() + 1}月${bNow.getUTCDate()}日 · ${weekdayLabel(bNow)}`;
}

// (y, m, d, hh, mm) are Beijing wall-clock fields — converts them to the
// real UTC epoch they correspond to, the reverse of how beijingNow() shifts
// a real epoch into Beijing-labeled UTC-getter fields.
function beijingWallClockToEpoch(y, m, d, hh, mm) {
  return Date.UTC(y, m - 1, d, hh, mm) - BEIJING_OFFSET_MS;
}

// Picks (once per day, stable across checks) a random real-time instant
// within the write window that today's Beijing date maps to, so the AI's
// diary doesn't always land at the same time and can't refire once chosen.
function ensureTodayFireEpoch(bNow, todayISO) {
  if (getSetting('diaryWriteFireDate', '') === todayISO) {
    const stored = Number(getSetting('diaryWriteFireAt', ''));
    if (Number.isFinite(stored)) return stored;
  }
  const startMinutes = WRITE_WINDOW_START_HOUR * 60;
  const endMinutes = WRITE_WINDOW_END_HOUR * 60;
  const fireMinutes = startMinutes + Math.floor(Math.random() * (endMinutes - startMinutes));
  const fireEpoch = beijingWallClockToEpoch(
    bNow.getUTCFullYear(),
    bNow.getUTCMonth() + 1,
    bNow.getUTCDate(),
    Math.floor(fireMinutes / 60) % 24,
    fireMinutes % 60
  );
  setSetting('diaryWriteFireDate', todayISO);
  setSetting('diaryWriteFireAt', String(fireEpoch));
  return fireEpoch;
}

const insertTheirsDiary = db.prepare(
  `INSERT INTO diary_entries (author, date_iso, date_label, mood, mood_color, weather, excerpt, read_by_me) VALUES ('them', ?, ?, ?, ?, ?, ?, 0)`
);

async function notifyDiaryComment(commentText) {
  if (pushConfigured && getSetting('diaryNotifyEnabled', '0') === '1') {
    await sendPushToAll({ title: '屿深评论了日记', body: commentText.slice(0, 60) });
  }
}

export async function maybeWriteDiary() {
  try {
    const bNow = beijingNow();
    const todayISO = todayISOBeijing(bNow);
    if (getSetting('lastDiaryWriteDate', '') === todayISO) return;

    const fireEpoch = ensureTodayFireEpoch(bNow, todayISO);
    if (Date.now() < fireEpoch) return;

    const written = await writeDiaryEntry();
    // No active provider, or the call failed/came back empty — leave
    // lastDiaryWriteDate untouched so the next check (5 min later) retries
    // instead of silently skipping the whole day on a transient failure.
    if (!written || classifyReplyForRetry(written.excerpt).bad) return;

    insertTheirsDiary.run(todayISO, diaryDateLabel(bNow), written.mood, moodColorFor(written.mood), written.weather, written.excerpt);
    setSetting('lastDiaryWriteDate', todayISO);

    if (pushConfigured && getSetting('diaryNotifyEnabled', '0') === '1') {
      await sendPushToAll({ title: '屿深写了一篇日记', body: written.excerpt.slice(0, 60) });
    }
  } catch (err) {
    console.error('[diary] write error:', err.message);
  }
}

const insertReactionComment = db.prepare(
  `INSERT INTO diary_comments (entry_id, author, text, time_label, read_by_me) VALUES (?, 'them', ?, ?, 0)`
);
const insertChatFollowUp = db.prepare(
  'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens) VALUES (?,?,?,?,?)'
);

// Simulates "didn't see it right away" — a diary entry you post gets its
// AI reaction some random minutes later (within REACT_DELAY_MAX_MINUTES,
// set at insert time in routes/diary.js), not the instant you save it.
export async function maybeReactToDiaries() {
  try {
    const due = db
      .prepare("SELECT * FROM diary_entries WHERE author = 'me' AND reacted = 0 AND react_at IS NOT NULL AND react_at <= ?")
      .all(new Date().toISOString());
    if (!due.length) return;

    for (const entry of due) {
      try {
        const reaction = await reactToDiaryEntry(entry);
        if (!reaction) continue; // no provider configured yet — keep waiting, doesn't count as a failed attempt

        if (classifyReplyForRetry(reaction.comment).bad) {
          const attempts = entry.react_attempts + 1;
          if (attempts < MAX_REACTION_ATTEMPTS) {
            db.prepare('UPDATE diary_entries SET react_attempts = ? WHERE id = ?').run(attempts, entry.id);
            continue;
          }
          // Out of retries — surface the actual failure instead of just
          // going quiet, so a real outage doesn't read as him simply never
          // having noticed.
          db.prepare('UPDATE diary_entries SET reacted = 1 WHERE id = ?').run(entry.id);
          insertReactionComment.run(entry.id, reaction.comment || FALLBACK_REPLY, formatBeijingClock());
          continue;
        }

        db.prepare('UPDATE diary_entries SET reacted = 1 WHERE id = ?').run(entry.id);
        insertReactionComment.run(entry.id, reaction.comment, formatBeijingClock());
        await notifyDiaryComment(reaction.comment);
        // The diary comment itself always lands regardless of this setting
        // — only the bonus chat-side mention counts as an unprompted "them"
        // message, so it respects the same toggle/cooldown as the other
        // proactive-message sources.
        if (
          reaction.chatFollowUp &&
          !classifyReplyForRetry(reaction.chatFollowUp).bad &&
          proactiveMessagingEnabled() &&
          !withinProactiveMinGap()
        ) {
          insertChatFollowUp.run('them', reaction.chatFollowUp, 'text', formatBeijingClock(), estimateTokens(reaction.chatFollowUp));
          recordProactiveMessageSent();
          if (pushConfigured) await sendPushToAll({ title: '屿深', body: reaction.chatFollowUp });
        }
      } catch (err) {
        console.error(`[diary] reaction failed for entry #${entry.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[diary] reaction scheduler error:', err.message);
  }
}

// Fulfills a comment_on_diary request queued from chat — always writes both
// the diary comment and a chat follow-up (unlike maybeReactToDiaries, which
// only sends a chat message when the mood happens to warrant it), and never
// pushes a notification for the follow-up: you're the one who asked for
// this, so there's nothing to alert you to.
export async function maybeFulfillDiaryReviewRequests() {
  try {
    const due = db.prepare('SELECT * FROM diary_review_requests WHERE done = 0 AND fire_at <= ?').all(new Date().toISOString());
    if (!due.length) return;

    for (const req of due) {
      try {
        const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.entry_id);
        if (!entry) {
          db.prepare('UPDATE diary_review_requests SET done = 1 WHERE id = ?').run(req.id);
          continue;
        }
        const result = await commentOnDiaryByRequest(entry);
        if (!result) continue; // no provider configured yet — keep waiting

        if (classifyReplyForRetry(result.comment).bad) {
          const attempts = req.attempts + 1;
          if (attempts < MAX_REACTION_ATTEMPTS) {
            db.prepare('UPDATE diary_review_requests SET attempts = ? WHERE id = ?').run(attempts, req.id);
            continue;
          }
          db.prepare('UPDATE diary_review_requests SET done = 1 WHERE id = ?').run(req.id);
          insertReactionComment.run(entry.id, result.comment || FALLBACK_REPLY, formatBeijingClock());
          continue;
        }

        db.prepare('UPDATE diary_review_requests SET done = 1 WHERE id = ?').run(req.id);
        insertReactionComment.run(entry.id, result.comment, formatBeijingClock());
        await notifyDiaryComment(result.comment);
        if (result.chatFeedback && !classifyReplyForRetry(result.chatFeedback).bad) {
          insertChatFollowUp.run('them', result.chatFeedback, 'text', formatBeijingClock(), estimateTokens(result.chatFeedback));
        }
      } catch (err) {
        console.error(`[diary] review request failed for #${req.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[diary] review-request scheduler error:', err.message);
  }
}

export function startDiaryScheduler() {
  setInterval(() => {
    maybeWriteDiary();
    maybeReactToDiaries();
    maybeFulfillDiaryReviewRequests();
  }, CHECK_INTERVAL_MS);
}
backend/src/routes/push.js
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
frontend/src/components/HoursMinutesPicker.jsx
import { useEffect, useRef } from 'react';

const ITEM_HEIGHT = 34;
const VISIBLE_PAD = ITEM_HEIGHT * 2;
const HOUR_OPTIONS = Array.from({ length: 49 }, (_, i) => i); // 0-48
const MINUTE_OPTIONS = [0, 15, 30, 45];

function WheelColumn({ options, value, onChange }) {
  const scrollRef = useRef(null);
  const skipNextScroll = useRef(false);
  const settleTimer = useRef(null);

  useEffect(() => {
    const idx = options.indexOf(value);
    if (scrollRef.current && idx >= 0) {
      skipNextScroll.current = true;
      scrollRef.current.scrollTop = idx * ITEM_HEIGHT;
    }
  }, [value, options]);

  const handleScroll = () => {
    if (skipNextScroll.current) {
      skipNextScroll.current = false;
      return;
    }
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
      el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
      if (options[idx] !== value) onChange(options[idx]);
    }, 130);
  };

  return (
    <div className="wheel-picker-col" ref={scrollRef} onScroll={handleScroll}>
      <div style={{ height: VISIBLE_PAD }} />
      {options.map((o) => (
        <div
          key={o}
          className={`wheel-picker-item${o === value ? ' wheel-picker-item--active' : ''}`}
          style={{ height: ITEM_HEIGHT }}
        >
          {o}
        </div>
      ))}
      <div style={{ height: VISIBLE_PAD }} />
    </div>
  );
}

// A native-feeling scroll wheel for picking a duration as 小时+分钟 (minutes
// snap to quarter-hours) rather than a single stepper — used by the two
// proactive-message timing settings in PushSettingsPanel.
export default function HoursMinutesPicker({ totalMinutes, onChange, min = 15, max = 2880 }) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const commit = (h, m) => {
    onChange(Math.max(min, Math.min(max, h * 60 + m)));
  };

  return (
    <div className="wheel-picker-row">
      <div className="wheel-picker-highlight" />
      <WheelColumn options={HOUR_OPTIONS} value={hours} onChange={(h) => commit(h, minutes)} />
      <div className="wheel-picker-unit">小时</div>
      <WheelColumn options={MINUTE_OPTIONS} value={minutes} onChange={(m) => commit(hours, m)} />
      <div className="wheel-picker-unit">分钟</div>
    </div>
  );
}
