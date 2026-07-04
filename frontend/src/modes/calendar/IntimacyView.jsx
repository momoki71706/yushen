import { useStore } from '../../state/store';
import { BackChevronIcon, PlusIcon, CloseIcon, TrashIcon } from '../../components/Icons';

export default function IntimacyView() {
  const intimacyLogs = useStore((s) => s.intimacyLogs);
  const closeCalendarSubview = useStore((s) => s.closeCalendarSubview);
  const openCalendarAdd = useStore((s) => s.openCalendarAdd);
  const closeCalendarAdd = useStore((s) => s.closeCalendarAdd);
  const calendarAddOpen = useStore((s) => s.calendarAddOpen);
  const calendarDraft = useStore((s) => s.calendarDraft);
  const onCalendarDraftChange = useStore((s) => s.onCalendarDraftChange);
  const saveCalendarDraft = useStore((s) => s.saveCalendarDraft);
  const deleteIntimacyLog = useStore((s) => s.deleteIntimacyLog);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const today = todayISOLocal();
  const thisMonth = intimacyLogs.filter((l) => l.date.slice(0, 7) === today.slice(0, 7)).length;
  const sorted = [...intimacyLogs].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeCalendarSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">亲密记录</div>
        </div>
        <button className="manage-sub__add-btn" onClick={() => openCalendarAdd('intimacy')}>
          <PlusIcon color="#8C7A82" width={14} height={14} />
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        <div className="simple-summary-card">
          <div className="simple-summary-value">{thisMonth}</div>
          <div className="simple-summary-label">本月次数</div>
        </div>

        {sorted.length === 0 ? (
          <div className="ledger-empty">还没有记录，点右上角加一条吧</div>
        ) : (
          <div className="simple-list-card">
            {sorted.map((l) => (
              <div key={l.id} className="simple-list-row">
                <div className="simple-list-body">
                  <div className="simple-list-title">{l.date}</div>
                  {l.note && <div className="simple-list-meta">{l.note}</div>}
                </div>
                <button className="simple-list-delete" onClick={() => deleteIntimacyLog(l.id)}>
                  <TrashIcon color="#8C6A72" width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {calendarAddOpen === 'intimacy' && (
        <div className="sheet-overlay" onClick={closeCalendarAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">记一条</div>
              <button className="sheet-panel__close" onClick={closeCalendarAdd}>
                <CloseIcon />
              </button>
            </div>
            <input
              type="date"
              className="provider-form-input"
              style={{ marginBottom: 10 }}
              value={calendarDraft.date}
              onChange={(e) => onCalendarDraftChange('date', e.target.value)}
            />
            <input
              className="provider-form-input"
              style={{ marginBottom: 14 }}
              value={calendarDraft.note}
              onChange={(e) => onCalendarDraftChange('note', e.target.value)}
              placeholder="备注（可选）"
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
