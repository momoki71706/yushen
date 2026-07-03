import webpush from 'web-push';
import { db } from './db.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:example@example.com';

export const pushConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications are disabled.');
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export function saveSubscription({ endpoint, keys }) {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(endpoint, keys.p256dh, keys.auth);
}

export function removeSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

// Sends to every registered device. Subscriptions that come back as
// expired/invalid (410 Gone, 404 Not Found — the browser dropped them,
// e.g. after the PWA was removed from the home screen) get cleaned up
// automatically instead of failing silently forever on every future push.
export async function sendPushToAll(payload) {
  if (!pushConfigured) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          removeSubscription(sub.endpoint);
        } else {
          console.error('[push] send failed:', err.statusCode, err.message);
        }
      }
    })
  );
}
