import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

function serializeHabit(row, checkins) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    checkins, // array of date_iso strings this habit was checked in on
  };
}

router.get('/', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY id ASC').all();
  const checkinsStmt = db.prepare('SELECT date_iso FROM habit_checkins WHERE habit_id = ? ORDER BY date_iso ASC');
  res.json(habits.map((h) => serializeHabit(h, checkinsStmt.all(h.id).map((r) => r.date_iso))));
});

router.post('/', (req, res) => {
  const { name, color } = req.body;
  const trimmed = (name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare('INSERT INTO habits (name, color) VALUES (?,?)').run(trimmed, color || '#D9CBD3');
  const row = db.prepare('SELECT * FROM habits WHERE id = ?').get(info.lastInsertRowid);
  res.json(serializeHabit(row, []));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM habit_checkins WHERE habit_id = ?').run(req.params.id);
  db.prepare('DELETE FROM habits WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Toggles a single day's checkin for a habit — present it, and it's
// removed; absent, and it's added. Idempotent either way from the
// client's perspective (always ends in "the intended new state").
router.post('/:id/checkin', (req, res) => {
  const { dateISO } = req.body;
  if (!dateISO) return res.status(400).json({ error: 'dateISO is required' });
  const habitId = req.params.id;
  const existing = db.prepare('SELECT id FROM habit_checkins WHERE habit_id = ? AND date_iso = ?').get(habitId, dateISO);
  if (existing) {
    db.prepare('DELETE FROM habit_checkins WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO habit_checkins (habit_id, date_iso) VALUES (?,?)').run(habitId, dateISO);
  }
  const checkins = db.prepare('SELECT date_iso FROM habit_checkins WHERE habit_id = ? ORDER BY date_iso ASC').all(habitId).map((r) => r.date_iso);
  res.json({ checkins });
});

export default router;
