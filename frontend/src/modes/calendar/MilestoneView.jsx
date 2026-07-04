import { useStore } from '../../state/store';
import { BackChevronIcon, PlusIcon, CloseIcon, TrashIcon } from '../../components/Icons';

export default function MilestoneView() {
  const milestones = useStore((s) => s.milestones);
  const closeCalendarSubview = useStore((s) => s.closeCalendarSubview);
  const openCalendarAdd = useStore((s) => s.openCalendarAdd);
  const closeCalendarAdd = useStore((s) => s.closeCalendarAdd);
  const calendarAddOpen = useStore((s) => s.calendarAddOpen);
  const calendarDraft = useStore((s) => s.calendarDraft);
  const onCalendarDraftChange = useStore((s) => s.onCalendarDraftChange);
  const saveCalendarDraft = useStore((s) => s.saveCalendarDraft);
  const deleteMilestone = useStore((s) => s.deleteMilestone);

  const sorted = [...milestones].sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeCalendarSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">恋爱大事件</div>
        </div>
        <button className="manage-sub__add-btn" onClick={() => openCalendarAdd('milestone')}>
          <PlusIcon color="#8C7A82" width={14} height={14} />
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        {sorted.length === 0 ? (
          <div className="ledger-empty">还没有记录，点右上角加一个吧</div>
        ) : (
          sorted.map((m, i) => (
            <div key={m.id} className="milestone-row" style={{ position: 'relative' }}>
              <div className="milestone-dot-col">
                <div className="milestone-dot" />
                {i < sorted.length - 1 && <div className="milestone-line" />}
              </div>
              <div className="milestone-body">
                <div className="milestone-date">{m.date}</div>
                <div className="milestone-title">{m.title}</div>
                {m.note && <div className="milestone-note">{m.note}</div>}
              </div>
              <button className="milestone-delete" onClick={() => deleteMilestone(m.id)}>
                <TrashIcon color="#8C6A72" width={13} height={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {calendarAddOpen === 'milestone' && (
        <div className="sheet-overlay" onClick={closeCalendarAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">记一件大事</div>
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
              style={{ marginBottom: 10 }}
              value={calendarDraft.title}
              onChange={(e) => onCalendarDraftChange('title', e.target.value)}
              placeholder="标题，比如第一次约会"
              autoFocus
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
