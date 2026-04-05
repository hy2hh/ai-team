# Legal RAG Pipeline

AI Hub, lbox-open, 법망 API를 통합하는 법률 RAG 파이프라인.

## 데이터 소스

| 소스 | 규모 | 라이선스 | 상태 |
|------|------|----------|------|
| AI Hub 법률 데이터셋 | ~9,000건 | 공공 | ✅ 즉시 사용 |
| lbox-open 판결문 | ~150,000건 | MIT | ✅ 즉시 사용 |
| 법망 API (대법원) | ~50,000건 | 공공 | ✅ API 키 필요 |
| 엘박스 파트너십 | ~2,000,000건 | 협상 필요 | 🔄 대기 중 |

## 설치

```bash
npm install
```

## 데이터 수집

```bash
# 모든 소스 수집
npm run ingest

# 특정 소스만
npm run ingest:aihub
npm run ingest:lbox
npm run ingest:lawnet

# 테스트 (100건만)
npm run ingest -- --source=aihub --limit=100 --skip-embedding
```

## 검색

```typescript
import { search } from './src/index.js';

const results = await search('임대차 보증금 반환');

for (const result of results) {
  console.log(`[${result.document.caseNumber}] Score: ${result.score.toFixed(3)}`);
  console.log(result.highlights.join(' ... '));
}
```

## 아키텍처

```
legal-rag/
├── src/
│   ├── datasources/     # 데이터 소스 어댑터
│   │   ├── interface.ts   # 공통 인터페이스
│   │   ├── aihub-adapter.ts
│   │   ├── lbox-open-adapter.ts
│   │   └── lawnet-adapter.ts
│   ├── pipeline/        # 수집 파이프라인
│   │   ├── ingest.ts      # 메인 수집 로직
│   │   ├── chunker.ts     # 문서 청킹
│   │   └── embedder.ts    # 임베딩 생성
│   ├── vectordb/        # 벡터 저장소
│   │   └── schema.ts      # SQLite + FTS5
│   ├── types/           # 타입 정의
│   │   └── legal-document.ts
│   └── index.ts         # 진입점 + 검색 API
└── data/
    ├── raw/             # 원본 데이터
    └── legal.db         # SQLite DB
```

## 향후 확장

엘박스 파트너십 성사 시:
1. `src/datasources/lbox-partner-adapter.ts` 구현
2. `registerDefaultAdapters()`에 등록
3. `npm run ingest:lbox-partner` 실행

어댑터 인터페이스가 동일하므로 기존 코드 수정 불필요.
