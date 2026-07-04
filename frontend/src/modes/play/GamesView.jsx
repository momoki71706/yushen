import { useStore } from '../../state/store';
import { BackChevronIcon, PlusIcon, CloseIcon, TrashIcon } from '../../components/Icons';

export default function GamesView() {
  const games = useStore((s) => s.games);
  const closePlaySubview = useStore((s) => s.closePlaySubview);
  const openPlayAdd = useStore((s) => s.openPlayAdd);
  const closePlayAdd = useStore((s) => s.closePlayAdd);
  const playAddOpen = useStore((s) => s.playAddOpen);
  const playDraft = useStore((s) => s.playDraft);
  const onPlayDraftChange = useStore((s) => s.onPlayDraftChange);
  const savePlayDraft = useStore((s) => s.savePlayDraft);
  const deleteGame = useStore((s) => s.deleteGame);

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closePlaySubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">游戏</div>
        </div>
        <button className="manage-sub__add-btn" onClick={() => openPlayAdd('games')}>
          <PlusIcon color="#8C7A82" width={14} height={14} />
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        {games.length === 0 ? (
          <div className="ledger-empty">还没有游戏记录，点右上角加一条吧</div>
        ) : (
          <div className="simple-list-card">
            {games.map((g) => (
              <div key={g.id} className="simple-list-row">
                <div className="simple-list-body">
                  <div className="simple-list-title">{g.name}</div>
                  {g.note && <div className="simple-list-meta">{g.note}</div>}
                </div>
                <button className="simple-list-delete" onClick={() => deleteGame(g.id)}>
                  <TrashIcon color="#8C6A72" width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {playAddOpen === 'games' && (
        <div className="sheet-overlay" onClick={closePlayAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">加一条游戏记录</div>
              <button className="sheet-panel__close" onClick={closePlayAdd}>
                <CloseIcon />
              </button>
            </div>
            <input
              className="provider-form-input"
              style={{ marginBottom: 10 }}
              value={playDraft.title}
              onChange={(e) => onPlayDraftChange('title', e.target.value)}
              placeholder="游戏名"
              autoFocus
            />
            <input
              className="provider-form-input"
              style={{ marginBottom: 14 }}
              value={playDraft.note}
              onChange={(e) => onPlayDraftChange('note', e.target.value)}
              placeholder="备注，比如分数（可选）"
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
