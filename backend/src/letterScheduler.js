import { db, getSetting, setSetting } from './db.js';
import { writeLetterReply, writeFreshLetter } from './letterAi.js';
import { classifyReplyForRetry } from './persona.js';

const CHECK_INTERVAL_MS = 60 * 1000;
// Letters read as slower and more deliberate than a quick diary comment —
// giving this a longer, more "took the time to actually write it" delay
// than the diary review-request's 1-2 minutes.
const MIN_REPLY_DELAY_MINUTES = 10;
const MAX_REPLY_DELAY_MINUTES = 60;
const MAX_REPLY_ATTEMPTS = 3; // 1 original attempt + 2 retries, same cap as diaryScheduler

// Unlike diary entries (once a day, in a fixed evening window), an
// unprompted letter is meant to read as rare and a little unexpected —
// spaced days apart rather than daily, with no fixed time of day.
const MIN_FRESH_LETTER_DAYS = 3;
const MAX_FRESH_LETTER_DAYS = 7;
// A failed attempt (network/model error) retries soon after, same spirit as
// everywhere else — it just doesn't wait out the whole multi-day span again.
const FRESH_LETTER_RETRY_MINUTES = 30;

export function pickReplyFireAt() {
  const minutes = MIN_REPLY_DELAY_MINUTES + Math.random() * (MAX_REPLY_DELAY_MINUTES - MIN_REPLY_DELAY_MINUTES);
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function pickFreshLetterFireEpoch() {
  const days = MIN_FRESH_LETTER_DAYS + Math.random() * (MAX_FRESH_LETTER_DAYS - MIN_FRESH_LETTER_DAYS);
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

function ensureFreshLetterFireEpoch() {
  const stored = Number(getSetting('letterFreshFireAt', ''));
  if (Number.isFinite(stored) && stored > 0) return stored;
  const next = pickFreshLetterFireEpoch();
  setSetting('letterFreshFireAt', String(next));
  return next;
}

const insertReplyLetter = db.prepare(
  `INSERT INTO letters (sender, recipient, signature, dear_text, unlock_date, body, opened, reply_to_id) VALUES ('屿深','小晴',?,?,?,?,0,?)`
);
const insertFreshLetter = db.prepare(
  `INSERT INTO letters (sender, recipient, signature, dear_text, unlock_date, body, opened) VALUES ('屿深','小晴',?,?,?,?,0)`
);

// Autonomous counterpart to the manual "让他现在给我写信" debug trigger —
// picks a random multi-day gap and, once it elapses, has him write an
// unprompted letter with no specific reply target. Without this, a letter
// from him only ever existed as a reply, which meant a mailbox could never
// get its very first received letter without the manual trigger.
export async function maybeWriteFreshLetter() {
  try {
    const fireEpoch = ensureFreshLetterFireEpoch();
    if (Date.now() < fireEpoch) return;

    const result = await writeFreshLetter();
    if (!result) return; // no provider configured yet — keep waiting, don't reschedule

    if (result.failed || !result.reply || classifyReplyForRetry(result.reply?.body || '').bad) {
      setSetting('letterFreshFireAt', String(Date.now() + FRESH_LETTER_RETRY_MINUTES * 60 * 1000));
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    insertFreshLetter.run(result.reply.signature, result.reply.dearText, today, result.reply.body);
    setSetting('letterFreshFireAt', String(pickFreshLetterFireEpoch()));
  } catch (err) {
    console.error('[letters] fresh-letter scheduler error:', err.message);
  }
}

// Fulfills a "去回信" request queued from the letter compose screen — same
// bounded-retry shape as diaryScheduler's review requests: a failed attempt
// (network/model error) gets retried a couple of times, but the model
// genuinely declining to reply (or the source letter just not being long
// enough to have queued in the first place) is a real outcome, not a
// glitch, and isn't retried.
export async function maybeFulfillLetterReplyRequests() {
  try {
    const due = db.prepare('SELECT * FROM letter_reply_requests WHERE done = 0 AND fire_at <= ?').all(new Date().toISOString());
    if (!due.length) return;

    for (const req of due) {
      try {
        const source = db.prepare('SELECT * FROM letters WHERE id = ?').get(req.source_letter_id);
        if (!source) {
          db.prepare('UPDATE letter_reply_requests SET done = 1 WHERE id = ?').run(req.id);
          continue;
        }

        const result = await writeLetterReply(source);
        if (!result) continue; // no provider configured yet — keep waiting

        if (result.failed) {
          const attempts = req.attempts + 1;
          if (attempts < MAX_REPLY_ATTEMPTS) {
            db.prepare('UPDATE letter_reply_requests SET attempts = ? WHERE id = ?').run(attempts, req.id);
          } else {
            db.prepare('UPDATE letter_reply_requests SET done = 1 WHERE id = ?').run(req.id);
          }
          continue;
        }

        db.prepare('UPDATE letter_reply_requests SET done = 1 WHERE id = ?').run(req.id);
        if (!result.reply) continue; // he read it and genuinely decided not to write back

        const today = new Date().toISOString().slice(0, 10);
        insertReplyLetter.run(result.reply.signature, result.reply.dearText, today, result.reply.body, source.id);
      } catch (err) {
        console.error(`[letters] reply request failed for #${req.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[letters] reply-request scheduler error:', err.message);
  }
}

export function startLetterScheduler() {
  setInterval(() => {
    maybeWriteFreshLetter();
    maybeFulfillLetterReplyRequests();
  }, CHECK_INTERVAL_MS);
}
