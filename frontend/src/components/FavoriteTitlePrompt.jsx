import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

export default function FavoriteTitlePrompt() {
  const favoriteTitlePrompt = useStore((s) => s.favoriteTitlePrompt);
  const onFavoriteTitleDraftChange = useStore((s) => s.onFavoriteTitleDraftChange);
  const cancelFavoriteTitlePrompt = useStore((s) => s.cancelFavoriteTitlePrompt);
  const confirmFavoriteTitlePrompt = useStore((s) => s.confirmFavoriteTitlePrompt);

  if (!favoriteTitlePrompt) return null;

  return (
    <div className="sheet-overlay" onClick={cancelFavoriteTitlePrompt}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">给这个收藏起个标题</div>
          <button className="sheet-panel__close" onClick={cancelFavoriteTitlePrompt}>
            <CloseIcon />
          </button>
        </div>
        <div className="favorite-prompt-snippet">{favoriteTitlePrompt.snippet}</div>
        <input
          className="provider-form-input"
          style={{ marginBottom: 16 }}
          value={favoriteTitlePrompt.draftTitle}
          onChange={(e) => onFavoriteTitleDraftChange(e.target.value)}
          placeholder="不填就用内容开头当标题"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && confirmFavoriteTitlePrompt()}
        />
        <button className="ai-key-save-btn" style={{ width: '100%', padding: '13px 0' }} onClick={confirmFavoriteTitlePrompt}>
          收藏
        </button>
      </div>
    </div>
  );
}
