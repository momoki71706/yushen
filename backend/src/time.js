// The server's own local timezone isn't guaranteed to be Beijing time —
// Zeabur (and most container platforms) default to UTC unless a TZ env
// var is explicitly set, which this deployment doesn't have. Rather than
// depend on that, compute Beijing time directly from the UTC epoch and
// always read it back with the UTC getters (getUTCHours etc.) so the
// server's own local offset never gets applied on top.
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function beijingNow() {
  return new Date(Date.now() + BEIJING_OFFSET_MS);
}

export function formatBeijingClock(date = beijingNow()) {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function weekdayLabel(date = beijingNow()) {
  return WEEKDAYS[date.getUTCDay()];
}
