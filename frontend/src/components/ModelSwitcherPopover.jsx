import { Fragment } from 'react';
import { useStore } from '../state/store';
import { CheckIcon } from './Icons';

export default function ModelSwitcherPopover() {
  const aiMode = useStore((s) => s.aiMode);
  const activeProviderId = useStore((s) => s.activeProviderId);
  const claudeCodeAvailable = useStore((s) => s.claudeCodeAvailable);
  const providers = useStore((s) => s.providers);
  const selectModelQuick = useStore((s) => s.selectModelQuick);
  const selectClaudeCodeQuick = useStore((s) => s.selectClaudeCodeQuick);
  const closeModelSwitcher = useStore((s) => s.closeModelSwitcher);

  const hasAnything = providers.length > 0 || claudeCodeAvailable;

  return (
    <Fragment>
      <div className="model-switcher-overlay" onClick={closeModelSwitcher} />
      <div className="model-switcher-popover" onClick={(e) => e.stopPropagation()}>
        <div className="model-switcher-title">快捷切换模型</div>

        {!hasAnything && <div className="model-switcher-empty">还没有配置任何 AI 供应商</div>}

        {claudeCodeAvailable && (
          <button
            className={`model-switcher-cc${aiMode === 'claude-code' ? ' model-switcher-cc--active' : ''}`}
            onClick={selectClaudeCodeQuick}
          >
            <span>Claude Code CLI</span>
            {aiMode === 'claude-code' && <CheckIcon />}
          </button>
        )}

        {providers.map((p) => (
          <div key={p.id} className="model-switcher-group">
            <div className="model-switcher-provider-name">{p.name}</div>
            {p.models.length ? (
              <div className="model-chip-row">
                {p.models.map((m) => {
                  const active = aiMode === 'provider' && activeProviderId === p.id && p.selectedModel === m;
                  return (
                    <button
                      key={m}
                      className={`model-chip${active ? ' model-chip--active' : ''}`}
                      onClick={() => selectModelQuick(p.id, m)}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="model-switcher-empty">还没有添加模型</div>
            )}
          </div>
        ))}
      </div>
    </Fragment>
  );
}
