import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { IDataSource, FetchOptions, HealthCheckResult } from './interface.js';
import type { LegalDocument, CaseType, CourtLevel, Verdict } from '../types/legal-document.js';

/**
 * AI Hub 법률 데이터 어댑터
 *
 * 출처: https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=99
 * 약 9,000건의 법률 상담 및 판결문 데이터
 *
 * 데이터 형식: JSON
 */
export class AIHubAdapter implements IDataSource {
  readonly source = 'aihub' as const;
  readonly displayName = 'AI Hub 법률 데이터셋';
  readonly estimatedCount = 9_000;

  private dataPath: string;

  constructor(dataPath: string = './data/raw/aihub') {
    this.dataPath = dataPath;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const files = await glob(`${this.dataPath}/**/*.json`);
      return {
        status: files.length > 0 ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        details: `Found ${files.length} JSON files`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async *fetchDocuments(options?: FetchOptions): AsyncGenerator<LegalDocument[], void, unknown> {
    const batchSize = options?.batchSize ?? 100;
    const limit = options?.limit ?? Infinity;

    const files = await glob(`${this.dataPath}/**/*.json`);
    let totalProcessed = 0;
    let batch: LegalDocument[] = [];

    for (const file of files) {
      if (totalProcessed >= limit) break;

      try {
        const content = await readFile(file, 'utf-8');
        const data = JSON.parse(content);

        // AI Hub 데이터는 배열 또는 단일 객체
        const items = Array.isArray(data) ? data : [data];

        for (const raw of items) {
          if (totalProcessed >= limit) break;

          const doc = this.normalize(raw);
          batch.push(doc);
          totalProcessed++;

          if (batch.length >= batchSize) {
            yield batch;
            batch = [];
          }
        }
      } catch (e) {
        console.warn(`Failed to parse ${file}:`, e);
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  async getDocument(sourceId: string): Promise<LegalDocument | null> {
    for await (const batch of this.fetchDocuments()) {
      const doc = batch.find(d => d.sourceId === sourceId);
      if (doc) return doc;
    }
    return null;
  }

  async *fetchUpdates(since: Date): AsyncGenerator<LegalDocument[], void, unknown> {
    console.log(`AI Hub: Static dataset, no updates since ${since.toISOString()}`);
  }

  /**
   * AI Hub 원본 형식 → 정규화 스키마 변환
   */
  private normalize(raw: AIHubRaw): LegalDocument {
    return {
      id: randomUUID(),
      sourceId: raw.doc_id || randomUUID(),
      source: 'aihub',

      caseNumber: raw.case_number || 'N/A',
      caseType: this.mapCaseType(raw.category),
      courtLevel: this.mapCourtLevel(raw.court),
      courtName: raw.court || '미상',
      judgmentDate: raw.date || '1970-01-01',

      verdict: this.extractVerdict(raw),

      title: raw.title || raw.summary || '',
      facts: raw.facts || raw.case_description,
      reasoning: raw.reasoning,
      decision: raw.decision || raw.conclusion,
      fullText: raw.full_text || [
        raw.facts || raw.case_description,
        raw.reasoning,
        raw.decision || raw.conclusion
      ].filter(Boolean).join('\n\n'),

      citedLaws: raw.related_laws || [],
      citedCases: raw.related_cases || [],

      keywords: raw.keywords || [],
      legalIssues: raw.legal_issues || [],

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private mapCaseType(category: string | undefined): CaseType {
    if (!category) return 'other';

    const mapping: Record<string, CaseType> = {
      '민사': 'civil',
      '형사': 'criminal',
      '행정': 'administrative',
      '가사': 'family',
      '가족': 'family',
      '특허': 'patent',
      '지식재산': 'patent',
      '노동': 'labor',
      '근로': 'labor',
      '세금': 'tax',
      '조세': 'tax'
    };

    for (const [key, value] of Object.entries(mapping)) {
      if (category.includes(key)) return value;
    }
    return 'other';
  }

  private mapCourtLevel(court: string | undefined): CourtLevel {
    if (!court) return 'district';
    if (court.includes('대법원')) return 'supreme';
    if (court.includes('고등')) return 'high';
    if (court.includes('가정')) return 'family';
    if (court.includes('행정')) return 'administrative';
    if (court.includes('특허')) return 'patent';
    return 'district';
  }

  private extractVerdict(raw: AIHubRaw): Verdict {
    const text = raw.decision || raw.conclusion || raw.verdict || '';
    if (text.includes('인용') || text.includes('원고승')) return 'plaintiff_win';
    if (text.includes('기각')) return 'defendant_win';
    if (text.includes('일부')) return 'partial';
    if (text.includes('각하')) return 'dismissed';
    return 'unknown';
  }
}

/**
 * AI Hub 원본 JSON 형식 (추정)
 */
interface AIHubRaw {
  doc_id?: string;
  title?: string;
  summary?: string;
  case_number?: string;
  court?: string;
  category?: string;
  date?: string;
  facts?: string;
  case_description?: string;
  reasoning?: string;
  decision?: string;
  conclusion?: string;
  verdict?: string;
  full_text?: string;
  related_laws?: string[];
  related_cases?: string[];
  keywords?: string[];
  legal_issues?: string[];
}
