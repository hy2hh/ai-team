/**
 * AI 법률 서비스 타입 정의
 * Backend legal-rag 타입과 동기화
 */

// 사건 유형
export type CaseType =
  | 'civil'        // 민사
  | 'criminal'     // 형사
  | 'administrative' // 행정
  | 'family'       // 가사
  | 'patent'       // 특허
  | 'labor'        // 노동
  | 'tax'          // 세무
  | 'other';       // 기타

// 법원 계층
export type CourtLevel =
  | 'supreme'      // 대법원
  | 'high'         // 고등법원
  | 'district'     // 지방법원
  | 'family'       // 가정법원
  | 'administrative' // 행정법원
  | 'patent';      // 특허법원

// 판결 결과
export type Verdict =
  | 'plaintiff_win'      // 원고 승
  | 'defendant_win'      // 피고 승
  | 'partial'            // 일부 승/패
  | 'dismissed'          // 각하
  | 'rejected'           // 기각
  | 'settlement'         // 화해/조정
  | 'unknown';           // 미상

// 법률 문서
export interface LegalDocument {
  id: string;
  sourceId: string;
  source: 'aihub' | 'lbox-open' | 'lawnet' | 'lbox-partner';
  caseNumber: string;
  caseType: CaseType;
  courtLevel: CourtLevel;
  courtName: string;
  judgmentDate: string;
  verdict: Verdict;
  title: string;
  facts?: string;
  reasoning?: string;
  decision?: string;
  fullText: string;
  citedLaws: string[];
  citedCases: string[];
  keywords: string[];
  legalIssues: string[];
  createdAt: string;
  updatedAt: string;
}

// 청크
export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  chunkType: 'facts' | 'reasoning' | 'decision' | 'full';
  content: string;
  tokenCount: number;
}

// 검색 결과
export interface SearchResult {
  chunk: DocumentChunk;
  document: LegalDocument;
  score: number;
  highlights: string[];
}

// 검색 필터
export interface SearchFilters {
  caseType?: CaseType[];
  courtLevel?: CourtLevel[];
  verdict?: Verdict[];
  dateFrom?: string;
  dateTo?: string;
}

// 검색 요청
export interface SearchRequest {
  query: string;
  limit?: number;
  filters?: SearchFilters;
}

// 라벨 매핑
export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  civil: '민사',
  criminal: '형사',
  administrative: '행정',
  family: '가사',
  patent: '특허',
  labor: '노동',
  tax: '세무',
  other: '기타',
};

export const COURT_LEVEL_LABELS: Record<CourtLevel, string> = {
  supreme: '대법원',
  high: '고등법원',
  district: '지방법원',
  family: '가정법원',
  administrative: '행정법원',
  patent: '특허법원',
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  plaintiff_win: '원고 승',
  defendant_win: '피고 승',
  partial: '일부 승/패',
  dismissed: '각하',
  rejected: '기각',
  settlement: '화해/조정',
  unknown: '미상',
};

// ════════════════════════════════════════════════════════════
// 케이스 관리 타입
// ════════════════════════════════════════════════════════════

export type CaseStatus = 'submitted' | 'analyzing' | 'completed' | 'error';

export interface Case {
  id: string;
  userId: string;
  title: string;
  category: string;
  description: string;
  opposingParty?: string;
  incidentDate?: string;
  evidenceList?: string[];
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseRequest {
  title: string;
  category: string;
  description: string;
  opposingParty?: string;
  incidentDate?: string;
  evidenceList?: string[];
}

export interface CaseListResponse {
  cases: Case[];
  total: number;
  limit: number;
  offset: number;
}

export interface AnalysisResult {
  caseId: string;
  winProbability: number;
  confidence: number;
  legalBasis: Array<{ law: string; article?: string; relevance: string }>;
  relatedCases: Array<{
    caseNumber: string;
    courtName: string;
    judgmentDate: string;
    summary: string;
    verdict: Verdict;
    similarity: number;
  }>;
  recommendations: string[];
  warnings: string[];
  summary: string;
  analyzedAt: string;
  modelVersion: string;
}

export interface CaseWithAnalysis extends Case {
  analysis: AnalysisResult | null;
}

export interface AnalyzeResponse {
  caseId: string;
  status: 'completed' | 'error';
  result?: AnalysisResult;
  error?: { code: string; message: string };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  confidence?: 'high' | 'mid' | 'low';
  createdAt: string;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  message: ChatMessage;
}

export interface CreateDocumentRequest {
  caseId: string;
  type: 'certified_content' | 'contract_review' | 'legal_notice';
  senderName?: string;
  senderAddress?: string;
  recipientName?: string;
  recipientAddress?: string;
  content?: string;
}

export interface GeneratedDocument {
  id: string;
  caseId: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  isPaid: boolean;
  paymentAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardKpi {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  averageWinProbability: number;
}

// 카테고리 라벨
export const CATEGORY_LABELS: Record<string, string> = {
  labor: '노동·임금',
  contract: '계약·거래',
  lease: '임대차',
  family: '이혼·가족',
  criminal: '형사',
  damages: '손해배상',
  inheritance: '상속',
  other: '기타',
};

// 상태 라벨
export const STATUS_LABELS: Record<CaseStatus, string> = {
  submitted: '접수됨',
  analyzing: '분석 중',
  completed: '완료',
  error: '오류',
};
