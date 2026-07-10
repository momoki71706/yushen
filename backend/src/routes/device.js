import { Router } from 'express';
import crypto from 'crypto';
import {
  getStatus,
  getEffectiveIntensity,
  markBridgeSeen,
  setCommand,
  stopDevice,
  getMaxIntensity,
  deviceControlEnabled,
  getBridgeToken,
  regenerateBridgeToken,
} from '../device.js';
import { setSetting, getSetting } from '../db.js';

const router = Router();

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Called several times a second by the home-side bridge program. Token in
// the query string keeps it dead simple for a tiny Python client. Always
// returns the *effective* intensity (0 when off/expired/over-cap), so all
// the safety logic stays server-side and the bridge just obeys.
router.get('/poll', (req, res) => {
  const expected = getBridgeToken();
  if (!timingSafeEqualStr(req.query.token, expected)) {
    return res.status(403).json({ error: 'invalid token' });
  }
  markBridgeSeen();
  res.json({ intensity: getEffectiveIntensity() });
});

// Status for the app UI (master switch, ceiling, live intensity, whether
// the home bridge is currently polling).
router.get('/status', (req, res) => {
  res.json(getStatus());
});

// The bridge token + a ready-to-paste config line, shown in the app's
// device-control panel so the user can set up svakom_bridge.py.
router.get('/bridge-info', (req, res) => {
  res.json({ token: getBridgeToken() });
});

router.post('/bridge-info/regenerate', (req, res) => {
  res.json({ token: regenerateBridgeToken() });
});

// Master switch + intensity ceiling.
router.patch('/settings', (req, res) => {
  const { enabled, maxIntensity } = req.body || {};
  if (enabled !== undefined) {
    setSetting('deviceControlEnabled', enabled ? '1' : '0');
    if (!enabled) stopDevice(); // flipping the master switch off stops immediately
  }
  if (maxIntensity !== undefined) {
    const n = Math.max(0, Math.min(100, Math.round(Number(maxIntensity)) || 0));
    setSetting('deviceMaxIntensity', String(n));
  }
  res.json(getStatus());
});

// Manual control from the app slider. Same path the chat tool uses under
// the hood (see localTools.js control_device), just driven by the user's
// own hand instead of 屿深.
router.post('/command', (req, res) => {
  if (!deviceControlEnabled()) return res.status(409).json({ error: 'device control is off' });
  const { intensity, durationSeconds } = req.body || {};
  const result = setCommand(intensity, durationSeconds ?? 30);
  res.json({ ...getStatus(), ...result });
});

router.post('/stop', (req, res) => {
  stopDevice();
  res.json(getStatus());
});

export default router;
