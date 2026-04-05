import { randomUUID } from 'crypto';
import type { LegalDocument, DocumentChunk } from '../types/legal-document.js';

/**
 * 문서 청킹 전략
 *
 * 법률 문서는 구조화되어 있으므로 섹션 기반 청킹이 효과적
 * - 사실관계 (facts)
 * - 판결 이유 (reasoning)
 * - 주문 (decision)
 *
 * 각 섹션이 너무 길면 오버랩 방식으로 분할
 */

const DEFAULT_CHUNK_SIZE = 512;     // 토큰 기준 (대략 한글 256자)
const DEFAULT_CHUNK_OVERLAP = 64;   // 오버랩 토큰

export interface ChunkOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
  includeMetadata?: boolean;
}

/**
 * 문서를 청크로 분할
 */
export function chunkDocument(doc: LegalDocument, options?: ChunkOptions): DocumentChunk[] {
  const maxSize = options?.maxChunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  // 섹션별 청킹
  const sections: Array<{ type: DocumentChunk['chunkType']; content: string | undefined }> = [
    { type: 'facts', content: doc.facts },
    { type: 'reasoning', content: doc.reasoning },
    { type: 'decision', content: doc.decision }
  ];

  for (const section of sections) {
    if (!section.content || section.content.trim().length === 0) continue;

    const sectionChunks = splitText(section.content, maxSize, overlap);

    for (const content of sectionChunks) {
      chunks.push({
        id: randomUUID(),
        documentId: doc.id,
        chunkIndex: chunkIndex++,
        chunkType: section.type,
        content: addMetadataPrefix(doc, section.type, content, options?.includeMetadata ?? true),
        tokenCount: estimateTokens(content),
        embedding: [] // 임베딩은 별도 처리
      });
    }
  }

  // 섹션이 없는 경우 전문 청킹
  if (chunks.length === 0 && doc.fullText) {
    const fullChunks = splitText(doc.fullText, maxSize, overlap);

    for (const content of fullChunks) {
      chunks.push({
        id: randomUUID(),
        documentId: doc.id,
        chunkIndex: chunkIndex++,
        chunkType: 'full',
        content: addMetadataPrefix(doc, 'full', content, options?.includeMetadata ?? true),
        tokenCount: estimateTokens(content),
        embedding: []
      });
    }
  }

  return chunks;
}

/**
 * 텍스트를 최대 크기로 분할 (오버랩 적용)
 */
function splitText(text: string, maxSize: number, overlap: number): string[] {
  const tokens = estimateTokens(text);

  if (tokens <= maxSize) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?。！？])\s+/);

  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > maxSize && currentChunk) {
      chunks.push(currentChunk.trim());

      // 오버랩 적용: 마지막 N 토큰 유지
      const words = currentChunk.split(/\s+/);
      const overlapWords = Math.min(overlap / 2, words.length);
      currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * 메타데이터 프리픽스 추가 (검색 품질 향상)
 */
function addMetadataPrefix(
  doc: LegalDocument,
  sectionType: DocumentChunk['chunkType'],
  content: string,
  includeMetadata: boolean
): string {
  if (!includeMetadata) return content;

  const sectionLabels: Record<DocumentChunk['chunkType'], string> = {
    facts: '사실관계',
    reasoning: '판결이유',
    decision: '주문',
    full: '판결문'
  };

  const prefix = [
    `[${doc.caseNumber}]`,
    `${doc.courtName}`,
    `${doc.judgmentDate}`,
    `${sectionLabels[sectionType]}`
  ].join(' | ');

  return `${prefix}\n\n${content}`;
}

/**
 * 토큰 수 추정 (한글 기준)
 * 실제로는 토크나이저 사용 권장
 */
function estimateTokens(text: string): number {
  // 한글은 대략 1~2 토큰/글자, 공백/구두점 포함
  // 보수적으로 1.5 토큰/글자 추정
  return Math.ceil(text.length * 1.5);
}

/**
 * 청킹 통계
 */
export function getChunkStats(chunks: DocumentChunk[]): ChunkStats {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      byType: {}
    };
  }

  const tokens = chunks.map(c => c.tokenCount);
  const byType: Record<string, number> = {};

  for (const chunk of chunks) {
    byType[chunk.chunkType] = (byType[chunk.chunkType] || 0) + 1;
  }

  return {
    totalChunks: chunks.length,
    avgTokens: Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length),
    minTokens: Math.min(...tokens),
    maxTokens: Math.max(...tokens),
    byType
  };
}

interface ChunkStats {
  totalChunks: number;
  avgTokens: number;
  minTokens: number;
  maxTokens: number;
  byType: Record<string, number>;
}
