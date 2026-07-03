import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { MoodIcon, WeatherIcon, PlusIcon, CheckIcon, CalendarIcon, SearchIcon, BackChevronIcon } from '../components/Icons';

const MOODS = ['开心', '平静', '难过', '兴奋', '疲惫'];
const WEATHERS = ['晴', '多云', '雨', '雪', '风'];
const GLOW = '0 0 0 7px rgba(200,137,158,0.22)';

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
  const diaryHasAttachment = useStore((s) => s.diaryHasAttachment);
  const toggleDiaryAttachment = useStore((s) => s.toggleDiaryAttachment);
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
        <button className="diary-paper-attach" onClick={toggleDiaryAttachment}>
          <PlusIcon color="#8C7A82" width={13} height={13} />
        </button>
        <button className="diary-paper-save" onClick={saveDiaryEntry}>
          <CheckIcon />
          <span>保存</span>
        </button>
      </div>

      {diaryHasAttachment && (
        <div className="diary-attachment-note">
          <PlusIcon color="#C08BA0" width={11} height={11} />
          已附加一张照片
        </div>
      )}

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
              <div className="diary-entry-head">
                <div className="diary-mood-dot" style={{ background: entry.moodColor }} />
                <div className="diary-entry-mood">{entry.mood}</div>
                <div className="diary-entry-dot">·</div>
                <div className="diary-entry-weather">{entry.weather}</div>
                {entry.tag && <div className="diary-entry-tag">{entry.tag}</div>}
                <div style={{ flex: 1 }} />
                <div className="diary-entry-date">{entry.dateLabel}</div>
              </div>
              <div className="diary-entry-preview">{preview}</div>
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

  const entry = diaryEntries.find((e) => e.id === diaryDetailId);
  if (!entry) return null;

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
            <div className="diary-mood-dot" style={{ background: entry.moodColor }} />
            <div className="diary-entry-mood">{entry.mood}</div>
            <div className="diary-entry-dot">·</div>
            <div className="diary-entry-weather">{entry.weather}</div>
            {entry.tag && <div className="diary-entry-tag">{entry.tag}</div>}
          </div>
          <div className="diary-detail__excerpt">{entry.excerpt}</div>
        </div>
      </div>
      <div className="diary-detail__footer">
        <button className="diary-delete-btn" onClick={() => deleteDiaryEntry(entry.id)}>删除这篇日记</button>
      </div>
    </div>
  );
}
