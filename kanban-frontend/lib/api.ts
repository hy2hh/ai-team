const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getBoard: (id: number) => fetchJson<import('./types').Board>(`/boards/${id}`),
  createCard: (data: { column_id: number; title: string; description?: string; priority?: string; assignee?: string; progress?: number }) =>
    fetchJson<import('./types').Card>('/cards', { method: 'POST', body: JSON.stringify(data) }),
  moveCard: (id: number, column_id: number, position?: number) =>
    fetchJson<import('./types').Card>(`/cards/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ column_id, position }),
    }),
  deleteCard: (id: number) => fetchJson<{ success: boolean }>(`/cards/${id}`, { method: 'DELETE' }),
};
