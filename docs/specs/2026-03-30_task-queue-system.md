# Feature Spec: Task Queue System
Date: 2026-03-30
Author: Marge (PM)
Status: approved

## 배경 & 문제

현재 PM이 Homer에게 "3개 주제 분석"처럼 복잡한 작업을 위임하면:
1. Homer가 단일 세션에서 전부 처리 시도
2. `maxTurns: 30` 초과 → `error_max_turns` 강제 종료
3. Marge가 원인 모른 채 동일 작업 재위임
4. Homer가 처음부터 재시도 → 또 실패 → 무한 루프

**근본 원인:** 복잡한 작업을 단일 에이전트 세션에 담는 구조.

## 해결책: 영구 Task Queue

복잡한 작업을 **Task 단위로 분해 → SQLite 큐에 저장 → 독립 세션으로 순차 실행**.

각 Task는:
- 독립 에이전트 세션에서 실행 (max_turns 초과 위험 최소화)
- 이전 Task 결과를 다음 Task context로 전달
- 상태(queued/running/completed/failed)가 DB에 영구 기록
- Slack 스레드에 진행 상황 실시간 업데이트

---

## 구현 스펙

### 1. DB 스키마 추가 (`db.ts`)

기존 `memory.db`에 `task_queue` 테이블 추가:

```sql
CREATE TABLE IF NOT EXISTS task_queue (
  id TEXT PRIMARY KEY,
  parent_queue_id TEXT,       -- 같은 배치의 ID (그룹핑용)
  sequence INTEGER NOT NULL,  -- 배치 내 순서 (0-based)
  depends_on INTEGER,         -- 선행 sequence 번호 (null = 즉시 실행 가능)
  agent TEXT NOT NULL,
  task TEXT NOT NULL,
  context TEXT,               -- 이전 Task 결과 (실행 시 주입)
  tier TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'queued',  -- queued | running | completed | failed | skipped
  result TEXT,
  error TEXT,
  thread_ts TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_thread ON task_queue(thread_ts);
CREATE INDEX IF NOT EXISTS idx_task_queue_parent ON task_queue(parent_queue_id);
```

### 2. Queue Manager 모듈 (`queue-manager.ts` 신규)

```typescript
interface QueueTask {
  agent: string;
  task: string;
  tier?: 'high' | 'standard' | 'fast';
  dependsOn?: number; // 선행 sequence index (0-based)
}

interface EnqueueResult {
  queueId: string;   // parent_queue_id
  taskCount: number;
  tasks: { id: string; sequence: number; agent: string }[];
}

// 주요 함수
enqueue(tasks: QueueTask[], threadTs: string, channel: string): EnqueueResult
getNextTask(): TaskQueueRow | null          // queued 중 실행 가능한 것
markRunning(id: string): void
markCompleted(id: string, result: string): void
markFailed(id: string, error: string): void
getQueueStatus(threadTs: string): QueueStatusSummary
cancelQueue(parentQueueId: string): void   // ⛔ 리액션 처리용
```

**"실행 가능" 판단 기준:**
- `status = 'queued'`
- `depends_on IS NULL` OR `depends_on`에 해당하는 sequence의 task가 `completed`

### 3. Queue Processor (`queue-processor.ts` 신규)

Bridge에서 주기적으로 호출하는 폴링 루프:

```typescript
// 5초마다 실행
async function processNextQueuedTask(): Promise<void> {
  const task = getNextTask();
  if (!task) return;

  // 이전 결과 컨텍스트 로드
  const prevResult = getPreviousTaskResult(task.parent_queue_id, task.depends_on);

  // Slack에 진행 상황 알림
  await postQueueProgress(task, 'running');

  markRunning(task.id);

  try {
    // 독립 세션으로 에이전트 실행
    const result = await handleMessage({
      agent: task.agent,
      message: buildTaskPrompt(task, prevResult),
      threadTs: task.thread_ts,
      channel: task.channel,
      tier: task.tier,
      isQueueTask: true,   // Hub Loop 진입 방지
    });

    markCompleted(task.id, result);
    await postQueueProgress(task, 'completed', result);

  } catch (err) {
    markFailed(task.id, err.message);
    await postQueueProgress(task, 'failed', null, err.message);
    // 의존하는 후속 태스크는 자동 skipped
    skipDependentTasks(task.parent_queue_id, task.sequence);
  }
}
```

**동시 실행 제어:**
- `depends_on`이 없는 태스크들은 병렬 실행 가능 (선택적)
- 초기 구현: 단순 순차 실행 (한 번에 1개)

### 4. PM 도구 추가 (`agent-runtime.ts`)

기존 `delegate` 도구 옆에 `enqueue_tasks` 추가:

```typescript
tool('enqueue_tasks', {
  description: '복잡한 작업을 Task 단위로 분해하여 큐에 등록. 각 Task는 독립 세션에서 실행됨.',
  inputSchema: {
    tasks: {
      type: 'array',
      items: {
        agent: string,        // pm|designer|frontend|backend|researcher|secops
        task: string,         // 태스크 설명 (구체적일수록 좋음)
        tier?: string,        // high|standard|fast
        dependsOn?: number    // 선행 task의 0-based index
      }
    },
    reason: string            // 큐 등록 이유
  }
})
```

**언제 `enqueue_tasks` vs `delegate`?**
- `delegate`: 즉시 응답이 필요하거나 단순 단일 태스크
- `enqueue_tasks`: 31턴 초과 위험이 있는 복잡한 분석, 3개 이상 독립 태스크, 순차 의존성 있는 태스크

### 5. Slack 진행 상황 표시

큐 시작 시 (enqueue 직후):
```
📋 [큐 등록] 3개 태스크 순차 실행 시작
  • Task 1: Homer — 승인 창 근본 원인 분석
  • Task 2: Homer — Opus 모델 사용 구조 점검
  • Task 3: Homer — 반복 패턴 근본 원인 분석
```

각 태스크 실행 중:
```
🔄 [Queue 1/3] Homer — 승인 창 근본 원인 분석 진행 중...
```

각 태스크 완료:
```
✅ [Queue 1/3 완료] Homer — 승인 창 근본 원인 분석 (67초)
```

실패 시:
```
❌ [Queue 2/3 실패] Homer — Opus 구조 점검
오류: error_max_turns (30턴 초과)
→ Task 3 skipped (의존성)
```

### 6. ⛔ 리액션으로 큐 취소

기존 abort 로직에 큐 취소 추가:
```typescript
// ⛔ 리액션 감지 시 현재 실행 중인 Task abort + 나머지 queued → skipped
if (reaction === 'black_square_for_stop') {
  abortCurrentTask();
  cancelQueue(parentQueueId);
}
```

---

## 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `src/db.ts` | 수정 | `task_queue` 테이블 + 인덱스 추가 |
| `src/queue-manager.ts` | 신규 | 큐 CRUD + 상태 관리 |
| `src/queue-processor.ts` | 신규 | 폴링 루프 + 에이전트 실행 |
| `src/agent-runtime.ts` | 수정 | `enqueue_tasks` 도구 추가 |
| `src/index.ts` | 수정 | 폴링 루프 시작, ⛔ 큐 취소 통합 |

---

## Acceptance Criteria

### Happy Path
- [ ] PM이 `enqueue_tasks`로 3개 태스크 등록 시 큐 시작 메시지가 Slack에 게시됨
- [ ] Task 1 완료 후 Task 2가 자동 시작됨
- [ ] Task 2 결과가 Task 3의 context로 전달됨
- [ ] 각 태스크 완료 시 Slack에 완료 메시지 + 소요 시간 표시

### 에러 케이스
- [ ] Task 2 실패 시 Task 3 (의존하는 태스크)는 skipped 처리됨
- [ ] Task 2 실패 시 독립적인 Task 3 (depends_on 없음)는 계속 실행됨
- [ ] `error_max_turns` 발생 시 max_retries 내 재시도 후 failed 처리

### 엣지 케이스
- [ ] ⛔ 리액션 시 현재 실행 중 Task abort + 나머지 queued → skipped
- [ ] Bridge 재시작 시 running 상태 Task를 orphan으로 감지하여 재시도
- [ ] 동일 스레드에서 복수 큐 동시 실행 방지 (하나씩만 active)

---

## 구현 순서

1. `db.ts` — task_queue 테이블 추가
2. `queue-manager.ts` — 신규 모듈
3. `queue-processor.ts` — 신규 모듈
4. `agent-runtime.ts` — enqueue_tasks 도구 추가
5. `index.ts` — 폴링 루프 + ⛔ 취소 통합
6. 빌드 + 런타임 테스트 (3개 태스크 큐 등록 → 실행 → 완료 확인)
