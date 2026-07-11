import { Router } from 'express';
import * as s from '../smultron.js';

const router = Router();

function serializeEntry(e) {
  return { id: e.id, role: e.role, text: e.text, tokens: e.tokens, thinking: e.thinking || null, createdAt: e.created_at };
}

// ---- windows ----
router.get('/windows', (req, res) => {
  res.json({ windows: s.listWindows(), activeId: s.getActiveWindowId() });
});
router.post('/windows', (req, res) => {
  res.json(s.createWindow(req.body?.name));
});
router.patch('/windows/:id', (req, res) => {
  const updated = s.updateWindow(Number(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: '窗口不存在' });
  res.json(updated);
});
router.delete('/windows/:id', (req, res) => {
  s.deleteWindow(Number(req.params.id));
  res.json({ ok: true });
});
router.post('/windows/:id/activate', (req, res) => {
  s.setActiveWindowId(Number(req.params.id));
  res.json({ ok: true });
});

// ---- entries ----
router.get('/windows/:id/entries', (req, res) => {
  res.json(s.listEntries(Number(req.params.id)).map(serializeEntry));
});

// ---- generation ----
router.post('/windows/:id/generate', async (req, res) => {
  try {
    const story = await s.generate(Number(req.params.id), req.body?.instruction || '');
    res.json(serializeEntry(story));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/windows/:id/regenerate', async (req, res) => {
  try {
    const story = await s.regenerateLast(Number(req.params.id));
    res.json(serializeEntry(story));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/windows/:id/sync-memory', async (req, res) => {
  try {
    const result = await s.syncWindowToMemory(Number(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/windows/:id/export', (req, res) => {
  const md = s.exportWindowMarkdown(Number(req.params.id));
  if (md == null) return res.status(404).json({ error: '窗口不存在' });
  res.json({ content: md, filename: `smultron-${req.params.id}-${new Date().toISOString().slice(0, 10)}.md` });
});

// ---- instruction presets (默认指令库) ----
router.get('/presets', (req, res) => res.json(s.listPresets()));
router.post('/presets', (req, res) => res.json(s.createPreset(req.body || {})));
router.patch('/presets/:id', (req, res) => {
  const updated = s.updatePreset(Number(req.params.id), req.body || {});
  if (!updated) return res.status(404).json({ error: '设定不存在' });
  res.json(updated);
});
router.delete('/presets/:id', (req, res) => {
  s.deletePreset(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
