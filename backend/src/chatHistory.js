import { readImageAttachment, readTextAttachment } from './attachmentContent.js';

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

// Turns one chat_messages row into a history entry the AI can actually see.
// Plain text passes through as-is. An image message gets its file read and
// base64-encoded so a vision-capable model can look at it directly (the
// `image` field); a text-readable file gets its content inlined straight
// into the text. Either one falls back to describeForHistory's placeholder
// when the file can't be read (missing, unsupported format, too large) —
// shared by chat.js, proactive.js, scheduledMessages.js, and
// memoryScheduler.js, since all four build history from the same table.
export async function enrichHistoryRow(row) {
  if (row.kind === 'image') {
    const image = await readImageAttachment(row);
    if (image) return { from: row.from_who, text: row.text || '', image };
    return { from: row.from_who, text: describeForHistory(row) };
  }
  if (row.kind === 'file') {
    const content = await readTextAttachment(row);
    if (content) {
      const name = row.attachment_name || '文件';
      const notice = content.truncated ? '（内容较长，只截取了前面一部分）' : '';
      const caption = row.text ? `，并说：${row.text}` : '';
      return { from: row.from_who, text: `[发来了一个文件：${name}${notice}${caption}]\n${content.text}` };
    }
    return { from: row.from_who, text: describeForHistory(row) };
  }
  return { from: row.from_who, text: row.text };
}

export async function enrichHistory(rows) {
  return Promise.all(rows.map(enrichHistoryRow));
}
