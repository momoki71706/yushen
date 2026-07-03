import { Router } from 'express';
import { db } from '../db.js';
import { formatBeijingClock } from '../time.js';

const router = Router();

function serialize(row) {
  return {
    id: row.id,
    dateISO: row.date_iso,
    type: row.type,
    category: row.category,
    amount: row.amount,
    note: row.note || '',
    time: row.time_label,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM ledger_entries ORDER BY date_iso DESC, id DESC').all();
  res.json(rows.map(serialize));
});

router.post('/', (req, res) => {
  const { dateISO, type, category, amount, note } = req.body;
  const amt = Number(amount);
  if (!dateISO || !category || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'dateISO, category and a positive amount are required' });
  }
  const info = db
    .prepare('INSERT INTO ledger_entries (date_iso, type, category, amount, note, time_label) VALUES (?,?,?,?,?,?)')
    .run(dateISO, type === 'income' ? 'income' : 'expense', category, amt, (note || '').trim(), formatBeijingClock());
  const row = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(info.lastInsertRowid);
  res.json(serialize(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM ledger_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
