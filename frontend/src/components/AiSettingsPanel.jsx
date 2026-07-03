import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

export default function AiSettingsPanel() {
  const aiSettingsOpen = useStore((s) => s.aiSettingsOpen);
  const closeAiSettings = useStore((s) => s.closeAiSettings);
  const aiSettings = useStore((s) => s.aiSettings);
  const setAiProvider = useStore((s) => s.setAiProvider);
  const aiApiKeyDraft = useStore((s) => s.aiApiKeyDraft);
  const onAiApiKeyDraftChange = useStore((s) => s.onAiApiKeyDraftChange);
  const saveAiApiKey = useStore((s) => s.saveAiApiKey);
  const testAiConnection = useStore((s) => s.testAiConnection);
  const aiTestStatus = useStore((s) => s.aiTestStatus);

  if (!aiSettingsOpen) return null;

  const isApi = aiSettings.provider === 'api';

  return (
    <div className="sheet-overlay" onClick={closeAiSettings}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">AI 接入设置</div>
          <button className="sheet-panel__close" onClick={closeAiSettings}>
            <CloseIcon />
          </button>
        </div>

        <div className="ai-provider-toggle">
          <button
            className="ai-provider-toggle__btn"
            style={{ background: isApi ? '#fff' : 'transparent', color: isApi ? '#5C4A54' : '#6B6268' }}
            onClick={() => setAiProvider('api')}
          >
            Anthropic API Key
          </button>
          <button
            className="ai-provider-toggle__btn"
            style={{ background: !isApi ? '#fff' : 'transparent', color: !isApi ? '#5C4A54' : '#6B6268' }}
            onClick={() => setAiProvider('claude-code')}
          >
            Claude Code（VPS本地）
          </button>
        </div>

        {isApi ? (
          <div className="ai-settings-section">
            <div className="ai-settings-label">
              {aiSettings.hasApiKey
                ? `当前已设置：${aiSettings.apiKeyMasked}${aiSettings.apiKeySource === 'env' ? '（来自服务器 .env）' : ''}`
                : '还没有设置 API Key'}
            </div>
            <div className="ai-key-row">
              <input
                className="ai-key-input"
                type="password"
                value={aiApiKeyDraft}
                onChange={(e) => onAiApiKeyDraftChange(e.target.value)}
                placeholder="sk-ant-..."
              />
              <button className="ai-key-save-btn" onClick={saveAiApiKey}>保存</button>
            </div>
            <div className="ai-key-status">去 console.anthropic.com 申请 API Key，粘贴到这里保存后立即生效。</div>
          </div>
        ) : (
          <div className="ai-settings-section">
            <div className="ai-cli-hint">
              需要在 VPS 上安装 Claude Code 并完成登录（<code>claude login</code>，用你的 Claude
              订阅账号），聊天回复会直接调用本地的 <code>claude</code> 命令生成，不需要单独的 API Key。
            </div>
            <div className="ai-availability-dot">
              <span
                className="ai-availability-dot__circle"
                style={{ background: aiSettings.claudeCodeAvailable ? '#8FBF9F' : '#D99C9C' }}
              />
              {aiSettings.claudeCodeAvailable ? 'VPS 上检测到 claude 命令' : '没有检测到 claude 命令，请先在 VPS 上安装并登录'}
            </div>
          </div>
        )}

        <button className="ai-test-btn" onClick={testAiConnection} disabled={aiTestStatus?.loading}>
          {aiTestStatus?.loading ? '测试中…' : '测试连接'}
        </button>
        {aiTestStatus && !aiTestStatus.loading && (
          <div className="ai-test-result" style={{ color: aiTestStatus.ok ? '#5E9A72' : '#B4645E' }}>
            {aiTestStatus.ok ? '✓ ' : '✕ '}
            {aiTestStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
