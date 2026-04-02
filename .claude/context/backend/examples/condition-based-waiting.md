# Condition-Based Waiting

## 원칙
임의의 딜레이로 타이밍을 추측하지 마라. 실제 조건을 기다려라.

```typescript
// ❌ 타이밍 추측
await new Promise((r) => setTimeout(r, 50));
const result = getResult();

// ✅ 조건 대기
await waitFor(() => getResult() !== undefined);
const result = getResult();
```

## Quick Patterns

| 시나리오 | 패턴 |
|----------|------|
| 이벤트 대기 | `waitFor(() => events.find((e) => e.type === 'DONE'))` |
| 상태 대기 | `waitFor(() => machine.state === 'ready')` |
| 개수 대기 | `waitFor(() => items.length >= 5)` |
| 파일 대기 | `waitFor(() => fs.existsSync(path))` |
| 복합 조건 | `waitFor(() => obj.ready && obj.value > 10)` |

## 구현

```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000,
): Promise<T> {
  const startTime = Date.now();
  while (true) {
    const result = condition();
    if (result) {
      return result;
    }
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Timeout waiting for ${description} after ${timeoutMs}ms`,
      );
    }
    await new Promise((r) => setTimeout(r, 10)); // 10ms 간격 폴링
  }
}
```

## Common Mistakes

| 실수 | 수정 |
|------|------|
| 폴링 너무 빠름 (`setTimeout(check, 1)`) | 10ms 간격 |
| 타임아웃 없음 → 무한 루프 | 항상 타임아웃 + 명확한 에러 메시지 |
| 루프 전 상태 캐싱 → stale data | 루프 내부에서 매번 getter 호출 |

## 임의 타임아웃이 올바른 경우

```typescript
// 100ms마다 tick하는 도구 — 부분 출력 확인에 2 tick 필요
await waitForEvent(manager, 'TOOL_STARTED'); // 먼저: 조건 대기
await new Promise((r) => setTimeout(r, 200)); // 그 다음: 알려진 타이밍
// 200ms = 100ms × 2 ticks — 문서화 및 근거 명시
```

**조건:**
1. 먼저 트리거 조건을 대기
2. 알려진 타이밍에 기반 (추측 아님)
3. WHY를 코멘트로 설명
