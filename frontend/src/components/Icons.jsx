export function HamburgerIcon() {
  return (
    <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
      <path d="M1 1H16" stroke="#B87A90" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M1 6.5H16" stroke="#B87A90" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M1 12H16" stroke="#B87A90" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg width="17" height="15" viewBox="0 0 18 16" fill="none">
      <path d="M9 15C9 15 1 10.5 1 5.2C1 2.6 3 1 5.2 1C6.9 1 8.3 2 9 3.3C9.7 2 11.1 1 12.8 1C15 1 17 2.6 17 5.2C17 10.5 9 15 9 15Z" fill="#C8899E" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 1.5L12.5 4.5L4.5 12.5H1.5V9.5L9.5 1.5Z" stroke="#C08BA0" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function CheckIcon({ color = '#C08BA0', width = 12, height = 10 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RefreshIcon({ color = '#9B939A', width = 12, height = 12 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 14 14" fill="none">
      <path
        d="M12.5 7A5.5 5.5 0 1 1 10.6 3M12.5 7V2.5M12.5 7H8"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function ChevronDownIcon({ color = '#9B939A', width = 12, height = 12, expanded = false }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 14 14"
      fill="none"
      style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
    >
      <path d="M3 5.5L7 9.5L11 5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BowIcon({ color = '#C08BA0' }) {
  return (
    <svg width="18" height="13" viewBox="0 0 20 14" fill="none">
      <path d="M9 7L1 2V12L9 7Z" fill={color} />
      <path d="M11 7L19 2V12L11 7Z" fill={color} />
      <circle cx="10" cy="7" r="2.1" fill="#B87A90" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4Z" fill="#8C7A82" />
    </svg>
  );
}

export function PlusIcon({ color = '#C08BA0', width = 14, height = 14 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1V14M1 7.5H14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PhotoIcon() {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
      <rect x="1" y="4" width="24" height="17" rx="3" stroke="#C08BA0" strokeWidth="1.8" />
      <path d="M8 4L10 1H16L18 4" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="12.5" r="5" stroke="#C08BA0" strokeWidth="1.8" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="5" stroke="#8C7A82" strokeWidth="1.5" />
      <path d="M9.6 9.6L13 13" stroke="#8C7A82" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="16" height="15" viewBox="0 0 15 14" fill="none">
      <rect x="0.5" y="2.5" width="14" height="11" rx="2" stroke="#8C7A82" strokeWidth="1.3" />
      <path d="M0.5 6H14.5" stroke="#8C7A82" strokeWidth="1.3" />
      <path d="M4 0.5V3.5M11 0.5V3.5" stroke="#8C7A82" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function BackChevronIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
      <path d="M7 1L1 6.5L7 12" stroke="#8C7A82" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EnvelopeIcon({ fill = '#F6E2E8', stroke = '#C08BA0' }) {
  return (
    <svg width="28" height="21" viewBox="0 0 28 21" fill="none">
      <rect x="1" y="1" width="26" height="19" rx="4" fill={fill} />
      <path d="M2 3l12 9 12-9" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function EnvelopeOutlineIcon({ color = '#6B6268' }) {
  return (
    <svg width="14" height="11" viewBox="0 0 15 12" fill="none">
      <rect x="0.5" y="0.5" width="14" height="11" rx="2" stroke={color} strokeWidth="1.3" />
      <path d="M1 1.5L7.5 6.5L14 1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function EnvelopeBigIcon() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" fill="none">
      <rect x="1" y="1" width="24" height="18" rx="4" fill="#F1E0E8" />
      <path d="M2 3l11 8 11-8" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M1 1L10 10M10 1L1 10" stroke="#6B6268" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ color = '#8C6A72', width = 14, height = 14 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <path d="M2.5 4H13.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 4V2.5H10V4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4L4.2 13.5H11.8L12.5 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M6.5 6.5V11M9.5 6.5V11" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon({ color = '#9B939A' }) {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1L6 6L1 11" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoodIcon({ mood }) {
  const c = '#8C7A82';
  const w = 1.5;
  switch (mood) {
    case '开心':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke={c} strokeWidth={w} />
          <circle cx="9.5" cy="12" r="1.3" fill={c} />
          <circle cx="18.5" cy="12" r="1.3" fill={c} />
          <path d="M9 17Q14 21 19 17" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
        </svg>
      );
    case '平静':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke={c} strokeWidth={w} />
          <path d="M7.5 12H11.5" stroke={c} strokeWidth={w} strokeLinecap="round" />
          <path d="M16.5 12H20.5" stroke={c} strokeWidth={w} strokeLinecap="round" />
          <path d="M10 18H18" stroke={c} strokeWidth={w} strokeLinecap="round" />
        </svg>
      );
    case '难过':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke={c} strokeWidth={w} />
          <circle cx="9.5" cy="12.5" r="1.3" fill={c} />
          <circle cx="18.5" cy="12.5" r="1.3" fill={c} />
          <path d="M9 19Q14 15 19 19" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
        </svg>
      );
    case '兴奋':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke={c} strokeWidth={w} />
          <path d="M8 13L9.5 11L11 13" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M17 13L18.5 11L20 13" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <ellipse cx="14" cy="18.5" rx="3" ry="2.2" fill={c} />
        </svg>
      );
    case '疲惫':
    default:
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke={c} strokeWidth={w} />
          <path d="M7.5 13Q9.5 15 11.5 13" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
          <path d="M16.5 13Q18.5 15 20.5 13" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
          <path d="M11 18.5H17" stroke={c} strokeWidth={w} strokeLinecap="round" />
        </svg>
      );
  }
}

export function WeatherIcon({ weather }) {
  const c = '#8C7A82';
  const w = 1.5;
  switch (weather) {
    case '晴':
      return (
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="5" stroke={c} strokeWidth={w} />
          <path d="M14 3V6.5M14 21.5V25M25 14H21.5M6.5 14H3M21.5 6.5L19 9M9 19L6.5 21.5M21.5 21.5L19 19M9 9L6.5 6.5" stroke={c} strokeWidth={w} strokeLinecap="round" />
        </svg>
      );
    case '多云':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <path d="M7 20a4.2 4.2 0 01-.5-8.36A5.8 5.8 0 0118 9.8a4.7 4.7 0 013.6 7.8A4.2 4.2 0 0121 20H7z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
        </svg>
      );
    case '雨':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <path d="M7 17a4.2 4.2 0 01-.5-8.36A5.8 5.8 0 0118 6.8a4.7 4.7 0 013.6 7.8A4.2 4.2 0 0121 17H7z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
          <path d="M11 20L10 24M15 20L14 24M19 20L18 24" stroke={c} strokeWidth={w} strokeLinecap="round" />
        </svg>
      );
    case '雪':
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <path d="M7 17a4.2 4.2 0 01-.5-8.36A5.8 5.8 0 0118 6.8a4.7 4.7 0 013.6 7.8A4.2 4.2 0 0121 17H7z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
          <path d="M10.5 20.5V24.5M8.5 22.5H12.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M18.5 20.5V24.5M16.5 22.5H20.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case '风':
    default:
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <path d="M4 10H17.5A2.5 2.5 0 1015.5 6.3" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
          <path d="M4 15H21A2.5 2.5 0 1118.5 18.7" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
          <path d="M4 20H13" stroke={c} strokeWidth={w} strokeLinecap="round" />
        </svg>
      );
  }
}

export function NavHomeIcon({ color }) {
  return (
    <svg width="20" height="19" viewBox="0 0 20 19" fill="none">
      <path d="M2 9L10 2L18 9V17H12V11H8V17H2V9Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function NavManageIcon({ color }) {
  return (
    <svg width="20" height="19" viewBox="0 0 20 19" fill="none">
      <rect x="2" y="9" width="4" height="8" rx="1.2" stroke={color} strokeWidth="1.7" />
      <rect x="8" y="4" width="4" height="13" rx="1.2" stroke={color} strokeWidth="1.7" />
      <rect x="14" y="12" width="4" height="5" rx="1.2" stroke={color} strokeWidth="1.7" />
    </svg>
  );
}

export function NavCalendarIcon({ color }) {
  return (
    <svg width="20" height="19" viewBox="0 0 20 19" fill="none">
      <rect x="1.5" y="4" width="17" height="14" rx="2.5" stroke={color} strokeWidth="1.7" />
      <path d="M1.5 8.5H18.5" stroke={color} strokeWidth="1.7" />
      <path d="M6 1.5V5.5M14 1.5V5.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function NavPlayIcon({ color }) {
  return (
    <svg width="19" height="19" viewBox="0 0 19 19" fill="none">
      <circle cx="9.5" cy="9.5" r="8.3" stroke={color} strokeWidth="1.7" />
      <path d="M7.7 6.3L13 9.5L7.7 12.7V6.3Z" fill={color} />
    </svg>
  );
}
