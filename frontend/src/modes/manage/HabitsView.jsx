import { useStore } from '../../state/store';
import { BackChevronIcon, CloseIcon, CheckIcon } from '../../components/Icons';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function isoOfDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeStreak(checkins, todayISO) {
  const set = new Set(checkins);
  let streak = 0;
  const cursor = new Date(todayISO);
  if (!set.has(todayISO)) cursor.setDate(cursor.getDate() - 1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const iso = isoOfDate(cursor);
    if (!set.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildCalendarCells(monthDate, habits, todayISO) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const doneCount = habits.filter((h) => h.checkins.includes(iso)).length;
    cells.push({
      day,
      iso,
      isFuture: iso > todayISO,
      isToday: iso === todayISO,
      ratio: habits.length ? doneCount / habits.length : 0,
      doneCount,
    });
  }
  return cells;
}

function dateLabelFor(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}月${d}日 · ${WEEKDAYS[dt.getDay()]}`;
}

export default function HabitsView() {
  const habits = useStore((s) => s.habits);
  const habitsShowAdd = useStore((s) => s.habitsShowAdd);
  const habitsDraft = useStore((s) => s.habitsDraft);
  const habitsDayDetailDate = useStore((s) => s.habitsDayDetailDate);
  const habitColors = useStore((s) => s.habitColors);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const closeManageSubview = useStore((s) => s.closeManageSubview);
  const openHabitsAdd = useStore((s) => s.openHabitsAdd);
  const closeHabitsAdd = useStore((s) => s.closeHabitsAdd);
  const onHabitsDraftChange = useStore((s) => s.onHabitsDraftChange);
  const saveHabit = useStore((s) => s.saveHabit);
  const toggleHabitCheckin = useStore((s) => s.toggleHabitCheckin);
  const openHabitsDayDetail = useStore((s) => s.openHabitsDayDetail);
  const closeHabitsDayDetail = useStore((s) => s.closeHabitsDayDetail);

  const today = todayISOLocal();
  const monthDate = new Date();
  const cells = buildCalendarCells(monthDate, habits, today);

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeManageSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">习惯追踪</div>
        </div>
        <button className="manage-sub__add-btn" onClick={openHabitsAdd}>
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M7.5 1V14M1 7.5H14" stroke="#8C7A82" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        {habits.length === 0 && <div className="ledger-empty">还没有习惯，点右上角加一个吧</div>}
        {habits.map((h) => {
          const streak = computeStreak(h.checkins, today);
          const checkedToday = h.checkins.includes(today);
          return (
            <div key={h.id} className="habit-item">
              <div className="habit-item-top">
                <div className="habit-dot" style={{ background: h.color }} />
                <div className="habit-name">{h.name}</div>
                <div className="habit-streak">连续 {streak} 天</div>
                <button
                  className="habit-check-btn"
                  style={{ borderColor: checkedToday ? h.color : 'rgba(58,50,54,0.15)', background: checkedToday ? h.color : 'transparent' }}
                  onClick={() => toggleHabitCheckin(h.id, today)}
                >
                  <CheckIcon color={checkedToday ? '#fff' : '#B9AFB5'} width={14} height={11} />
                </button>
              </div>
              <div className="habit-progress-track">
                <div className="habit-progress-fill" style={{ width: `${Math.min(100, (streak / 30) * 100)}%`, background: h.color }} />
              </div>
            </div>
          );
        })}

        <div className="habit-heatmap-card">
          <div className="habit-heatmap-title">{monthDate.getMonth() + 1}月 完成情况</div>
          <div className="habit-heatmap-grid">
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <button
                  key={cell.iso}
                  className="habit-heatmap-cell"
                  disabled={cell.isFuture}
                  onClick={() => openHabitsDayDetail(cell.iso)}
                  style={{
                    background: cell.ratio > 0 ? `rgba(217,203,211,${0.25 + cell.ratio * 0.75})` : 'rgba(58,50,54,0.04)',
                    color: cell.ratio > 0.5 ? '#4A4048' : '#847A80',
                    border: cell.isToday ? '1.5px solid #C8899E' : 'none',
                    cursor: cell.isFuture ? 'default' : 'pointer',
                    opacity: cell.isFuture ? 0.4 : 1,
                  }}
                >
                  {cell.day}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {habitsShowAdd && habitsDraft && (
        <div className="sheet-overlay" onClick={closeHabitsAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">新建习惯</div>
              <button className="sheet-panel__close" onClick={closeHabitsAdd}>
                <CloseIcon />
              </button>
            </div>
            <input
              className="provider-form-input"
              style={{ marginBottom: 14 }}
              value={habitsDraft.name}
              onChange={(e) => onHabitsDraftChange('name', e.target.value)}
              placeholder="习惯名称，比如喝水"
              autoFocus
            />
            <div className="habit-color-row">
              {habitColors.map((c) => (
                <button
                  key={c}
                  className="habit-color-swatch"
                  style={{ background: c, borderColor: habitsDraft.color === c ? '#4A4048' : 'transparent' }}
                  onClick={() => onHabitsDraftChange('color', c)}
                />
              ))}
            </div>
            <button className="ai-key-save-btn" style={{ width: '100%', padding: '13px 0' }} onClick={saveHabit}>保存</button>
          </div>
        </div>
      )}

      {habitsDayDetailDate && (
        <div className="habit-day-modal-overlay" onClick={closeHabitsDayDetail}>
          <div className="habit-day-modal" onClick={(e) => e.stopPropagation()}>
            <div className="habit-day-modal-head">
              <div className="habit-day-modal-date">{dateLabelFor(habitsDayDetailDate)}</div>
              <button className="habit-day-modal-close" onClick={closeHabitsDayDetail}>
                <CloseIcon />
              </button>
            </div>
            <div className="habit-day-modal-count">
              完成 {habits.filter((h) => h.checkins.includes(habitsDayDetailDate)).length} / {habits.length}
            </div>
            {habits.map((h) => {
              const done = h.checkins.includes(habitsDayDetailDate);
              return (
                <div key={h.id} className="habit-day-modal-row">
                  <div className="habit-day-modal-check" style={{ borderColor: done ? h.color : 'rgba(58,50,54,0.15)', background: done ? h.color : 'transparent' }}>
                    <CheckIcon color={done ? '#fff' : '#B9AFB5'} width={12} height={9} />
                  </div>
                  <div className="habit-day-modal-name">{h.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
