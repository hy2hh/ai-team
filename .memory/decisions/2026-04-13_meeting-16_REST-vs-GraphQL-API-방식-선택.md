# 회의 결정: REST vs GraphQL — API 방식 선택
> 회의 ID: 16
> 유형: architecture
> 일시: 2026-04-13T00:27:28.379Z
> 참여자: frontend, backend

## 의견 요약
### frontend


*1. 핵심 의견*

REST를 기본 API 방식으로 채택하되, 특정 데이터 집약적 화면에 한해 BFF(Backend For Frontend) 패턴으로 보완하는 것을 추천합니다. 현재 프로젝트 규모와 팀 구성(AI 에이전트 기반 협업)에서 GraphQL은 오버엔지니어링이며, REST가 DX·캐싱·디버깅 모든 면에서 우위입니다.

*2. 근거*

• *캐싱 효율성*: REST는 URL 기반 HTTP 캐싱(`Cache-Control`, `ETag`, CDN)이 네이티브로 동작. GraphQL은 POST 단일 엔드포인트라 HTTP 캐싱 불가 → 별도 `Apollo Client` 등 클라이언트 캐시 레이어 필요
• *번들 사이즈*: GraphQL 클라이언트 라이브러리 추가 비용 — `@apollo/client` ~50KB gzip, `urql` ~12KB gzip. REST는 `fetch` 네이티브 또는 SWR(~4KB gzip)만으로 충분
• *에러 핸들링*: REST는 HTTP 상태
### backend
회의 #16 스레드에 백엔드 아키텍트 관점의 의견을 제출했습니다. REST 권장 입장이며, 핵심 근거는 리소스 중심 CRUD 패턴 적합성, HTTP 네이티브 캐싱, 엔드포인트별 모니터링 용이성, 에이전트 호환성입니다.

## 최종 결정
회의 #16 종합 완료.

*처리 내역:*
• Frontend·Backend 만장일치 → *REST 단일 API 방식 채택* 결정
• 결정 파일 생성: `.memory/decisions/2026-04-13_meeting-16_REST-vs-GraphQL-API-방식-선택.md`
• `_index.md` 테이블 행 추가 완료
• Slack 스레드에 종합 결과 회신 완료

*핵심 결정:* REST + OpenAPI 3.1 + JSON envelope(`{ data, error, meta }`) 표준. Over-fetching은 BFF + sparse fieldset으로 완화. GraphQL 재검토는 외부 소비자 3개+ 또는 nested 쿼리 30%+ 시 트리거.