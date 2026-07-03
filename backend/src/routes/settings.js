import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import * as providers from '../providers.js';
import { isClaudeCodeAvailable, testClaudeCode } from '../claudeCode.js';
import * as mcp from '../mcp.js';

const router = Router();

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

// ---- AI mode (provider list vs Claude Code CLI) ----

router.get('/ai-mode', async (req, res) => {
  const claudeCodeAvailable = await isClaudeCodeAvailable();
  res.json({
    aiMode: getSetting('aiMode', 'provider'),
    activeProviderId: getSetting('activeProviderId', ''),
    claudeCodeAvailable,
    mcpToolsEnabled: getSetting('mcpToolsEnabled', '0') === '1',
  });
});

router.patch('/ai-mode', (req, res) => {
  const { aiMode, activeProviderId } = req.body;
  if (aiMode !== undefined) {
    if (!['provider', 'claude-code'].includes(aiMode)) {
      return res.status(400).json({ error: 'aiMode must be "provider" or "claude-code"' });
    }
    setSetting('aiMode', aiMode);
  }
  if (activeProviderId !== undefined) setSetting('activeProviderId', String(activeProviderId));
  res.json({ ok: true });
});

router.post('/ai-mode/test-claude-code', async (req, res) => {
  try {
    await testClaudeCode();
    res.json({ ok: true, message: 'Claude Code CLI 调用成功' });
  } catch (err) {
    res.json({ ok: false, message: err.message || '连接失败' });
  }
});

// ---- AI providers (multi-provider, multi-key, multi-model) ----

router.get('/providers', (req, res) => {
  res.json(providers.listProviders());
});

router.post('/providers', (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  res.json(providers.addProvider({ ...req.body, name: name.trim() }));
});

router.patch('/providers/:id', (req, res) => {
  const updated = providers.updateProvider(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

router.delete('/providers/:id', (req, res) => {
  providers.deleteProvider(req.params.id);
  res.json({ ok: true });
});

router.post('/providers/:id/test', async (req, res) => {
  try {
    await providers.testProvider(req.params.id);
    res.json({ ok: true, message: '连接成功' });
  } catch (err) {
    res.json({ ok: false, message: err.message || '连接失败' });
  }
});

// ---- MCP tools ----

router.patch('/mcp/toggle', (req, res) => {
  const enabled = !!req.body.enabled;
  setSetting('mcpToolsEnabled', enabled ? '1' : '0');
  res.json({ mcpToolsEnabled: enabled });
});

router.get('/mcp/servers', (req, res) => {
  res.json(mcp.listServers());
});

router.post('/mcp/servers', (req, res) => {
  const { name, url, headers } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!url || !String(url).trim()) return res.status(400).json({ error: 'url is required' });
  res.json(mcp.addServer({ name: name.trim(), url: url.trim(), headers }));
});

router.patch('/mcp/servers/:id', (req, res) => {
  const updated = mcp.updateServer(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

router.delete('/mcp/servers/:id', (req, res) => {
  mcp.deleteServer(req.params.id);
  res.json({ ok: true });
});

router.post('/mcp/servers/:id/test', async (req, res) => {
  try {
    const result = await mcp.testServer(req.params.id);
    res.json(result);
  } catch (err) {
    res.json({ ok: false, message: err.message || '连接失败' });
  }
});

export default router;
