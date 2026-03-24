# AI Team Collaboration Rules

## Communication Protocol
- Use @mentions to delegate tasks to specific agents
- Always provide context when mentioning another agent
- Respond in same thread when replying to tasks
- Acknowledge receipt of tasks within your first message
- Use Korean for all communication

## Task Delegation Pattern

### When Delegating
1. Analyze the request — identify which parts belong to your role
2. For parts outside your role, @mention the relevant agent with:
   - **What**: Clear description of the deliverable
   - **Why**: Context and motivation
   - **When**: Priority level (urgent / normal / low)
   - **Dependencies**: What they need from you or others
3. Update `.memory/tasks/active-{delegatee-role}.md` with the new task

### When Receiving
1. Acknowledge receipt immediately
2. Check `.memory/` for relevant context
3. Execute the task
4. Report completion in the thread
5. Update `.memory/tasks/` accordingly

## Agent Responsibility Matrix

| Request Type | Primary | Support |
|-------------|---------|---------|
| New feature request | PM Donald | - |
| UI/UX design | Designer Donald | Frontend Donald |
| Frontend implementation | Frontend Donald | Designer Donald |
| Backend/API design | Backend Donald | SecOps Donald |
| Market research | Researcher Donald | PM Donald |
| Security review | SecOps Donald | Backend Donald |
| Architecture decision | Backend Donald | All agents |
| Sprint planning | PM Donald | All agents |

## Escalation Rules
- **Ambiguous tasks**: Ask sid for clarification first
- **Blocked by another agent**: @mention them with clear request + deadline
- **Conflicting requirements**: Escalate to PM Donald for prioritization
- **Task exceeds expertise**: Acknowledge limitation and delegate
- **Production changes**: Always require sid's approval

## Memory Protocol

### Before Starting Any Task
```
1. Read .memory/tasks/active-{your-role}.md — your tasks only
2. Read .memory/facts/project-context.md
3. Check if related decisions exist in .memory/decisions/
4. Check .memory/handoff/ for pending handoffs
```

### After Completing a Task
```
1. Update .memory/tasks/active-{your-role}.md → move to done.md
2. If new knowledge was gained → update relevant facts/ file
3. If architectural decision was made → create decisions/ entry
4. If important discussion happened → log to conversations/
5. If handing off to another agent → create handoff/{from}-to-{to}_{topic}.md
```

### Memory File Ownership
- **facts/team-profile.md**: PM Donald (others can suggest edits)
- **facts/project-context.md**: PM Donald (others can suggest edits)
- **tasks/active-{role}.md**: Each agent writes ONLY their own file (동시쓰기 방지)
- **decisions/***: The agent who made the decision writes it
- **conversations/***: Any agent participating in the conversation
- **handoff/***: The handing-off agent creates, the receiving agent acknowledges

## Response Format
- Lead with action/decision, not preamble
- Keep concise and actionable
- Include artifacts (code snippets, specs, links) when relevant
- Tag next responsible agent if handoff is needed
- Use structured format for complex deliverables

## Completion Protocol

모든 에이전트는 작업 완료 선언 전에 `shared/processes/verification-before-completion.md`의 Gate Function을 반드시 통과해야 한다.

- **Iron Law**: 검증 증거 없는 완료 주장은 무효
- **Slack 보고**: 완료 메시지에 반드시 검증 결과 첨부
- **Red Flags**: "should work", "probably", 증거 없는 "Done!" 금지

## Message Routing Protocol

### Triage Agent 기반 라우팅
- **일반 메시지** (@ 멘션 없음): **Triage Agent만 반응** → 분류 후 적절한 에이전트에게 위임
- **@mention 메시지**: 멘션된 에이전트가 직접 반응 (Triage bypass)
- **sid 직접 지정**: 지정된 에이전트가 즉시 반응

### 에이전트 반응 규칙
- **@mention 없는 메시지에 직접 반응 금지** — Triage Agent의 위임을 대기
- Triage로부터 `@에이전트명`으로 위임받았을 때만 작업 시작
- Triage Agent 다운 시 → 수동 @mention으로 기존 방식 fallback

### 참조 프로토콜
- **충돌 방지**: `shared/collision-prevention.md`
- **라우팅 규칙**: `shared/routing-rules.md`
- **크로스 도메인**: `shared/cross-domain-coordination.md`

## Channel Rules
- **#ai-team**: Main collaboration channel for all agents
- Stay on topic within threads
- Use emoji reactions to acknowledge (thumbs up = understood, eyes = reviewing)
- Create new threads for new topics, don't reuse old ones

## Shared Processes

모든 에이전트가 따라야 하는 공통 프로세스는 `shared/processes/`에 위치한다:

- **verification-before-completion.md** — 완료 선언 전 필수 검증 게이트
- **systematic-debugging.md** — 4-Phase 체계적 디버깅 (Frontend, Backend, SecOps)
- **code-review-protocol.md** — 리뷰 요청/응답 프로세스 + 리뷰어 매트릭스

- **planning-process.md** — PM 주도 브레인스토밍 + 구현 계획 수립
- **implementation-pipeline.md** — 3단계 검증 구현 파이프라인 (Frontend, Backend)

`shared/templates/` 의 템플릿을 상황에 맞게 사용한다:
- **code-review-request.md** — Slack 리뷰 요청 포맷
- **code-review-response.md** — Strengths/Issues/Assessment 리뷰 응답 포맷
- **implementation-plan.md** — 구현 계획 문서 구조

## Context Loading

각 에이전트는 상세 자료가 필요할 때 `.claude/context/{role}/`에서 로드한다:
- **tools.md** — 역할별 사용 가능 도구 및 제한
- **conventions.md** — 역할별 작업 컨벤션
- **examples/** — 코드 예시 및 참조 패턴
- **templates/** — 산출물 템플릿

에이전트 파일의 `📂 Extended Context` 섹션에서 경로를 확인할 수 있다.
