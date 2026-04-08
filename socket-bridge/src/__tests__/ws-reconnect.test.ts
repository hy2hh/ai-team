/**
 * WsReconnect — 자동 재연결 로직 단위 테스트
 *
 * 검증 항목:
 * 1. 초기 연결 성공 → onOpen 호출, state = 'open'
 * 2. 연결 끊김 → 재연결 시도 (onReconnect 호출)
 * 3. 재연결 성공 → retryCount 리셋, onOpen 재호출
 * 4. maxRetries 초과 → onMaxRetriesExceeded 호출, 재연결 중단
 * 5. 수동 close → 재연결 없음, state = 'closed'
 * 6. open 상태에서 send → 메시지 전달
 * 7. 미연결 상태에서 send → 무시됨
 */

import { createWsReconnect } from '../ws-reconnect.js';

// ─── Mock WebSocket ──────────────────────────────────────────────

/** 테스트용 Mock WebSocket — 이벤트를 수동으로 트리거 */
class MockWs {
  static instances: MockWs[] = [];

  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sentMessages: string[] = [];
  closedWith: number | undefined = undefined;

  constructor(public url: string) {
    MockWs.instances.push(this);
  }

  /** 연결 성공 시뮬레이션 */
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  /** 연결 끊김 시뮬레이션 */
  simulateClose(code = 1006): void {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code, reason: '' });
  }

  /** 메시지 수신 시뮬레이션 */
  simulateMessage(data: string): void {
    this.onmessage?.({ data });
  }

  /** 에러 시뮬레이션 */
  simulateError(): void {
    this.onerror?.(new Error('connection error'));
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number): void {
    this.closedWith = code;
    this.readyState = 3;
  }
}

/** 즉시 resolve되는 sleep (테스트에서 실제 대기 제거) */
const noopSleep = (): Promise<void> => Promise.resolve();

// ─── 테스트 러너 ─────────────────────────────────────────────────

type TestResult = { name: string; pass: boolean; detail: string };
const results: TestResult[] = [];

const test = async (
  name: string,
  fn: () => Promise<void> | void,
): Promise<void> => {
  MockWs.instances = [];
  try {
    await fn();
    results.push({ name, pass: true, detail: 'OK' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, pass: false, detail: msg });
  }
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

// ─── 테스트 케이스 ────────────────────────────────────────────────

async function runTests(): Promise<void> {
  // ── 1. 초기 연결 성공 ──────────────────────────────────────────
  await test('초기 연결 성공 → state=open, onOpen 호출', async () => {
    let openCount = 0;
    const wsr = createWsReconnect({
      url: 'ws://test',
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
      onOpen: () => { openCount++; },
    });

    assert(MockWs.instances.length === 1, 'WebSocket 인스턴스 1개 생성되어야 함');
    assert(wsr.getState() === 'connecting', '초기 state는 connecting');

    MockWs.instances[0].simulateOpen();

    assert(openCount === 1, 'onOpen 1회 호출되어야 함');
    assert(wsr.getState() === 'open', 'open 이후 state=open');
  });

  // ── 2. 연결 끊김 → 재연결 시도 ──────────────────────────────────
  await test('연결 끊김 → 재연결 시도 (새 WebSocket 생성)', async () => {
    let reconnectCount = 0;
    createWsReconnect({
      url: 'ws://test',
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
      onReconnect: (attempt: number) => { reconnectCount = attempt; },
    });

    // 첫 연결 성공 후 끊김
    MockWs.instances[0].simulateOpen();
    MockWs.instances[0].simulateClose();

    // sleep이 즉시 resolve되므로 microtask 큐 처리 기다림
    await Promise.resolve();
    await Promise.resolve();

    assert(MockWs.instances.length === 2, '재연결 시 새 WebSocket 인스턴스 생성');
    assert(reconnectCount === 1, 'onReconnect(1) 호출됨');
  });

  // ── 3. 재연결 성공 → retryCount 리셋 ─────────────────────────────
  await test('재연결 성공 → onOpen 재호출, retryCount 리셋', async () => {
    let openCount = 0;
    const wsr = createWsReconnect({
      url: 'ws://test',
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
      onOpen: () => { openCount++; },
    });

    // 첫 연결 → 끊김 → 재연결 성공
    MockWs.instances[0].simulateOpen();
    MockWs.instances[0].simulateClose();
    await Promise.resolve();
    await Promise.resolve();

    MockWs.instances[1].simulateOpen();

    assert(openCount === 2, 'onOpen 총 2회 호출됨');
    assert(wsr.getState() === 'open', '재연결 후 state=open');
  });

  // ── 4. maxRetries 초과 → 재연결 중단 ──────────────────────────────
  await test('maxRetries=2 초과 → onMaxRetriesExceeded 호출, 재연결 중단', async () => {
    let maxExceeded = false;
    const wsr = createWsReconnect({
      url: 'ws://test',
      maxRetries: 2,
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
      onMaxRetriesExceeded: () => { maxExceeded = true; },
    });

    // 1차 연결 → 끊김 (retry 1)
    MockWs.instances[0].simulateOpen();
    MockWs.instances[0].simulateClose();
    await Promise.resolve(); await Promise.resolve();

    // 2차 연결 실패 (retry 2)
    MockWs.instances[1].simulateClose();
    await Promise.resolve(); await Promise.resolve();

    // 3차 연결 실패 → maxRetries 초과
    MockWs.instances[2].simulateClose();
    await Promise.resolve(); await Promise.resolve();

    assert(maxExceeded, 'onMaxRetriesExceeded 호출됨');
    assert(wsr.getState() === 'closed', 'state=closed');
    // 4번째 인스턴스는 생성되지 않아야 함
    assert(MockWs.instances.length === 3, `재연결 중단 후 더 이상 WebSocket 생성 안 함 (현재 ${MockWs.instances.length}개)`);
  });

  // ── 5. 수동 close → 재연결 없음 ────────────────────────────────
  await test('수동 close → 재연결 없음, state=closed', async () => {
    const wsr = createWsReconnect({
      url: 'ws://test',
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
    });

    MockWs.instances[0].simulateOpen();
    wsr.close();

    // close 직후 WebSocket에 code 1000 전달 확인
    assert(MockWs.instances[0].closedWith === 1000, 'close(1000) 호출됨');
    assert(wsr.getState() === 'closed', 'state=closed');

    // close 이벤트 발생해도 재연결 없어야 함
    MockWs.instances[0].simulateClose(1000);
    await Promise.resolve(); await Promise.resolve();

    assert(MockWs.instances.length === 1, '수동 close 후 재연결 없음');
  });

  // ── 6. open 상태에서 send ────────────────────────────────────────
  await test('open 상태에서 send → WebSocket으로 메시지 전달', () => {
    const wsr = createWsReconnect({
      url: 'ws://test',
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
    });

    MockWs.instances[0].simulateOpen();
    wsr.send('hello');
    wsr.send('world');

    assert(
      MockWs.instances[0].sentMessages.join(',') === 'hello,world',
      'send한 메시지 순서대로 전달됨',
    );
  });

  // ── 7. 미연결 상태에서 send → 무시됨 ────────────────────────────
  await test('connecting 상태에서 send → 무시됨 (에러 없음)', () => {
    const wsr = createWsReconnect({
      url: 'ws://test',
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
    });

    // open 호출 없이 send (state=connecting)
    wsr.send('ignored');

    assert(MockWs.instances[0].sentMessages.length === 0, 'send 무시됨');
    assert(wsr.getState() === 'connecting', 'state 유지 connecting');
  });

  // ── 8. onMessage 콜백 ────────────────────────────────────────────
  await test('onMessage 콜백 — 수신 메시지 전달됨', () => {
    const received: string[] = [];
    createWsReconnect({
      url: 'ws://test',
      WebSocketCtor: MockWs as never,
      sleepFn: noopSleep,
      onMessage: (data: string) => received.push(data),
    });

    MockWs.instances[0].simulateOpen();
    MockWs.instances[0].simulateMessage('ping');
    MockWs.instances[0].simulateMessage('pong');

    assert(received.join(',') === 'ping,pong', 'onMessage 순서대로 호출됨');
  });

  // ─── 결과 출력 ───────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('  WsReconnect — 자동 재연결 로직 테스트');
  console.log('══════════════════════════════════════════════════');

  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (!r.pass) {
      console.log(`   실패 원인: ${r.detail}`);
    }
    if (r.pass) passed++;
    else failed++;
  }

  console.log('──────────────────────────────────────────────────');
  console.log(`  결과: ${passed}/${results.length} 통과 (실패: ${failed})`);
  console.log('══════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runTests();
