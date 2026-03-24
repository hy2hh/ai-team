# Donald 프로젝트 구조 분석

> 분석일: 2026-03-24
> 대상: /Users/sid/git/Donald

## 1. 프로젝트 개요

**Donald**은 Claude Agent SDK 기반의 가상 직원 AI 에이전트로, Slack을 통해 동작하는 이벤트 기반 시스템이다.

- **Framework/Runtime**: Node.js + TypeScript
- **AI Engine**: Anthropic Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.2.71)
- **Slack 연동**: Slack Bolt SDK v4.4.0 (Socket Mode)
- **Database**: SQLite (better-sqlite3)
- **주요 의존성**: MCP SDK v1.25.1, Langfuse v3.38.6, Zod v4.0.0

---

## 2. 프로젝트 구조

```
src/
├── index.ts                          # 메인 진입점 - 모듈 오케스트레이션
├── core/
│   ├── event-bus/                    # 중앙 이벤트 메시징
│   │   ├── EventBus.ts              # 핵심 이벤트 이미터
│   │   ├── SafeEventBus.ts          # 에러 핸들링 래퍼
│   │   └── types.ts                 # IEventBus 인터페이스
│   └── types/                        # 타입 정의
│       └── events/                   # 이벤트 타입 (SystemEventMap)
├── config/                           # 환경 설정
├── modules/                          # 기능 모듈 (이벤트 구독자)
│   ├── slack/                        # Slack 봇 & 이벤트 핸들러
│   │   ├── SlackModule.ts
│   │   ├── handlers/                 # mention, interactive, slash-commands 등
│   │   ├── services/                 # slack-client, request-context 등
│   │   ├── formatters/               # 응답 포맷팅
│   │   └── utils/                    # 메시지 파서, 멘션 리졸버
│   ├── claude-code/                  # Claude Agent SDK 통합
│   │   ├── ClaudeCodeModule.ts
│   │   ├── agents/                   # 에이전트 정의
│   │   │   └── definitions/          # code-architect, code-explorer 등
│   │   ├── classifier/               # 요청 분류 (읽기/쓰기)
│   │   ├── executor/                 # 요청 실행 레이어
│   │   ├── core/                     # SDK 래퍼, 옵션 빌더, 스트림 핸들러
│   │   └── mcp/                      # MCP 서버 정의
│   ├── memory/                       # 메모리 시스템
│   ├── memory-synthesis/             # 자동 메모리 생성
│   ├── working-directory/            # 스레드별 작업 격리
│   ├── monitoring/                   # HUD & 스트림 모니터링
│   ├── pr-notification/              # GitHub PR 연동
│   ├── feedback/                     # 피드백 & 포인트 시스템
│   ├── request-recovery/             # 시스템 재시작 복구
│   ├── subscription/                 # 자동 트리거 구독
│   ├── team/                         # 팀 관리
│   ├── user-settings/                # 사용자 설정
│   ├── langfuse/                     # 텔레메트리
│   └── figma/                        # Figma 연동
├── mcp-servers/                      # 독립 MCP 서버 바이너리
│   ├── slack/                        # Slack 도구 제공 (stdio)
│   ├── prompt-server/                # 대화형 프롬프트
│   ├── guide-server/                 # 가이드 강제
│   ├── memory-server/                # 메모리 읽기/쓰기
│   └── bypass-server/                # 훅 바이패스
└── shared/                           # 공유 유틸리티
    ├── database/
    ├── slack/
    └── modal/
```

---

## 3. 에이전트 정의 방식

에이전트는 `src/modules/claude-code/agents/definitions/`에 정의되어 있다.

```typescript
interface AgentConfigExtended {
  id: string;                    // 고유 ID
  name: string;                  // 표시 이름
  definition: {
    description: string;         // 설명
    model: 'sonnet' | 'opus';   // Claude 모델
    tools: Tool[];              // 사용 가능한 MCP 도구
    prompt: string;             // 시스템 프롬프트
  };
}
```

**정의된 에이전트:**
- `code-architect.ts` — 기능 아키텍처 설계
- `code-explorer.ts` — 코드베이스 패턴 탐색
- `code-reviewer.ts` — 코드 리뷰
- `browser-capture.ts` — 웹 페이지 캡처
- `context-researcher-memory.ts` — 컨텍스트 리서치 + 메모리

**핵심: 에이전트는 별도 프로세스가 아니라 프롬프트 패턴이다.** 1개 SDK 세션에서 프롬프트만 교체하는 방식.

---

## 4. Slack 연동

### Bot 설정

```typescript
// src/modules/slack/services/slack-client.ts
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,     // xoxb-...
  appToken: process.env.SLACK_APP_TOKEN,  // xapp-...
  socketMode: true,
});
```

### 필요한 OAuth Scopes
- `app_mentions:read` — 멘션 수신
- `chat:write` — 메시지 전송
- `channels:history` — 채널 메시지 읽기

### 이벤트 처리 흐름

```
1. @Donald 멘션 → mention-handler.ts
2. 'slack.mention.received' 이벤트 발생
3. ClassifierService → 읽기/쓰기 분류
4. 'classifier.result.received' → ExecutorService
5. SDK 세션 생성 → Claude 스트리밍 응답
6. claude-event-handlers.ts → Slack 메시지 전송
```

---

## 5. MCP 서버 구성

### In-Process (Donald 프로세스 내부)
- **Memory** (`createMemoryServer`) — 메모리 파일 읽기/쓰기
- **Guide** (`createGuideMcpServer`) — 가이드 강제
- **Bypass** (`createBypassMcpServer`) — 훅 바이패스
- **Prompt** (`createPromptMcpServer`) — Slack 질문/권한

### External (독립 프로세스)
- **Slack MCP** (`src/mcp-servers/slack/index.ts`) — stdio 트랜스포트
- **Atlassian MCP** — Docker 컨테이너 (`ghcr.io/sooperset/mcp-atlassian`)
- **GitHub, Figma, Sentry, Context7** — SDK 내장 도구 정의

---

## 6. 핵심 아키텍처 패턴

### EventBus 기반 모듈 시스템
- 중앙 `SafeEventBus<SystemEventMap>`이 모든 모듈 간 통신 관리
- 모듈은 이벤트를 구독/발행하며, 직접적인 모듈 간 결합 없음
- 13개 모듈이 독립적으로 동작

### 모듈 생명주기
- `constructor(eventBus)` → `start()` → `stop()`
- start()에서 이벤트 구독, stop()에서 정리

### 스트림 처리
- Claude SDK가 비동기 이터러블 메시지 반환
- StreamHandler가 SDK 메시지를 도메인 이벤트로 변환
- Slack 핸들러가 수신하여 포맷/전송

### 요청당 MCP 설정
- 글로벌이 아닌 요청별 MCP 구성
- Classifier vs Executor vs 사용자 컨텍스트마다 다른 도구셋

---

## 7. 실행 흐름

```typescript
// src/index.ts
async function main() {
  // 1. SafeEventBus 생성
  const eventBus = new SafeEventBus<SystemEventMap>();

  // 2. 모듈 인스턴스 생성 (13개)
  const memoryModule = new MemoryModule(eventBus);
  const claudeCodeModule = new ClaudeCodeModule(eventBus);
  const slackModule = new SlackModule(eventBus);
  // ...

  // 3. 의존성 순서대로 시작
  memoryModule.start();
  workingDirectoryModule.start();
  claudeCodeModule.start();
  await slackModule.start();
  // ...

  // 4. system.ready 이벤트 발생
  eventBus.emit('system.ready', {...});

  // 5. 프로세스 시그널 핸들러 등록
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
```

---

## 8. 환경 변수

```bash
# Slack (필수)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_USER_TOKEN=xoxp-...          # 선택
SLACK_BOT_USER_ID=U...             # 선택
SLACK_SIGNING_SECRET=...

# Claude 인증 (택 1)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_CODE_OAUTH_TOKEN=...

# GitHub (선택)
GITHUB_TOKEN=ghp-...

# Atlassian (선택)
CONFLUENCE_URL, CONFLUENCE_USERNAME, CONFLUENCE_API_TOKEN
JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN

# Sentry (선택)
SENTRY_ACCESS_TOKEN, SENTRY_HOST

# 저장소 & 정리
TEMP_BASE_DIR=/tmp/donald
CLEANUP_TIMEOUT=604800000          # 7일
DATABASE_PATH=/data/donald.db
MEMORIES_PATH=/data/memories

# 텔레메트리 (Langfuse)
LANGFUSE_ENABLED=false
LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_BASEURL
```

---

## 9. Docker 구성

```yaml
# docker-compose.yml
services:
  donald:           # 메인 애플리케이션
    volumes: [/tmp/donald, /data, ~/.claude]
    depends_on: [atlassian-mcp]
  atlassian-mcp:    # Atlassian MCP 서버 (port 9000)
    # 공유 tmp 볼륨
```
