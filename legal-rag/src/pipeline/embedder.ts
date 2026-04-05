import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

/**
 * 임베딩 생성기
 *
 * 로컬 모델: multilingual-e5-small (한국어 지원, 384 dims)
 * 프로덕션 시 OpenAI text-embedding-3-small 또는 한국어 특화 모델 고려
 */

let embedderInstance: FeatureExtractionPipeline | null = null;

/**
 * 임베더 싱글톤 초기화
 */
export async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderInstance) {
    console.log('Loading embedding model...');
    embedderInstance = await pipeline(
      'feature-extraction',
      'Xenova/multilingual-e5-small',
      { quantized: true }
    ) as FeatureExtractionPipeline;
    console.log('Embedding model loaded.');
  }
  return embedderInstance;
}

/**
 * 텍스트 임베딩 생성
 */
export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();

  // E5 모델은 "query: " 또는 "passage: " 프리픽스 필요
  const prefixedText = `passage: ${text}`;

  const output = await embedder(prefixedText, {
    pooling: 'mean',
    normalize: true
  });

  return Array.from(output.data as Float32Array);
}

/**
 * 배치 임베딩 생성
 */
export async function embedBatch(texts: string[], batchSize: number = 32): Promise<number[][]> {
  const embedder = await getEmbedder();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const prefixedBatch = batch.map(t => `passage: ${t}`);

    const outputs = await embedder(prefixedBatch, {
      pooling: 'mean',
      normalize: true
    });

    // 배치 결과 처리
    const data = outputs.data as Float32Array;
    const dims = outputs.dims[1] as number;

    for (let j = 0; j < batch.length; j++) {
      const start = j * dims;
      const embedding = Array.from(data.slice(start, start + dims));
      results.push(embedding);
    }

    // 진행 상황 출력
    if (texts.length > batchSize) {
      console.log(`Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
    }
  }

  return results;
}

/**
 * 검색 쿼리용 임베딩 (query prefix 사용)
 */
export async function embedQuery(query: string): Promise<number[]> {
  const embedder = await getEmbedder();

  const prefixedQuery = `query: ${query}`;

  const output = await embedder(prefixedQuery, {
    pooling: 'mean',
    normalize: true
  });

  return Array.from(output.data as Float32Array);
}
