import type { Board, Card } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message += ` — ${body.error}`;
    } catch {
      // 응답 바디 파싱 실패 시 상태 코드만 사용
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  getBoard: (id: number) => fetchJson<Board>(`/boards/${id}`),
  createCard: (data: { column_id: number; title: string; description?: string; priority?: string; assignee?: string; progress?: number; due_date?: string | null; tags?: string[] }) =>
    fetchJson<Card>('/cards', { method: 'POST', body: JSON.stringify(data) }),
  updateCard: (id: number, data: { title?: string; description?: string; priority?: string; assignee?: string | null; progress?: number; due_date?: string | null; tags?: string[] }) =>
    fetchJson<Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  moveCard: (id: number, column_id: number, position?: number) =>
    fetchJson<Card>(`/cards/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ column_id, position }),
    }),
  deleteCard: (id: number) => fetchJson<{ success: boolean }>(`/cards/${id}`, { method: 'DELETE' }),
};
