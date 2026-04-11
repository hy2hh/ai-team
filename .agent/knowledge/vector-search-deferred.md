---
name: vector-search-deferred
description: .memory/ 시맨틱 벡터 검색 도입 검토 — 문서 수 1000+ 도달 시 재평가
type: project
deferred-until: .memory/ 파일 수 1000개 초과 시
---

# .memory/ 벡터 검색 도입 (보류)

## 배경

GBrain(github.com/garrytan/gbrain) 분석 후 우리 팀 적용 가능성 검토.
2026-04-12 기준 .memory/ 파일 수 수십 개 수준 — 현재 도입 ROI 낮음.

## 도입 시 얻는 것

- 에이전트 세션 시작 시 "관련 파일 있으면 읽어" 추측 대신 시맨틱 쿼리로 정확히 탐색
- research/index.md 선형 스캔 없이 "오늘 작업 관련 리서치" 자동 서페이싱
- 에이전트 간 연결되지 않은 지식 발굴 가능

## 구현 방법 (검토 시 참고)

1. `memory.db`에 이미 SQLite 있음 → sqlite-vec 확장 추가
2. 임베딩 모델: text-embedding-3-small (OpenAI) 또는 claude embed API
3. 파일 변경 시 재임베딩 트리거: git hook 또는 bridge cron
4. 에이전트 쿼리 인터페이스: `gbrain query` 패턴 참조

## 도입 판단 기준

| 조건 | 임계값 |
|------|--------|
| .memory/ 파일 수 | 1000개 초과 |
| 에이전트가 "관련 파일 못 찾음" 보고 빈도 | 주 3회 이상 |
| 세션 시작 시 파일 읽기 토큰 비용 | 급증 시 |

## 참고

- GBrain repo: github.com/garrytan/gbrain
- 현재 대안: session-bootstrap.md의 구조화된 체크리스트 + research/index.md 인덱싱
