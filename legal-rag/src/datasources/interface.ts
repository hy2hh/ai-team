import type { LegalDocument, DataSource } from '../types/legal-document.js';

/**
 * DataSource 인터페이스
 *
 * 모든 데이터 소스 어댑터가 구현해야 하는 공통 인터페이스.
 * 엘박스 파트너십 성사 시에도 이 인터페이스만 구현하면 즉시 연동 가능.
 */
export interface IDataSource {
  /** 데이터 소스 식별자 */
  readonly source: DataSource;

  /** 데이터 소스 이름 (표시용) */
  readonly displayName: string;

  /** 예상 문서 수 */
  readonly estimatedCount: number;

  /**
   * 데이터 소스 연결 상태 확인
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * 문서 스트림으로 가져오기 (대용량 처리용)
   * @param options 페이지네이션 및 필터 옵션
   */
  fetchDocuments(options?: FetchOptions): AsyncGenerator<LegalDocument[], void, unknown>;

  /**
   * 단일 문서 조회
   * @param sourceId 소스별 원본 ID
   */
  getDocument(sourceId: string): Promise<LegalDocument | null>;

  /**
   * 증분 업데이트 (신규/변경 문서만)
   * @param since 마지막 동기화 이후
   */
  fetchUpdates(since: Date): AsyncGenerator<LegalDocument[], void, unknown>;
}

/**
 * 헬스체크 결과
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  details?: string;
  lastUpdated?: Date;
}

/**
 * 페치 옵션
 */
export interface FetchOptions {
  /** 페이지 크기 (기본 100) */
  batchSize?: number;

  /** 시작 오프셋 */
  offset?: number;

  /** 최대 문서 수 (테스트용) */
  limit?: number;

  /** 필터 조건 */
  filters?: {
    caseType?: string[];
    courtLevel?: string[];
    dateFrom?: string;
    dateTo?: string;
    keywords?: string[];
  };
}

/**
 * 데이터 소스 팩토리
 */
export type DataSourceFactory = () => Promise<IDataSource>;

/**
 * 데이터 소스 레지스트리
 * 런타임에 어댑터 등록/조회
 */
export class DataSourceRegistry {
  private static instance: DataSourceRegistry;
  private sources: Map<DataSource, DataSourceFactory> = new Map();

  private constructor() {}

  static getInstance(): DataSourceRegistry {
    if (!DataSourceRegistry.instance) {
      DataSourceRegistry.instance = new DataSourceRegistry();
    }
    return DataSourceRegistry.instance;
  }

  /**
   * 어댑터 등록
   */
  register(source: DataSource, factory: DataSourceFactory): void {
    this.sources.set(source, factory);
  }

  /**
   * 어댑터 조회
   */
  async get(source: DataSource): Promise<IDataSource> {
    const factory = this.sources.get(source);
    if (!factory) {
      throw new Error(`DataSource not registered: ${source}`);
    }
    return factory();
  }

  /**
   * 등록된 모든 소스 목록
   */
  listSources(): DataSource[] {
    return Array.from(this.sources.keys());
  }

  /**
   * 모든 소스 헬스체크
   */
  async healthCheckAll(): Promise<Map<DataSource, HealthCheckResult>> {
    const results = new Map<DataSource, HealthCheckResult>();

    for (const source of this.sources.keys()) {
      try {
        const adapter = await this.get(source);
        results.set(source, await adapter.healthCheck());
      } catch (error) {
        results.set(source, {
          status: 'unhealthy',
          latencyMs: -1,
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}
