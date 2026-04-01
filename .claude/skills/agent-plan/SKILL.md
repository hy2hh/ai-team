---
name: agent-plan
description: Use when starting feature planning, design brainstorming, or creating implementation plans
---

# Planning Process

> **Iron Law**: 설계 없이 구현하지 않는다. 모든 프로젝트는 이 프로세스를 거친다.

## HARD GATE
구현 행위(코드 작성, 파일 생성, 환경 설정)는 설계 승인 전에 **절대 시작하지 않는다**.

## Part 1: Brainstorming (PM 주도)

### 9단계

1. **프로젝트 맥락 탐색** — `.memory/facts/project-context.md`, 기존 코드, `.memory/decisions/`
2. **관련 에이전트 소집** — Slack #ai-team에서 주제와 참여 에이전트 명시
3. **명확화 질문** — 한 번에 하나, 가능하면 다지선다형
4. **관점별 입력 수집**:
   - @Krusty: 비주얼/UX, 사용자 흐름
   - @Lisa: 시장 데이터, 경쟁사, 트렌드
   - @Bart: 프론트엔드 기술 제약, 구현 복잡도
   - @Homer: 시스템 아키텍처, 데이터 모델, API 설계
   - @Wiggum: 보안 요구사항, 위협 모델
5. **접근 방식 제안** — 2-3가지 + 장단점(trade-off) → sid 최종 방향 승인
6. **설계 문서 초안** — `.memory/decisions/YYYY-MM-DD_{topic}.md`에 기록
7. **기술 검증 루프** — Homer/Bart 기술적 검증 + Wiggum 보안 검증 (최대 3회)
8. **sid 최종 리뷰** — 승인 후에만 구현 진행
9. **구현 계획으로 전환** — Part 2로 이동

## Part 2: Writing Plans (PM 주도)

### 원칙
구현자는 유능하지만 맥락을 모른다. 모든 것을 문서화: 파일 경로, 실제 코드, 테스트 방법, 참조 문서.

### Bite-Sized Task (2-5분 단위)
```
❌ "사용자 인증 시스템 구현"
✅ Task 1: 실패 테스트 작성 → Task 2: 테스트 실행 → Task 3: 최소 구현 → Task 4: 통과 확인 → Task 5: 커밋
```

### Task 필수 포함 사항
- **담당 에이전트** / **Files** (생성/수정/테스트 경로) / **Steps** (체크박스) / **Code** (실제 코드) / **Verification** (명령어 + 예상 출력)

### 금지 패턴 (하나라도 → 미완성)
- ❌ "TBD", "TODO", "implement later", "추후 결정"
- ❌ "적절한 에러 처리 추가" (실제 코드 없이)
- ❌ "Task N과 유사하게 구현" (순서 무관 독립 가독성 필요)
- ❌ 무엇만 설명하고 어떻게를 안 보여주는 단계

### Self-Review (배포 전 필수)
1. **Spec Coverage**: 스펙 요구사항/AC → Task 매핑. 빠진 것 나열
2. **Placeholder Scan**: 금지 패턴 검색 → 실제 코드로 교체
3. **Type Consistency**: Task 간 함수명/시그니처/타입명 일치

### 템플릿
- 계획서: `references/implementation-plan-template.md`
- 위임: `references/delegation-template.md`

## YAGNI
- "나중에 필요할 수 있으니까" → 지금은 미구현
- "더 확장 가능하게" → 현재 요구사항만 충족하는 최소한
- "제대로 하자" → 가장 단순한 방법

## Red Flags
- ❌ 설계 승인 없이 코드 작성 / "간단하니까 바로 구현"
- ❌ 한 명의 관점만으로 설계 완료 / 기술 검증 없이 확정
- ❌ YAGNI 위반 / Task가 5분 초과
