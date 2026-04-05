import type { Upload, Summary, Incident, TimelineResponse } from './types';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => fetchJson<{ user: { id: string; email: string } }>('/api/auth/me'),
  logout: () => fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  uploads: () => fetchJson<{ uploads: Upload[] }>('/api/uploads'),
  summary: (id: string) => fetchJson<Summary>(`/api/uploads/${id}/summary`),
  incidents: (id: string) => fetchJson<{ incidents: Incident[] }>(`/api/uploads/${id}/incidents`),
  timeline: (id: string) => fetchJson<TimelineResponse>(`/api/uploads/${id}/timeline`),
};
