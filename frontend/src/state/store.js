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

  // ---- proactive push notifications ----
  proactiveMessagesEnabled: false,
  proactiveToggleBusy: false,
  proactiveToggleError: '',
  loadProactiveStatus: async () => {
    try {
      const { enabled } = await api.getProactiveStatus();
      set({ proactiveMessagesEnabled: enabled });
    } catch {
      // backend not reachable yet — leave default
    }
  },
  toggleProactiveMessages: async () => {
    if (get().proactiveToggleBusy) return;
    const next = !get().proactiveMessagesEnabled;
    set({ proactiveToggleBusy: true, proactiveToggleError: '' });
    try {
      if (next) {
        if (!isPushSupported()) throw new Error('这台设备不支持推送通知');
        await subscribeToPush();
      } else {
        await unsubscribeFromPush();
      }
      await api.setProactiveStatus(next);
      set({ proactiveMessagesEnabled: next });
    } catch (err) {
      set({ proactiveToggleError: err.message });
    } finally {
      set({ proactiveToggleBusy: false });
    }
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

  // ---- chat ----
  messages: [],
  chatDraft: '',
  isReplying: false,
  loadMessages: async () => {
    const messages = await api.getMessages();
    set({ messages });
  },
  onChatChange: (value) => set({ chatDraft: value }),
  pushMessage: async (text, kind = 'text') => {
    set((s) => ({
      messages: [...s.messages, { id: `pending-${Date.now()}`, from: 'me', text, kind, time: '' }],
      isReplying: true,
    }));
    try {
      const { mine, reply } = await api.sendMessage(text, kind);
      set((s) => ({
        messages: [...s.messages.filter((m) => !String(m.id).startsWith('pending-')), mine, reply],
        isReplying: false,
      }));
    } catch (err) {
      set({ isReplying: false });
    }
  },
  sendChat: () => {
    const text = (get().chatDraft || '').trim();
    if (!text) return;
    set({ chatDraft: '' });
    get().pushMessage(text, 'text');
  },
  sendPhotoSticker: () => get().pushMessage('分享了一张此刻的照片', 'photo'),

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
  openDiaryDetail: (id, scrollTop) => set({ diaryView: 'detail', diaryDetailId: id, diaryListScrollTop: scrollTop || 0 }),
  closeDiaryDetail: () => set({ diaryView: 'list', diaryDetailId: null }),
  deleteDiaryEntry: async (id) => {
    await api.deleteDiaryEntry(id);
    set((s) => ({
      diaryEntries: s.diaryEntries.filter((e) => e.id !== id),
      diaryView: 'list',
      diaryDetailId: null,
    }));
  },

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

  // ---- bootstrap ----
  init: async () => {
    await Promise.all([
      get().loadSettings(),
      get().loadMessages(),
      get().loadDiaryEntries(),
      get().loadLetters(),
    ]);
    get().checkLetterReminder();
    api.getAiMode().then((s) => set({ mcpToolsEnabled: !!s.mcpToolsEnabled })).catch(() => {});
    get().loadProactiveStatus();
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
      }),
    }
  )
);
