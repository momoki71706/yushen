import { Router } from 'express';
import crypto from 'crypto';
import { db, getSetting, setSetting } from '../db.js';

const router = Router();

const PHONE_ACTIVITY_LIMIT = 50;

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireToken(req, res, next) {
  const expected = getSetting('healthApiToken', '');
  const provided = req.header('X-API-Token') || '';
  if (!expected || !timingSafeEqualStr(provided, expected)) {
    return res.status(403).json({ error: 'invalid or missing X-API-Token' });
  }
  next();
}

function serializeHealthLog(row) {
  return {
    id: row.id,
    dateISO: row.date_iso,
    sleepStart: row.sleep_start,
    sleepEnd: row.sleep_end,
    sleepMinutes: row.sleep_minutes,
    sleepHours: Math.round((row.sleep_minutes / 60) * 10) / 10,
    steps: row.steps,
    heartRateAvg: row.heart_rate_avg,
    heartRateMin: row.heart_rate_min,
    heartRateMax: row.heart_rate_max,
    isPeriod: !!row.is_period,
    note: row.note,
  };
}

// ---- setup: the URL + token an iOS Shortcut needs (see 侧边栏 "健康数据接入") ----
router.get('/token', (req, res) => {
  let token = getSetting('healthApiToken', '');
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    setSetting('healthApiToken', token);
  }
  res.json({ token });
});

router.post('/token/regenerate', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  setSetting('healthApiToken', token);
  res.json({ token });
});

// ---- HealthKit snapshot ingest (one row per day, upserted) ----
const upsertHealthLog = db.prepare(`
  INSERT INTO health_logs (date_iso, sleep_start, sleep_end, sleep_minutes, steps, heart_rate_avg, heart_rate_min, heart_rate_max, is_period, note)
  VALUES (@date, @sleep_start, @sleep_end, @sleep_minutes, @steps, @heart_rate_avg, @heart_rate_min, @heart_rate_max, @is_period, @note)
  ON CONFLICT(date_iso) DO UPDATE SET
    sleep_start = excluded.sleep_start,
    sleep_end = excluded.sleep_end,
    sleep_minutes = excluded.sleep_minutes,
    steps = excluded.steps,
    heart_rate_avg = excluded.heart_rate_avg,
    heart_rate_min = excluded.heart_rate_min,
    heart_rate_max = excluded.heart_rate_max,
    is_period = excluded.is_period,
    note = excluded.note
`);

router.post('/push', requireToken, (req, res) => {
  const b = req.body || {};
  if (!b.date) return res.status(400).json({ error: 'date is required' });
  upsertHealthLog.run({
    date: b.date,
    sleep_start: b.sleep_start || '',
    sleep_end: b.sleep_end || '',
    sleep_minutes: Number(b.sleep_minutes) || 0,
    steps: Number(b.steps) || 0,
    heart_rate_avg: Number(b.heart_rate_avg) || 0,
    heart_rate_min: Number(b.heart_rate_min) || 0,
    heart_rate_max: Number(b.heart_rate_max) || 0,
    is_period: b.is_period ? 1 : 0,
    note: b.note || '',
  });
  res.json({ status: 'success' });
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM health_logs ORDER BY date_iso DESC LIMIT 30').all();
  res.json(rows.map(serializeHealthLog));
});

// ---- phone-activity ingest ("app opened" Shortcuts automation) ----
const insertActivity = db.prepare("INSERT INTO phone_activity (app_name, opened_at) VALUES (?, datetime('now'))");
// Plain DELETE doesn't support ORDER BY/LIMIT in SQLite without a special
// build flag better-sqlite3 doesn't enable — keep only the newest N rows
// via a "not in the top-N ids" subquery instead, which only relies on
// SELECT's LIMIT (always supported).
const trimActivity = db.prepare(`
  DELETE FROM phone_activity WHERE id NOT IN (
    SELECT id FROM phone_activity ORDER BY opened_at DESC LIMIT ?
  )
`);

router.post('/activity', requireToken, (req, res) => {
  const appName = (req.body || {}).app_name;
  if (!appName || !String(appName).trim()) return res.status(400).json({ error: 'app_name is required' });
  insertActivity.run(String(appName).trim());
  trimActivity.run(PHONE_ACTIVITY_LIMIT);
  res.json({ status: 'success' });
});

router.get('/activity', (req, res) => {
  const rows = db.prepare('SELECT app_name, opened_at FROM phone_activity ORDER BY opened_at DESC LIMIT ?').all(PHONE_ACTIVITY_LIMIT);
  res.json(rows.map((r) => ({ appName: r.app_name, openedAt: r.opened_at })));
});

export default router;
