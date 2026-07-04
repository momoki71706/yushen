import { db, getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, trimTrailingAssistantTurns } from './providers.js';
import { withReplyRetry, classifyReplyForRetry } from './persona.js';
import { getContextMessageLimit } from './contextSettings.js';
import { enrichHistory } from './chatHistory.js';

// Below this, a letter reads as too slight to be worth a written reply —
// filtered out in code before ever spending a call on it, distinct from
// the model's own (much softer) judgment call about whether a *qualifying*
// letter is actually worth responding to.
export const MIN_REPLY_LENGTH = 60;

function getActiveProvider() {
  const providerId = getSetting('activeProviderId', '');
  return providerId ? getProviderWithKeys(providerId) : null;
}

// Same recent-history shape diaryAi.js builds for its own unprompted write —
// kept as its own copy for the same reason (recentHistory lives inside the
// chat route file, and the existing convention is each scheduler-ish module
// builds its own rather than sharing across route boundaries).
async function recentChatHistory() {
  const rows = db
    .prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime FROM chat_messages ORDER BY id DESC LIMIT ?')
    .all(getContextMessageLimit())
    .reverse();
  return trimTrailingAssistantTurns(await enrichHistory(rows));
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

const FRESH_LETTER_INSTRUCTION = `【主动写信】现在是你自己想给小晴写一封信的时刻——不是在回复她的哪一封具体的信，就是单纯想给她写点什么，可以是想她了、最近的心情、一件小事，基于你们最近的聊天和相处来写，语气自然真诚，像真的提笔写信，不要提到这是被安排/触发的。

请严格按下面的格式输出，不要有多余内容：
称呼：给这封信选一个称呼小晴的方式（不用固定，可以参考你们最近的相处、她的小名，简单自然为主，偶尔可以有点小花样，别太夸张）
署名：给这封信选一个自己的署名方式（同样不用固定，简单自然为主）
正文：信的内容，语气自然真诚`;

// There's no autonomous version of this — unlike diary entries, nothing
// currently makes him write a letter out of the blue on a schedule; every
// letter from him has otherwise only ever existed as a reply. This is what
// backs the manual "让他给我写信" debug trigger, and is also the only way a
// mailbox can ever get its first received letter at all.
export async function writeFreshLetter() {
  const provider = getActiveProvider();
  if (!provider) return null;
  const history = await recentChatHistory();
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, FRESH_LETTER_INSTRUCTION));
  if (classifyReplyForRetry(reply.text).bad) return { failed: true, reply: null };
  return { failed: false, reply: parseReply(reply.text) };
}
