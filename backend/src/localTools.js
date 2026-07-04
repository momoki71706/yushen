import { db } from './db.js';

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
        '当对话里提到日记相关的内容（比如对方说"我今天写日记了""你看我日记了吗"，或者你自己想看看最近写了什么日记）时调用，用来读取最近几篇日记的内容。不要在普通聊天里没由头地调用。',
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

function readDiary(count) {
  const limit = Math.max(1, Math.min(Number(count) || 5, 20));
  const rows = db.prepare('SELECT * FROM diary_entries ORDER BY id DESC LIMIT ?').all(limit);
  if (!rows.length) return '还没有任何日记。';
  return rows
    .reverse()
    .map((r) => `[${r.date_label}｜${r.author === 'me' ? '小晴' : '你'}｜心情：${r.mood}，天气：${r.weather}]\n${r.excerpt}`)
    .join('\n\n');
}

export async function executeLocalTool(toolName, input) {
  if (toolName === 'schedule_message') {
    const { minutes } = scheduleMessage(input?.delay_minutes, input?.note);
    return { content: [{ type: 'text', text: `已经记下了，${minutes} 分钟后会提醒。` }] };
  }
  if (toolName === 'read_diary') {
    return { content: [{ type: 'text', text: readDiary(input?.count) }] };
  }
  return { content: [{ type: 'text', text: `未知本地工具: ${toolName}` }], isError: true };
}
