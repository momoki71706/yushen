import { Router } from 'express';
import { db, setSetting } from '../db.js';
import { getYushenReply } from '../aiReply.js';
import { maybeCompressChatHistory } from '../compression.js';
import { formatBeijingClock } from '../time.js';

const router = Router();

function serializeMessage(row) {
  return {
    id: row.id,
    from: row.from_who,
    text: row.text,
    kind: row.kind,
    time: row.time_label,
    tokens: row.tokens,
    thinking: row.thinking || null,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM chat_messages ORDER BY id ASC').all();
  res.json(rows.map(serializeMessage));
});

const CONTEXT_MESSAGE_LIMIT = 30;

// History for a reply anchored right after `beforeId` (or the newest
// messages overall when beforeId is omitted) — shared by both sending a
// new message and regenerating an existing one. `inclusive` also folds in
// the message at `beforeId` itself (used when regenerating the reply to a
// specific user message, since that message's text is the last turn).
function recentHistory(beforeId, { inclusive = false } = {}) {
  const rows = beforeId
    ? db
        .prepare(`SELECT from_who, text FROM chat_messages WHERE id ${inclusive ? '<=' : '<'} ? ORDER BY id DESC LIMIT ?`)
        .all(beforeId, CONTEXT_MESSAGE_LIMIT)
    : db.prepare('SELECT from_who, text FROM chat_messages ORDER BY id DESC LIMIT ?').all(CONTEXT_MESSAGE_LIMIT);
  return rows.reverse().map((r) => ({ from: r.from_who, text: r.text }));
}

router.post('/', async (req, res) => {
  const { text, kind } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });

  const insertMine = db.prepare(
    'INSERT INTO chat_messages (from_who, text, kind, time_label) VALUES (?,?,?,?)'
  );
  const mineInfo = insertMine.run('me', text, kind || 'text', formatBeijingClock());
  const mine = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(mineInfo.lastInsertRowid);

  const reply = await getYushenReply(recentHistory());
  const insertTheirs = db.prepare(
    'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking) VALUES (?,?,?,?,?,?)'
  );
  const theirsInfo = insertTheirs.run('them', reply.text, 'text', formatBeijingClock(), reply.tokens, reply.thinking || null);
  const theirs = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(theirsInfo.lastInsertRowid);

  res.json({ mine: serializeMessage(mine), reply: serializeMessage(theirs) });

  maybeCompressChatHistory();
});

// Re-runs one specific past AI reply using the conversation as it stood
// right before that reply, and overwrites just that message in place —
// everything after it in the conversation is left untouched.
router.post('/:id/regenerate', async (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'message not found' });
  if (target.from_who !== 'them') return res.status(400).json({ error: 'only AI replies can be regenerated' });

  const reply = await getYushenReply(recentHistory(id));
  db.prepare('UPDATE chat_messages SET text = ?, tokens = ?, thinking = ? WHERE id = ?').run(
    reply.text,
    reply.tokens,
    reply.thinking || null,
    id
  );
  const updated = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
  res.json(serializeMessage(updated));
});

// Edits the text of one of your own past messages (the AI's replies are
// regenerated, not edited, since they're not something you "said").
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { text } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
  const target = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'message not found' });
  if (target.from_who !== 'me') return res.status(400).json({ error: 'only your own messages can be edited' });

  db.prepare('UPDATE chat_messages SET text = ? WHERE id = ?').run(text.trim(), id);
  const updated = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
  res.json(serializeMessage(updated));
});

// Regenerates the AI reply paired with one of your own messages — used
// both for a plain "redo this round" and after editing your message's
// text. If that turn never got a reply (e.g. a request that failed after
// your message was already saved), one is created instead of overwritten.
// Only defined for the ordinary shapes: your message is the newest one in
// the conversation, or it's immediately followed by the one reply that
// answered it — anything stranger is left alone rather than guessed at.
router.post('/:id/regenerate-round', async (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'message not found' });
  if (target.from_who !== 'me') return res.status(400).json({ error: 'can only regenerate a round from your own message' });

  const next = db.prepare('SELECT * FROM chat_messages WHERE id > ? ORDER BY id ASC LIMIT 1').get(id);
  if (next && next.from_who !== 'them') {
    return res.status(400).json({ error: 'this message is not the latest turn' });
  }

  const reply = await getYushenReply(recentHistory(id, { inclusive: true }));

  if (next) {
    db.prepare('UPDATE chat_messages SET text = ?, tokens = ?, thinking = ? WHERE id = ?').run(
      reply.text,
      reply.tokens,
      reply.thinking || null,
      next.id
    );
    const updated = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(next.id);
    return res.json({ reply: serializeMessage(updated), isNew: false });
  }

  const insertTheirs = db.prepare(
    'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking) VALUES (?,?,?,?,?,?)'
  );
  const info = insertTheirs.run('them', reply.text, 'text', formatBeijingClock(), reply.tokens, reply.thinking || null);
  const inserted = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  res.json({ reply: serializeMessage(inserted), isNew: true });
});

// Wipes the whole conversation and its rolling summary. Mainly useful
// after a stretch of broken replies (bad key, crashed tool calls, etc.)
// got saved into history — those literal error strings sitting in past
// turns can bias a model into echoing them back, so a clean slate is the
// only real fix once that's happened, not just fixing the underlying bug.
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM chat_messages').run();
  setSetting('chatSummary', '');
  setSetting('chatSummarizedThroughId', '0');
  res.json({ ok: true });
});

export default router;
