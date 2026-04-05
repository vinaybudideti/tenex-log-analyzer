import type { Upload, Summary, Incident, TimelineResponse } from './types';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

const TOKEN_KEY = 'tenex_token';
export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
export const setToken = (t: string) => {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, t);
};
export const clearToken = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: async (email: string, password: string) => {
    const res = await fetchJson<{ user: { id: string; email: string }; token: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    setToken(res.token);
    return res;
  },

  logout: async () => {
    try { await fetchJson('/api/auth/logout', { method: 'POST' }); } catch {}
    clearToken();
  },

  uploadFile: async (file: File) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/api/uploads`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ uploadId: string; logCount: number; parseErrors: number }>;
  },

  me: () => fetchJson<{ user: { id: string; email: string } }>('/api/auth/me'),
  uploads: () => fetchJson<{ uploads: Upload[] }>('/api/uploads'),
  summary: (id: string) => fetchJson<Summary>(`/api/uploads/${id}/summary`),
  incidents: (id: string) => fetchJson<{ incidents: Incident[] }>(`/api/uploads/${id}/incidents`),
  timeline: (id: string) => fetchJson<TimelineResponse>(`/api/uploads/${id}/timeline`),
};
