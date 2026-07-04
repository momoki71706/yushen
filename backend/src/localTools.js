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
      qualifiedName: 'save_memory',
      description:
        '当聊天中出现了以后值得长期记住的信息时调用——比如她的喜好/忌讳、纪念日或重要日期、你们之间的约定、她生活里的重要变化、说过的走心的话。发现这类内容就主动记录，不用等她要求，也不用来回确认。content 写成一句简洁的中文陈述句，只记这一件事。',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '要记住的这一条内容，简洁的中文陈述句，比如"小晴不吃香菜"' },
        },
        required: ['content'],
      },
      serverId: null,
      toolName: 'save_memory',
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

export function saveMemory(content, source = 'event') {
  const trimmed = String(content || '').trim().slice(0, 300);
  if (!trimmed) return null;
  db.prepare('INSERT INTO memories (content, source) VALUES (?, ?)').run(trimmed, source);
  return trimmed;
}

export async function executeLocalTool(toolName, input) {
  if (toolName === 'schedule_message') {
    const { minutes } = scheduleMessage(input?.delay_minutes, input?.note);
    return { content: [{ type: 'text', text: `已经记下了，${minutes} 分钟后会提醒。` }] };
  }
  if (toolName === 'save_memory') {
    const saved = saveMemory(input?.content, 'event');
    if (!saved) return { content: [{ type: 'text', text: '记忆内容是空的，没有记下来' }], isError: true };
    return { content: [{ type: 'text', text: '记住了' }] };
  }
  return { content: [{ type: 'text', text: `未知本地工具: ${toolName}` }], isError: true };
}
