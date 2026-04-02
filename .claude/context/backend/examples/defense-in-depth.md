# Defense-in-Depth Validation

## 원칙
단일 검증: "버그를 고쳤다"
다중 계층: "버그를 불가능하게 만들었다"

버그를 수정할 때 한 곳에서만 검증하면, 다른 코드 경로/리팩토링/mock이 해당 검증을 우회할 수 있다. **데이터가 통과하는 모든 계층에서 검증하라.**

## 4 Layers

### Layer 1: Entry Point Validation
API 경계에서 명백한 잘못된 입력 거부.

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
}
```

### Layer 2: Business Logic Validation
해당 작업에 대해 데이터가 의미 있는지 확인.

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
}
```

### Layer 3: Environment Guards
특정 컨텍스트에서 위험한 작업 방지.

```typescript
async function gitInit(directory: string) {
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));
    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`,
      );
    }
  }
}
```

### Layer 4: Debug Instrumentation
포렌식을 위한 컨텍스트 캡처.

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
}
```

## 적용 절차

1. **데이터 흐름 추적** — 잘못된 값이 어디서 시작해 어디로 가는가
2. **모든 체크포인트 매핑** — 데이터가 통과하는 모든 지점 나열
3. **각 계층에 검증 추가** — Entry, Business, Environment, Debug
4. **각 계층 테스트** — Layer 1 우회 시 Layer 2가 잡는지 확인

## 핵심
4개 계층 모두 필요하다. 테스트 중 각 계층이 다른 계층이 놓친 버그를 잡았다:
- 다른 코드 경로가 entry validation을 우회
- Mock이 business logic 검증을 우회
- 다른 플랫폼 엣지 케이스가 environment guard 필요
- Debug logging이 구조적 오용을 식별

**하나의 검증 지점에서 멈추지 마라. 모든 계층에 검증을 추가하라.**
