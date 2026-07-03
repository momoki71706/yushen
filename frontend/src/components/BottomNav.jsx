import { useStore } from '../state/store';
import { NavHomeIcon, NavManageIcon, NavCalendarIcon, NavPlayIcon } from './Icons';

const ACTIVE = '#C4879E';
const INACTIVE = '#847A80';

const TABS = [
  { key: 'home', label: '首页', Icon: NavHomeIcon },
  { key: 'manage', label: '管理', Icon: NavManageIcon },
  { key: 'calendar', label: '日历', Icon: NavCalendarIcon },
  { key: 'play', label: '娱乐', Icon: NavPlayIcon },
];

export default function BottomNav() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  return (
    <div className="bottom-nav">
      {TABS.map(({ key, label, Icon }) => {
        const active = activeTab === key;
        const color = active ? ACTIVE : INACTIVE;
        return (
          <button key={key} className="bottom-nav__btn" onClick={() => setActiveTab(key)}>
            <Icon color={color} />
            <div className="bottom-nav__label" style={{ color, fontWeight: active ? 700 : 500 }}>
              {label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
