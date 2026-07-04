import { useStore } from '../../state/store';

function CardChevron() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1L6 6L1 11" stroke="#B9AFB5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReadingGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M12 5c-2-1.5-5-2-8-1v14c3-1 6-0.5 8 1c2-1.5 5-2 8-1V4c-3-1-6-0.5-8 1Z" stroke="#C08BA0" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <path d="M12 5v14" stroke="#C08BA0" strokeWidth="1.5" />
    </svg>
  );
}

function MusicGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M9 18V5l11-2v13" stroke="#C08BA0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="6" cy="18" r="3" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
      <circle cx="17" cy="16" r="3" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
    </svg>
  );
}

function EnglishGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
      <path d="M2.5 12h19M12 2.5c2.5 2.6 2.5 16.4 0 19M12 2.5c-2.5 2.6-2.5 16.4 0 19" stroke="#C08BA0" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

function GamesGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="20" height="10" rx="5" stroke="#C08BA0" strokeWidth="1.7" fill="none" />
      <path d="M7 11v4M5 13h4" stroke="#C08BA0" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="12" r="1" fill="#C08BA0" />
      <circle cx="18.5" cy="14.5" r="1" fill="#C08BA0" />
    </svg>
  );
}

function CardHead({ icon, title }) {
  return (
    <div className="manage-card__head">
      <div className="manage-card__head-left">
        <div className="manage-card__icon">{icon}</div>
        <div className="manage-card__title">{title}</div>
      </div>
      <CardChevron />
    </div>
  );
}

export default function PlayHome() {
  const books = useStore((s) => s.books);
  const musicList = useStore((s) => s.musicList);
  const englishPhrases = useStore((s) => s.englishPhrases);
  const games = useStore((s) => s.games);
  const openPlayView = useStore((s) => s.openPlayView);

  const reading = books.filter((b) => b.status === '在读').length;

  return (
    <div className="manage-home">
      <button className="manage-card manage-card--clickable" onClick={() => openPlayView('reading')}>
        <CardHead icon={<ReadingGlyph />} title="读书" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{books.length}</div>
            <div className="manage-card__stat-label">{reading > 0 ? `在读 ${reading} 本` : '书单条数'}</div>
          </div>
        </div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={() => openPlayView('music')}>
        <CardHead icon={<MusicGlyph />} title="音乐" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{musicList.length}</div>
            <div className="manage-card__stat-label">歌单条数</div>
          </div>
        </div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={() => openPlayView('english')}>
        <CardHead icon={<EnglishGlyph />} title="英语角" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{englishPhrases.length}</div>
            <div className="manage-card__stat-label">收录短语</div>
          </div>
        </div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={() => openPlayView('games')}>
        <CardHead icon={<GamesGlyph />} title="游戏" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{games.length}</div>
            <div className="manage-card__stat-label">记录条数</div>
          </div>
        </div>
      </button>
    </div>
  );
}
