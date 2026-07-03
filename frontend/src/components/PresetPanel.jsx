import { useStore } from '../state/store';
import { CloseIcon, BackChevronIcon } from './Icons';

export default function PresetPanel() {
  const presetPanelOpen = useStore((s) => s.presetPanelOpen);
  const closePresetPanel = useStore((s) => s.closePresetPanel);
  const presetEditId = useStore((s) => s.presetEditId);

  if (!presetPanelOpen) return null;

  return (
    <div className="sheet-overlay" onClick={closePresetPanel}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        {presetEditId === null ? <PresetList /> : <PresetEditor />}
      </div>
    </div>
  );
}

function PresetList() {
  const closePresetPanel = useStore((s) => s.closePresetPanel);
  const presets = useStore((s) => s.presets);
  const openPresetEditor = useStore((s) => s.openPresetEditor);
  const togglePresetEnabled = useStore((s) => s.togglePresetEnabled);

  const categories = [...new Set(presets.map((p) => p.category))];

  return (
    <>
      <div className="sheet-panel__head">
        <div className="sheet-panel__title">预设词</div>
        <button className="sheet-panel__close" onClick={closePresetPanel}>
          <CloseIcon />
        </button>
      </div>
      <div className="ai-key-status" style={{ marginBottom: 8 }}>
        开着的预设词会拼在一起，当作屿深每次回复时的说明书（系统提示词），对所有 AI 接入方式都生效。
      </div>

      {presets.length === 0 && <div className="ai-key-status">还没有预设词。</div>}

      {categories.map((cat) => (
        <div key={cat}>
          <div className="preset-category-label">{cat}</div>
          {presets
            .filter((p) => p.category === cat)
            .map((p) => (
              <div
                key={p.id}
                className={`preset-list-item ${p.enabled ? '' : 'preset-list-item--disabled'}`}
                onClick={() => openPresetEditor(p.id)}
              >
                <div className="preset-list-item__info">
                  <div className="preset-list-item__name">{p.name}</div>
                  <div className="preset-list-item__preview">{p.content}</div>
                </div>
                <button
                  className="toggle-switch"
                  style={{ background: p.enabled ? '#C8899E' : '#DCD4D8', flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); togglePresetEnabled(p.id); }}
                >
                  <div className="toggle-switch__knob" style={{ left: p.enabled ? 20 : 2 }} />
                </button>
              </div>
            ))}
        </div>
      ))}

      <button className="provider-add-btn" onClick={() => openPresetEditor('new')}>+ 添加预设词</button>
    </>
  );
}

function PresetEditor() {
  const presetEditId = useStore((s) => s.presetEditId);
  const presetDraft = useStore((s) => s.presetDraft);
  const closePresetEditor = useStore((s) => s.closePresetEditor);
  const onPresetDraftChange = useStore((s) => s.onPresetDraftChange);
  const savePresetDraft = useStore((s) => s.savePresetDraft);
  const deletePresetAction = useStore((s) => s.deletePresetAction);

  if (!presetDraft) return null;
  const isNew = presetEditId === 'new';

  return (
    <>
      <div className="provider-editor-head">
        <button className="provider-editor-back" onClick={closePresetEditor}>
          <BackChevronIcon />
        </button>
        <div className="sheet-panel__title" style={{ flex: 1 }}>{isNew ? '添加预设词' : '编辑预设词'}</div>
        <button className="sheet-panel__close" onClick={closePresetEditor}>
          <CloseIcon />
        </button>
      </div>

      <div className="provider-form-label">分类</div>
      <input
        className="provider-form-input"
        value={presetDraft.category}
        onChange={(e) => onPresetDraftChange('category', e.target.value)}
        placeholder="比如「人设」「称呼」「禁止事项」"
      />

      <div className="provider-form-label">名称</div>
      <input
        className="provider-form-input"
        value={presetDraft.name}
        onChange={(e) => onPresetDraftChange('name', e.target.value)}
        placeholder="随便起，方便自己认"
      />

      <div className="provider-form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>启用（拼进全局系统提示词）</span>
        <button
          className="toggle-switch"
          style={{ background: presetDraft.enabled ? '#C8899E' : '#DCD4D8' }}
          onClick={() => onPresetDraftChange('enabled', !presetDraft.enabled)}
        >
          <div className="toggle-switch__knob" style={{ left: presetDraft.enabled ? 20 : 2 }} />
        </button>
      </div>

      <div className="provider-form-label">内容</div>
      <textarea
        className="provider-form-textarea"
        style={{ minHeight: 120 }}
        value={presetDraft.content}
        onChange={(e) => onPresetDraftChange('content', e.target.value)}
        placeholder="比如「小晴喜欢被叫做宝宝」「不要用括号描述动作」"
      />

      <div className="provider-editor-actions">
        <button className="ai-key-save-btn" style={{ flex: 1 }} onClick={savePresetDraft}>保存</button>
        {!isNew && (
          <button className="ai-test-btn" style={{ flex: 1, color: '#B4645E' }} onClick={() => deletePresetAction(presetEditId)}>删除</button>
        )}
      </div>
    </>
  );
}
