> ⚠️ 이 파일은 `/agent-handoff` 스킬로 이전되었습니다. `.claude/skills/agent-handoff/SKILL.md` 참조.

# Cross-Domain Coordination Protocol

## 순차 핸드오프 체인

복합 태스크는 `.memory/handoff/chain-{id}.md` 파일로 전체 순서를 추적한다.

### Chain 파일 형식

```markdown
---
chain_id: chain-20260324-001
created_by: Triage Agent
created_at: 2026-03-24T10:00:00+09:00
status: in_progress
current_step: 2
---

## 원본 요청
"로그인 페이지 디자인하고 구현해줘"

## 체인 순서

| Step | Agent | Status | Started | Completed |
|------|-------|--------|---------|-----------|
| 1 | Krusty | completed | 10:00 | 10:45 |
| 2 | Bart | in_progress | 10:46 | - |
| 3 | Wiggum | pending | - | - |

## 핸드오프 기록
- Step 1→2: 디자인 스펙 전달 (handoff/designer-to-frontend_login-page.md)
```

### 체인 진행 규칙

1. **에이전트 완료 시**: chain 파일의 자기 step을 `completed`로 업데이트
2. **다음 에이전트 알림**: Slack에서 `@다음에이전트` 멘션 + handoff 파일 경로 공유
3. **다음 에이전트 시작**: chain 파일의 `current_step` 업데이트 + 작업 시작

## 병렬 분할

독립적인 작업은 동시에 진행할 수 있다.

```
예: "API 설계 + UI 디자인 후 프론트엔드 구현"

Step 1a: Homer — API 설계     ┐
Step 1b: Krusty — UI 디자인    ┘ (병렬)
Step 2:  Bart — 구현         (1a + 1b 모두 완료 후)
```

병렬 step은 같은 step 번호에 a/b 접미사를 사용한다.
**통합 에이전트** (보통 Marge)가 병렬 결과를 확인하고 다음 step 트리거.

## 표준 체인 패턴

| 패턴 | 체인 | 설명 |
|------|------|------|
| UI 기능 구현 | Designer → Frontend | 디자인 완료 후 구현 |
| API + UI | Backend → Frontend | API 계약 확정 후 프론트 연동 |
| 시장 → 기획 | Researcher → PM | 조사 결과로 PRD 작성 |
| 구현 → 보안 | Frontend/Backend → SecOps | 코드 완료 후 보안 리뷰 |
| 풀 사이클 | PM → Designer → Frontend + Backend → SecOps | 전체 기능 개발 |

## 블로커 처리

### 에스컬레이션 규칙

| 상황 | 대응 |
|------|------|
| 24시간 진행 없음 | Marge에게 자동 에스컬레이션 |
| 에이전트 무응답 | Triage가 chain 파일에 `blocked` 표시 + PM 알림 |
| 의존성 충돌 | Marge가 우선순위 재조정 |
| 품질 이슈 (QA FAIL) | `shared/react-process.md` §4-6 적용: 피드백 → 재작업 → 재검증. 도메인별 에스컬레이션 경로는 §7 참조 |

### 블로커 기록

chain 파일에 블로커를 기록한다:

```markdown
## 블로커
- [2026-03-24 14:00] Step 2 blocked: Frontend — API 스펙 불완전 (Backend에게 확인 요청)
```

## 핸드오프 파일 규칙

기존 `.memory/handoff/` 구조를 활용한다:
- 파일명: `{from}-to-{to}_{topic}.md`
- 내용: 전달 사항, 맥락, 기대 결과
- chain 파일에서 handoff 파일을 참조
- 핸드오프 수신 에이전트는 acknowledgment를 Slack에 게시
