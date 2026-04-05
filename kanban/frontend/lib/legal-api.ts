/**
 * AI 법률 서비스 API 클라이언트
 * RAG 파이프라인 연동
 */

import type {
  SearchResult,
  SearchRequest,
  Case,
  CreateCaseRequest,
  CaseListResponse,
  CaseWithAnalysis,
  AnalyzeResponse,
  ChatRequest,
  ChatResponse,
  CreateDocumentRequest,
  GeneratedDocument,
  DashboardKpi,
} from './legal-types';

const LEGAL_API_BASE = process.env.NEXT_PUBLIC_LEGAL_API_URL || 'http://localhost:3002';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${LEGAL_API_BASE}${path}`, {
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

export const legalApi = {
  /**
   * 법률 문서 검색
   */
  search: (request: SearchRequest) =>
    fetchJson<{ results: SearchResult[]; total: number }>('/search', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  /**
   * 문서 상세 조회
   */
  getDocument: (id: string) =>
    fetchJson<SearchResult['document']>(`/documents/${id}`),

  /**
   * 자동완성 (검색어 제안)
   */
  suggest: (query: string) =>
    fetchJson<{ suggestions: string[] }>(`/suggest?q=${encodeURIComponent(query)}`),

  // ════════════════════════════════════════════════════════════
  // 케이스 관리 API
  // ════════════════════════════════════════════════════════════

  /**
   * 케이스 생성
   */
  createCase: (data: CreateCaseRequest) =>
    fetchJson<Case>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * 케이스 목록 조회
   */
  getCases: (params?: { limit?: number; offset?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return fetchJson<CaseListResponse>(`/api/cases${qs ? `?${qs}` : ''}`);
  },

  /**
   * 케이스 상세 조회 (분석 결과 포함)
   */
  getCase: (id: string) =>
    fetchJson<CaseWithAnalysis>(`/api/cases/${id}`),

  /**
   * AI 분석 실행
   */
  analyzeCase: (id: string) =>
    fetchJson<AnalyzeResponse>(`/api/cases/${id}/analyze`, {
      method: 'POST',
    }),

  /**
   * AI 채팅 (케이스 기반)
   */
  chat: (caseId: string, data: ChatRequest) =>
    fetchJson<ChatResponse>(`/api/cases/${caseId}/chat`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * 문서 생성
   */
  createDocument: (data: CreateDocumentRequest) =>
    fetchJson<GeneratedDocument>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * 대시보드 KPI 조회
   */
  getDashboardKpi: () =>
    fetchJson<DashboardKpi>('/api/dashboard/kpi'),
};

/**
 * SWR fetcher 함수
 */
export const legalSearchFetcher = async ([, request]: [string, SearchRequest]) => {
  const response = await legalApi.search(request);
  return response;
};

/**
 * 케이스 목록 fetcher
 */
export const casesFetcher = async (url: string) => {
  const params = new URL(url, LEGAL_API_BASE).searchParams;
  return legalApi.getCases({
    limit: params.get('limit') ? Number(params.get('limit')) : undefined,
    offset: params.get('offset') ? Number(params.get('offset')) : undefined,
    status: params.get('status') || undefined,
  });
};

/**
 * 케이스 상세 fetcher
 */
export const caseFetcher = async (url: string) => {
  const id = url.split('/').pop();
  if (!id) throw new Error('Invalid case URL');
  return legalApi.getCase(id);
};

/**
 * KPI fetcher
 */
export const kpiFetcher = async () => {
  return legalApi.getDashboardKpi();
};
