import { useStore } from '../state/store';
import { CloseIcon } from './Icons';

export default function ClearChatConfirm() {
  const clearChatConfirmOpen = useStore((s) => s.clearChatConfirmOpen);
  const closeClearChatConfirm = useStore((s) => s.closeClearChatConfirm);
  const confirmClearChat = useStore((s) => s.confirmClearChat);

  if (!clearChatConfirmOpen) return null;

  return (
    <div className="reminder-overlay">
      <div className="reminder-card">
        <button className="reminder-close" onClick={closeClearChatConfirm}>
          <CloseIcon />
        </button>
        <div className="reminder-title">清空聊天记录？</div>
        <div className="reminder-desc">这会删除所有聊天消息和长期摘要，清空之后没法恢复，日记和信件不受影响。</div>
        <div className="confirm-btn-row">
          <button className="confirm-btn confirm-btn--ghost" onClick={closeClearChatConfirm}>取消</button>
          <button className="confirm-btn confirm-btn--danger" onClick={confirmClearChat}>清空</button>
        </div>
      </div>
    </div>
  );
}
