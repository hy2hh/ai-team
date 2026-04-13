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

## Tech Stack

도구/프레임워크를 추측하지 말고, 반드시 아래 목록과 프로젝트 config를 확인 후 진행.

| 영역 | 도구 | 비고 |
|------|------|------|
| Runtime | Node.js + TypeScript | socket-bridge, kanban 등 |
| Process Manager | tmux | ai-team-bridge 세션 |
| Agent Communication | Slack MCP (socket mode) | `.claude/settings.json`에 서버 정의 |
| Shared State | 파일 기반 (.memory/) | DB 없음 |
| E2E Testing | Playwright CLI | MCP 아님 (`npx playwright test`로 실행) |
| Bridge SDK | claude-agent-sdk | 표준 anthropic SDK 아님 |
| Package Manager | pnpm | npm/yarn 아님 |
| Data Sources | Gate.io API | 심볼 수 항상 전체 확인 후 사용 |

**규칙**: 프로젝트에서 사용하는 도구가 불확실하면 package.json, config 파일, 기존 코드를 먼저 확인. 추측 기반 접근 금지.

## Domain Rules

도메인별 규칙은 해당 폴더의 CLAUDE.md 참조:
- `.claude/agents/CLAUDE.md` — 에이전트 운영 (라우팅, 협업, 태스크, 실행 방법)
- `.memory/CLAUDE.md` — Memory 시스템 (세션 시작, R/W 규칙)
- `socket-bridge/CLAUDE.md` — Bridge 재시작 규칙

## Known Restrictions

- **`.claude/settings.json` 및 `.claude/hooks/` 직접 수정 금지**: guard-check.sh가 차단함. 변경 필요 시 정확한 수정 내용을 출력하고 sid에게 직접 수정 요청.

## Operations Rules

- **즉시 종료 원칙**: 인프라 작업(restart, deploy, kill, status check, config update) 완료 후 → 결과만 보고하고 즉시 종료. 추가 코드 탐색·개선 제안·관련 파일 분석 일절 금지.
- **요청 범위만 수행**: "상태 확인해줘" → 상태만 보고. "재시작해줘" → 재시작+확인만. 부가 작업 금지.
- **해결 불가 시**: 시도한 내용 + 실패 원인만 보고하고 종료. 대안 탐색은 사용자 지시 후에만.
- **탐색 금지 트리거**: 작업 완료 후 "혹시 다른 문제가...", "관련해서 확인하면...", "추가로..." 같은 자발적 탐색 충동 → 억제.

## Work Completion Rules
- **테스트 필수**: 모든 작업은 런타임 테스트(코드 실행, bridge 로그 확인 등)를 거친 후 마무리. 타입 체크(tsc)만으로 완료 선언 금지.
- **자율 실행**: 도구로 직접 할 수 있는 작업(메시지 전송, API 호출, 파일 생성 등)은 사용자에게 요청하지 말고 직접 수행. 진짜 사람만 가능한 작업만 부탁.
- **Ralph Loop 검증**: 작업 완료 시 Ralph Loop 플러그인으로 요청 처리 → 검증을 이슈가 나오지 않을 때까지 반복한 후 마무리.

## Workflow Defaults (반복 위반 방지)

### 파일 저장 위치
- **프로젝트 전용 스킬/규칙**: `.claude/skills/` 또는 `.claude/agents/shared/` (프로젝트 내)
- **전역 경로 (`~/.claude/skills/`)에 프로젝트 스킬 저장 금지**
- 행동 규칙은 별도 스킬/규칙 파일에 분리 — CLAUDE.md에 직접 삽입 금지 (이 섹션은 예외적 고정 규칙)

### 지식 저장 위치
- **세션 학습/발견** → `.agent/sprint/current.md` Learned 섹션
- **구조적 장기 지식** (시스템 동작 원리, 반복 패턴) → `.agent/knowledge/index.md`
- **`~/.claude/projects/.../memory/` 사용 금지** — sprint/knowledge와 중복. 글로벌 auto-memory 지침보다 이 규칙이 우선

### Learned 섹션 작성 규칙
**다음 중 하나라도 해당하면 즉시** `.agent/sprint/current.md` 의 현재 세션 `Learned:` 섹션에 기록:
- 예상과 다른 동작을 발견했을 때 (예: "exit 2가 도구 자체를 차단함, JSON 출력은 경고만")
- 문서에 없는 시스템 동작을 확인했을 때
- 오해를 교정했을 때 (예: "HTML 주석은 토큰을 줄이지 않음")
- 다음 세션에서 같은 실수를 반복할 수 있는 패턴

**형식:** `- [발견한 사실] — [왜 비자명한지 한 줄]`  
**타이밍:** 발견 즉시 기록 (세션 종료 시가 아님). placeholder("직접 기록된 내용 없음")로 남기면 안 됨.

## Code Quality
- Follow existing project conventions
- All code changes require review mention to relevant agent
- Security-sensitive changes must tag @Wiggum
