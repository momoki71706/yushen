import { Router } from 'express';
import { db, getSetting } from '../db.js';
import { writeLetterReply, MIN_REPLY_LENGTH } from '../letterAi.js';
import { pickReplyFireAt } from '../letterScheduler.js';

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
    replyToId: row.reply_to_id,
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

// Edits a letter you sent — his letters get regenerated instead, not
// hand-edited, same distinction as chat/diary content authored by him.
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'not found' });
  if (target.sender !== '小晴') return res.status(400).json({ error: 'only your own letters can be edited' });

  const { recipient, unlockDate, body, signature, dearText } = req.body;
  const trimmed = (body || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'body is required' });

  const resolvedUnlockDate = unlockDate || target.unlock_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = resolvedUnlockDate.split('-').map(Number);
  const unlockDateObj = new Date(y, (m || 1) - 1, d || 1);
  const opened = unlockDateObj <= today;

  db.prepare(
    'UPDATE letters SET recipient = ?, signature = ?, dear_text = ?, unlock_date = ?, body = ?, opened = ? WHERE id = ?'
  ).run(
    recipient || target.recipient,
    (signature || '小晴').trim() || '小晴',
    dearText !== undefined ? dearText || null : target.dear_text,
    resolvedUnlockDate,
    trimmed,
    opened ? 1 : 0,
    id
  );
  const updated = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
  res.json(serialize(updated));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM letters WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Queues a request for him to write back to one of your sent letters —
// fulfilled later by letterScheduler, since deciding whether to actually
// reply (and writing it) takes a real model call, not something to do
// synchronously in this request.
router.post('/:id/request-reply', (req, res) => {
  const id = Number(req.params.id);
  const letter = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
  if (!letter) return res.status(404).json({ error: 'not found' });
  if (letter.sender !== '小晴') return res.status(400).json({ error: 'only your own letters can request a reply' });
  if (letter.body.length < MIN_REPLY_LENGTH) {
    return res.status(400).json({ error: `这封信有点短，字数不到 ${MIN_REPLY_LENGTH} 字，他大概率不会回信` });
  }

  db.prepare('INSERT INTO letter_reply_requests (source_letter_id, fire_at) VALUES (?, ?)').run(id, pickReplyFireAt());
  res.json({ ok: true });
});

// Re-writes one of his reply letters from scratch, overwriting it in
// place — same regenerate contract as diary/chat content he authored.
router.post('/:id/regenerate', async (req, res) => {
  const id = Number(req.params.id);
  const letter = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
  if (!letter) return res.status(404).json({ error: 'not found' });
  if (letter.sender !== '屿深') return res.status(400).json({ error: 'only his letters can be regenerated' });
  if (!letter.reply_to_id) return res.status(400).json({ error: 'this letter has nothing to regenerate from' });

  const source = db.prepare('SELECT * FROM letters WHERE id = ?').get(letter.reply_to_id);
  if (!source) return res.status(400).json({ error: '原信已经不存在了' });

  const result = await writeLetterReply(source);
  if (!result || result.failed) return res.status(400).json({ error: '还没有配置好的 AI 供应商，或者这次生成失败了' });
  if (!result.reply) return res.status(400).json({ error: '这次他还是没有想回信的内容' });

  db.prepare('UPDATE letters SET signature = ?, dear_text = ?, body = ? WHERE id = ?').run(
    result.reply.signature,
    result.reply.dearText,
    result.reply.body,
    id
  );
  const updated = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
  res.json(serialize(updated));
});

export default router;
