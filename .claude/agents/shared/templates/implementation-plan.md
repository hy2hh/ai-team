# Implementation Plan Template

계획서 작성 시 이 구조를 사용한다.

---

```markdown
# [기능명] Implementation Plan

> **담당 에이전트:** 아래 각 Task에 명시
> **작성자:** @PM Donald
> **승인자:** sid
> **작성일:** YYYY-MM-DD

## Goal
[한 문장으로 이 구현이 달성하는 것]

## Architecture
[2-3문장으로 기술 아키텍처 설명]

## Tech Stack
[사용하는 핵심 기술 목록]

---

## Task 1: [Task 제목]
**담당**: @[에이전트명]
**예상 소요**: [2-5분]

### Files
- **Create**: `path/to/new-file.ts` — [목적]
- **Modify**: `path/to/existing.ts` — [변경 내용]
- **Test**: `path/to/test.spec.ts` — [테스트 내용]

### Steps
- [ ] [구체적 단계 1]
- [ ] [구체적 단계 2]
- [ ] [구체적 단계 3]

### Code
\```typescript
// 실제 구현 코드 (설명이 아님)
\```

### Verification
\```bash
# 실행할 명령어
[명령어]
# 예상 출력
[출력]
\```

---

## Task 2: [Task 제목]
**담당**: @[에이전트명]
**예상 소요**: [2-5분]
**의존성**: Task 1 완료 후

[같은 구조 반복]

---

## Dependencies
- Task 1 → Task 2 (순차)
- Task 3, Task 4 (병렬 가능)

## Risks
| 위험 | 가능성 | 영향 | 완화 방안 |
|------|-------|------|----------|
| [위험 1] | [높음/중간/낮음] | [높음/중간/낮음] | [구체적 방안] |

## Success Criteria
- [ ] [성공 기준 1]
- [ ] [성공 기준 2]
```
