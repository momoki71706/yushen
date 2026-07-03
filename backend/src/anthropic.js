import Anthropic from '@anthropic-ai/sdk';
import { YUSHEN_SYSTEM_PROMPT, FALLBACK_REPLY, estimateTokens } from './persona.js';

export async function getReplyViaApi(history, apiKey, model) {
  if (!apiKey) {
    return { text: FALLBACK_REPLY, tokens: estimateTokens(FALLBACK_REPLY) };
  }

  const anthropic = new Anthropic({ apiKey });
  const messages = history.map((m) => ({
    role: m.from === 'me' ? 'user' : 'assistant',
    content: m.text,
  }));

  const response = await anthropic.messages.create({
    model: model || 'claude-sonnet-5',
    max_tokens: 200,
    system: YUSHEN_SYSTEM_PROMPT,
    messages,
  });
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim() || FALLBACK_REPLY;
  const tokens = response.usage?.output_tokens ?? estimateTokens(text);
  return { text, tokens };
}

export async function testApiKey(apiKey, model) {
  const anthropic = new Anthropic({ apiKey });
  await anthropic.messages.create({
    model: model || 'claude-sonnet-5',
    max_tokens: 8,
    messages: [{ role: 'user', content: '你好' }],
  });
}
