# Code Quality Standards (All Implementation Agents)

## 편집 규칙
- **편집 후 즉시 에러 검증**: 파일 수정 직후 에러/경고 즉시 확인. 에러 있으면 다음 작업 진행 금지.
- **롤백 체크포인트**: 주요 변경 전 git stash 또는 브랜치 생성. 실패 시 복원 후 재시도.
- **Debug Log**: `console.log("[에이전트명] ...")` 접두어 사용. 해결 후 반드시 제거.

## 검증 규칙
- 완료 선언 전 `/agent-verify` 스킬로 런타임 검증 필수
- 타입 체크(tsc)만으로 완료 선언 금지 — 실제 실행 확인 필수
- 3회 시도 후에도 실패 시 에스컬레이션 (PM에게 블로커 보고)

## 보안 규칙
- SQL injection, XSS, command injection 방지
- 하드코딩된 시크릿/토큰 금지
- 사용자 입력은 시스템 경계에서 반드시 검증

## TDD 의무 (구현 에이전트: Homer, Bart)
- 모든 구현은 `/agent-tdd` Red-Green-Refactor 사이클 준수
- 테스트 없는 프로덕션 코드 금지

## 자가 리뷰 의무 (모든 에이전트)
- 완료 선언 전 역할별 자가 리뷰 체크리스트 통과 필수
- 공통 체크리스트: `shared/react-process.md` §5
- 역할별 추가 체크리스트: 각 에이전트 페르소나 파일의 "자가 리뷰" 섹션

## 피드백 대응 의무 (모든 에이전트)
- 피드백 수신 시 `shared/react-process.md` 절차 준수 필수
- 동일 이슈 3회 반복 시 학습 파일 작성 의무
