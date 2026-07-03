import { NavManageIcon, NavCalendarIcon, NavPlayIcon } from './Icons';

const CONFIG = {
  manage: { Icon: NavManageIcon, title: '管理', desc: '记账、习惯追踪、手表监测、屏幕时间\n敬请期待～' },
  calendar: { Icon: NavCalendarIcon, title: '日历', desc: '整合月经、亲密、锻炼、倒数日、恋爱大事件\n敬请期待～' },
  play: { Icon: NavPlayIcon, title: '娱乐', desc: '读书、音乐、英语角、游戏\n敬请期待～' },
};

export default function PlaceholderTab({ tab }) {
  const { Icon, title, desc } = CONFIG[tab];
  return (
    <div className="placeholder-tab">
      <div className="placeholder-tab__icon">
        <Icon color="#C4879E" />
      </div>
      <div className="placeholder-tab__title">{title}</div>
      <div className="placeholder-tab__desc">
        {desc.split('\n').map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
