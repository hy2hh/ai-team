/**
 * WebSocket 자동 재연결 유틸리티
 *
 * 기능:
 * - 연결 끊김 시 지수 백오프 기반 자동 재연결
 * - maxRetries 초과 시 재연결 중단 + onMaxRetriesExceeded 콜백
 * - 수동 close 시 재연결 없음
 * - 테스트를 위한 WebSocketCtor / sleepFn 주입 지원
 */

import { getRetryDelay } from './retry.js';

/** 재연결 가능한 WebSocket 상태 */
export type WsState = 'connecting' | 'open' | 'reconnecting' | 'closed';

/**
 * 최소 WebSocket 인터페이스
 * 브라우저 WebSocket, Node.js ws 패키지 모두 호환
 */
export interface WsLike {
  readyState: number;
  onopen: (() => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number): void;
}

/** WsLike 생성자 타입 */
export type WsConstructor = new (url: string) => WsLike;

/** createWsReconnect 옵션 */
export interface WsReconnectOptions {
  /** WebSocket 서버 URL */
  url: string;
  /** 최대 재연결 횟수 (기본값: Infinity) */
  maxRetries?: number;
  /** 기본 딜레이 ms — 지수 백오프 시작점 (기본값: 1000) */
  baseDelayMs?: number;
  /** 최대 딜레이 ms (기본값: 30000) */
  maxDelayMs?: number;
  /**
   * WebSocket 생성자 (테스트용 주입)
   * 기본값: 전역 WebSocket
   */
  WebSocketCtor?: WsConstructor;
  /**
   * sleep 함수 (테스트용 주입)
   * 기본값: setTimeout 기반 Promise
   */
  sleepFn?: (ms: number) => Promise<void>;
  /** 연결 성공 시 콜백 */
  onOpen?: () => void;
  /** 연결 종료 시 콜백 */
  onClose?: (code: number, reason: string) => void;
  /** 메시지 수신 시 콜백 */
  onMessage?: (data: string) => void;
  /** 에러 발생 시 콜백 */
  onError?: (err: unknown) => void;
  /** 재연결 시도 시 콜백 */
  onReconnect?: (attempt: number, delayMs: number) => void;
  /** maxRetries 초과로 재연결 포기 시 콜백 */
  onMaxRetriesExceeded?: () => void;
}

/** createWsReconnect 반환 핸들 */
export interface WsReconnectHandle {
  /** 연결된 상태에서 메시지 전송 (미연결 시 무시) */
  send: (data: string) => void;
  /** 수동 종료 — 재연결 없음 */
  close: () => void;
  /** 현재 상태 조회 */
  getState: () => WsState;
}

/**
 * 자동 재연결 WebSocket 팩토리
 *
 * @param options - 연결 설정 및 콜백
 * @returns send / close / getState 핸들
 */
export const createWsReconnect = (
  options: WsReconnectOptions,
): WsReconnectHandle => {
  const {
    url,
    maxRetries = Infinity,
    baseDelayMs = 1_000,
    maxDelayMs = 30_000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WebSocketCtor = (globalThis as any).WebSocket as WsConstructor,
    sleepFn = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    onOpen,
    onClose,
    onMessage,
    onError,
    onReconnect,
    onMaxRetriesExceeded,
  } = options;

  let state: WsState = 'connecting';
  let retryCount = 0;
  let ws: WsLike | null = null;
  let manualClose = false;

  const connect = (): void => {
    ws = new WebSocketCtor(url);
    state = 'connecting';

    ws.onopen = (): void => {
      state = 'open';
      retryCount = 0;
      onOpen?.();
    };

    ws.onclose = async (event): Promise<void> => {
      onClose?.(event.code, event.reason);

      if (manualClose) {
        return;
      }

      if (retryCount >= maxRetries) {
        state = 'closed';
        onMaxRetriesExceeded?.();
        return;
      }

      retryCount++;
      state = 'reconnecting';
      const delayMs = getRetryDelay(retryCount, baseDelayMs, maxDelayMs);
      onReconnect?.(retryCount, delayMs);

      await sleepFn(delayMs);

      if (!manualClose) {
        connect();
      }
    };

    ws.onmessage = (event): void => {
      onMessage?.(event.data);
    };

    ws.onerror = (err): void => {
      onError?.(err);
    };
  };

  connect();

  return {
    send: (data: string): void => {
      if (state === 'open' && ws !== null) {
        ws.send(data);
      }
    },

    close: (): void => {
      manualClose = true;
      state = 'closed';
      ws?.close(1000);
    },

    getState: (): WsState => state,
  };
};
