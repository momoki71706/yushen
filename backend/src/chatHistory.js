import { readImageAttachment, readTextAttachment } from './attachmentContent.js';
import { beijingFromUtcString, weekdayLabel } from './time.js';

// Fallback for when an image/file message's actual content can't be read
// (unsupported format, missing file, too large) — a short bracketed
// description stands in so the turn isn't just blank.
export function describeForHistory(row) {
  if (row.kind === 'image') return row.text ? `[发送了一张图片，并说：${row.text}]` : '[发送了一张图片]';
  if (row.kind === 'file') {
    const name = row.attachment_name || '文件';
    return row.text ? `[发送了一个文件：${name}，并说：${row.text}]` : `[发送了一个文件：${name}]`;
  }
  return row.text;
}

// Each history entry is tagged with when it was actually sent (Beijing
// time) — without this the model only ever knows the CURRENT moment (from
// getComposedSystemPrompt's time block), not how much time has passed
// since any earlier turn, which made proactive/follow-up messages keep
// riffing on a topic from an hour+ ago as if it just came up.
function timestampPrefix(createdAt) {
  if (!createdAt) return '';
  const t = beijingFromUtcString(createdAt);
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return `[${t.getUTCMonth() + 1}月${t.getUTCDate()}日 ${weekdayLabel(t)} ${hh}:${mm}] `;
}

// Turns one chat_messages row into a history entry the AI can actually see.
// Plain text passes through as-is. An image message gets its file read and
// base64-encoded so a vision-capable model can look at it directly (the
// `image` field); a text-readable file gets its content inlined straight
// into the text. Either one falls back to describeForHistory's placeholder
// when the file can't be read (missing, unsupported format, too large) —
// shared by chat.js, proactive.js, scheduledMessages.js, and
// memoryScheduler.js, since all four build history from the same table.
export async function enrichHistoryRow(row) {
  const prefix = timestampPrefix(row.created_at);
  if (row.kind === 'image') {
    const image = await readImageAttachment(row);
    if (image) return { from: row.from_who, text: `${prefix}${row.text || ''}`, image };
    return { from: row.from_who, text: `${prefix}${describeForHistory(row)}` };
  }
  if (row.kind === 'file') {
    const content = await readTextAttachment(row);
    if (content) {
      const name = row.attachment_name || '文件';
      const notice = content.truncated ? '（内容较长，只截取了前面一部分）' : '';
      const caption = row.text ? `，并说：${row.text}` : '';
      return { from: row.from_who, text: `${prefix}[发来了一个文件：${name}${notice}${caption}]\n${content.text}` };
    }
    return { from: row.from_who, text: `${prefix}${describeForHistory(row)}` };
  }
  return { from: row.from_who, text: `${prefix}${row.text}` };
}

export async function enrichHistory(rows) {
  return Promise.all(rows.map(enrichHistoryRow));
}
