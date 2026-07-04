import { getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider } from './providers.js';
import { withReplyRetry, classifyReplyForRetry } from './persona.js';

// Below this, a letter reads as too slight to be worth a written reply —
// filtered out in code before ever spending a call on it, distinct from
// the model's own (much softer) judgment call about whether a *qualifying*
// letter is actually worth responding to.
export const MIN_REPLY_LENGTH = 60;

function getActiveProvider() {
  const providerId = getSetting('activeProviderId', '');
  return providerId ? getProviderWithKeys(providerId) : null;
}

const REPLY_INSTRUCTION_TEMPLATE = (letter) => `【回信】小晴写了一封信给你，称呼是"Dear ${letter.dear_text || letter.recipient}"，署名是"${letter.signature}"，内容如下：
${letter.body}

请你决定要不要给这封信回一封信——大多数信不需要回，只有内容比较用心、字数比较多、值得认真回应的信才回，不用勉强凑数。

如果决定不回，只输出：不回信

如果决定要回，请严格按下面的格式输出，不要有多余内容：
称呼：给这封回信选一个称呼小晴的方式（不用每次固定一样，可以参考你们最近的相处、她的小名，简单自然为主，偶尔可以有点小花样，别太夸张）
署名：给这封回信选一个自己的署名方式（同样不用固定，简单自然为主）
正文：回信的内容，语气自然真诚，像真的提笔写信`;

function parseReply(text) {
  const dearMatch = text.match(/称呼[：:]\s*([^\n]+)/);
  const signatureMatch = text.match(/署名[：:]\s*([^\n]+)/);
  const bodyMatch = text.match(/正文[：:]\s*([\s\S]+)/);
  if (!bodyMatch) return null;
  return {
    dearText: (dearMatch?.[1] || '小晴').trim(),
    signature: (signatureMatch?.[1] || '屿深').trim(),
    body: bodyMatch[1].trim(),
  };
}

// Called by letterScheduler when a request-reply queue item comes due.
// Three distinct outcomes, kept apart on purpose:
//   - failed: true    → the call itself broke (network/model error) or came
//                        back empty — worth retrying, same as diaryScheduler.
//   - failed: false, reply: null → the model looked at it and genuinely
//                        decided not to write back (or the text didn't
//                        parse) — a real outcome, not a glitch, so it's
//                        done and shouldn't retry.
//   - reply: {...}     → a real reply to save.
export async function writeLetterReply(sourceLetter) {
  const provider = getActiveProvider();
  if (!provider) return null; // no provider configured yet — caller keeps waiting, doesn't count as an attempt

  const history = [{ from: 'me', text: `小晴写了一封信：${sourceLetter.body}` }];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, REPLY_INSTRUCTION_TEMPLATE(sourceLetter)));
  if (classifyReplyForRetry(reply.text).bad) return { failed: true, reply: null };
  if (/^不回信/.test(reply.text.trim())) return { failed: false, reply: null };
  return { failed: false, reply: parseReply(reply.text) };
}
