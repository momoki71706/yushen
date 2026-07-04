import { Router } from 'express';
import { db, getSetting } from '../db.js';
import { writeLetterReply, writeFreshLetter, MIN_REPLY_LENGTH } from '../letterAi.js';
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

// Debug/manual trigger — there's no autonomous version of this (unlike
// diary entries, nothing schedules him writing an unprompted letter), so
// this is currently the only way a mailbox ever gets its first received
// letter without going through the reply chain first. Kept simple and
// synchronous since it's a deliberate on-demand test action, not a
// background job.
router.post('/trigger-write', async (req, res) => {
  const result = await writeFreshLetter();
  if (!result) return res.status(400).json({ error: '还没有配置好的 AI 供应商' });
  if (result.failed || !result.reply) return res.status(502).json({ error: '这次生成失败了，再试一次' });

  const today = new Date().toISOString().slice(0, 10);
  const info = db
    .prepare(`INSERT INTO letters (sender, recipient, signature, dear_text, unlock_date, body, opened) VALUES ('屿深','小晴',?,?,?,?,0)`)
    .run(result.reply.signature, result.reply.dearText, today, result.reply.body);

  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(info.lastInsertRowid);
  res.json(serialize(row));
});

router.post('/', (req, res) => {
  const { recipient, unlockDate, body, signature, dearText, hasAttachment, replyToId } = req.body;
  const trimmed = (body || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'body is required' });

  // A reply must target one of *his* letters — replying to your own past
  // letter doesn't make sense, and this is also what makes the reply-back
  // queue below meaningful (his reply-to-your-reply, not to himself).
  let replyTarget = null;
  if (replyToId) {
    replyTarget = db.prepare('SELECT * FROM letters WHERE id = ?').get(replyToId);
    if (!replyTarget || replyTarget.sender !== '屿深') {
      return res.status(400).json({ error: '只能回复他寄来的信' });
    }
  }

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
      `INSERT INTO letters (sender, recipient, signature, dear_text, unlock_date, body, opened, has_attachment, reply_to_id)
       VALUES ('小晴',?,?,?,?,?,?,?,?)`
    )
    .run(
      recipient || nickname,
      resolvedSignature,
      dearText || null,
      resolvedUnlockDate,
      trimmed,
      opened ? 1 : 0,
      hasAttachment ? 1 : 0,
      replyTarget ? replyTarget.id : null
    );

  // Whether he actually writes back (and how soon) is judged the same way
  // as before — only a real, substantial reply queues a chance at one;
  // there's just no explicit button for it anymore, sending the reply is
  // the trigger.
  if (replyTarget && trimmed.length >= MIN_REPLY_LENGTH) {
    db.prepare('INSERT INTO letter_reply_requests (source_letter_id, fire_at) VALUES (?, ?)').run(info.lastInsertRowid, pickReplyFireAt());
  }

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
