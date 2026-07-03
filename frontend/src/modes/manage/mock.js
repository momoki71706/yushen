// Deterministic per-day mock data for 手表监测 / 屏幕时间.
// Neither HealthKit nor iOS Screen Time can be read from a browser PWA,
// so these numbers are generated (not stored) — same date always yields
// the same values, so the UI feels stable across a single day.

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(...parts) {
  return mulberry32(hashString(parts.join('|')));
}

function isoOffset(baseISO, offsetDays) {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offsetDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
function weekdayShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()];
}

export function mockWatchDay(dateISO) {
  const r = rngFor('watch', dateISO);
  const sleepHours = 6 + r() * 2.5;
  const steps = Math.round(3500 + r() * 8000);
  const exerciseMin = Math.round(r() * 55);
  const heartRate = Math.round(58 + r() * 20);
  return { sleepHours, steps, exerciseMin, heartRate };
}

export function mockWatchWeek(todayISO) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(isoOffset(todayISO, -i));
  return days.map((iso) => ({ iso, label: weekdayShort(iso), ...mockWatchDay(iso) }));
}

const SCREEN_APPS = [
  { name: '微信', color: '#8FBF7F' },
  { name: '小红书', color: '#E67B8A' },
  { name: '抖音', color: '#4A4048' },
  { name: 'Safari', color: '#6FA8DC' },
  { name: '爱奇艺', color: '#7FBF9F' },
];

export function mockScreenApps(dateISO) {
  const r = rngFor('screen', dateISO);
  const rows = SCREEN_APPS.map((a) => ({ ...a, hours: 0.15 + r() * 2.1 }));
  rows.sort((a, b) => b.hours - a.hours);
  return rows;
}

export function screenAppNames() {
  return SCREEN_APPS.map((a) => a.name);
}
