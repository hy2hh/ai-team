# Feature Specs

기능 설계 의도를 파일로 남기는 디렉토리.

## 목적
- Slack 구두 설계 → 파일 기반 기록으로 전환
- 에이전트 세션 간 설계 맥락 유지
- **코드가 진실, 스펙은 의도 기록** (코드와 스펙이 다르면 코드가 맞음)

## 파일 규칙
- 파일명: `YYYY-MM-DD_{feature-name}.md`
- 템플릿: `.claude/context/pm/templates/feature-spec.md`
- 작성자: PM(Marge) — 설계 확정 후 구현 위임 전에 작성
- 상태: `draft` → `approved` → `implemented` → `archived`

## 언제 쓰는가
- 2개 이상 에이전트가 관여하는 기능
- 1회성이 아닌 반복 참조가 필요한 설계
- 아키텍처 결정이 포함된 기능

## 언제 안 쓰는가
- 단순 버그 수정
- 1개 에이전트가 독립 완료 가능한 작업
- 이미 PRD로 문서화된 대규모 이니셔티브
