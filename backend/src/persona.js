export const FALLBACK_REPLY = '爸比现在不在线哦';

// When something actually breaks (bad key, no quota, rate limited, relay
// down) we still want an in-character line instead of exposing raw error
// text — but a casual, specific line beats one generic catch-all every
// time, since the specific one tells whoever's watching the logs (or
// just guessing from the phone) what's actually wrong.
const ERROR_REPLIES = [
  { test: (status, msg) => status === 401 || msg.includes('authentication') || msg.includes('invalid x-api-key') || msg.includes('invalid_api_key') || msg.includes('unauthorized'), text: '钥匙好像失效了，我这边进不去' },
  { test: (status, msg) => status === 402 || msg.includes('insufficient') || msg.includes('quota') || msg.includes('balance') || msg.includes('余额'), text: '小晴，余额不足了' },
  { test: (status, msg) => status === 429 || msg.includes('rate limit') || msg.includes('too many requests'), text: '太多人找我说话啦，等会儿再试试' },
  { test: (status) => status >= 500 && status < 600, text: '那边服务器好像卡住了，等会再找我' },
  { test: (status, msg) => msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('etimedout'), text: '线路好像断了，我这边收不到消息' },
];

export function classifyAiError(err) {
  const rawStatus = err?.status ?? (String(err?.message || '').match(/HTTP (\d+)/) || [])[1];
  const status = rawStatus ? Number(rawStatus) : null;
  const msg = String(err?.message || '').toLowerCase();
  const match = ERROR_REPLIES.find((r) => r.test(status, msg));
  return match ? match.text : FALLBACK_REPLY;
}

export function estimateTokens(text) {
  const t = (text || '').trim();
  if (!t) return 1;
  let count = 0;
  for (const ch of t) count += /[一-鿿]/.test(ch) ? 0.6 : 0.28;
  return Math.max(1, Math.round(count));
}
