import { z } from 'zod';

/**
 * 법률 문서 공통 스키마
 * AI Hub, lbox-open, 법망 API 등 다양한 소스의 데이터를 통합하는 정규화 스키마
 */

// 사건 유형 enum
export const CaseTypeSchema = z.enum([
  'civil',        // 민사
  'criminal',     // 형사
  'administrative', // 행정
  'family',       // 가사
  'patent',       // 특허
  'labor',        // 노동
  'tax',          // 세무
  'other'         // 기타
]);

export type CaseType = z.infer<typeof CaseTypeSchema>;

// 법원 계층 enum
export const CourtLevelSchema = z.enum([
  'supreme',      // 대법원
  'high',         // 고등법원
  'district',     // 지방법원
  'family',       // 가정법원
  'administrative', // 행정법원
  'patent'        // 특허법원
]);

export type CourtLevel = z.infer<typeof CourtLevelSchema>;

// 판결 결과 enum
export const VerdictSchema = z.enum([
  'plaintiff_win',      // 원고 승
  'defendant_win',      // 피고 승
  'partial',            // 일부 승/패
  'dismissed',          // 각하
  'rejected',           // 기각
  'settlement',         // 화해/조정
  'unknown'             // 미상
]);

export type Verdict = z.infer<typeof VerdictSchema>;

// 데이터 소스 enum
export const DataSourceSchema = z.enum([
  'aihub',        // AI Hub 법률 데이터셋
  'lbox-open',    // 엘박스 오픈 판결문
  'lawnet',       // 법망 API (법령/대법원)
  'lbox-partner'  // 엘박스 파트너십 (향후)
]);

export type DataSource = z.infer<typeof DataSourceSchema>;

/**
 * 정규화된 법률 문서 스키마
 */
export const LegalDocumentSchema = z.object({
  // 식별자
  id: z.string(),                        // 내부 고유 ID (UUID)
  sourceId: z.string(),                  // 원본 소스의 ID
  source: DataSourceSchema,              // 데이터 소스

  // 사건 정보
  caseNumber: z.string(),                // 사건번호 (예: 2023다12345)
  caseType: CaseTypeSchema,              // 사건 유형
  courtLevel: CourtLevelSchema,          // 법원 계층
  courtName: z.string(),                 // 법원명
  judgmentDate: z.string(),              // 판결일 (YYYY-MM-DD)

  // 판결 내용
  verdict: VerdictSchema,                // 판결 결과

  // 텍스트 필드
  title: z.string(),                     // 제목/요지
  facts: z.string().optional(),          // 사실관계
  reasoning: z.string().optional(),      // 판결 이유
  decision: z.string().optional(),       // 주문
  fullText: z.string(),                  // 전문

  // 법령 참조
  citedLaws: z.array(z.string()),        // 인용 법령
  citedCases: z.array(z.string()),       // 인용 판례

  // 분류/태그
  keywords: z.array(z.string()),         // 키워드
  legalIssues: z.array(z.string()),      // 법적 쟁점

  // 메타데이터
  createdAt: z.string(),                 // 수집 일시
  updatedAt: z.string(),                 // 갱신 일시

  // 임베딩 (Vector DB 저장용)
  embedding: z.array(z.number()).optional()
});

export type LegalDocument = z.infer<typeof LegalDocumentSchema>;

/**
 * 청크 스키마 (RAG 검색 단위)
 */
export const DocumentChunkSchema = z.object({
  id: z.string(),                        // 청크 고유 ID
  documentId: z.string(),                // 원본 문서 ID
  chunkIndex: z.number(),                // 청크 순서
  chunkType: z.enum([
    'facts',       // 사실관계
    'reasoning',   // 판결 이유
    'decision',    // 주문
    'full'         // 전문
  ]),
  content: z.string(),                   // 청크 텍스트
  tokenCount: z.number(),                // 토큰 수
  embedding: z.array(z.number())         // 임베딩 벡터
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

/**
 * 검색 결과 스키마
 */
export const SearchResultSchema = z.object({
  chunk: DocumentChunkSchema,
  document: LegalDocumentSchema.omit({ embedding: true }),
  score: z.number(),                     // 유사도 점수 (0-1)
  highlights: z.array(z.string())        // 하이라이트된 텍스트
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
