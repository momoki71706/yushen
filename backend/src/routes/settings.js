import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { resolveApiKey } from '../aiReply.js';
import { testApiKey } from '../anthropic.js';
import { isClaudeCodeAvailable, testClaudeCode } from '../claudeCode.js';

const router = Router();

function maskKey(key) {
  if (!key) return null;
  if (key.length <= 4) return '••••';
  return '••••••' + key.slice(-4);
}

router.get('/', (req, res) => {
  res.json({
    nickname: getSetting('nickname', '屿深'),
    letterReminderEnabled: getSetting('letterReminderEnabled', '1') === '1',
    letterReminderDismissedDate: getSetting('letterReminderDismissedDate', ''),
  });
});

router.patch('/', (req, res) => {
  const { nickname, letterReminderEnabled, letterReminderDismissedDate } = req.body;
  if (nickname !== undefined) setSetting('nickname', nickname);
  if (letterReminderEnabled !== undefined) setSetting('letterReminderEnabled', letterReminderEnabled ? '1' : '0');
  if (letterReminderDismissedDate !== undefined) setSetting('letterReminderDismissedDate', letterReminderDismissedDate);
  res.json({
    nickname: getSetting('nickname', '屿深'),
    letterReminderEnabled: getSetting('letterReminderEnabled', '1') === '1',
    letterReminderDismissedDate: getSetting('letterReminderDismissedDate', ''),
  });
});

router.get('/reminder-status', (req, res) => {
  const enabled = getSetting('letterReminderEnabled', '1') === '1';
  const dismissedDate = getSetting('letterReminderDismissedDate', '');
  const todayStr = new Date().toDateString();

  const rows = db.prepare('SELECT unlock_date, opened FROM letters').all();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueUnreadCount = rows.filter((r) => {
    const [y, m, d] = r.unlock_date.split('-').map(Number);
    const unlockD = new Date(y, (m || 1) - 1, d || 1);
    unlockD.setHours(0, 0, 0, 0);
    return unlockD <= today && !r.opened;
  }).length;

  const shouldShow = enabled && dismissedDate !== todayStr && dueUnreadCount > 0;
  res.json({ shouldShow, dueUnreadCount });
});

router.get('/ai', async (req, res) => {
  const provider = getSetting('aiProvider', 'api');
  const storedKey = getSetting('anthropicApiKey', '');
  const envKey = process.env.ANTHROPIC_API_KEY || '';
  const claudeCodeAvailable = await isClaudeCodeAvailable();
  res.json({
    provider,
    hasApiKey: !!(storedKey || envKey),
    apiKeyMasked: maskKey(storedKey || envKey),
    apiKeySource: storedKey ? 'app' : envKey ? 'env' : null,
    claudeCodeAvailable,
  });
});

router.patch('/ai', (req, res) => {
  const { provider, apiKey } = req.body;
  if (provider !== undefined) {
    if (!['api', 'claude-code'].includes(provider)) {
      return res.status(400).json({ error: 'provider must be "api" or "claude-code"' });
    }
    setSetting('aiProvider', provider);
  }
  if (apiKey !== undefined) {
    setSetting('anthropicApiKey', (apiKey || '').trim());
  }
  res.json({ ok: true });
});

router.post('/ai/test', async (req, res) => {
  const provider = getSetting('aiProvider', 'api');
  try {
    if (provider === 'claude-code') {
      await testClaudeCode();
      res.json({ ok: true, message: 'Claude Code CLI 调用成功' });
    } else {
      const key = resolveApiKey();
      if (!key) return res.json({ ok: false, message: '还没有设置 API Key' });
      await testApiKey(key, process.env.ANTHROPIC_MODEL || 'claude-sonnet-5');
      res.json({ ok: true, message: 'API Key 验证成功' });
    }
  } catch (err) {
    res.json({ ok: false, message: err.message || '连接失败' });
  }
});

export default router;
