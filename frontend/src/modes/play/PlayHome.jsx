import { useState } from 'react';
import { useStore } from '../../state/store';

const GAME_TILES = ['情侣问答', '真心话冒险', '记忆翻牌', '心理测试'];

function ReadingGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 5c-2-1.5-5-2-8-1v14c3-1 6-0.5 8 1c2-1.5 5-2 8-1V4c-3-1-6-0.5-8 1Z" stroke="#C08BA0" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <path d="M12 5v14" stroke="#C08BA0" strokeWidth="1.5" />
    </svg>
  );
}

function MusicGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M9 18V5l11-2v13" stroke="#C08BA0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="6" cy="18" r="3" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
      <circle cx="17" cy="16" r="3" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
    </svg>
  );
}

function EnglishGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
      <path d="M2.5 12h19M12 2.5c2.5 2.6 2.5 16.4 0 19M12 2.5c-2.5 2.6-2.5 16.4 0 19" stroke="#C08BA0" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

function GamesGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="20" height="10" rx="5" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
      <path d="M7 11v4M5 13h4" stroke="#C08BA0" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="12" r="1" fill="#C08BA0" />
      <circle cx="18.5" cy="14.5" r="1" fill="#C08BA0" />
    </svg>
  );
}

function englishStreak(phrases, todayISO) {
  const dates = new Set(phrases.map((p) => p.date).filter(Boolean));
  if (!dates.size) return 0;
  let streak = 0;
  const cursor = new Date(todayISO);
  if (!dates.has(todayISO)) cursor.setDate(cursor.getDate() - 1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    if (!dates.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function PlayHome() {
  const books = useStore((s) => s.books);
  const musicList = useStore((s) => s.musicList);
  const englishPhrases = useStore((s) => s.englishPhrases);
  const openPlayView = useStore((s) => s.openPlayView);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const [toast, setToast] = useState('');

  const showToast = (label) => {
    setToast(`${label}敬请期待～`);
    setTimeout(() => setToast(''), 1800);
  };

  const readingNow = [...books].reverse().find((b) => b.status === '在读') || [...books].reverse()[0];
  const finishedCount = books.filter((b) => b.status === '读完').length;
  const musicNow = musicList[musicList.length - 1];
  const streak = englishStreak(englishPhrases, todayISOLocal());
  const latestPhrase = englishPhrases[englishPhrases.length - 1];

  return (
    <div className="mode-scroll-home">
      <div className="play-continue-row">
        <div className="play-continue-card">
          <div className="play-continue-label">最近在读</div>
          {readingNow ? (
            <>
              <div className="play-continue-cover" />
              <div className="play-continue-title">{readingNow.title}</div>
              <div className="play-continue-sub">{readingNow.author || readingNow.status}</div>
              <div className="play-continue-progress-track">
                <div className="play-continue-progress-fill" style={{ width: `${readingNow.progress || 0}%` }} />
              </div>
            </>
          ) : (
            <div className="play-continue-empty">还没有在读的书</div>
          )}
        </div>
        <div className="play-continue-card">
          <div className="play-continue-label">单曲循环</div>
          {musicNow ? (
            <>
              <div className="play-continue-cover" />
              <div className="play-continue-title">{musicNow.title}</div>
              <div className="play-continue-sub">{musicNow.artist || '未知歌手'}</div>
            </>
          ) : (
            <div className="play-continue-empty">还没有歌</div>
          )}
        </div>
      </div>

      <button className="play-rich-card" onClick={() => openPlayView('reading')}>
        <div className="play-rich-card-head">
          <ReadingGlyph />
          <div className="play-rich-card-title">读书</div>
        </div>
        {readingNow ? (
          <>
            <div className="play-rich-card-body">
              <div className="play-rich-cover" />
              <div className="play-rich-info">
                <div className="play-rich-info-title">{readingNow.title}</div>
                <div className="play-rich-info-sub">{readingNow.author || '未知作者'}</div>
                <div className="play-rich-progress-track">
                  <div className="play-rich-progress-fill" style={{ width: `${readingNow.progress || 0}%` }} />
                </div>
              </div>
            </div>
            <div className="play-rich-stat">已读完 <strong>{finishedCount}</strong> 本</div>
          </>
        ) : (
          <div className="play-rich-empty">还没有书，点进来加一本吧</div>
        )}
        <div className="play-rich-prompt">今天读了几页？</div>
      </button>

      <button className="play-rich-card" onClick={() => openPlayView('music')}>
        <div className="play-rich-card-head">
          <MusicGlyph />
          <div className="play-rich-card-title">音乐</div>
        </div>
        {musicNow ? (
          <div className="play-rich-card-body">
            <div className="play-rich-cover" />
            <div className="play-rich-info">
              <div className="play-rich-info-title">{musicNow.title}</div>
              <div className="play-rich-info-sub">{musicNow.artist || '未知歌手'}</div>
            </div>
          </div>
        ) : (
          <div className="play-rich-empty">还没有歌，点进来加一首吧</div>
        )}
        <div className="play-rich-prompt">今天的BGM是什么？</div>
      </button>

      <button className="play-rich-card" onClick={() => openPlayView('english')}>
        <div className="play-rich-card-head">
          <EnglishGlyph />
          <div className="play-rich-card-title">英语角</div>
        </div>
        <div className="play-rich-stat"><strong>{streak}</strong> 天连续打卡</div>
        {latestPhrase && <div className="play-rich-prompt">{latestPhrase.phrase}</div>}
      </button>

      <div className="play-rich-card" style={{ cursor: 'default' }}>
        <div className="play-rich-card-head">
          <GamesGlyph />
          <div className="play-rich-card-title">游戏</div>
        </div>
        <div className="play-games-grid">
          {GAME_TILES.map((g) => (
            <button key={g} className="play-game-tile" onClick={() => showToast(g)}>
              <div className="play-game-dot" />
              {g}
            </button>
          ))}
        </div>
        <div className="play-rich-prompt">无聊了就来玩</div>
      </div>

      {toast && <div className="play-toast">{toast}</div>}
    </div>
  );
}
