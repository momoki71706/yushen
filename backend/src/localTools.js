import { db } from './db.js';
import { readImageAttachment } from './attachmentContent.js';

// Built-in tools, always available regardless of the MCP toggle — these
// aren't external integrations, they're core app behavior, so they
// shouldn't depend on the user having any MCP server configured. They
// share the same {qualifiedName, description, inputSchema, serverId,
// toolName} shape as MCP-derived tools so they slot into the existing
// tool-loop/dispatch code unchanged; serverId: null is what marks a tool
// as local instead of routed to an external MCP server.
export function getLocalTools() {
  return [
    {
      qualifiedName: 'schedule_message',
      description:
        '当对方明确要求"过几分钟提醒我""等会再叫我""稍后跟我说一声"这类预约提醒时调用，用来记录多久之后要主动发一条消息、以及大概要说的内容。不要用于普通聊天回复。',
      inputSchema: {
        type: 'object',
        properties: {
          delay_minutes: { type: 'number', description: '多少分钟之后发送提醒，比如 5' },
          note: { type: 'string', description: '简短描述到时候要说的内容或提醒事项，比如"提醒她喝水"' },
        },
        required: ['delay_minutes', 'note'],
      },
      serverId: null,
      toolName: 'schedule_message',
    },
    {
      qualifiedName: 'read_diary',
      description:
        '当对话里提到日记相关的内容（比如对方说"我今天写日记了""你看我日记了吗"，或者你自己想看看最近写了什么日记）时调用，用来读取最近几篇日记的内容，如果某篇日记附带了图片，也会把图片一起给你看。不要在普通聊天里没由头地调用。',
      inputSchema: {
        type: 'object',
        properties: {
          count: { type: 'number', description: '想看最近几篇，默认 5' },
        },
        required: [],
      },
      serverId: null,
      toolName: 'read_diary',
    },
    {
      qualifiedName: 'comment_on_diary',
      description:
        '当对方在聊天里明确要求你去日记里评论/回复一下时调用（比如"去评论一下""你去看看我日记，给我留言"）。调用后不要在这条聊天回复里自己编造评论内容，只需要简短回一句"这就去看"之类的话——实际留言会稍后真的写进日记里，看完之后也会再回来聊天里跟她说一句反馈。',
      inputSchema: {
        type: 'object',
        properties: {
          entry_id: { type: 'number', description: '要评论哪一篇日记的 id，不填则默认最新一篇' },
        },
        required: [],
      },
      serverId: null,
      toolName: 'comment_on_diary',
    },
    {
      qualifiedName: 'read_letters',
      description:
        '当对话里提到信件相关的内容（比如对方说"我给你写信了""你收到我的信了吗""回信怎么说的"）时调用，用来读取最近已经拆开过的信。只能看到已经拆开的信，没拆开的时间胶囊信件不会出现。',
      inputSchema: {
        type: 'object',
        properties: {
          count: { type: 'number', description: '想看最近几封，默认 5' },
        },
        required: [],
      },
      serverId: null,
      toolName: 'read_letters',
    },
  ];
}

export function isLocalTool(tool) {
  return !!tool && tool.serverId === null;
}

export function scheduleMessage(delayMinutes, note) {
  const minutes = Math.max(1, Math.min(Number(delayMinutes) || 5, 24 * 60));
  const fireAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  db.prepare('INSERT INTO scheduled_messages (fire_at, note) VALUES (?, ?)').run(fireAt, String(note || '').trim().slice(0, 300));
  return { fireAt, minutes };
}

async function readDiaryContent(count) {
  const limit = Math.max(1, Math.min(Number(count) || 5, 20));
  const rows = db.prepare('SELECT * FROM diary_entries ORDER BY id DESC LIMIT ?').all(limit);
  if (!rows.length) return [{ type: 'text', text: '还没有任何日记。' }];
  const blocks = [];
  for (const r of rows.reverse()) {
    blocks.push({
      type: 'text',
      text: `[${r.date_label}｜${r.author === 'me' ? '小晴' : '你'}｜心情：${r.mood}，天气：${r.weather}]\n${r.excerpt}`,
    });
    if (r.attachment_url) {
      const image = await readImageAttachment(r);
      if (image) blocks.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } });
    }
  }
  return blocks;
}

function readLetters(count) {
  const limit = Math.max(1, Math.min(Number(count) || 5, 20));
  const rows = db.prepare('SELECT * FROM letters WHERE opened = 1 ORDER BY id DESC LIMIT ?').all(limit);
  if (!rows.length) return '还没有已经拆开的信。';
  return rows
    .reverse()
    .map((r) => `[${r.unlock_date}｜${r.sender === '小晴' ? '小晴写给' + r.recipient : '你写给小晴'}｜署名：${r.signature}]\n${r.body}`)
    .join('\n\n');
}

// 1-2 minutes — short enough to feel like "went and actually looked",
// unlike the up-to-30-minute delay used for entries he wasn't asked about.
function queueDiaryReview(entryId) {
  const entry = entryId
    ? db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entryId)
    : db.prepare('SELECT * FROM diary_entries ORDER BY id DESC LIMIT 1').get();
  if (!entry) return '没有找到日记，跟她确认一下是不是记错了。';
  // Claims the entry from the autonomous delayed-reaction path right away —
  // without this, an entry asked about before its own react_at fires would
  // get reacted to twice: once here, once by maybeReactToDiaries, each with
  // its own comment and chat message.
  if (entry.author === 'me' && !entry.reacted) {
    db.prepare('UPDATE diary_entries SET reacted = 1 WHERE id = ?').run(entry.id);
  }
  const fireAt = new Date(Date.now() + (1 + Math.random()) * 60 * 1000).toISOString();
  db.prepare('INSERT INTO diary_review_requests (entry_id, fire_at) VALUES (?, ?)').run(entry.id, fireAt);
  return '已经记下了，一会儿会去看看再留言，看完也会回来跟她说一句——这条回复只需要简短回应一下，比如"这就去看"，不要自己编评论内容。';
}

export async function executeLocalTool(toolName, input) {
  if (toolName === 'schedule_message') {
    const { minutes } = scheduleMessage(input?.delay_minutes, input?.note);
    return { content: [{ type: 'text', text: `已经记下了，${minutes} 分钟后会提醒。` }] };
  }
  if (toolName === 'read_diary') {
    return { content: await readDiaryContent(input?.count) };
  }
  if (toolName === 'comment_on_diary') {
    return { content: [{ type: 'text', text: queueDiaryReview(input?.entry_id) }] };
  }
  if (toolName === 'read_letters') {
    return { content: [{ type: 'text', text: readLetters(input?.count) }] };
  }
  return { content: [{ type: 'text', text: `未知本地工具: ${toolName}` }], isError: true };
}
