import { useStore } from '../../state/store';
import { BackChevronIcon, PlusIcon, CloseIcon, TrashIcon } from '../../components/Icons';

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export default function PeriodView() {
  const periodLogs = useStore((s) => s.periodLogs);
  const closeCalendarSubview = useStore((s) => s.closeCalendarSubview);
  const openCalendarAdd = useStore((s) => s.openCalendarAdd);
  const closeCalendarAdd = useStore((s) => s.closeCalendarAdd);
  const calendarAddOpen = useStore((s) => s.calendarAddOpen);
  const calendarDraft = useStore((s) => s.calendarDraft);
  const onCalendarDraftChange = useStore((s) => s.onCalendarDraftChange);
  const saveCalendarDraft = useStore((s) => s.saveCalendarDraft);
  const deletePeriodLog = useStore((s) => s.deletePeriodLog);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const sorted = [...periodLogs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const gaps = [];
  for (let i = 0; i < sorted.length - 1; i++) gaps.push(daysBetween(sorted[i + 1].date, sorted[i].date));
  const avgCycle = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28;
  const last = sorted[0];
  const today = todayISOLocal();
  const cycleDay = last ? daysBetween(last.date, today) + 1 : null;
  const predictedNext = last ? new Date(new Date(last.date).getTime() + avgCycle * 86400000) : null;

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeCalendarSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">月经记录</div>
        </div>
        <button className="manage-sub__add-btn" onClick={() => openCalendarAdd('period')}>
          <PlusIcon color="#8C7A82" width={14} height={14} />
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        <div className="simple-summary-card">
          {last ? (
            <>
              <div className="simple-summary-value">第 {cycleDay} 天</div>
              <div className="simple-summary-label">距上次开始</div>
              <div className="simple-summary-sub">
                平均周期 {avgCycle} 天 · 预计下次 {predictedNext.getMonth() + 1}月{predictedNext.getDate()}日
              </div>
            </>
          ) : (
            <div className="simple-summary-sub">还没有记录，点右上角加一条吧</div>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="simple-list-card">
            {sorted.map((p) => (
              <div key={p.id} className="simple-list-row">
                <div className="simple-list-body">
                  <div className="simple-list-title">{p.date}</div>
                </div>
                <button className="simple-list-delete" onClick={() => deletePeriodLog(p.id)}>
                  <TrashIcon color="#8C6A72" width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        )}
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
