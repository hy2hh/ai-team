# AI Team

7개의 AI 에이전트가 Slack 채널에서 협업하는 멀티에이전트 팀 프레임워크.

## 아키텍처

```
sid (human lead)
  ↓ #ai-team 메시지
🚦 Triage Agent ─── 메시지 분류 + 라우팅
  ↓ @mention 위임
🧭 PM  ·  🎨 Designer  ·  🖥️ Frontend  ·  🏗️ Backend  ·  🔭 Researcher  ·  🔒 SecOps
  ↕
.memory/ (파일 기반 공유 상태)
```

- **Triage Agent**가 모든 인바운드 메시지를 모니터링하고 적합한 에이전트에게 라우팅
- 에이전트 간 상태 공유는 `.memory/` 파일 시스템을 통해 이루어짐
- 각 에이전트는 독립된 Claude Code 세션으로 실행됨

## 팀 구성

| Agent | Role | Slack Bot |
|-------|------|-----------|
| Triage Agent | 메시지 분류 및 라우팅 | @Triage Agent |
| PM Donald | Product Manager | @PM Donald |
| Designer Donald | UI Designer | @Designer Donald |
| Frontend Donald | Frontend Developer | @Frontend Donald |
| Backend Donald | Backend Architect | @Backend Donald |
| Researcher Donald | Trend Researcher | @Researcher Donald |
| SecOps Donald | Security Engineer | @SecOps Donald |

## 기술 스택

- **에이전트 런타임**: Claude Code CLI (`--agent` flag)
- **커뮤니케이션**: Slack MCP Server (`@anthropic/mcp-server-slack`)
- **메모리**: 파일 시스템 기반 (`.memory/`)

## 설정

### 1. 환경 변수

```bash
cp .env.example .env
# .env에 각 에이전트의 Slack Bot Token과 Team ID 입력
```

### 2. 에이전트 실행

```bash
# 특정 에이전트 실행
claude --agent .claude/agents/triage.md
claude --agent .claude/agents/pm.md
claude --agent .claude/agents/frontend.md
# ...
```

## 프로젝트 구조

```
.claude/
├── agents/           # 에이전트 페르소나 (7개, 200줄 상한)
│   ├── triage.md     # 메시지 라우팅 에이전트
│   ├── pm.md         # Product Manager
│   ├── designer.md   # UI Designer
│   ├── frontend.md   # Frontend Developer
│   ├── backend.md    # Backend Architect
│   ├── researcher.md # Trend Researcher
│   ├── secops.md     # Security Engineer
│   └── shared/       # 공유 규칙 및 프로세스
│       ├── collaboration-rules.md
│       ├── collision-prevention.md
│       ├── routing-rules.md
│       ├── cross-domain-coordination.md
│       ├── processes/    # 검증, 디버깅, 코드리뷰, 구현 파이프라인
│       └── templates/    # 리뷰 요청/응답, 구현 계획 템플릿
├── context/{role}/   # 역할별 확장 컨텍스트 (예시, 컨벤션, 도구)
└── settings.json     # Slack MCP 서버 설정

.memory/
├── facts/            # 팀 프로필, 프로젝트 상태
├── tasks/            # 역할별 활성 태스크, 백로그, 완료
├── decisions/        # 아키텍처/전략 결정 기록
├── handoff/          # 에이전트 간 인수인계 문서
├── claims/           # 메시지 처리 claim lock
└── conversations/    # 크로스에이전트 논의 로그 (7일 만료)
```

## 핵심 프로토콜

### 메시지 라우팅
1. `@에이전트명` 멘션 → 해당 에이전트 직접 반응
2. 일반 메시지 → Triage가 키워드/의미 분석 후 라우팅
3. 미분류 → PM Donald fallback

### 충돌 방지
- 에이전트는 @mention 없는 메시지에 직접 반응 금지
- Triage 위임 후에만 작업 시작
- `.memory/claims/` 파일 기반 claim lock으로 중복 처리 방지

### 크로스 도메인 협업
- 복합 태스크는 체인 파일(`handoff/chain-{id}.md`)로 순차 핸드오프
- 표준 패턴: Designer→Frontend, Backend→Frontend, Researcher→PM, 구현→SecOps

## 라이선스

Private repository. All rights reserved.
