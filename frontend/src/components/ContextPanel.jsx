import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

export default function ContextPanel() {
  const contextPanelOpen = useStore((s) => s.contextPanelOpen);
  const closeContextPanel = useStore((s) => s.closeContextPanel);
  const contextMessageLimit = useStore((s) => s.contextMessageLimit);
  const memorySaveIntervalHours = useStore((s) => s.memorySaveIntervalHours);
  const adjustContextSetting = useStore((s) => s.adjustContextSetting);

  if (!contextPanelOpen) return null;

  return (
    <div className="sheet-overlay" onClick={closeContextPanel}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">上下文</div>
          <button className="sheet-panel__close" onClick={closeContextPanel}>
            <CloseIcon />
          </button>
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="watch-card-title">可读上下文条数</div>
          <div className="screen-threshold-sub">每次回复时，能读到最近多少条聊天记录</div>
          <div className="screen-threshold-stepper">
            <button className="screen-step-btn" onClick={() => adjustContextSetting('contextMessageLimit', -10, 10, 100)}>-</button>
            <div className="screen-threshold-value">{contextMessageLimit} 条</div>
            <button className="screen-step-btn" onClick={() => adjustContextSetting('contextMessageLimit', 10, 10, 100)}>+</button>
          </div>
        </div>

        <div className="watch-card" style={{ margin: 0 }}>
          <div className="watch-card-title">定时存记忆的频率</div>
          <div className="screen-threshold-sub">每隔多久，自动回顾一次最近的对话，把值得记住的内容存下来</div>
          <div className="screen-threshold-stepper">
            <button className="screen-step-btn" onClick={() => adjustContextSetting('memorySaveIntervalHours', -1, 1, 48)}>-</button>
            <div className="screen-threshold-value">{memorySaveIntervalHours} 小时</div>
            <button className="screen-step-btn" onClick={() => adjustContextSetting('memorySaveIntervalHours', 1, 1, 48)}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
