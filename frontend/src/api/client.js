const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

// Attachment URLs come back from the backend as paths relative to the
// server (e.g. "/uploads/xxx.png"), not the "/api"-suffixed base — this
// resolves one to an actual loadable URL. Optimistic messages use a local
// blob: object URL before the real upload finishes, which is already a
// complete URL and must be passed through untouched.
export function attachmentUrl(path) {
  if (!path || path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')) return path;
  return `${ORIGIN}${path}`;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getMessages: () => request('/chat'),
  sendMessage: (text, kind = 'text', attachment = null) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ text, kind, attachment }) }),
  sendBatch: (items) => request('/chat/batch', { method: 'POST', body: JSON.stringify({ items }) }),
  uploadAttachment: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  },
  clearChat: () => request('/chat', { method: 'DELETE' }),
  regenerateMessage: (id) => request(`/chat/${id}/regenerate`, { method: 'POST' }),
  editChatMessage: (id, text) => request(`/chat/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
  regenerateChatRound: (id) => request(`/chat/${id}/regenerate-round`, { method: 'POST' }),
  deleteChatMessage: (id) => request(`/chat/${id}`, { method: 'DELETE' }),

  getDiaryEntries: () => request('/diary'),
  createDiaryEntry: (payload) =>
    request('/diary', { method: 'POST', body: JSON.stringify(payload) }),
  deleteDiaryEntry: (id) => request(`/diary/${id}`, { method: 'DELETE' }),
  regenerateDiaryEntry: (id) => request(`/diary/${id}/regenerate`, { method: 'POST' }),
  getDiaryComments: (id) => request(`/diary/${id}/comments`),
  addDiaryComment: (id, text) => request(`/diary/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  markDiaryEntryRead: (id) => request(`/diary/${id}/read`, { method: 'PATCH' }),
  getDiaryUnreadSummary: () => request('/diary/unread-summary'),

  getLetters: () => request('/letters'),
  createLetter: (payload) =>
    request('/letters', { method: 'POST', body: JSON.stringify(payload) }),
  openLetter: (id) => request(`/letters/${id}/open`, { method: 'PATCH' }),

  getSettings: () => request('/settings'),
  updateSettings: (payload) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  getReminderStatus: () => request('/settings/reminder-status'),

  getAiMode: () => request('/settings/ai-mode'),
  updateAiMode: (payload) =>
    request('/settings/ai-mode', { method: 'PATCH', body: JSON.stringify(payload) }),
  testClaudeCode: () => request('/settings/ai-mode/test-claude-code', { method: 'POST' }),

  getProviders: () => request('/settings/providers'),
  addProvider: (payload) =>
    request('/settings/providers', { method: 'POST', body: JSON.stringify(payload) }),
  updateProvider: (id, payload) =>
    request(`/settings/providers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteProvider: (id) => request(`/settings/providers/${id}`, { method: 'DELETE' }),
  testProvider: (id) => request(`/settings/providers/${id}/test`, { method: 'POST' }),

  toggleMcpTools: (enabled) =>
    request('/settings/mcp/toggle', { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  getMcpServers: () => request('/settings/mcp/servers'),
  addMcpServer: (payload) =>
    request('/settings/mcp/servers', { method: 'POST', body: JSON.stringify(payload) }),
  updateMcpServer: (id, payload) =>
    request(`/settings/mcp/servers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMcpServer: (id) => request(`/settings/mcp/servers/${id}`, { method: 'DELETE' }),
  testMcpServer: (id) => request(`/settings/mcp/servers/${id}/test`, { method: 'POST' }),

  getPresets: () => request('/settings/presets'),
  addPreset: (payload) =>
    request('/settings/presets', { method: 'POST', body: JSON.stringify(payload) }),
  updatePreset: (id, payload) =>
    request(`/settings/presets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePreset: (id) => request(`/settings/presets/${id}`, { method: 'DELETE' }),

  getVapidPublicKey: () => request('/push/vapid-public-key'),
  subscribePush: (subscription) => request('/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
  unsubscribePush: (endpoint) => request('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
  getPushSettings: () => request('/push/settings'),
  updatePushSettings: (payload) => request('/push/settings', { method: 'PATCH', body: JSON.stringify(payload) }),

  getContextSettings: () => request('/settings/context'),
  updateContextSettings: (payload) =>
    request('/settings/context', { method: 'PATCH', body: JSON.stringify(payload) }),

  exportMemories: () => request('/export', { method: 'POST' }),

  getLedgerEntries: () => request('/ledger'),
  addLedgerEntry: (payload) => request('/ledger', { method: 'POST', body: JSON.stringify(payload) }),
  deleteLedgerEntry: (id) => request(`/ledger/${id}`, { method: 'DELETE' }),

  getHabits: () => request('/habits'),
  addHabit: (payload) => request('/habits', { method: 'POST', body: JSON.stringify(payload) }),
  deleteHabit: (id) => request(`/habits/${id}`, { method: 'DELETE' }),
  toggleHabitCheckin: (id, dateISO) => request(`/habits/${id}/checkin`, { method: 'POST', body: JSON.stringify({ dateISO }) }),
};
