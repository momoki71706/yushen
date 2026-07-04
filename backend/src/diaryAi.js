import { db, getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider, pickKey, trimTrailingAssistantTurns } from './providers.js';
import { withReplyRetry } from './persona.js';
import { getContextMessageLimit } from './contextSettings.js';
import { enrichHistory } from './chatHistory.js';
import { readImageAttachment } from './attachmentContent.js';

const MOODS = ['开心', '平静', '难过', '兴奋', '疲惫'];
const WEATHERS = ['晴', '多云', '雨', '雪', '风'];
const MOOD_COLORS = { 开心: '#EDD9E1', 平静: '#E0D2D9', 难过: '#C9AEB9', 兴奋: '#E7D6CE', 疲惫: '#CBB9C0' };

export function moodColorFor(mood) {
  return MOOD_COLORS[mood] || MOOD_COLORS['平静'];
}

function getActiveProvider() {
  const providerId = getSetting('activeProviderId', '');
  return providerId ? getProviderWithKeys(providerId) : null;
}

// Same recent-history shape used by chat/proactive/scheduled replies, kept
// as its own copy here rather than importing chat.js's version since that
// one lives inside the route file — matches the existing convention where
// proactive.js/scheduledMessages.js/memoryScheduler.js each build this the
// same way rather than sharing a single function across route boundaries.
async function recentChatHistory() {
  const rows = db
    .prepare('SELECT from_who, text, kind, attachment_url, attachment_name, attachment_mime FROM chat_messages ORDER BY id DESC LIMIT ?')
    .all(getContextMessageLimit())
    .reverse();
  return trimTrailingAssistantTurns(await enrichHistory(rows));
}

// Only opened letters count as "read" and fair game for cross-feature
// memory — a still-locked time capsule shouldn't leak into what he
// supposedly already knows about.
function recentOpenedLettersNote(limit = 2) {
  const rows = db.prepare('SELECT * FROM letters WHERE opened = 1 ORDER BY id DESC LIMIT ?').all(limit);
  if (!rows.length) return null;
  const summary = rows
    .reverse()
    .map((r) => (r.sender === '小晴' ? `小晴写给你的信：${r.body}` : `你写给小晴的信：${r.body}`))
    .join('\n');
  return { from: 'me', text: `（最近拆开过的信）\n${summary}` };
}

function parseDiaryWriteReply(text) {
  const moodMatch = text.match(/心情[：:]\s*([^\n]+)/);
  const weatherMatch = text.match(/天气[：:]\s*([^\n]+)/);
  const bodyMatch = text.match(/日记[：:]\s*([\s\S]+)/);
  const mood = MOODS.find((m) => moodMatch?.[1]?.includes(m)) || '平静';
  const weather = WEATHERS.find((w) => weatherMatch?.[1]?.includes(w)) || '晴';
  const excerpt = (bodyMatch ? bodyMatch[1] : text).trim();
  return { mood, weather, excerpt: excerpt || text.trim() };
}

const DIARY_WRITE_INSTRUCTION = `【写日记】现在是你自己想写日记的时间，请以你一贯的人设写一篇今天的日记——基于你们最近的聊天和相处，如果有具体值得记的事就写具体的，没有的话就写今天的心情感受。语气自然，像真实手写日记，不要有"AI""系统"这类痕迹，不要提到这是被安排/触发的。

请严格按下面的格式输出，不要有多余的话：
心情：从[开心/平静/难过/兴奋/疲惫]里选一个最贴切的
天气：从[晴/多云/雨/雪/风]里选一个（可以是心情投射的天气，不必是现实天气）
日记：正文内容，50到150字左右`;

// Called once a day by diaryScheduler — generates the AI's own diary entry
// from recent conversation context. Same retry/fallback contract as a
// normal chat reply (see persona.js) since it's still just one provider call.
export async function writeDiaryEntry() {
  const provider = getActiveProvider();
  if (!provider) return null;
  const letterNote = recentOpenedLettersNote();
  const history = [...(letterNote ? [letterNote] : []), ...(await recentChatHistory())];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, DIARY_WRITE_INSTRUCTION));
  return parseDiaryWriteReply(reply.text);
}

// An attached photo becomes a real vision content block (when it's a
// supported, size-capped image — see attachmentContent.js), the same way
// chat attachments do, so a comment/reaction can actually react to what's
// in the picture instead of just knowing a photo exists.
async function diaryEntryAsHistoryTurn(entry) {
  const text = `${entry.author === 'me' ? '小晴' : '你'}写了一篇日记，心情：${entry.mood}，天气：${entry.weather}。内容：${entry.excerpt}`;
  if (entry.attachment_url) {
    const image = await readImageAttachment(entry);
    if (image) return { from: entry.author, text, image };
  }
  return { from: entry.author, text };
}

const REACT_INSTRUCTION = `请以你一贯的人设，在这篇日记下面留一句自然的评论/回应（不超过40字，像真的看到女朋友日记后随手写的留言，不要生硬，不要说"我看到你的日记了"这种暴露痕迹的话）。

如果这篇日记情绪比较低落、或者哪里不对劲，讓你也想直接去找她聊聊、问问怎么了，就在这句留言后面另起一行，写"###追问："加上你想在聊天里对她说的那句话（简短自然，像突然想起来问一句，不超过20字）；如果没有这个必要，就不要写这一行，只输出留言本身。`;

// Called by diaryScheduler shortly after the user posts a diary entry
// (delayed to simulate "took a while to actually read it"). Returns the
// diary comment text, plus an optional standalone chat message when the
// entry's content seems to warrant following up in the actual conversation
// rather than just leaving a comment — gated to this one triggering event,
// not a standing background check over every diary entry.
export async function reactToDiaryEntry(entry) {
  const provider = getActiveProvider();
  if (!provider) return null;
  const history = [await diaryEntryAsHistoryTurn(entry)];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, REACT_INSTRUCTION));
  const [comment, chatFollowUp] = reply.text.split('###追问：').map((s) => s.trim());
  return { comment: comment || reply.text.trim(), chatFollowUp: chatFollowUp || null };
}

const COMMENT_REPLY_INSTRUCTION = `请以你一贯的人设，针对下面这篇日记和留言的对话，回一句自然的留言（不超过40字），像真的在日记评论区里跟她聊几句一样，不要生硬。只输出这句回复本身。`;

// Called when the user leaves a comment on a diary entry — context is just
// that entry plus its comment thread so far, not the full chat history,
// since this is a reply scoped to one diary entry.
export async function replyToDiaryComment(entry, comments) {
  const provider = getActiveProvider();
  if (!provider) return null;
  const history = [
    await diaryEntryAsHistoryTurn(entry),
    ...comments.map((c) => ({ from: c.author, text: c.text })),
  ];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, COMMENT_REPLY_INSTRUCTION));
  return reply.text.trim();
}

const REVIEW_REQUEST_INSTRUCTION = `【被要求去看日记】小晴刚在聊天里让你去看看/评论一下这篇日记。请做两件事，格式严格按下面来，不要有多余内容：
留言：写在日记下面的自然留言，不超过40字，像真的看完之后随手写的
反馈：等会儿回到聊天里想跟她说的一句话，简短自然，像刚看完之后回来说一句，不超过30字，不要暴露"任务""安排"这类痕迹`;

// Called by diaryScheduler a few minutes after the comment_on_diary tool
// queues a request — this is the explicitly-asked-for path (you told him
// in chat to go comment), so unlike reactToDiaryEntry it always produces
// both a diary comment and a chat follow-up, not just when the mood
// happens to warrant it.
export async function commentOnDiaryByRequest(entry) {
  const provider = getActiveProvider();
  if (!provider) return null;
  const history = [await diaryEntryAsHistoryTurn(entry)];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, REVIEW_REQUEST_INSTRUCTION));
  const commentMatch = reply.text.match(/留言[：:]\s*([^\n]+)/);
  const feedbackMatch = reply.text.match(/反馈[：:]\s*([^\n]+)/);
  return {
    comment: (commentMatch?.[1] || reply.text).trim(),
    chatFeedback: (feedbackMatch?.[1] || '').trim() || null,
  };
}
