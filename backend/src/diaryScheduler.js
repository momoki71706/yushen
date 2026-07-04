import { db, getSetting, setSetting } from './db.js';
import { beijingNow, weekdayLabel, formatBeijingClock } from './time.js';
import { writeDiaryEntry, reactToDiaryEntry, commentOnDiaryByRequest, moodColorFor } from './diaryAi.js';
import { sendPushToAll, pushConfigured } from './push.js';
import { classifyReplyForRetry, estimateTokens } from './persona.js';

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
  `INSERT INTO diary_entries (author, date_iso, date_label, mood, mood_color, weather, excerpt) VALUES ('them', ?, ?, ?, ?, ?, ?)`
);

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
  `INSERT INTO diary_comments (entry_id, author, text, time_label) VALUES (?, 'them', ?, ?)`
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
      // Mark reacted before generating — if generation throws, better to
      // silently skip one reaction than retry it every check forever.
      db.prepare('UPDATE diary_entries SET reacted = 1 WHERE id = ?').run(entry.id);
      try {
        const reaction = await reactToDiaryEntry(entry);
        if (!reaction) continue;
        if (!classifyReplyForRetry(reaction.comment).bad) {
          insertReactionComment.run(entry.id, reaction.comment, formatBeijingClock());
        }
        if (reaction.chatFollowUp && !classifyReplyForRetry(reaction.chatFollowUp).bad) {
          insertChatFollowUp.run('them', reaction.chatFollowUp, 'text', formatBeijingClock(), estimateTokens(reaction.chatFollowUp));
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
      db.prepare('UPDATE diary_review_requests SET done = 1 WHERE id = ?').run(req.id);
      try {
        const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.entry_id);
        if (!entry) continue;
        const result = await commentOnDiaryByRequest(entry);
        if (!result) continue;
        if (!classifyReplyForRetry(result.comment).bad) {
          insertReactionComment.run(entry.id, result.comment, formatBeijingClock());
        }
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
