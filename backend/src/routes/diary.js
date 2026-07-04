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
    hasUnread: !!row.has_unread,
    attachment: row.attachment_url
      ? { url: row.attachment_url, name: row.attachment_name, mime: row.attachment_mime, size: row.attachment_size }
      : null,
  };
}

function serializeComment(row) {
  return { id: row.id, entryId: row.entry_id, author: row.author, text: row.text, time: row.time_label };
}

function diaryDateLabel(bNow) {
  return `${bNow.getUTCMonth() + 1}月${bNow.getUTCDate()}日 · ${weekdayLabel(bNow)}`;
}

const LIST_QUERY = `
  SELECT e.*,
    CASE WHEN (e.author = 'them' AND e.read_by_me = 0)
           OR EXISTS(SELECT 1 FROM diary_comments c WHERE c.entry_id = e.id AND c.author = 'them' AND c.read_by_me = 0)
         THEN 1 ELSE 0 END AS has_unread
  FROM diary_entries e
`;

router.get('/', (req, res) => {
  const rows = db.prepare(`${LIST_QUERY} ORDER BY e.id DESC`).all();
  res.json(rows.map(serialize));
});

// Used by the app-open reminder popup and the 日记通知 push — counts
// content authored by him that you haven't actually opened yet.
router.get('/unread-summary', (req, res) => {
  const unreadEntries = db.prepare("SELECT COUNT(*) c FROM diary_entries WHERE author = 'them' AND read_by_me = 0").get().c;
  const unreadComments = db.prepare("SELECT COUNT(*) c FROM diary_comments WHERE author = 'them' AND read_by_me = 0").get().c;
  res.json({ unreadEntries, unreadComments });
});

// Debug/manual trigger — forces him to write a diary entry right now
// instead of waiting for the random 21:00-24:00 window, purely so this (and
// everything downstream of it, like the delayed reaction it can trigger)
// can actually be tested on demand. Leaves lastDiaryWriteDate untouched, so
// the normal autonomous scheduler isn't affected by using this.
router.post('/trigger-write', async (req, res) => {
  const written = await writeDiaryEntry();
  if (!written) return res.status(400).json({ error: '还没有配置好的 AI 供应商' });
  if (classifyReplyForRetry(written.excerpt).bad) return res.status(502).json({ error: '这次生成失败了，再试一次' });

  const bNow = beijingNow();
  const dateISO = `${bNow.getUTCFullYear()}-${String(bNow.getUTCMonth() + 1).padStart(2, '0')}-${String(bNow.getUTCDate()).padStart(2, '0')}`;
  const info = db
    .prepare(
      `INSERT INTO diary_entries (author, date_iso, date_label, mood, mood_color, weather, excerpt, read_by_me) VALUES ('them', ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(dateISO, diaryDateLabel(bNow), written.mood, moodColorFor(written.mood), written.weather, written.excerpt);

  const row = db.prepare(`${LIST_QUERY} WHERE e.id = ?`).get(info.lastInsertRowid);
  res.json(serialize(row));
});

router.post('/', (req, res) => {
  const { text, mood, weather, tag, attachment } = req.body;
  const trimmed = (text || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'text is required' });

  const bNow = beijingNow();
  const dateISO = `${bNow.getUTCFullYear()}-${String(bNow.getUTCMonth() + 1).padStart(2, '0')}-${String(bNow.getUTCDate()).padStart(2, '0')}`;
  const resolvedMood = mood || '平静';
  const reactAt = new Date(Date.now() + Math.random() * REACT_DELAY_MAX_MINUTES * 60 * 1000).toISOString();

  const info = db
    .prepare(
      `INSERT INTO diary_entries (author, date_iso, date_label, mood, mood_color, weather, tag, excerpt, reacted, react_at, read_by_me, attachment_url, attachment_name, attachment_mime, attachment_size)
       VALUES ('me',?,?,?,?,?,?,?,0,?,1,?,?,?,?)`
    )
    .run(
      dateISO,
      diaryDateLabel(bNow),
      resolvedMood,
      moodColorFor(resolvedMood),
      weather || '晴',
      tag || null,
      trimmed,
      reactAt,
      attachment?.url || null,
      attachment?.name || null,
      attachment?.mime || null,
      attachment?.size || null
    );

  const row = db.prepare(`${LIST_QUERY} WHERE e.id = ?`).get(info.lastInsertRowid);
  res.json(serialize(row));
});

// Marks an entry (and its whole comment thread) as read — called when you
// actually open its detail page.
router.patch('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE diary_entries SET read_by_me = 1 WHERE id = ?').run(id);
  db.prepare('UPDATE diary_comments SET read_by_me = 1 WHERE entry_id = ?').run(id);
  res.json({ ok: true });
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
// back together, just scoped to this one diary entry's thread. Both sides
// of this exchange are marked read immediately: you wrote one and are
// looking straight at the other, unlike the comments background jobs
// leave while you're not on this page.
router.post('/:id/comments', async (req, res) => {
  const entryId = Number(req.params.id);
  const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entryId);
  if (!entry) return res.status(404).json({ error: 'entry not found' });
  const { text } = req.body;
  const trimmed = (text || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'text is required' });

  const mineInfo = db
    .prepare('INSERT INTO diary_comments (entry_id, author, text, time_label, read_by_me) VALUES (?, ?, ?, ?, 1)')
    .run(entryId, 'me', trimmed, formatBeijingClock());
  const mine = db.prepare('SELECT * FROM diary_comments WHERE id = ?').get(mineInfo.lastInsertRowid);

  const comments = db.prepare('SELECT * FROM diary_comments WHERE entry_id = ? ORDER BY id ASC').all(entryId);
  const replyText = await replyToDiaryComment(entry, comments);
  if (!replyText || classifyReplyForRetry(replyText).bad) {
    return res.json({ mine: serializeComment(mine), reply: null });
  }
  const theirsInfo = db
    .prepare('INSERT INTO diary_comments (entry_id, author, text, time_label, read_by_me) VALUES (?, ?, ?, ?, 1)')
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

  // Genuinely new content — reset read_by_me so it shows as unread again,
  // same as any other freshly written entry.
  db.prepare('UPDATE diary_entries SET mood = ?, mood_color = ?, weather = ?, excerpt = ?, read_by_me = 0 WHERE id = ?').run(
    written.mood,
    moodColorFor(written.mood),
    written.weather,
    written.excerpt,
    id
  );
  db.prepare('DELETE FROM diary_comments WHERE entry_id = ?').run(id);

  const updated = db.prepare(`${LIST_QUERY} WHERE e.id = ?`).get(id);
  res.json(serialize(updated));
});

export default router;
