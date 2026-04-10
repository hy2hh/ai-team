# Socket-Bridge Architecture & API Guide

## Overview

`socket-bridge`는 Slack 기반 AI 에이전트 팀의 중추 인프라입니다. Slack에서 수신한 메시지를 분석하여 적절한 에이전트(PM, Designer, Frontend, Backend, Researcher, SecOps, QA)에게 라우팅하고, 에이전트 실행을 관리하는 시스템입니다.

**주요 책임:**
- Slack 메시지 수신 및 전처리
- 메시지 의도 분석 및 에이전트 라우팅
- 에이전트 런타임 관리 (실행, 취소, 모니터링)
- 큐 기반 작업 처리
- 칸반 보드 동기화
- 순환 재시도(Retry) 및 회로 차단(Circuit Breaker)

---

## Core Data Types

### `SlackEvent`
Slack 채널/스레드의 메시지 이벤트를 표준화합니다.

```typescript
interface SlackEvent {
  type: string;              // 'message', 'app_mention' 등
  channel: string;           // 채널 ID (e.g., 'C0ANKEB4CRF')
  channel_name: string;      // 채널 이름 (캐시)
  user: string;              // 발신자 User ID
  text: string;              // 메시지 본문
  ts: string;                // 메시지 타임스탬프
  thread_ts: string | null;  // 스레드 부모 ts (또는 null)
  mentions: string[];        // 멘션된 에이전트 목록
  threadTopic?: string;      // 스레드 주제 요약 (선택사항)
  raw: Record<string, unknown>; // Slack 원본 이벤트
  batchTs?: string[];        // 배치 병합된 메시지들의 ts (배치 처리 시)
}
```

**사용 시기:**
- Slack 이벤트 처리
- 메시지 라우팅
- 에이전트에게 컨텍스트 전달

---

### `RoutingResult`
라우팅 분석 결과를 나타냅니다. 어느 에이전트가, 어떤 방식으로 처리할지를 정의합니다.

```typescript
interface RoutingResult {
  agents: RoutingAgent[];    // 라우팅 대상 에이전트 목록
  execution: ExecutionMode;  // 'single' | 'parallel'
  method: RoutingMethod;     // 라우팅 방식 (see below)
  isQACommand?: boolean;     // QA 직접 실행 명령어 여부
  specPath?: string;         // QA 스펙 파일 경로
  isQAVerification?: boolean; // 회귀 검증 모드 여부
}

type RoutingMethod =
  | 'mention'      // @agent 직접 멘션
  | 'keyword'      // 키워드 매칭
  | 'broadcast'    // 전체 브로드캐스트
  | 'conversational' // 간단한 대화 (LLM 분류 스킵)
  | 'llm'          // LLM 기반 분류
  | 'default'      // 기본값 (PM)
  | 'delegation'   // 에이전트 위임
  | 'hub-review';  // Hub 리뷰 계층
```

**라우팅 우선순위 (6단계):**
1. **QA 명령어** (`/qa run docs/specs/xxx.md`) → 직접 실행
2. **@mention** (`@Backend`, `@Designer`) → 명시적 지정
3. **대화형** (인사, 간단한 확인) → LLM 분류 스킵
4. **키워드** (API, DB, CSS 등) → 패턴 매칭
5. **LLM 분류** (불명확한 요청) → Claude API 호출
6. **기본값** (매칭 실패) → PM으로 라우팅

---

### `AgentSession`
에이전트별 세션 상태를 관리합니다.

```typescript
interface AgentSession {
  agentName: string;         // 에이전트 이름
  systemPrompt: string;      // persona 파일 내용
  personaLoadedAt: number;   // 파일 로드 시각 (ms)
  threadSessions: Map<string, string>; // thread_ts → SDK sessionId
}
```

---

## Router Module (`router.ts`)

메시지 분석 및 라우팅 결정을 담당합니다.

### 주요 함수

#### `routeMessage(event: SlackEvent): Promise<RoutingResult>`
Slack 이벤트를 분석하여 라우팅 결정을 반환합니다.

**로직:**
1. QA 명령어 감지 (`parseQACommand()`)
2. @mention 감지 → 직접 라우팅
3. 대화형 패턴 감지 → PM으로 직행 (LLM 분류 스킵)
4. 키워드 매칭 (ROUTING_RULES)
5. LLM 기반 분류 (`classifyWithLlm()`)
6. 기본값 (PM)

**예시:**
```typescript
const event: SlackEvent = {
  channel: 'C0ANKEB4CRF',
  text: '@Backend DB 성능 최적화 필요',
  mentions: ['Backend'],
  // ...
};

const result = await routeMessage(event);
// result.agents = [{ name: 'Backend', role: 'System Design & API' }]
// result.method = 'mention'
```

#### `parseQACommand(text: string): { isQACommand: boolean; specPath?: string }`
QA 직접 실행 명령어를 파싱합니다.

**지원 형식:**
- `QA 실행 docs/specs/xxx.md`
- `qa run docs/specs/xxx.md`
- `QA 검증 docs/specs/xxx.md`

**반환:**
```typescript
// 유효한 명령어
{ isQACommand: true, specPath: 'docs/specs/2026-04-10_notification-system.md' }

// 스펙 없는 QA 명령어 (에러)
{ isQACommand: true, specPath: undefined }

// QA 명령어 아님
{ isQACommand: false }
```

#### `extractSpecPath(text: string): string | undefined`
텍스트에서 `docs/specs/*.md` 경로를 추출합니다.

**사용처:**
- 일반 위임 메시지에 포함된 스펙 경로 감지
- 자동 QA 트리거

---

### 라우팅 규칙 (Keyword Matching)

```typescript
const ROUTING_RULES: Record<string, RegExp> = {
  backend:   /API|서버|DB|데이터베이스|엔드포인트|배포|인프라/i,
  frontend:  /UI|컴포넌트|CSS|페이지|화면|레이아웃|React|SEO|성능/i,
  designer:  /디자인|UX|피그마|목업|와이어프레임|색상/i,
  pm:        /기획|로드맵|스프린트|우선순위|PRD|요구사항/i,
  researcher:/조사|트렌드|경쟁사|시장 분석/i,
  secops:    /보안|인증|권한|취약점|SSL|암호화/i,
  qa:        /QA|품질|검증|테스트|리뷰|검수/i,
};
```

---

### Circuit Breaker (LLM Resilience)

LLM 라우팅 실패 대비 회로 차단:

```typescript
export const llmCircuitBreaker = createCircuitBreaker({
  failureThreshold: 5,      // 5회 연속 실패 시 회로 열림
  resetTimeoutMs: 60_000,   // 60초 후 시험 요청 허용
  label: 'llm-routing',
});
```

**동작:**
- 5회 연속 LLM API 실패 → 회로 열림
- 회로 열린 상태에서 요청 → `CircuitOpenError` 즉시 반환
- 60초 후 자동 시험 요청 (`halfOpen` 상태)
- 시험 요청 성공 → 회로 재설정

---

## Queue Processor Module (`queue-processor.ts`)

큐 기반 작업 처리 시스템입니다.

### 주요 함수

#### `startQueueProcessor(): Promise<void>`
큐 처리 루프를 시작합니다. 백그라운드에서 계속 실행됩니다.

**동작:**
1. DB에서 대기 중인 큐 태스크 조회
2. 태스크 청구(claim) — 중복 처리 방지
3. 에이전트 실행 (`handleMessage()`)
4. 완료/실패 상태 업데이트
5. 재시도 로직 (지수 백오프)

#### `stopQueueProcessor(): Promise<void>`
큐 처리 루프를 중지합니다.

---

## Agent Runtime Module (`agent-runtime.ts`)

에이전트 실행 및 생명주기를 관리합니다.

### 주요 함수

#### `handleMessage(event: SlackEvent, agents: RoutingAgent[], execution: ExecutionMode): Promise<void>`
에이전트를 실행하여 메시지를 처리합니다.

**매개변수:**
- `event`: Slack 이벤트
- `agents`: 라우팅 대상 에이전트 목록
- `execution`: 실행 모드 ('single' | 'parallel')

**로직:**
1. 에이전트 페르소나 파일 로드
2. 세션 생성 (스레드별 SDK sessionId)
3. Claude Agent SDK로 에이전트 호출
4. 응답을 스레드에 게시
5. 에러 처리 및 재시도

#### `cancelAgent(agentName: string, thread_ts: string): Promise<void>`
특정 에이전트의 실행을 취소합니다.

**사용 시기:**
- 사용자 중단 요청
- 타임아웃 (AGENT_TIMEOUT_MS = 540초)
- 에러 발생 후 롤백

#### `getActiveAgentsSnapshot(): Record<string, any>`
현재 실행 중인 모든 에이전트의 상태를 반환합니다.

```typescript
const snapshot = getActiveAgentsSnapshot();
// {
//   'pm:thread_123': { startedAt: 1712..., ... },
//   'backend:thread_456': { ... },
// }
```

---

## Claim Database Module (`claim-db.ts`)

분산 환경에서 중복 처리를 방지합니다.

### 주요 함수

#### `tryClaim(queueId: string, duration: number): Promise<boolean>`
큐 태스크에 대해 "청구(claim)"를 시도합니다.

**반환:**
- `true`: 청구 성공 → 처리 진행
- `false`: 청구 실패 → 다른 프로세스가 이미 처리 중

**유효기간:**
- 기본: 60초
- 청구 유효기간 동안 처리 진행
- 유효기간 만료 전에 `updateClaim()` 호출하여 연장

#### `updateClaim(queueId: string, duration: number): Promise<void>`
기존 청구를 갱신하여 유효기간을 연장합니다.

**사용 시기:**
- 장시간 에이전트 실행 중
- 타임아웃 방지

---

## Auto-Proceed Module (`auto-proceed.ts`)

사용자 승인/거부를 처리합니다.

### 주요 함수

#### `manuallyApprove(approvalId: string): Promise<void>`
사용자가 승인 버튼을 클릭했을 때 호출됩니다.

**동작:**
1. 대기 중인 타이머 취소
2. 에이전트 실행 재개
3. 승인 메시지 게시

#### `resolveApprovalById(approvalId: string): Promise<boolean>`
특정 승인 요청의 상태를 조회합니다.

---

## Kanban Sync Module (`kanban-sync.ts`)

칸반 보드와 시스템 상태를 동기화합니다.

### 주요 함수

#### `moveToDone(cardId: string): Promise<void>`
칸반 카드를 "완료" 상태로 이동합니다.

#### `moveToBlocked(cardId: string): Promise<void>`
칸반 카드를 "차단" 상태로 이동합니다.

#### `updateCard(cardId: string, updates: Partial<Card>): Promise<void>`
칸반 카드를 부분 업데이트합니다.

```typescript
await updateCard('card-123', {
  title: '새 제목',
  description: '업데이트된 설명',
  progress: 50,
});
```

---

## Slack Event Flow

```
┌─────────────────────────────────────────────────┐
│ Slack 채널에서 메시지 수신                        │
│ (app_mention, message_thread 등)               │
└──────────────┬──────────────────────────────────┘
               │
        ┌──────▼─────────┐
        │ SlackEvent 변환 │
        └──────┬─────────┘
               │
        ┌──────▼──────────────────┐
        │ routeMessage() 호출     │
        │ (라우팅 의도 분석)      │
        └──────┬──────────────────┘
               │
      ┌────────┼────────┐
      │        │        │
   ┌──▼─┐ ┌───▼──┐ ┌──▼──┐
   │QA  │ │@mention│ │Keyword│
   │명령│ │      │ │      │
   └────┘ └──┬───┘ └──┬──┘
             │        │
         ┌───▼────────▼────┐
         │  LLM 분류       │ (필요시)
         │  (선택적)       │
         └────────┬────────┘
                  │
         ┌────────▼──────────────┐
         │ RoutingResult 결정    │
         │ (agents, method, ...) │
         └────────┬──────────────┘
                  │
      ┌───────────┼────────────┐
      │           │            │
   ┌──▼──┐   ┌───▼──┐   ┌─────▼────┐
   │Single│   │Parallel│  │Broadcast │
   │exec  │   │ exec   │  │          │
   └──┬───┘   └───┬────┘  └────┬─────┘
      │           │            │
      └───────────┼────────────┘
                  │
         ┌────────▼──────────────┐
         │ handleMessage()       │
         │ (에이전트 실행)        │
         └────────┬──────────────┘
                  │
      ┌───────────┴────────────┐
      │                        │
   ┌──▼──┐             ┌──────▼────┐
   │응답  │             │에러 처리   │
   │Slack │             │재시도 로직 │
   │스레드│             │           │
   └──┬───┘             └──────┬────┘
      │                       │
      └───────────┬───────────┘
                  │
         ┌────────▼──────────────┐
         │ 칸반 보드 동기화      │
         │ (상태 업데이트)       │
         └───────────────────────┘
```

---

## Error Handling & Resilience

### Retry Strategy

```typescript
const LLM_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5_000,
  label: 'llm-query',
  isRetryable: (error) => {
    if (error instanceof CircuitOpenError) return false; // 회로 열림 → 즉시 실패
    if (error instanceof Error && error.message.includes('timeout')) return true;
    return true;
  },
};
```

**지수 백오프:**
- 1회차: 500ms 대기 후 재시도
- 2회차: ~1,250ms (베이스 × 2.5) 대기 후 재시도
- 3회차 실패: 최종 실패

### Timeout

```typescript
const AGENT_TIMEOUT_MS = 540_000; // 9분
```

타임아웃 초과 시:
1. 에이전트 프로세스 강제 종료
2. `cancelAgent()` 호출
3. 사용자에게 타임아웃 메시지 게시

---

## Configuration (`config.ts`)

주요 설정값:

| 항목 | 기본값 | 설명 |
|------|-------|------|
| `DEBOUNCE_DELAY` | 2000ms | 메시지 배치 처리 윈도우 |
| `MAX_CONCURRENT_HANDLERS` | 3 | 동시 에이전트 실행 수 |
| `AGENT_TIMEOUT_MS` | 540000ms (9분) | 에이전트 최대 실행 시간 |
| `MAX_DELEGATION_DEPTH` | 2 | 위임 체인 깊이 제한 |
| `CONTEXT_COMPRESSION_ENABLED` | true | 컨텍스트 압축 활성화 |
| `CONTEXT_COMPRESSION_THRESHOLD_CHARS` | 50000 | 압축 임계값 |

---

## Monitoring & Logging

### Langfuse Integration

에이전트 실행 이력을 Langfuse에 자동 기록합니다.

```typescript
// langfuse-tracker.ts에서 자동 처리
// - 에이전트 실행 시작/종료
// - 에러 로깅
// - 성능 지표 (latency, token usage)
```

### Heartbeat

각 에이전트 프로세스는 주기적으로 heartbeat를 기록하여 상태를 모니터링합니다.

```typescript
// heartbeat.ts
writeHeartbeat(agentName); // 1초마다
cleanupStaleHeartbeats(); // 10초 이상 없으면 스테일 표시
```

---

## Database Schema (Highlights)

### queue 테이블
```sql
CREATE TABLE queue (
  id TEXT PRIMARY KEY,
  thread_ts TEXT NOT NULL,
  agent_name TEXT,
  payload JSONB,
  status TEXT DEFAULT 'pending', -- pending, processing, done, failed
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

### claims 테이블
```sql
CREATE TABLE claims (
  queue_id TEXT PRIMARY KEY,
  claimed_at INTEGER,
  expires_at INTEGER
);
```

---

## Examples

### Example 1: Message Routing

```typescript
import { routeMessage } from './router.js';

const event: SlackEvent = {
  channel: 'C0ANKEB4CRF',
  user: 'U123456',
  text: '@Backend API 문서화 필요합니다',
  ts: '1712345678.123456',
  thread_ts: null,
  mentions: ['Backend'],
  channel_name: 'ai-team',
  raw: { ... },
};

const result = await routeMessage(event);
console.log(result);
// {
//   agents: [{ name: 'Backend', role: 'System Design & API' }],
//   execution: 'single',
//   method: 'mention',
// }
```

### Example 2: Agent Execution

```typescript
import { handleMessage } from './agent-runtime.js';

await handleMessage(event, result.agents, result.execution);
// → Backend 에이전트가 실행되고 스레드에 응답을 게시합니다.
```

### Example 3: Queue Processing

```typescript
import { startQueueProcessor, stopQueueProcessor } from './queue-processor.js';

// 서버 시작 시
await startQueueProcessor();

// 서버 종료 시
await stopQueueProcessor();
```

---

## Related Documentation

- **Kanban Backend API**: See `docs/api/kanban-backend-api.md`
- **Database Schema**: See `.claude/context/backend/examples/database-schema.md`
- **Type Definitions**: See `socket-bridge/src/types.ts`
- **Configuration**: See `socket-bridge/src/config.ts`

---

**Last Updated:** 2026-04-11
**Author:** Homer (Backend Architect)
