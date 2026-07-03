import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import Anthropic from '@anthropic-ai/sdk';
import { db } from './db.js';
import { FALLBACK_REPLY, estimateTokens } from './persona.js';
import { getComposedSystemPrompt } from './presets.js';

const MAX_TOOL_ITERATIONS = 5;
const CLIENT_INFO = { name: 'xiaoqing-yushen-app', version: '1.0.0' };

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    headers: row.headers ? JSON.parse(row.headers) : {},
    enabled: !!row.enabled,
  };
}

export function listServers() {
  return db.prepare('SELECT * FROM mcp_servers ORDER BY id ASC').all().map(serialize);
}

export function getServer(id) {
  const row = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id);
  return row ? serialize(row) : null;
}

export function addServer({ name, url, headers }) {
  const info = db
    .prepare('INSERT INTO mcp_servers (name, url, headers, enabled) VALUES (?,?,?,1)')
    .run(name, url, headers && Object.keys(headers).length ? JSON.stringify(headers) : null);
  return getServer(info.lastInsertRowid);
}

export function updateServer(id, { name, url, headers, enabled }) {
  const row = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id);
  if (!row) return null;
  db.prepare('UPDATE mcp_servers SET name=?, url=?, headers=?, enabled=? WHERE id=?').run(
    name !== undefined ? name : row.name,
    url !== undefined ? url : row.url,
    headers !== undefined ? (Object.keys(headers || {}).length ? JSON.stringify(headers) : null) : row.headers,
    enabled !== undefined ? (enabled ? 1 : 0) : row.enabled,
    id
  );
  return getServer(id);
}

export function deleteServer(id) {
  db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
}

async function connectClient(server) {
  const url = new URL(server.url);
  const headers = server.headers && Object.keys(server.headers).length ? server.headers : undefined;
  const init = headers ? { requestInit: { headers } } : undefined;

  const client = new Client(CLIENT_INFO);
  try {
    await client.connect(new StreamableHTTPClientTransport(url, init));
    return client;
  } catch (err) {
    const fallbackClient = new Client(CLIENT_INFO);
    await fallbackClient.connect(new SSEClientTransport(url, init));
    return fallbackClient;
  }
}

function slugify(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'server';
}

export async function listServerTools(server) {
  const client = await connectClient(server);
  try {
    const result = await client.listTools();
    return result.tools || [];
  } finally {
    await client.close();
  }
}

export async function testServer(id) {
  const server = getServer(id);
  if (!server) throw new Error('未找到这个 MCP 服务');
  const tools = await listServerTools(server);
  return { ok: true, toolCount: tools.length, toolNames: tools.map((t) => t.name) };
}

// Aggregate tools across all enabled MCP servers into a provider-agnostic
// shape, prefixed for uniqueness and mapped back to their originating
// server for dispatch during the tool-use loop.
export async function getEnabledTools() {
  const servers = listServers().filter((s) => s.enabled);
  const tools = [];
  await Promise.all(
    servers.map(async (server) => {
      try {
        const serverTools = await listServerTools(server);
        const prefix = slugify(server.name);
        for (const t of serverTools) {
          tools.push({
            qualifiedName: `${prefix}__${t.name}`,
            description: t.description || '',
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
            serverId: server.id,
            toolName: t.name,
          });
        }
      } catch (err) {
        console.error(`MCP server "${server.name}" unreachable:`, err.message);
      }
    })
  );
  return tools;
}

const toAnthropicTool = (t) => ({ name: t.qualifiedName, description: t.description, input_schema: t.inputSchema });
const toOpenAiTool = (t) => ({
  type: 'function',
  function: { name: t.qualifiedName, description: t.description, parameters: t.inputSchema },
});

// Having tools attached to a request doesn't mean a model will actually
// reach for them — many models (especially smaller ones behind relay
// endpoints) default to answering from their own knowledge unless
// explicitly told a tool exists and when to prefer it. Spelling the
// available tools out in plain language in the system prompt makes
// proactive tool use far more reliable than relying on the tools[]
// parameter alone.
function buildToolAwareSystemPrompt(tools) {
  const base = getComposedSystemPrompt();
  if (!tools.length) return base;
  const toolList = tools.map((t) => `- ${t.qualifiedName}：${t.description || '（无描述）'}`).join('\n');
  return `${base}\n\n【可用工具】\n你现在可以主动调用以下工具，只要对话内容和某个工具相关（比如对方让你查记忆、记点什么事、看看之前聊过什么），就应该直接调用对应工具，不要因为不确定而跳过或者只凭自己猜测回答：\n${toolList}`;
}

async function callTool(tools, qualifiedName, input) {
  const match = tools.find((t) => t.qualifiedName === qualifiedName);
  if (!match) return { content: [{ type: 'text', text: `未知工具: ${qualifiedName}` }], isError: true };
  const server = getServer(match.serverId);
  if (!server) return { content: [{ type: 'text', text: '工具所属的 MCP 服务已被删除' }], isError: true };

  const client = await connectClient(server);
  try {
    const result = await client.callTool({ name: match.toolName, arguments: input || {} });
    return result;
  } catch (err) {
    return { content: [{ type: 'text', text: `工具调用失败: ${err.message}` }], isError: true };
  } finally {
    await client.close();
  }
}

function mcpContentToText(content) {
  if (!Array.isArray(content)) return JSON.stringify(content ?? '');
  return content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
}

// Agentic loop for Anthropic-format providers: call Claude with MCP tools
// attached, execute any tool_use blocks against the originating MCP
// server, feed results back, and repeat until Claude returns a plain
// text reply or the iteration cap is hit.
export async function runAnthropicToolLoop(history, apiKey, model, baseURL, tools) {
  if (!apiKey) return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };

  const anthropic = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const anthropicTools = tools.map(toAnthropicTool);
  const systemPrompt = buildToolAwareSystemPrompt(tools);
  const messages = history.map((m) => ({
    role: m.from === 'me' ? 'user' : 'assistant',
    content: m.text,
  }));

  let finalText = '';
  let totalOutputTokens = 0;
  let toolCallCount = 0;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: model || 'claude-sonnet-5',
      max_tokens: 400,
      system: systemPrompt,
      messages,
      tools: anthropicTools,
    });
    totalOutputTokens += response.usage?.output_tokens || 0;

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    const textBlocks = response.content.filter((b) => b.type === 'text');
    finalText = textBlocks.map((b) => b.text).join('').trim();

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break;

    toolCallCount += toolUses.length;
    console.log(`[mcp] anthropic tool loop iteration ${i}: calling ${toolUses.map((tu) => tu.name).join(', ')}`);
    messages.push({ role: 'assistant', content: response.content });
    const toolResults = await Promise.all(
      toolUses.map(async (tu) => {
        const result = await callTool(tools, tu.name, tu.input);
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result.content || [{ type: 'text', text: JSON.stringify(result) }],
          is_error: !!result.isError,
        };
      })
    );
    messages.push({ role: 'user', content: toolResults });
  }

  if (toolCallCount === 0) console.log(`[mcp] anthropic tool loop: ${tools.length} tool(s) offered, model made 0 calls`);
  const text = finalText || FALLBACK_REPLY;
  return { text, tokens: totalOutputTokens || estimateTokens(text) };
}

function joinUrl(base, path) {
  return `${(base || '').replace(/\/+$/, '')}${path}`;
}

// Same agentic loop, but speaking OpenAI's function-calling format
// (tools/tool_calls/role:"tool") for OpenAI-compatible relay providers.
export async function runOpenAiToolLoop(history, apiKey, baseUrl, model, tools) {
  if (!apiKey) return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };

  const openAiTools = tools.map(toOpenAiTool);
  const messages = [
    { role: 'system', content: buildToolAwareSystemPrompt(tools) },
    ...history.map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text })),
  ];

  let finalText = '';
  let totalTokens = 0;
  let toolCallCount = 0;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await fetch(joinUrl(baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'claude-sonnet-5',
        max_tokens: 400,
        messages,
        tools: openAiTools,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    totalTokens += json.usage?.completion_tokens || 0;

    const message = json.choices?.[0]?.message;
    if (!message) break;
    finalText = (message.content || '').trim();

    const toolCalls = message.tool_calls || [];
    if (!toolCalls.length) break;

    toolCallCount += toolCalls.length;
    console.log(`[mcp] openai tool loop iteration ${i}: calling ${toolCalls.map((tc) => tc.function.name).join(', ')}`);
    messages.push({ role: 'assistant', content: message.content || null, tool_calls: toolCalls });
    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          // leave args as {} if the model produced malformed JSON
        }
        const result = await callTool(tools, tc.function.name, args);
        return {
          role: 'tool',
          tool_call_id: tc.id,
          content: mcpContentToText(result.content) || JSON.stringify(result),
        };
      })
    );
    messages.push(...toolResults);
  }

  if (toolCallCount === 0) console.log(`[mcp] openai tool loop: ${tools.length} tool(s) offered, model made 0 calls`);
  const text = finalText || FALLBACK_REPLY;
  return { text, tokens: totalTokens || estimateTokens(text) };
}
