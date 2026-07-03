import { useStore } from '../state/store';

const MODES = [
  { key: 'chat', label: '聊天' },
  { key: 'diary', label: '日记' },
  { key: 'letter', label: '写信' },
];

export default function ModePill() {
  const homeMode = useStore((s) => s.homeMode);
  const setHomeMode = useStore((s) => s.setHomeMode);

  return (
    <div className="mode-pill">
      {MODES.map((m) => {
        const active = homeMode === m.key;
        return (
          <button
            key={m.key}
            className="mode-pill__btn"
            onClick={() => setHomeMode(m.key)}
            style={{
              background: active ? '#fff' : 'transparent',
              color: active ? '#5C4A54' : '#6B6268',
              boxShadow: active ? '0 1px 4px rgba(58,50,54,0.1)' : 'none',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
