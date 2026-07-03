import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { BowIcon, StarIcon, PlusIcon } from '../components/Icons';

export default function ChatMode() {
  const messages = useStore((s) => s.messages);
  const isReplying = useStore((s) => s.isReplying);
  const chatDraft = useStore((s) => s.chatDraft);
  const onChatChange = useStore((s) => s.onChatChange);
  const sendChat = useStore((s) => s.sendChat);
  const sendBowSticker = useStore((s) => s.sendBowSticker);
  const sendPhotoSticker = useStore((s) => s.sendPhotoSticker);
  const mcpToolsEnabled = useStore((s) => s.mcpToolsEnabled);
  const toggleMcpToolsQuick = useStore((s) => s.toggleMcpToolsQuick);

  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isReplying]);

  return (
    <div className="chat">
      <div className="chat__list" ref={listRef}>
        {messages.map((msg) => {
          const mine = msg.from === 'me';
          const tokens = !mine ? msg.tokens : null;
          const timeLabel = !mine && tokens != null ? `${msg.time} · ${tokens} tokens` : msg.time;
          return (
            <div key={msg.id} className="chat__row" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div className="chat__bubble-wrap" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {msg.kind === 'photo' ? (
                  <div className="chat__photo-bubble">
                    <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
                      <rect x="1" y="4" width="24" height="17" rx="3" stroke="#C08BA0" strokeWidth="1.8" />
                      <path d="M8 4L10 1H16L18 4" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="13" cy="12.5" r="5" stroke="#C08BA0" strokeWidth="1.8" />
                    </svg>
                    <div className="chat__photo-label">{msg.text}</div>
                  </div>
                ) : (
                  <div
                    className="chat__bubble"
                    style={{
                      background: mine ? 'var(--color-bubble-me)' : 'var(--color-bubble-them)',
                      borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    }}
                  >
                    {msg.text}
                  </div>
                )}
                <div className="chat__time">{timeLabel}</div>
              </div>
            </div>
          );
        })}
        {isReplying && <div className="chat__typing">对方正在输入…</div>}
      </div>

      <div className="chat__footer">
        <div className="chat__stickers">
          <button className="sticker-btn" style={{ background: '#F6E2E8' }} onClick={sendBowSticker}>
            <BowIcon />
          </button>
          <button
            className="sticker-btn"
            title="工具开关"
            style={{
              background: mcpToolsEnabled ? '#E8C4D4' : '#F1E0E8',
              boxShadow: mcpToolsEnabled ? '0 0 0 3px rgba(200,137,158,0.3)' : 'none',
            }}
            onClick={toggleMcpToolsQuick}
          >
            <StarIcon />
          </button>
          <button className="sticker-btn" style={{ background: 'rgba(255,255,255,0.7)' }} onClick={sendPhotoSticker}>
            <PlusIcon color="#C08BA0" width={14} height={14} />
          </button>
        </div>
        <div className="chat__input-row">
          <input
            className="chat__input"
            value={chatDraft}
            onChange={(e) => onChatChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="说点什么…"
          />
          <button className="chat__send" onClick={sendChat}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M1 8L15 1L10 15L7 9L1 8Z" fill="#fff" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
