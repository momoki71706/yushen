export const FALLBACK_REPLY = '爸比现在不在线哦';

export function estimateTokens(text) {
  const t = (text || '').trim();
  if (!t) return 1;
  let count = 0;
  for (const ch of t) count += /[一-鿿]/.test(ch) ? 0.6 : 0.28;
  return Math.max(1, Math.round(count));
}
