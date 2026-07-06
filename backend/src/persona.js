export const FALLBACK_REPLY = '爸比现在不在线哦';

// Lets one reply (one provider call, one token cost) render as several
// consecutive chat bubbles instead of a single block of text — the model
// puts this marker on its own line between "messages" it wants split up,
// mimicking how a real person sends a quick burst of short texts instead
// of one long one. Split happens purely on the backend after the single
// API call returns, so this never costs extra tokens.
export const MESSAGE_SPLIT_MARKER = '[[SPLIT]]';

// Belt-and-suspenders backstop for the per-message 【x月x日 周x 时:分】
// timestamp marker chatHistory.js stamps onto every history turn (see its
// timestampPrefix) — the system prompt tells the model never to reproduce
// it, but with every turn in the conversation carrying that exact prefix,
// the model sometimes imitates the pattern anyway — not just at the very
// start of a reply, but anywhere it ends up paraphrasing/echoing back
// something from the visible history (each restated fragment picking up
// its own copy of the marker). So this strips every occurrence anywhere in
// the text, not just a leading one, rather than relying on the instruction
// (or an anchored regex) alone.
const TIMESTAMP_MARKER = /[【\[]\s*\d{1,2}\s*月\s*\d{1,2}\s*日[^】\]]{0,10}[】\]]\s*/g;

function stripTimestampMarkers(text) {
  return text.replace(TIMESTAMP_MARKER, '');
}

export function splitReplyIntoBubbles(text) {
  const cleaned = stripTimestampMarkers(String(text || ''));
  const parts = cleaned
    .split(MESSAGE_SPLIT_MARKER)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [cleaned.trim() || FALLBACK_REPLY];
}

// When something actually breaks (bad key, no quota, rate limited, relay
// down) we still want an in-character line instead of exposing raw error
// text — but a casual, specific line beats one generic catch-all every
// time, since the specific one tells whoever's watching the logs (or
// just guessing from the phone) what's actually wrong.
//
// `retryable` marks whether trying the exact same call again has a real
// chance of succeeding: a dropped connection or an overloaded server might
// just work the second time, but a bad key or a nonexistent model won't —
// retrying those would only burn an extra call for the same result.
const ERROR_REPLIES = [
  { test: (status, msg) => status === 401 || msg.includes('authentication') || msg.includes('invalid x-api-key') || msg.includes('invalid_api_key') || msg.includes('unauthorized'), text: '钥匙好像失效了，我这边进不去', retryable: false },
  { test: (status, msg) => status === 402 || msg.includes('insufficient') || msg.includes('quota') || msg.includes('balance') || msg.includes('余额'), text: '小晴，余额不足了', retryable: false },
  { test: (status, msg) => status === 429 || msg.includes('rate limit') || msg.includes('too many requests'), text: '太多人找我说话啦，等会儿再试试', retryable: false },
  { test: (status, msg) => status === 404 || msg.includes('model_not_found') || msg.includes('no available channel'), text: '这个模型好像连不上，你检查下模型名对不对', retryable: false },
  { test: (status, msg) => status === 400 || msg.includes('bad request') || msg.includes('invalid_request') || msg.includes('unsupported'), text: '这个我好像还处理不了，可能是工具那部分格式不支持', retryable: false },
  { test: (status) => status >= 500 && status < 600, text: '那边服务器好像卡住了，等会再找我', retryable: true },
  { test: (status, msg) => msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('etimedout'), text: '线路好像断了，我这边收不到消息', retryable: true },
];

export function classifyAiError(err) {
  const rawStatus = err?.status ?? (String(err?.message || '').match(/HTTP (\d+)/) || [])[1];
  const status = rawStatus ? Number(rawStatus) : null;
  const msg = String(err?.message || '').toLowerCase();
  const match = ERROR_REPLIES.find((r) => r.test(status, msg));
  return match ? match.text : FALLBACK_REPLY;
}

// Looks at a *finished* reply's text (not the raw error) so it works the
// same way whether the call threw or just quietly came back empty. A blank
// result is always worth retrying — that's a model hiccup, not a real
// error. A result that happens to match one of the canned lines above is
// only worth retrying if that specific failure is transient.
export function classifyReplyForRetry(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { bad: true, retryable: true };
  if (trimmed === FALLBACK_REPLY) return { bad: true, retryable: true };
  const match = ERROR_REPLIES.find((r) => r.text === trimmed);
  if (match) return { bad: true, retryable: !!match.retryable };
  return { bad: false, retryable: false };
}

// Generic retry wrapper for anything that resolves to { text, tokens, ... }
// or throws — used by both normal chat replies and the proactive/scheduled
// senders. Caps at one retry: enough to shake off a one-off hiccup without
// piling up extra calls (and cost) if a provider is genuinely down.
export async function withReplyRetry(attemptFn, maxAttempts = 2) {
  let result;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      result = await attemptFn();
    } catch (err) {
      const text = classifyAiError(err);
      result = { text, tokens: estimateTokens(text) };
    }
    const { bad, retryable } = classifyReplyForRetry(result.text);
    if (!bad || !retryable || attempt === maxAttempts) break;
  }
  return result;
}

export function estimateTokens(text) {
  const t = (text || '').trim();
  if (!t) return 1;
  let count = 0;
  for (const ch of t) count += /[一-鿿]/.test(ch) ? 0.6 : 0.28;
  return Math.max(1, Math.round(count));
}
