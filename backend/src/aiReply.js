import { getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, pickKey } from './providers.js';
import { getReplyViaClaudeCode } from './claudeCode.js';
import { FALLBACK_REPLY, classifyAiError, estimateTokens, withReplyRetry } from './persona.js';
import { getEnabledTools, runAnthropicToolLoop, runOpenAiToolLoop } from './mcp.js';
import { getLocalTools } from './localTools.js';

// An empty reply or a canned "something broke" line that turns out to be
// transient (network blip, overloaded server) gets one automatic retry
// before the user ever sees it — see persona.js's withReplyRetry for what
// counts as worth retrying.
export async function getYushenReply(history) {
  return withReplyRetry(() => attemptYushenReply(history));
}

async function attemptYushenReply(history) {
  const aiMode = getSetting('aiMode', 'provider');
  const mcpEnabled = getSetting('mcpToolsEnabled', '0') === '1';

  try {
    if (aiMode === 'claude-code') {
      // The CLI only takes a single plain-text prompt, no image content
      // blocks — an image turn's `.text` is just its caption (often empty),
      // so without this it would silently look like a blank message instead
      // of a photo the model can't actually see through this path.
      const last = history[history.length - 1];
      const userText = last ? (last.image ? `[发送了一张图片]${last.text ? `，并说：${last.text}` : ''}` : last.text) : '';
      return await getReplyViaClaudeCode(userText, undefined, mcpEnabled);
    }

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };

    // Local tools (e.g. schedule_message) are always available — they're
    // core app behavior, not an external integration, so they shouldn't
    // depend on the MCP toggle. MCP-server tools are added on top of that
    // only when the user has actually turned MCP on.
    const tools = [...getLocalTools(), ...(mcpEnabled ? await getEnabledTools() : [])];

    if (tools.length) {
      try {
        const apiKey = pickKey(provider.keys);
        if (provider.type === 'openai') {
          return await runOpenAiToolLoop(history, apiKey, provider.baseUrl, provider.selectedModel, tools);
        }
        return await runAnthropicToolLoop(history, apiKey, provider.selectedModel, provider.baseUrl || undefined, tools);
      } catch (err) {
        // Some relays choke specifically on requests carrying a tools[]
        // parameter (poor/no function-calling support) — since tools are
        // now attached to every message by default via the local
        // schedule_message tool, that would otherwise break plain chat
        // entirely for those providers. Falling back to the tool-less
        // path keeps normal conversation working even when tool use
        // itself isn't usable.
        console.error('[tools] tool-enabled call failed, falling back to plain reply:', err.message);
      }
    }
    return await getReplyViaProvider(history, provider);
  } catch (err) {
    console.error('AI reply error:', err.message);
    const text = classifyAiError(err);
    return { text, tokens: estimateTokens(text) };
  }
}
