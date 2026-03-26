# AI Team

7개의 AI 에이전트가 Slack 채널에서 협업하는 멀티에이전트 팀 프레임워크.

## 아키텍처

```
sid (human lead)
  ↓ #ai-team 메시지
🌉 Socket Bridge ─── 메시지 수신 + 4단계 라우팅
  ↓ Agent SDK query()
🧭 PM  ·  🎨 Designer  ·  🖥️ Frontend  ·  🏗️ Backend  ·  🔭 Researcher  ·  🔒 SecOps
  ↕
.memory/ (파일 기반 공유 상태)
```

- **Socket Bridge**가 Slack WebSocket으로 메시지를 수신하고, 4단계 라우팅으로 적합한 에이전트에게 분배
- 에이전트는 Agent SDK `query()`로 직접 호출 (통합 프로세스)
- 에이전트 간 상태 공유는 `.memory/` 파일 시스템을 통해 이루어짐

## 팀 구성

| Agent | Role | Slack Bot |
|-------|------|-----------|
| PM Donald | Product Manager | @PM Donald |
| Designer Donald | UI Designer | @Designer Donald |
| Frontend Donald | Frontend Developer | @Frontend Donald |
| Backend Donald | Backend Architect | @Backend Donald |
| Researcher Donald | Trend Researcher | @Researcher Donald |
| SecOps Donald | Security Engineer | @SecOps Donald |

## 기술 스택

- **에이전트 런타임**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.2.x)
- **모델**: `claude-haiku-4-5-20251001`
- **커뮤니케이션**: Slack Bolt (Socket Mode) + Slack MCP Server
- **메모리**: 파일 시스템 기반 (`.memory/`)
- **세션 관리**: `persistSession` + 스레드별 `resume`으로 토큰 절감

## 메시지 라우팅

4단계 라우팅 파이프라인:

```
1. @mention       → 해당 에이전트 직접 전달
2. 키워드 매칭     → 업무 키워드로 담당 에이전트 식별
3. 브로드캐스트    → 인사/공지 패턴 + 업무 키워드 없음 → 전체 에이전트 병렬
4. LLM 복합 분류   → 실행 모드 결정 (single / parallel / sequential)
5. PM 기본값       → 미분류 시 PM fallback
```

### 실행 모드

| 모드 | 설명 | 예시 |
|------|------|------|
| `single` | 에이전트 1명 처리 | "API 엔드포인트 설계해줘" |
| `parallel` | 여러 에이전트 동시 작업 | "좋은 아침!", 코드 리뷰 |
| `sequential` | 순차 핸드오프 체인 | 디자인 → 프론트엔드 구현 |
| `broadcast` | 전체 에이전트 응답 | 인사, 공지, 전체 호출 |

## 설정

### 1. 환경 변수

```bash
cp .env.example .env
# 각 에이전트의 SLACK_BOT_TOKEN_*, SLACK_APP_TOKEN_*, SLACK_TEAM_ID 입력
```

### 2. 실행

```bash
# 전체 시작 (Socket Bridge + Agent Runtime)
./scripts/start-all.sh

# 전체 종료
./scripts/stop-all.sh

# Bridge 재시작 (코드 변경 후)
# /restart-bridge 스킬 사용 — WebSocket 세션 정리 자동 처리
```

## 프로젝트 구조

```
socket-bridge/
├── src/
│   ├── index.ts          # 메인 — Bolt App 6개 + 이벤트 핸들러
│   ├── router.ts         # 4단계 라우팅 (mention → keyword → broadcast → LLM)
│   ├── agent-runtime.ts  # Agent SDK query() 호출 + 세션 관리
│   ├── chain-manager.ts  # 순차 체인 실행 관리
│   ├── claim.ts          # 메시지 중복 처리 방지 (claim lock)
│   └── types.ts          # 타입 정의
├── package.json
└── tsconfig.json

.claude/
├── agents/           # 에이전트 페르소나 (6개, 200줄 상한)
│   ├── pm.md         # Product Manager
│   ├── designer.md   # UI Designer
│   ├── frontend.md   # Frontend Developer
│   ├── backend.md    # Backend Architect
│   ├── researcher.md # Trend Researcher
│   ├── secops.md     # Security Engineer
│   └── shared/       # 공유 규칙 및 프로세스
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

### 충돌 방지
- 에이전트는 @mention 없는 메시지에 직접 반응 금지
- Bridge 라우팅 후에만 작업 시작
- `.memory/claims/` 파일 기반 claim lock + 인메모리 중복 방지

### 크로스 도메인 협업
- 복합 태스크는 체인 파일(`handoff/chain-{id}.md`)로 순차 핸드오프
- 표준 패턴: Designer→Frontend, Backend→Frontend, Researcher→PM, 구현→SecOps

## 라이선스

Private repository. All rights reserved.
