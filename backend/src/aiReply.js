import { getSetting } from './db.js';
import { getReplyViaApi } from './anthropic.js';
import { getReplyViaClaudeCode } from './claudeCode.js';
import { FALLBACK_REPLY, estimateTokens } from './persona.js';
import { getEnabledTools, runToolLoop } from './mcp.js';

export function resolveApiKey() {
  const stored = getSetting('anthropicApiKey', '');
  return stored || process.env.ANTHROPIC_API_KEY || '';
}

export function resolveRelayConfig() {
  return {
    apiKey: getSetting('relayApiKey', ''),
    baseURL: getSetting('relayBaseUrl', ''),
    model: getSetting('relayModel', '') || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  };
}

export async function getYushenReply(history) {
  const provider = getSetting('aiProvider', 'api');
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const mcpEnabled = getSetting('mcpToolsEnabled', '0') === '1';

  try {
    if (provider === 'claude-code') {
      const userText = history[history.length - 1]?.text || '';
      return await getReplyViaClaudeCode(userText, model, mcpEnabled);
    }
    if (provider === 'relay') {
      const relay = resolveRelayConfig();
      if (mcpEnabled) {
        const tools = await getEnabledTools();
        if (tools.length) return await runToolLoop(history, relay.apiKey, relay.model, relay.baseURL, tools);
      }
      return await getReplyViaApi(history, relay.apiKey, relay.model, relay.baseURL);
    }
    const apiKey = resolveApiKey();
    if (mcpEnabled) {
      const tools = await getEnabledTools();
      if (tools.length) return await runToolLoop(history, apiKey, model, undefined, tools);
    }
    return await getReplyViaApi(history, apiKey, model);
  } catch (err) {
    console.error(`AI reply error (provider=${provider}):`, err.message);
    return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };
  }
}
