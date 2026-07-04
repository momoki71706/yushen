import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

export default function PushSettingsPanel() {
  const pushSettingsOpen = useStore((s) => s.pushSettingsOpen);
  const closePushSettings = useStore((s) => s.closePushSettings);
  const pushEnabled = useStore((s) => s.pushEnabled);
  const pushToggleBusy = useStore((s) => s.pushToggleBusy);
  const pushToggleError = useStore((s) => s.pushToggleError);
  const togglePushEnabled = useStore((s) => s.togglePushEnabled);
  const pushIdleThresholdHours = useStore((s) => s.pushIdleThresholdHours);
  const pushMinGapHours = useStore((s) => s.pushMinGapHours);
  const pushQuietHourStart = useStore((s) => s.pushQuietHourStart);
  const pushQuietHourEnd = useStore((s) => s.pushQuietHourEnd);
  const adjustPushSetting = useStore((s) => s.adjustPushSetting);

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
          <div className="screen-threshold-stepper">
            <button className="screen-step-btn" onClick={() => adjustPushSetting('idleThresholdHours', -1, 1, 48)}>-</button>
            <div className="screen-threshold-value">{pushIdleThresholdHours} 小时</div>
            <button className="screen-step-btn" onClick={() => adjustPushSetting('idleThresholdHours', 1, 1, 48)}>+</button>
          </div>
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="watch-card-title">两次主动消息最少间隔</div>
          <div className="screen-threshold-stepper">
            <button className="screen-step-btn" onClick={() => adjustPushSetting('minGapHours', -1, 1, 48)}>-</button>
            <div className="screen-threshold-value">{pushMinGapHours} 小时</div>
            <button className="screen-step-btn" onClick={() => adjustPushSetting('minGapHours', 1, 1, 48)}>+</button>
          </div>
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
