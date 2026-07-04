import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

export default function ContextPanel() {
  const contextPanelOpen = useStore((s) => s.contextPanelOpen);
  const closeContextPanel = useStore((s) => s.closeContextPanel);
  const contextMessageLimit = useStore((s) => s.contextMessageLimit);
  const memorySaveMessageThreshold = useStore((s) => s.memorySaveMessageThreshold);
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
          <div className="watch-card-title">存记忆的消息阈值</div>
          <div className="screen-threshold-sub">聊天记录（连同期间的日记、信件）累计到多少条新内容，就自动回顾一次并存下值得记住的部分</div>
          <div className="screen-threshold-stepper">
            <button className="screen-step-btn" onClick={() => adjustContextSetting('memorySaveMessageThreshold', -10, 5, 300)}>-</button>
            <div className="screen-threshold-value">{memorySaveMessageThreshold} 条</div>
            <button className="screen-step-btn" onClick={() => adjustContextSetting('memorySaveMessageThreshold', 10, 5, 300)}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
