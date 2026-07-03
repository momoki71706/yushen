import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

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
  date_iso TEXT NOT NULL,
  date_label TEXT NOT NULL,
  mood TEXT NOT NULL,
  mood_color TEXT NOT NULL,
  weather TEXT NOT NULL,
  tag TEXT,
  excerpt TEXT NOT NULL,
  has_attachment INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

function seedIfEmpty() {
  const diaryCount = db.prepare('SELECT COUNT(*) AS c FROM diary_entries').get().c;
  if (diaryCount === 0) {
    const insert = db.prepare(`INSERT INTO diary_entries (date_iso, date_label, mood, mood_color, weather, tag, excerpt, has_attachment) VALUES (?,?,?,?,?,?,?,?)`);
    const seed = [
      ['2026-06-29', '6月29日 · 周一', '平静', '#E0D2D9', '多云', null, '没什么特别的事，只是想把这种安稳的感觉记下来。', 0],
      ['2026-06-24', '6月24日 · 周三', '难过', '#C9AEB9', '雨', null, '有点emo，可能是换季，也可能只是想被抱一下。', 0],
      ['2026-03-15', '3月15日 · 周日', '开心', '#EDD9E1', '晴', '纪念日', '今天是我们第一次约会一周年，他说这一年谢谢我陪他一起长大。', 0],
      ['2026-06-18', '6月18日 · 周四', '开心', '#EDD9E1', '晴', null, '收到了一个小惊喜，眼睛笑成了一条缝。', 0],
    ];
    const tx = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
    tx(seed);
  }

  const letterCount = db.prepare('SELECT COUNT(*) AS c FROM letters').get().c;
  if (letterCount === 0) {
    const insert = db.prepare(`INSERT INTO letters (sender, recipient, signature, dear_text, unlock_date, body, opened, has_attachment) VALUES (?,?,?,?,?,?,?,?)`);
    const today = new Date().toISOString().slice(0, 10);
    const seed = [
      ['小晴', '屿深', '小晴', null, '2026-12-25', '写给一年后的我们：希望那时我们还是这样，愿意为对方多走一点路。', 0, 0],
      ['小晴', '屿深', '小晴', null, '2026-09-10', '生日快乐，这是我提前藏起来的话——谢谢你出现在我的世界里。', 0, 0],
      ['屿深', '小晴', '屿深', null, '2026-06-20', '对不起，那天不该那么说话。其实我一直都记得你怕黑，以后我尽量早点回家。', 1, 0],
      ['屿深', '小晴', '屿深', null, today, '写这封信的时候还没到日子，但如果你现在看到——今天也要好好吃饭呀。', 0, 0],
    ];
    const tx = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
    tx(seed);
  }

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

  const defaults = {
    nickname: '屿深',
    letterReminderEnabled: '1',
    letterReminderDismissedDate: '',
    aiMode: 'provider',
    mcpToolsEnabled: '0',
    proactiveMessagesEnabled: '0',
    lastProactiveMessageAt: '',
  };
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    if (!getSetting.get(key)) setSetting.run(key, value);
  }
}

seedIfEmpty();

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
