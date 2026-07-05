import { useStore } from '../../state/store';
import { BackChevronIcon, ChevronDownIcon } from '../../components/Icons';
import { mockScreenApps } from './mock';

function formatHours(h) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs <= 0) return `${mins}分钟`;
  return mins > 0 ? `${hrs}小时${mins}分` : `${hrs}小时`;
}

function timeLabelFor(iso) {
  const d = new Date(`${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function groupPhoneActivity(rows) {
  const byApp = {};
  rows.forEach((r) => {
    if (!byApp[r.appName]) byApp[r.appName] = { name: r.appName, count: 0, lastOpened: r.openedAt };
    byApp[r.appName].count += 1;
    if (r.openedAt > byApp[r.appName].lastOpened) byApp[r.appName].lastOpened = r.openedAt;
  });
  return Object.values(byApp).sort((a, b) => (a.lastOpened < b.lastOpened ? 1 : -1));
}

export default function ScreentimeView() {
  const closeManageSubview = useStore((s) => s.closeManageSubview);
  const todayISOLocal = useStore((s) => s.todayISOLocal);
  const screenReminderEnabled = useStore((s) => s.screenReminderEnabled);
  const toggleScreenReminder = useStore((s) => s.toggleScreenReminder);
  const screenThreshold = useStore((s) => s.screenThreshold);
  const incThreshold = useStore((s) => s.incThreshold);
  const decThreshold = useStore((s) => s.decThreshold);
  const screenAppSettingsOpen = useStore((s) => s.screenAppSettingsOpen);
  const toggleScreenAppSettings = useStore((s) => s.toggleScreenAppSettings);
  const screenAppThresholds = useStore((s) => s.screenAppThresholds);
  const screenAppReminders = useStore((s) => s.screenAppReminders);
  const adjustScreenAppThreshold = useStore((s) => s.adjustScreenAppThreshold);
  const toggleScreenAppReminder = useStore((s) => s.toggleScreenAppReminder);
  const phoneActivity = useStore((s) => s.phoneActivity);
  const openHealthDataPanel = useStore((s) => s.openHealthDataPanel);

  const today = todayISOLocal();
  const apps = mockScreenApps(today);
  const total = apps.reduce((sum, a) => sum + a.hours, 0);
  const maxHours = apps.length ? apps[0].hours : 1;
  const overThreshold = screenReminderEnabled && total > screenThreshold;
  const activityGroups = groupPhoneActivity(phoneActivity);

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeManageSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">应用使用时长</div>
        </div>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        <div className="watch-card">
          <div className="watch-card-title">最近打开记录（真实数据）</div>
          {activityGroups.length === 0 ? (
            <button className="screen-app-settings-hint" style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: 0, width: '100%' }} onClick={openHealthDataPanel}>
              还没接入手机打开记录，点击去配置快捷指令
            </button>
          ) : (
            <>
              <div className="screen-threshold-sub" style={{ marginBottom: 8 }}>记录的是打开次数和时间，不是使用时长</div>
              {activityGroups.map((g) => (
                <div key={g.name} className="simple-list-row" style={{ background: 'transparent', padding: '8px 0' }}>
                  <div className="simple-list-body">
                    <div className="simple-list-title">{g.name}</div>
                    <div className="simple-list-meta">最后一次 {timeLabelFor(g.lastOpened)}</div>
                  </div>
                  <div className="book-status-tag">{g.count} 次</div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="screen-total-card">
          <div className="screen-total-label">今日屏幕使用时长（预估）</div>
          <div className="screen-total-value">{formatHours(total)}</div>
        </div>

        {overThreshold && (
          <div className="screen-warning-banner">
            <div className="screen-warning-icon">
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="6.5" stroke="#C08BA0" strokeWidth="1.4" fill="none" />
                <path d="M7.5 4v4l2.5 1.5" stroke="#C08BA0" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="screen-warning-text">已经用了 {formatHours(total)} 啦，超过设定的 {screenThreshold} 小时了，起来走走吧</div>
          </div>
        )}

        <div className="watch-card">
          <div className="watch-card-title">应用使用排行</div>
          {apps.map((a) => (
            <div key={a.name} className="watch-metric-row">
              <div className="screen-app-avatar" style={{ background: a.color }}>{a.name.slice(0, 1)}</div>
              <div className="watch-metric-body">
                <div className="watch-metric-head">
                  <span className="watch-metric-label">{a.name}</span>
                  <span className="watch-metric-value">{formatHours(a.hours)}</span>
                </div>
                <div className="watch-metric-track">
                  <div className="watch-metric-fill" style={{ width: `${Math.max(6, (a.hours / maxHours) * 100)}%`, background: a.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="watch-card">
          <div className="screen-threshold-head">
            <div className="watch-card-title" style={{ marginBottom: 0 }}>超时提醒</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="screen-expand-btn" onClick={toggleScreenAppSettings}>
                <ChevronDownIcon expanded={screenAppSettingsOpen} />
              </button>
              <button
                className="screen-switch"
                style={{ background: screenReminderEnabled ? '#C8899E' : 'rgba(58,50,54,0.15)' }}
                onClick={toggleScreenReminder}
              >
                <div className="screen-switch-knob" style={{ left: screenReminderEnabled ? '20px' : '2px' }} />
              </button>
            </div>
          </div>
          <div className="screen-threshold-sub">超过设定时长，我会提醒你</div>
          <div className="screen-threshold-stepper">
            <button className="screen-step-btn" onClick={decThreshold}>-</button>
            <div className="screen-threshold-value">{screenThreshold} 小时</div>
            <button className="screen-step-btn" onClick={incThreshold}>+</button>
          </div>

          {screenAppSettingsOpen && (
            <div className="screen-app-settings">
              <div className="screen-app-settings-hint">按应用单独设置超时提醒</div>
              {apps.map((a) => {
                const threshold = screenAppThresholds[a.name] ?? 2;
                const reminderOn = screenAppReminders[a.name] ?? true;
                return (
                  <div key={a.name} className="screen-app-settings-row">
                    <div className="screen-app-settings-dot" style={{ background: a.color }} />
                    <div className="screen-app-settings-name">{a.name}</div>
                    <button className="screen-step-btn screen-step-btn--sm" onClick={() => adjustScreenAppThreshold(a.name, -0.5)}>-</button>
                    <div className="screen-app-settings-threshold">{threshold}h</div>
                    <button className="screen-step-btn screen-step-btn--sm" onClick={() => adjustScreenAppThreshold(a.name, 0.5)}>+</button>
                    <button
                      className="screen-switch screen-switch--sm"
                      style={{ background: reminderOn ? '#C8899E' : 'rgba(58,50,54,0.15)' }}
                      onClick={() => toggleScreenAppReminder(a.name)}
                    >
                      <div className="screen-switch-knob screen-switch-knob--sm" style={{ left: reminderOn ? '12px' : '2px' }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
