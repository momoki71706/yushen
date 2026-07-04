import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { getYushenReply } from '../aiReply.js';
import { maybeCompressChatHistory } from '../compression.js';
import { formatBeijingClock } from '../time.js';
import { getContextMessageLimit } from '../contextSettings.js';
import { enrichHistory } from '../chatHistory.js';

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
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
    attachment: row.attachment_url
      ? { url: row.attachment_url, name: row.attachment_name, mime: row.attachment_mime, size: row.attachment_size }
      : null,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM chat_messages ORDER BY id ASC').all();
  res.json(rows.map(serializeMessage));
});

// Read/unread checkmark next to message bubbles reads off the same
// watermark the follow-up scheduler uses — this just exposes it so the
// frontend doesn't have to guess when mark-read last fired.
router.get('/read-status', (req, res) => {
  res.json({ lastReadChatMessageId: Number(getSetting('lastReadChatMessageId', '0')) || 0 });
});

// Called by the frontend whenever the chat screen is actually showing
// current messages — feeds the read-but-unanswered follow-up scheduler
// (chatFollowUp.js), which otherwise has no way to know whether a message
// sitting unreplied has actually been seen yet.
router.patch('/mark-read', (req, res) => {
  const row = db.prepare('SELECT MAX(id) AS maxId FROM chat_messages').get();
  setSetting('lastReadChatMessageId', String(row?.maxId || 0));
  res.json({ ok: true });
});

// History for a reply anchored right after `beforeId` (or the newest
// messages overall when beforeId is omitted) — shared by both sending a
// new message and regenerating an existing one. `inclusive` also folds in
// the message at `beforeId` itself (used when regenerating the reply to a
// specific user message, since that message's text is the last turn).
async function recentHistory(beforeId, { inclusive = false } = {}) {
  const limit = getContextMessageLimit();
  const rows = beforeId
    ? db
        .prepare(`SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime FROM chat_messages WHERE id ${inclusive ? '<=' : '<'} ? ORDER BY id DESC LIMIT ?`)
        .all(beforeId, limit)
    : db.prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime FROM chat_messages ORDER BY id DESC LIMIT ?').all(limit);
  return enrichHistory(rows.reverse());
}

const insertMineStmt = db.prepare(
  'INSERT INTO chat_messages (from_who, text, kind, time_label, attachment_url, attachment_name, attachment_mime, attachment_size) VALUES (?,?,?,?,?,?,?,?)'
);
const insertTheirsStmt = db.prepare(
  'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking, tool_calls) VALUES (?,?,?,?,?,?,?)'
);

// Returns the inserted row, or null if the item is invalid (no text on a
// plain-text item, or no attachment on an image/file item) — callers skip
// nulls rather than failing the whole request over one bad entry.
function insertMineRow({ text, kind, attachment }) {
  const isAttachment = kind === 'image' || kind === 'file';
  if (!isAttachment && (!text || !String(text).trim())) return null;
  if (isAttachment && !attachment?.url) return null;
  const info = insertMineStmt.run(
    'me',
    text || '',
    kind || 'text',
    formatBeijingClock(),
    isAttachment ? attachment.url : null,
    isAttachment ? attachment.name || null : null,
    isAttachment ? attachment.mime || null : null,
    isAttachment ? attachment.size || null : null
  );
  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
}

function insertTheirsRow(reply) {
  const info = insertTheirsStmt.run(
    'them',
    reply.text,
    'text',
    formatBeijingClock(),
    reply.tokens,
    reply.thinking || null,
    reply.toolTrace?.length ? JSON.stringify(reply.toolTrace) : null
  );
  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
}

router.post('/', async (req, res) => {
  const { text, kind, attachment } = req.body;
  const isAttachment = kind === 'image' || kind === 'file';
  if (!isAttachment && (!text || !String(text).trim())) return res.status(400).json({ error: 'text is required' });
  if (isAttachment && !attachment?.url) return res.status(400).json({ error: 'attachment is required' });

  const mine = insertMineRow({ text, kind, attachment });
  const reply = await getYushenReply(await recentHistory());
  const theirs = insertTheirsRow(reply);

  res.json({ mine: serializeMessage(mine), reply: serializeMessage(theirs) });

  maybeCompressChatHistory();
});

// Same idea as the single-message POST, but for sending several things at
// once (e.g. a few picked photos plus a typed caption) as one turn — each
// item becomes its own row, in order, but only one AI reply is generated
// afterward, reading the whole updated conversation, so it reacts to all
// of it together instead of firing once per attachment.
router.post('/batch', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items is required' });

  const mineRows = items.map(insertMineRow).filter(Boolean);
  if (!mineRows.length) return res.status(400).json({ error: 'no valid items' });

  const reply = await getYushenReply(await recentHistory());
  const theirs = insertTheirsRow(reply);

  res.json({ mine: mineRows.map(serializeMessage), reply: serializeMessage(theirs) });

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

  const reply = await getYushenReply(await recentHistory(id));
  db.prepare('UPDATE chat_messages SET text = ?, tokens = ?, thinking = ?, tool_calls = ? WHERE id = ?').run(
    reply.text,
    reply.tokens,
    reply.thinking || null,
    reply.toolTrace?.length ? JSON.stringify(reply.toolTrace) : null,
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

  const reply = await getYushenReply(await recentHistory(id, { inclusive: true }));

  if (next) {
    db.prepare('UPDATE chat_messages SET text = ?, tokens = ?, thinking = ?, tool_calls = ? WHERE id = ?').run(
      reply.text,
      reply.tokens,
      reply.thinking || null,
      reply.toolTrace?.length ? JSON.stringify(reply.toolTrace) : null,
      next.id
    );
    const updated = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(next.id);
    return res.json({ reply: serializeMessage(updated), isNew: false });
  }

  const inserted = insertTheirsRow(reply);
  res.json({ reply: serializeMessage(inserted), isNew: true });
});

// Deletes a single message (either side) — removing it from chat_messages
// also removes it from every future context-building query, so it's gone
// from the AI's context the same moment it's gone from the screen.
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
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
