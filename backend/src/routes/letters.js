import { Router } from 'express';
import { db, getSetting } from '../db.js';

const router = Router();

function serialize(row) {
  return {
    id: row.id,
    sender: row.sender,
    recipient: row.recipient,
    signature: row.signature,
    dearText: row.dear_text,
    unlockDate: row.unlock_date,
    body: row.body,
    opened: !!row.opened,
    hasAttachment: !!row.has_attachment,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM letters ORDER BY id DESC').all();
  res.json(rows.map(serialize));
});

router.post('/', (req, res) => {
  const { recipient, unlockDate, body, signature, dearText, hasAttachment } = req.body;
  const trimmed = (body || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'body is required' });

  const nickname = getSetting('nickname', '屿深');
  const resolvedSignature = (signature || '小晴').trim() || '小晴';
  const resolvedUnlockDate = unlockDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = resolvedUnlockDate.split('-').map(Number);
  const unlockDateObj = new Date(y, (m || 1) - 1, d || 1);
  const opened = unlockDateObj <= today;

  const info = db
    .prepare(
      `INSERT INTO letters (sender, recipient, signature, dear_text, unlock_date, body, opened, has_attachment)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run('小晴', recipient || nickname, resolvedSignature, dearText || null, resolvedUnlockDate, trimmed, opened ? 1 : 0, hasAttachment ? 1 : 0);

  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(info.lastInsertRowid);
  res.json(serialize(row));
});

router.patch('/:id/open', (req, res) => {
  db.prepare('UPDATE letters SET opened = 1 WHERE id = ?').run(req.params.id);
  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(serialize(row));
});

export default router;
