import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { BackChevronIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/Icons';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SWIPE_DELETE_WIDTH = 72;
const SWIPE_ACTIONS_WIDTH = SWIPE_DELETE_WIDTH * 2;

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

// Swipe-to-reveal on a single ledger row — dragging left reveals an edit
// button and a delete button underneath (edit on the left of delete), same
// convention as iOS Mail/WeChat.
function SwipeableLedgerItem({ item, categoryColor, onDelete, onEdit }) {
  const [translateX, setTranslateX] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const baseXRef = useRef(0);

  const handleDown = (e) => {
    startXRef.current = e.clientX;
    baseXRef.current = translateX;
    draggingRef.current = true;
  };
  const handleMove = (e) => {
    if (!draggingRef.current) return;
    const delta = e.clientX - startXRef.current;
    setTranslateX(Math.min(0, Math.max(-SWIPE_ACTIONS_WIDTH, baseXRef.current + delta)));
  };
  const handleUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setTranslateX((x) => (x < -SWIPE_ACTIONS_WIDTH / 2 ? -SWIPE_ACTIONS_WIDTH : 0));
  };

  return (
    <div className="ledger-item-swipe-wrap">
      <div className="ledger-item-swipe-actions" style={{ width: SWIPE_ACTIONS_WIDTH }}>
        <button
          className="ledger-item-swipe-edit"
          style={{ width: SWIPE_DELETE_WIDTH }}
          onClick={() => onEdit(item)}
        >
          <PencilIcon color="#fff" width={15} height={15} />
        </button>
        <button
          className="ledger-item-swipe-delete"
          style={{ width: SWIPE_DELETE_WIDTH }}
          onClick={() => onDelete(item.id)}
        >
          <TrashIcon color="#fff" width={16} height={16} />
        </button>
      </div>
      <div
        className="ledger-item"
        style={{ transform: `translateX(${translateX}px)`, touchAction: 'pan-y' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <div className="ledger-item-glyph" style={{ background: categoryColor(item.category) }}>{item.category.slice(0, 1)}</div>
        <div className="ledger-item-info">
          <div className="ledger-item-note">{item.note || item.category}</div>
          <div className="ledger-item-meta">{item.category} · {item.time}</div>
        </div>
        <div className="ledger-item-amount" style={{ color: item.type === 'income' ? '#8FA88E' : '#4A4048' }}>
          {item.type === 'income' ? '+' : '-'}¥{item.amount.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function SubTabPill() {
  const ledgerSubTab = useStore((s) => s.ledgerSubTab);
  const setLedgerSubTab = useStore((s) => s.setLedgerSubTab);
  return (
    <div className="mode-pill" style={{ margin: '0 0 14px' }}>
      {[{ key: 'entries', label: '记账' }, { key: 'budget', label: '预算' }].map((t) => {
        const active = ledgerSubTab === t.key;
        return (
          <button
            key={t.key}
            className="mode-pill__btn"
            onClick={() => setLedgerSubTab(t.key)}
            style={{
              background: active ? '#fff' : 'transparent',
              color: active ? '#5C4A54' : '#6B6268',
              boxShadow: active ? '0 1px 4px rgba(58,50,54,0.1)' : 'none',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function LedgerView() {
  const ledgerSubTab = useStore((s) => s.ledgerSubTab);
  const closeManageSubview = useStore((s) => s.closeManageSubview);

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
      {ledgerSubTab === 'budget' ? <BudgetSection /> : <EntriesSection />}
    </div>
  );
}

function EntriesSection() {
  const ledgerEntries = useStore((s) => s.ledgerEntries);
  const ledgerMonthOffset = useStore((s) => s.ledgerMonthOffset);
  const ledgerChartMode = useStore((s) => s.ledgerChartMode);
  const ledgerChartType = useStore((s) => s.ledgerChartType);
  const ledgerDrilldownCategory = useStore((s) => s.ledgerDrilldownCategory);
  const ledgerShowAdd = useStore((s) => s.ledgerShowAdd);
  const ledgerDraft = useStore((s) => s.ledgerDraft);
  const editingLedgerEntryId = useStore((s) => s.editingLedgerEntryId);
  const expenseCategories = useStore((s) => s.expenseCategories);
  const incomeCategories = useStore((s) => s.incomeCategories);
  const categoryColor = useStore((s) => s.categoryColor);

  const ledgerPrevMonth = useStore((s) => s.ledgerPrevMonth);
  const ledgerNextMonth = useStore((s) => s.ledgerNextMonth);
  const setLedgerChartMode = useStore((s) => s.setLedgerChartMode);
  const setLedgerChartType = useStore((s) => s.setLedgerChartType);
  const toggleLedgerDrilldown = useStore((s) => s.toggleLedgerDrilldown);
  const openLedgerAdd = useStore((s) => s.openLedgerAdd);
  const closeLedgerAdd = useStore((s) => s.closeLedgerAdd);
  const startEditLedgerEntry = useStore((s) => s.startEditLedgerEntry);
  const onLedgerDraftChange = useStore((s) => s.onLedgerDraftChange);
  const saveLedgerEntry = useStore((s) => s.saveLedgerEntry);
  const deleteLedgerEntryAction = useStore((s) => s.deleteLedgerEntryAction);
  const addLedgerCategoryAction = useStore((s) => s.addLedgerCategoryAction);
  const ledgerCategoryDeleteConfirmId = useStore((s) => s.ledgerCategoryDeleteConfirmId);
  const requestDeleteLedgerCategory = useStore((s) => s.requestDeleteLedgerCategory);
  const cancelDeleteLedgerCategory = useStore((s) => s.cancelDeleteLedgerCategory);
  const confirmDeleteLedgerCategory = useStore((s) => s.confirmDeleteLedgerCategory);

  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [categoryEditMode, setCategoryEditMode] = useState(false);

  const monthDate = new Date();
  monthDate.setDate(1);
  monthDate.setMonth(monthDate.getMonth() + ledgerMonthOffset);
  const monthPrefix = monthPrefixFor(monthDate);
  const monthEntries = ledgerEntries.filter((e) => e.dateISO.startsWith(monthPrefix));

  const monthIncome = monthEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const monthExpense = monthEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  const byCategory = {};
  monthEntries.filter((e) => e.type === ledgerChartType).forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  const chartTotal = ledgerChartType === 'income' ? monthIncome : monthExpense;
  const categoryBreakdown = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({
      label,
      amount,
      color: categoryColor(label),
      percent: chartTotal > 0 ? Math.round((amount / chartTotal) * 100) : 0,
    }));
  const maxCategoryAmount = categoryBreakdown.length ? categoryBreakdown[0].amount : 1;

  const drilldownEntries = ledgerDrilldownCategory
    ? monthEntries.filter((e) => e.category === ledgerDrilldownCategory)
    : [];

  const groupsMap = {};
  monthEntries.forEach((e) => {
    if (!groupsMap[e.dateISO]) groupsMap[e.dateISO] = [];
    groupsMap[e.dateISO].push(e);
  });
  const groups = Object.keys(groupsMap)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((iso) => ({ dateISO: iso, dateLabel: dateLabelFor(iso), items: groupsMap[iso] }));

  const draftCategories = ledgerDraft?.type === 'income' ? incomeCategories : expenseCategories;

  const confirmAddCategory = async () => {
    if (!categoryDraft.trim()) return;
    await addLedgerCategoryAction(ledgerDraft.type, categoryDraft);
    setCategoryDraft('');
    setAddingCategory(false);
  };

  return (
    <>
      <div className="manage-sub__body">
        <SubTabPill />
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
              <div className="ledger-totals-value">¥{monthIncome.toFixed(2)}</div>
            </div>
            <div>
              <div className="ledger-totals-label">支出</div>
              <div className="ledger-totals-value">¥{monthExpense.toFixed(2)}</div>
            </div>
            <div>
              <div className="ledger-totals-label">结余</div>
              <div className="ledger-totals-value" style={{ color: 'var(--color-accent)' }}>¥{monthBalance.toFixed(2)}</div>
            </div>
          </div>

          {categoryBreakdown.length > 0 && (
            <>
              <div className="ledger-divider" />
              <div className="ledger-category-head">
                <div className="ledger-category-title">{ledgerChartType === 'income' ? '收入' : '支出'}分类</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="ledger-chart-toggle">
                    <button
                      className="ledger-chart-toggle-btn"
                      style={{ background: ledgerChartType === 'expense' ? '#fff' : 'transparent', color: ledgerChartType === 'expense' ? '#5C4A54' : '#6B6268' }}
                      onClick={() => setLedgerChartType('expense')}
                    >
                      支出
                    </button>
                    <button
                      className="ledger-chart-toggle-btn"
                      style={{ background: ledgerChartType === 'income' ? '#fff' : 'transparent', color: ledgerChartType === 'income' ? '#5C4A54' : '#6B6268' }}
                      onClick={() => setLedgerChartType('income')}
                    >
                      收入
                    </button>
                  </div>
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
                      <button
                        className="ledger-bar-row-btn"
                        onClick={() => toggleLedgerDrilldown(c.label)}
                      >
                        <div className="ledger-bar-head">
                          <span>{c.label}</span>
                          <span className="ledger-bar-value">¥{c.amount.toFixed(2)}</span>
                        </div>
                        <div className="ledger-bar-track">
                          <div className="ledger-bar-fill" style={{ width: `${Math.max(6, (c.amount / maxCategoryAmount) * 100)}%`, background: c.color }} />
                        </div>
                      </button>
                      {ledgerDrilldownCategory === c.label && (
                        <div className="ledger-drilldown">
                          {drilldownEntries.map((e) => (
                            <div key={e.id} className="ledger-drilldown-row">
                              <span className="ledger-drilldown-date">{e.dateISO.slice(5)}</span>
                              <span className="ledger-drilldown-note">{e.note || e.category}</span>
                              <span className="ledger-drilldown-amount" style={{ color: e.type === 'income' ? '#8FA88E' : '#4A4048' }}>
                                {e.type === 'income' ? '+' : '-'}¥{e.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
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
                  <SwipeableLedgerItem key={t.id} item={t} categoryColor={categoryColor} onDelete={deleteLedgerEntryAction} onEdit={startEditLedgerEntry} />
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
              <div className="sheet-panel__title">{editingLedgerEntryId ? '' : '记一笔'}</div>
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
                step="0.01"
                value={ledgerDraft.amount}
                onChange={(e) => onLedgerDraftChange('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            {ledgerCategoryDeleteConfirmId && (
              <div className="ledger-category-delete-confirm">
                <span>删除这个类别？</span>
                <button className="ledger-category-delete-cancel" onClick={cancelDeleteLedgerCategory}>取消</button>
                <button className="ledger-category-delete-danger" onClick={confirmDeleteLedgerCategory}>删除</button>
              </div>
            )}
            <div className="category-chip-row">
              {draftCategories.map((c) => {
                const active = ledgerDraft.category === c.key;
                return (
                  <button
                    key={c.id || c.key}
                    className="category-chip"
                    style={{
                      borderColor: categoryEditMode ? '#C4645E' : active ? c.color : 'rgba(58,50,54,0.12)',
                      background: active && !categoryEditMode ? `${c.color}33` : 'transparent',
                      color: categoryEditMode ? '#C4645E' : active ? '#4A4048' : '#6B6268',
                    }}
                    onClick={() => (categoryEditMode ? requestDeleteLedgerCategory(c.id) : onLedgerDraftChange('category', c.key))}
                  >
                    {categoryEditMode ? (
                      <TrashIcon color="#C4645E" width={10} height={10} />
                    ) : (
                      <span className="category-chip-dot" style={{ background: c.color }} />
                    )}
                    {c.key}
                  </button>
                );
              })}
              <button className="category-chip category-chip--add" onClick={() => setAddingCategory(true)}>
                <PlusIcon color="#8C7A82" width={12} height={12} />
              </button>
              <button
                className="category-chip category-chip--add"
                style={{ borderColor: categoryEditMode ? '#C4645E' : 'rgba(58,50,54,0.12)' }}
                onClick={() => setCategoryEditMode((v) => !v)}
              >
                <PencilIcon color={categoryEditMode ? '#C4645E' : '#8C7A82'} width={12} height={12} />
              </button>
            </div>
            {addingCategory && (
              <div className="ledger-category-add-row">
                <input
                  className="provider-form-input"
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  placeholder="新类别名称…"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmAddCategory()}
                />
                <button className="ai-key-save-btn" onClick={confirmAddCategory}>添加</button>
              </div>
            )}
            <input
              className="provider-form-input"
              style={{ marginBottom: 12 }}
              value={ledgerDraft.note}
              onChange={(e) => onLedgerDraftChange('note', e.target.value)}
              placeholder="备注…"
            />
            <input
              className="provider-form-input ledger-date-input"
              style={{ marginBottom: 20 }}
              type="date"
              value={ledgerDraft.dateISO}
              onChange={(e) => onLedgerDraftChange('dateISO', e.target.value)}
            />
            <button className="ai-key-save-btn" style={{ width: '100%', padding: '13px 0' }} onClick={saveLedgerEntry}>保存</button>
          </div>
        </div>
      )}
    </>
  );
}

function BudgetSection() {
  const ledgerBudgets = useStore((s) => s.ledgerBudgets);
  const ledgerBudgetMonth = useStore((s) => s.ledgerBudgetMonth);
  const ledgerEntries = useStore((s) => s.ledgerEntries);
  const expenseCategories = useStore((s) => s.expenseCategories);
  const loadLedgerBudgets = useStore((s) => s.loadLedgerBudgets);
  const saveLedgerBudgetAction = useStore((s) => s.saveLedgerBudgetAction);

  const [editingCategory, setEditingCategory] = useState(null);
  const [draftAmount, setDraftAmount] = useState('');

  useEffect(() => {
    loadLedgerBudgets(ledgerBudgetMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shiftMonth = (delta) => {
    const [y, m] = ledgerBudgetMonth.split('-').map(Number);
    const next = monthPrefixFor(new Date(y, m - 1 + delta, 1));
    loadLedgerBudgets(next);
  };

  const [by, bm] = ledgerBudgetMonth.split('-').map(Number);
  const monthLabel = monthLabelFor(new Date(by, bm - 1, 1));

  const spentByCategory = {};
  ledgerEntries
    .filter((e) => e.type === 'expense' && e.dateISO.startsWith(ledgerBudgetMonth))
    .forEach((e) => {
      spentByCategory[e.category] = (spentByCategory[e.category] || 0) + e.amount;
    });
  const budgetByCategory = {};
  ledgerBudgets.forEach((b) => {
    budgetByCategory[b.category] = b.amount;
  });

  return (
    <div className="manage-sub__body">
      <SubTabPill />
      <div className="ledger-summary-card">
        <div className="ledger-month-nav">
          <button className="ledger-month-nav-btn" onClick={() => shiftMonth(-1)}>
            <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M6 1L1 5.5L6 10" stroke="#8C7A82" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="ledger-month-label">{monthLabel}</div>
          <button className="ledger-month-nav-btn" onClick={() => shiftMonth(1)}>
            <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M1 1L6 5.5L1 10" stroke="#8C7A82" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {expenseCategories.map((c) => {
        const spent = spentByCategory[c.key] || 0;
        const budget = budgetByCategory[c.key];
        const hasBudget = budget != null;
        const percent = hasBudget && budget > 0 ? Math.round((spent / budget) * 100) : 0;
        const over = hasBudget && spent > budget;
        const isEditing = editingCategory === c.key;

        return (
          <div key={c.key} className="budget-row">
            <div className="budget-row-head">
              <span className="category-chip-dot" style={{ background: c.color }} />
              <span className="budget-row-name">{c.key}</span>
              <span className="budget-row-amounts" style={{ color: over ? '#C4645E' : 'var(--color-text)' }}>
                ¥{spent.toFixed(2)}{hasBudget ? ` / ¥${budget.toFixed(2)}` : ''}
              </span>
            </div>
            {hasBudget && (
              <div className="ledger-bar-track">
                <div className="ledger-bar-fill" style={{ width: `${Math.min(100, Math.max(4, percent))}%`, background: over ? '#C4645E' : c.color }} />
              </div>
            )}
            {isEditing ? (
              <div className="ledger-category-add-row">
                <input
                  className="provider-form-input"
                  type="number"
                  step="0.01"
                  value={draftAmount}
                  onChange={(e) => setDraftAmount(e.target.value)}
                  placeholder="预算金额"
                  autoFocus
                />
                <button
                  className="ai-key-save-btn"
                  onClick={async () => {
                    await saveLedgerBudgetAction(c.key, draftAmount);
                    setEditingCategory(null);
                  }}
                >
                  保存
                </button>
              </div>
            ) : (
              <button
                className="budget-row-edit-link budget-row-edit-link--corner"
                onClick={() => {
                  setEditingCategory(c.key);
                  setDraftAmount(hasBudget ? String(budget) : '');
                }}
              >
                {hasBudget ? '修改预算' : '设置预算'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
