import { useState } from 'react';
import { useStore } from '../../state/store';
import { BackChevronIcon, PlusIcon, CloseIcon, TrashIcon } from '../../components/Icons';

export default function EnglishView() {
  const englishPhrases = useStore((s) => s.englishPhrases);
  const closePlaySubview = useStore((s) => s.closePlaySubview);
  const openPlayAdd = useStore((s) => s.openPlayAdd);
  const closePlayAdd = useStore((s) => s.closePlayAdd);
  const playAddOpen = useStore((s) => s.playAddOpen);
  const playDraft = useStore((s) => s.playDraft);
  const onPlayDraftChange = useStore((s) => s.onPlayDraftChange);
  const savePlayDraft = useStore((s) => s.savePlayDraft);
  const deleteEnglishPhrase = useStore((s) => s.deleteEnglishPhrase);

  const [revealedId, setRevealedId] = useState(null);

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closePlaySubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">英语角</div>
        </div>
        <button className="manage-sub__add-btn" onClick={() => openPlayAdd('english')}>
          <PlusIcon color="#8C7A82" width={14} height={14} />
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        {englishPhrases.length === 0 ? (
          <div className="ledger-empty">还没有短语，点右上角加一条吧</div>
        ) : (
          <div className="simple-list-card">
            {englishPhrases.map((p) => (
              <div
                key={p.id}
                className="simple-list-row simple-list-row--tappable"
                onClick={() => setRevealedId((id) => (id === p.id ? null : p.id))}
              >
                <div className="simple-list-body">
                  <div className="simple-list-title">{p.phrase}</div>
                  {revealedId === p.id && <div className="english-meaning">{p.meaning}</div>}
                </div>
                <button
                  className="simple-list-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteEnglishPhrase(p.id);
                  }}
                >
                  <TrashIcon color="#8C6A72" width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {playAddOpen === 'english' && (
        <div className="sheet-overlay" onClick={closePlayAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">加一条短语</div>
              <button className="sheet-panel__close" onClick={closePlayAdd}>
                <CloseIcon />
              </button>
            </div>
            <input
              className="provider-form-input"
              style={{ marginBottom: 10 }}
              value={playDraft.phrase}
              onChange={(e) => onPlayDraftChange('phrase', e.target.value)}
              placeholder="短语"
              autoFocus
            />
            <input
              className="provider-form-input"
              style={{ marginBottom: 14 }}
              value={playDraft.meaning}
              onChange={(e) => onPlayDraftChange('meaning', e.target.value)}
              placeholder="意思"
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
