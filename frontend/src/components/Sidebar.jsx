import { useStore } from '../state/store';
import { API_BASE_URL } from '../api/client';
import { EnvelopeOutlineIcon, PencilIcon, CheckIcon, TrashIcon } from './Icons';

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4Z" fill="#8C6A72" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M11 1L15 5L12.5 7.5L8.5 3.5L11 1Z" stroke="#8C6A72" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <path d="M8.5 3.5L2 10C1.4 10.6 1.4 11.5 2 12S3.4 12.6 4 12L10.5 5.5" stroke="#8C6A72" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <circle cx="3" cy="13" r="1.5" fill="#8C6A72" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 1.5H10L13 4.5V14.5H3V1.5Z" stroke="#8C6A72" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <path d="M10 1.5V4.5H13" stroke="#8C6A72" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <path d="M5.5 8H10.5M5.5 10.5H10.5" stroke="#8C6A72" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 1.5C4.3 1.5 3 2.8 3 4.3C1.9 4.6 1 5.6 1 6.9C1 7.8 1.4 8.5 2 9C1.6 9.5 1.4 10.1 1.4 10.8C1.4 12.2 2.5 13.4 4 13.5C4.2 14.4 5 15 6 15C7 15 7.8 14.3 8 13.4"
        stroke="#8C6A72"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M10 1.5C11.7 1.5 13 2.8 13 4.3C14.1 4.6 15 5.6 15 6.9C15 7.8 14.6 8.5 14 9C14.4 9.5 14.6 10.1 14.6 10.8C14.6 12.2 13.5 13.4 12 13.5C11.8 14.4 11 15 10 15C9 15 8.2 14.3 8 13.4"
        stroke="#8C6A72"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M8 2V13.4" stroke="#8C6A72" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1C6 1 4.5 2.6 4.5 4.6V7.2C4.5 8.1 4.1 9 3.4 9.6L2.5 10.4C2.1 10.7 2.3 11.4 2.8 11.4H13.2C13.7 11.4 13.9 10.7 13.5 10.4L12.6 9.6C11.9 9 11.5 8.1 11.5 7.2V4.6C11.5 2.6 10 1 8 1Z"
        stroke="#8C6A72"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M6.3 13.2C6.6 14 7.2 14.5 8 14.5C8.8 14.5 9.4 14 9.7 13.2" stroke="#8C6A72" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function WatchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="4.5" y="4.5" width="7" height="7" rx="2" stroke="#8C6A72" strokeWidth="1.2" fill="none" />
      <path d="M6 1.5h4M6 14.5h4" stroke="#8C6A72" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 6.3v2l1.3 1" stroke="#8C6A72" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5V10.5M8 10.5L4.5 7M8 10.5L11.5 7" stroke="#8C6A72" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M2 12.5V13.5C2 14.05 2.45 14.5 3 14.5H13C13.55 14.5 14 14.05 14 13.5V12.5" stroke="#8C6A72" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ContextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2.5" width="12" height="3" rx="1" stroke="#8C6A72" strokeWidth="1.2" />
      <rect x="2" y="7" width="12" height="3" rx="1" stroke="#8C6A72" strokeWidth="1.2" />
      <rect x="2" y="11.5" width="8" height="3" rx="1" stroke="#8C6A72" strokeWidth="1.2" />
    </svg>
  );
}

const MENU_ITEMS = [
  { label: '主题装扮', bg: '#EDD9E1' },
  { label: '纪念日管理', bg: '#D9CBD3' },
  { label: '通知提醒', bg: '#E7D6CE' },
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
  const pushEnabled = useStore((s) => s.pushEnabled);
  const openPushSettings = useStore((s) => s.openPushSettings);
  const openHealthDataPanel = useStore((s) => s.openHealthDataPanel);
  const openContextPanel = useStore((s) => s.openContextPanel);
  const openMemoryPanel = useStore((s) => s.openMemoryPanel);
  const openAiSettings = useStore((s) => s.openAiSettings);
  const openMcpPanel = useStore((s) => s.openMcpPanel);
  const openPresetPanel = useStore((s) => s.openPresetPanel);
  const openClearChatConfirm = useStore((s) => s.openClearChatConfirm);
  const exportBusy = useStore((s) => s.exportBusy);
  const exportMessage = useStore((s) => s.exportMessage);
  const exportMemoriesAction = useStore((s) => s.exportMemoriesAction);
  const exportLastMemoriesAction = useStore((s) => s.exportLastMemoriesAction);
  const exportChooserOpen = useStore((s) => s.exportChooserOpen);
  const openExportChooser = useStore((s) => s.openExportChooser);
  const closeExportChooser = useStore((s) => s.closeExportChooser);
  const nickname = useStore((s) => s.nickname);
  const nicknameEditing = useStore((s) => s.nicknameEditing);
  const nicknameDraft = useStore((s) => s.nicknameDraft);
  const startEditNickname = useStore((s) => s.startEditNickname);
  const onNicknameChange = useStore((s) => s.onNicknameChange);
  const saveNickname = useStore((s) => s.saveNickname);
  const diaryTriggerBusy = useStore((s) => s.diaryTriggerBusy);
  const diaryTriggerMessage = useStore((s) => s.diaryTriggerMessage);
  const triggerDiaryWriteAction = useStore((s) => s.triggerDiaryWriteAction);
  const letterTriggerBusy = useStore((s) => s.letterTriggerBusy);
  const letterTriggerMessage = useStore((s) => s.letterTriggerMessage);
  const triggerLetterWriteAction = useStore((s) => s.triggerLetterWriteAction);

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
        <button className="sidebar-menu-item" onClick={openMemoryPanel}>
          <div className="sidebar-menu-icon" style={{ background: '#D9CBD3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BrainIcon />
          </div>
          <div className="sidebar-menu-label">记忆库</div>
          <ChevronRight />
        </button>
        {nicknameEditing ? (
          <div className="sidebar-menu-item" style={{ cursor: 'default' }}>
            <div className="sidebar-menu-icon" style={{ background: '#EDD9E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PencilIcon />
            </div>
            <input
              className="nickname-input"
              style={{ flex: 1, textAlign: 'left', fontSize: 15 }}
              value={nicknameDraft}
              onChange={(e) => onNicknameChange(e.target.value)}
              onBlur={saveNickname}
              onKeyDown={(e) => e.key === 'Enter' && saveNickname()}
              autoFocus
            />
            <button className="nickname-icon-btn nickname-icon-btn--confirm" onClick={saveNickname}>
              <CheckIcon />
            </button>
          </div>
        ) : (
          <button className="sidebar-menu-item" onClick={startEditNickname}>
            <div className="sidebar-menu-icon" style={{ background: '#EDD9E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PencilIcon />
            </div>
            <div className="sidebar-menu-label">备注名 · {nickname}</div>
            <ChevronRight />
          </button>
        )}
        {MENU_ITEMS.map((item) => (
          <button key={item.label} className="sidebar-menu-item">
            <div className="sidebar-menu-icon" style={{ background: item.bg }} />
            <div className="sidebar-menu-label">{item.label}</div>
            <ChevronRight />
          </button>
        ))}
        <button className="sidebar-menu-item" onClick={openExportChooser} disabled={exportBusy}>
          <div className="sidebar-menu-icon" style={{ background: '#C9B9BE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DownloadIcon />
          </div>
          <div className="sidebar-menu-label">{exportBusy ? '导出中…' : '导出回忆'}</div>
          <ChevronRight />
        </button>
        {exportChooserOpen && (
          <div className="export-chooser">
            <button className="export-chooser-option" onClick={exportMemoriesAction}>导出本次回忆</button>
            <button className="export-chooser-option" onClick={exportLastMemoriesAction}>导出上次回忆</button>
            <a
              className="export-chooser-option"
              href={`${API_BASE_URL}/backup/download`}
              onClick={closeExportChooser}
              style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}
            >
              下载完整数据备份
            </a>
            <button className="export-chooser-cancel" onClick={closeExportChooser}>取消</button>
          </div>
        )}
        {exportMessage && <div className="sidebar-error-text" style={{ color: 'var(--color-text-faint)' }}>{exportMessage}</div>}
        <button className="sidebar-menu-item" onClick={openAiSettings}>
          <div className="sidebar-menu-icon" style={{ background: '#D6C4CB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SparkIcon />
          </div>
          <div className="sidebar-menu-label">AI 接入设置</div>
          <ChevronRight />
        </button>
        <button className="sidebar-menu-item" onClick={openMcpPanel}>
          <div className="sidebar-menu-icon" style={{ background: '#C9B9BE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ToolIcon />
          </div>
          <div className="sidebar-menu-label">工具管理</div>
          <ChevronRight />
        </button>
        <button className="sidebar-menu-item" onClick={openPresetPanel}>
          <div className="sidebar-menu-icon" style={{ background: '#E7D6CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NoteIcon />
          </div>
          <div className="sidebar-menu-label">预设词</div>
          <ChevronRight />
        </button>
        <button className="sidebar-menu-item" onClick={openContextPanel}>
          <div className="sidebar-menu-icon" style={{ background: '#D6C4CB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ContextIcon />
          </div>
          <div className="sidebar-menu-label">上下文</div>
          <ChevronRight />
        </button>
        <button className="sidebar-menu-item" onClick={openPushSettings}>
          <div className="sidebar-menu-icon" style={{ background: '#F1E0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BellIcon />
          </div>
          <div className="sidebar-menu-label">消息推送 · {pushEnabled ? '已开启' : '已关闭'}</div>
          <ChevronRight />
        </button>
        <button className="sidebar-menu-item" onClick={openHealthDataPanel}>
          <div className="sidebar-menu-icon" style={{ background: '#E7D6CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WatchIcon />
          </div>
          <div className="sidebar-menu-label">健康数据接入</div>
          <ChevronRight />
        </button>
        <button className="sidebar-menu-item" onClick={openClearChatConfirm}>
          <div className="sidebar-menu-icon" style={{ background: '#E3C7CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrashIcon />
          </div>
          <div className="sidebar-menu-label">清空聊天记录</div>
          <ChevronRight />
        </button>
        <div className="sidebar-divider" style={{ margin: '4px 0 8px' }} />
        <button className="sidebar-menu-item" onClick={triggerDiaryWriteAction} disabled={diaryTriggerBusy}>
          <div className="sidebar-menu-icon" style={{ background: '#D9CBD3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NoteIcon />
          </div>
          <div className="sidebar-menu-label">{diaryTriggerBusy ? '让他写日记中…' : '让他现在写篇日记'}</div>
          <ChevronRight />
        </button>
        <button className="sidebar-menu-item" onClick={triggerLetterWriteAction} disabled={letterTriggerBusy}>
          <div className="sidebar-menu-icon" style={{ background: '#F1E0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EnvelopeOutlineIcon color="#8C6A72" />
          </div>
          <div className="sidebar-menu-label">{letterTriggerBusy ? '让他写信中…' : '让他现在给我写信'}</div>
          <ChevronRight />
        </button>
        {(diaryTriggerMessage || letterTriggerMessage) && (
          <div className="sidebar-error-text" style={{ color: 'var(--color-text-faint)' }}>
            {diaryTriggerMessage}
            {diaryTriggerMessage && letterTriggerMessage && ' · '}
            {letterTriggerMessage}
          </div>
        )}
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
