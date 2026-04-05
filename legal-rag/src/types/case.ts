import { z } from 'zod';

/**
 * 사용자 케이스 스키마
 * AI 법률 서비스에서 사용자가 입력하는 분쟁 상황
 */

// 케이스 상태 enum
export const CaseStatusSchema = z.enum([
  'draft',          // 초안 (입력 중)
  'submitted',      // 제출됨 (분석 대기)
  'analyzing',      // AI 분석 중
  'completed',      // 분석 완료
  'error'           // 오류 발생
]);

export type CaseStatus = z.infer<typeof CaseStatusSchema>;

// 케이스 카테고리 enum (MVP용 단순 분류)
export const CaseCategorySchema = z.enum([
  'contract',       // 계약 분쟁
  'lease',          // 임대차 분쟁
  'labor',          // 근로/노동 분쟁
  'damage',         // 손해배상
  'property',       // 부동산
  'family',         // 가사 (이혼, 상속 등)
  'criminal',       // 형사
  'other'           // 기타
]);

export type CaseCategory = z.infer<typeof CaseCategorySchema>;

/**
 * 사용자 케이스 스키마
 */
export const CaseSchema = z.object({
  id: z.string().uuid(),                    // 케이스 고유 ID
  userId: z.string(),                       // 사용자 ID

  // 케이스 정보
  title: z.string().min(1).max(200),        // 케이스 제목
  category: CaseCategorySchema,             // 분류
  description: z.string().min(10),          // 상황 설명

  // 관련 정보 (선택)
  opposingParty: z.string().optional(),     // 상대방 정보
  incidentDate: z.string().optional(),      // 사건 발생일
  evidenceList: z.array(z.string()).optional(),  // 증거 목록

  // 상태
  status: CaseStatusSchema,

  // 타임스탬프
  createdAt: z.string(),
  updatedAt: z.string()
});

export type Case = z.infer<typeof CaseSchema>;

/**
 * AI 분석 결과 스키마
 */
export const AnalysisResultSchema = z.object({
  caseId: z.string().uuid(),

  // 핵심 분석 결과
  winProbability: z.number().min(0).max(100),  // 승소 가능성 (%)
  confidence: z.number().min(0).max(100),      // 신뢰도 (%)

  // 법적 분석
  legalBasis: z.array(z.object({
    law: z.string(),                          // 적용 법령
    article: z.string().optional(),           // 조항
    relevance: z.string()                     // 관련성 설명
  })),

  // 관련 판례
  relatedCases: z.array(z.object({
    caseNumber: z.string(),
    courtName: z.string(),
    judgmentDate: z.string(),
    summary: z.string(),
    verdict: z.string(),
    similarity: z.number()                    // 유사도 (0-1)
  })),

  // 권장 조치
  recommendations: z.array(z.string()),

  // 주의사항/경고
  warnings: z.array(z.string()),

  // AI 생성 요약
  summary: z.string(),

  // 메타데이터
  analyzedAt: z.string(),
  modelVersion: z.string()
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * 생성 문서 스키마 (내용증명 등)
 */
export const GeneratedDocumentSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  userId: z.string(),

  // 문서 정보
  type: z.enum(['certified_content', 'contract_review', 'legal_notice']),
  title: z.string(),
  content: z.string(),                        // 생성된 문서 내용 (HTML/텍스트)

  // PDF 관련
  pdfPath: z.string().optional(),             // 생성된 PDF 파일 경로
  pdfGeneratedAt: z.string().optional(),

  // 결제 정보 (MVP: 단순 플래그)
  isPaid: z.boolean().default(false),
  paymentAmount: z.number().default(9900),

  // 타임스탬프
  createdAt: z.string(),
  updatedAt: z.string()
});

export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;

/**
 * API 요청/응답 타입
 */

// POST /api/cases 요청
export const CreateCaseRequestSchema = z.object({
  title: z.string().min(1).max(200),
  category: CaseCategorySchema,
  description: z.string().min(10),
  opposingParty: z.string().optional(),
  incidentDate: z.string().optional(),
  evidenceList: z.array(z.string()).optional()
});

export type CreateCaseRequest = z.infer<typeof CreateCaseRequestSchema>;

// POST /api/cases/:id/analyze 응답
export interface AnalyzeResponse {
  caseId: string;
  status: 'completed' | 'error';
  result?: AnalysisResult;
  error?: {
    code: 'EC-1' | 'EC-2' | 'EC-4';
    message: string;
  };
}

// POST /api/documents 요청
export const CreateDocumentRequestSchema = z.object({
  caseId: z.string().uuid(),
  type: z.enum(['certified_content', 'contract_review', 'legal_notice']),
  // 내용증명용 추가 필드
  senderName: z.string().optional(),
  senderAddress: z.string().optional(),
  recipientName: z.string().optional(),
  recipientAddress: z.string().optional(),
  content: z.string().optional()              // 사용자 지정 내용 (없으면 AI 생성)
});

export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>;
