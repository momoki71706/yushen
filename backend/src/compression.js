import { db, getSetting, setSetting } from './db.js';
import { getProviderWithKeys, callAnthropic, callOpenAiCompatible, pickKey } from './providers.js';

// Chat context is a rolling window of the most recent KEEP_RECENT messages
// (kept in sync with chat.js's CONTEXT_MESSAGE_LIMIT). Once more than
// COMPRESS_TRIGGER messages have piled up since the last compression, the
// oldest excess is folded into a running text summary instead of being
// dropped outright, so the AI keeps long-term continuity without token
// cost growing forever.
const COMPRESS_TRIGGER = 60;
const KEEP_RECENT = 30;

const SUMMARY_SYSTEM_PROMPT = `你是一个对话摘要助手。请将下面这段聊天记录压缩成一段简洁的中文摘要，用于给AI提供长期背景记忆。
要求：
- 用第三人称转述，不要用对话格式
- 保留所有具体的事实：约定、日期、称呼、重要情绪、承诺、待办事项
- 禁止用"聊了一些日常"这种空话代替具体内容
- 如果给出了已有的旧摘要，需要把旧摘要和新内容自然融合成一段连续的摘要，而不是简单拼接
- 总长度控制在 400 字以内，只输出摘要正文，不要加其他说明`;

async function callProviderForSummary(provider, apiKey, userPrompt) {
  if (provider.type === 'openai') {
    const json = await callOpenAiCompatible({
      apiKey,
      baseUrl: provider.baseUrl,
      model: provider.selectedModel,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 500,
    });
    return (json.choices?.[0]?.message?.content || '').trim();
  }
  const response = await callAnthropic({
    apiKey,
    baseUrl: provider.baseUrl,
    model: provider.selectedModel,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 500,
  });
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

// Fire-and-forget: checks whether enough new messages have piled up and,
// if so, compresses the oldest excess into the rolling summary stored in
// settings. Safe to call after every message — it's a no-op below the
// trigger threshold.
export async function maybeCompressChatHistory() {
  try {
    const summarizedThroughId = Number(getSetting('chatSummarizedThroughId', '0')) || 0;
    const newMessages = db
      .prepare('SELECT id, from_who, text FROM chat_messages WHERE id > ? ORDER BY id ASC')
      .all(summarizedThroughId);

    if (newMessages.length <= COMPRESS_TRIGGER) return;

    const toCompress = newMessages.slice(0, newMessages.length - KEEP_RECENT);
    if (!toCompress.length) return;

    const providerId = getSetting('activeProviderId', '');
    const provider = providerId ? getProviderWithKeys(providerId) : null;
    if (!provider) return;
    const apiKey = pickKey(provider.keys);
    if (!apiKey) return;

    const chunkText = toCompress.map((m) => `${m.from_who === 'me' ? '小晴' : '屿深'}: ${m.text}`).join('\n');
    const existingSummary = (getSetting('chatSummary', '') || '').trim();
    const userPrompt = existingSummary
      ? `已有的旧摘要：\n${existingSummary}\n\n新的对话内容：\n${chunkText}\n\n请输出融合后的新摘要。`
      : `对话内容：\n${chunkText}\n\n请输出摘要。`;

    const summary = await callProviderForSummary(provider, apiKey, userPrompt);
    if (summary) {
      setSetting('chatSummary', summary);
      setSetting('chatSummarizedThroughId', String(toCompress[toCompress.length - 1].id));
    }
  } catch (err) {
    console.error('Chat compression error:', err.message);
  }
}
