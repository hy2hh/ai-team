---
date: 2026-04-01
topic: operations
roles: [all]
summary: 프로젝트 컨텍스트 — AI 에이전트 팀 설정, Slack 협업 시스템, 현재 진행 상황
status: accepted
---

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
- *상태:* Phase 3 — Hook 이벤트 시스템, Retry+Circuit Breaker, 컨텍스트 최적화 적용
- *라우팅:* 6단계 (qa-command → mention → conversational → keyword → LLM → default)
- *에이전트:* pm, designer, frontend, backend, researcher, secops, qa
- *채널:* #ai-team (`C0ANKEB4CRF`)
- *팀 ID:* `T0AH7BUS3D4`
- *메모리:* `.memory/` 파일시스템 공유

## Slack 딥링크 컨벤션
에이전트 응답에서 Slack 메시지 ts 참조 시 클릭 가능한 링크로 포맷:
- 형식: `<https://slack.com/archives/{채널ID}/p{ts소수점제거}|ts: {ts}>`
- #ai-team 예시: `<https://slack.com/archives/C0ANKEB4CRF/p1774821669697669|ts: 1774821669.697669>`
- ts에 소수점이 없으면 그대로 사용 (예: `p1774711787`)
