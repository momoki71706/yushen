import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

const VALID_TYPES = ['chat', 'diary', 'letter', 'tip'];

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    sourceId: row.source_id,
    title: row.title,
    snippet: row.snippet,
    sourceTime: row.source_time,
    createdAt: row.created_at,
  };
}

// Lightweight — just the (type, sourceId) pairs, so content views (chat
// bubbles, diary entries, letters) can render their heart button's
// filled/unfilled state without loading full favorite rows.
router.get('/keys', (req, res) => {
  const rows = db.prepare('SELECT type, source_id AS sourceId FROM favorites').all();
  res.json(rows);
});

router.get('/', (req, res) => {
  const { type, q, date } = req.query;
  const clauses = [];
  const params = [];
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (q) {
    clauses.push('(title LIKE ? OR snippet LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like);
  }
  if (date) {
    clauses.push('date(source_time) = date(?)');
    params.push(date);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM favorites ${where} ORDER BY source_time DESC, id DESC`).all(...params);
  res.json(rows.map(serialize));
});

// Counts per type, for the category grid on the favorites home page.
router.get('/counts', (req, res) => {
  const rows = db.prepare('SELECT type, COUNT(*) AS count FROM favorites GROUP BY type').all();
  const counts = Object.fromEntries(VALID_TYPES.map((t) => [t, 0]));
  rows.forEach((r) => {
    counts[r.type] = r.count;
  });
  res.json(counts);
});

// Upsert — favoriting the same (type, sourceId) again just renames it
// instead of creating a duplicate row.
router.post('/', (req, res) => {
  const { type, sourceId, title, snippet, sourceTime } = req.body;
  if (!VALID_TYPES.includes(type) || !sourceId) {
    return res.status(400).json({ error: 'type and sourceId are required' });
  }
  db.prepare(
    `INSERT INTO favorites (type, source_id, title, snippet, source_time) VALUES (?,?,?,?,?)
     ON CONFLICT(type, source_id) DO UPDATE SET title = excluded.title, snippet = excluded.snippet`
  ).run(type, String(sourceId), (title || '').trim().slice(0, 60), snippet || '', sourceTime || new Date().toISOString());
  const row = db.prepare('SELECT * FROM favorites WHERE type = ? AND source_id = ?').get(type, String(sourceId));
  res.json(serialize(row));
});

// Unfavoriting from the original content (chat bubble / diary entry /
// letter / tip) only knows (type, sourceId), not the favorite's own row id.
router.delete('/by-source', (req, res) => {
  const { type, sourceId } = req.query;
  db.prepare('DELETE FROM favorites WHERE type = ? AND source_id = ?').run(type, String(sourceId));
  res.json({ ok: true });
});

// Unfavoriting from within the favorites list itself, where the row's own
// id is already on hand.
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM favorites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
