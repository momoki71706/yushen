import { useStore } from '../../state/store';
import { BackChevronIcon, PlusIcon, CloseIcon, TrashIcon } from '../../components/Icons';

export default function CountdownView() {
  const countdowns = useStore((s) => s.countdowns);
  const closeCalendarSubview = useStore((s) => s.closeCalendarSubview);
  const openCalendarAdd = useStore((s) => s.openCalendarAdd);
  const closeCalendarAdd = useStore((s) => s.closeCalendarAdd);
  const calendarAddOpen = useStore((s) => s.calendarAddOpen);
  const calendarDraft = useStore((s) => s.calendarDraft);
  const onCalendarDraftChange = useStore((s) => s.onCalendarDraftChange);
  const saveCalendarDraft = useStore((s) => s.saveCalendarDraft);
  const deleteCountdown = useStore((s) => s.deleteCountdown);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const today = todayISOLocal();
  const sorted = [...countdowns].sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeCalendarSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">倒数日</div>
        </div>
        <button className="manage-sub__add-btn" onClick={() => openCalendarAdd('countdown')}>
          <PlusIcon color="#8C7A82" width={14} height={14} />
        </button>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        {sorted.length === 0 ? (
          <div className="ledger-empty">还没有倒数日，点右上角加一个吧</div>
        ) : (
          <div className="simple-list-card">
            {sorted.map((c) => {
              const days = Math.ceil((new Date(c.date) - new Date(today)) / 86400000);
              const passed = days < 0;
              return (
                <div key={c.id} className="simple-list-row">
                  <div className="countdown-badge">
                    <div className="countdown-badge-num">{Math.abs(days)}</div>
                    <div className="countdown-badge-unit">{passed ? '天前' : days === 0 ? '就是今天' : '天后'}</div>
                  </div>
                  <div className="simple-list-body">
                    <div className="simple-list-title">{c.title}</div>
                    <div className="simple-list-meta">{c.date}</div>
                  </div>
                  <button className="simple-list-delete" onClick={() => deleteCountdown(c.id)}>
                    <TrashIcon color="#8C6A72" width={14} height={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {calendarAddOpen === 'countdown' && (
        <div className="sheet-overlay" onClick={closeCalendarAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">新建倒数日</div>
              <button className="sheet-panel__close" onClick={closeCalendarAdd}>
                <CloseIcon />
              </button>
            </div>
            <input
              className="provider-form-input"
              style={{ marginBottom: 10 }}
              value={calendarDraft.title}
              onChange={(e) => onCalendarDraftChange('title', e.target.value)}
              placeholder="标题，比如生日"
              autoFocus
            />
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
