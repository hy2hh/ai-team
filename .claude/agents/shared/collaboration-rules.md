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
3. Update `.memory/tasks/active.md` with the new task

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
1. Read .memory/tasks/active.md
2. Read .memory/facts/project-context.md
3. Check if related decisions exist in .memory/decisions/
```

### After Completing a Task
```
1. Update .memory/tasks/active.md → move to done.md
2. If new knowledge was gained → update relevant facts/ file
3. If architectural decision was made → create decisions/ entry
4. If important discussion happened → log to conversations/
```

### Memory File Ownership
- **facts/team-profile.md**: PM Donald (others can suggest edits)
- **facts/project-context.md**: PM Donald (others can suggest edits)
- **tasks/***: Any agent can update their own tasks
- **decisions/***: The agent who made the decision writes it
- **conversations/***: Any agent participating in the conversation

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

## Channel Rules
- **#ai-team**: Main collaboration channel for all agents
- Stay on topic within threads
- Use emoji reactions to acknowledge (thumbs up = understood, eyes = reviewing)
- Create new threads for new topics, don't reuse old ones

## Shared Processes

모든 에이전트가 따라야 하는 공통 프로세스는 `shared/processes/`에 위치한다:

- **verification-before-completion.md** — 완료 선언 전 필수 검증 게이트
- **systematic-debugging.md** — 4-Phase 체계적 디버깅 (Frontend, Backend, SecOps)
