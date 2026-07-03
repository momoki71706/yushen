import { useStore } from '../state/store';
import { CloseIcon, PlusIcon, BackChevronIcon, CheckIcon } from './Icons';

export default function AiSettingsPanel() {
  const aiSettingsOpen = useStore((s) => s.aiSettingsOpen);
  const closeAiSettings = useStore((s) => s.closeAiSettings);
  const providerEditId = useStore((s) => s.providerEditId);

  if (!aiSettingsOpen) return null;

  return (
    <div className="sheet-overlay" onClick={closeAiSettings}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        {providerEditId === null ? <ProviderList /> : <ProviderEditor />}
      </div>
    </div>
  );
}

function ProviderList() {
  const closeAiSettings = useStore((s) => s.closeAiSettings);
  const aiMode = useStore((s) => s.aiMode);
  const activeProviderId = useStore((s) => s.activeProviderId);
  const claudeCodeAvailable = useStore((s) => s.claudeCodeAvailable);
  const providers = useStore((s) => s.providers);
  const selectProvider = useStore((s) => s.selectProvider);
  const selectClaudeCodeMode = useStore((s) => s.selectClaudeCodeMode);
  const openProviderEditor = useStore((s) => s.openProviderEditor);
  const testClaudeCodeAction = useStore((s) => s.testClaudeCodeAction);
  const claudeCodeTestStatus = useStore((s) => s.claudeCodeTestStatus);

  return (
    <>
      <div className="sheet-panel__head">
        <div className="sheet-panel__title">AI 接入设置</div>
        <button className="sheet-panel__close" onClick={closeAiSettings}>
          <CloseIcon />
        </button>
      </div>

      <div className="provider-form-label" style={{ marginTop: 0 }}>供应商（点击选为当前使用，点右侧齿轮编辑）</div>

      {providers.map((p) => {
        const active = aiMode === 'provider' && String(activeProviderId) === String(p.id);
        return (
          <div key={p.id} className={`provider-list-item ${active ? 'provider-list-item--active' : ''}`} onClick={() => selectProvider(p.id)}>
            <div className="provider-list-item__info">
              <div className="provider-list-item__name">
                {p.name}
                <span className="provider-type-badge">{p.type === 'openai' ? 'OpenAI兼容' : 'Anthropic'}</span>
              </div>
              <div className="provider-list-item__meta">
                {p.models.length} 个模型{p.selectedModel ? ` · 当前 ${p.selectedModel}` : ''} · {p.keyCount} 个 Key
              </div>
            </div>
            {active && <CheckIcon color="#C8899E" />}
            <button className="provider-list-item__edit" onClick={(e) => { e.stopPropagation(); openProviderEditor(p.id); }}>
              <GearIcon />
            </button>
          </div>
        );
      })}

      <button className="provider-add-btn" onClick={() => openProviderEditor('new')}>+ 添加供应商</button>

      <div className="provider-form-label">Claude Code</div>
      <div className={`provider-list-item ${aiMode === 'claude-code' ? 'provider-list-item--active' : ''}`} onClick={selectClaudeCodeMode}>
        <div className="provider-list-item__info">
          <div className="provider-list-item__name">Claude Code（VPS本地）</div>
          <div className="provider-list-item__meta">
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: claudeCodeAvailable ? '#8FBF9F' : '#D99C9C', marginRight: 4 }} />
            {claudeCodeAvailable ? '检测到 claude 命令' : '未检测到，需要先 claude login'}
          </div>
        </div>
        {aiMode === 'claude-code' && <CheckIcon color="#C8899E" />}
      </div>

      <button className="ai-test-btn" style={{ marginTop: 8 }} onClick={testClaudeCodeAction} disabled={claudeCodeTestStatus?.loading}>
        {claudeCodeTestStatus?.loading ? '测试中…' : '测试 Claude Code 连接'}
      </button>
      {claudeCodeTestStatus && !claudeCodeTestStatus.loading && (
        <div className="ai-test-result" style={{ color: claudeCodeTestStatus.ok ? '#5E9A72' : '#B4645E' }}>
          {claudeCodeTestStatus.ok ? '✓ ' : '✕ '}{claudeCodeTestStatus.message}
        </div>
      )}
    </>
  );
}

function ProviderEditor() {
  const providerEditId = useStore((s) => s.providerEditId);
  const providerDraft = useStore((s) => s.providerDraft);
  const closeProviderEditor = useStore((s) => s.closeProviderEditor);
  const onProviderDraftChange = useStore((s) => s.onProviderDraftChange);
  const addModelToDraft = useStore((s) => s.addModelToDraft);
  const removeModelFromDraft = useStore((s) => s.removeModelFromDraft);
  const saveProviderDraft = useStore((s) => s.saveProviderDraft);
  const deleteProviderAction = useStore((s) => s.deleteProviderAction);
  const testProviderAction = useStore((s) => s.testProviderAction);
  const providerTestStatus = useStore((s) => s.providerTestStatus);

  if (!providerDraft) return null;
  const isNew = providerEditId === 'new';
  const status = !isNew ? providerTestStatus[providerEditId] : null;

  return (
    <>
      <div className="provider-editor-head">
        <button className="provider-editor-back" onClick={closeProviderEditor}>
          <BackChevronIcon />
        </button>
        <div className="sheet-panel__title" style={{ flex: 1 }}>{isNew ? '添加供应商' : '编辑供应商'}</div>
        <button className="sheet-panel__close" onClick={closeProviderEditor}>
          <CloseIcon />
        </button>
      </div>

      <div className="provider-form-label">供应商类型</div>
      <div className="ai-provider-toggle" style={{ marginBottom: 0 }}>
        <button
          className="ai-provider-toggle__btn"
          style={{ background: providerDraft.type === 'anthropic' ? '#fff' : 'transparent', color: providerDraft.type === 'anthropic' ? '#5C4A54' : '#6B6268' }}
          onClick={() => onProviderDraftChange('type', 'anthropic')}
        >
          Anthropic 格式
        </button>
        <button
          className="ai-provider-toggle__btn"
          style={{ background: providerDraft.type === 'openai' ? '#fff' : 'transparent', color: providerDraft.type === 'openai' ? '#5C4A54' : '#6B6268' }}
          onClick={() => onProviderDraftChange('type', 'openai')}
        >
          OpenAI 兼容格式
        </button>
      </div>

      <div className="provider-form-label">名称</div>
      <input
        className="provider-form-input"
        value={providerDraft.name}
        onChange={(e) => onProviderDraftChange('name', e.target.value)}
        placeholder="随便起，比如「我的中转站」"
      />

      <div className="provider-form-label">
        API Key{!isNew && providerDraft.keyCount > 0 ? ' · 已保存，留空则不改' : ''}
      </div>
      <input
        className="provider-form-input"
        type="password"
        value={providerDraft.keysText}
        onChange={(e) => onProviderDraftChange('keysText', e.target.value)}
        placeholder="sk-..."
      />

      <div className="provider-form-label">API Base URL{providerDraft.type === 'anthropic' ? '（留空用官方地址）' : ''}</div>
      <input
        className="provider-form-input"
        value={providerDraft.baseUrl}
        onChange={(e) => onProviderDraftChange('baseUrl', e.target.value)}
        placeholder="https://api.example.com/v1"
      />

      <div className="provider-form-label">API 模型（点击选为当前使用）</div>
      <div className="model-chip-row">
        {providerDraft.models.map((m) => (
          <div key={m} className={`model-chip ${providerDraft.selectedModel === m ? 'model-chip--active' : ''}`} onClick={() => onProviderDraftChange('selectedModel', m)}>
            {m}
            <button onClick={(e) => { e.stopPropagation(); removeModelFromDraft(m); }}>
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
      <div className="ai-key-row">
        <input
          className="provider-form-input"
          value={providerDraft.newModelDraft}
          onChange={(e) => onProviderDraftChange('newModelDraft', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addModelToDraft()}
          placeholder="模型名，比如 claude-sonnet-5"
        />
        <button className="ai-key-save-btn" onClick={addModelToDraft}>
          <PlusIcon color="#fff" width={12} height={12} />
        </button>
      </div>

      <div className="provider-editor-actions">
        <button className="ai-key-save-btn" style={{ flex: 1 }} onClick={saveProviderDraft}>保存</button>
        {!isNew && (
          <button className="ai-test-btn" style={{ flex: 1, color: '#B4645E' }} onClick={() => deleteProviderAction(providerEditId)}>删除</button>
        )}
      </div>
      {!isNew && (
        <>
          <button className="ai-test-btn" style={{ marginTop: 8 }} onClick={() => testProviderAction(providerEditId)} disabled={status?.loading}>
            {status?.loading ? '测试中…' : '测试连接'}
          </button>
          {status && !status.loading && (
            <div className="ai-test-result" style={{ color: status.ok ? '#5E9A72' : '#B4645E' }}>
              {status.ok ? '✓ ' : '✕ '}{status.message}
            </div>
          )}
        </>
      )}
    </>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.3" stroke="#6B6268" strokeWidth="1.3" />
      <path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.4 3.6L11.3 4.7M4.7 11.3L3.6 12.4M12.4 12.4L11.3 11.3M4.7 4.7L3.6 3.6" stroke="#6B6268" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
