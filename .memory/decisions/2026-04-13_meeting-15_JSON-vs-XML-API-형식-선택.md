# 회의 결정: JSON vs XML API 형식 선택
> 회의 ID: 15
> 유형: architecture
> 일시: 2026-04-13T00:22:41.131Z
> 참여자: frontend, backend

## 의견 요약
### frontend


*1. 핵심 의견*

JSON을 강력히 권고합니다. 프론트엔드 관점에서 JSON은 네이티브 JavaScript 객체로 즉시 사용 가능하며, 번들 사이즈·파싱 성능·DX 모두 압도적으로 유리합니다.

*2. 근거*

• `JSON.parse()`는 브라우저 네이티브 구현으로 XML DOM 파싱 대비 *10~100배 빠름* (V8 벤치마크 기준)
• XML 파싱 시 `DOMParser` + XPath/querySelector 변환 레이어가 추가로 필요 → 보일러플레이트 증가
• TypeScript 타입 추론이 JSON 구조에 1:1 매핑됨. XML은 속성(attribute) vs 엘리먼트(element) 구분 때문에 타입 정의가 복잡해짐
• React Query, SWR, fetch API 등 프론트엔드 생태계 전체가 JSON 기본 전제로 설계됨
• 페이로드 크기: 동일 데이터 기준 XML은 태그 오버헤드로 JSON 대비 *30~50% 더 큼* → 모바일/3G 환경에서 로드 타임 직
### backend
회의 #15 스레드에 Backend Architect 관점의 의견을 제출했습니다.

*요약:* JSON 단일 표준 채택을 권고했습니다. 페이로드 크기 30-40% 절감, V8 네이티브 파싱 성능, PostgreSQL `jsonb`·Express.js·OpenAPI 생태계 호환성, TypeScript 직접 매핑 등 백엔드 인프라 전반에서 JSON이 압도적 우위입니다. XML은 레거시 연동 필요 시 게이트웨이 어댑터로 분리 처리하는 방안을 제안했습니다.

## 최종 결정
회의 #15 종합 완료했습니다.

*처리 내역:*
• Frontend·Backend 만장일치 → *JSON 단일 표준 채택* 결정
• 결정 파일 생성: `.memory/decisions/2026-04-13_meeting-15_JSON-vs-XML-API-형식-선택.md`
• `_index.md` 테이블 행 추가 완료
• Slack 스레드에 종합 결과 회신 완료