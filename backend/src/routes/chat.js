import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { getYushenReply } from '../aiReply.js';
import { maybeCompressChatHistory } from '../compression.js';
import { formatBeijingClock } from '../time.js';
import { getContextMessageLimit } from '../contextSettings.js';
import { enrichHistory } from '../chatHistory.js';
import { logMemoryToolTrace } from '../memoryScheduler.js';
import { splitReplyIntoBubbles } from '../persona.js';

const router = Router();

function serializeMessage(row) {
  return {
    id: row.id,
    from: row.from_who,
    text: row.text,
    kind: row.kind,
    time: row.time_label,
    createdAt: row.created_at,
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
        .prepare(`SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime, created_at FROM chat_messages WHERE id ${inclusive ? '<=' : '<'} ? ORDER BY id DESC LIMIT ?`)
        .all(beforeId, limit)
    : db.prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime, created_at FROM chat_messages ORDER BY id DESC LIMIT ?').all(limit);
  return enrichHistory(rows.reverse());
}

const insertMineStmt = db.prepare(
  'INSERT INTO chat_messages (from_who, text, kind, time_label, attachment_url, attachment_name, attachment_mime, attachment_size) VALUES (?,?,?,?,?,?,?,?)'
);
const insertTheirsStmt = db.prepare(
  'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking, tool_calls) VALUES (?,?,?,?,?,?,?)'
);

// A batch send or a split reply renders as several consecutive same-sender
// rows (see persona.js's forced sentence-splitting) — the frontend only
// shows time/tokens/regenerate/delete controls on the last bubble of that
// run (see ChatMode.jsx's isLastInGroup), so "regenerate"/"delete" acting
// on that one row needs to actually operate on the whole run underneath it,
// not just the single row the button happens to live on. This walks both
// directions from `id` to find every contiguous id sharing its sender,
// stopping at the first row (if any) that belongs to someone else.
function getGroupIds(id) {
  const target = db.prepare('SELECT id, from_who FROM chat_messages WHERE id = ?').get(id);
  if (!target) return null;
  const ids = [target.id];
  let cursor = target.id;
  while (true) {
    const prev = db.prepare('SELECT id, from_who FROM chat_messages WHERE id < ? ORDER BY id DESC LIMIT 1').get(cursor);
    if (!prev || prev.from_who !== target.from_who) break;
    ids.unshift(prev.id);
    cursor = prev.id;
  }
  cursor = target.id;
  while (true) {
    const nxt = db.prepare('SELECT id, from_who FROM chat_messages WHERE id > ? ORDER BY id ASC LIMIT 1').get(cursor);
    if (!nxt || nxt.from_who !== target.from_who) break;
    ids.push(nxt.id);
    cursor = nxt.id;
  }
  return ids;
}

function isTrailingGroup(groupIds) {
  return !db.prepare('SELECT id FROM chat_messages WHERE id > ? LIMIT 1').get(groupIds[groupIds.length - 1]);
}

function deleteRows(ids) {
  if (!ids.length) return;
  db.prepare(`DELETE FROM chat_messages WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
}

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

// One reply can render as several consecutive bubbles (see persona.js's
// MESSAGE_SPLIT_MARKER) — still a single provider call/token cost, just
// inserted as multiple chat_messages rows. Tokens/thinking/tool trace are
// only meaningful once per reply, so they're attached to the last bubble;
// earlier ones carry null.
function insertTheirsRows(reply) {
  const bubbles = splitReplyIntoBubbles(reply.text);
  return bubbles.map((text, i) => {
    const isLast = i === bubbles.length - 1;
    const info = insertTheirsStmt.run(
      'them',
      text,
      'text',
      formatBeijingClock(),
      isLast ? reply.tokens : null,
      isLast ? reply.thinking || null : null,
      isLast && reply.toolTrace?.length ? JSON.stringify(reply.toolTrace) : null
    );
    return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  });
}

router.post('/', async (req, res) => {
  const { text, kind, attachment } = req.body;
  const isAttachment = kind === 'image' || kind === 'file';
  if (!isAttachment && (!text || !String(text).trim())) return res.status(400).json({ error: 'text is required' });
  if (isAttachment && !attachment?.url) return res.status(400).json({ error: 'attachment is required' });

  const mine = insertMineRow({ text, kind, attachment });
  const reply = await getYushenReply(await recentHistory());
  const theirs = insertTheirsRows(reply);
  logMemoryToolTrace(reply.toolTrace);

  res.json({ mine: serializeMessage(mine), replies: theirs.map(serializeMessage) });

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
  const theirs = insertTheirsRows(reply);
  logMemoryToolTrace(reply.toolTrace);

  res.json({ mine: mineRows.map(serializeMessage), replies: theirs.map(serializeMessage) });

  maybeCompressChatHistory();
});

// Replaces a whole "them" bubble group (see getGroupIds) with a freshly
// regenerated reply. If the group sits at the very tail of the conversation
// (nothing newer exists), it's safe to delete it outright and insert a
// fresh set of bubbles — regenerating can change how many bubbles the reply
// splits into, and there's nothing after it whose order that would disturb.
// Otherwise (a historical mid-conversation regenerate) the new reply is
// collapsed into the group's first row in place and any extra old rows in
// the group are dropped, so later messages already in the conversation keep
// their original position instead of getting reordered.
function replaceTheirsGroup(groupIds, reply) {
  if (isTrailingGroup(groupIds)) {
    deleteRows(groupIds);
    const inserted = insertTheirsRows(reply);
    return { replies: inserted.map(serializeMessage), removedIds: groupIds };
  }
  const joinedText = splitReplyIntoBubbles(reply.text).join('\n');
  db.prepare('UPDATE chat_messages SET text = ?, tokens = ?, thinking = ?, tool_calls = ? WHERE id = ?').run(
    joinedText,
    reply.tokens,
    reply.thinking || null,
    reply.toolTrace?.length ? JSON.stringify(reply.toolTrace) : null,
    groupIds[0]
  );
  const rest = groupIds.slice(1);
  deleteRows(rest);
  const updated = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(groupIds[0]);
  return { replies: [serializeMessage(updated)], removedIds: rest };
}

// Re-runs one specific past AI reply using the conversation as it stood
// right before it — regenerating from the button on the last bubble of a
// split reply now resets the whole group of bubbles that reply rendered as,
// not just that one row.
router.post('/:id/regenerate', async (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'message not found' });
  if (target.from_who !== 'them') return res.status(400).json({ error: 'only AI replies can be regenerated' });

  const groupIds = getGroupIds(id);
  const reply = await getYushenReply(await recentHistory(groupIds[0]));
  logMemoryToolTrace(reply.toolTrace);
  res.json(replaceTheirsGroup(groupIds, reply));
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
// the conversation, or it's immediately followed by the reply group that
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
  logMemoryToolTrace(reply.toolTrace);

  if (next) {
    const groupIds = getGroupIds(next.id);
    return res.json(replaceTheirsGroup(groupIds, reply));
  }

  const inserted = insertTheirsRows(reply);
  res.json({ replies: inserted.map(serializeMessage), removedIds: [] });
});

// Deletes a message (either side) — removing it from chat_messages also
// removes it from every future context-building query, so it's gone from
// the AI's context the same moment it's gone from the screen. Deleting the
// button-bearing last bubble of a batch send or split reply removes the
// whole contiguous group underneath it (see getGroupIds), not just that
// one row, since the group only ever reads as one sent/received turn.
router.delete('/:id', (req, res) => {
  const groupIds = getGroupIds(Number(req.params.id));
  if (!groupIds) return res.json({ ok: true, deletedIds: [] });
  deleteRows(groupIds);
  res.json({ ok: true, deletedIds: groupIds });
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
