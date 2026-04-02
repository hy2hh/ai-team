# Testing Anti-Patterns

테스트 작성/변경, mock 추가, 프로덕션 클래스에 테스트 전용 메서드 추가 유혹 시 참조.

## Iron Laws

```
1. NEVER test mock behavior
2. NEVER add test-only methods to production classes
3. NEVER mock without understanding dependencies
```

## Anti-Pattern 1: Mock 동작 테스트

```typescript
// ❌ BAD: mock 존재 여부를 테스트
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
});
```
mock이 아닌 실제 컴포넌트를 테스트하거나, mock을 해제하라.

```typescript
// ✅ GOOD: 실제 컴포넌트 테스트
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
```

### Gate Function
```
BEFORE asserting on any mock element:
  "mock 존재를 테스트하는가, 실제 동작을 테스트하는가?"
  IF mock 존재 → STOP. 삭제하거나 unmock
```

## Anti-Pattern 2: 프로덕션에 테스트 전용 메서드

```typescript
// ❌ BAD: destroy()는 테스트에서만 사용
class Session {
  async destroy() {
    await this._workspaceManager?.destroyWorkspace(this.id);
  }
}
// 테스트: afterEach(() => session.destroy());
```

프로덕션 클래스를 테스트 코드로 오염시킨다. 실수로 프로덕션에서 호출되면 위험.

```typescript
// ✅ GOOD: test-utils에서 처리
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) {
    await workspaceManager.destroyWorkspace(workspace.id);
  }
}
// 테스트: afterEach(() => cleanupSession(session));
```

### Gate Function
```
BEFORE adding method to production class:
  "테스트에서만 사용하는가?" → YES → test-utils로 이동
  "이 클래스가 이 리소스의 lifecycle을 소유하는가?" → NO → 다른 클래스
```

## Anti-Pattern 3: 의존성 이해 없는 Mock

```typescript
// ❌ BAD: mock이 테스트에 필요한 side effect를 제거
test('detects duplicate server', () => {
  vi.mock('ToolCatalog', () => ({
    discoverAndCacheTools: vi.fn().mockResolvedValue(undefined),
  }));
  await addServer(config);
  await addServer(config); // 중복 감지 안 됨!
});
```

mock된 메서드에 테스트가 의존하는 side effect(config 쓰기)가 있었음.

```typescript
// ✅ GOOD: 정확한 레벨에서 mock
test('detects duplicate server', () => {
  vi.mock('MCPServerManager'); // 느린 부분만 mock
  await addServer(config);  // config 기록됨
  await addServer(config);  // 중복 감지 ✓
});
```

### Gate Function
```
BEFORE mocking any method:
  1. "실제 메서드의 side effect는?"
  2. "이 테스트가 그 side effect에 의존하는가?"
  3. IF 의존 → 더 낮은 레벨에서 mock
  IF 불확실 → 먼저 real 구현으로 실행, 관찰, 그 다음 최소 mock
```

## Anti-Pattern 4: 불완전한 Mock

```typescript
// ❌ BAD: 필요하다고 생각하는 필드만
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  // metadata 누락 → downstream에서 crash
};
```

실제 API 응답의 **전체 구조**를 미러링하라.

```typescript
// ✅ GOOD: 실제 API 전체 구조
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  metadata: { requestId: 'req-789', timestamp: 1234567890 },
};
```

### Gate Function
```
BEFORE creating mock responses:
  "실제 API 응답에 어떤 필드가 있는가?" → 전체 포함
  불확실 → 모든 문서화된 필드 포함
```

## Anti-Pattern 5: 후순위 테스트

```
✅ 구현 완료
❌ 테스트 없음
"테스트 준비됨"
```

테스트는 구현의 **일부**이지 선택 사항이 아니다. TDD 사이클을 따르면 이 안티패턴은 발생하지 않는다.

## Mock 복잡도 경고

다음 징후가 보이면 mock 대신 통합 테스트 고려:
- mock 설정이 테스트 로직보다 길다
- 모든 것을 mock해야 통과한다
- mock에 실제 컴포넌트의 메서드가 누락
- mock 변경 시 테스트가 깨진다

## Quick Reference

| Anti-Pattern | Fix |
|---|---|
| Mock 요소에 assert | 실제 컴포넌트 테스트 또는 unmock |
| 프로덕션에 테스트 전용 메서드 | test-utils로 이동 |
| 이해 없이 mock | 의존성 파악 후 최소 mock |
| 불완전한 mock | 실제 API 전체 구조 미러링 |
| 후순위 테스트 | TDD — 테스트 먼저 |
| 과도하게 복잡한 mock | 통합 테스트 고려 |

## Red Flags

- `*-mock` testId에 assert
- 테스트 파일에서만 호출되는 프로덕션 메서드
- mock 설정이 테스트의 50% 이상
- mock 제거 시 테스트 실패
- mock이 필요한 이유를 설명 못함
- "안전하게" mock
