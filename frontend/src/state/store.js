import { create } from 'zustand';
import { api } from '../api/client';

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

export const useStore = create((set, get) => ({
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
  sendBowSticker: () => get().pushMessage('抱抱～', 'text'),
  sendPhotoSticker: () => get().pushMessage('分享了一张此刻的照片', 'photo'),

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

  // ---- AI provider settings ----
  aiSettingsOpen: false,
  aiSettings: { provider: 'api', hasApiKey: false, apiKeyMasked: null, apiKeySource: null, claudeCodeAvailable: false },
  aiApiKeyDraft: '',
  aiTestStatus: null,
  openAiSettings: () => {
    set({ aiSettingsOpen: true, aiTestStatus: null, aiApiKeyDraft: '' });
    get().loadAiSettings();
  },
  closeAiSettings: () => set({ aiSettingsOpen: false }),
  loadAiSettings: async () => {
    const aiSettings = await api.getAiSettings();
    set({ aiSettings });
  },
  setAiProvider: async (provider) => {
    set((s) => ({ aiSettings: { ...s.aiSettings, provider }, aiTestStatus: null }));
    await api.updateAiSettings({ provider });
    get().loadAiSettings();
  },
  onAiApiKeyDraftChange: (value) => set({ aiApiKeyDraft: value }),
  saveAiApiKey: async () => {
    const key = (get().aiApiKeyDraft || '').trim();
    if (!key) return;
    await api.updateAiSettings({ apiKey: key });
    set({ aiApiKeyDraft: '', aiTestStatus: null });
    get().loadAiSettings();
  },
  relayApiKeyDraft: '',
  relayBaseUrlDraft: '',
  relayModelDraft: '',
  onRelayApiKeyDraftChange: (value) => set({ relayApiKeyDraft: value }),
  onRelayBaseUrlDraftChange: (value) => set({ relayBaseUrlDraft: value }),
  onRelayModelDraftChange: (value) => set({ relayModelDraft: value }),
  saveRelayConfig: async () => {
    const { relayApiKeyDraft, relayBaseUrlDraft, relayModelDraft } = get();
    const payload = {};
    if (relayApiKeyDraft.trim()) payload.relayApiKey = relayApiKeyDraft.trim();
    if (relayBaseUrlDraft.trim()) payload.relayBaseUrl = relayBaseUrlDraft.trim();
    if (relayModelDraft.trim()) payload.relayModel = relayModelDraft.trim();
    await api.updateAiSettings(payload);
    set({ relayApiKeyDraft: '', relayBaseUrlDraft: '', relayModelDraft: '', aiTestStatus: null });
    get().loadAiSettings();
  },
  testAiConnection: async () => {
    set({ aiTestStatus: { loading: true } });
    try {
      const result = await api.testAiSettings();
      set({ aiTestStatus: { loading: false, ok: result.ok, message: result.message } });
    } catch (err) {
      set({ aiTestStatus: { loading: false, ok: false, message: err.message } });
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

  // ---- bootstrap ----
  init: async () => {
    await Promise.all([
      get().loadSettings(),
      get().loadMessages(),
      get().loadDiaryEntries(),
      get().loadLetters(),
    ]);
    get().checkLetterReminder();
    api.getAiSettings().then((s) => set({ mcpToolsEnabled: !!s.mcpToolsEnabled })).catch(() => {});
  },
}));
