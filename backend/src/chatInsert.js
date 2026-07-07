import { db } from './db.js';
import { formatBeijingClock } from './time.js';
import { splitReplyIntoBubbles } from './persona.js';

const insertTheirsStmt = db.prepare(
  'INSERT INTO chat_messages (from_who, text, kind, time_label, tokens, thinking, tool_calls) VALUES (?,?,?,?,?,?,?)'
);

// Every scheduler/route that inserts an AI-authored chat message shares
// this — a single reply can render as several consecutive bubbles (see
// persona.js's MESSAGE_SPLIT_MARKER and forced sentence-splitting), so this
// is the one place that turns `reply.text` into however many rows it
// actually needs, with tokens/thinking/tool-trace attached only to the last
// one. Inserting the raw, unsplit text directly (as several call sites used
// to) let a literal "[[SPLIT]]" marker — or several sentences that should
// have been separate bubbles — leak straight into one garbled message.
export function insertTheirsMessages(reply) {
  const bubbles = splitReplyIntoBubbles(reply.text);
  return bubbles.map((text, i) => {
    const isLast = i === bubbles.length - 1;
    const info = insertTheirsStmt.run(
      'them',
      text,
      'text',
      formatBeijingClock(),
      isLast ? reply.tokens ?? null : null,
      isLast ? reply.thinking || null : null,
      isLast && reply.toolTrace?.length ? JSON.stringify(reply.toolTrace) : null
    );
    return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  });
}
