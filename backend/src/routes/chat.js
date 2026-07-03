import { Router } from 'express';
import { db } from '../db.js';
import { getYushenReply } from '../aiReply.js';

const router = Router();

function nowTime() {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

function serializeMessage(row) {
  return {
    id: row.id,
    from: row.from_who,
    text: row.text,
    kind: row.kind,
    time: row.time_label,
    tokens: row.tokens,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM chat_messages ORDER BY id ASC').all();
  res.json(rows.map(serializeMessage));
});

router.post('/', async (req, res) => {
  const { text, kind } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });

  const insertMine = db.prepare(
    'INSERT INTO chat_messages (from_who, text, kind, time_label) VALUES (?,?,?,?)'
  );
  const mineInfo = insertMine.run('me', text, kind || 'text', nowTime());
  const mine = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(mineInfo.lastInsertRowid);

  const reply = await getYushenReply([{ from: 'me', text }]);
  const insertTheirs = db.prepare(
    'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens) VALUES (?,?,?,?,?)'
  );
  const theirsInfo = insertTheirs.run('them', reply.text, 'text', nowTime(), reply.tokens);
  const theirs = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(theirsInfo.lastInsertRowid);

  res.json({ mine: serializeMessage(mine), reply: serializeMessage(theirs) });
});

export default router;
