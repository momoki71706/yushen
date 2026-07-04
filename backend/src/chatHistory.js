// The AI only ever reads plain text history — an image/file message has
// no real caption to speak of most of the time, so it gets swapped for a
// short bracketed description instead of showing up as an empty turn.
// Shared by chat.js (normal replies) and the proactive/scheduled senders,
// since all three build history straight from chat_messages rows.
export function describeForHistory(row) {
  if (row.kind === 'image') return row.text ? `[发送了一张图片，并说：${row.text}]` : '[发送了一张图片]';
  if (row.kind === 'file') {
    const name = row.attachment_name || '文件';
    return row.text ? `[发送了一个文件：${name}，并说：${row.text}]` : `[发送了一个文件：${name}]`;
  }
  return row.text;
}
