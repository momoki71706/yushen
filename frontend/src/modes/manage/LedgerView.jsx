import { useStore } from '../../state/store';
import { BackChevronIcon, CloseIcon, PlusIcon } from '../../components/Icons';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function monthLabelFor(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}
function monthPrefixFor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function dateLabelFor(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}月${d}日 · ${WEEKDAYS[dt.getDay()]}`;
}
function buildPieGradient(breakdown) {
  if (!breakdown.length) return 'transparent';
  let acc = 0;
  const stops = breakdown.map(({ color, percent }) => {
    const start = acc;
    acc += percent;
    return `${color} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export default function LedgerView() {
  const ledgerEntries = useStore((s) => s.ledgerEntries);
  const ledgerMonthOffset = useStore((s) => s.ledgerMonthOffset);
  const ledgerChartMode = useStore((s) => s.ledgerChartMode);
  const ledgerShowAdd = useStore((s) => s.ledgerShowAdd);
  const ledgerDraft = useStore((s) => s.ledgerDraft);
  const expenseCategories = useStore((s) => s.expenseCategories);
  const incomeCategories = useStore((s) => s.incomeCategories);
  const categoryColor = useStore((s) => s.categoryColor);

  const closeManageSubview = useStore((s) => s.closeManageSubview);
  const ledgerPrevMonth = useStore((s) => s.ledgerPrevMonth);
  const ledgerNextMonth = useStore((s) => s.ledgerNextMonth);
  const setLedgerChartMode = useStore((s) => s.setLedgerChartMode);
  const openLedgerAdd = useStore((s) => s.openLedgerAdd);
  const closeLedgerAdd = useStore((s) => s.closeLedgerAdd);
  const onLedgerDraftChange = useStore((s) => s.onLedgerDraftChange);
  const saveLedgerEntry = useStore((s) => s.saveLedgerEntry);

  const monthDate = new Date();
  monthDate.setDate(1);
  monthDate.setMonth(monthDate.getMonth() + ledgerMonthOffset);
  const monthPrefix = monthPrefixFor(monthDate);
  const monthEntries = ledgerEntries.filter((e) => e.dateISO.startsWith(monthPrefix));

  const monthIncome = monthEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const monthExpense = monthEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  const expenseByCategory = {};
  monthEntries.filter((e) => e.type === 'expense').forEach((e) => {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
  });
  const categoryBreakdown = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({
      label,
      amount,
      color: categoryColor(label),
      percent: monthExpense > 0 ? Math.round((amount / monthExpense) * 100) : 0,
    }));
  const maxCategoryAmount = categoryBreakdown.length ? categoryBreakdown[0].amount : 1;

  const groupsMap = {};
  monthEntries.forEach((e) => {
    if (!groupsMap[e.dateISO]) groupsMap[e.dateISO] = [];
    groupsMap[e.dateISO].push(e);
  });
  const groups = Object.keys(groupsMap)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((iso) => ({ dateISO: iso, dateLabel: dateLabelFor(iso), items: groupsMap[iso] }));

  const draftCategories = ledgerDraft?.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeManageSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">记账</div>
        </div>
      </div>

      <div className="manage-sub__body">
        <div className="ledger-summary-card">
          <div className="ledger-month-nav">
            <button className="ledger-month-nav-btn" onClick={ledgerPrevMonth}>
              <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M6 1L1 5.5L6 10" stroke="#8C7A82" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="ledger-month-label">{monthLabelFor(monthDate)}</div>
            <button className="ledger-month-nav-btn" onClick={ledgerNextMonth} disabled={ledgerMonthOffset >= 0}>
              <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M1 1L6 5.5L1 10" stroke="#8C7A82" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div className="ledger-totals-row">
            <div>
              <div className="ledger-totals-label">收入</div>
              <div className="ledger-totals-value">¥{monthIncome.toFixed(0)}</div>
            </div>
            <div>
              <div className="ledger-totals-label">支出</div>
              <div className="ledger-totals-value">¥{monthExpense.toFixed(0)}</div>
            </div>
            <div>
              <div className="ledger-totals-label">结余</div>
              <div className="ledger-totals-value" style={{ color: 'var(--color-accent)' }}>¥{monthBalance.toFixed(0)}</div>
            </div>
          </div>

          {categoryBreakdown.length > 0 && (
            <>
              <div className="ledger-divider" />
              <div className="ledger-category-head">
                <div className="ledger-category-title">支出分类</div>
                <div className="ledger-chart-toggle">
                  <button
                    className="ledger-chart-toggle-btn"
                    style={{ background: ledgerChartMode === 'pie' ? '#fff' : 'transparent', color: ledgerChartMode === 'pie' ? '#5C4A54' : '#6B6268' }}
                    onClick={() => setLedgerChartMode('pie')}
                  >
                    饼图
                  </button>
                  <button
                    className="ledger-chart-toggle-btn"
                    style={{ background: ledgerChartMode === 'bar' ? '#fff' : 'transparent', color: ledgerChartMode === 'bar' ? '#5C4A54' : '#6B6268' }}
                    onClick={() => setLedgerChartMode('bar')}
                  >
                    柱状图
                  </button>
                </div>
              </div>
              {ledgerChartMode === 'pie' ? (
                <div className="ledger-pie-row">
                  <div className="ledger-pie" style={{ background: buildPieGradient(categoryBreakdown) }} />
                  <div className="ledger-legend">
                    {categoryBreakdown.map((c) => (
                      <div key={c.label} className="ledger-legend-row">
                        <div className="ledger-legend-dot" style={{ background: c.color }} />
                        <div className="ledger-legend-label">{c.label}</div>
                        <div className="ledger-legend-value">{c.percent}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {categoryBreakdown.map((c) => (
                    <div key={c.label}>
                      <div className="ledger-bar-head">
                        <span>{c.label}</span>
                        <span className="ledger-bar-value">¥{c.amount.toFixed(0)}</span>
                      </div>
                      <div className="ledger-bar-track">
                        <div className="ledger-bar-fill" style={{ width: `${Math.max(6, (c.amount / maxCategoryAmount) * 100)}%`, background: c.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {groups.length ? (
          groups.map((g) => (
            <div key={g.dateISO} className="ledger-group">
              <div className="ledger-group-label">{g.dateLabel}</div>
              <div className="ledger-group-card">
                {g.items.map((t) => (
                  <div key={t.id} className="ledger-item">
                    <div className="ledger-item-glyph" style={{ background: categoryColor(t.category) }}>{t.category.slice(0, 1)}</div>
                    <div className="ledger-item-info">
                      <div className="ledger-item-note">{t.note || t.category}</div>
                      <div className="ledger-item-meta">{t.category} · {t.time}</div>
                    </div>
                    <div className="ledger-item-amount" style={{ color: t.type === 'income' ? '#8FA88E' : '#4A4048' }}>
                      {t.type === 'income' ? '+' : '-'}¥{t.amount.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="ledger-empty">这个月还没有记账</div>
        )}
      </div>

      <button className="ledger-fab" onClick={openLedgerAdd}>
        <PlusIcon color="#fff" width={18} height={18} />
      </button>

      {ledgerShowAdd && ledgerDraft && (
        <div className="sheet-overlay" onClick={closeLedgerAdd}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-panel__head">
              <div className="sheet-panel__title">记一笔</div>
              <button className="sheet-panel__close" onClick={closeLedgerAdd}>
                <CloseIcon />
              </button>
            </div>
            <div className="ai-provider-toggle">
              <button
                className="ai-provider-toggle__btn"
                style={{ background: ledgerDraft.type === 'expense' ? '#fff' : 'transparent', color: ledgerDraft.type === 'expense' ? '#5C4A54' : '#6B6268' }}
                onClick={() => onLedgerDraftChange('type', 'expense')}
              >
                支出
              </button>
              <button
                className="ai-provider-toggle__btn"
                style={{ background: ledgerDraft.type === 'income' ? '#fff' : 'transparent', color: ledgerDraft.type === 'income' ? '#5C4A54' : '#6B6268' }}
                onClick={() => onLedgerDraftChange('type', 'income')}
              >
                收入
              </button>
            </div>
            <div className="amount-input-row">
              <span className="amount-input-prefix">¥</span>
              <input
                className="amount-input"
                type="number"
                value={ledgerDraft.amount}
                onChange={(e) => onLedgerDraftChange('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="category-chip-row">
              {draftCategories.map((c) => {
                const active = ledgerDraft.category === c.key;
                return (
                  <button
                    key={c.key}
                    className="category-chip"
                    style={{ borderColor: active ? c.color : 'rgba(58,50,54,0.12)', background: active ? `${c.color}33` : 'transparent', color: active ? '#4A4048' : '#6B6268' }}
                    onClick={() => onLedgerDraftChange('category', c.key)}
                  >
                    <span className="category-chip-dot" style={{ background: c.color }} />
                    {c.key}
                  </button>
                );
              })}
            </div>
            <input
              className="provider-form-input"
              style={{ marginBottom: 12 }}
              value={ledgerDraft.note}
              onChange={(e) => onLedgerDraftChange('note', e.target.value)}
              placeholder="备注…"
            />
            <input
              className="provider-form-input"
              style={{ marginBottom: 20 }}
              type="date"
              value={ledgerDraft.dateISO}
              onChange={(e) => onLedgerDraftChange('dateISO', e.target.value)}
            />
            <button className="ai-key-save-btn" style={{ width: '100%', padding: '13px 0' }} onClick={saveLedgerEntry}>保存</button>
          </div>
        </div>
      )}
    </div>
  );
}
