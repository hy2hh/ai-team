---
name: agent-review
description: Use when requesting, performing, or responding to code review
---

# Code Review Protocol

> **Iron Law**: 리뷰 없는 코드는 프로덕션에 들어가지 않는다. 성과주의 합의 금지.

## Part 1: 리뷰 요청

### 필수 상황
- 주요 기능 구현 완료 후, main 병합 전, 보안 영향 변경

### 요청 시 필수 정보
`references/review-request.md` 템플릿 사용:
1. **What**: 무엇을 변경했는가
2. **Why**: 왜 필요한가
3. **Context**: 리뷰어가 알아야 할 배경
4. **Files Changed**: 변경 파일 + 이유
5. **Review Focus**: 특히 봐달라는 부분

### 리뷰어 매트릭스
`references/review-matrix.md` 참조

## Part 2: 리뷰 응답 — 6단계

1. **READ** — 전체 피드백을 반응 없이 먼저 읽기
2. **UNDERSTAND** — 각 항목의 기술적 요구사항 재진술. 불명확하면 구현 전 질문
3. **VERIFY** — 코드베이스에서 실제로 확인. "맞을 것이다" 금지
4. **EVALUATE** — 기술적 타당성 평가 + YAGNI 체크
5. **RESPOND** — 기술적 응답만
   - ✅ "수정함. [설명]" / "확인 결과 [X]이므로 [Y]로 변경"
   - ✅ 반박: "현재 구현 이유: [근거]. [대안]이 더 나은 이유를 설명해주시겠습니까?"
   - ❌ "You're absolutely right!", "Great point!", "Thanks for catching that!"
6. **IMPLEMENT** — 한 번에 하나씩 수정 + 테스트

### 반박이 적절한 경우
기존 기능 깨짐, 리뷰어 맥락 부재, YAGNI 위반, 기술적 오류, 아키텍처 결정 충돌

### YAGNI 체크
"나중에 필요하니까 미리 구현하자" 제안 → 코드베이스에서 사용처 검색 → 없으면 미구현

## Severity 분류

| Severity | 의미 | 행동 |
|----------|------|------|
| **Critical** | 보안 취약점, 데이터 손실, 기능 장애 | 즉시 수정. 병합 차단 |
| **Important** | 성능, 아키텍처 위반, 테스트 누락 | 다음 진행 전 수정 |
| **Minor** | 네이밍, 스타일, 문서화 | 기록 후 현재/다음 작업에서 수정 |

## 리뷰 순서
1. **Spec Compliance** → 2. **Code Quality** (Spec 미통과 시 Code Quality 시작 금지)

## 리뷰 응답 템플릿
`references/review-response.md` 참조 — Strengths / Issues (Critical/Important/Minor) / Assessment (APPROVE/APPROVE_WITH_CHANGES/REQUEST_CHANGES/BLOCK)

## Red Flags
- ❌ 리뷰 없이 병합 / 모든 피드백 무조건 동의 / 피드백 무시
- ❌ 성과주의 응답 / 컨텍스트 없이 "봐주세요" / Spec 전 Code Quality 리뷰
