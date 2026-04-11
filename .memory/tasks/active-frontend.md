# Active Tasks — Frontend Bart

<!-- Format: - [ ] task description | created | priority -->

- [ ] E2E 메모리 기록 테스트 | 2026-04-10 | LOW

## pockie-wallet AI Agent (2026-04-11 이관)

- [ ] Chrome Extension E2E 테스트 하네스 설계 및 구축 | 2026-04-11 | HIGH
  - Playwright + chrome extension 지원 방식
  - 빌드 후 chrome://extensions 로드 → 팝업 실제 조작까지 자동화 목표
- [ ] pockie-wallet AI agent 실제 런타임 검증 후 재완료 선언 | 2026-04-11 | HIGH
  - 타입 체크 통과만으로는 완료 불인정
  - F1(자연어 tx), F2(리스크 시뮬레이션), F3(가스 최적화) 각 기능 실 동작 확인 필요

## UI 컴포넌트 (2026-04-11 이관)

- [ ] button.stories.tsx 공식 Storybook 스토리 파일 추가 | 2026-04-11 | LOW
  - 현재 test-button.stories.tsx만 존재, 정식 파일 없음
