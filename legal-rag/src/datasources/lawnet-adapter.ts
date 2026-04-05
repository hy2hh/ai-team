import { randomUUID } from 'crypto';
import type { IDataSource, FetchOptions, HealthCheckResult } from './interface.js';
import type { LegalDocument, CaseType, CourtLevel, Verdict } from '../types/legal-document.js';

/**
 * 법망(LawNet) API 어댑터
 *
 * 공공데이터포털 법령정보 API + 대법원 종합법률정보 API
 * - 법령: https://www.data.go.kr/data/15000197/openapi.do
 * - 판례: https://www.law.go.kr/ (대법원 판례만)
 *
 * 무료, API 키 필요
 */
export class LawNetAdapter implements IDataSource {
  readonly source = 'lawnet' as const;
  readonly displayName = '법망 API (법령/대법원 판례)';
  readonly estimatedCount = 50_000; // 대법원 판례 추정

  private apiKey: string;
  private baseUrl = 'https://www.law.go.kr/DRF/lawSearch.do';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LAWNET_API_KEY || '';
    if (!this.apiKey) {
      console.warn('LawNet API key not configured. Set LAWNET_API_KEY env variable.');
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    if (!this.apiKey) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        details: 'API key not configured'
      };
    }

    try {
      // 간단한 API 호출 테스트
      const response = await fetch(
        `${this.baseUrl}?OC=${this.apiKey}&target=prec&type=JSON&display=1`
      );

      if (!response.ok) {
        return {
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          details: `HTTP ${response.status}`
        };
      }

      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        details: 'API accessible'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        details: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  async *fetchDocuments(options?: FetchOptions): AsyncGenerator<LegalDocument[], void, unknown> {
    const batchSize = options?.batchSize ?? 100;
    const limit = options?.limit ?? Infinity;
    let offset = options?.offset ?? 0;
    let totalProcessed = 0;

    while (totalProcessed < limit) {
      const pageSize = Math.min(batchSize, limit - totalProcessed, 100); // API 최대 100건

      try {
        const url = new URL(this.baseUrl);
        url.searchParams.set('OC', this.apiKey);
        url.searchParams.set('target', 'prec'); // 판례
        url.searchParams.set('type', 'JSON');
        url.searchParams.set('display', String(pageSize));
        url.searchParams.set('page', String(Math.floor(offset / pageSize) + 1));

        // 필터 적용
        if (options?.filters?.dateFrom) {
          url.searchParams.set('date1', options.filters.dateFrom.replace(/-/g, ''));
        }
        if (options?.filters?.dateTo) {
          url.searchParams.set('date2', options.filters.dateTo.replace(/-/g, ''));
        }
        if (options?.filters?.keywords?.length) {
          url.searchParams.set('query', options.filters.keywords.join(' '));
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as LawNetResponse;
        const items = data.PrecSearch?.prec || [];

        if (items.length === 0) break; // 더 이상 데이터 없음

        const batch: LegalDocument[] = [];
        for (const raw of items) {
          batch.push(this.normalize(raw));
          totalProcessed++;
        }

        yield batch;
        offset += pageSize;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error('LawNet API error:', error);
        break;
      }
    }
  }

  async getDocument(sourceId: string): Promise<LegalDocument | null> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('OC', this.apiKey);
      url.searchParams.set('target', 'prec');
      url.searchParams.set('type', 'JSON');
      url.searchParams.set('ID', sourceId); // 판례 고유 ID

      const response = await fetch(url.toString());
      if (!response.ok) return null;

      const data = await response.json() as LawNetResponse;
      const item = data.PrecSearch?.prec?.[0];
      if (!item) return null;

      return this.normalize(item);
    } catch {
      return null;
    }
  }

  async *fetchUpdates(since: Date): AsyncGenerator<LegalDocument[], void, unknown> {
    const sinceStr = since.toISOString().slice(0, 10).replace(/-/g, '');

    yield* this.fetchDocuments({
      filters: {
        dateFrom: sinceStr
      }
    });
  }

  /**
   * 법망 API 응답 → 정규화 스키마 변환
   */
  private normalize(raw: LawNetPrec): LegalDocument {
    return {
      id: randomUUID(),
      sourceId: raw.판례일련번호 || raw.판례정보일련번호 || randomUUID(),
      source: 'lawnet',

      caseNumber: raw.사건번호 || raw.사건명 || '',
      caseType: this.mapCaseType(raw.사건종류명 || raw.사건종류),
      courtLevel: 'supreme', // 법망 API는 대법원 판례만
      courtName: raw.법원명 || '대법원',
      judgmentDate: this.formatDate(raw.선고일자),

      verdict: this.extractVerdict(raw.선고 || raw.판결유형),

      title: raw.사건명 || raw.판시사항 || '',
      facts: undefined, // 법망 API는 사실관계 미제공
      reasoning: raw.판결요지 || raw.판례내용,
      decision: raw.주문,
      fullText: [raw.판시사항, raw.판결요지, raw.판례내용, raw.주문]
        .filter(Boolean)
        .join('\n\n'),

      citedLaws: this.extractLaws(raw.참조조문),
      citedCases: this.extractCases(raw.참조판례),

      keywords: [],
      legalIssues: raw.판시사항 ? [raw.판시사항] : [],

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private mapCaseType(type: string | undefined): CaseType {
    if (!type) return 'other';

    const mapping: Record<string, CaseType> = {
      '민사': 'civil',
      '형사': 'criminal',
      '행정': 'administrative',
      '가사': 'family',
      '특허': 'patent',
      '세무': 'tax'
    };

    for (const [key, value] of Object.entries(mapping)) {
      if (type.includes(key)) return value;
    }
    return 'other';
  }

  private extractVerdict(type: string | undefined): Verdict {
    if (!type) return 'unknown';
    if (type.includes('파기')) return 'plaintiff_win';
    if (type.includes('기각')) return 'defendant_win';
    if (type.includes('일부')) return 'partial';
    if (type.includes('각하')) return 'dismissed';
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

  private extractLaws(text: string | undefined): string[] {
    if (!text) return [];
    // 법령 참조 파싱 (예: "민법 제750조", "형법 제329조")
    const matches = text.match(/[가-힣]+법[^,;]*제\d+조[의\d]*/g) || [];
    return [...new Set(matches)];
  }

  private extractCases(text: string | undefined): string[] {
    if (!text) return [];
    // 판례번호 파싱 (예: "2020다12345")
    const matches = text.match(/\d{4}[가-힣]+\d+/g) || [];
    return [...new Set(matches)];
  }
}

/**
 * 법망 API 응답 타입
 */
interface LawNetResponse {
  PrecSearch?: {
    prec?: LawNetPrec[];
    totalCnt?: number;
  };
}

interface LawNetPrec {
  판례일련번호?: string;
  판례정보일련번호?: string;
  사건번호?: string;
  사건명?: string;
  사건종류명?: string;
  사건종류?: string;
  법원명?: string;
  선고일자?: string;
  선고?: string;
  판결유형?: string;
  판시사항?: string;
  판결요지?: string;
  참조조문?: string;
  참조판례?: string;
  판례내용?: string;
  주문?: string;
}
