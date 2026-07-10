import { db } from './db.js';
import { readImageAttachment } from './attachmentContent.js';
import { deviceControlEnabled, setCommand, stopDevice, getMaxIntensity, bridgeOnline } from './device.js';

// Built-in tools, always available regardless of the MCP toggle — these
// aren't external integrations, they're core app behavior, so they
// shouldn't depend on the user having any MCP server configured. They
// share the same {qualifiedName, description, inputSchema, serverId,
// toolName} shape as MCP-derived tools so they slot into the existing
// tool-loop/dispatch code unchanged; serverId: null is what marks a tool
// as local instead of routed to an external MCP server.
export function getLocalTools() {
  const tools = [
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

  // Intimate-device control is only offered to the model when the user has
  // switched it on (亲密控制 panel) — so the capability simply doesn't exist
  // in chat while it's off, rather than relying on the model to refrain.
  if (deviceControlEnabled()) {
    tools.push({
      qualifiedName: 'control_device',
      description:
        '控制和小晴连接的那个亲密玩具的震动强度。当你们的聊天氛围亲密、暧昧、或者她明确表达想要时，你可以主动用它，也可以配合当下的话调节强弱、停下——就像你真的能触碰到她一样。intensity 是强度百分比 0-100（0 表示停下），会持续到 duration_seconds 秒后自动停，想让它继续就再调用一次。强度有用户设定的上限，超过也只会到上限为止。只在私密、两人独处的语境里用，别在普通日常闲聊里突然开。',
      inputSchema: {
        type: 'object',
        properties: {
          intensity: { type: 'number', description: '强度百分比 0-100，0 表示停下' },
          duration_seconds: { type: 'number', description: '持续多少秒后自动停，默认 20，最多 120' },
        },
        required: ['intensity'],
      },
      serverId: null,
      toolName: 'control_device',
    });
  }

  return tools;
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

function attachmentsForEntry(entryId, row) {
  const rows = db.prepare('SELECT * FROM diary_attachments WHERE entry_id = ? ORDER BY sort_order ASC, id ASC').all(entryId);
  if (rows.length) return rows.map((a) => ({ attachment_url: a.url, attachment_mime: a.mime }));
  if (row.attachment_url) return [{ attachment_url: row.attachment_url, attachment_mime: row.attachment_mime }];
  return [];
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
    for (const attachmentRow of attachmentsForEntry(r.id, r)) {
      const image = await readImageAttachment(attachmentRow);
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

// Result text is fed back to the model as the tool result, so it reads as
// private stage-direction rather than something to echo verbatim to her.
function controlDevice(intensity, durationSeconds) {
  if (!deviceControlEnabled()) return '亲密控制现在没有开启，这次不用做任何动作。';
  const n = Math.max(0, Math.min(100, Math.round(Number(intensity))));
  if (!Number.isFinite(n)) return '强度值无效，这次跳过。';
  if (n === 0) {
    stopDevice();
    return '（已经停下了。这是给你的内部反馈，不用原样告诉她。）';
  }
  const { intensity: applied, durationSeconds: dur } = setCommand(n, durationSeconds ?? 20);
  const cap = getMaxIntensity();
  const capNote = applied < n ? `（她设了上限，实际到 ${applied}）` : '';
  const offlineNote = bridgeOnline() ? '' : '注意：家里的连接程序现在似乎没开，指令暂时不会真的作用到设备上。';
  return `已经调到强度 ${applied}${capNote}，${dur} 秒后自动停，想继续就再调用一次。${offlineNote}这是内部反馈，不用原样念给她听。`.trim();
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
  if (toolName === 'control_device') {
    return { content: [{ type: 'text', text: controlDevice(input?.intensity, input?.duration_seconds) }] };
  }
  return { content: [{ type: 'text', text: `未知本地工具: ${toolName}` }], isError: true };
}
