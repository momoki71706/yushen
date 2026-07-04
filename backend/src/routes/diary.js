import { Router } from 'express';
import { db } from '../db.js';
import { beijingNow, weekdayLabel, formatBeijingClock } from '../time.js';
import { writeDiaryEntry, replyToDiaryComment, moodColorFor } from '../diaryAi.js';
import { classifyReplyForRetry } from '../persona.js';

const router = Router();

const REACT_DELAY_MAX_MINUTES = 30;

function serialize(row) {
  return {
    id: row.id,
    author: row.author,
    dateISO: row.date_iso,
    dateLabel: row.date_label,
    mood: row.mood,
    moodColor: row.mood_color,
    weather: row.weather,
    tag: row.tag,
    excerpt: row.excerpt,
    hasAttachment: !!row.has_attachment,
  };
}

function serializeComment(row) {
  return { id: row.id, entryId: row.entry_id, author: row.author, text: row.text, time: row.time_label };
}

function diaryDateLabel(bNow) {
  return `${bNow.getUTCMonth() + 1}月${bNow.getUTCDate()}日 · ${weekdayLabel(bNow)}`;
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM diary_entries ORDER BY id DESC').all();
  res.json(rows.map(serialize));
});

router.post('/', (req, res) => {
  const { text, mood, weather, tag, hasAttachment } = req.body;
  const trimmed = (text || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'text is required' });

  const bNow = beijingNow();
  const dateISO = `${bNow.getUTCFullYear()}-${String(bNow.getUTCMonth() + 1).padStart(2, '0')}-${String(bNow.getUTCDate()).padStart(2, '0')}`;
  const resolvedMood = mood || '平静';
  const reactAt = new Date(Date.now() + Math.random() * REACT_DELAY_MAX_MINUTES * 60 * 1000).toISOString();

  const info = db
    .prepare(
      `INSERT INTO diary_entries (author, date_iso, date_label, mood, mood_color, weather, tag, excerpt, has_attachment, reacted, react_at)
       VALUES ('me',?,?,?,?,?,?,?,?,0,?)`
    )
    .run(dateISO, diaryDateLabel(bNow), resolvedMood, moodColorFor(resolvedMood), weather || '晴', tag || null, trimmed, hasAttachment ? 1 : 0, reactAt);

  const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(info.lastInsertRowid);
  res.json(serialize(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM diary_comments WHERE entry_id = ?').run(req.params.id);
  db.prepare('DELETE FROM diary_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/comments', (req, res) => {
  const rows = db.prepare('SELECT * FROM diary_comments WHERE entry_id = ? ORDER BY id ASC').all(req.params.id);
  res.json(rows.map(serializeComment));
});

// Adds your comment, then generates the AI's reply comment in the same
// round-trip — same pattern as posting a chat message and getting a reply
// back together, just scoped to this one diary entry's thread.
router.post('/:id/comments', async (req, res) => {
  const entryId = Number(req.params.id);
  const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entryId);
  if (!entry) return res.status(404).json({ error: 'entry not found' });
  const { text } = req.body;
  const trimmed = (text || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'text is required' });

  const mineInfo = db
    .prepare('INSERT INTO diary_comments (entry_id, author, text, time_label) VALUES (?, ?, ?, ?)')
    .run(entryId, 'me', trimmed, formatBeijingClock());
  const mine = db.prepare('SELECT * FROM diary_comments WHERE id = ?').get(mineInfo.lastInsertRowid);

  const comments = db.prepare('SELECT * FROM diary_comments WHERE entry_id = ? ORDER BY id ASC').all(entryId);
  const replyText = await replyToDiaryComment(entry, comments);
  if (!replyText || classifyReplyForRetry(replyText).bad) {
    return res.json({ mine: serializeComment(mine), reply: null });
  }
  const theirsInfo = db
    .prepare('INSERT INTO diary_comments (entry_id, author, text, time_label) VALUES (?, ?, ?, ?)')
    .run(entryId, 'them', replyText, formatBeijingClock());
  const theirs = db.prepare('SELECT * FROM diary_comments WHERE id = ?').get(theirsInfo.lastInsertRowid);
  res.json({ mine: serializeComment(mine), reply: serializeComment(theirs) });
});

// Re-writes one of the AI's own diary entries from scratch, overwriting it
// in place — its old comment thread gets cleared out too, since those
// comments were replying to content that no longer exists after this.
router.post('/:id/regenerate', async (req, res) => {
  const id = Number(req.params.id);
  const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(id);
  if (!entry) return res.status(404).json({ error: 'entry not found' });
  if (entry.author !== 'them') return res.status(400).json({ error: 'only AI diary entries can be regenerated' });

  const written = await writeDiaryEntry();
  if (!written) return res.status(400).json({ error: '还没有配置好的 AI 供应商' });

  db.prepare('UPDATE diary_entries SET mood = ?, mood_color = ?, weather = ?, excerpt = ? WHERE id = ?').run(
    written.mood,
    moodColorFor(written.mood),
    written.weather,
    written.excerpt,
    id
  );
  db.prepare('DELETE FROM diary_comments WHERE entry_id = ?').run(id);

  const updated = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(id);
  res.json(serialize(updated));
});

export default router;
