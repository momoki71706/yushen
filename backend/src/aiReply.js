import { getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, pickKey } from './providers.js';
import { getReplyViaClaudeCode } from './claudeCode.js';
import { FALLBACK_REPLY, estimateTokens } from './persona.js';
import { getEnabledTools, runToolLoop } from './mcp.js';

export async function getYushenReply(history) {
  const aiMode = getSetting('aiMode', 'provider');
  const mcpEnabled = getSetting('mcpToolsEnabled', '0') === '1';

  try {
    if (aiMode === 'claude-code') {
      const userText = history[history.length - 1]?.text || '';
      return await getReplyViaClaudeCode(userText, undefined, mcpEnabled);
    }

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };

    if (mcpEnabled && provider.type === 'anthropic') {
      const tools = await getEnabledTools();
      if (tools.length) {
        const apiKey = pickKey(provider.keys, provider.multiKeyEnabled);
        return await runToolLoop(history, apiKey, provider.selectedModel, provider.baseUrl || undefined, tools);
      }
    }
    return await getReplyViaProvider(history, provider);
  } catch (err) {
    console.error('AI reply error:', err.message);
    return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };
  }
}
