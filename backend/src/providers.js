import Anthropic from '@anthropic-ai/sdk';
import { db, getSetting, setSetting } from './db.js';
import { FALLBACK_REPLY, estimateTokens } from './persona.js';
import { getComposedSystemPrompt } from './presets.js';

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

function pickKey(keys, multiKeyEnabled) {
  if (!keys.length) return '';
  if (!multiKeyEnabled || keys.length === 1) return keys[0];
  return keys[Math.floor(Math.random() * keys.length)];
}

function joinUrl(base, path) {
  return `${(base || '').replace(/\/+$/, '')}${path}`;
}

async function callAnthropic({ apiKey, baseUrl, model, system, messages, tools, maxTokens }) {
  const client = new Anthropic({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });
  return client.messages.create({
    model,
    max_tokens: maxTokens || 300,
    system,
    messages,
    ...(tools ? { tools } : {}),
  });
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
// just the latest message.
export async function getReplyViaProvider(history, provider) {
  const apiKey = pickKey(provider.keys, provider.multiKeyEnabled);
  if (!apiKey) return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };
  const systemPrompt = getComposedSystemPrompt();
  const messages = history.map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));

  if (provider.type === 'openai') {
    const json = await callOpenAiCompatible({
      apiKey,
      baseUrl: provider.baseUrl,
      model: provider.selectedModel,
      system: systemPrompt,
      messages,
    });
    const text = (json.choices?.[0]?.message?.content || '').trim() || FALLBACK_REPLY;
    const tokens = json.usage?.completion_tokens ?? estimateTokens(text);
    return { text, tokens };
  }

  const response = await callAnthropic({
    apiKey,
    baseUrl: provider.baseUrl,
    model: provider.selectedModel,
    system: systemPrompt,
    messages,
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim() || FALLBACK_REPLY;
  const tokens = response.usage?.output_tokens ?? estimateTokens(text);
  return { text, tokens };
}

export async function testProvider(id) {
  const provider = getProviderWithKeys(id);
  if (!provider) throw new Error('未找到这个供应商');
  const apiKey = pickKey(provider.keys, provider.multiKeyEnabled);
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

export { callAnthropic, pickKey };
