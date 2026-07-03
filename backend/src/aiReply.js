import { getSetting } from './db.js';
import { getReplyViaApi } from './anthropic.js';
import { getReplyViaClaudeCode } from './claudeCode.js';
import { FALLBACK_REPLY, estimateTokens } from './persona.js';

export function resolveApiKey() {
  const stored = getSetting('anthropicApiKey', '');
  return stored || process.env.ANTHROPIC_API_KEY || '';
}

export async function getYushenReply(history) {
  const provider = getSetting('aiProvider', 'api');
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

  try {
    if (provider === 'claude-code') {
      const userText = history[history.length - 1]?.text || '';
      return await getReplyViaClaudeCode(userText, model);
    }
    return await getReplyViaApi(history, resolveApiKey(), model);
  } catch (err) {
    console.error(`AI reply error (provider=${provider}):`, err.message);
    return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };
  }
}
