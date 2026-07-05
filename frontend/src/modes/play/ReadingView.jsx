import { useStore } from '../../state/store';
import { BackChevronIcon, PlusIcon, CloseIcon, TrashIcon } from '../../components/Icons';

export default function ReadingView() {
  const books = useStore((s) => s.books);
  const closePlaySubview = useStore((s) => s.closePlaySubview);
  const openPlayAdd = useStore((s) => s.openPlayAdd);
  const closePlayAdd = useStore((s) => s.closePlayAdd);
  const playAddOpen = useStore((s) => s.playAddOpen);
  const playDraft = useStore((s) => s.playDraft);
  const onPlayDraftChange = useStore((s) => s.onPlayDraftChange);
  const savePlayDraft = useStore((s) => s.savePlayDraft);
  const deleteBook = useStore((s) => s.deleteBook);
  const cycleBookStatus = useStore((s) => s.cycleBookStatus);
  const incrementBookProgress = useStore((s) => s.incrementBookProgress);

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closePlaySubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">读书</div>
        </div>
        <button className="manage-sub__add-btn" onClick={() => openPlayAdd('reading')}>
          <PlusIcon color="#8C7A82" width={14} height={14} />
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        {books.length === 0 ? (
          <div className="ledger-empty">还没有书，点右上角加一本吧</div>
        ) : (
          <div className="simple-list-card">
            {books.map((b) => (
              <div key={b.id} className="simple-list-row">
                <div className="simple-list-body">
                  <div className="simple-list-title">{b.title}</div>
                  {b.author && <div className="simple-list-meta">{b.author}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <div className="reading-progress-track">
                      <div className="reading-progress-fill" style={{ width: `${b.progress || 0}%` }} />
                    </div>
                    <button className="reading-progress-btn" onClick={() => incrementBookProgress(b.id)}>+10%</button>
                  </div>
                </div>
                <button className="book-status-tag" onClick={() => cycleBookStatus(b.id)}>{b.status}</button>
                <button className="simple-list-delete" onClick={() => deleteBook(b.id)}>
                  <TrashIcon color="#8C6A72" width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {playAddOpen === 'reading' && (
        <div className="sheet-overlay" onClick={closePlayAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">加一本书</div>
              <button className="sheet-panel__close" onClick={closePlayAdd}>
                <CloseIcon />
              </button>
            </div>
            <input
              className="provider-form-input"
              style={{ marginBottom: 10 }}
              value={playDraft.title}
              onChange={(e) => onPlayDraftChange('title', e.target.value)}
              placeholder="书名"
              autoFocus
            />
            <input
              className="provider-form-input"
              style={{ marginBottom: 14 }}
              value={playDraft.author}
              onChange={(e) => onPlayDraftChange('author', e.target.value)}
              placeholder="作者（可选）"
            />
            <button className="ai-key-save-btn" style={{ width: '100%', padding: '13px 0' }} onClick={savePlayDraft}>
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
