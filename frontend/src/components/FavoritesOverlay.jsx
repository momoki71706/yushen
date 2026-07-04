import { useStore } from '../state/store';
import { BackChevronIcon, SearchIcon, CalendarIcon, CloseIcon, HeartIcon } from './Icons';

const CATEGORY_LABELS = { chat: '聊天', diary: '日记', letter: '信', tip: '小贴士' };
const CATEGORIES = [
  { key: 'chat', label: '聊天' },
  { key: 'diary', label: '日记' },
  { key: 'letter', label: '信' },
  { key: 'tip', label: '小贴士' },
];
// A few blank glass placeholder tiles alongside the four real categories —
// more favorite categories are planned later, so the grid is built to not
// look sparse/unfinished with just four squares in it.
const PLACEHOLDER_COUNT = 4;

function timeLabelFor(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function FavoriteListCard({ item }) {
  const favoritesExpandedId = useStore((s) => s.favoritesExpandedId);
  const toggleFavoriteExpanded = useStore((s) => s.toggleFavoriteExpanded);
  const favoritesDeleteConfirmId = useStore((s) => s.favoritesDeleteConfirmId);
  const requestUnfavorite = useStore((s) => s.requestUnfavorite);
  const cancelUnfavorite = useStore((s) => s.cancelUnfavorite);
  const confirmUnfavorite = useStore((s) => s.confirmUnfavorite);

  const expanded = favoritesExpandedId === item.id;
  const confirming = favoritesDeleteConfirmId === item.id;

  return (
    <div className="favorites-card">
      <button className="favorites-card-head" onClick={() => toggleFavoriteExpanded(item.id)}>
        <div className="favorites-card-title">{item.title}</div>
        <div className="favorites-card-time">{timeLabelFor(item.sourceTime)}</div>
      </button>
      {expanded && <div className="favorites-card-body">{item.snippet}</div>}
      {confirming ? (
        <div className="favorites-card-delete-confirm">
          <span>取消收藏？</span>
          <button className="ledger-category-delete-cancel" onClick={cancelUnfavorite}>取消</button>
          <button className="ledger-category-delete-danger" onClick={confirmUnfavorite}>确定</button>
        </div>
      ) : (
        <button className="favorites-card-heart" onClick={() => requestUnfavorite(item.id)}>
          <HeartIcon filled width={16} height={14} />
        </button>
      )}
    </div>
  );
}

function FavoritesHome({ onClose }) {
  const favoritesHomeSearch = useStore((s) => s.favoritesHomeSearch);
  const onFavoritesHomeSearchChange = useStore((s) => s.onFavoritesHomeSearchChange);
  const favoritesHomeResults = useStore((s) => s.favoritesHomeResults);
  const favoritesCounts = useStore((s) => s.favoritesCounts);
  const openFavoritesCategory = useStore((s) => s.openFavoritesCategory);

  const isSearching = favoritesHomeSearch.trim().length > 0;

  return (
    <div className="favorites-page">
      <div className="favorites-body">
        <div className="favorites-floating-head">
          <div className="pill-back">
            <button className="circle-back-btn" onClick={onClose}>
              <BackChevronIcon />
            </button>
          </div>
          <div className="favorites-search-row">
            <SearchIcon />
            <input
              className="favorites-search-input"
              value={favoritesHomeSearch}
              onChange={(e) => onFavoritesHomeSearchChange(e.target.value)}
              placeholder="搜索全部收藏…"
            />
          </div>
        </div>
        {isSearching ? (
          <div className="favorites-list">
            {favoritesHomeResults.length === 0 ? (
              <div className="favorites-empty">没有找到相关收藏</div>
            ) : (
              favoritesHomeResults.map((item) => <FavoriteListCard key={item.id} item={item} />)
            )}
          </div>
        ) : (
          <div className="favorites-grid">
            {CATEGORIES.map((c) => (
              <button key={c.key} className="favorites-grid-tile" onClick={() => openFavoritesCategory(c.key)}>
                <div className="favorites-grid-tile-label">{c.label}</div>
                <div className="favorites-grid-tile-count">{favoritesCounts[c.key] || 0}</div>
              </button>
            ))}
            {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
              <div key={`placeholder-${i}`} className="favorites-grid-tile favorites-grid-tile--placeholder" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FavoritesCategory({ onBack }) {
  const favoritesCategory = useStore((s) => s.favoritesCategory);
  const favoritesCategorySearch = useStore((s) => s.favoritesCategorySearch);
  const onFavoritesCategorySearchChange = useStore((s) => s.onFavoritesCategorySearchChange);
  const favoritesCategoryDate = useStore((s) => s.favoritesCategoryDate);
  const onFavoritesCategoryDateChange = useStore((s) => s.onFavoritesCategoryDateChange);
  const clearFavoritesCategoryDate = useStore((s) => s.clearFavoritesCategoryDate);
  const favoritesList = useStore((s) => s.favoritesList);

  return (
    <div className="favorites-page">
      <div className="favorites-body">
        <div className="favorites-floating-head">
          <div className="pill-back">
            <button className="circle-back-btn" onClick={onBack}>
              <BackChevronIcon />
            </button>
            <div className="pill-back-title">{CATEGORY_LABELS[favoritesCategory]}收藏</div>
          </div>
          <div className="favorites-head-row">
            <div className="favorites-search-row" style={{ flex: 1 }}>
              <SearchIcon />
              <input
                className="favorites-search-input"
                value={favoritesCategorySearch}
                onChange={(e) => onFavoritesCategorySearchChange(e.target.value)}
                placeholder="搜索这个分类…"
              />
            </div>
            <label className="favorites-date-btn">
              <CalendarIcon />
              <input
                type="date"
                className="favorites-date-input-native"
                value={favoritesCategoryDate}
                onChange={(e) => onFavoritesCategoryDateChange(e.target.value)}
              />
            </label>
            {favoritesCategoryDate && (
              <button className="favorites-date-clear" onClick={clearFavoritesCategoryDate}>
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
        {favoritesList.length === 0 ? (
          <div className="favorites-empty">还没有收藏</div>
        ) : (
          <div className="favorites-list">
            {favoritesList.map((item) => (
              <FavoriteListCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Mounted once at the App root (see App.jsx) — the top-right heart in
// Header opens this as a full-screen overlay over everything, including
// the app's usual top bar, since the favorites browser has its own
// floating back+search header at the very top instead.
export default function FavoritesOverlay() {
  const favoritesOpen = useStore((s) => s.favoritesOpen);
  const favoritesView = useStore((s) => s.favoritesView);
  const closeFavorites = useStore((s) => s.closeFavorites);
  const closeFavoritesCategory = useStore((s) => s.closeFavoritesCategory);

  if (!favoritesOpen) return null;

  return (
    <div className="favorites-overlay">
      {favoritesView === 'category' ? (
        <FavoritesCategory onBack={closeFavoritesCategory} />
      ) : (
        <FavoritesHome onClose={closeFavorites} />
      )}
    </div>
  );
}
