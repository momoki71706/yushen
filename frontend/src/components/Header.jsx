import { useStore } from '../state/store';
import { HamburgerIcon, HeartIcon, PencilIcon, CheckIcon } from './Icons';

const TITLE_MAP = { home: '首页', manage: '管理', calendar: '日历', play: '娱乐' };

export default function Header() {
  const activeTab = useStore((s) => s.activeTab);
  const homeMode = useStore((s) => s.homeMode);
  const nickname = useStore((s) => s.nickname);
  const nicknameEditing = useStore((s) => s.nicknameEditing);
  const nicknameDraft = useStore((s) => s.nicknameDraft);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const startEditNickname = useStore((s) => s.startEditNickname);
  const onNicknameChange = useStore((s) => s.onNicknameChange);
  const saveNickname = useStore((s) => s.saveNickname);

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
          <div className="nickname-row">
            {nicknameEditing ? (
              <>
                <div className="nickname-spacer" />
                <input
                  className="nickname-input"
                  value={nicknameDraft}
                  onChange={(e) => onNicknameChange(e.target.value)}
                  onBlur={saveNickname}
                  onKeyDown={(e) => e.key === 'Enter' && saveNickname()}
                  autoFocus
                />
                <button className="nickname-icon-btn nickname-icon-btn--confirm" onClick={saveNickname}>
                  <CheckIcon />
                </button>
              </>
            ) : (
              <>
                <div className="nickname-spacer" />
                <div className="nickname-text">{nickname}</div>
                <button className="nickname-icon-btn" onClick={startEditNickname}>
                  <PencilIcon />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="header-titles">
            <div className="header-titles__sub">{subtitleMap[activeTab]}</div>
            <div className="header-titles__main">{TITLE_MAP[activeTab]}</div>
          </div>
        )}

        <div className="icon-btn">
          <HeartIcon />
        </div>
      </div>
    </div>
  );
}
