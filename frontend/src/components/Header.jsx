import { useStore } from '../state/store';
import { HamburgerIcon, HeartIcon } from './Icons';

const TITLE_MAP = { home: '首页', manage: '管理', calendar: '日历', play: '娱乐' };

export default function Header() {
  const activeTab = useStore((s) => s.activeTab);
  const homeMode = useStore((s) => s.homeMode);
  const nickname = useStore((s) => s.nickname);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const openFavorites = useStore((s) => s.openFavorites);

  const isHome = activeTab === 'home';
  const subtitleMap = {
    home: homeMode === 'chat' ? '和屿深' : homeMode === 'diary' ? '写给自己' : '时间信箱',
    manage: '一起变好',
    calendar: '我们的时间线',
    play: '一起做的小事',
  };

  return (
    <div className="phone__header">
      <div className="phone__header-row">
        <button className="icon-btn" onClick={toggleSidebar} aria-label="菜单">
          <HamburgerIcon />
        </button>

        {isHome ? (
          <div className="header-titles">
            <div className="header-titles__sub">{subtitleMap.home}</div>
            <div className="header-titles__main">{nickname}</div>
          </div>
        ) : (
          <div className="header-titles">
            <div className="header-titles__sub">{subtitleMap[activeTab]}</div>
            <div className="header-titles__main">{TITLE_MAP[activeTab]}</div>
          </div>
        )}

        <button className="icon-btn" onClick={openFavorites} aria-label="收藏">
          <HeartIcon />
        </button>
      </div>
    </div>
  );
}
