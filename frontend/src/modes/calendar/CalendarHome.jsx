import { useStore } from '../../state/store';

function CardChevron() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1L6 6L1 11" stroke="#B9AFB5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeriodGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M12 3C12 3 5 12 5 17a7 7 0 0 0 14 0c0-5-7-14-7-14Z" stroke="#C08BA0" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

function IntimacyGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M12 20s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11" stroke="#C08BA0" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

function ExerciseGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M3 9v6M21 9v6" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 12h12" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="1" y="7" width="4" height="10" rx="1.3" stroke="#C08BA0" strokeWidth="1.6" />
      <rect x="19" y="7" width="4" height="10" rx="1.3" stroke="#C08BA0" strokeWidth="1.6" />
    </svg>
  );
}

function CountdownGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12M6 21h12" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" stroke="#C08BA0" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function MilestoneGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M5 3v18" stroke="#C08BA0" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4h13l-3 4 3 4H5" stroke="#C08BA0" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
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

export default function CalendarHome() {
  const periodLogs = useStore((s) => s.periodLogs);
  const intimacyLogs = useStore((s) => s.intimacyLogs);
  const exerciseLogs = useStore((s) => s.exerciseLogs);
  const countdowns = useStore((s) => s.countdowns);
  const milestones = useStore((s) => s.milestones);
  const openCalendarView = useStore((s) => s.openCalendarView);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const today = todayISOLocal();
  const lastPeriod = [...periodLogs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const thisMonthIntimacy = intimacyLogs.filter((l) => l.date.slice(0, 7) === today.slice(0, 7)).length;
  const weekAgo = new Date(new Date(today).getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const weekExerciseMin = exerciseLogs.filter((l) => l.date >= weekAgo).reduce((sum, l) => sum + l.minutes, 0);
  const nextCountdown = [...countdowns].sort((a, b) => (a.date > b.date ? 1 : -1))[0];
  const nextCountdownDays = nextCountdown ? Math.ceil((new Date(nextCountdown.date) - new Date(today)) / 86400000) : null;

  return (
    <div className="manage-home">
      <button className="manage-card manage-card--clickable" onClick={() => openCalendarView('period')}>
        <CardHead icon={<PeriodGlyph />} title="月经" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{lastPeriod ? lastPeriod.date.slice(5) : '—'}</div>
            <div className="manage-card__stat-label">上次开始</div>
          </div>
        </div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={() => openCalendarView('intimacy')}>
        <CardHead icon={<IntimacyGlyph />} title="亲密" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{thisMonthIntimacy}</div>
            <div className="manage-card__stat-label">本月次数</div>
          </div>
        </div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={() => openCalendarView('exercise')}>
        <CardHead icon={<ExerciseGlyph />} title="锻炼" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{weekExerciseMin} 分钟</div>
            <div className="manage-card__stat-label">本周锻炼</div>
          </div>
        </div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={() => openCalendarView('countdown')}>
        <CardHead icon={<CountdownGlyph />} title="倒数日" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{nextCountdown ? `${nextCountdownDays} 天` : '—'}</div>
            <div className="manage-card__stat-label">{nextCountdown ? nextCountdown.title : '还没有倒数日'}</div>
          </div>
        </div>
      </button>

      <button className="manage-card manage-card--clickable" onClick={() => openCalendarView('milestone')}>
        <CardHead icon={<MilestoneGlyph />} title="恋爱大事件" />
        <div className="manage-card__body">
          <div className="manage-card__stat">
            <div className="manage-card__stat-value">{milestones.length}</div>
            <div className="manage-card__stat-label">记录条数</div>
          </div>
        </div>
      </button>
    </div>
  );
}
