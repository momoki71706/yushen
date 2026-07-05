import { useState } from 'react';
import { useStore } from '../../state/store';
import { CloseIcon } from '../../components/Icons';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function isoOf(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthCells(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, iso: isoOf(year, month, day) });
  return cells;
}

function NavArrow({ direction }) {
  const d = direction === 'prev' ? 'M8 3L4 7L8 11' : 'M6 3L10 7L6 11';
  return (
    <svg width="9" height="14" viewBox="0 0 14 14" fill="none">
      <path d={d} stroke="#8C7A82" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M6 3v18" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 4h13l-3 4 3 4H6" stroke="#C08BA0" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function CalendarHome() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const periodLogs = useStore((s) => s.periodLogs);
  const countdowns = useStore((s) => s.countdowns);
  const countdownCategoryColors = useStore((s) => s.countdownCategoryColors);
  const openCalendarView = useStore((s) => s.openCalendarView);
  const openCalendarAdd = useStore((s) => s.openCalendarAdd);
  const closeCalendarAdd = useStore((s) => s.closeCalendarAdd);
  const calendarAddOpen = useStore((s) => s.calendarAddOpen);
  const calendarDraft = useStore((s) => s.calendarDraft);
  const onCalendarDraftChange = useStore((s) => s.onCalendarDraftChange);
  const saveCalendarDraft = useStore((s) => s.saveCalendarDraft);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const today = todayISOLocal();
  const cells = buildMonthCells(viewDate);

  const dotsForDay = (iso) => {
    const dots = [];
    if (periodLogs.some((p) => p.date === iso)) dots.push('#D9718A');
    countdowns.filter((c) => c.date === iso).forEach((c) => dots.push(countdownCategoryColors[c.category] || countdownCategoryColors.other));
    return dots.slice(0, 3);
  };

  const sortedCountdowns = [...countdowns].sort((a, b) => {
    const da = Math.abs(new Date(a.date) - new Date(today));
    const db = Math.abs(new Date(b.date) - new Date(today));
    return da - db;
  });

  return (
    <div className="mode-scroll-home">
      <div className="cal-month-card">
        <div className="cal-month-head">
          <div className="cal-month-nav">
            <button className="cal-month-nav-btn" onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <NavArrow direction="prev" />
            </button>
            <div className="cal-month-label">{viewDate.getFullYear()}年{viewDate.getMonth() + 1}月</div>
            <button className="cal-month-nav-btn" onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <NavArrow direction="next" />
            </button>
          </div>
          <button className="cal-month-add-btn" onClick={() => openCalendarAdd('period')}>记录月经</button>
        </div>

        <div className="cal-weekday-row">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday-cell">{w}</div>
          ))}
        </div>
        <div className="cal-day-grid">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`pad-${i}`} />;
            const dots = dotsForDay(cell.iso);
            const isToday = cell.iso === today;
            return (
              <div key={cell.iso} className={`cal-day-cell${isToday ? ' cal-day-cell--today' : ''}`}>
                {cell.day}
                <div className="cal-day-dots">
                  {dots.map((c, di) => (
                    <div key={di} className="cal-day-dot" style={{ background: c }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cal-legend-row">
          <div className="cal-legend-item"><div className="cal-legend-dot" style={{ background: '#D9718A' }} />月经</div>
          <div className="cal-legend-item"><div className="cal-legend-dot" style={{ background: countdownCategoryColors.anniversary }} />恋爱纪念日</div>
          <div className="cal-legend-item"><div className="cal-legend-dot" style={{ background: countdownCategoryColors.birthday }} />生日</div>
          <div className="cal-legend-item"><div className="cal-legend-dot" style={{ background: countdownCategoryColors.other }} />其他</div>
        </div>
      </div>

      <button className="cal-section-head" style={{ border: 'none', background: 'transparent', width: '100%' }} onClick={() => openCalendarView('countdown')}>
        <SectionGlyph />
        倒数日
      </button>

      {sortedCountdowns.length === 0 ? (
        <div className="ledger-empty">还没有倒数日</div>
      ) : (
        <div className="cal-countdown-grid">
          {sortedCountdowns.map((c, i) => {
            const days = Math.ceil((new Date(c.date) - new Date(today)) / 86400000);
            const passed = days < 0;
            const color = countdownCategoryColors[c.category] || countdownCategoryColors.other;
            return (
              <div
                key={c.id}
                className={`cal-countdown-card${i === 0 ? '' : ' cal-countdown-card--small'}`}
                style={{ '--dot-color': color }}
              >
                <div className="cal-countdown-title">{c.title}</div>
                <div className="cal-countdown-value">{passed ? `已经 ${Math.abs(days)} 天` : days === 0 ? '就是今天' : `还有 ${days} 天`}</div>
                <div className="cal-countdown-date">{c.date}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="cal-quicklinks-row">
        <button className="cal-quicklink-btn" onClick={() => openCalendarView('intimacy')}>亲密记录</button>
        <button className="cal-quicklink-btn" onClick={() => openCalendarView('exercise')}>锻炼记录</button>
        <button className="cal-quicklink-btn" onClick={() => openCalendarView('milestone')}>恋爱大事件</button>
      </div>

      {calendarAddOpen === 'period' && (
        <div className="sheet-overlay" onClick={closeCalendarAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">记一次开始日期</div>
              <button className="sheet-panel__close" onClick={closeCalendarAdd}>
                <CloseIcon />
              </button>
            </div>
            <input
              type="date"
              className="provider-form-input"
              style={{ marginBottom: 14 }}
              value={calendarDraft.date}
              onChange={(e) => onCalendarDraftChange('date', e.target.value)}
            />
            <button className="ai-key-save-btn" style={{ width: '100%', padding: '13px 0' }} onClick={saveCalendarDraft}>
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
