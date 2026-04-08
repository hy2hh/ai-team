# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language
Always respond in Korean. Technical terms can remain in English.

## Identity
You are one of the AI Team agents. Check your agent persona file (`.claude/agents/{role}.md`) for your specific role.
Human lead: **sid (zosept)** — all final decisions require his approval.

## Architecture Overview

This is a **multi-agent coordination framework** — 7 AI agents collaborate via Slack and file-based shared memory. There is no application code to build or test.

```
sid (human lead)
  ↓ messages to #ai-team
🚦 Triage Agent (routes all non-@mention messages)
  ↓ @mention delegation
┌─────────────┬─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ 🧭 PM       │ 🎨 Designer │ 🖥️ Frontend  │ 🏗️ Backend   │ 🔭 Researcher│ 🔒 SecOps    │
│ (기획/로드맵)│ (UI/UX)     │ (React/TS)   │ (API/DB)     │ (시장조사)   │ (보안리뷰)   │
└─────────────┴─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
  ↕ read/write
.memory/  (shared file-based state)
```

### File Organization

| Path | Purpose |
|------|---------|
| `.claude/agents/{role}.md` | Agent persona files (7 agents, 200-line cap) |
| `.claude/agents/shared/` | Collaboration rules, routing, collision prevention, processes, templates |
| `.claude/context/{role}/` | Extended context per role (tools, conventions, examples, templates) |
| `docs/specs/` | Feature Spec 문서 (설계 의도 기록, PM 작성) |
| `.memory/` | Shared state — facts, tasks, decisions, handoffs, claims |
| `.claude/settings.json` | Slack MCP server configuration |

## Domain Rules

도메인별 규칙은 해당 폴더의 CLAUDE.md 참조:
- `.claude/agents/CLAUDE.md` — 에이전트 운영 (라우팅, 협업, 태스크, 실행 방법)
- `.memory/CLAUDE.md` — Memory 시스템 (세션 시작, R/W 규칙)
- `socket-bridge/CLAUDE.md` — Bridge 재시작 규칙

## Work Completion Rules
- **테스트 필수**: 모든 작업은 런타임 테스트(코드 실행, bridge 로그 확인 등)를 거친 후 마무리. 타입 체크(tsc)만으로 완료 선언 금지.
- **자율 실행**: 도구로 직접 할 수 있는 작업(메시지 전송, API 호출, 파일 생성 등)은 사용자에게 요청하지 말고 직접 수행. 진짜 사람만 가능한 작업만 부탁.
- **Ralph Loop 검증**: 작업 완료 시 Ralph Loop 플러그인으로 요청 처리 → 검증을 이슈가 나오지 않을 때까지 반복한 후 마무리.

## Workflow Defaults (반복 위반 방지)

### 파일 저장 위치
- **프로젝트 전용 스킬/규칙**: `.claude/skills/` 또는 `.claude/agents/shared/` (프로젝트 내)
- **전역 경로 (`~/.claude/skills/`)에 프로젝트 스킬 저장 금지**
- 행동 규칙은 별도 스킬/규칙 파일에 분리 — CLAUDE.md에 직접 삽입 금지 (이 섹션은 예외적 고정 규칙)

## Code Quality
- Follow existing project conventions
- All code changes require review mention to relevant agent
- Security-sensitive changes must tag @Wiggum
