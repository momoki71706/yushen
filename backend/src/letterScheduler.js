import { db } from './db.js';
import { writeLetterReply } from './letterAi.js';

const CHECK_INTERVAL_MS = 60 * 1000;
// Letters read as slower and more deliberate than a quick diary comment —
// giving this a longer, more "took the time to actually write it" delay
// than the diary review-request's 1-2 minutes.
const MIN_REPLY_DELAY_MINUTES = 10;
const MAX_REPLY_DELAY_MINUTES = 60;
const MAX_REPLY_ATTEMPTS = 3; // 1 original attempt + 2 retries, same cap as diaryScheduler

export function pickReplyFireAt() {
  const minutes = MIN_REPLY_DELAY_MINUTES + Math.random() * (MAX_REPLY_DELAY_MINUTES - MIN_REPLY_DELAY_MINUTES);
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

const insertReplyLetter = db.prepare(
  `INSERT INTO letters (sender, recipient, signature, dear_text, unlock_date, body, opened, reply_to_id) VALUES ('屿深','小晴',?,?,?,?,0,?)`
);

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
  setInterval(maybeFulfillLetterReplyRequests, CHECK_INTERVAL_MS);
}
