import { useStore } from '../state/store';
import { CloseIcon, PlusIcon } from './Icons';

export default function McpPanel() {
  const mcpPanelOpen = useStore((s) => s.mcpPanelOpen);
  const closeMcpPanel = useStore((s) => s.closeMcpPanel);
  const mcpToolsEnabled = useStore((s) => s.mcpToolsEnabled);
  const toggleMcpToolsQuick = useStore((s) => s.toggleMcpToolsQuick);
  const mcpServers = useStore((s) => s.mcpServers);
  const mcpNewName = useStore((s) => s.mcpNewName);
  const mcpNewUrl = useStore((s) => s.mcpNewUrl);
  const onMcpNewNameChange = useStore((s) => s.onMcpNewNameChange);
  const onMcpNewUrlChange = useStore((s) => s.onMcpNewUrlChange);
  const addMcpServerAction = useStore((s) => s.addMcpServerAction);
  const toggleMcpServerEnabled = useStore((s) => s.toggleMcpServerEnabled);
  const deleteMcpServerAction = useStore((s) => s.deleteMcpServerAction);
  const testMcpServerAction = useStore((s) => s.testMcpServerAction);
  const mcpTestStatus = useStore((s) => s.mcpTestStatus);

  if (!mcpPanelOpen) return null;

  return (
    <div className="sheet-overlay" onClick={closeMcpPanel}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">工具管理</div>
          <button className="sheet-panel__close" onClick={closeMcpPanel}>
            <CloseIcon />
          </button>
        </div>

        <div className="sidebar-reminder-row" style={{ padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid rgba(58,50,54,0.08)' }}>
          <div className="sidebar-menu-label">总开关（聊天时是否让 AI 调用工具）</div>
          <button
            className="toggle-switch"
            style={{ background: mcpToolsEnabled ? '#C8899E' : '#DCD4D8' }}
            onClick={toggleMcpToolsQuick}
          >
            <div className="toggle-switch__knob" style={{ left: mcpToolsEnabled ? 20 : 2 }} />
          </button>
        </div>

        {mcpServers.length === 0 && (
          <div className="ai-key-status" style={{ marginBottom: 12 }}>还没有添加任何 MCP 工具服务。</div>
        )}

        {mcpServers.map((server) => {
          const status = mcpTestStatus[server.id];
          return (
            <div key={server.id} className="ai-settings-section" style={{ background: 'rgba(58,50,54,0.03)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{server.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.url}</div>
                </div>
                <button
                  className="toggle-switch"
                  style={{ background: server.enabled ? '#C8899E' : '#DCD4D8', width: 38, height: 22 }}
                  onClick={() => toggleMcpServerEnabled(server.id)}
                >
                  <div className="toggle-switch__knob" style={{ width: 18, height: 18, left: server.enabled ? 18 : 2 }} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="ai-test-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12.5 }} onClick={() => testMcpServerAction(server.id)}>
                  {status?.loading ? '测试中…' : '测试连接'}
                </button>
                <button className="ai-test-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12.5, color: '#B4645E' }} onClick={() => deleteMcpServerAction(server.id)}>
                  删除
                </button>
              </div>
              {status && !status.loading && (
                <div className="ai-test-result" style={{ color: status.ok ? '#5E9A72' : '#B4645E' }}>
                  {status.ok ? `✓ 找到 ${status.toolCount} 个工具` : `✕ ${status.message || '连接失败'}`}
                </div>
              )}
            </div>
          );
        })}

        <div className="ai-settings-section" style={{ marginTop: 4 }}>
          <div className="ai-settings-label">添加新的 MCP 服务</div>
          <input
            className="ai-key-input"
            style={{ width: '100%', marginBottom: 8 }}
            value={mcpNewName}
            onChange={(e) => onMcpNewNameChange(e.target.value)}
            placeholder="名字（随便起，比如「搜索」）"
          />
          <div className="ai-key-row">
            <input
              className="ai-key-input"
              value={mcpNewUrl}
              onChange={(e) => onMcpNewUrlChange(e.target.value)}
              placeholder="https://..."
            />
            <button className="ai-key-save-btn" onClick={addMcpServerAction}>
              <PlusIcon color="#fff" width={12} height={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
