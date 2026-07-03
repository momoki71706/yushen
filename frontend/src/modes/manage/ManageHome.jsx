import { useStore } from '../../state/store';
import { mockWatchDay, mockScreenApps } from './mock';

function LedgerGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="4" height="10" rx="1.5" fill="#C08BA0" />
      <rect x="10" y="5" width="4" height="15" rx="1.5" fill="#C08BA0" />
      <rect x="16" y="13" width="4" height="7" rx="1.5" fill="#C08BA0" />
    </svg>
  );
}

function HabitGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#C08BA0" strokeWidth="1.8" fill="none" />
      <path d="M8 12.5L10.5 15L16 9" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function WatchGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="7" y="7" width="10" height="10" rx="3" stroke="#C08BA0" strokeWidth="1.6" fill="none" />
      <path d="M9 4h6M9 20h6" stroke="#C08BA0" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 10v3l2 1.5" stroke="#C08BA0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScreenGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="7" y="2" width="10" height="20" rx="2.5" stroke="#C08BA0" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="3.4" stroke="#C08BA0" strokeWidth="1.3" fill="none" />
      <path d="M12 10.3v1.9l1.2 0.9" stroke="#C08BA0" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function CardChevron() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1L6 6L1 11" stroke="#B9AFB5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardHead({ icon, title }) {
  return (
    <div className="manage-card__head">
      <div className="manage-card__head-left">
        <div className="manage-card__icon">{icon}</div>
        <div className="manage-card__title">{title}</div>
      </div>
      <CardChevron />
    </div>
  );
}

export default function ManageHome() {
  const ledgerEntries = useStore((s) => s.ledgerEntries);
  const habits = useStore((s) => s.habits);
  const categoryColor = useStore((s) => s.categoryColor);
  const todayISOLocal = useStore((s) => s.todayISOLocal);
  const ledgerCardMessage = useStore((s) => s.ledgerCardMessage);
  const habitCardMessage = useStore((s) => s.habitCardMessage);
  const openLedger = useStore((s) => s.openLedger);
  const openHabits = useStore((s) => s.openHabits);
  const openWatch = useStore((s) => s.openWatch);
  const openScreentime = useStore((s) => s.openScreentime);
  const watchConnected = useStore((s) => s.watchConnected);

  const today = todayISOLocal();
  const watchToday = watchConnected ? mockWatchDay(today) : null;
  const screenApps = mockScreenApps(today);
  const screenTotal = screenApps.reduce((sum, a) => sum + a.hours, 0);
  const screenTotalLabel = `${Math.floor(screenTotal)}小时${Math.round((screenTotal % 1) * 60)}分`;

  // Ledger card: today's expenses grouped by category, top 3 by amount.
  const todayExpenses = ledgerEntries.filter((e) => e.dateISO === today && e.type === 'expense');
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = {};
  todayExpenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const maxCategoryAmount = topCategories.length ? topCategories[0][1] : 1;

  // Habits card: today's checkin status, up to 4 habits.
  const checkedTodayCount = habits.filter((h) => h.checkins.includes(today)).length;

  return (
    <div className="manage-home">
      <button className="manage-card manage-card--clickable" onClick={openLedger}>
        <CardHead icon={<LedgerGlyph />} title="记账" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{todayTotal > 0 ? `¥${todayTotal.toFixed(0)}` : '—'}</div>
            <div className="manage-card__stat-label">今日支出</div>
          </div>
          <div className="manage-card__mini">
            {topCategories.map(([label, amount]) => (
              <div key={label} className="manage-mini-bar-row">
                <div className="manage-mini-bar-label">{label}</div>
                <div className="manage-mini-bar-track">
                  <div
                    className="manage-mini-bar-fill"
                    style={{ width: `${Math.max(8, (amount / maxCategoryAmount) * 100)}%`, background: categoryColor(label) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="manage-card__message">{ledgerCardMessage}</div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={openHabits}>
        <CardHead icon={<HabitGlyph />} title="习惯追踪" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value manage-card__stat-value--accent">
              {habits.length ? `已打卡 ${checkedTodayCount} 项` : '—'}
            </div>
            <div className="manage-card__stat-label">今日打卡</div>
          </div>
          <div className="manage-card__mini">
            {habits.slice(0, 4).map((h) => {
              const checked = h.checkins.includes(today);
              return (
                <div key={h.id} className="manage-status-row">
                  <div
                    className="manage-status-dot"
                    style={{
                      background: checked ? h.color : 'transparent',
                      border: checked ? 'none' : `1.5px solid ${h.color}`,
                    }}
                  />
                  <div className="manage-status-name">{h.name}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="manage-card__message">{habitCardMessage}</div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={openWatch}>
        <CardHead icon={<WatchGlyph />} title="手表监测" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{watchToday ? `${watchToday.sleepHours.toFixed(1)} 小时` : '—'}</div>
            <div className="manage-card__stat-label">睡眠时长</div>
          </div>
        </div>
        <div className="manage-card__message">{watchConnected ? '记得看看今天的身体数据呀' : '还没连接 HealthKit，点击去连接'}</div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={openScreentime}>
        <CardHead icon={<ScreenGlyph />} title="屏幕时间" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{screenTotalLabel}</div>
            <div className="manage-card__stat-label">今日总时长</div>
          </div>
        </div>
        <div className="manage-card__message">少看点手机，多看看我</div>
      </button>
    </div>
  );
}
