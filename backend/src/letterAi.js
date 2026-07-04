import { db, getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider } from './providers.js';
import { withReplyRetry, classifyReplyForRetry } from './persona.js';
import { getContextMessageLimit } from './contextSettings.js';

// Below this, a letter reads as too slight to be worth a written reply —
// filtered out in code before ever spending a call on it, distinct from
// the model's own (much softer) judgment call about whether a *qualifying*
// letter is actually worth responding to.
export const MIN_REPLY_LENGTH = 60;

function getActiveProvider() {
  const providerId = getSetting('activeProviderId', '');
  return providerId ? getProviderWithKeys(providerId) : null;
}

// Feeding raw chat turns straight in as real conversation history made the
// model treat this as just another chat reply to whatever she'd said last,
// instead of switching into "writing an unprompted letter" mode — same bug
// diaryAi.js's writeDiaryEntry had, and the same fix: fold recent chat into
// one reference note (no "last message" left for the model to feel it
// needs to answer) rather than passing it as literal turns.
function recentChatNote() {
  const rows = db
    .prepare('SELECT from_who, text, kind FROM chat_messages ORDER BY id DESC LIMIT ?')
    .all(Math.min(getContextMessageLimit(), 20))
    .reverse()
    .filter((r) => r.kind === 'text' && r.text);
  if (!rows.length) return null;
  const lines = rows.map((r) => `${r.from_who === 'me' ? '小晴' : '你'}：${r.text}`);
  return { from: 'me', text: `（最近的聊天记录，仅供参考，不用回复这条消息本身）\n${lines.join('\n')}` };
}

// 称呼/署名 shouldn't be picked purely at random each time — biasing
// towards whatever's been used most in past letters (with room to still
// pick something else when the letter's own content calls for it) reads
// far more like one consistent person than a coin flip every time.
function frequentValues(column, sender, limit = 4) {
  return db
    .prepare(
      `SELECT ${column} AS v, COUNT(*) AS c FROM letters
       WHERE sender = ? AND ${column} IS NOT NULL AND ${column} != ''
       GROUP BY ${column} ORDER BY c DESC LIMIT ?`
    )
    .all(sender, limit)
    .map((r) => r.v);
}

function nameHint() {
  const dears = frequentValues('dear_text', '屿深');
  const sigs = frequentValues('signature', '屿深');
  if (!dears.length && !sigs.length) return '';
  const parts = [];
  if (dears.length) parts.push(`最近常用的称呼：${dears.join('、')}`);
  if (sigs.length) parts.push(`最近常用的署名：${sigs.join('、')}`);
  return `\n\n（参考：${parts.join('；')}——可以延续用惯的这几种，也可以按这封信提到的内容/心情挑一个更贴切的，不用每次都变着花样）`;
}

const REPLY_INSTRUCTION_TEMPLATE = (letter) => `【回信】小晴写了一封信给你，称呼是"Dear ${letter.dear_text || letter.recipient}"，署名是"${letter.signature}"，内容如下：
${letter.body}

请你决定要不要给这封信回一封信——大多数信不需要回，只有内容比较用心、字数比较多、值得认真回应的信才回，不用勉强凑数。

如果决定不回，只输出：不回信

如果决定要回，请严格按下面的格式输出，不要有多余内容：
称呼：给这封回信选一个称呼小晴的方式（不用每次固定一样，可以参考你们最近的相处、她的小名，简单自然为主，偶尔可以有点小花样，别太夸张）
署名：给这封回信选一个自己的署名方式（同样不用固定，简单自然为主）
正文：回信的内容，语气自然真诚，像真的提笔写信——正文最后不要再另起一行写"——署名"这样的落款，署名已经在上面单独写过了${nameHint()}`;

// The signature is already rendered on its own as a separate field below
// the body — but models trained on real letters often can't resist also
// closing the body text itself with a "——署名" sign-off line, which then
// shows up twice on screen. Strip a trailing line that's just that same
// signature (with or without a leading dash) before storing the body.
function stripInlineSignature(body, signature) {
  const lines = body.split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return body.trim();
  const last = lines[lines.length - 1].trim();
  const bare = last.replace(/^[—\-－~～\s]+/, '').trim();
  if (bare && bare === signature.trim()) lines.pop();
  return lines.join('\n').trim();
}

function parseReply(text) {
  const dearMatch = text.match(/称呼[：:]\s*([^\n]+)/);
  const signatureMatch = text.match(/署名[：:]\s*([^\n]+)/);
  const bodyMatch = text.match(/正文[：:]\s*([\s\S]+)/);
  if (!bodyMatch) return null;
  const signature = (signatureMatch?.[1] || '屿深').trim();
  return {
    dearText: (dearMatch?.[1] || '小晴').trim(),
    signature,
    body: stripInlineSignature(bodyMatch[1].trim(), signature),
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

const freshLetterInstruction = () => `【主动写信】现在是你自己想给小晴写一封信的时刻——不是在回复她的哪一封具体的信，就是单纯想给她写点什么，可以是想她了、最近的心情、一件小事，基于你们最近的聊天和相处来写，语气自然真诚，像真的提笔写信，不要提到这是被安排/触发的。

请严格按下面的格式输出，不要有多余内容：
称呼：给这封信选一个称呼小晴的方式（不用固定，可以参考你们最近的相处、她的小名，简单自然为主，偶尔可以有点小花样，别太夸张）
署名：给这封信选一个自己的署名方式（同样不用固定，简单自然为主）
正文：信的内容，语气自然真诚——正文最后不要再另起一行写"——署名"这样的落款，署名已经在上面单独写过了${nameHint()}`;

// There's no autonomous version of this — unlike diary entries, nothing
// currently makes him write a letter out of the blue on a schedule; every
// letter from him has otherwise only ever existed as a reply. This is what
// backs the manual "让他给我写信" debug trigger, and is also the only way a
// mailbox can ever get its first received letter at all.
export async function writeFreshLetter() {
  const provider = getActiveProvider();
  if (!provider) return null;
  const chatNote = recentChatNote();
  const history = chatNote ? [chatNote] : [];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, freshLetterInstruction()));
  if (classifyReplyForRetry(reply.text).bad) return { failed: true, reply: null };
  return { failed: false, reply: parseReply(reply.text) };
}
