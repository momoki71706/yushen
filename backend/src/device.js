import crypto from 'crypto';
import { getSetting, setSetting } from './db.js';

// Intimate-device control. The device itself is Bluetooth-bound to the
// user's home PC (it can't be reached from this cloud backend directly), so
// the actual BLE writes are done by a small local bridge program
// (svakom_bridge.py) that polls GET /device/poll a few times a second and
// applies whatever intensity this backend currently wants. Everything here
// is deliberately "desired state + expiry" rather than streaming commands:
// the bridge is the one repeating the keepalive write to the hardware, and
// if it ever can't reach us it fails safe to off.
//
// Intensity is 0-100 everywhere in this app (chat tool, slider, API). The
// bridge is what maps 0-100 onto the device's real 0-254 range.

const MAX_DURATION_SECONDS = 120; // a single command never runs longer than this, even if asked
const BRIDGE_ONLINE_WINDOW_MS = 5000; // bridge counts as "online" if it polled within this long

// One-time secret shared with the local bridge so a random internet client
// can't drive the device just by hitting the poll endpoint. Generated on
// first use and then stable.
export function getBridgeToken() {
  let token = getSetting('deviceBridgeToken', '');
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    setSetting('deviceBridgeToken', token);
  }
  return token;
}

export function regenerateBridgeToken() {
  const token = crypto.randomBytes(24).toString('hex');
  setSetting('deviceBridgeToken', token);
  return token;
}

export function deviceControlEnabled() {
  return getSetting('deviceControlEnabled', '0') === '1';
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

// The hard ceiling the user sets — neither the chat tool nor the manual
// slider can ever push past this, so "屿深 can act on his own" still has a
// physical limit the user controls.
export function getMaxIntensity() {
  return clampInt(getSetting('deviceMaxIntensity', '60'), 0, 100, 60);
}

// The single source of truth the bridge reads. Returns the intensity the
// device should be at *right now*, already accounting for the master
// switch, the ceiling, and command expiry — so the bridge stays dumb and
// this stays the one place the safety rules live.
export function getEffectiveIntensity() {
  if (!deviceControlEnabled()) return 0;
  const expiresAt = getSetting('deviceCommandExpiresAt', '');
  if (!expiresAt || Date.now() > new Date(expiresAt).getTime()) return 0;
  const desired = clampInt(getSetting('deviceDesiredIntensity', '0'), 0, 100, 0);
  return Math.min(desired, getMaxIntensity());
}

// Records the bridge's most recent poll so the app can show whether the
// home-side helper is actually running and connected right now.
export function markBridgeSeen() {
  setSetting('deviceBridgeLastSeenAt', new Date().toISOString());
}

export function bridgeOnline() {
  const seen = getSetting('deviceBridgeLastSeenAt', '');
  if (!seen) return false;
  return Date.now() - new Date(seen).getTime() < BRIDGE_ONLINE_WINDOW_MS;
}

// Sets what the device should do next. intensity 0-100 (clamped to the
// ceiling), durationSeconds is how long before it auto-stops if nothing
// refreshes it — a safety net so a dropped connection or a forgotten
// command can never leave it running forever.
export function setCommand(intensity, durationSeconds) {
  const clamped = Math.min(clampInt(intensity, 0, 100, 0), getMaxIntensity());
  const dur = clampInt(durationSeconds, 1, MAX_DURATION_SECONDS, 15);
  setSetting('deviceDesiredIntensity', String(clamped));
  setSetting('deviceCommandExpiresAt', new Date(Date.now() + dur * 1000).toISOString());
  return { intensity: clamped, durationSeconds: dur };
}

export function stopDevice() {
  setSetting('deviceDesiredIntensity', '0');
  setSetting('deviceCommandExpiresAt', '');
}

export function getStatus() {
  return {
    enabled: deviceControlEnabled(),
    maxIntensity: getMaxIntensity(),
    intensity: getEffectiveIntensity(),
    bridgeOnline: bridgeOnline(),
  };
}
