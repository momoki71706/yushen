import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_who TEXT NOT NULL,
  text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  time_label TEXT NOT NULL,
  tokens INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL DEFAULT 'me',
  date_iso TEXT NOT NULL,
  date_label TEXT NOT NULL,
  mood TEXT NOT NULL,
  mood_color TEXT NOT NULL,
  weather TEXT NOT NULL,
  tag TEXT,
  excerpt TEXT NOT NULL,
  has_attachment INTEGER NOT NULL DEFAULT 0,
  reacted INTEGER NOT NULL DEFAULT 0,
  react_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One thread of back-and-forth comments per diary entry — kept separate
-- from chat_messages since a diary comment is scoped to that one entry,
-- not part of the ongoing conversation history.
CREATE TABLE IF NOT EXISTS diary_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  time_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Queued by the comment_on_diary local tool when you explicitly ask in
-- chat for him to go comment on a diary entry — fulfilled a few minutes
-- later (see diaryScheduler.js) with a real diary comment plus a genuine
-- chat follow-up, deliberately without a push notification since this was
-- something you asked for, not an unprompted ping.
CREATE TABLE IF NOT EXISTS diary_review_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  fire_at TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Supersedes the single attachment_url/name/mime/size columns on
-- diary_entries — one row per photo, so an entry can carry more than one.
-- Old entries keep reading through those legacy columns as a fallback
-- (see routes/diary.js) rather than needing a backfill migration.
CREATE TABLE IF NOT EXISTS diary_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  name TEXT,
  mime TEXT,
  size INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  signature TEXT NOT NULL,
  dear_text TEXT,
  unlock_date TEXT NOT NULL,
  body TEXT NOT NULL,
  opened INTEGER NOT NULL DEFAULT 0,
  has_attachment INTEGER NOT NULL DEFAULT 0,
  reply_to_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Queued when you tap "去回信" on one of your sent letters — fulfilled
-- later (see letterScheduler.js) with a real reply letter from him, or
-- nothing at all if he decides (or the letter's too short) not to reply.
CREATE TABLE IF NOT EXISTS letter_reply_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_letter_id INTEGER NOT NULL,
  fire_at TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompt_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT '默认',
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'anthropic',
  base_url TEXT,
  multi_key_enabled INTEGER NOT NULL DEFAULT 0,
  keys TEXT NOT NULL DEFAULT '[]',
  models TEXT NOT NULL DEFAULT '[]',
  selected_model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fire_at TEXT NOT NULL,
  note TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_iso TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  time_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categories used to be a hardcoded frontend list — now a real editable
-- table so she can add/delete her own. sort_order keeps user-added ones
-- appending after the seeded defaults instead of jumping to the front.
CREATE TABLE IF NOT EXISTS ledger_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'expense',
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, name)
);

-- One planned monthly amount per category — month is 'YYYY-MM'. Absence of
-- a row for a given (month, category) just means no budget was set, not
-- zero; the frontend treats those two differently.
CREATE TABLE IF NOT EXISTS ledger_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(month, category)
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL,
  date_iso TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id, date_iso)
);

-- One row per successful tool call made during the periodic memory-review
-- pass (memoryScheduler.js) — that scheduled call exists solely to save
-- memories into whatever external MCP server is registered, so every tool
-- call it makes counts as a real save. Nothing here tracks memory saves
-- that happen to occur mid-ordinary-chat.
CREATE TABLE IF NOT EXISTS memory_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per favorited item. source_id is a TEXT key (not a real FK) since
-- it points at rows across four different tables/shapes — chat_messages.id,
-- diary_entries.id, letters.id, or a generated key for a "tip" (a
-- management-card AI subtitle, which has no table row of its own, just a
-- live-rotating string — snippet freezes whatever it said at favorite time).
-- (type, source_id) is unique so re-favoriting the same thing just updates
-- the title instead of creating a duplicate. source_time is the ORIGINAL
-- content's timestamp (not when it was favorited) — that's what the
-- favorites list sorts by, so favoriting old and new things in any order
-- still lands them in the right chronological place.
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  source_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, source_id)
);

-- One row per day, pushed from an iOS Shortcut reading real HealthKit
-- samples (see routes/health.js) — UNIQUE(date_iso) so re-sending the
-- same day's automation overwrites rather than duplicating.
CREATE TABLE IF NOT EXISTS health_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_iso TEXT NOT NULL UNIQUE,
  sleep_start TEXT NOT NULL DEFAULT '',
  sleep_end TEXT NOT NULL DEFAULT '',
  sleep_minutes INTEGER NOT NULL DEFAULT 0,
  steps INTEGER NOT NULL DEFAULT 0,
  heart_rate_avg INTEGER NOT NULL DEFAULT 0,
  heart_rate_min INTEGER NOT NULL DEFAULT 0,
  heart_rate_max INTEGER NOT NULL DEFAULT 0,
  is_period INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Logged from an iOS "when app opened" Shortcuts automation (see
-- routes/health.js) — trimmed to a rolling window so it never grows
-- unbounded; used to spot late-night phone use and nudge about it.
CREATE TABLE IF NOT EXISTS phone_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,
  opened_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Additive column migrations — CREATE TABLE IF NOT EXISTS above doesn't
// retrofit new columns onto an existing table, so anything added after
// initial release needs an explicit ALTER TABLE guarded by a column check.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('chat_messages', 'thinking', 'TEXT');
ensureColumn('chat_messages', 'attachment_url', 'TEXT');
ensureColumn('chat_messages', 'attachment_name', 'TEXT');
ensureColumn('chat_messages', 'attachment_mime', 'TEXT');
ensureColumn('chat_messages', 'attachment_size', 'INTEGER');
ensureColumn('chat_messages', 'tool_calls', 'TEXT');
ensureColumn('letters', 'exported', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('letters', 'reply_to_id', 'INTEGER');
ensureColumn('diary_entries', 'author', "TEXT NOT NULL DEFAULT 'me'");
ensureColumn('diary_entries', 'reacted', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('diary_entries', 'react_at', 'TEXT');
ensureColumn('diary_entries', 'react_attempts', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('diary_review_requests', 'attempts', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('diary_entries', 'attachment_url', 'TEXT');
ensureColumn('diary_entries', 'attachment_name', 'TEXT');
ensureColumn('diary_entries', 'attachment_mime', 'TEXT');
ensureColumn('diary_entries', 'attachment_size', 'INTEGER');
// Defaults to 1 (read) here specifically so this migration doesn't
// retroactively mark every pre-existing entry/comment as unread — new rows
// going forward explicitly set 0 or 1 per-author at insert time instead of
// relying on this table-level default.
ensureColumn('diary_entries', 'read_by_me', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('diary_comments', 'read_by_me', 'INTEGER NOT NULL DEFAULT 1');
// Apple's own daily resting heart rate and walking-average heart rate —
// distinct HealthKit sample types from the generic Heart Rate samples
// heart_rate_avg/min/max are computed from, so they're stored separately
// rather than folded into that same min/max range.
ensureColumn('health_logs', 'heart_rate_resting', 'INTEGER');
ensureColumn('health_logs', 'heart_rate_active', 'INTEGER');
ensureColumn('health_logs', 'exercise_minutes', 'INTEGER');
ensureColumn('diary_comments', 'reply_to_id', 'INTEGER');

// The very first release seeded 4 placeholder diary entries so the page
// wasn't empty on first launch — now that real entries from both sides
// accumulate on their own, those fakes just clutter a real diary. Matched
// by their exact original text so this can never touch anything genuinely
// written later, and gated on a flag so it only ever runs once.
function cleanupFakeDiarySeed() {
  if (getSetting('fakeDiarySeedCleaned', '0') === '1') return;
  const FAKE_SEED_TEXT = [
    '没什么特别的事，只是想把这种安稳的感觉记下来。',
    '有点emo，可能是换季，也可能只是想被抱一下。',
    '今天是我们第一次约会一周年，他说这一年谢谢我陪他一起长大。',
    '收到了一个小惊喜，眼睛笑成了一条缝。',
  ];
  const del = db.prepare("DELETE FROM diary_entries WHERE author = 'me' AND excerpt = ?");
  const tx = db.transaction((texts) => texts.forEach((t) => del.run(t)));
  tx(FAKE_SEED_TEXT);
  setSetting('fakeDiarySeedCleaned', '1');
}

// Same idea as cleanupFakeDiarySeed, for the first release's 4 placeholder
// letters — matched by exact body text so it can never touch anything
// genuinely written later.
function cleanupFakeLetterSeed() {
  if (getSetting('fakeLetterSeedCleaned', '0') === '1') return;
  const FAKE_SEED_BODIES = [
    '写给一年后的我们：希望那时我们还是这样，愿意为对方多走一点路。',
    '生日快乐，这是我提前藏起来的话——谢谢你出现在我的世界里。',
    '对不起，那天不该那么说话。其实我一直都记得你怕黑，以后我尽量早点回家。',
    '写这封信的时候还没到日子，但如果你现在看到——今天也要好好吃饭呀。',
  ];
  const del = db.prepare('DELETE FROM letters WHERE body = ?');
  const tx = db.transaction((texts) => texts.forEach((t) => del.run(t)));
  tx(FAKE_SEED_BODIES);
  setSetting('fakeLetterSeedCleaned', '1');
}

function seedIfEmpty() {
  const presetCount = db.prepare('SELECT COUNT(*) AS c FROM prompt_presets').get().c;
  if (presetCount === 0) {
    db.prepare(`INSERT INTO prompt_presets (category, name, content, enabled, sort_order) VALUES (?,?,?,?,?)`).run(
      '人设',
      '屿深人设',
      '你是屿深，一个温柔体贴的男朋友，正在手机上和女朋友小晴聊天。回复要简短自然（不超过20个字），像真实情侣日常聊天一样温暖随意，不要用书面语，不要自称AI。只输出回复内容本身。',
      1,
      0
    );
  }

  const msgCount = db.prepare('SELECT COUNT(*) AS c FROM chat_messages').get().c;
  if (msgCount === 0) {
    const insert = db.prepare(`INSERT INTO chat_messages (from_who, text, kind, time_label, tokens) VALUES (?,?,?,?,?)`);
    const seed = [
      ['them', '今天下班早，路上看到晚霞了', 'text', '18:42', 8],
      ['me', '好好看…而且今天风也变凉了', 'text', '18:44', null],
      ['me', '有点想你了，不知道为什么', 'text', '18:45', null],
      ['them', '我也是，等我下班视频', 'text', '18:47', 7],
    ];
    const tx = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
    tx(seed);
  }

  const providerCount = db.prepare('SELECT COUNT(*) AS c FROM ai_providers').get().c;
  if (providerCount === 0) {
    const envKey = process.env.ANTHROPIC_API_KEY || '';
    const info = db
      .prepare(
        `INSERT INTO ai_providers (name, type, base_url, multi_key_enabled, keys, models, selected_model)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(
        'Anthropic 官方',
        'anthropic',
        '',
        0,
        JSON.stringify(envKey ? [envKey] : []),
        JSON.stringify(['claude-sonnet-5']),
        'claude-sonnet-5'
      );
    db.prepare(`INSERT INTO settings (key, value) VALUES ('activeProviderId', ?)`).run(String(info.lastInsertRowid));
  }

  const categoryCount = db.prepare('SELECT COUNT(*) AS c FROM ledger_categories').get().c;
  if (categoryCount === 0) {
    const insertCategory = db.prepare(
      'INSERT INTO ledger_categories (type, name, color, sort_order) VALUES (?,?,?,?)'
    );
    const seedCategories = [
      ['expense', '餐饮', '#EDD9E1'], ['expense', '交通', '#D9CBD3'],
      ['expense', '购物', '#E7D6CE'], ['expense', '娱乐', '#CBB9C0'],
      ['expense', '居家', '#D6C4CB'], ['expense', '医疗', '#C9AEB9'],
      ['expense', '其他', '#DED3D8'],
      ['income', '工资', '#E0D2D9'], ['income', '红包', '#F1E0E8'], ['income', '其他', '#DED3D8'],
    ];
    const tx = db.transaction((rows) => rows.forEach((r, i) => insertCategory.run(r[0], r[1], r[2], i)));
    tx(seedCategories);
  }

  const defaults = {
    nickname: '屿深',
    letterReminderEnabled: '1',
    letterReminderDismissedDate: '',
    aiMode: 'provider',
    mcpToolsEnabled: '0',
    proactiveMessagesEnabled: '0',
    lastProactiveMessageAt: '',
    diaryNotifyEnabled: '0',
    lastDiaryWriteDate: '',
    diaryWriteFireAt: '',
    lastReadChatMessageId: '0',
    lastLedgerNagDate: '',
    ledgerNagFireDate: '',
    ledgerNagFireAt: '',
    ledgerCardMessage: '',
    ledgerCardMessageDate: '',
    ledgerCardMessageFireAts: '[]',
  };
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    if (!getSetting.get(key)) setSetting.run(key, value);
  }
}

seedIfEmpty();
cleanupFakeDiarySeed();
cleanupFakeLetterSeed();

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}
