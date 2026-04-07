---
date: 2026-04-07
topic: memory
roles: [all]
summary: 메모리 시스템 Read 비용 56K→12K 토큰(78%) 절감 — 파일시스템 기반 3단계 최적화 채택
status: accepted
---

# Decision: 메모리 시스템 Read 비용 최적화 — 파일시스템 기반 3단계 전략

Date: 2026-04-07
Decided by: sid
Status: accepted

## Context

프로젝트 규모 성장에 따라 에이전트 세션당 Read 비용이 평균 ~56K 토큰에 도달.
주요 병목: `decisions/` 3,313 lines, `handoff/` 전체 로드, `context/` 일괄 로드.
RAG(벡터 임베딩) 도입을 검토했으나 이 프로젝트의 검색 패턴은 구조적 필터링으로 충분하다고 판단.

## Options Considered

1. **RAG (벡터 임베딩)**: 의미론적 검색 — 과잉, 임베딩 API 추가 비용, 복잡도 높음
2. **파일시스템 기반 최적화**: frontmatter 태깅 + `_index.md` + SQLite FTS — 동일 효과, 기존 인프라 활용

## Decision

**파일시스템 기반 3단계 최적화 채택**

### Phase 1 — 즉시 (절감: ~19K 토큰)
- `decisions/_index.md`: 전체 decisions 한줄 요약 테이블 (에이전트가 이것만 스캔)
- `decisions/archive/2026-03/summary.md`: 3월 결정사항 압축 요약
- `session-bootstrap.md` 규칙 변경: `_index.md` 스캔 → 관련 파일만 Read
- `handoff/` 로딩: 본인 role 포함 파일만 필터링

### Phase 2 — 중기 (절감: ~15K 토큰)
- 전체 decisions 파일에 frontmatter 추가 (`roles`, `topic`, `summary`)
- `context/{role}/core.md` (50줄 이하) + `on-demand/` 분리
- `memory/index.md` 30줄로 압축 + `full-index.md` 분리
- `shared/` 파일 역할별 선택 로드 선언

### Phase 3 — 장기 파일시스템 기반 (절감: ~12K 토큰)
- `memory.db`에 SQLite FTS5 테이블 추가 (`decisions_fts`)
- decision 저장 시 FTS 자동 인덱싱 (bridge 연동)
- `shared/memory-query-guide.md`: grep/sqlite 쿼리 패턴 가이드

## Consequences

- 세션당 Read 비용: 56K → ~12K 토큰 (~78% 절감)
- 에이전트가 `_index.md`를 스캔해서 필요한 파일만 읽는 패턴으로 전환
- bridge 재시작 필요 (Phase 3 db.ts 변경 시)
- 기존 파일 구조 유지 — 하위 호환성 보장
