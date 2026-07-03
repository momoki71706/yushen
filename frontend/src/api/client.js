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

  getAiSettings: () => request('/settings/ai'),
  updateAiSettings: (payload) =>
    request('/settings/ai', { method: 'PATCH', body: JSON.stringify(payload) }),
  testAiSettings: () => request('/settings/ai/test', { method: 'POST' }),

  toggleMcpTools: (enabled) =>
    request('/settings/mcp/toggle', { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  getMcpServers: () => request('/settings/mcp/servers'),
  addMcpServer: (payload) =>
    request('/settings/mcp/servers', { method: 'POST', body: JSON.stringify(payload) }),
  updateMcpServer: (id, payload) =>
    request(`/settings/mcp/servers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMcpServer: (id) => request(`/settings/mcp/servers/${id}`, { method: 'DELETE' }),
  testMcpServer: (id) => request(`/settings/mcp/servers/${id}/test`, { method: 'POST' }),
};
