import { useStore } from '../state/store';
import { CloseIcon } from './Icons';
import HoursMinutesPicker from './HoursMinutesPicker';

export default function PushSettingsPanel() {
  const pushSettingsOpen = useStore((s) => s.pushSettingsOpen);
  const closePushSettings = useStore((s) => s.closePushSettings);
  const pushEnabled = useStore((s) => s.pushEnabled);
  const pushToggleBusy = useStore((s) => s.pushToggleBusy);
  const pushToggleError = useStore((s) => s.pushToggleError);
  const togglePushEnabled = useStore((s) => s.togglePushEnabled);
  const pushIdleThresholdMinutes = useStore((s) => s.pushIdleThresholdMinutes);
  const pushMinGapMinutes = useStore((s) => s.pushMinGapMinutes);
  const pushRecheckMinutes = useStore((s) => s.pushRecheckMinutes);
  const pushQuietHourStart = useStore((s) => s.pushQuietHourStart);
  const pushQuietHourEnd = useStore((s) => s.pushQuietHourEnd);
  const adjustPushSetting = useStore((s) => s.adjustPushSetting);
  const setPushMinutesSetting = useStore((s) => s.setPushMinutesSetting);
  const diaryNotifyEnabled = useStore((s) => s.diaryNotifyEnabled);
  const diaryNotifyBusy = useStore((s) => s.diaryNotifyBusy);
  const toggleDiaryNotifyEnabled = useStore((s) => s.toggleDiaryNotifyEnabled);

  if (!pushSettingsOpen) return null;

  return (
    <div className="sheet-overlay" onClick={closePushSettings}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">消息推送</div>
          <button className="sheet-panel__close" onClick={closePushSettings}>
            <CloseIcon />
          </button>
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="screen-threshold-head">
            <div className="watch-card-title" style={{ marginBottom: 0 }}>AI 主动消息推送</div>
            <button
              className="toggle-switch"
              style={{ background: pushEnabled ? '#C8899E' : '#DCD4D8', opacity: pushToggleBusy ? 0.6 : 1 }}
              onClick={togglePushEnabled}
              disabled={pushToggleBusy}
            >
              <div className="toggle-switch__knob" style={{ left: pushEnabled ? 20 : 2 }} />
            </button>
          </div>
          <div className="screen-threshold-sub">开启后，安静一段时间会收到他主动发来的消息推送</div>
          {pushToggleError && <div className="sidebar-error-text">{pushToggleError}</div>}
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="watch-card-title">多久没聊天后开始主动找你</div>
          <HoursMinutesPicker
            totalMinutes={pushIdleThresholdMinutes}
            onChange={(m) => setPushMinutesSetting('idleThresholdMinutes', m)}
          />
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="watch-card-title">两次主动消息最少间隔</div>
          <HoursMinutesPicker
            totalMinutes={pushMinGapMinutes}
            onChange={(m) => setPushMinutesSetting('minGapMinutes', m)}
          />
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="watch-card-title">过了门槛后多久重新判断一次</div>
          <div className="screen-threshold-sub">安静超过上面的门槛后，隔多久再让他重新想一次要不要说话</div>
          <HoursMinutesPicker
            totalMinutes={pushRecheckMinutes}
            onChange={(m) => setPushMinutesSetting('recheckMinutes', m)}
          />
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="screen-threshold-head">
            <div className="watch-card-title" style={{ marginBottom: 0 }}>日记有新动态要通知我</div>
            <button
              className="toggle-switch"
              style={{ background: diaryNotifyEnabled ? '#C8899E' : '#DCD4D8', opacity: diaryNotifyBusy ? 0.6 : 1 }}
              onClick={toggleDiaryNotifyEnabled}
              disabled={diaryNotifyBusy}
            >
              <div className="toggle-switch__knob" style={{ left: diaryNotifyEnabled ? 20 : 2 }} />
            </button>
          </div>
          <div className="screen-threshold-sub">开启后，他写日记或者评论了日记都会给你发一条推送</div>
        </div>

        <div className="watch-card" style={{ margin: 0 }}>
          <div className="watch-card-title">免打扰时段（不会收到推送）</div>
          <div className="screen-threshold-sub">从几点到几点，例如 0 点到 8 点</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="screen-threshold-stepper">
              <button className="screen-step-btn" onClick={() => adjustPushSetting('quietHourStart', -1, 0, 23)}>-</button>
              <div className="screen-threshold-value">{pushQuietHourStart} 点</div>
              <button className="screen-step-btn" onClick={() => adjustPushSetting('quietHourStart', 1, 0, 23)}>+</button>
            </div>
            <span style={{ color: 'var(--color-text-faint)' }}>至</span>
            <div className="screen-threshold-stepper">
              <button className="screen-step-btn" onClick={() => adjustPushSetting('quietHourEnd', -1, 0, 23)}>-</button>
              <div className="screen-threshold-value">{pushQuietHourEnd} 点</div>
              <button className="screen-step-btn" onClick={() => adjustPushSetting('quietHourEnd', 1, 0, 23)}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
