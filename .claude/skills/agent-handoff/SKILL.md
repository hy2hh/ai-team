---
name: agent-handoff
description: Use when coordinating multi-agent sequential or parallel task chains
---

# Cross-Domain Coordination Protocol

## 순차 핸드오프 체인

복합 태스크는 `.memory/handoff/chain-{id}.md` 파일로 전체 순서를 추적한다.

### Chain 파일 형식
```markdown
---
chain_id: chain-YYYYMMDD-NNN
created_by: [에이전트]
created_at: YYYY-MM-DDTHH:MM:SS+09:00
status: in_progress
current_step: N
---

## 원본 요청
"[요청 내용]"

## 체인 순서
| Step | Agent | Status | Started | Completed |
|------|-------|--------|---------|-----------|
| 1 | [에이전트] | completed | HH:MM | HH:MM |
| 2 | [에이전트] | in_progress | HH:MM | - |

## 핸드오프 기록
- Step 1→2: [전달 내용] (handoff/from-to-to_topic.md)
```

### 체인 진행 규칙
1. 완료 시 chain 파일의 자기 step → `completed`
2. Slack에서 `@다음에이전트` 멘션 + handoff 파일 경로
3. 다음 에이전트: `current_step` 업데이트 + 작업 시작

## 병렬 분할

독립 작업은 동시 진행 가능. 같은 step 번호에 a/b 접미사:
```
Step 1a: Homer — API 설계     ┐
Step 1b: Krusty — UI 디자인    ┘ (병렬)
Step 2:  Bart — 구현         (1a + 1b 완료 후)
```
**통합 에이전트는 반드시 Marge**. 병렬 결과 확인 후 다음 step 트리거.

## 표준 체인 패턴

| 패턴 | 체인 |
|------|------|
| UI 기능 구현 | Designer → Frontend |
| API + UI | Backend → Frontend |
| 시장 → 기획 | Researcher → PM |
| 구현 → 보안 | Frontend/Backend → SecOps |
| 풀 사이클 | PM → Designer → Frontend + Backend → SecOps |

## 블로커 처리

| 상황 | 대응 |
|------|------|
| 24시간 진행 없음 | Marge 자동 에스컬레이션 |
| 에이전트 무응답 | chain에 `blocked` 표시 + PM 알림 |
| 의존성 충돌 | Marge 우선순위 재조정 |
| 품질 이슈 | 이전 step 에이전트 피드백 + 재작업 |

chain 파일에 블로커 기록:
```markdown
## 블로커
- [날짜 시각] Step N blocked: [에이전트] — [원인] ([조치])
```

## 핸드오프 파일 규칙
- 파일명: `{from}-to-{to}_{topic}.md`
- 내용: 전달 사항, 맥락, 기대 결과
- chain 파일에서 handoff 파일 참조
- 수신 에이전트: Slack에 acknowledgment 게시
