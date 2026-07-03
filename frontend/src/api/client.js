const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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
  sendMessage: (text, kind = 'text') =>
    request('/chat', { method: 'POST', body: JSON.stringify({ text, kind }) }),
  clearChat: () => request('/chat', { method: 'DELETE' }),
  regenerateMessage: (id) => request(`/chat/${id}/regenerate`, { method: 'POST' }),

  getDiaryEntries: () => request('/diary'),
  createDiaryEntry: (payload) =>
    request('/diary', { method: 'POST', body: JSON.stringify(payload) }),
  deleteDiaryEntry: (id) => request(`/diary/${id}`, { method: 'DELETE' }),

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
  getProactiveStatus: () => request('/push/proactive-status'),
  setProactiveStatus: (enabled) => request('/push/proactive-status', { method: 'PATCH', body: JSON.stringify({ enabled }) }),

  exportMemories: () => request('/export', { method: 'POST' }),
};
