import { useStore } from '../state/store';
import { HeartIcon } from './Icons';

// Reused on every chat bubble, diary entry, letter, and AI management-card
// tip — a single toggle button whose filled state comes straight from the
// shared favoritedKeys set (see store.js), so it stays in sync no matter
// which content type it's rendered against.
export default function FavoriteHeart({ type, sourceId, title, snippet, sourceTime, size = 16, className = '', style }) {
  const favorited = useStore((s) => s.isFavorited(type, String(sourceId)));
  const toggleFavoriteFromContent = useStore((s) => s.toggleFavoriteFromContent);

  return (
    <button
      className={`favorite-heart-btn ${className}`.trim()}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavoriteFromContent({ type, sourceId: String(sourceId), title, snippet, sourceTime });
      }}
    >
      <HeartIcon filled={favorited} width={size} height={Math.round(size * 0.88)} />
    </button>
  );
}
