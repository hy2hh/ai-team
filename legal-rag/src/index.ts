/**
 * Legal RAG Pipeline
 *
 * AI Hub, lbox-open, 법망 API를 통합하는 법률 RAG 파이프라인
 *
 * 핵심 컴포넌트:
 * - DataSource: 다양한 데이터 소스 어댑터 (플러그인 방식)
 * - VectorDB: SQLite 기반 로컬 벡터 저장소
 * - Pipeline: 수집 → 청킹 → 임베딩 → 저장
 *
 * 사용 예시:
 *
 * ```typescript
 * import { search, ingest } from 'legal-rag';
 *
 * // 데이터 수집
 * await ingest({ source: 'aihub', limit: 1000 });
 *
 * // 검색
 * const results = await search('임대차 보증금 반환');
 * ```
 */

export * from './types/legal-document.js';
export * from './datasources/index.js';
export * from './vectordb/index.js';
export * from './pipeline/index.js';

import { initDatabase, DocumentStore } from './vectordb/index.js';
import { embedQuery } from './pipeline/embedder.js';
import type { SearchResult, LegalDocument, DocumentChunk } from './types/legal-document.js';

/**
 * 통합 검색 함수
 * 벡터 유사도 + 키워드 검색 하이브리드
 */
export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const db = initDatabase(options.dbPath || './data/legal.db');
  const store = new DocumentStore(db);

  const vectorWeight = options.vectorWeight ?? 0.7;
  const keywordWeight = 1 - vectorWeight;
  const limit = options.limit ?? 10;

  // 벡터 검색
  const queryEmbedding = await embedQuery(query);
  const vectorResults = store.searchVector(queryEmbedding, limit * 2);

  // 키워드 검색
  const keywordResults = store.searchFTS(query, limit * 2);

  // 문서 ID → 점수 매핑
  const scoreMap = new Map<string, { vectorScore: number; keywordRank: number; doc?: LegalDocument; chunk?: DocumentChunk }>();

  // 벡터 결과 점수
  for (const { chunk, score } of vectorResults) {
    const existing = scoreMap.get(chunk.documentId) || { vectorScore: 0, keywordRank: Infinity };
    existing.vectorScore = Math.max(existing.vectorScore, score);
    existing.chunk = chunk;
    scoreMap.set(chunk.documentId, existing);
  }

  // 키워드 결과 점수 (순위 기반)
  keywordResults.forEach((doc, idx) => {
    const existing = scoreMap.get(doc.id) || { vectorScore: 0, keywordRank: Infinity };
    existing.keywordRank = Math.min(existing.keywordRank, idx + 1);
    existing.doc = doc;
    scoreMap.set(doc.id, existing);
  });

  // 최종 점수 계산 및 정렬
  const results: SearchResult[] = [];

  for (const [docId, scores] of scoreMap.entries()) {
    // 키워드 순위를 점수로 변환 (1위 = 1.0, 점점 감소)
    const keywordScore = scores.keywordRank === Infinity
      ? 0
      : 1 / Math.log2(scores.keywordRank + 1);

    const finalScore = (scores.vectorScore * vectorWeight) + (keywordScore * keywordWeight);

    if (scores.doc && scores.chunk) {
      results.push({
        chunk: scores.chunk,
        document: scores.doc,
        score: finalScore,
        highlights: extractHighlights(scores.chunk.content, query)
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  db.close();
  return results.slice(0, limit);
}

/**
 * 하이라이트 추출
 */
function extractHighlights(content: string, query: string): string[] {
  const keywords = query.split(/\s+/).filter(k => k.length > 1);
  const highlights: string[] = [];

  for (const keyword of keywords) {
    const regex = new RegExp(`.{0,30}${keyword}.{0,30}`, 'gi');
    const matches = content.match(regex) || [];
    highlights.push(...matches.slice(0, 2));
  }

  return [...new Set(highlights)].slice(0, 3);
}

interface SearchOptions {
  dbPath?: string;
  limit?: number;
  vectorWeight?: number;  // 0-1, 나머지는 키워드 가중치
  filters?: {
    caseType?: string[];
    courtLevel?: string[];
    dateFrom?: string;
    dateTo?: string;
  };
}
