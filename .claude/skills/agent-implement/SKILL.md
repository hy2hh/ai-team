---
name: agent-implement
description: Use when executing assigned implementation tasks with self-review and staged verification
---

# Implementation Pipeline

> **Iron Law**: 계획 → 구현 → 자가 리뷰 → Spec 리뷰 → Code Quality 리뷰. 순서를 건너뛰지 않는다.

## Task 할당 패턴

### Marge의 할당 메시지 포맷
```
@[에이전트명] Task [번호] 할당합니다.
[Task 전체 내용 — 계획서에서 복사]
의존성: [선행 Task 완료 여부]
맥락: [추가 정보]
```
**중요**: "계획서 참조"로 대체 금지. 전체 내용 포함.

## 3단계 검증 파이프라인

### Stage 1: 자가 리뷰 (구현 에이전트)
- [ ] 계획서의 Steps를 모두 완료했는가?
- [ ] 테스트가 통과하는가?
- [ ] 빌드가 성공하는가?
- [ ] 기존 기능이 깨지지 않았는가? (회귀 테스트)
- [ ] 코드가 의도한 대로 동작하는가? (수동 확인)

### Stage 2: Spec Compliance Review (PM 위임)
**구현 에이전트는 직접 리뷰를 요청하지 않는다.** Stage 1 완료 보고 시 PM(Marge)에게 결과를 전달하면, PM이 적절한 리뷰어를 위임한다.
- 계획서의 Verification 항목이 모두 통과하는가?
- 누락된 요구사항이 없는가?
- 엣지 케이스가 처리되었는가?

### Stage 3: Code Quality Review (PM 위임)
PM이 Stage 2 통과 확인 후 Code Quality 리뷰어를 위임한다.
- 코드 구조와 가독성
- 에러 처리와 엣지 케이스
- 보안 (입력 검증, 인증/인가)
- 성능 (불필요한 연산, 메모리 사용)

**순서 중요**: Spec 리뷰 미통과 시 Code Quality 리뷰 시작 금지.

## 상태 보고

| 상태 | 의미 | 다음 행동 |
|------|------|----------|
| **DONE** | 요구사항 충족, 자가 리뷰 통과 | Stage 2 진행 |
| **DONE_WITH_CONCERNS** | 완료했지만 우려 사항 | 우려 명시 → Marge 판단 |
| **BLOCKED** | 진행 불가 | 차단 원인 명시 → Marge 해결 |
| **NEEDS_CONTEXT** | 추가 정보 필요 | 필요 정보 명시 → 제공 대기 |

### BLOCKED 처리
| 차단 원인 | 해결 |
|-----------|------|
| 맥락 부족 | Marge 추가 정보 제공 |
| 기술적 한계 | 아키텍처 논의 → sid 에스컬레이션 |
| Task 너무 큼 | Marge가 분해 |
| 계획 오류 | Marge가 수정 → 재검증 |

## 병렬 구현
독립 Task는 다른 에이전트에게 동시 할당 가능. 동일 에이전트 동시 할당 금지.

## 전체 완료 후
1. **통합 테스트** — 전체 시스템 동작 확인
2. **최종 코드 리뷰** — `/agent-review` 적용
3. **완료 보고** — Marge → sid (검증 증거 첨부)

## Red Flags
- ❌ 계획 없이 구현 / Spec 전 Code Quality 리뷰
- ❌ 자가 리뷰 건너뛰기 / "계획서 참조"로 Task 내용 대체
- ❌ 동일 에이전트 동시 다중 Task / BLOCKED 무시
- ❌ "대충 맞으니까"로 Spec 리뷰 통과 처리
