import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { getVapidPublicKey, pushConfigured, saveSubscription, removeSubscription } from '../push.js';

const router = Router();

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey(), configured: pushConfigured });
});

router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'invalid subscription' });
  saveSubscription({ endpoint, keys });
  res.json({ ok: true });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) removeSubscription(endpoint);
  res.json({ ok: true });
});

router.get('/proactive-status', (req, res) => {
  res.json({ enabled: getSetting('proactiveMessagesEnabled', '0') === '1' });
});

router.patch('/proactive-status', (req, res) => {
  const enabled = !!req.body?.enabled;
  setSetting('proactiveMessagesEnabled', enabled ? '1' : '0');
  res.json({ enabled });
});

export default router;
