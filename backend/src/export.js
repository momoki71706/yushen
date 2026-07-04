import { db, getSetting, setSetting } from './db.js';
import { beijingNow, beijingFromUtcString, formatBeijingDateTime } from './time.js';

function md(text) {
  return String(text || '').trim();
}

function buildChatSection() {
  const lastId = Number(getSetting('lastExportedChatId', '0')) || 0;
  const rows = db.prepare('SELECT * FROM chat_messages WHERE id > ? ORDER BY id ASC').all(lastId);
  if (!rows.length) return { section: '', maxId: lastId };

  const lines = rows.map((r) => {
    const who = r.from_who === 'me' ? '小晴' : '屿深';
    const when = formatBeijingDateTime(beijingFromUtcString(r.created_at));
    const text = r.kind === 'photo' ? `[分享了一张照片：${md(r.text)}]` : md(r.text);
    return `**${when} ${who}**：${text}`;
  });
  return { section: `## 聊天记录\n\n${lines.join('\n\n')}\n`, maxId: rows[rows.length - 1].id };
}

function buildDiarySection() {
  const lastId = Number(getSetting('lastExportedDiaryId', '0')) || 0;
  const rows = db.prepare('SELECT * FROM diary_entries WHERE id > ? ORDER BY id ASC').all(lastId);
  if (!rows.length) return { section: '', maxId: lastId };

  const lines = rows.map((r) => {
    const tag = r.tag ? ` · ${r.tag}` : '';
    return `### ${r.date_label} · ${r.mood} · ${r.weather}${tag}\n\n${md(r.excerpt)}`;
  });
  return { section: `## 日记\n\n${lines.join('\n\n')}\n`, maxId: rows[rows.length - 1].id };
}

// Only letters that are actually unlockable get exported — a letter due
// in a month is meant to stay a surprise, so pulling its body into a
// downloadable backup file early would defeat that. Since unlockable
// letters can arrive out of id order (an older locked letter might unlock
// after a newer already-exported one), this can't use a simple "id >
// marker" watermark like chat/diary — it tracks an explicit exported flag
// per letter instead.
function buildLetterSection() {
  const todayIso = formatBeijingDateTime(beijingNow()).slice(0, 10);
  const rows = db.prepare('SELECT * FROM letters WHERE exported = 0 AND unlock_date <= ? ORDER BY id ASC').all(todayIso);
  if (!rows.length) return { section: '', ids: [] };

  const lines = rows.map((r) => `### ${r.sender} → ${r.recipient}（${r.unlock_date} 解锁）\n\n${md(r.body)}`);
  return { section: `## 信件\n\n${lines.join('\n\n')}\n`, ids: rows.map((r) => r.id) };
}

// Exports only what hasn't been exported before (tracked via per-type
// watermarks), so each export stays small and multiple exports over time
// can just be concatenated into a full history instead of every export
// re-dumping everything from the beginning.
export function generateExport() {
  const chat = buildChatSection();
  const diary = buildDiarySection();
  const letters = buildLetterSection();

  const sections = [chat.section, diary.section, letters.section].filter(Boolean);
  const nowLabel = formatBeijingDateTime(beijingNow());
  const header = `# 小晴与屿深 · 回忆导出\n\n导出时间：${nowLabel}（北京时间）\n本次导出：上次导出之后的新内容\n`;

  const hasContent = sections.length > 0;
  const content = hasContent ? `${header}\n${sections.join('\n')}` : `${header}\n（这次没有新内容可以导出）\n`;

  // Precise to the hour (not just the date) so exporting more than once in
  // a day produces distinct filenames instead of silently colliding.
  const filename = `回忆导出-${nowLabel.slice(0, 10)}-${nowLabel.slice(11, 13)}时.md`;

  if (hasContent) {
    setSetting('lastExportedChatId', String(chat.maxId));
    setSetting('lastExportedDiaryId', String(diary.maxId));
    if (letters.ids.length) {
      const placeholders = letters.ids.map(() => '?').join(',');
      db.prepare(`UPDATE letters SET exported = 1 WHERE id IN (${placeholders})`).run(...letters.ids);
    }
    // Watermarks only move forward, so once this export is generated its
    // content can never be produced again — remembered here so a lost or
    // accidentally-closed download can still be recovered afterwards
    // instead of the content just being gone.
    setSetting('lastExportContent', content);
    setSetting('lastExportFilename', filename);
  }

  return { content, filename, hasContent };
}

// Re-serves whatever the most recent successful export produced, without
// touching any watermark — a pure "give me that file again" recovery path
// for when the last export's download got lost or closed before saving.
export function getLastExport() {
  const content = getSetting('lastExportContent', '');
  const filename = getSetting('lastExportFilename', '');
  return { content, filename, hasContent: !!content };
}
