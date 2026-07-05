import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { formatBeijingClock } from '../time.js';
import { writeLedgerCardMessage } from '../ledgerAi.js';

const router = Router();

// Rotates through the same dreamcore palette the seeded categories use —
// applied to whatever she adds herself via the "+" button, since there's no
// color picker UI for that.
const AUTO_COLORS = ['#EDD9E1', '#D9CBD3', '#E7D6CE', '#CBB9C0', '#D6C4CB', '#C9AEB9', '#DED3D8', '#E0D2D9', '#F1E0E8'];
function nextColor(type) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM ledger_categories WHERE type = ?').get(type).c;
  return AUTO_COLORS[count % AUTO_COLORS.length];
}

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

function serializeCategory(row) {
  return { id: row.id, type: row.type, key: row.name, color: row.color };
}

function serializeBudget(row) {
  return { id: row.id, month: row.month, category: row.category, amount: row.amount };
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

router.patch('/:id', (req, res) => {
  const { dateISO, type, category, amount, note } = req.body;
  const amt = Number(amount);
  if (!dateISO || !category || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'dateISO, category and a positive amount are required' });
  }
  db.prepare('UPDATE ledger_entries SET date_iso = ?, type = ?, category = ?, amount = ?, note = ? WHERE id = ?')
    .run(dateISO, type === 'income' ? 'income' : 'expense', category, amt, (note || '').trim(), req.params.id);
  const row = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(req.params.id);
  res.json(serialize(row));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM ledger_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Categories used to be a hardcoded frontend list — now editable, so the
// "+" button and long-press-to-delete in the category picker have somewhere
// real to write to. Deleting a category only removes it from the picker;
// past entries keep their category as plain text either way.
router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM ledger_categories ORDER BY type, sort_order, id').all();
  res.json(rows.map(serializeCategory));
});

router.post('/categories', (req, res) => {
  const { type, name } = req.body;
  const trimmed = (name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'name is required' });
  const resolvedType = type === 'income' ? 'income' : 'expense';

  const existing = db.prepare('SELECT * FROM ledger_categories WHERE type = ? AND name = ?').get(resolvedType, trimmed);
  if (existing) return res.json(serializeCategory(existing));

  const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM ledger_categories WHERE type = ?').get(resolvedType).m || 0;
  const info = db
    .prepare('INSERT INTO ledger_categories (type, name, color, sort_order) VALUES (?,?,?,?)')
    .run(resolvedType, trimmed, nextColor(resolvedType), maxOrder + 1);
  const row = db.prepare('SELECT * FROM ledger_categories WHERE id = ?').get(info.lastInsertRowid);
  res.json(serializeCategory(row));
});

router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM ledger_categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// One planned amount per (month, category) — upsert since re-saving the
// same month/category is an edit, not a duplicate.
router.get('/budgets', (req, res) => {
  const { month } = req.query;
  const rows = month
    ? db.prepare('SELECT * FROM ledger_budgets WHERE month = ?').all(month)
    : db.prepare('SELECT * FROM ledger_budgets ORDER BY month DESC').all();
  res.json(rows.map(serializeBudget));
});

router.post('/budgets', (req, res) => {
  const { month, category, amount } = req.body;
  const amt = Number(amount);
  if (!month || !category || !Number.isFinite(amt) || amt < 0) {
    return res.status(400).json({ error: 'month, category and a non-negative amount are required' });
  }
  db.prepare(
    `INSERT INTO ledger_budgets (month, category, amount) VALUES (?,?,?)
     ON CONFLICT(month, category) DO UPDATE SET amount = excluded.amount`
  ).run(month, category, amt);
  const row = db.prepare('SELECT * FROM ledger_budgets WHERE month = ? AND category = ?').get(month, category);
  res.json(serializeBudget(row));
});

router.delete('/budgets/:id', (req, res) => {
  db.prepare('DELETE FROM ledger_budgets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// AI-generated subtitle shown on the management page's 记账 card — replaces
// the old static rotating-string placeholder with something that actually
// reads her real entries (see ledgerAi.js/ledgerScheduler.js).
router.get('/card-message', (req, res) => {
  res.json({ message: getSetting('ledgerCardMessage', '') });
});

// Manual regenerate (tap the card message, confirm) — bypasses the
// scheduler's random once/twice-a-day timing and asks for a fresh one now.
router.post('/card-message/regenerate', async (req, res) => {
  const result = await writeLedgerCardMessage();
  if (!result) return res.status(400).json({ error: '还没有配置 AI 供应商' });
  if (result.failed) return res.status(502).json({ error: '生成失败，再试一次吧' });
  if (!result.text) return res.json({ message: '', empty: true });
  setSetting('ledgerCardMessage', result.text);
  res.json({ message: result.text });
});

export default router;
