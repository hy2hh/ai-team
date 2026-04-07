import type { FileNode, FileContent, Backlink, SearchResult } from '@/lib/types';

const BASE = '';

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const apiPaths = {
  fileTree: '/api/files',
  fileContent: (path: string) => `/api/files/${encodeURIComponent(path)}`,
  saveFile: (path: string) => `/api/files/${encodeURIComponent(path)}`,
  createFile: '/api/files',
  backlinks: (path: string) => `/api/backlinks?path=${encodeURIComponent(path)}`,
  search: (query: string) => `/api/search?q=${encodeURIComponent(query)}`,
  login: '/api/auth/login',
  logout: '/api/auth/logout',
} as const;

// 파일 저장 (PUT)
export async function saveFile(filePath: string, content: string): Promise<void> {
  const res = await fetch(apiPaths.saveFile(filePath), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `저장 실패 (${res.status})`);
  }
}

// 파일 생성 (POST)
export async function createFile(filePath: string, content = ''): Promise<void> {
  const res = await fetch(apiPaths.createFile, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `생성 실패 (${res.status})`);
  }
}

export type { FileNode, FileContent, Backlink, SearchResult };
