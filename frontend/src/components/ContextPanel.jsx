import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

export default function ContextPanel() {
  const contextPanelOpen = useStore((s) => s.contextPanelOpen);
  const closeContextPanel = useStore((s) => s.closeContextPanel);
  const contextMessageLimit = useStore((s) => s.contextMessageLimit);
  const memorySaveMessageThreshold = useStore((s) => s.memorySaveMessageThreshold);
  const adjustContextSetting = useStore((s) => s.adjustContextSetting);
  const messageSplitEnabled = useStore((s) => s.messageSplitEnabled);
  const toggleMessageSplit = useStore((s) => s.toggleMessageSplit);

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

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="screen-threshold-sub">聊天记录（连同期间的日记、信件）累计到多少条新内容，就自动回顾一次并存下值得记住的部分</div>
          <div className="watch-card-title">存记忆的消息阈值</div>
          <div className="screen-threshold-stepper">
            <button className="screen-step-btn" onClick={() => adjustContextSetting('memorySaveMessageThreshold', -10, 1, 300)}>-</button>
            <div className="screen-threshold-value">{memorySaveMessageThreshold} 条</div>
            <button className="screen-step-btn" onClick={() => adjustContextSetting('memorySaveMessageThreshold', 10, 1, 300)}>+</button>
          </div>
        </div>

        <div className="watch-card" style={{ margin: 0 }}>
          <div className="screen-threshold-head">
            <div className="watch-card-title" style={{ marginBottom: 0 }}>分段发送</div>
            <button
              className="toggle-switch"
              style={{ background: messageSplitEnabled ? '#C8899E' : '#DCD4D8' }}
              onClick={toggleMessageSplit}
            >
              <div className="toggle-switch__knob" style={{ left: messageSplitEnabled ? 20 : 2 }} />
            </button>
          </div>
          <div className="screen-threshold-sub">开启后他会把一段话拆成几条短消息连着发（更像真人）。如果觉得说话变碎、变奇怪，可以关掉对比，关掉后每次回复只发一整条。</div>
        </div>
      </div>
    </div>
  );
}
