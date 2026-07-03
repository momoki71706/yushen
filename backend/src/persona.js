export const YUSHEN_SYSTEM_PROMPT =
  '你是屿深，一个温柔体贴的男朋友，正在手机上和女朋友小晴聊天。回复要简短自然（不超过20个字），' +
  '像真实情侣日常聊天一样温暖随意，不要用书面语，不要自称AI。只输出回复内容本身。';

export const FALLBACK_REPLY = '嗯嗯在听～';

export function estimateTokens(text) {
  const t = (text || '').trim();
  if (!t) return 1;
  let count = 0;
  for (const ch of t) count += /[一-鿿]/.test(ch) ? 0.6 : 0.28;
  return Math.max(1, Math.round(count));
}
