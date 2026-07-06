import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { attachmentUrl } from '../api/client';
import { BowIcon, StarIcon, PlusIcon, RefreshIcon, ChevronDownIcon, PencilIcon, TrashIcon, FileIcon, CloseIcon, ReadStatusIcon } from '../components/Icons';
import ModelSwitcherPopover from '../components/ModelSwitcherPopover';
import FavoriteHeart from '../components/FavoriteHeart';

function snippetForMessage(msg) {
  if (msg.kind === 'photo') return msg.text || '[分享了一张照片]';
  if (msg.kind === 'image') return msg.text || `[图片：${msg.attachment?.name || ''}]`;
  if (msg.kind === 'file') return msg.text || `[文件：${msg.attachment?.name || ''}]`;
  return msg.text || '';
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Drag-to-reorder for the staged attachment strip, implemented with
// pointer events rather than the HTML5 drag-and-drop API — the latter has
// no real touch support on iOS Safari, which is where this app actually
// runs day to day.
function AttachmentDraftStrip() {
  const attachmentDraft = useStore((s) => s.attachmentDraft);
  const removeAttachmentDraft = useStore((s) => s.removeAttachmentDraft);
  const reorderAttachmentDraft = useStore((s) => s.reorderAttachmentDraft);
  const dragRef = useRef(null);

  if (!attachmentDraft.length) return null;

  const handlePointerDown = (e, index) => {
    dragRef.current = { index, startX: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const itemWidth = e.currentTarget.offsetWidth + 8;
    const deltaIndex = Math.round((e.clientX - drag.startX) / itemWidth);
    if (!deltaIndex) return;
    const targetIndex = Math.max(0, Math.min(attachmentDraft.length - 1, drag.index + deltaIndex));
    if (targetIndex !== drag.index) {
      reorderAttachmentDraft(drag.index, targetIndex);
      dragRef.current = { index: targetIndex, startX: e.clientX };
    }
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="attachment-draft-strip">
      {attachmentDraft.map((a, i) => (
        <div
          key={a.id}
          className="attachment-draft-item"
          onPointerDown={(e) => handlePointerDown(e, i)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {a.kind === 'image' ? (
            <img src={a.previewUrl} alt="" />
          ) : (
            <div className="attachment-draft-file">
              <FileIcon width={20} height={20} />
              <span>{a.file.name}</span>
            </div>
          )}
          <button
            className="attachment-draft-remove"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeAttachmentDraft(a.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ChatMode() {
  const messages = useStore((s) => s.messages);
  const isReplying = useStore((s) => s.isReplying);
  const markChatRead = useStore((s) => s.markChatRead);
  const chatLastReadId = useStore((s) => s.chatLastReadId);
  const chatDraft = useStore((s) => s.chatDraft);
  const onChatChange = useStore((s) => s.onChatChange);
  const sendChat = useStore((s) => s.sendChat);
  const addAttachmentDraftFiles = useStore((s) => s.addAttachmentDraftFiles);
  const attachmentUploading = useStore((s) => s.attachmentUploading);
  const attachmentError = useStore((s) => s.attachmentError);
  const clearAttachmentError = useStore((s) => s.clearAttachmentError);
  const openImageViewer = useStore((s) => s.openImageViewer);
  const mcpToolsEnabled = useStore((s) => s.mcpToolsEnabled);
  const toggleMcpToolsQuick = useStore((s) => s.toggleMcpToolsQuick);
  const modelSwitcherOpen = useStore((s) => s.modelSwitcherOpen);
  const toggleModelSwitcher = useStore((s) => s.toggleModelSwitcher);
  const regeneratingIds = useStore((s) => s.regeneratingIds);
  const expandedThinkingIds = useStore((s) => s.expandedThinkingIds);
  const toggleThinkingExpanded = useStore((s) => s.toggleThinkingExpanded);
  const regeneratingRoundIds = useStore((s) => s.regeneratingRoundIds);
  const editingMessageId = useStore((s) => s.editingMessageId);
  const editDraft = useStore((s) => s.editDraft);
  const startEditMessage = useStore((s) => s.startEditMessage);
  const cancelEditMessage = useStore((s) => s.cancelEditMessage);
  const onEditDraftChange = useStore((s) => s.onEditDraftChange);
  const saveEditMessage = useStore((s) => s.saveEditMessage);
  const deleteConfirmMessageId = useStore((s) => s.deleteConfirmMessageId);
  const requestDeleteMessage = useStore((s) => s.requestDeleteMessage);
  const cancelDeleteMessage = useStore((s) => s.cancelDeleteMessage);
  const confirmDeleteMessage = useStore((s) => s.confirmDeleteMessage);
  const regenerateConfirm = useStore((s) => s.regenerateConfirm);
  const requestRegenerateMessage = useStore((s) => s.requestRegenerateMessage);
  const cancelRegenerateMessage = useStore((s) => s.cancelRegenerateMessage);
  const confirmRegenerateMessage = useStore((s) => s.confirmRegenerateMessage);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatInputRef = useRef(null);
  const lastMessageIdRef = useRef(undefined);
  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Grows the compose box up to a cap as the user adds lines (Shift+Enter),
  // then shrinks back to one line once a message actually sends.
  useEffect(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [chatDraft]);
  // A photo bubble finishing its load after the initial scroll-to-bottom
  // grows the list's height without anything re-triggering the scroll,
  // which is what left the view stuck partway up instead of at the true
  // bottom whenever a recent message had an image in it. Only re-snaps if
  // already at (or very near) the bottom, so it doesn't yank you back down
  // while you're scrolled up reading an older photo.
  const handleImageLoad = () => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) scrollToBottom();
  };
  // Persist scroll position (imperatively, not via a subscribed selector —
  // this only ever gets read back on the next mount) so switching tabs
  // away and back restores wherever you were instead of snapping to the
  // bottom every time.
  const handleScroll = () => {
    const el = listRef.current;
    if (el) useStore.setState({ chatScrollTop: el.scrollTop });
  };
  useEffect(() => {
    const el = listRef.current;
    const lastId = messages.length ? messages[messages.length - 1].id : null;
    if (lastMessageIdRef.current === undefined) {
      // First render after mounting — restore the position from before this
      // screen was last left, rather than always jumping to the bottom.
      // Deferred two frames: right at mount, scrollHeight can still reflect
      // pre-layout (webfonts/line-wrapping not settled yet), so assigning
      // scrollTop immediately can land short of the real bottom — which
      // then reads as "jumped to the top" once layout finishes growing
      // past it.
      if (el) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const node = listRef.current;
            if (!node) return;
            const saved = useStore.getState().chatScrollTop;
            node.scrollTop = saved != null ? saved : node.scrollHeight;
          });
        });
      }
    } else if (lastId !== lastMessageIdRef.current || isReplying) {
      // A genuinely new message landed at the end (sent, received, or a
      // whole-round regenerate that appended rather than replaced) — or
      // the "typing…" row just appeared. Either way, follow it down.
      // Regenerating an existing message in place changes neither of
      // these, so the scroll position is left untouched.
      scrollToBottom();
    }
    lastMessageIdRef.current = lastId;
  }, [messages, isReplying]);

  // Mounting/updating here means this screen is actually showing the
  // current messages right now — mark them read so a question sitting
  // unreplied is known to have actually been seen.
  useEffect(() => {
    if (messages.length) markChatRead();
  }, [messages, markChatRead]);

  const handleFileChange = (e) => {
    addAttachmentDraftFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="chat">
      <div className="chat__list" ref={listRef} onScroll={handleScroll}>
        {messages.map((msg, i) => {
          const mine = msg.from === 'me';
          const tokens = !mine ? msg.tokens : null;
          const timeLabel = !mine && tokens != null ? `${msg.time} · ${tokens} tokens` : msg.time;
          const isRegenerating = !mine && regeneratingIds.includes(msg.id);
          const isExpanded = !mine && expandedThinkingIds.includes(msg.id);
          const isRoundBusy = mine && regeneratingRoundIds.includes(msg.id);
          const isEditing = mine && editingMessageId === msg.id;
          const next = messages[i + 1];
          const canRegenerateRound = mine && msg.kind === 'text' && (!next || next.from === 'them');
          const isDeleteConfirming = deleteConfirmMessageId === msg.id;
          const isRegenerateConfirming = regenerateConfirm?.id === msg.id;
          return (
            <div key={msg.id} className="chat__row" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div className="chat__bubble-wrap" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {isEditing ? (
                  <div className="chat__edit-wrap">
                    <textarea
                      className="chat__edit-input"
                      value={editDraft}
                      onChange={(e) => onEditDraftChange(e.target.value)}
                      autoFocus
                    />
                    <div className="chat__edit-actions">
                      <button className="chat__edit-btn chat__edit-btn--ghost" onClick={cancelEditMessage}>取消</button>
                      <button className="chat__edit-btn chat__edit-btn--save" onClick={saveEditMessage}>保存并重新生成</button>
                    </div>
                  </div>
                ) : msg.kind === 'photo' ? (
                  <div className="chat__photo-bubble">
                    <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
                      <rect x="1" y="4" width="24" height="17" rx="3" stroke="#C08BA0" strokeWidth="1.8" />
                      <path d="M8 4L10 1H16L18 4" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="13" cy="12.5" r="5" stroke="#C08BA0" strokeWidth="1.8" />
                    </svg>
                    <div className="chat__photo-label">{msg.text}</div>
                  </div>
                ) : msg.kind === 'image' ? (
                  <button className="chat__image-bubble" onClick={() => openImageViewer(attachmentUrl(msg.attachment.url))}>
                    <img src={attachmentUrl(msg.attachment.url)} alt={msg.attachment.name || '图片'} onLoad={handleImageLoad} />
                  </button>
                ) : msg.kind === 'file' ? (
                  <a
                    className="chat__file-bubble"
                    href={attachmentUrl(msg.attachment.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={msg.attachment.name}
                  >
                    <div className="chat__file-icon">
                      <FileIcon />
                    </div>
                    <div className="chat__file-info">
                      <div className="chat__file-name">{msg.attachment.name || '文件'}</div>
                      <div className="chat__file-size">{formatFileSize(msg.attachment.size)}</div>
                    </div>
                  </a>
                ) : (
                  <div
                    className="chat__bubble"
                    style={{
                      background: mine ? 'var(--color-bubble-me)' : 'var(--color-bubble-them)',
                      borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      opacity: isRegenerating || isRoundBusy ? 0.5 : 1,
                    }}
                  >
                    {msg.text}
                  </div>
                )}
                {!isEditing && (
                  <div className="chat__time-row">
                    {isDeleteConfirming ? (
                      <div className="chat__delete-confirm">
                        <span className="chat__delete-confirm-text">删除这条消息？</span>
                        <button className="chat__delete-confirm-btn chat__delete-confirm-btn--cancel" onClick={cancelDeleteMessage}>取消</button>
                        <button className="chat__delete-confirm-btn chat__delete-confirm-btn--danger" onClick={confirmDeleteMessage}>删除</button>
                      </div>
                    ) : isRegenerateConfirming ? (
                      <div className="chat__delete-confirm">
                        <span className="chat__delete-confirm-text">重新生成这条回复？</span>
                        <button className="chat__delete-confirm-btn chat__delete-confirm-btn--cancel" onClick={cancelRegenerateMessage}>取消</button>
                        <button className="chat__delete-confirm-btn chat__delete-confirm-btn--danger" onClick={confirmRegenerateMessage}>确定</button>
                      </div>
                    ) : (
                      <>
                        <div className="chat__time">{timeLabel}</div>
                        {!mine && typeof msg.id === 'number' && (
                          <span className="chat__read-status" title={msg.id <= chatLastReadId ? '已读' : '未读'}>
                            <ReadStatusIcon read={msg.id <= chatLastReadId} />
                          </span>
                        )}
                        <div className="chat__msg-actions">
                          {!mine && msg.kind === 'text' && (
                            <>
                              <button
                                className="chat__msg-action-btn"
                                title="重新生成"
                                onClick={() => requestRegenerateMessage(msg.id, 'reply')}
                                disabled={isRegenerating}
                              >
                                <RefreshIcon color="#8C6A72" width={14} height={14} />
                              </button>
                              <button
                                className="chat__msg-action-btn"
                                title="思考过程 / 工具调用"
                                onClick={() => toggleThinkingExpanded(msg.id)}
                              >
                                <ChevronDownIcon color="#8C6A72" width={14} height={14} expanded={isExpanded} />
                              </button>
                            </>
                          )}
                          {canRegenerateRound && (
                            <>
                              <button
                                className="chat__msg-action-btn"
                                title="重新生成"
                                onClick={() => requestRegenerateMessage(msg.id, 'round')}
                                disabled={isRoundBusy}
                              >
                                <RefreshIcon color="#8C6A72" width={14} height={14} />
                              </button>
                              <button
                                className="chat__msg-action-btn"
                                title="编辑"
                                onClick={() => startEditMessage(msg.id, msg.text)}
                                disabled={isRoundBusy}
                              >
                                <PencilIcon />
                              </button>
                            </>
                          )}
                          <FavoriteHeart
                            className="chat__msg-action-btn"
                            type="chat"
                            sourceId={msg.id}
                            snippet={snippetForMessage(msg)}
                            sourceTime={msg.createdAt}
                            size={14}
                          />
                          <button
                            className="chat__msg-action-btn"
                            title="删除"
                            onClick={() => requestDeleteMessage(msg.id)}
                          >
                            <TrashIcon color="#8C6A72" width={14} height={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isExpanded && (
                  <div className="chat__thinking-bubble">
                    <div className="chat__thinking-label">Thinking：</div>
                    <div className="chat__thinking-content">{msg.thinking || '（这条回复没有思考内容）'}</div>
                    {msg.toolCalls?.length > 0 && (
                      <>
                        <div className="chat__thinking-label" style={{ marginTop: 10 }}>调用的工具：</div>
                        {msg.toolCalls.map((tc, i) => (
                          <div key={i} className="chat__tool-call">
                            <div className="chat__tool-call-name">
                              {tc.name}
                              {tc.isError && <span className="chat__tool-call-error"> · 失败</span>}
                            </div>
                            {tc.input && Object.keys(tc.input).length > 0 && (
                              <div className="chat__tool-call-detail">参数：{JSON.stringify(tc.input)}</div>
                            )}
                            <div className="chat__tool-call-detail">结果：{tc.result}</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isReplying && <div className="chat__typing">对方正在输入…</div>}
      </div>

      <div className="chat__footer">
        {modelSwitcherOpen && <ModelSwitcherPopover />}
        <div className="chat__stickers">
          <button
            className="sticker-btn"
            title="快捷切换模型"
            style={{
              background: modelSwitcherOpen ? '#E8C4D4' : '#F6E2E8',
              boxShadow: modelSwitcherOpen ? '0 0 0 3px rgba(200,137,158,0.3)' : 'none',
            }}
            onClick={toggleModelSwitcher}
          >
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
          <button
            className="sticker-btn"
            title="插入附件"
            style={{
              background: 'rgba(255,255,255,0.7)',
              opacity: attachmentUploading ? 0.5 : 1,
            }}
            onClick={() => fileInputRef.current?.click()}
            disabled={attachmentUploading}
          >
            <PlusIcon color="#C08BA0" width={14} height={14} />
          </button>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
        {attachmentError && (
          <div className="chat__attachment-error">
            {attachmentError}
            <button className="chat__attachment-error-close" onClick={clearAttachmentError}>×</button>
          </div>
        )}
        <AttachmentDraftStrip />
        <div className="chat__input-row">
          <textarea
            ref={chatInputRef}
            className="chat__input"
            rows={1}
            value={chatDraft}
            onChange={(e) => onChatChange(e.target.value)}
            placeholder="说点什么…（换行后点发送，每行会分开发送）"
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
