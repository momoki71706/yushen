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
`);

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

  const defaults = {
    nickname: '屿深',
    letterReminderEnabled: '1',
    letterReminderDismissedDate: '',
    aiProvider: 'api',
    anthropicApiKey: '',
    relayApiKey: '',
    relayBaseUrl: '',
    relayModel: '',
    mcpToolsEnabled: '0',
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
