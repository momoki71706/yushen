import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const MOOD_PALETTE = { 开心: '#EDD9E1', 平静: '#E0D2D9', 难过: '#C9AEB9', 兴奋: '#E7D6CE', 疲惫: '#CBB9C0' };

function serialize(row) {
  return {
    id: row.id,
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

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM diary_entries ORDER BY id DESC').all();
  res.json(rows.map(serialize));
});

router.post('/', (req, res) => {
  const { text, mood, weather, tag, hasAttachment } = req.body;
  const trimmed = (text || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'text is required' });

  const now = new Date();
  const dateISO = now.toISOString().slice(0, 10);
  const resolvedMood = mood || '平静';
  const moodColor = MOOD_PALETTE[resolvedMood] || MOOD_PALETTE['平静'];

  const info = db
    .prepare(
      `INSERT INTO diary_entries (date_iso, date_label, mood, mood_color, weather, tag, excerpt, has_attachment)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(dateISO, '今天', resolvedMood, moodColor, weather || '晴', tag || null, trimmed, hasAttachment ? 1 : 0);

  const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(info.lastInsertRowid);
  res.json(serialize(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM diary_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
