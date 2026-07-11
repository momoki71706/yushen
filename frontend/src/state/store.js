import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, API_BASE_URL } from '../api/client';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../push';

const MOOD_PALETTE = { 开心: '#EDD9E1', 平静: '#E0D2D9', 难过: '#C9AEB9', 兴奋: '#E7D6CE', 疲惫: '#CBB9C0' };
const WEATHER_PALETTE = { 晴: '#EFE3D3', 多云: '#DED3D8', 雨: '#CDBFC5', 雪: '#F3EDEF', 风: '#D9CBD1' };

// A regenerate response replaces a whole message group at once: some ids
// disappear (removedIds), and `replies` is either updated rows sharing an
// id already in the list (a collapsed-in-place historical regenerate) or
// brand-new rows with fresh ids (a trailing-group regenerate that expanded
// into a different number of bubbles) — see routes/chat.js's
// replaceTheirsGroup for which case produces which.
function mergeReplacedMessages(messages, replies, removedIds) {
  const removed = new Set(removedIds || []);
  const kept = messages.filter((m) => !removed.has(m.id));
  const keptIds = new Set(kept.map((m) => m.id));
  const toAppend = replies.filter((r) => !keptIds.has(r.id));
  const merged = kept.map((m) => replies.find((r) => r.id === m.id) || m);
  return [...merged, ...toAppend];
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function parseLocalDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function isDateDue(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseLocalDate(iso);
  d.setHours(0, 0, 0, 0);
  return d <= today;
}

function todayISOLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthPrefixFor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const EXPENSE_CATEGORIES = [
  { key: '餐饮', color: '#EDD9E1' }, { key: '交通', color: '#D9CBD3' },
  { key: '购物', color: '#E7D6CE' }, { key: '娱乐', color: '#CBB9C0' },
  { key: '居家', color: '#D6C4CB' }, { key: '医疗', color: '#C9AEB9' },
  { key: '其他', color: '#DED3D8' },
];
const INCOME_CATEGORIES = [
  { key: '工资', color: '#E0D2D9' }, { key: '红包', color: '#F1E0E8' }, { key: '其他', color: '#DED3D8' },
];
const HABIT_COLORS = ['#D9CBD3', '#CBB9C0', '#E7D6CE', '#EDD9E1', '#D6C4CB'];
const LEDGER_MESSAGES = ['今天的咖啡花了多少？', '这个月还剩不到一半啦，省着点花', '钱包瘦了没关系，晚点我请你', '今天有没有乱花钱呀，如实交代', '记账这件事，坚持一下下就好'];
const HABIT_MESSAGES = ['喝水了吗baby？', '已经连续这么多天了，继续保持呀', '今天的小习惯，打卡了吗', '别偷懒，我在看着呢', '坚持一下，明天的你会谢谢今天的自己'];

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

function pickDaily(arr) {
  return arr[dayOfYear() % arr.length];
}

export const useStore = create(
  persist(
    (set, get) => ({
  moodPalette: MOOD_PALETTE,
  weatherPalette: WEATHER_PALETTE,
  parseLocalDate,
  isDateDue,

  // ---- ui / navigation ----
  sidebarOpen: false,
  activeTab: 'home',
  homeMode: 'chat',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab, sidebarOpen: false }),
  setHomeMode: (mode) => set({ homeMode: mode }),

  // ---- settings / nickname ----
  nickname: '屿深',
  nicknameEditing: false,
  nicknameDraft: '',
  letterReminderEnabled: true,
  loadSettings: async () => {
    const settings = await api.getSettings();
    set({ nickname: settings.nickname, letterReminderEnabled: settings.letterReminderEnabled });
  },
  startEditNickname: () => set((s) => ({ nicknameEditing: true, nicknameDraft: s.nickname })),
  onNicknameChange: (value) => set({ nicknameDraft: value }),
  saveNickname: async () => {
    const val = (get().nicknameDraft || '').trim();
    const nickname = val || get().nickname;
    set({ nickname, nicknameEditing: false });
    await api.updateSettings({ nickname });
  },
  toggleLetterReminderSetting: async () => {
    const enabled = !get().letterReminderEnabled;
    set({ letterReminderEnabled: enabled });
    await api.updateSettings({ letterReminderEnabled: enabled });
  },

  // ---- proactive push notifications + tunable settings (sidebar panel) ----
  pushSettingsOpen: false,
  pushEnabled: false,
  pushToggleBusy: false,
  pushToggleError: '',
  pushIdleThresholdMinutes: 240,
  pushMinGapMinutes: 180,
  pushRecheckMinutes: 60,
  pushQuietHourStart: 0,
  pushQuietHourEnd: 8,
  diaryNotifyEnabled: false,
  diaryNotifyBusy: false,
  openPushSettings: () => {
    set({ pushSettingsOpen: true });
    get().loadPushSettings();
  },
  closePushSettings: () => set({ pushSettingsOpen: false }),
  loadPushSettings: async () => {
    try {
      const s = await api.getPushSettings();
      set({
        pushEnabled: s.enabled,
        pushIdleThresholdMinutes: s.idleThresholdMinutes,
        pushMinGapMinutes: s.minGapMinutes,
        pushRecheckMinutes: s.recheckMinutes,
        pushQuietHourStart: s.quietHourStart,
        pushQuietHourEnd: s.quietHourEnd,
        diaryNotifyEnabled: s.diaryNotifyEnabled,
      });
    } catch {
      // backend not reachable yet — leave defaults
    }
  },
  toggleDiaryNotifyEnabled: async () => {
    if (get().diaryNotifyBusy) return;
    const next = !get().diaryNotifyEnabled;
    set({ diaryNotifyBusy: true });
    try {
      await api.updatePushSettings({ diaryNotifyEnabled: next });
      set({ diaryNotifyEnabled: next });
    } finally {
      set({ diaryNotifyBusy: false });
    }
  },
  togglePushEnabled: async () => {
    if (get().pushToggleBusy) return;
    const next = !get().pushEnabled;
    set({ pushToggleBusy: true, pushToggleError: '' });
    try {
      if (next) {
        if (!isPushSupported()) throw new Error('这台设备不支持推送通知');
        await subscribeToPush();
      } else {
        await unsubscribeFromPush();
      }
      await api.updatePushSettings({ enabled: next });
      set({ pushEnabled: next });
    } catch (err) {
      set({ pushToggleError: err.message });
    } finally {
      set({ pushToggleBusy: false });
    }
  },
  // key is 'quietHourStart' | 'quietHourEnd'
  adjustPushSetting: async (key, delta, min, max) => {
    const stateKey = `push${key[0].toUpperCase()}${key.slice(1)}`;
    const current = get()[stateKey];
    const next = Math.max(min, Math.min(max, current + delta));
    if (next === current) return;
    set({ [stateKey]: next });
    await api.updatePushSettings({ [key]: next });
  },
  // key is 'idleThresholdMinutes' | 'minGapMinutes' | 'recheckMinutes' —
  // driven by the HoursMinutesPicker scroll wheels rather than a stepper.
  setPushMinutesSetting: async (key, minutes) => {
    const stateKey = `push${key[0].toUpperCase()}${key.slice(1)}`;
    if (get()[stateKey] === minutes) return;
    set({ [stateKey]: minutes });
    await api.updatePushSettings({ [key]: minutes });
  },

  // ---- export memories ----
  exportBusy: false,
  exportMessage: '',
  exportChooserOpen: false,
  openExportChooser: () => set({ exportChooserOpen: true }),
  closeExportChooser: () => set({ exportChooserOpen: false }),
  downloadExportResult: (result, emptyMessage) => {
    const { content, filename, hasContent } = result;
    if (!hasContent) {
      set({ exportMessage: emptyMessage });
    } else {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      set({ exportMessage: `已导出 ${filename}` });
    }
    const message = get().exportMessage;
    setTimeout(() => {
      if (get().exportMessage === message) set({ exportMessage: '' });
    }, 30000);
  },
  // "本次回忆" — the normal incremental export: everything new since the
  // last export, which also advances the watermark so it won't show up
  // in the next one.
  exportMemoriesAction: async () => {
    if (get().exportBusy) return;
    set({ exportBusy: true, exportMessage: '', exportChooserOpen: false });
    try {
      const result = await api.exportMemories();
      get().downloadExportResult(result, '这次没有新内容可以导出');
    } catch (err) {
      set({ exportMessage: `导出失败：${err.message}` });
    } finally {
      set({ exportBusy: false });
    }
  },
  // "上次回忆" — re-serves whatever the previous export already produced,
  // without touching any watermark, for recovering a lost/closed download.
  exportLastMemoriesAction: async () => {
    if (get().exportBusy) return;
    set({ exportBusy: true, exportMessage: '', exportChooserOpen: false });
    try {
      const result = await api.getLastExport();
      get().downloadExportResult(result, '还没有导出过任何内容');
    } catch (err) {
      set({ exportMessage: `导出失败：${err.message}` });
    } finally {
      set({ exportBusy: false });
    }
  },

  // ---- manage: ledger + habits ----
  expenseCategories: EXPENSE_CATEGORIES,
  incomeCategories: INCOME_CATEGORIES,
  categoryColor: (key) => {
    const all = [...get().expenseCategories, ...get().incomeCategories];
    return (all.find((c) => c.key === key) || { color: '#DED3D8' }).color;
  },
  habitColors: HABIT_COLORS,
  todayISOLocal,

  manageView: 'home', // 'home' | 'ledger' | 'habits' | 'watch' | 'screentime'
  openLedger: () => {
    set({ manageView: 'ledger' });
    if (!get().ledgerLoaded) get().loadLedgerEntries();
    if (!get().ledgerCategoriesLoaded) get().loadLedgerCategories();
  },
  openHabits: () => {
    set({ manageView: 'habits' });
    if (!get().habitsLoaded) get().loadHabits();
  },
  closeManageSubview: () => set({ manageView: 'home' }),

  ledgerEntries: [],
  ledgerLoaded: false,
  ledgerCategoriesLoaded: false,
  ledgerSubTab: 'entries', // 'entries' | 'budget'
  setLedgerSubTab: (tab) => set({ ledgerSubTab: tab }),
  ledgerMonthOffset: 0,
  ledgerChartMode: 'pie',
  ledgerChartType: 'expense', // 'expense' | 'income' — which side the bar chart shows
  ledgerDrilldownCategory: null,
  ledgerShowAdd: false,
  ledgerDraft: null,
  editingLedgerEntryId: null,
  ledgerCardMessage: pickDaily(LEDGER_MESSAGES),
  ledgerCardConfirmOpen: false,
  ledgerCardRegenerating: false,
  ledgerCardError: '',
  loadLedgerCardMessage: async () => {
    try {
      const { message } = await api.getLedgerCardMessage();
      if (message) set({ ledgerCardMessage: message });
    } catch {
      // backend not reachable yet — leave the placeholder in place
    }
  },
  requestRegenerateLedgerCard: () => set({ ledgerCardConfirmOpen: true, ledgerCardError: '' }),
  cancelRegenerateLedgerCard: () => set({ ledgerCardConfirmOpen: false }),
  confirmRegenerateLedgerCard: async () => {
    set({ ledgerCardRegenerating: true, ledgerCardError: '' });
    try {
      const res = await api.regenerateLedgerCardMessage();
      set({
        ledgerCardMessage: res.message || (res.empty ? '今天还没记账呢' : get().ledgerCardMessage),
        ledgerCardConfirmOpen: false,
      });
    } catch (err) {
      set({ ledgerCardError: err.message || '生成失败，再试一次吧' });
    } finally {
      set({ ledgerCardRegenerating: false });
    }
  },
  loadLedgerEntries: async () => {
    const ledgerEntries = await api.getLedgerEntries();
    set({ ledgerEntries, ledgerLoaded: true });
  },
  loadLedgerCategories: async () => {
    const categories = await api.getLedgerCategories();
    set({
      expenseCategories: categories.filter((c) => c.type === 'expense'),
      incomeCategories: categories.filter((c) => c.type === 'income'),
      ledgerCategoriesLoaded: true,
    });
  },
  addLedgerCategoryAction: async (type, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const category = await api.addLedgerCategory({ type, name: trimmed });
    set((s) => ({
      expenseCategories: type === 'expense' ? [...s.expenseCategories, category] : s.expenseCategories,
      incomeCategories: type === 'income' ? [...s.incomeCategories, category] : s.incomeCategories,
    }));
  },
  deleteLedgerCategoryAction: async (id) => {
    await api.deleteLedgerCategory(id);
    set((s) => ({
      expenseCategories: s.expenseCategories.filter((c) => c.id !== id),
      incomeCategories: s.incomeCategories.filter((c) => c.id !== id),
    }));
  },
  ledgerCategoryDeleteConfirmId: null,
  requestDeleteLedgerCategory: (id) => set({ ledgerCategoryDeleteConfirmId: id }),
  cancelDeleteLedgerCategory: () => set({ ledgerCategoryDeleteConfirmId: null }),
  confirmDeleteLedgerCategory: async () => {
    const id = get().ledgerCategoryDeleteConfirmId;
    if (!id) return;
    await get().deleteLedgerCategoryAction(id);
    set({ ledgerCategoryDeleteConfirmId: null });
  },
  ledgerPrevMonth: () => set((s) => ({ ledgerMonthOffset: s.ledgerMonthOffset - 1 })),
  ledgerNextMonth: () => set((s) => ({ ledgerMonthOffset: Math.min(0, s.ledgerMonthOffset + 1) })),
  setLedgerChartMode: (mode) => set({ ledgerChartMode: mode }),
  setLedgerChartType: (type) => set({ ledgerChartType: type, ledgerDrilldownCategory: null }),
  toggleLedgerDrilldown: (category) =>
    set((s) => ({ ledgerDrilldownCategory: s.ledgerDrilldownCategory === category ? null : category })),
  openLedgerAdd: () =>
    set({
      ledgerShowAdd: true,
      ledgerDraft: { type: 'expense', category: get().expenseCategories[0]?.key || '', amount: '', note: '', dateISO: todayISOLocal() },
    }),
  closeLedgerAdd: () => set({ ledgerShowAdd: false, ledgerDraft: null, editingLedgerEntryId: null, ledgerEntryDeleteConfirmId: null }),
  startEditLedgerEntry: (entry) =>
    set({
      ledgerShowAdd: true,
      editingLedgerEntryId: entry.id,
      ledgerDraft: {
        type: entry.type,
        category: entry.category,
        amount: String(entry.amount),
        note: entry.note || '',
        dateISO: entry.dateISO,
      },
    }),
  onLedgerDraftChange: (field, value) =>
    set((s) => ({
      ledgerDraft: {
        ...s.ledgerDraft,
        [field]: value,
        ...(field === 'type'
          ? { category: (value === 'income' ? s.incomeCategories[0]?.key : s.expenseCategories[0]?.key) || '' }
          : {}),
      },
    })),
  saveLedgerEntry: async () => {
    const { ledgerDraft, editingLedgerEntryId } = get();
    const amount = parseFloat(ledgerDraft.amount);
    if (!amount || amount <= 0) return;
    const entry = editingLedgerEntryId
      ? await api.updateLedgerEntry(editingLedgerEntryId, { ...ledgerDraft, amount })
      : await api.addLedgerEntry({ ...ledgerDraft, amount });
    set((s) => ({
      ledgerEntries: editingLedgerEntryId
        ? s.ledgerEntries.map((e) => (e.id === editingLedgerEntryId ? entry : e))
        : [entry, ...s.ledgerEntries],
      ledgerShowAdd: false,
      ledgerDraft: null,
      editingLedgerEntryId: null,
    }));
  },
  deleteLedgerEntryAction: async (id) => {
    await api.deleteLedgerEntry(id);
    set((s) => ({ ledgerEntries: s.ledgerEntries.filter((e) => e.id !== id) }));
  },
  // Delete now lives inside the edit sheet itself (see LedgerView.jsx)
  // rather than a separate swipe gesture — same request/confirm/cancel
  // shape as the category delete confirm above.
  ledgerEntryDeleteConfirmId: null,
  requestDeleteLedgerEntry: (id) => set({ ledgerEntryDeleteConfirmId: id }),
  cancelDeleteLedgerEntry: () => set({ ledgerEntryDeleteConfirmId: null }),
  confirmDeleteLedgerEntry: async () => {
    const id = get().ledgerEntryDeleteConfirmId;
    if (!id) return;
    await get().deleteLedgerEntryAction(id);
    set({ ledgerEntryDeleteConfirmId: null, ledgerShowAdd: false, ledgerDraft: null, editingLedgerEntryId: null });
  },

  ledgerBudgets: [],
  ledgerBudgetsLoaded: false,
  ledgerBudgetMonth: monthPrefixFor(new Date()),
  loadLedgerBudgets: async (month) => {
    const targetMonth = month || get().ledgerBudgetMonth;
    const ledgerBudgets = await api.getLedgerBudgets(targetMonth);
    set({ ledgerBudgets, ledgerBudgetsLoaded: true, ledgerBudgetMonth: targetMonth });
  },
  saveLedgerBudgetAction: async (category, amount) => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 0) return;
    const budget = await api.saveLedgerBudget({ month: get().ledgerBudgetMonth, category, amount: amt });
    set((s) => ({ ledgerBudgets: [...s.ledgerBudgets.filter((b) => b.category !== category), budget] }));
  },
  deleteLedgerBudgetAction: async (id) => {
    await api.deleteLedgerBudget(id);
    set((s) => ({ ledgerBudgets: s.ledgerBudgets.filter((b) => b.id !== id) }));
  },

  habits: [],
  habitsLoaded: false,
  habitsShowAdd: false,
  habitsDraft: null,
  habitsDayDetailDate: null,
  habitCardMessage: pickDaily(HABIT_MESSAGES),
  loadHabits: async () => {
    const habits = await api.getHabits();
    set({ habits, habitsLoaded: true });
  },
  openHabitsAdd: () => set({ habitsShowAdd: true, habitsDraft: { name: '', color: HABIT_COLORS[0] } }),
  closeHabitsAdd: () => set({ habitsShowAdd: false, habitsDraft: null }),
  onHabitsDraftChange: (field, value) => set((s) => ({ habitsDraft: { ...s.habitsDraft, [field]: value } })),
  saveHabit: async () => {
    const { habitsDraft } = get();
    if (!habitsDraft.name.trim()) return;
    const habit = await api.addHabit({ name: habitsDraft.name.trim(), color: habitsDraft.color });
    set((s) => ({ habits: [...s.habits, habit], habitsShowAdd: false, habitsDraft: null }));
  },
  deleteHabitAction: async (id) => {
    await api.deleteHabit(id);
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
  },
  toggleHabitCheckin: async (id, dateISO) => {
    const { checkins } = await api.toggleHabitCheckin(id, dateISO);
    set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, checkins } : h)) }));
  },
  openHabitsDayDetail: (iso) => set({ habitsDayDetailDate: iso }),
  closeHabitsDayDetail: () => set({ habitsDayDetailDate: null }),

  // ---- manage: watch (real HealthKit via iOS Shortcut) + screentime (real open-events) ----
  openWatch: () => {
    set({ manageView: 'watch' });
    get().loadHealthLogs();
  },
  openScreentime: () => {
    set({ manageView: 'screentime' });
    get().loadPhoneActivity();
  },

  healthLogs: [],
  loadHealthLogs: async () => {
    try {
      const healthLogs = await api.getHealthLogs();
      set({ healthLogs });
    } catch {
      // backend not reachable yet — leave whatever was there
    }
  },

  phoneActivity: [],
  loadPhoneActivity: async () => {
    try {
      const phoneActivity = await api.getPhoneActivity();
      set({ phoneActivity });
    } catch {
      // backend not reachable yet
    }
  },

  // ---- 健康数据接入 sidebar panel: URL + token for the iOS Shortcuts setup ----
  healthDataPanelOpen: false,
  healthToken: '',
  healthTokenLoading: false,
  healthTokenRegenConfirmOpen: false,
  openHealthDataPanel: () => {
    set({ healthDataPanelOpen: true });
    get().loadHealthToken();
  },
  closeHealthDataPanel: () => set({ healthDataPanelOpen: false, healthTokenRegenConfirmOpen: false }),
  loadHealthToken: async () => {
    set({ healthTokenLoading: true });
    try {
      const { token } = await api.getHealthToken();
      set({ healthToken: token });
    } catch {
      // backend not reachable yet
    } finally {
      set({ healthTokenLoading: false });
    }
  },
  requestRegenerateHealthToken: () => set({ healthTokenRegenConfirmOpen: true }),
  cancelRegenerateHealthToken: () => set({ healthTokenRegenConfirmOpen: false }),
  confirmRegenerateHealthToken: async () => {
    set({ healthTokenLoading: true });
    try {
      const { token } = await api.regenerateHealthToken();
      set({ healthToken: token, healthTokenRegenConfirmOpen: false });
    } finally {
      set({ healthTokenLoading: false });
    }
  },

  // ---- 亲密控制 sidebar panel: master switch, ceiling, manual slider, bridge setup ----
  devicePanelOpen: false,
  deviceEnabled: false,
  deviceMaxIntensity: 60,
  deviceIntensity: 0,
  deviceBridgeOnline: false,
  deviceBridgeToken: '',
  deviceManualIntensity: 0, // the slider position the user is dragging
  deviceApiBase: API_BASE_URL,
  _devicePollTimer: null,
  openDevicePanel: () => {
    set({ devicePanelOpen: true });
    get().loadDeviceStatus();
    get().loadDeviceBridgeToken();
    // While the panel is open, refresh status so the "桥接在线" dot and live
    // intensity track reality (the bridge polls independently of the app).
    const timer = setInterval(() => get().loadDeviceStatus(), 2000);
    set({ _devicePollTimer: timer });
  },
  closeDevicePanel: () => {
    const t = get()._devicePollTimer;
    if (t) clearInterval(t);
    set({ devicePanelOpen: false, _devicePollTimer: null });
  },
  loadDeviceStatus: async () => {
    try {
      const s = await api.getDeviceStatus();
      set({
        deviceEnabled: s.enabled,
        deviceMaxIntensity: s.maxIntensity,
        deviceIntensity: s.intensity,
        deviceBridgeOnline: s.bridgeOnline,
      });
    } catch {
      // backend not reachable yet
    }
  },
  loadDeviceBridgeToken: async () => {
    try {
      const { token } = await api.getDeviceBridgeInfo();
      set({ deviceBridgeToken: token });
    } catch {
      // ignore
    }
  },
  toggleDeviceEnabled: async () => {
    const next = !get().deviceEnabled;
    set({ deviceEnabled: next });
    try {
      const s = await api.updateDeviceSettings({ enabled: next });
      set({ deviceEnabled: s.enabled, deviceIntensity: s.intensity });
    } catch {
      set({ deviceEnabled: !next });
    }
  },
  setDeviceMaxIntensity: async (value) => {
    set({ deviceMaxIntensity: value });
    try {
      await api.updateDeviceSettings({ maxIntensity: value });
    } catch {
      // ignore; next status refresh corrects it
    }
  },
  // The manual slider: setting it sends a rolling command that auto-expires,
  // so leaving the slider up keeps it going only as long as we keep nudging;
  // the panel re-sends while the user holds a non-zero value.
  setDeviceManualIntensity: async (value) => {
    set({ deviceManualIntensity: value });
    try {
      if (value <= 0) {
        await api.stopDevice();
      } else {
        await api.sendDeviceCommand({ intensity: value, durationSeconds: 3 });
      }
    } catch {
      // ignore
    }
  },
  stopDeviceManual: async () => {
    set({ deviceManualIntensity: 0 });
    try {
      await api.stopDevice();
    } catch {
      // ignore
    }
  },

  screenReminderEnabled: true,
  toggleScreenReminder: () => set((s) => ({ screenReminderEnabled: !s.screenReminderEnabled })),
  screenThreshold: 4,
  incThreshold: () => set((s) => ({ screenThreshold: Math.min(12, s.screenThreshold + 0.5) })),
  decThreshold: () => set((s) => ({ screenThreshold: Math.max(0.5, s.screenThreshold - 0.5) })),

  screenAppSettingsOpen: false,
  toggleScreenAppSettings: () => set((s) => ({ screenAppSettingsOpen: !s.screenAppSettingsOpen })),
  screenAppThresholds: {},
  screenAppReminders: {},
  adjustScreenAppThreshold: (name, delta) =>
    set((s) => {
      const current = s.screenAppThresholds[name] ?? 2;
      const next = Math.max(0.5, Math.min(12, current + delta));
      return { screenAppThresholds: { ...s.screenAppThresholds, [name]: next } };
    }),
  toggleScreenAppReminder: (name) =>
    set((s) => ({
      screenAppReminders: { ...s.screenAppReminders, [name]: !(s.screenAppReminders[name] ?? true) },
    })),

  // ---- chat ----
  messages: [],
  chatDraft: '',
  isReplying: false,
  chatLastReadId: 0,
  chatScrollTop: null, // last known scroll position — restored on remount instead of always snapping to bottom
  // Called on boot and on every refocus/visibility change, so a single
  // network blip (common on a cross-region link) must not blank the chat.
  // Retries a couple times with backoff, and on total failure keeps whatever
  // messages are already on screen rather than clearing them.
  loadMessages: async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const messages = await api.getMessages();
        set({ messages });
        return;
      } catch (err) {
        if (attempt === 2) {
          console.warn('[chat] failed to load messages, keeping current view:', err.message);
          return;
        }
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  },
  loadChatReadStatus: async () => {
    const { lastReadChatMessageId } = await api.getChatReadStatus();
    set({ chatLastReadId: lastReadChatMessageId });
  },
  // Called by ChatMode whenever it's actually mounted and showing current
  // messages — feeds the backend's read-but-unanswered follow-up scheduler,
  // which otherwise has no way to know whether a question sitting unreplied
  // has actually been seen yet. Also advances chatLastReadId locally so the
  // ✓/○ marker next to his messages flips to read right after this fires,
  // instead of waiting for the next full reload.
  markChatRead: () => {
    api
      .markChatRead()
      .then(() => {
        set((s) => {
          const maxId = s.messages.reduce((m, msg) => (typeof msg.id === 'number' && msg.id > m ? msg.id : m), 0);
          return { chatLastReadId: maxId };
        });
      })
      .catch(() => {});
  },
  onChatChange: (value) => set({ chatDraft: value }),
  pushMessage: async (text, kind = 'text', attachment = null) => {
    set((s) => ({
      messages: [...s.messages, { id: `pending-${Date.now()}`, from: 'me', text, kind, attachment, time: '' }],
      isReplying: true,
    }));
    try {
      const { mine, replies } = await api.sendMessage(text, kind, attachment);
      set((s) => ({
        messages: [...s.messages.filter((m) => !String(m.id).startsWith('pending-')), mine, ...replies],
        isReplying: false,
      }));
    } catch (err) {
      set({ isReplying: false });
    }
  },
  // Sends several plain-text lines as separate consecutive "me" bubbles in
  // one request (reusing the same /chat/batch endpoint the attachment flow
  // uses) — only one AI reply is generated afterward, reacting to all of
  // them together, rather than firing once per line.
  pushMultiMessage: async (lines) => {
    const pendingPrefix = `pending-${Date.now()}`;
    const optimistic = lines.map((text, i) => ({ id: `${pendingPrefix}-${i}`, from: 'me', text, kind: 'text', time: '' }));
    set((s) => ({ messages: [...s.messages, ...optimistic], isReplying: true }));
    try {
      const { mine, replies } = await api.sendBatch(lines.map((text) => ({ text, kind: 'text' })));
      set((s) => ({
        messages: [...s.messages.filter((m) => !String(m.id).startsWith(pendingPrefix)), ...mine, ...replies],
        isReplying: false,
      }));
    } catch (err) {
      set((s) => ({
        messages: s.messages.filter((m) => !String(m.id).startsWith(pendingPrefix)),
        isReplying: false,
      }));
    }
  },
  sendChat: () => get().sendComposedMessage(),

  // ---- attachments (real image/file uploads via the chat "+" button) ----
  // Picking a file only stages it here as a small removable/reorderable
  // thumbnail — nothing is uploaded or sent until sendComposedMessage runs,
  // so you can review, drop, or add more before anything actually goes out.
  attachmentDraft: [],
  attachmentUploading: false,
  attachmentError: '',
  addAttachmentDraftFiles: (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const items = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      kind: file.type.startsWith('image/') ? 'image' : 'file',
    }));
    set((s) => ({ attachmentDraft: [...s.attachmentDraft, ...items] }));
  },
  removeAttachmentDraft: (id) =>
    set((s) => {
      const target = s.attachmentDraft.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return { attachmentDraft: s.attachmentDraft.filter((a) => a.id !== id) };
    }),
  reorderAttachmentDraft: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex === toIndex) return {};
      const next = [...s.attachmentDraft];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { attachmentDraft: next };
    }),
  clearAttachmentError: () => set({ attachmentError: '' }),
  // Uploads every staged file, then sends them together with any typed
  // text as one batch — inserted as consecutive turns before a single AI
  // reply is generated, so the reply can react to all of it as one thing
  // said at once instead of triggering a separate reply per attachment.
  sendComposedMessage: async () => {
    const text = (get().chatDraft || '').trim();
    const draft = get().attachmentDraft;
    if (!draft.length) {
      if (!text) return;
      set({ chatDraft: '' });
      // A line break (Shift+Enter while composing) means "send these as
      // separate bubbles" — mirrors how a split AI reply renders as several
      // consecutive messages, but for what you typed instead.
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        get().pushMultiMessage(lines);
      } else {
        get().pushMessage(text, 'text');
      }
      return;
    }

    const pendingPrefix = `pending-${Date.now()}`;
    const optimistic = draft.map((a, i) => ({
      id: `${pendingPrefix}-${i}`,
      from: 'me',
      kind: a.kind,
      text: '',
      time: '',
      attachment: { url: a.previewUrl, name: a.file.name, mime: a.file.type, size: a.file.size },
    }));
    if (text) optimistic.push({ id: `${pendingPrefix}-text`, from: 'me', kind: 'text', text, time: '' });

    set((s) => ({
      messages: [...s.messages, ...optimistic],
      chatDraft: '',
      attachmentDraft: [],
      attachmentUploading: true,
      attachmentError: '',
      isReplying: true,
    }));

    try {
      const uploaded = await Promise.all(draft.map((a) => api.uploadAttachment(a.file)));
      draft.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      const items = uploaded.map((u, i) => ({ text: '', kind: draft[i].kind, attachment: u }));
      if (text) items.push({ text, kind: 'text' });
      const { mine, replies } = await api.sendBatch(items);
      set((s) => ({
        messages: [...s.messages.filter((m) => !String(m.id).startsWith(pendingPrefix)), ...mine, ...replies],
        isReplying: false,
      }));
    } catch (err) {
      set((s) => ({
        messages: s.messages.filter((m) => !String(m.id).startsWith(pendingPrefix)),
        attachmentError: err.message,
        isReplying: false,
      }));
    } finally {
      set({ attachmentUploading: false });
    }
  },

  // ---- image viewer (tap an image bubble to view full-size) ----
  imageViewerUrl: null,
  openImageViewer: (url) => set({ imageViewerUrl: url }),
  closeImageViewer: () => set({ imageViewerUrl: null }),

  // ---- regenerate + thinking chain (per AI bubble) ----
  regeneratingIds: [],
  expandedThinkingIds: [],
  regenerateMessageAction: async (id) => {
    if (get().regeneratingIds.includes(id)) return;
    set((s) => ({ regeneratingIds: [...s.regeneratingIds, id] }));
    try {
      const { replies, removedIds } = await api.regenerateMessage(id);
      set((s) => ({ messages: mergeReplacedMessages(s.messages, replies, removedIds) }));
    } finally {
      set((s) => ({ regeneratingIds: s.regeneratingIds.filter((x) => x !== id) }));
    }
  },
  toggleThinkingExpanded: (id) =>
    set((s) => ({
      expandedThinkingIds: s.expandedThinkingIds.includes(id)
        ? s.expandedThinkingIds.filter((x) => x !== id)
        : [...s.expandedThinkingIds, id],
    })),

  // ---- regenerate / edit a round from your own message ----
  regeneratingRoundIds: [],
  editingMessageId: null,
  editDraft: '',
  startEditMessage: (id, text) => set({ editingMessageId: id, editDraft: text }),
  cancelEditMessage: () => set({ editingMessageId: null, editDraft: '' }),
  onEditDraftChange: (value) => set({ editDraft: value }),
  regenerateRoundAction: async (id) => {
    if (get().regeneratingRoundIds.includes(id)) return;
    const pairedReply = get().messages.find((m, i, arr) => arr[i - 1] && arr[i - 1].id === id && m.from === 'them');
    set((s) => ({
      regeneratingRoundIds: [...s.regeneratingRoundIds, id],
      regeneratingIds: pairedReply ? [...s.regeneratingIds, pairedReply.id] : s.regeneratingIds,
    }));
    try {
      const { replies, removedIds } = await api.regenerateChatRound(id);
      set((s) => ({ messages: mergeReplacedMessages(s.messages, replies, removedIds) }));
    } catch {
      // eligibility already checked client-side; a stale mismatch here just no-ops
    } finally {
      set((s) => ({
        regeneratingRoundIds: s.regeneratingRoundIds.filter((x) => x !== id),
        regeneratingIds: pairedReply ? s.regeneratingIds.filter((x) => x !== pairedReply.id) : s.regeneratingIds,
      }));
    }
  },
  saveEditMessage: async () => {
    const { editingMessageId, editDraft } = get();
    const text = editDraft.trim();
    if (!editingMessageId || !text) return;
    const updated = await api.editChatMessage(editingMessageId, text);
    set((s) => ({
      messages: s.messages.map((m) => (m.id === editingMessageId ? updated : m)),
      editingMessageId: null,
      editDraft: '',
    }));
    get().regenerateRoundAction(editingMessageId);
  },

  // ---- regenerate confirmation (either the reply-only or whole-round kind) ----
  regenerateConfirm: null, // { id, kind: 'reply' | 'round' }
  requestRegenerateMessage: (id, kind) => set({ regenerateConfirm: { id, kind } }),
  cancelRegenerateMessage: () => set({ regenerateConfirm: null }),
  confirmRegenerateMessage: () => {
    const confirm = get().regenerateConfirm;
    set({ regenerateConfirm: null });
    if (!confirm) return;
    if (confirm.kind === 'round') get().regenerateRoundAction(confirm.id);
    else get().regenerateMessageAction(confirm.id);
  },

  // ---- delete a single message (either side, confirmation gated) ----
  deleteConfirmMessageId: null,
  requestDeleteMessage: (id) => set({ deleteConfirmMessageId: id }),
  cancelDeleteMessage: () => set({ deleteConfirmMessageId: null }),
  confirmDeleteMessage: async () => {
    const { deleteConfirmMessageId } = get();
    if (!deleteConfirmMessageId) return;
    const { deletedIds } = await api.deleteChatMessage(deleteConfirmMessageId);
    const removed = new Set(deletedIds?.length ? deletedIds : [deleteConfirmMessageId]);
    set((s) => ({
      messages: s.messages.filter((m) => !removed.has(m.id)),
      deleteConfirmMessageId: null,
    }));
  },

  // ---- clear chat (confirmation gated, destructive) ----
  clearChatConfirmOpen: false,
  openClearChatConfirm: () => set({ clearChatConfirmOpen: true, sidebarOpen: false }),
  closeClearChatConfirm: () => set({ clearChatConfirmOpen: false }),
  confirmClearChat: async () => {
    await api.clearChat();
    set({ messages: [], clearChatConfirmOpen: false });
  },

  // ---- quick model switcher (bow icon popover) ----
  modelSwitcherOpen: false,
  openModelSwitcher: () => {
    set({ modelSwitcherOpen: true });
    get().loadAiMode();
    get().loadProviders();
  },
  closeModelSwitcher: () => set({ modelSwitcherOpen: false }),
  toggleModelSwitcher: () => {
    if (get().modelSwitcherOpen) get().closeModelSwitcher();
    else get().openModelSwitcher();
  },
  selectModelQuick: async (providerId, model) => {
    set({ modelSwitcherOpen: false, aiMode: 'provider', activeProviderId: providerId });
    await api.updateAiMode({ aiMode: 'provider', activeProviderId: providerId });
    const provider = get().providers.find((p) => p.id === providerId);
    if (provider && provider.selectedModel !== model) {
      await api.updateProvider(providerId, { selectedModel: model });
      get().loadProviders();
    }
  },
  selectClaudeCodeQuick: async () => {
    set({ modelSwitcherOpen: false });
    await get().selectClaudeCodeMode();
  },

  // ---- diary ----
  diaryEntries: [],
  diaryText: '',
  diarySelectedTags: [],
  diaryAttachmentDraft: [], // [{ id, file, previewUrl }]
  diaryAttachmentUploading: false,
  diaryAttachmentError: '',
  diaryView: 'list',
  diaryDetailId: null,
  diaryListScrollTop: 0,
  diarySearchQuery: '',
  diarySearchDate: '',
  showDiaryDatePicker: false,
  showCustomTagInput: false,
  customTagDraft: '',
  // Debug/manual trigger — forces him to write a diary entry right now
  // instead of waiting for the random 21:00-24:00 window, purely for
  // testing this (and whatever it triggers downstream) on demand.
  diaryTriggerBusy: false,
  diaryTriggerMessage: '',
  triggerDiaryWriteAction: async () => {
    set({ diaryTriggerBusy: true, diaryTriggerMessage: '' });
    try {
      const entry = await api.triggerDiaryWrite();
      const message = '他刚写了一篇日记';
      set((s) => ({ diaryEntries: [entry, ...s.diaryEntries], diaryTriggerMessage: message }));
      setTimeout(() => {
        if (get().diaryTriggerMessage === message) set({ diaryTriggerMessage: '' });
      }, 30000);
    } catch (err) {
      set({ diaryTriggerMessage: err.message });
    } finally {
      set({ diaryTriggerBusy: false });
    }
  },
  loadDiaryEntries: async () => {
    const diaryEntries = await api.getDiaryEntries();
    set({ diaryEntries });
  },
  onDiaryTextChange: (value) => set({ diaryText: value }),
  isDiaryTagSelected: (type, key) => get().diarySelectedTags.some((t) => t.type === type && t.key === key),
  toggleDiaryTag: (type, key) =>
    set((s) => {
      const exists = s.diarySelectedTags.some((t) => t.type === type && t.key === key);
      return {
        diarySelectedTags: exists
          ? s.diarySelectedTags.filter((t) => !(t.type === type && t.key === key))
          : [...s.diarySelectedTags, { type, key }],
      };
    }),
  pickDiaryAttachment: (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const items = files.map((file) => ({ id: `${Date.now()}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file) }));
    set((s) => ({ diaryAttachmentDraft: [...s.diaryAttachmentDraft, ...items], diaryAttachmentError: '' }));
  },
  removeDiaryAttachment: (id) => {
    set((s) => {
      const target = s.diaryAttachmentDraft.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return { diaryAttachmentDraft: s.diaryAttachmentDraft.filter((a) => a.id !== id) };
    });
  },
  toggleCustomTagInput: () => set((s) => ({ showCustomTagInput: !s.showCustomTagInput, customTagDraft: '' })),
  onCustomTagDraftChange: (value) => set({ customTagDraft: value }),
  addCustomTag: () => {
    const trimmed = (get().customTagDraft || '').trim();
    if (!trimmed) return;
    set((s) => ({
      diarySelectedTags: [...s.diarySelectedTags, { type: 'custom', key: trimmed }],
      showCustomTagInput: false,
      customTagDraft: '',
    }));
  },
  onDiarySearchChange: (value) => set({ diarySearchQuery: value }),
  toggleDiaryDatePicker: () => set((s) => ({ showDiaryDatePicker: !s.showDiaryDatePicker })),
  onDiarySearchDateChange: (value) => set({ diarySearchDate: value }),
  clearDiarySearchDate: () => set({ diarySearchDate: '' }),
  saveDiaryEntry: async () => {
    const { diaryText, diarySelectedTags, diaryAttachmentDraft } = get();
    const trimmed = (diaryText || '').trim();
    if (!trimmed) return;
    const moodTag = diarySelectedTags.find((t) => t.type === 'mood');
    const weatherTag = diarySelectedTags.find((t) => t.type === 'weather');
    const customTag = diarySelectedTags.find((t) => t.type === 'custom');
    const mood = moodTag ? moodTag.key : '平静';
    const weather = weatherTag ? weatherTag.key : '晴';

    set({ diaryAttachmentUploading: true, diaryAttachmentError: '' });
    try {
      const attachments = await Promise.all(diaryAttachmentDraft.map((a) => api.uploadAttachment(a.file)));
      const entry = await api.createDiaryEntry({
        text: trimmed,
        mood,
        weather,
        tag: customTag ? customTag.key : null,
        attachments,
      });
      diaryAttachmentDraft.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      set((s) => ({
        diaryEntries: [entry, ...s.diaryEntries],
        diaryText: '',
        diarySelectedTags: [],
        diaryAttachmentDraft: [],
      }));
    } catch (err) {
      set({ diaryAttachmentError: err.message });
    } finally {
      set({ diaryAttachmentUploading: false });
    }
  },
  openDiaryDetail: (id, scrollTop) => {
    set({ diaryView: 'detail', diaryDetailId: id, diaryListScrollTop: scrollTop || 0, diaryComments: [] });
    get().loadDiaryComments(id);
    // Optimistically clear the unread dot now rather than waiting on the
    // network call — she's looking at it either way.
    set((s) => ({ diaryEntries: s.diaryEntries.map((e) => (e.id === id ? { ...e, hasUnread: false } : e)) }));
    api.markDiaryEntryRead(id).catch(() => {});
  },
  closeDiaryDetail: () => set({ diaryView: 'list', diaryDetailId: null }),
  deleteDiaryEntry: async (id) => {
    await api.deleteDiaryEntry(id);
    set((s) => ({
      diaryEntries: s.diaryEntries.filter((e) => e.id !== id),
      diaryView: 'list',
      diaryDetailId: null,
    }));
  },

  // ---- diary comments (flat comment-section style, on the detail page) ----
  diaryComments: [],
  diaryCommentsLoading: false,
  diaryCommentDraft: '',
  diaryCommentSending: false,
  diaryRegeneratingIds: [],
  loadDiaryComments: async (entryId) => {
    set({ diaryCommentsLoading: true });
    try {
      const diaryComments = await api.getDiaryComments(entryId);
      set({ diaryComments });
    } finally {
      set({ diaryCommentsLoading: false });
    }
  },
  onDiaryCommentDraftChange: (value) => set({ diaryCommentDraft: value }),
  diaryCommentReplyTarget: null,
  startReplyToDiaryComment: (comment) => set({ diaryCommentReplyTarget: comment }),
  cancelReplyToDiaryComment: () => set({ diaryCommentReplyTarget: null }),
  addDiaryCommentAction: async () => {
    const { diaryDetailId, diaryCommentDraft, diaryCommentSending, diaryCommentReplyTarget } = get();
    const trimmed = (diaryCommentDraft || '').trim();
    if (!trimmed || diaryCommentSending || !diaryDetailId) return;
    set({ diaryCommentSending: true, diaryCommentDraft: '', diaryCommentReplyTarget: null });
    try {
      const { mine, reply } = await api.addDiaryComment(diaryDetailId, trimmed, diaryCommentReplyTarget?.id ?? null);
      set((s) => ({ diaryComments: [...s.diaryComments, mine, ...(reply ? [reply] : [])] }));
    } finally {
      set({ diaryCommentSending: false });
    }
  },
  diaryCommentDeleteConfirmId: null,
  requestDeleteDiaryComment: (id) => set({ diaryCommentDeleteConfirmId: id }),
  cancelDeleteDiaryComment: () => set({ diaryCommentDeleteConfirmId: null }),
  confirmDeleteDiaryComment: async () => {
    const id = get().diaryCommentDeleteConfirmId;
    if (!id) return;
    await api.deleteDiaryComment(id);
    set((s) => ({
      diaryComments: s.diaryComments.filter((c) => c.id !== id),
      diaryCommentDeleteConfirmId: null,
      diaryCommentReplyTarget: s.diaryCommentReplyTarget?.id === id ? null : s.diaryCommentReplyTarget,
    }));
  },
  regenerateDiaryEntryAction: async (id) => {
    if (get().diaryRegeneratingIds.includes(id)) return;
    set((s) => ({ diaryRegeneratingIds: [...s.diaryRegeneratingIds, id] }));
    try {
      const updated = await api.regenerateDiaryEntry(id);
      set((s) => ({
        diaryEntries: s.diaryEntries.map((e) => (e.id === id ? updated : e)),
        diaryComments: s.diaryDetailId === id ? [] : s.diaryComments,
      }));
    } finally {
      set((s) => ({ diaryRegeneratingIds: s.diaryRegeneratingIds.filter((x) => x !== id) }));
    }
  },

  // ---- diary reminder popup (shown on app open if there's unread diary content) ----
  showDiaryReminder: false,
  diaryUnreadEntries: 0,
  diaryUnreadComments: 0,
  checkDiaryReminder: async () => {
    try {
      const { unreadEntries, unreadComments } = await api.getDiaryUnreadSummary();
      if (unreadEntries > 0 || unreadComments > 0) {
        set({ showDiaryReminder: true, diaryUnreadEntries: unreadEntries, diaryUnreadComments: unreadComments });
      }
    } catch {
      // backend not reachable yet — just skip the reminder this time
    }
  },
  dismissDiaryReminder: () => set({ showDiaryReminder: false }),
  viewDiaryReminder: () =>
    set({ showDiaryReminder: false, activeTab: 'home', homeMode: 'diary', diaryView: 'list' }),

  // ---- letters ----
  letters: [],
  letterView: 'compose',
  letterMailboxTab: 'sent',
  letterRecipient: '屿深',
  letterUnlockDate: tomorrowISO(),
  letterText: '',
  letterSignature: '',
  letterDearText: '',
  showRecipientPicker: false,
  sealPulse: false,
  expandedLetterIds: [],
  showLetterReminder: false,
  editingLetterId: null,
  replyToId: null,
  showReplyPicker: false,
  replyRequestMessage: '',
  regeneratingLetterIds: [],
  openReplyPicker: () => set({ showReplyPicker: true, replyRequestMessage: '' }),
  closeReplyPicker: () => set({ showReplyPicker: false }),
  // Picking one of his received letters here doesn't generate anything by
  // itself — it just sets up Compose so you can write a real reply
  // yourself; whether he writes back is decided server-side once you
  // actually send it, same gating as before.
  startReplyToLetter: (letter) => {
    set({
      showReplyPicker: false,
      replyToId: letter.id,
      editingLetterId: null,
      letterText: '',
      letterRecipient: letter.sender,
      letterUnlockDate: tomorrowISO(),
      letterSignature: '',
      letterDearText: '',
      letterView: 'compose',
    });
  },
  cancelReplyToLetter: () =>
    set({
      replyToId: null,
      letterText: '',
      letterSignature: '',
      letterDearText: '',
      letterUnlockDate: tomorrowISO(),
      letterRecipient: '屿深',
    }),
  regenerateLetterAction: async (id) => {
    if (get().regeneratingLetterIds.includes(id)) return;
    set((s) => ({ regeneratingLetterIds: [...s.regeneratingLetterIds, id] }));
    try {
      const updated = await api.regenerateLetter(id);
      set((s) => ({ letters: s.letters.map((l) => (l.id === id ? updated : l)) }));
    } catch (err) {
      set({ replyRequestMessage: err.message });
    } finally {
      set((s) => ({ regeneratingLetterIds: s.regeneratingLetterIds.filter((x) => x !== id) }));
    }
  },
  loadLetters: async () => {
    const letters = await api.getLetters();
    set({ letters });
  },
  // Debug/manual trigger — there's no autonomous version of this (unlike
  // diary entries, nothing ever schedules him writing you an unprompted
  // letter), so this is also the only way to get a first received letter
  // into the mailbox without going through the reply chain first.
  letterTriggerBusy: false,
  letterTriggerMessage: '',
  triggerLetterWriteAction: async () => {
    set({ letterTriggerBusy: true, letterTriggerMessage: '' });
    try {
      const letter = await api.triggerLetterWrite();
      const message = '他刚给你写了一封信';
      set((s) => ({ letters: [letter, ...s.letters], letterTriggerMessage: message }));
      setTimeout(() => {
        if (get().letterTriggerMessage === message) set({ letterTriggerMessage: '' });
      }, 30000);
    } catch (err) {
      set({ letterTriggerMessage: err.message });
    } finally {
      set({ letterTriggerBusy: false });
    }
  },
  onLetterTextChange: (value) => set({ letterText: value }),
  onLetterSignatureChange: (value) => set({ letterSignature: value }),
  onLetterDearChange: (value) => set({ letterDearText: value }),
  onUnlockDateChange: (value) => set({ letterUnlockDate: value }),
  setLetterRecipient: (r) => set({ letterRecipient: r, showRecipientPicker: false }),
  toggleRecipientPicker: () => set((s) => ({ showRecipientPicker: !s.showRecipientPicker })),
  sealLetterAnimated: () => {
    if (!(get().letterText || '').trim()) return;
    set({ sealPulse: true });
    setTimeout(async () => {
      await get().sealLetter();
      set({ sealPulse: false });
    }, 420);
  },
  sealLetter: async () => {
    const { letterText, letterRecipient, letterUnlockDate, letterSignature, letterDearText, editingLetterId, replyToId } = get();
    const trimmed = (letterText || '').trim();
    if (!trimmed) return;
    const payload = {
      recipient: letterRecipient,
      unlockDate: letterUnlockDate || tomorrowISO(),
      body: trimmed,
      signature: letterSignature,
      dearText: letterDearText,
      ...(replyToId && !editingLetterId ? { replyToId } : {}),
    };
    const letter = editingLetterId ? await api.updateLetter(editingLetterId, payload) : await api.createLetter(payload);
    set((s) => ({
      letters: editingLetterId
        ? s.letters.map((l) => (l.id === editingLetterId ? letter : l))
        : [letter, ...s.letters],
      letterText: '',
      letterUnlockDate: tomorrowISO(),
      letterView: 'mailbox',
      letterMailboxTab: 'sent',
      editingLetterId: null,
      replyToId: null,
    }));
  },
  startEditLetter: (id) => {
    const letter = get().letters.find((l) => l.id === id);
    if (!letter || letter.sender !== '小晴') return;
    set({
      editingLetterId: id,
      replyToId: null,
      letterRecipient: letter.recipient,
      letterUnlockDate: letter.unlockDate,
      letterText: letter.body,
      letterSignature: letter.signature,
      letterDearText: letter.dearText || '',
      letterView: 'compose',
    });
  },
  cancelEditLetter: () =>
    set({
      editingLetterId: null,
      letterText: '',
      letterSignature: '',
      letterDearText: '',
      letterUnlockDate: tomorrowISO(),
      letterRecipient: '屿深',
    }),
  deleteLetterAction: async (id) => {
    await api.deleteLetter(id);
    set((s) => ({
      letters: s.letters.filter((l) => l.id !== id),
      expandedLetterIds: s.expandedLetterIds.filter((x) => x !== id),
    }));
  },
  openMailbox: () => set({ letterView: 'mailbox' }),
  closeMailbox: () => set({ letterView: 'compose' }),
  setMailboxTab: (tab) => set({ letterMailboxTab: tab }),
  toggleLetterItem: async (id) => {
    const letter = get().letters.find((l) => l.id === id);
    if (!letter) return;
    const expanded = get().expandedLetterIds.includes(id);
    set((s) => ({
      expandedLetterIds: expanded ? s.expandedLetterIds.filter((x) => x !== id) : [...s.expandedLetterIds, id],
    }));
    if (!expanded && isDateDue(letter.unlockDate) && !letter.opened) {
      const updated = await api.openLetter(id);
      set((s) => ({ letters: s.letters.map((l) => (l.id === id ? updated : l)) }));
    }
  },

  // ---- letter reminder ----
  checkLetterReminder: async () => {
    const status = await api.getReminderStatus();
    if (status.shouldShow) set({ showLetterReminder: true });
  },
  dismissReminder: async () => {
    set({ showLetterReminder: false });
    await api.updateSettings({ letterReminderDismissedDate: new Date().toDateString() });
  },
  viewReminderLetter: () => {
    set({
      showLetterReminder: false,
      activeTab: 'home',
      homeMode: 'letter',
      letterView: 'mailbox',
      letterMailboxTab: 'received',
      sidebarOpen: false,
    });
  },

  // ---- AI provider settings (level 1: mode/provider list, level 2: provider editor) ----
  aiSettingsOpen: false,
  aiMode: 'provider',
  activeProviderId: '',
  claudeCodeAvailable: false,
  providers: [],
  providerTestStatus: {},
  claudeCodeTestStatus: null,
  providerEditId: null, // null = level1, 'new' = creating, number = editing existing
  providerDraft: null,

  openAiSettings: () => {
    set({ aiSettingsOpen: true, providerEditId: null, providerDraft: null });
    get().loadAiMode();
    get().loadProviders();
  },
  closeAiSettings: () => set({ aiSettingsOpen: false, providerEditId: null, providerDraft: null }),
  loadAiMode: async () => {
    const s = await api.getAiMode();
    set({
      aiMode: s.aiMode,
      activeProviderId: s.activeProviderId,
      claudeCodeAvailable: s.claudeCodeAvailable,
      mcpToolsEnabled: !!s.mcpToolsEnabled,
    });
  },
  loadProviders: async () => {
    const providers = await api.getProviders();
    set({ providers });
  },
  selectClaudeCodeMode: async () => {
    set({ aiMode: 'claude-code' });
    await api.updateAiMode({ aiMode: 'claude-code' });
  },
  selectProvider: async (id) => {
    set({ aiMode: 'provider', activeProviderId: id });
    await api.updateAiMode({ aiMode: 'provider', activeProviderId: id });
  },
  testClaudeCodeAction: async () => {
    set({ claudeCodeTestStatus: { loading: true } });
    try {
      const result = await api.testClaudeCode();
      set({ claudeCodeTestStatus: { loading: false, ok: result.ok, message: result.message } });
    } catch (err) {
      set({ claudeCodeTestStatus: { loading: false, ok: false, message: err.message } });
    }
  },
  testProviderAction: async (id) => {
    set((s) => ({ providerTestStatus: { ...s.providerTestStatus, [id]: { loading: true } } }));
    try {
      const result = await api.testProvider(id);
      set((s) => ({ providerTestStatus: { ...s.providerTestStatus, [id]: result } }));
    } catch (err) {
      set((s) => ({ providerTestStatus: { ...s.providerTestStatus, [id]: { ok: false, message: err.message } } }));
    }
  },
  deleteProviderAction: async (id) => {
    await api.deleteProvider(id);
    set({ providerEditId: null, providerDraft: null });
    get().loadProviders();
    get().loadAiMode();
  },

  openProviderEditor: (id) => {
    if (id === 'new') {
      set({
        providerEditId: 'new',
        providerDraft: { name: '', type: 'anthropic', baseUrl: '', keysText: '', models: [], selectedModel: '', newModelDraft: '' },
      });
      return;
    }
    const p = get().providers.find((x) => x.id === id);
    if (!p) return;
    set({
      providerEditId: id,
      providerDraft: {
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        keysText: '',
        keyCount: p.keyCount,
        models: [...p.models],
        selectedModel: p.selectedModel,
        newModelDraft: '',
      },
    });
  },
  closeProviderEditor: () => set({ providerEditId: null, providerDraft: null }),
  onProviderDraftChange: (field, value) => set((s) => ({ providerDraft: { ...s.providerDraft, [field]: value } })),
  addModelToDraft: () => {
    const { providerDraft } = get();
    const name = (providerDraft.newModelDraft || '').trim();
    if (!name || providerDraft.models.includes(name)) return;
    const models = [...providerDraft.models, name];
    set({
      providerDraft: {
        ...providerDraft,
        models,
        newModelDraft: '',
        selectedModel: providerDraft.selectedModel || name,
      },
    });
  },
  removeModelFromDraft: (name) => {
    const { providerDraft } = get();
    const models = providerDraft.models.filter((m) => m !== name);
    set({
      providerDraft: {
        ...providerDraft,
        models,
        selectedModel: providerDraft.selectedModel === name ? models[0] || '' : providerDraft.selectedModel,
      },
    });
  },
  saveProviderDraft: async () => {
    const { providerEditId, providerDraft } = get();
    if (!providerDraft.name.trim()) return;
    const keysFromText = providerDraft.keysText
      .split('\n')
      .map((k) => k.trim())
      .filter(Boolean);
    const payload = {
      name: providerDraft.name.trim(),
      type: providerDraft.type,
      baseUrl: providerDraft.baseUrl.trim(),
      multiKeyEnabled: false,
      models: providerDraft.models,
      selectedModel: providerDraft.selectedModel,
    };
    if (keysFromText.length) payload.keys = keysFromText;

    let saved;
    if (providerEditId === 'new') {
      if (!keysFromText.length) payload.keys = [];
      saved = await api.addProvider(payload);
    } else {
      saved = await api.updateProvider(providerEditId, payload);
    }
    set({ providerEditId: null, providerDraft: null });
    await get().loadProviders();
    if (providerEditId === 'new' && saved) {
      const providersNow = get().providers;
      if (providersNow.length === 1) get().selectProvider(saved.id);
    }
  },

  // ---- MCP tools ----
  mcpToolsEnabled: false,
  mcpPanelOpen: false,
  mcpServers: [],
  mcpNewName: '',
  mcpNewUrl: '',
  mcpTestStatus: {},
  toggleMcpToolsQuick: async () => {
    const enabled = !get().mcpToolsEnabled;
    set({ mcpToolsEnabled: enabled });
    await api.toggleMcpTools(enabled);
  },
  openMcpPanel: () => {
    set({ mcpPanelOpen: true });
    get().loadMcpServers();
  },
  closeMcpPanel: () => set({ mcpPanelOpen: false }),
  loadMcpServers: async () => {
    const mcpServers = await api.getMcpServers();
    set({ mcpServers });
  },
  onMcpNewNameChange: (value) => set({ mcpNewName: value }),
  onMcpNewUrlChange: (value) => set({ mcpNewUrl: value }),
  addMcpServerAction: async () => {
    const { mcpNewName, mcpNewUrl } = get();
    if (!mcpNewName.trim() || !mcpNewUrl.trim()) return;
    await api.addMcpServer({ name: mcpNewName.trim(), url: mcpNewUrl.trim() });
    set({ mcpNewName: '', mcpNewUrl: '' });
    get().loadMcpServers();
  },
  toggleMcpServerEnabled: async (id) => {
    const server = get().mcpServers.find((s) => s.id === id);
    if (!server) return;
    await api.updateMcpServer(id, { enabled: !server.enabled });
    get().loadMcpServers();
  },
  deleteMcpServerAction: async (id) => {
    await api.deleteMcpServer(id);
    get().loadMcpServers();
  },
  testMcpServerAction: async (id) => {
    set((s) => ({ mcpTestStatus: { ...s.mcpTestStatus, [id]: { loading: true } } }));
    try {
      const result = await api.testMcpServer(id);
      set((s) => ({ mcpTestStatus: { ...s.mcpTestStatus, [id]: result } }));
    } catch (err) {
      set((s) => ({ mcpTestStatus: { ...s.mcpTestStatus, [id]: { ok: false, message: err.message } } }));
    }
  },

  // ---- memory library panel (recent Ombre Brain saves) + in-app toast ----
  memoryPanelOpen: false,
  memoryLogEntries: [],
  openMemoryPanel: () => {
    set({ memoryPanelOpen: true });
    get().loadMemoryLog();
  },
  closeMemoryPanel: () => set({ memoryPanelOpen: false }),
  loadMemoryLog: async () => {
    const memoryLogEntries = await api.getRecentMemoryLog();
    set({ memoryLogEntries });
  },
  lastSeenMemoryLogId: 0,
  memoryToastItems: [], // [{id, summary}] — every unseen save this poll turned up, not just the latest
  dismissMemoryToast: () => set({ memoryToastItems: [] }),
  // Polled periodically while the app is open (see App.jsx) — anything
  // newer than the last id we've shown a toast for gets one now. Compares
  // against a persisted id (not just in-memory) so a reload doesn't
  // re-announce something already seen in an earlier session.
  pollMemoryLog: async () => {
    try {
      const entries = await api.getRecentMemoryLog(5);
      const lastSeenId = get().lastSeenMemoryLogId;
      const unseen = entries.filter((e) => e.id > lastSeenId).sort((a, b) => a.id - b.id);
      if (!unseen.length) return;
      set({ lastSeenMemoryLogId: unseen[unseen.length - 1].id, memoryToastItems: unseen });
      setTimeout(() => {
        if (get().memoryToastItems === unseen) set({ memoryToastItems: [] });
      }, 8000);
    } catch {
      // backend not reachable this tick — try again next poll
    }
  },

  // ---- preset instructions (global system prompt) ----
  presetPanelOpen: false,
  presets: [],
  presetEditId: null, // null = list, 'new' = creating, number = editing
  presetDraft: null,
  presetSaveError: '',
  openPresetPanel: () => {
    set({ presetPanelOpen: true, presetEditId: null, presetDraft: null });
    get().loadPresets();
  },
  closePresetPanel: () => set({ presetPanelOpen: false, presetEditId: null, presetDraft: null }),
  loadPresets: async () => {
    const presets = await api.getPresets();
    set({ presets });
  },
  openPresetEditor: (id) => {
    if (id === 'new') {
      set({ presetEditId: 'new', presetDraft: { category: '默认', name: '', content: '', enabled: true }, presetSaveError: '' });
      return;
    }
    const p = get().presets.find((x) => x.id === id);
    if (!p) return;
    set({ presetEditId: id, presetDraft: { category: p.category, name: p.name, content: p.content, enabled: p.enabled }, presetSaveError: '' });
  },
  closePresetEditor: () => set({ presetEditId: null, presetDraft: null, presetSaveError: '' }),
  onPresetDraftChange: (field, value) => set((s) => ({ presetDraft: { ...s.presetDraft, [field]: value } })),
  savePresetDraft: async () => {
    const { presetEditId, presetDraft } = get();
    // Silently no-op-ing here used to look exactly like a dead button —
    // tapping 保存 with either field blank did genuinely nothing, no
    // error, nothing saved, and there was no way to tell why.
    if (!presetDraft.name.trim() || !presetDraft.content.trim()) {
      set({ presetSaveError: '名称和内容都要填才能保存' });
      return;
    }
    const payload = {
      category: presetDraft.category.trim() || '默认',
      name: presetDraft.name.trim(),
      content: presetDraft.content.trim(),
      enabled: presetDraft.enabled,
    };
    try {
      if (presetEditId === 'new') await api.addPreset(payload);
      else await api.updatePreset(presetEditId, payload);
      set({ presetEditId: null, presetDraft: null, presetSaveError: '' });
      get().loadPresets();
    } catch (err) {
      set({ presetSaveError: err.message || '保存失败，稍后再试' });
    }
  },
  togglePresetEnabled: async (id) => {
    const p = get().presets.find((x) => x.id === id);
    if (!p) return;
    await api.updatePreset(id, { enabled: !p.enabled });
    get().loadPresets();
  },
  deletePresetAction: async (id) => {
    await api.deletePreset(id);
    set({ presetEditId: null, presetDraft: null });
    get().loadPresets();
  },

  // ---- context settings (readable message count + memory-save frequency) ----
  contextPanelOpen: false,
  contextMessageLimit: 30,
  memorySaveMessageThreshold: 30,
  messageSplitEnabled: true,
  openContextPanel: () => {
    set({ contextPanelOpen: true });
    get().loadContextSettings();
  },
  closeContextPanel: () => set({ contextPanelOpen: false }),
  loadContextSettings: async () => {
    try {
      const s = await api.getContextSettings();
      set({
        contextMessageLimit: s.contextMessageLimit,
        memorySaveMessageThreshold: s.memorySaveMessageThreshold,
        messageSplitEnabled: s.messageSplitEnabled,
      });
    } catch {
      // backend not reachable yet — leave defaults
    }
  },
  toggleMessageSplit: async () => {
    const next = !get().messageSplitEnabled;
    set({ messageSplitEnabled: next });
    try {
      await api.updateContextSettings({ messageSplitEnabled: next });
    } catch {
      set({ messageSplitEnabled: !next });
    }
  },
  // key is 'contextMessageLimit' or 'memorySaveMessageThreshold'
  adjustContextSetting: async (key, delta, min, max) => {
    const current = get()[key];
    const next = Math.max(min, Math.min(max, current + delta));
    if (next === current) return;
    set({ [key]: next });
    await api.updateContextSettings({ [key]: next });
  },

  // ---- favorites ----
  // Just the (type, sourceId) pairs, loaded once at boot — every heart
  // button anywhere in the app checks this set to render its filled state,
  // rather than each content view fetching its own favorite status.
  favoritedKeys: new Set(),
  loadFavoriteKeys: async () => {
    try {
      const keys = await api.getFavoriteKeys();
      set({ favoritedKeys: new Set(keys.map((k) => `${k.type}:${k.sourceId}`)) });
    } catch {
      // backend not reachable yet — leave empty, hearts render unfilled
    }
  },
  isFavorited: (type, sourceId) => get().favoritedKeys.has(`${type}:${sourceId}`),
  // Favoriting asks for a title first (see FavoriteTitlePrompt); un-favoriting
  // from the original content is instant (no confirm) — that only applies
  // inside the favorites browser itself, which has its own confirm flow.
  favoriteTitlePrompt: null, // { type, sourceId, snippet, sourceTime, draftTitle }
  openFavoriteTitlePrompt: (item) => set({ favoriteTitlePrompt: { ...item, draftTitle: '' } }),
  cancelFavoriteTitlePrompt: () => set({ favoriteTitlePrompt: null }),
  onFavoriteTitleDraftChange: (value) =>
    set((s) => ({ favoriteTitlePrompt: { ...s.favoriteTitlePrompt, draftTitle: value } })),
  confirmFavoriteTitlePrompt: async () => {
    const prompt = get().favoriteTitlePrompt;
    if (!prompt) return;
    const title = (prompt.draftTitle || '').trim() || prompt.snippet.slice(0, 20);
    await api.addFavorite({
      type: prompt.type,
      sourceId: prompt.sourceId,
      title,
      snippet: prompt.snippet,
      sourceTime: prompt.sourceTime,
    });
    set((s) => ({
      favoritedKeys: new Set([...s.favoritedKeys, `${prompt.type}:${prompt.sourceId}`]),
      favoriteTitlePrompt: null,
    }));
    if (get().favoritesCategory === prompt.type) get().loadFavoritesList();
  },
  unfavorite: async (type, sourceId) => {
    await api.removeFavoriteBySource(type, sourceId);
    set((s) => {
      const next = new Set(s.favoritedKeys);
      next.delete(`${type}:${sourceId}`);
      return { favoritedKeys: next };
    });
  },
  // Used from a heart button on the original content (chat/diary/letter/tip)
  // — toggling off there needs no confirmation, only toggling off from
  // inside the favorites browser does.
  toggleFavoriteFromContent: (item) => {
    if (get().isFavorited(item.type, item.sourceId)) get().unfavorite(item.type, item.sourceId);
    else get().openFavoriteTitlePrompt(item);
  },

  favoritesOpen: false,
  favoritesView: 'home', // 'home' | 'category'
  favoritesCategory: null, // 'chat' | 'diary' | 'letter' | 'tip'
  favoritesCounts: { chat: 0, diary: 0, letter: 0, tip: 0 },
  favoritesHomeSearch: '',
  favoritesHomeResults: [],
  favoritesCategorySearch: '',
  favoritesCategoryDate: '',
  favoritesList: [],
  favoritesExpandedId: null,
  favoritesDeleteConfirmId: null,
  openFavorites: () => {
    set({ favoritesOpen: true, favoritesView: 'home', favoritesHomeSearch: '', favoritesHomeResults: [] });
    get().loadFavoriteCounts();
  },
  closeFavorites: () => set({ favoritesOpen: false }),
  loadFavoriteCounts: async () => {
    const favoritesCounts = await api.getFavoriteCounts();
    set({ favoritesCounts });
  },
  onFavoritesHomeSearchChange: async (value) => {
    set({ favoritesHomeSearch: value });
    if (!value.trim()) {
      set({ favoritesHomeResults: [] });
      return;
    }
    const favoritesHomeResults = await api.getFavorites({ q: value.trim() });
    set({ favoritesHomeResults });
  },
  openFavoritesCategory: (type) => {
    set({
      favoritesView: 'category',
      favoritesCategory: type,
      favoritesCategorySearch: '',
      favoritesCategoryDate: '',
      favoritesExpandedId: null,
    });
    get().loadFavoritesList();
  },
  closeFavoritesCategory: () => set({ favoritesView: 'home', favoritesCategory: null }),
  loadFavoritesList: async () => {
    const { favoritesCategory, favoritesCategorySearch, favoritesCategoryDate } = get();
    if (!favoritesCategory) return;
    const favoritesList = await api.getFavorites({
      type: favoritesCategory,
      q: favoritesCategorySearch.trim() || undefined,
      date: favoritesCategoryDate || undefined,
    });
    set({ favoritesList });
  },
  onFavoritesCategorySearchChange: (value) => {
    set({ favoritesCategorySearch: value });
    get().loadFavoritesList();
  },
  onFavoritesCategoryDateChange: (value) => {
    set({ favoritesCategoryDate: value });
    get().loadFavoritesList();
  },
  clearFavoritesCategoryDate: () => {
    set({ favoritesCategoryDate: '' });
    get().loadFavoritesList();
  },
  toggleFavoriteExpanded: (id) =>
    set((s) => ({ favoritesExpandedId: s.favoritesExpandedId === id ? null : id })),
  requestUnfavorite: (id) => set({ favoritesDeleteConfirmId: id }),
  cancelUnfavorite: () => set({ favoritesDeleteConfirmId: null }),
  confirmUnfavorite: async () => {
    const id = get().favoritesDeleteConfirmId;
    if (!id) return;
    const target = get().favoritesList.find((f) => f.id === id) || get().favoritesHomeResults.find((f) => f.id === id);
    await api.removeFavorite(id);
    set((s) => ({
      favoritesList: s.favoritesList.filter((f) => f.id !== id),
      favoritesHomeResults: s.favoritesHomeResults.filter((f) => f.id !== id),
      favoritesDeleteConfirmId: null,
    }));
    if (target) {
      set((s) => {
        const next = new Set(s.favoritedKeys);
        next.delete(`${target.type}:${target.sourceId}`);
        return { favoritedKeys: next };
      });
      get().loadFavoriteCounts();
    }
  },

  // ---- calendar: period / intimacy / exercise / countdown / milestones ----
  // First-pass rough features per the placeholder-tab spec — local-only
  // (no backend table yet), same shape as habits' add-sheet pattern.
  calendarView: 'home', // 'home' | 'period' | 'intimacy' | 'exercise' | 'countdown' | 'milestone'
  openCalendarView: (view) => set({ calendarView: view }),
  closeCalendarSubview: () => set({ calendarView: 'home' }),

  periodLogs: [], // [{ id, date }]
  intimacyLogs: [], // [{ id, date, note }]
  exerciseLogs: [], // [{ id, date, type, minutes }]
  countdowns: [], // [{ id, title, date, category }] — category: 'birthday' | 'anniversary' | 'other'
  milestones: [], // [{ id, date, title, note }]

  countdownCategoryColors: { birthday: '#6FBF8C', anniversary: '#E0A458', other: '#8C8FE0' },
  countdownCategoryLabels: { birthday: '生日', anniversary: '纪念日', other: '其他' },

  calendarAddOpen: null, // null | 'period' | 'intimacy' | 'exercise' | 'countdown' | 'milestone'
  calendarDraft: { date: '', title: '', note: '', type: '', minutes: '', category: 'other' },
  openCalendarAdd: (kind) =>
    set({
      calendarAddOpen: kind,
      calendarDraft: { date: todayISOLocal(), title: '', note: '', type: '', minutes: '', category: 'other' },
    }),
  closeCalendarAdd: () => set({ calendarAddOpen: null }),
  onCalendarDraftChange: (field, value) => set((s) => ({ calendarDraft: { ...s.calendarDraft, [field]: value } })),
  saveCalendarDraft: () => {
    const { calendarAddOpen, calendarDraft } = get();
    if (!calendarAddOpen) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (calendarAddOpen === 'period') {
      if (!calendarDraft.date) return;
      set((s) => ({ periodLogs: [...s.periodLogs, { id, date: calendarDraft.date }] }));
    } else if (calendarAddOpen === 'intimacy') {
      if (!calendarDraft.date) return;
      set((s) => ({ intimacyLogs: [...s.intimacyLogs, { id, date: calendarDraft.date, note: calendarDraft.note }] }));
    } else if (calendarAddOpen === 'exercise') {
      if (!calendarDraft.date || !calendarDraft.type.trim()) return;
      set((s) => ({
        exerciseLogs: [
          ...s.exerciseLogs,
          { id, date: calendarDraft.date, type: calendarDraft.type.trim(), minutes: Number(calendarDraft.minutes) || 0 },
        ],
      }));
    } else if (calendarAddOpen === 'countdown') {
      if (!calendarDraft.date || !calendarDraft.title.trim()) return;
      set((s) => ({
        countdowns: [
          ...s.countdowns,
          { id, title: calendarDraft.title.trim(), date: calendarDraft.date, category: calendarDraft.category || 'other' },
        ],
      }));
    } else if (calendarAddOpen === 'milestone') {
      if (!calendarDraft.date || !calendarDraft.title.trim()) return;
      set((s) => ({
        milestones: [...s.milestones, { id, date: calendarDraft.date, title: calendarDraft.title.trim(), note: calendarDraft.note }],
      }));
    }
    set({ calendarAddOpen: null });
  },
  deletePeriodLog: (id) => set((s) => ({ periodLogs: s.periodLogs.filter((x) => x.id !== id) })),
  deleteIntimacyLog: (id) => set((s) => ({ intimacyLogs: s.intimacyLogs.filter((x) => x.id !== id) })),
  deleteExerciseLog: (id) => set((s) => ({ exerciseLogs: s.exerciseLogs.filter((x) => x.id !== id) })),
  deleteCountdown: (id) => set((s) => ({ countdowns: s.countdowns.filter((x) => x.id !== id) })),
  deleteMilestone: (id) => set((s) => ({ milestones: s.milestones.filter((x) => x.id !== id) })),

  // ---- play: reading / music / english corner / games ----
  playView: 'home', // 'home' | 'reading' | 'music' | 'english' | 'games'
  openPlayView: (view) => set({ playView: view }),
  closePlaySubview: () => set({ playView: 'home' }),

  books: [], // [{ id, title, status }]
  musicList: [], // [{ id, title, artist }]
  englishPhrases: [], // [{ id, phrase, meaning }]
  games: [], // [{ id, name, note }]

  playAddOpen: null, // null | 'reading' | 'music' | 'english' | 'games'
  playDraft: { title: '', artist: '', author: '', phrase: '', meaning: '', note: '' },
  openPlayAdd: (kind) =>
    set({ playAddOpen: kind, playDraft: { title: '', artist: '', author: '', phrase: '', meaning: '', note: '' } }),
  closePlayAdd: () => set({ playAddOpen: null }),
  onPlayDraftChange: (field, value) => set((s) => ({ playDraft: { ...s.playDraft, [field]: value } })),
  savePlayDraft: () => {
    const { playAddOpen, playDraft } = get();
    if (!playAddOpen) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (playAddOpen === 'reading') {
      if (!playDraft.title.trim()) return;
      set((s) => ({
        books: [...s.books, { id, title: playDraft.title.trim(), author: playDraft.author.trim(), status: '想读', progress: 0 }],
      }));
    } else if (playAddOpen === 'music') {
      if (!playDraft.title.trim()) return;
      set((s) => ({ musicList: [...s.musicList, { id, title: playDraft.title.trim(), artist: playDraft.artist.trim() }] }));
    } else if (playAddOpen === 'english') {
      if (!playDraft.phrase.trim() || !playDraft.meaning.trim()) return;
      set((s) => ({
        englishPhrases: [
          ...s.englishPhrases,
          { id, phrase: playDraft.phrase.trim(), meaning: playDraft.meaning.trim(), date: todayISOLocal() },
        ],
      }));
    } else if (playAddOpen === 'games') {
      if (!playDraft.title.trim()) return;
      set((s) => ({ games: [...s.games, { id, name: playDraft.title.trim(), note: playDraft.note.trim() }] }));
    }
    set({ playAddOpen: null });
  },
  deleteBook: (id) => set((s) => ({ books: s.books.filter((x) => x.id !== id) })),
  cycleBookStatus: (id) =>
    set((s) => ({
      books: s.books.map((b) => {
        if (b.id !== id) return b;
        const order = ['想读', '在读', '读完'];
        const next = order[(order.indexOf(b.status) + 1) % order.length];
        return { ...b, status: next };
      }),
    })),
  incrementBookProgress: (id) =>
    set((s) => ({
      books: s.books.map((b) => {
        if (b.id !== id) return b;
        const progress = Math.min(100, (b.progress || 0) + 10);
        return { ...b, progress, status: progress >= 100 ? '读完' : '在读' };
      }),
    })),
  deleteMusic: (id) => set((s) => ({ musicList: s.musicList.filter((x) => x.id !== id) })),
  deleteEnglishPhrase: (id) => set((s) => ({ englishPhrases: s.englishPhrases.filter((x) => x.id !== id) })),
  deleteGame: (id) => set((s) => ({ games: s.games.filter((x) => x.id !== id) })),

  // ---- bootstrap ----
  init: async () => {
    await Promise.all([
      get().loadSettings(),
      get().loadMessages(),
      get().loadChatReadStatus(),
      get().loadDiaryEntries(),
      get().loadLetters(),
      get().loadLedgerEntries(),
      get().loadLedgerCategories(),
      get().loadLedgerCardMessage(),
      get().loadHabits(),
      get().loadFavoriteKeys(),
      get().loadHealthLogs(),
    ]);
    get().checkLetterReminder();
    get().checkDiaryReminder();
    api.getAiMode().then((s) => set({ mcpToolsEnabled: !!s.mcpToolsEnabled })).catch(() => {});
    get().loadPushSettings();
  },
    }),
    {
      name: 'xq-app-ui-state',
      partialize: (s) => ({
        activeTab: s.activeTab,
        homeMode: s.homeMode,
        letterView: s.letterView,
        letterMailboxTab: s.letterMailboxTab,
        diaryView: s.diaryView === 'detail' ? 'list' : s.diaryView,
        screenReminderEnabled: s.screenReminderEnabled,
        screenThreshold: s.screenThreshold,
        screenAppThresholds: s.screenAppThresholds,
        screenAppReminders: s.screenAppReminders,
        lastSeenMemoryLogId: s.lastSeenMemoryLogId,
        periodLogs: s.periodLogs,
        intimacyLogs: s.intimacyLogs,
        exerciseLogs: s.exerciseLogs,
        countdowns: s.countdowns,
        milestones: s.milestones,
        books: s.books,
        musicList: s.musicList,
        englishPhrases: s.englishPhrases,
        games: s.games,
      }),
    }
  )
);
