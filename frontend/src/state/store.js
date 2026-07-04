import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../push';

const MOOD_PALETTE = { 开心: '#EDD9E1', 平静: '#E0D2D9', 难过: '#C9AEB9', 兴奋: '#E7D6CE', 疲惫: '#CBB9C0' };
const WEATHER_PALETTE = { 晴: '#EFE3D3', 多云: '#DED3D8', 雨: '#CDBFC5', 雪: '#F3EDEF', 风: '#D9CBD1' };

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

const EXPENSE_CATEGORIES = [
  { key: '餐饮', color: '#EDD9E1' }, { key: '交通', color: '#D9CBD3' },
  { key: '购物', color: '#E7D6CE' }, { key: '娱乐', color: '#CBB9C0' },
  { key: '居家', color: '#D6C4CB' }, { key: '医疗', color: '#C9AEB9' },
  { key: '其他', color: '#DED3D8' },
];
const INCOME_CATEGORIES = [
  { key: '工资', color: '#E0D2D9' }, { key: '红包', color: '#F1E0E8' }, { key: '其他', color: '#DED3D8' },
];
const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
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
  pushIdleThresholdHours: 4,
  pushMinGapHours: 3,
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
        pushIdleThresholdHours: s.idleThresholdHours,
        pushMinGapHours: s.minGapHours,
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
  // key is one of 'idleThresholdHours' | 'minGapHours' | 'quietHourStart' | 'quietHourEnd'
  adjustPushSetting: async (key, delta, min, max) => {
    const stateKey = `push${key[0].toUpperCase()}${key.slice(1)}`;
    const current = get()[stateKey];
    const next = Math.max(min, Math.min(max, current + delta));
    if (next === current) return;
    set({ [stateKey]: next });
    await api.updatePushSettings({ [key]: next });
  },

  // ---- export memories ----
  exportBusy: false,
  exportMessage: '',
  exportMemoriesAction: async () => {
    if (get().exportBusy) return;
    set({ exportBusy: true, exportMessage: '' });
    try {
      const { content, filename, hasContent } = await api.exportMemories();
      if (!hasContent) {
        set({ exportMessage: '这次没有新内容可以导出' });
        return;
      }
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
    } catch (err) {
      set({ exportMessage: `导出失败：${err.message}` });
    } finally {
      set({ exportBusy: false });
    }
  },

  // ---- manage: ledger + habits ----
  expenseCategories: EXPENSE_CATEGORIES,
  incomeCategories: INCOME_CATEGORIES,
  categoryColor: (key) => (ALL_CATEGORIES.find((c) => c.key === key) || { color: '#DED3D8' }).color,
  habitColors: HABIT_COLORS,
  todayISOLocal,

  manageView: 'home', // 'home' | 'ledger' | 'habits' | 'watch' | 'screentime'
  openLedger: () => {
    set({ manageView: 'ledger' });
    if (!get().ledgerLoaded) get().loadLedgerEntries();
  },
  openHabits: () => {
    set({ manageView: 'habits' });
    if (!get().habitsLoaded) get().loadHabits();
  },
  closeManageSubview: () => set({ manageView: 'home' }),

  ledgerEntries: [],
  ledgerLoaded: false,
  ledgerMonthOffset: 0,
  ledgerChartMode: 'pie',
  ledgerShowAdd: false,
  ledgerDraft: null,
  ledgerCardMessage: pickDaily(LEDGER_MESSAGES),
  loadLedgerEntries: async () => {
    const ledgerEntries = await api.getLedgerEntries();
    set({ ledgerEntries, ledgerLoaded: true });
  },
  ledgerPrevMonth: () => set((s) => ({ ledgerMonthOffset: s.ledgerMonthOffset - 1 })),
  ledgerNextMonth: () => set((s) => ({ ledgerMonthOffset: Math.min(0, s.ledgerMonthOffset + 1) })),
  setLedgerChartMode: (mode) => set({ ledgerChartMode: mode }),
  openLedgerAdd: () =>
    set({
      ledgerShowAdd: true,
      ledgerDraft: { type: 'expense', category: '餐饮', amount: '', note: '', dateISO: todayISOLocal() },
    }),
  closeLedgerAdd: () => set({ ledgerShowAdd: false, ledgerDraft: null }),
  onLedgerDraftChange: (field, value) =>
    set((s) => ({
      ledgerDraft: {
        ...s.ledgerDraft,
        [field]: value,
        ...(field === 'type' ? { category: value === 'income' ? '工资' : '餐饮' } : {}),
      },
    })),
  saveLedgerEntry: async () => {
    const { ledgerDraft } = get();
    const amount = parseFloat(ledgerDraft.amount);
    if (!amount || amount <= 0) return;
    const entry = await api.addLedgerEntry({ ...ledgerDraft, amount });
    set((s) => ({ ledgerEntries: [entry, ...s.ledgerEntries], ledgerShowAdd: false, ledgerDraft: null }));
  },
  deleteLedgerEntryAction: async (id) => {
    await api.deleteLedgerEntry(id);
    set((s) => ({ ledgerEntries: s.ledgerEntries.filter((e) => e.id !== id) }));
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

  // ---- manage: watch (mock HealthKit) + screentime (mock) ----
  openWatch: () => set({ manageView: 'watch' }),
  openScreentime: () => set({ manageView: 'screentime' }),

  watchConnected: false,
  connectWatch: () => set({ watchConnected: true }),

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
  loadMessages: async () => {
    const messages = await api.getMessages();
    set({ messages });
  },
  onChatChange: (value) => set({ chatDraft: value }),
  pushMessage: async (text, kind = 'text', attachment = null) => {
    set((s) => ({
      messages: [...s.messages, { id: `pending-${Date.now()}`, from: 'me', text, kind, attachment, time: '' }],
      isReplying: true,
    }));
    try {
      const { mine, reply } = await api.sendMessage(text, kind, attachment);
      set((s) => ({
        messages: [...s.messages.filter((m) => !String(m.id).startsWith('pending-')), mine, reply],
        isReplying: false,
      }));
    } catch (err) {
      set({ isReplying: false });
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
      get().pushMessage(text, 'text');
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
      const { mine, reply } = await api.sendBatch(items);
      set((s) => ({
        messages: [...s.messages.filter((m) => !String(m.id).startsWith(pendingPrefix)), ...mine, reply],
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
      const updated = await api.regenerateMessage(id);
      set((s) => ({ messages: s.messages.map((m) => (m.id === id ? updated : m)) }));
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
      const { reply, isNew } = await api.regenerateChatRound(id);
      set((s) => ({
        messages: isNew ? [...s.messages, reply] : s.messages.map((m) => (m.id === reply.id ? reply : m)),
      }));
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

  // ---- delete a single message (either side, confirmation gated) ----
  deleteConfirmMessageId: null,
  requestDeleteMessage: (id) => set({ deleteConfirmMessageId: id }),
  cancelDeleteMessage: () => set({ deleteConfirmMessageId: null }),
  confirmDeleteMessage: async () => {
    const { deleteConfirmMessageId } = get();
    if (!deleteConfirmMessageId) return;
    await api.deleteChatMessage(deleteConfirmMessageId);
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== deleteConfirmMessageId),
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
  diaryHasAttachment: false,
  diaryView: 'list',
  diaryDetailId: null,
  diaryListScrollTop: 0,
  diarySearchQuery: '',
  diarySearchDate: '',
  showDiaryDatePicker: false,
  showCustomTagInput: false,
  customTagDraft: '',
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
  toggleDiaryAttachment: () => set((s) => ({ diaryHasAttachment: !s.diaryHasAttachment })),
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
    const { diaryText, diarySelectedTags, diaryHasAttachment } = get();
    const trimmed = (diaryText || '').trim();
    if (!trimmed) return;
    const moodTag = diarySelectedTags.find((t) => t.type === 'mood');
    const weatherTag = diarySelectedTags.find((t) => t.type === 'weather');
    const customTag = diarySelectedTags.find((t) => t.type === 'custom');
    const mood = moodTag ? moodTag.key : '平静';
    const weather = weatherTag ? weatherTag.key : '晴';
    const entry = await api.createDiaryEntry({
      text: trimmed,
      mood,
      weather,
      tag: customTag ? customTag.key : null,
      hasAttachment: diaryHasAttachment,
    });
    set((s) => ({
      diaryEntries: [entry, ...s.diaryEntries],
      diaryText: '',
      diarySelectedTags: [],
      diaryHasAttachment: false,
    }));
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
  addDiaryCommentAction: async () => {
    const { diaryDetailId, diaryCommentDraft, diaryCommentSending } = get();
    const trimmed = (diaryCommentDraft || '').trim();
    if (!trimmed || diaryCommentSending || !diaryDetailId) return;
    set({ diaryCommentSending: true, diaryCommentDraft: '' });
    try {
      const { mine, reply } = await api.addDiaryComment(diaryDetailId, trimmed);
      set((s) => ({ diaryComments: [...s.diaryComments, mine, ...(reply ? [reply] : [])] }));
    } finally {
      set({ diaryCommentSending: false });
    }
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
  loadLetters: async () => {
    const letters = await api.getLetters();
    set({ letters });
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
    const { letterText, letterRecipient, letterUnlockDate, letterSignature, letterDearText } = get();
    const trimmed = (letterText || '').trim();
    if (!trimmed) return;
    const letter = await api.createLetter({
      recipient: letterRecipient,
      unlockDate: letterUnlockDate || tomorrowISO(),
      body: trimmed,
      signature: letterSignature,
      dearText: letterDearText,
    });
    set((s) => ({
      letters: [letter, ...s.letters],
      letterText: '',
      letterUnlockDate: tomorrowISO(),
      letterView: 'mailbox',
      letterMailboxTab: 'sent',
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

  // ---- preset instructions (global system prompt) ----
  presetPanelOpen: false,
  presets: [],
  presetEditId: null, // null = list, 'new' = creating, number = editing
  presetDraft: null,
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
      set({ presetEditId: 'new', presetDraft: { category: '默认', name: '', content: '', enabled: true } });
      return;
    }
    const p = get().presets.find((x) => x.id === id);
    if (!p) return;
    set({ presetEditId: id, presetDraft: { category: p.category, name: p.name, content: p.content, enabled: p.enabled } });
  },
  closePresetEditor: () => set({ presetEditId: null, presetDraft: null }),
  onPresetDraftChange: (field, value) => set((s) => ({ presetDraft: { ...s.presetDraft, [field]: value } })),
  savePresetDraft: async () => {
    const { presetEditId, presetDraft } = get();
    if (!presetDraft.name.trim() || !presetDraft.content.trim()) return;
    const payload = {
      category: presetDraft.category.trim() || '默认',
      name: presetDraft.name.trim(),
      content: presetDraft.content.trim(),
      enabled: presetDraft.enabled,
    };
    if (presetEditId === 'new') await api.addPreset(payload);
    else await api.updatePreset(presetEditId, payload);
    set({ presetEditId: null, presetDraft: null });
    get().loadPresets();
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
  memorySaveIntervalHours: 6,
  openContextPanel: () => {
    set({ contextPanelOpen: true });
    get().loadContextSettings();
  },
  closeContextPanel: () => set({ contextPanelOpen: false }),
  loadContextSettings: async () => {
    try {
      const s = await api.getContextSettings();
      set({ contextMessageLimit: s.contextMessageLimit, memorySaveIntervalHours: s.memorySaveIntervalHours });
    } catch {
      // backend not reachable yet — leave defaults
    }
  },
  // key is 'contextMessageLimit' or 'memorySaveIntervalHours'
  adjustContextSetting: async (key, delta, min, max) => {
    const current = get()[key];
    const next = Math.max(min, Math.min(max, current + delta));
    if (next === current) return;
    set({ [key]: next });
    await api.updateContextSettings({ [key]: next });
  },

  // ---- bootstrap ----
  init: async () => {
    await Promise.all([
      get().loadSettings(),
      get().loadMessages(),
      get().loadDiaryEntries(),
      get().loadLetters(),
      get().loadLedgerEntries(),
      get().loadHabits(),
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
        watchConnected: s.watchConnected,
        screenReminderEnabled: s.screenReminderEnabled,
        screenThreshold: s.screenThreshold,
        screenAppThresholds: s.screenAppThresholds,
        screenAppReminders: s.screenAppReminders,
      }),
    }
  )
);
