import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { IDataSource, FetchOptions, HealthCheckResult } from './interface.js';
import type { LegalDocument, CaseType, CourtLevel, Verdict } from '../types/legal-document.js';

/**
 * lbox-open 어댑터
 *
 * GitHub: https://github.com/lbox-kr/lbox-open
 * MIT 라이선스, 판결문 15만건
 *
 * 데이터 형식: JSON Lines (.jsonl)
 * 필드: case_no, case_name, court_name, judgment_date, case_type, facts, reasoning, conclusion, ...
 */
export class LboxOpenAdapter implements IDataSource {
  readonly source = 'lbox-open' as const;
  readonly displayName = 'LBox Open (판결문 15만건)';
  readonly estimatedCount = 150_000;

  private dataPath: string;

  constructor(dataPath: string = './data/raw/lbox-open') {
    this.dataPath = dataPath;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const files = await glob(`${this.dataPath}/**/*.jsonl`);
      return {
        status: files.length > 0 ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        details: `Found ${files.length} JSONL files`
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

    const files = await glob(`${this.dataPath}/**/*.jsonl`);
    let totalProcessed = 0;
    let batch: LegalDocument[] = [];

    for (const file of files) {
      if (totalProcessed >= limit) break;

      const content = await readFile(file, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (totalProcessed >= limit) break;

        try {
          const raw = JSON.parse(line);
          const doc = this.normalize(raw);
          batch.push(doc);
          totalProcessed++;

          if (batch.length >= batchSize) {
            yield batch;
            batch = [];
          }
        } catch (e) {
          console.warn(`Failed to parse line in ${file}:`, e);
        }
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  async getDocument(sourceId: string): Promise<LegalDocument | null> {
    // 전체 스캔이 필요하므로 실제 구현시 인덱스 필요
    for await (const batch of this.fetchDocuments()) {
      const doc = batch.find(d => d.sourceId === sourceId);
      if (doc) return doc;
    }
    return null;
  }

  async *fetchUpdates(since: Date): AsyncGenerator<LegalDocument[], void, unknown> {
    // lbox-open은 정적 데이터셋이므로 증분 업데이트 불필요
    // 새 릴리즈 시 전체 재수집
    console.log(`lbox-open: Static dataset, no updates since ${since.toISOString()}`);
  }

  /**
   * lbox-open 원본 형식 → 정규화 스키마 변환
   */
  private normalize(raw: LboxOpenRaw): LegalDocument {
    return {
      id: randomUUID(),
      sourceId: raw.id || raw.case_no,
      source: 'lbox-open',

      caseNumber: raw.case_no,
      caseType: this.mapCaseType(raw.case_type),
      courtLevel: this.mapCourtLevel(raw.court_name),
      courtName: raw.court_name,
      judgmentDate: this.formatDate(raw.judgment_date),

      verdict: this.extractVerdict(raw.conclusion),

      title: raw.case_name || raw.case_no,
      facts: raw.facts,
      reasoning: raw.reasoning,
      decision: raw.conclusion,
      fullText: [raw.facts, raw.reasoning, raw.conclusion].filter(Boolean).join('\n\n'),

      citedLaws: raw.cited_laws || [],
      citedCases: raw.cited_cases || [],

      keywords: raw.keywords || [],
      legalIssues: raw.legal_issues || [],

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private mapCaseType(type: string): CaseType {
    const mapping: Record<string, CaseType> = {
      '민사': 'civil',
      '형사': 'criminal',
      '행정': 'administrative',
      '가사': 'family',
      '특허': 'patent',
      '노동': 'labor',
      '세무': 'tax'
    };
    return mapping[type] || 'other';
  }

  private mapCourtLevel(courtName: string): CourtLevel {
    if (courtName.includes('대법원')) return 'supreme';
    if (courtName.includes('고등법원')) return 'high';
    if (courtName.includes('가정법원')) return 'family';
    if (courtName.includes('행정법원')) return 'administrative';
    if (courtName.includes('특허법원')) return 'patent';
    return 'district';
  }

  private extractVerdict(conclusion: string | undefined): Verdict {
    if (!conclusion) return 'unknown';
    if (conclusion.includes('원고 승')) return 'plaintiff_win';
    if (conclusion.includes('피고 승') || conclusion.includes('기각')) return 'defendant_win';
    if (conclusion.includes('일부')) return 'partial';
    if (conclusion.includes('각하')) return 'dismissed';
    if (conclusion.includes('화해') || conclusion.includes('조정')) return 'settlement';
    return 'unknown';
  }

  private formatDate(date: string | undefined): string {
    if (!date) return '1970-01-01';
    // YYYYMMDD → YYYY-MM-DD
    if (/^\d{8}$/.test(date)) {
      return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    }
    return date;
  }
}

/**
 * lbox-open 원본 JSON 형식 (추정)
 */
interface LboxOpenRaw {
  id?: string;
  case_no: string;
  case_name?: string;
  court_name: string;
  judgment_date?: string;
  case_type: string;
  facts?: string;
  reasoning?: string;
  conclusion?: string;
  cited_laws?: string[];
  cited_cases?: string[];
  keywords?: string[];
  legal_issues?: string[];
}
