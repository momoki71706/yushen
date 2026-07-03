import { useStore } from '../state/store';
import { EnvelopeOutlineIcon } from './Icons';

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4Z" fill="#8C6A72" />
    </svg>
  );
}

const MENU_ITEMS = [
  { label: '主题装扮', bg: '#EDD9E1' },
  { label: '纪念日管理', bg: '#D9CBD3' },
  { label: '通知提醒', bg: '#E7D6CE' },
  { label: '导出回忆', bg: '#C9B9BE' },
];

const START_DATE = new Date(2024, 7, 16);

function daysTogether() {
  return Math.floor((new Date() - START_DATE) / 86400000);
}

export default function Sidebar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const closeSidebar = useStore((s) => s.closeSidebar);
  const letterReminderEnabled = useStore((s) => s.letterReminderEnabled);
  const toggleLetterReminderSetting = useStore((s) => s.toggleLetterReminderSetting);
  const openAiSettings = useStore((s) => s.openAiSettings);

  if (!sidebarOpen) return null;

  return (
    <div className="sidebar-layer">
      <div className="sidebar-panel">
        <div className="sidebar-avatars">
          <div className="sidebar-avatar" style={{ background: '#C8899E' }}>晴</div>
          <svg width="16" height="14" viewBox="0 0 20 14" fill="none" style={{ margin: '0 -6px', position: 'relative', zIndex: 2 }}>
            <path d="M9 7L1 2V12L9 7Z" fill="#C08BA0" />
            <path d="M11 7L19 2V12L11 7Z" fill="#C08BA0" />
            <circle cx="10" cy="7" r="2.1" fill="#B87A90" />
          </svg>
          <div className="sidebar-avatar" style={{ background: '#D6C4CB' }}>深</div>
        </div>
        <div className="sidebar-days">在一起 {daysTogether()} 天</div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, marginBottom: 18 }}>
          <PixelCloud fill="#F6E2E8" />
          <PixelHeart />
          <PixelCloud fill="#D6C4CB" />
        </div>

        <div className="sidebar-divider" />
        {MENU_ITEMS.map((item) => (
          <button key={item.label} className="sidebar-menu-item">
            <div className="sidebar-menu-icon" style={{ background: item.bg }} />
            <div className="sidebar-menu-label">{item.label}</div>
            <ChevronRight />
          </button>
        ))}
        <button className="sidebar-menu-item" onClick={openAiSettings}>
          <div className="sidebar-menu-icon" style={{ background: '#D6C4CB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SparkIcon />
          </div>
          <div className="sidebar-menu-label">AI 接入设置</div>
          <ChevronRight />
        </button>
        <div className="sidebar-divider" style={{ margin: '4px 0 8px' }} />
        <div className="sidebar-reminder-row">
          <div className="sidebar-reminder-icon">
            <EnvelopeOutlineIcon color="#C08BA0" />
          </div>
          <div className="sidebar-menu-label">信件到期提醒</div>
          <button
            className="toggle-switch"
            style={{ background: letterReminderEnabled ? '#C8899E' : '#DCD4D8' }}
            onClick={toggleLetterReminderSetting}
          >
            <div className="toggle-switch__knob" style={{ left: letterReminderEnabled ? 20 : 2 }} />
          </button>
        </div>
      </div>
      <div className="sidebar-backdrop" onClick={closeSidebar} />
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1L6 6L1 11" stroke="#9B939A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PixelCloud({ fill }) {
  return (
    <svg width="12" height="7.2" viewBox="0 0 12 7.2" shapeRendering="crispEdges">
      <rect x="2.4" y="0" width="2.4" height="2.4" fill={fill} /><rect x="4.8" y="0" width="2.4" height="2.4" fill={fill} /><rect x="7.2" y="0" width="2.4" height="2.4" fill={fill} />
      <rect x="0" y="2.4" width="2.4" height="2.4" fill={fill} /><rect x="2.4" y="2.4" width="2.4" height="2.4" fill={fill} /><rect x="4.8" y="2.4" width="2.4" height="2.4" fill={fill} /><rect x="7.2" y="2.4" width="2.4" height="2.4" fill={fill} /><rect x="9.6" y="2.4" width="2.4" height="2.4" fill={fill} />
      <rect x="0" y="4.8" width="2.4" height="2.4" fill={fill} /><rect x="2.4" y="4.8" width="2.4" height="2.4" fill={fill} /><rect x="4.8" y="4.8" width="2.4" height="2.4" fill={fill} /><rect x="7.2" y="4.8" width="2.4" height="2.4" fill={fill} /><rect x="9.6" y="4.8" width="2.4" height="2.4" fill={fill} />
    </svg>
  );
}

function PixelHeart() {
  const fill = '#C8899E';
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" shapeRendering="crispEdges">
      <rect x="2" y="0" width="2" height="2" fill={fill} /><rect x="6" y="0" width="2" height="2" fill={fill} />
      <rect x="0" y="2" width="2" height="2" fill={fill} /><rect x="2" y="2" width="2" height="2" fill={fill} /><rect x="4" y="2" width="2" height="2" fill={fill} /><rect x="6" y="2" width="2" height="2" fill={fill} /><rect x="8" y="2" width="2" height="2" fill={fill} />
      <rect x="2" y="4" width="2" height="2" fill={fill} /><rect x="4" y="4" width="2" height="2" fill={fill} /><rect x="6" y="4" width="2" height="2" fill={fill} />
      <rect x="4" y="6" width="2" height="2" fill={fill} />
    </svg>
  );
}
