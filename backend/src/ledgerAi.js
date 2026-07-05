import { db, getSetting } from './db.js';
import { getProviderWithKeys, getReplyViaProvider } from './providers.js';
import { withReplyRetry, classifyReplyForRetry } from './persona.js';

function getActiveProvider() {
  const providerId = getSetting('activeProviderId', '');
  return providerId ? getProviderWithKeys(providerId) : null;
}

// Folded into one reference note rather than fed as literal turns — same
// reason diaryAi.js/letterAi.js do this: a call that's supposed to produce
// a fresh remark, not a reply, shouldn't be given something that reads like
// a conversation it needs to continue.
function recentLedgerNote(limit = 20) {
  const rows = db.prepare('SELECT * FROM ledger_entries ORDER BY date_iso DESC, id DESC LIMIT ?').all(limit);
  if (!rows.length) return null;
  const lines = rows.map(
    (r) => `${r.date_iso} ${r.type === 'income' ? '收入' : '支出'} ${r.category} ¥${r.amount}${r.note ? '，备注：' + r.note : ''}`
  );
  return lines.join('\n');
}

function currentMonthBudgetNote() {
  const month = db.prepare("SELECT strftime('%Y-%m', datetime('now', '+8 hours')) AS m").get().m;
  const budgets = db.prepare('SELECT * FROM ledger_budgets WHERE month = ?').all(month);
  if (!budgets.length) return null;
  const spentRows = db
    .prepare("SELECT category, SUM(amount) AS total FROM ledger_entries WHERE type = 'expense' AND date_iso LIKE ? GROUP BY category")
    .all(`${month}%`);
  const spent = {};
  spentRows.forEach((r) => {
    spent[r.category] = r.total;
  });
  const lines = budgets.map((b) => `${b.category}：预算¥${b.amount}，本月已花¥${(spent[b.category] || 0).toFixed(0)}`);
  return lines.join('\n');
}

const NAG_INSTRUCTION = `【记账提醒】现在是晚上，小晴今天好像还没有记账。请以你一贯的人设，在聊天里自然地问一句她今天的花销/收入情况，提醒她记一下账（不超过20字），像正常聊天里随口一问，不要生硬像任务提醒，不要提到"记账提醒"这类会暴露是程序逻辑的说法。只输出这句话本身。`;

// Called by ledgerScheduler within the 20:00-22:00 window when today has
// no ledger_entries row at all — a nudge, not a real reply, so it doesn't
// need much context beyond what she's logged recently.
export async function writeLedgerNag() {
  const provider = getActiveProvider();
  if (!provider) return null;
  const note = recentLedgerNote(10);
  // Never pass an empty messages array — this is a fresh remark, not a
  // reply, and no provider API accepts a call with zero messages.
  const history = [{ from: 'me', text: note ? `（最近几天的记账记录，仅供参考）\n${note}` : '（还没有任何记账记录）' }];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, NAG_INSTRUCTION));
  if (classifyReplyForRetry(reply.text).bad) return { failed: true, text: null };
  return { failed: false, text: reply.text.trim() };
}

// Only today's entries — the card is meant to read like a comment on what
// she's done today, not a summary spanning several days.
function todayLedgerNote() {
  const todayISO = db.prepare("SELECT date(datetime('now', '+8 hours')) AS d").get().d;
  const rows = db.prepare('SELECT * FROM ledger_entries WHERE date_iso = ? ORDER BY id DESC').all(todayISO);
  if (!rows.length) return null;
  const lines = rows.map(
    (r) => `${r.type === 'income' ? '收入' : '支出'} ${r.category} ¥${r.amount}${r.note ? '，备注：' + r.note : ''}`
  );
  return lines.join('\n');
}

const CARD_MESSAGE_INSTRUCTION = `【记账卡片小语】请以你一贯的人设，根据下面小晴今天的记账记录（如果附带本月预算情况也一起参考），写一句简短的话（不超过20字），可以是关心她吃了什么好吃的、提醒某个类别快超/已经超预算了、或者单纯调侃一下她的消费习惯——要参考她记录里具体的类别或备注，不要写得笼统。语气自然像日常随口一说，不要写成分析、总结、推理的口吻（比如不要说"看你今天...说明/看来..."这类分析腔），不要提到"记账""预算"这类词以外的程序化说法。只输出这句话本身，不要输出任何思考过程、前缀或解释。`;

// Called by ledgerScheduler 1-2 times a day (or on demand via the manual
// regenerate route) — the management page's 记账 card subtitle, replacing
// the old static rotating placeholder string with something that actually
// reflects what she's logged today.
export async function writeLedgerCardMessage() {
  const provider = getActiveProvider();
  if (!provider) return null;
  const ledgerNote = todayLedgerNote();
  if (!ledgerNote) return { failed: false, text: null }; // nothing logged today — not a failure, just nothing to say
  const budgetNote = currentMonthBudgetNote();
  const combined = budgetNote ? `${ledgerNote}\n\n（本月预算情况）\n${budgetNote}` : ledgerNote;
  const history = [{ from: 'me', text: `（小晴今天的记账记录，仅供参考）\n${combined}` }];
  const reply = await withReplyRetry(() => getReplyViaProvider(history, provider, CARD_MESSAGE_INSTRUCTION));
  if (classifyReplyForRetry(reply.text).bad) return { failed: true, text: null };
  return { failed: false, text: reply.text.trim() };
}
