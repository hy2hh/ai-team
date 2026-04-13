# Agent Operations

에이전트 파일(`.claude/agents/`) 편집 시 적용되는 규칙.

## Key Design Decisions
- **Single-responder guarantee**: Triage Agent routes messages; other agents do NOT respond to non-@mention messages (see `shared/collision-prevention.md`)
- **SQLite claim locks**: `memory.db` claims table prevents duplicate processing (`.memory/claims/*.md` approach deprecated)
- **Scope frontmatter**: Each agent declares `scope.handles` / `scope.does_not_handle` in their YAML frontmatter for routing
- **Cross-domain chains**: Multi-agent tasks use sequential handoff chains in `.memory/handoff/chain-{id}.md`

## Running Agents

```bash
# Run a specific agent
claude --agent .claude/agents/pm.md

# Run with Slack MCP (requires .env with SLACK_BOT_TOKEN, SLACK_TEAM_ID)
claude --agent .claude/agents/triage.md
```

## Message Routing

Triage Agent monitors all #ai-team messages and routes via 3-tier system:
1. **@mention** → direct bypass (no Triage involvement)
2. **Keyword match** → routing table in `shared/routing-rules.md`
3. **LLM fallback** → semantic classification; unresolvable → Marge

Agents MUST NOT respond to messages without @mention — wait for Triage delegation.

Full rules: `shared/routing-rules.md`, `shared/collision-prevention.md`

## Collaboration Protocol
- Read `shared/collaboration-rules.md` for full rules
- When delegating: state WHAT, WHY, WHEN, and dependencies
- When receiving: acknowledge → execute → report back
- Escalate to sid when: ambiguous requirements, conflicting priorities, production changes
- Cross-domain handoffs: `shared/collaboration-rules.md` §체인 위임 규칙

## Task Management
- Before starting: move task from backlog to active
- After completing: move from active to done with date
- If blocked: note blocker in `active-{role}.md` and escalate

## Agent Files
- 200-line hard cap per agent file
