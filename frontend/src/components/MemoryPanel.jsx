import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

const MEMORY_LIBRARY_URL = 'https://yushen.zeabur.app/';

export default function MemoryPanel() {
  const memoryPanelOpen = useStore((s) => s.memoryPanelOpen);
  const closeMemoryPanel = useStore((s) => s.closeMemoryPanel);
  const memoryLogEntries = useStore((s) => s.memoryLogEntries);

  if (!memoryPanelOpen) return null;

  return (
    <div className="sheet-overlay" onClick={closeMemoryPanel}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">记忆库</div>
          <button className="sheet-panel__close" onClick={closeMemoryPanel}>
            <CloseIcon />
          </button>
        </div>

        <a
          className="ai-key-save-btn memory-panel-link--pinned"
          style={{ width: '100%', padding: '13px 0', marginBottom: 16, textAlign: 'center', display: 'block', boxSizing: 'border-box' }}
          href={MEMORY_LIBRARY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          进入记忆库
        </a>

        {memoryLogEntries.length === 0 && (
          <div className="ai-key-status" style={{ marginBottom: 12 }}>还没有自动存过记忆。</div>
        )}

        {memoryLogEntries.map((entry) => (
          <div key={entry.id} className="memory-log-row">
            <div className="memory-log-time">{entry.createdAt}</div>
            <div className="memory-log-summary">{entry.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
