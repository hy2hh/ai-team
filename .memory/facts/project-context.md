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
(none yet — 프로젝트 시작 시 `facts/services.md`에 서비스 등록)
