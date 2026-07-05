import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting, setSetting } from './db.js';
import { FALLBACK_REPLY, estimateTokens } from './persona.js';
import { getComposedSystemPrompt } from './presets.js';

// Anthropic (and most OpenAI-compatible APIs) treat a messages[] list that
// ends on an assistant turn as a request to *continue* that exact message,
// not to start a new one — and since a normal exchange always ends with a
// "them" reply, a proactive/scheduled nudge built from raw recent history
// would almost always end that way. Feeding that straight in had the model
// literally carry on the tail of whatever it last said instead of opening
// fresh, which is what caused those out-of-nowhere non-sequiturs. Trimming
// trailing assistant turns keeps the list ending on the last real "me" turn.
export function trimTrailingAssistantTurns(history) {
  let end = history.length;
  while (end > 0 && history[end - 1].from !== 'me') end--;
  // If the whole window is "them" (several unanswered proactive/follow-up
  // messages in a row, which happens whenever she goes quiet for a while),
  // trimming to empty would send zero messages to the provider, which
  // every provider API rejects outright. That silently and permanently
  // broke every scheduler using this (proactive, follow-up, scheduled
  // reminders) until she sent something new to break up the run — keep
  // the untrimmed history instead of returning nothing.
  return end > 0 ? history.slice(0, end) : history;
}

// A history entry with an `image` field needs the actual image bytes sent
// as a real content block for a vision model to see it — a plain string
// only carries the caption. Entries without an image (the overwhelming
// majority) stay as plain strings so existing providers/relays that don't
// expect array content are unaffected.
export function toAnthropicMessageContent(m) {
  if (!m.image) return m.text;
  const blocks = [{ type: 'image', source: { type: 'base64', media_type: m.image.mediaType, data: m.image.base64 } }];
  if (m.text) blocks.push({ type: 'text', text: m.text });
  return blocks;
}

export function toOpenAiMessageContent(m) {
  if (!m.image) return m.text;
  const parts = [{ type: 'image_url', image_url: { url: `data:${m.image.mediaType};base64,${m.image.base64}` } }];
  if (m.text) parts.push({ type: 'text', text: m.text });
  return parts;
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 4) return '••••';
  return '••••••' + key.slice(-4);
}

function serialize(row) {
  const keys = JSON.parse(row.keys || '[]');
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url || '',
    multiKeyEnabled: !!row.multi_key_enabled,
    keyCount: keys.length,
    keysMasked: keys.map(maskKey),
    models: JSON.parse(row.models || '[]'),
    selectedModel: row.selected_model || '',
  };
}

export function listProviders() {
  return db.prepare('SELECT * FROM ai_providers ORDER BY id ASC').all().map(serialize);
}

function getProviderRow(id) {
  return db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id);
}

export function getProvider(id) {
  const row = getProviderRow(id);
  return row ? serialize(row) : null;
}

// Internal use only (aiReply) — includes real, unmasked keys.
export function getProviderWithKeys(id) {
  const row = getProviderRow(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url || '',
    keys: JSON.parse(row.keys || '[]'),
    multiKeyEnabled: !!row.multi_key_enabled,
    selectedModel: row.selected_model || '',
  };
}

export function addProvider({ name, type, baseUrl, multiKeyEnabled, keys, models, selectedModel }) {
  const info = db
    .prepare(
      `INSERT INTO ai_providers (name, type, base_url, multi_key_enabled, keys, models, selected_model)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(
      name,
      type === 'openai' ? 'openai' : 'anthropic',
      baseUrl || '',
      multiKeyEnabled ? 1 : 0,
      JSON.stringify(Array.isArray(keys) ? keys.filter(Boolean) : []),
      JSON.stringify(Array.isArray(models) ? models.filter(Boolean) : []),
      selectedModel || (Array.isArray(models) && models[0]) || ''
    );
  return getProvider(info.lastInsertRowid);
}

export function updateProvider(id, patch) {
  const row = getProviderRow(id);
  if (!row) return null;
  const next = {
    name: patch.name !== undefined ? patch.name : row.name,
    type: patch.type !== undefined ? (patch.type === 'openai' ? 'openai' : 'anthropic') : row.type,
    base_url: patch.baseUrl !== undefined ? patch.baseUrl : row.base_url,
    multi_key_enabled: patch.multiKeyEnabled !== undefined ? (patch.multiKeyEnabled ? 1 : 0) : row.multi_key_enabled,
    keys: patch.keys !== undefined ? JSON.stringify(patch.keys.filter(Boolean)) : row.keys,
    models: patch.models !== undefined ? JSON.stringify(patch.models.filter(Boolean)) : row.models,
    selected_model: patch.selectedModel !== undefined ? patch.selectedModel : row.selected_model,
  };
  db.prepare(
    `UPDATE ai_providers SET name=?, type=?, base_url=?, multi_key_enabled=?, keys=?, models=?, selected_model=? WHERE id=?`
  ).run(next.name, next.type, next.base_url, next.multi_key_enabled, next.keys, next.models, next.selected_model, id);
  return getProvider(id);
}

export function deleteProvider(id) {
  db.prepare('DELETE FROM ai_providers WHERE id = ?').run(id);
  if (getSetting('activeProviderId', '') === String(id)) {
    const first = db.prepare('SELECT id FROM ai_providers ORDER BY id ASC LIMIT 1').get();
    setSetting('activeProviderId', first ? String(first.id) : '');
  }
}

// Multi-key rotation was removed — it complicated debugging (every failed
// request could've come from a different key with different quota/status)
// without a clear enough benefit to keep. Always use the first stored key.
function pickKey(keys) {
  return keys[0] || '';
}

function joinUrl(base, path) {
  return `${(base || '').replace(/\/+$/, '')}${path}`;
}

// Claude's extended thinking is Anthropic-specific — there's no generic
// equivalent to request from an OpenAI-compatible relay, so it's only ever
// enabled for provider.type === 'anthropic'. The API requires max_tokens to
// exceed the thinking budget, so callers asking for it need to size
// maxTokens accordingly (see THINKING_BUDGET_TOKENS usage below).
export const THINKING_BUDGET_TOKENS = 1024;

async function callAnthropic({ apiKey, baseUrl, model, system, messages, tools, maxTokens, enableThinking }) {
  const client = new Anthropic({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });
  return client.messages.create({
    model,
    max_tokens: maxTokens || 300,
    system,
    messages,
    ...(tools ? { tools } : {}),
    ...(enableThinking ? { thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET_TOKENS } } : {}),
  });
}

function extractThinking(content) {
  const blocks = (content || []).filter((b) => b.type === 'thinking');
  return blocks.map((b) => b.thinking).join('\n').trim() || null;
}

// OpenAI's own API never exposes reasoning traces, but most relays that
// proxy a reasoning-capable model through an OpenAI-compatible facade do —
// there's just no standard for where. `reasoning_content` (DeepSeek's
// convention, widely copied) and `reasoning` are the two most common
// dedicated fields; some relays instead inline it as <think>...</think>
// right inside the visible content, which needs stripping out or it'd
// show up as raw tags in the chat bubble.
function extractOpenAiThinking(message) {
  if (!message) return { text: '', thinking: null };
  let text = message.content || '';
  let thinking = message.reasoning_content || message.reasoning || null;

  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thinking = (thinking ? `${thinking}\n` : '') + thinkMatch[1].trim();
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  }

  return { text: text.trim(), thinking: thinking ? thinking.trim() : null };
}

async function callOpenAiCompatible({ apiKey, baseUrl, model, system, messages, maxTokens }) {
  const res = await fetch(joinUrl(baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 300,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Plain (non-tool) reply for a resolved provider config — both Anthropic
// and OpenAI-compatible providers get the full recent conversation, not
// just the latest message. extraInstruction is an optional one-off system
// prompt addition (used for proactive/unprompted messages, which need a
// different nudge than a normal reply but shouldn't permanently change the
// persona for every future call).
export async function getReplyViaProvider(history, provider, extraInstruction) {
  const apiKey = pickKey(provider.keys);
  if (!apiKey) return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };
  const systemPrompt = getComposedSystemPrompt(extraInstruction);
  const isOpenAi = provider.type === 'openai';
  const messages = history.map((m) => ({
    role: m.from === 'me' ? 'user' : 'assistant',
    content: isOpenAi ? toOpenAiMessageContent(m) : toAnthropicMessageContent(m),
  }));

  if (provider.type === 'openai') {
    const json = await callOpenAiCompatible({
      apiKey,
      baseUrl: provider.baseUrl,
      model: provider.selectedModel,
      system: systemPrompt,
      messages,
    });
    const { text: rawText, thinking } = extractOpenAiThinking(json.choices?.[0]?.message);
    const text = rawText || FALLBACK_REPLY;
    const tokens = json.usage?.completion_tokens ?? estimateTokens(text);
    return { text, tokens, thinking };
  }

  const response = await callAnthropic({
    apiKey,
    baseUrl: provider.baseUrl,
    model: provider.selectedModel,
    system: systemPrompt,
    messages,
    maxTokens: THINKING_BUDGET_TOKENS + 400,
    enableThinking: true,
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim() || FALLBACK_REPLY;
  const tokens = response.usage?.output_tokens ?? estimateTokens(text);
  return { text, tokens, thinking: extractThinking(response.content) };
}

export async function testProvider(id) {
  const provider = getProviderWithKeys(id);
  if (!provider) throw new Error('未找到这个供应商');
  const apiKey = pickKey(provider.keys);
  if (!apiKey) throw new Error('还没有设置 API Key');
  if (!provider.selectedModel) throw new Error('还没有选择模型');

  if (provider.type === 'openai') {
    await callOpenAiCompatible({
      apiKey,
      baseUrl: provider.baseUrl,
      model: provider.selectedModel,
      system: '你是一个测试助手，收到消息只回复"收到"两个字。',
      messages: [{ role: 'user', content: '你好' }],
      maxTokens: 8,
    });
  } else {
    await callAnthropic({
      apiKey,
      baseUrl: provider.baseUrl,
      model: provider.selectedModel,
      system: undefined,
      messages: [{ role: 'user', content: '你好' }],
      maxTokens: 8,
    });
  }
}

export { callAnthropic, callOpenAiCompatible, pickKey, extractThinking, extractOpenAiThinking };
