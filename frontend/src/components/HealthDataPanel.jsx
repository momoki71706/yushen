import { useState } from 'react';
import { useStore } from '../state/store';
import { CloseIcon } from './Icons';
import { API_BASE_URL } from '../api/client';

function CopyField({ label, value, loading }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — nothing to fall back to gracefully here
    }
  };
  return (
    <div className="health-field">
      <div className="health-field-label">{label}</div>
      <div className="health-field-row">
        <div className="health-field-value">{loading ? '加载中…' : value}</div>
        <button className="health-field-copy" onClick={copy} disabled={loading}>
          {copied ? '已复制' : '复制'}
        </button>
      </div>
    </div>
  );
}

export default function HealthDataPanel() {
  const healthDataPanelOpen = useStore((s) => s.healthDataPanelOpen);
  const closeHealthDataPanel = useStore((s) => s.closeHealthDataPanel);
  const healthToken = useStore((s) => s.healthToken);
  const healthTokenLoading = useStore((s) => s.healthTokenLoading);
  const healthTokenRegenConfirmOpen = useStore((s) => s.healthTokenRegenConfirmOpen);
  const requestRegenerateHealthToken = useStore((s) => s.requestRegenerateHealthToken);
  const cancelRegenerateHealthToken = useStore((s) => s.cancelRegenerateHealthToken);
  const confirmRegenerateHealthToken = useStore((s) => s.confirmRegenerateHealthToken);

  if (!healthDataPanelOpen) return null;

  const pushUrl = `${API_BASE_URL}/health-data/push`;
  const activityUrl = `${API_BASE_URL}/health-data/activity`;

  return (
    <div className="sheet-overlay" onClick={closeHealthDataPanel}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">健康数据接入</div>
          <button className="sheet-panel__close" onClick={closeHealthDataPanel}>
            <CloseIcon />
          </button>
        </div>

        <div className="screen-threshold-sub" style={{ marginBottom: 16 }}>
          用 iOS 快捷指令读取 Apple Watch 的睡眠/步数/心率/经期数据，或监控手机打开记录，自动 POST
          到下面对应的地址。请求头加 <code>X-API-Token</code>，请求体是 JSON。
        </div>

        <CopyField label="健康数据推送地址（POST，每天一次）" value={pushUrl} />
        <CopyField label="手机打开记录地址（POST，每次打开触发）" value={activityUrl} />
        <CopyField label="访问令牌 X-API-Token" value={healthToken} loading={healthTokenLoading} />

        {healthTokenRegenConfirmOpen ? (
          <div className="manage-card__message-confirm">
            <span>重新生成？旧令牌会立刻失效</span>
            <button className="ledger-category-delete-cancel" onClick={cancelRegenerateHealthToken}>取消</button>
            <button className="ledger-category-delete-danger" onClick={confirmRegenerateHealthToken} disabled={healthTokenLoading}>
              确定
            </button>
          </div>
        ) : (
          <button className="letter-editing-cancel" onClick={requestRegenerateHealthToken}>
            重新生成令牌
          </button>
        )}
      </div>
    </div>
  );
}
