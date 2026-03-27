# Project Context

## Current Focus
- AI agent team setup and testing
- Slack-based multi-agent collaboration

## Tech Stack
- Claude Code CLI with `--agent` flag
- Slack MCP server (`@anthropic/mcp-server-slack`)
- File system-based memory (this directory)

## Constraints
- Agents run as separate Claude Code sessions (independent processes)
- No shared real-time state between agents (communicate via Slack messages)
- Memory is shared via this file system directory
- Human approval required for production deployments

## Active Projects
<!-- 프로젝트 추가 시: 이름 + services.md 참조 -->

### ai-team (내부 인프라)
- *목표:* Slack 기반 멀티 에이전트 협업 시스템 구축 및 운영
- *상태:* Phase 2.2 — LRU 캐시, 재시도 로직, perf 타임스탬프 적용 완료
- *라우팅:* 5단계 (mention → conversational → keyword → LLM → default)
- *에이전트:* pm, designer, frontend, backend, researcher, secops
- *채널:* #ai-team
- *메모리:* `.memory/` 파일시스템 공유
