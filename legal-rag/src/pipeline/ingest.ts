import 'dotenv/config';
import pLimit from 'p-limit';
import { registerDefaultAdapters, type DataSource } from '../datasources/index.js';
import { initDatabase, DocumentStore } from '../vectordb/index.js';
import { chunkDocument, getChunkStats } from './chunker.js';
import { embedBatch } from './embedder.js';
import type { LegalDocument, DocumentChunk } from '../types/legal-document.js';

/**
 * 데이터 수집 파이프라인
 *
 * 사용법:
 *   npm run ingest              # 모든 소스 수집
 *   npm run ingest:aihub        # AI Hub만
 *   npm run ingest:lbox         # lbox-open만
 *   npm run ingest:lawnet       # 법망 API만
 */

interface IngestOptions {
  source?: DataSource;
  batchSize?: number;
  limit?: number;
  skipEmbedding?: boolean;
  dbPath?: string;
}

/**
 * 메인 수집 함수
 */
export async function ingest(options: IngestOptions = {}): Promise<IngestResult> {
  const startTime = Date.now();
  const registry = registerDefaultAdapters();
  const db = initDatabase(options.dbPath || './data/legal.db');
  const store = new DocumentStore(db);

  const sources = options.source
    ? [options.source]
    : registry.listSources();

  const result: IngestResult = {
    sources: {},
    totalDocuments: 0,
    totalChunks: 0,
    durationMs: 0
  };

  // 동시성 제한 (임베딩 메모리 고려)
  const limit = pLimit(2);

  for (const source of sources) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 Starting ingestion: ${source}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const adapter = await registry.get(source);

      // 헬스체크
      const health = await adapter.healthCheck();
      console.log(`Health: ${health.status} (${health.latencyMs}ms)`);
      if (health.details) console.log(`Details: ${health.details}`);

      if (health.status === 'unhealthy') {
        console.warn(`⚠️ Skipping ${source}: unhealthy`);
        result.sources[source] = { documents: 0, chunks: 0, status: 'skipped' };
        continue;
      }

      // 수집 상태 업데이트
      store.updateIngestionState(source, 0, 0, 'running');

      let sourceDocCount = 0;
      let sourceChunkCount = 0;

      // 문서 스트리밍 수집
      for await (const batch of adapter.fetchDocuments({
        batchSize: options.batchSize ?? 100,
        limit: options.limit
      })) {
        // 문서 저장
        for (const doc of batch) {
          store.upsertDocument(doc);
        }
        sourceDocCount += batch.length;

        // 청킹
        const allChunks: DocumentChunk[] = [];
        for (const doc of batch) {
          const chunks = chunkDocument(doc, { includeMetadata: true });
          allChunks.push(...chunks);
        }

        // 임베딩 생성 (선택적)
        if (!options.skipEmbedding && allChunks.length > 0) {
          const texts = allChunks.map(c => c.content);
          const embeddings = await embedBatch(texts, 16);

          for (let i = 0; i < allChunks.length; i++) {
            allChunks[i].embedding = embeddings[i];
          }
        }

        // 청크 저장
        store.insertChunks(allChunks);
        sourceChunkCount += allChunks.length;

        // 진행 상황 출력
        console.log(`  Processed: ${sourceDocCount} docs, ${sourceChunkCount} chunks`);
        store.updateIngestionState(source, sourceDocCount, sourceDocCount, 'running');
      }

      store.updateIngestionState(source, sourceDocCount, sourceDocCount, 'completed');

      result.sources[source] = {
        documents: sourceDocCount,
        chunks: sourceChunkCount,
        status: 'completed'
      };
      result.totalDocuments += sourceDocCount;
      result.totalChunks += sourceChunkCount;

      console.log(`✅ ${source}: ${sourceDocCount} documents, ${sourceChunkCount} chunks`);

    } catch (error) {
      console.error(`❌ Error ingesting ${source}:`, error);
      store.updateIngestionState(source, 0, 0, 'failed');
      result.sources[source] = {
        documents: 0,
        chunks: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  result.durationMs = Date.now() - startTime;

  // 최종 통계
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Ingestion Complete');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total documents: ${store.getDocumentCount()}`);
  console.log(`Total chunks: ${store.getChunkCount()}`);
  console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

  db.close();
  return result;
}

interface IngestResult {
  sources: Record<string, {
    documents: number;
    chunks: number;
    status: 'completed' | 'skipped' | 'failed';
    error?: string;
  }>;
  totalDocuments: number;
  totalChunks: number;
  durationMs: number;
}

// CLI 실행
if (import.meta.url.endsWith(process.argv[1])) {
  const args = process.argv.slice(2);
  const sourceArg = args.find(a => a.startsWith('--source='));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const skipEmbed = args.includes('--skip-embedding');

  const options: IngestOptions = {};

  if (sourceArg) {
    options.source = sourceArg.split('=')[1] as DataSource;
  }
  if (limitArg) {
    options.limit = parseInt(limitArg.split('=')[1], 10);
  }
  if (skipEmbed) {
    options.skipEmbedding = true;
  }

  ingest(options)
    .then(result => {
      console.log('\nResult:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
