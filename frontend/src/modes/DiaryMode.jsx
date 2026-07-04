import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { attachmentUrl } from '../api/client';
import { MoodIcon, WeatherIcon, PlusIcon, CheckIcon, CalendarIcon, SearchIcon, BackChevronIcon, RefreshIcon, CloseIcon } from '../components/Icons';

const MOODS = ['开心', '平静', '难过', '兴奋', '疲惫'];
const WEATHERS = ['晴', '多云', '雨', '雪', '风'];
const GLOW = '0 0 0 7px rgba(200,137,158,0.22)';
const IMAGE_RETRY_LIMIT = 3;
const IMAGE_RETRY_DELAY_MS = 1200;

// Diary photos have been intermittently failing to load — appears to be a
// transient thing (network hiccup, or the storage volume not being fully
// consistent yet right after a write) rather than the file genuinely being
// gone, since reloading the page usually fixes it. Retrying a few times
// with a cache-busting query param (express.static ignores it, so it still
// resolves to the same file) covers that without needing a page reload.
function RetryImage({ src, className, alt = '' }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  const handleError = () => {
    if (attempt < IMAGE_RETRY_LIMIT) {
      setTimeout(() => setAttempt((a) => a + 1), IMAGE_RETRY_DELAY_MS);
    } else {
      setFailed(true);
    }
  };

  if (failed || !src) return null;
  const url = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`;
  return <img key={url} className={className} src={url} alt={alt} onError={handleError} />;
}

export default function DiaryMode() {
  const diaryView = useStore((s) => s.diaryView);
  return diaryView === 'detail' ? <DiaryDetail /> : <DiaryList />;
}

function DiaryList() {
  const moodPalette = useStore((s) => s.moodPalette);
  const weatherPalette = useStore((s) => s.weatherPalette);
  const diaryText = useStore((s) => s.diaryText);
  const onDiaryTextChange = useStore((s) => s.onDiaryTextChange);
  const diarySelectedTags = useStore((s) => s.diarySelectedTags);
  const isDiaryTagSelected = useStore((s) => s.isDiaryTagSelected);
  const toggleDiaryTag = useStore((s) => s.toggleDiaryTag);
  const diaryAttachmentPreviewUrl = useStore((s) => s.diaryAttachmentPreviewUrl);
  const diaryAttachmentUploading = useStore((s) => s.diaryAttachmentUploading);
  const diaryAttachmentError = useStore((s) => s.diaryAttachmentError);
  const pickDiaryAttachment = useStore((s) => s.pickDiaryAttachment);
  const removeDiaryAttachment = useStore((s) => s.removeDiaryAttachment);
  const openImageViewer = useStore((s) => s.openImageViewer);
  const fileInputRef = useRef(null);
  const showCustomTagInput = useStore((s) => s.showCustomTagInput);
  const toggleCustomTagInput = useStore((s) => s.toggleCustomTagInput);
  const customTagDraft = useStore((s) => s.customTagDraft);
  const onCustomTagDraftChange = useStore((s) => s.onCustomTagDraftChange);
  const addCustomTag = useStore((s) => s.addCustomTag);
  const saveDiaryEntry = useStore((s) => s.saveDiaryEntry);
  const diaryEntries = useStore((s) => s.diaryEntries);
  const diarySearchQuery = useStore((s) => s.diarySearchQuery);
  const onDiarySearchChange = useStore((s) => s.onDiarySearchChange);
  const diarySearchDate = useStore((s) => s.diarySearchDate);
  const onDiarySearchDateChange = useStore((s) => s.onDiarySearchDateChange);
  const clearDiarySearchDate = useStore((s) => s.clearDiarySearchDate);
  const showDiaryDatePicker = useStore((s) => s.showDiaryDatePicker);
  const toggleDiaryDatePicker = useStore((s) => s.toggleDiaryDatePicker);
  const openDiaryDetail = useStore((s) => s.openDiaryDetail);
  const diaryListScrollTop = useStore((s) => s.diaryListScrollTop);

  const containerRef = useRef(null);
  const pastAnchorRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = diaryListScrollTop || 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToPastDiary = () => {
    if (containerRef.current && pastAnchorRef.current) {
      containerRef.current.scrollTo(0, pastAnchorRef.current.offsetTop - 8);
    }
  };

  const q = (diarySearchQuery || '').trim();
  const filteredEntries = diaryEntries
    .filter((e) => !diarySearchDate || e.dateISO === diarySearchDate)
    .filter((e) => !q || e.excerpt.includes(q));

  const chips = diarySelectedTags.map((t, i) => ({
    key: `${t.type}-${t.key}-${i}`,
    label: t.key,
    bg: t.type === 'mood' ? moodPalette[t.key] : t.type === 'weather' ? weatherPalette[t.key] : 'rgba(255,255,255,0.6)',
    onRemove: () => toggleDiaryTag(t.type, t.key),
  }));

  return (
    <div id="diary-scroll-container" className="diary-scroll" ref={containerRef}>
      <div className="glass-card diary-picker-card">
        <div className="diary-picker-title">今天想记录点什么</div>
        <div className="diary-picker-row">
          {MOODS.map((m) => (
            <button
              key={m}
              className="diary-icon-btn"
              style={{ boxShadow: isDiaryTagSelected('mood', m) ? GLOW : 'none' }}
              onClick={() => toggleDiaryTag('mood', m)}
            >
              <MoodIcon mood={m} />
            </button>
          ))}
        </div>
        <div className="diary-picker-row">
          {WEATHERS.map((w) => (
            <button
              key={w}
              className="diary-icon-btn"
              style={{ boxShadow: isDiaryTagSelected('weather', w) ? GLOW : 'none' }}
              onClick={() => toggleDiaryTag('weather', w)}
            >
              <WeatherIcon weather={w} />
            </button>
          ))}
          <button className="diary-icon-btn diary-icon-btn--add" onClick={toggleCustomTagInput}>
            <PlusIcon color="#6B6268" />
          </button>
        </div>
        {showCustomTagInput && (
          <div className="diary-tag-input-row">
            <input
              className="diary-tag-input"
              value={customTagDraft}
              onChange={(e) => onCustomTagDraftChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
              placeholder="自定义标签…"
              autoFocus
            />
            <button className="diary-tag-confirm" onClick={addCustomTag}>
              <CheckIcon />
            </button>
          </div>
        )}
      </div>

      <div className="diary-paper">
        {chips.length > 0 && (
          <div className="diary-chips">
            {chips.map((chip) => (
              <button key={chip.key} className="diary-chip" style={{ background: chip.bg }} onClick={chip.onRemove}>
                {chip.label}
              </button>
            ))}
          </div>
        )}
        <textarea
          className="diary-textarea"
          value={diaryText}
          onChange={(e) => onDiaryTextChange(e.target.value)}
          placeholder="写下此刻…"
        />
        <button
          className="diary-paper-attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={diaryAttachmentUploading}
        >
          <PlusIcon color="#8C7A82" width={13} height={13} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            pickDiaryAttachment(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          className="diary-paper-save"
          onClick={() => {
            // iOS Safari doesn't reliably move focus away from a text field
            // just because a button was tapped — without this the textarea
            // stays "focused" as far as the keyboard-aware viewport height
            // hook is concerned, and the layout stays stuck in the
            // compressed, keyboard-open state even after the entry saves.
            document.activeElement?.blur();
            saveDiaryEntry();
          }}
          disabled={diaryAttachmentUploading}
        >
          <CheckIcon />
          <span>保存</span>
        </button>
      </div>

      {diaryAttachmentPreviewUrl && (
        <div className="diary-attachment-preview">
          <img
            src={diaryAttachmentPreviewUrl}
            alt=""
            onClick={() => openImageViewer(diaryAttachmentPreviewUrl)}
          />
          <button className="diary-attachment-remove" onClick={removeDiaryAttachment}>
            <CloseIcon />
          </button>
        </div>
      )}
      {diaryAttachmentError && <div className="diary-attachment-error">{diaryAttachmentError}</div>}

      <button className="diary-past-link" onClick={scrollToPastDiary}>
        <span>往期日记</span>
        <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
          <path d="M1 1L5 6L9 1" stroke="#6B6268" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div id="diary-past-anchor" ref={pastAnchorRef}>
        <div className="diary-search">
          <button onClick={toggleDiaryDatePicker}>
            <CalendarIcon />
          </button>
          <input
            value={diarySearchQuery}
            onChange={(e) => onDiarySearchChange(e.target.value)}
            placeholder="搜索日记…"
          />
          <SearchIcon />
        </div>

        {showDiaryDatePicker && (
          <div className="diary-date-row">
            <input
              type="date"
              className="diary-date-input"
              value={diarySearchDate}
              onChange={(e) => onDiarySearchDateChange(e.target.value)}
            />
            {diarySearchDate && (
              <button className="diary-date-clear" onClick={clearDiarySearchDate}>清除</button>
            )}
          </div>
        )}

        {filteredEntries.map((entry, i) => {
          const preview = entry.excerpt.length > 50 ? entry.excerpt.slice(0, 50) + '…' : entry.excerpt;
          const rotate = i % 3 === 0 ? '-1.4deg' : i % 3 === 1 ? '1deg' : '-0.6deg';
          const offset = i % 2 === 0 ? '0px' : '10px';
          return (
            <div
              key={entry.id}
              className="diary-entry-card"
              style={{ marginLeft: offset, transform: `rotate(${rotate})` }}
              onClick={() => openDiaryDetail(entry.id, containerRef.current?.scrollTop)}
            >
              {entry.hasUnread && <div className="diary-entry-unread-dot" />}
              <div className="diary-entry-head">
                {entry.author === 'them' && <div className="diary-entry-author">对方</div>}
                <div className="diary-mood-dot" style={{ background: entry.moodColor }} />
                <div className="diary-entry-mood">{entry.mood}</div>
                <div className="diary-entry-dot">·</div>
                <div className="diary-entry-weather">{entry.weather}</div>
                {entry.tag && <div className="diary-entry-tag">{entry.tag}</div>}
                <div style={{ flex: 1 }} />
                <div className="diary-entry-date">{entry.dateLabel}</div>
              </div>
              <div className="diary-entry-preview">{preview}</div>
              {entry.attachment && (
                <RetryImage className="diary-entry-thumb" src={attachmentUrl(entry.attachment.url)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiaryDetail() {
  const diaryEntries = useStore((s) => s.diaryEntries);
  const diaryDetailId = useStore((s) => s.diaryDetailId);
  const closeDiaryDetail = useStore((s) => s.closeDiaryDetail);
  const deleteDiaryEntry = useStore((s) => s.deleteDiaryEntry);
  const diaryComments = useStore((s) => s.diaryComments);
  const diaryCommentsLoading = useStore((s) => s.diaryCommentsLoading);
  const diaryCommentDraft = useStore((s) => s.diaryCommentDraft);
  const onDiaryCommentDraftChange = useStore((s) => s.onDiaryCommentDraftChange);
  const diaryCommentSending = useStore((s) => s.diaryCommentSending);
  const addDiaryCommentAction = useStore((s) => s.addDiaryCommentAction);
  const diaryRegeneratingIds = useStore((s) => s.diaryRegeneratingIds);
  const regenerateDiaryEntryAction = useStore((s) => s.regenerateDiaryEntryAction);
  const openImageViewer = useStore((s) => s.openImageViewer);
  const diaryCommentReplyTarget = useStore((s) => s.diaryCommentReplyTarget);
  const startReplyToDiaryComment = useStore((s) => s.startReplyToDiaryComment);
  const cancelReplyToDiaryComment = useStore((s) => s.cancelReplyToDiaryComment);
  const diaryCommentDeleteConfirmId = useStore((s) => s.diaryCommentDeleteConfirmId);
  const requestDeleteDiaryComment = useStore((s) => s.requestDeleteDiaryComment);
  const cancelDeleteDiaryComment = useStore((s) => s.cancelDeleteDiaryComment);
  const confirmDeleteDiaryComment = useStore((s) => s.confirmDeleteDiaryComment);

  const entry = diaryEntries.find((e) => e.id === diaryDetailId);
  if (!entry) return null;

  const isRegenerating = diaryRegeneratingIds.includes(entry.id);

  return (
    <div className="diary-detail">
      <div className="diary-detail__head">
        <div className="pill-back">
          <button className="circle-back-btn" onClick={closeDiaryDetail}>
            <BackChevronIcon />
          </button>
          <div className="pill-back-title">{entry.dateLabel}</div>
        </div>
      </div>
      <div className="diary-detail__body">
        <div className="diary-detail__card">
          <div className="diary-entry-head">
            {entry.author === 'them' && <div className="diary-entry-author">对方</div>}
            <div className="diary-mood-dot" style={{ background: entry.moodColor }} />
            <div className="diary-entry-mood">{entry.mood}</div>
            <div className="diary-entry-dot">·</div>
            <div className="diary-entry-weather">{entry.weather}</div>
            {entry.tag && <div className="diary-entry-tag">{entry.tag}</div>}
            {entry.author === 'them' && (
              <button
                className="diary-regenerate-btn"
                title="重新生成"
                onClick={() => regenerateDiaryEntryAction(entry.id)}
                disabled={isRegenerating}
              >
                <RefreshIcon color="#8C6A72" width={14} height={14} />
              </button>
            )}
          </div>
          <div className="diary-detail__excerpt" style={{ opacity: isRegenerating ? 0.5 : 1 }}>{entry.excerpt}</div>
          {entry.attachment && (
            <button className="diary-detail__attachment" onClick={() => openImageViewer(attachmentUrl(entry.attachment.url))}>
              <RetryImage src={attachmentUrl(entry.attachment.url)} />
            </button>
          )}
        </div>

        <div className="diary-comments">
          <div className="diary-comments__title">留言</div>
          {!diaryCommentsLoading && diaryComments.length === 0 && (
            <div className="diary-comments__empty">还没有留言</div>
          )}
          {diaryComments.map((c) => {
            const quoteTarget = c.replyToId ? diaryComments.find((t) => t.id === c.replyToId) : null;
            const isConfirming = diaryCommentDeleteConfirmId === c.id;
            return (
              <div key={c.id} className="diary-comment-row">
                <div className="diary-comment-top">
                  <div className="diary-comment-author">{c.author === 'me' ? '小晴' : '对方'}</div>
                  <div className="diary-comment-time">{c.time}</div>
                </div>
                {quoteTarget && (
                  <div className="diary-comment-quote">
                    回复{quoteTarget.author === 'me' ? '小晴' : '对方'}：
                    {quoteTarget.text.length > 24 ? quoteTarget.text.slice(0, 24) + '…' : quoteTarget.text}
                  </div>
                )}
                <div className="diary-comment-text">{c.text}</div>
                {isConfirming ? (
                  <div className="diary-comment-delete-confirm">
                    <span>删除这条留言？</span>
                    <button className="diary-comment-delete-cancel" onClick={cancelDeleteDiaryComment}>取消</button>
                    <button className="diary-comment-delete-danger" onClick={confirmDeleteDiaryComment}>删除</button>
                  </div>
                ) : (
                  <div className="diary-comment-actions">
                    <button className="diary-comment-action-link" onClick={() => startReplyToDiaryComment(c)}>回复</button>
                    <button className="diary-comment-action-link diary-comment-action-link--danger" onClick={() => requestDeleteDiaryComment(c.id)}>删除</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="diary-detail__footer">
        {diaryCommentReplyTarget && (
          <div className="diary-comment-reply-banner">
            <span>
              回复{diaryCommentReplyTarget.author === 'me' ? '小晴' : '对方'}：
              {diaryCommentReplyTarget.text.length > 20 ? diaryCommentReplyTarget.text.slice(0, 20) + '…' : diaryCommentReplyTarget.text}
            </span>
            <button onClick={cancelReplyToDiaryComment}>
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="diary-comment-input-row">
          <input
            className="diary-comment-input"
            data-scroll-block="end"
            value={diaryCommentDraft}
            onChange={(e) => onDiaryCommentDraftChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDiaryCommentAction()}
            placeholder="留句话…"
            disabled={diaryCommentSending}
          />
          <button
            className="diary-comment-send"
            onClick={() => {
              document.activeElement?.blur();
              addDiaryCommentAction();
            }}
            disabled={diaryCommentSending}
          >
            <CheckIcon color="#fff" />
          </button>
        </div>
        <button className="diary-delete-btn" onClick={() => deleteDiaryEntry(entry.id)}>删除这篇日记</button>
      </div>
    </div>
  );
}
