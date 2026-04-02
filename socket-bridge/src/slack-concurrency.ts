/**
 * Slack API 동시성 분류 및 배치 실행
 *
 * Claude Code의 Tool Orchestration 패턴을 참고:
 * - Read-only 호출은 병렬 실행 (conversations.info, users.info 등)
 * - Write 호출은 직렬 실행 (chat.postMessage, reactions.add 등)
 * - 자동 분류 + 배치 실행 헬퍼
 */
import { acquireSlot } from './rate-limiter.js';

/** Slack API 메서드 동시성 분류 */
type ConcurrencyClass = 'read' | 'write';

/**
 * Slack API 메서드별 동시성 안전 분류 테이블
 *
 * - read: 상태를 변경하지 않으므로 병렬 실행 안전
 * - write: 상태를 변경하므로 직렬 실행 필요
 *
 * 테이블에 없는 메서드는 안전하게 write로 분류
 */
const METHOD_CONCURRENCY: Record<string, ConcurrencyClass> = {
  // ─── Read-safe (병렬 가능) ──────────────────────
  'conversations.info': 'read',
  'conversations.history': 'read',
  'conversations.replies': 'read',
  'conversations.list': 'read',
  'conversations.members': 'read',
  'users.info': 'read',
  'users.list': 'read',
  'users.profile.get': 'read',
  'channels.info': 'read',
  'channels.list': 'read',
  'channels.history': 'read',
  'chat.getPermalink': 'read',
  'files.info': 'read',
  'team.info': 'read',
  'auth.test': 'read',
  'bots.info': 'read',
  'emoji.list': 'read',

  // ─── Write (직렬 실행) ──────────────────────────
  'chat.postMessage': 'write',
  'chat.update': 'write',
  'chat.delete': 'write',
  'reactions.add': 'write',
  'reactions.remove': 'write',
  'files.upload': 'write',
  'files.delete': 'write',
  'conversations.create': 'write',
  'conversations.invite': 'write',
  'conversations.kick': 'write',
  'conversations.join': 'write',
  'conversations.leave': 'write',
  'conversations.archive': 'write',
  'conversations.unarchive': 'write',
  'conversations.setPurpose': 'write',
  'conversations.setTopic': 'write',
  'pins.add': 'write',
  'pins.remove': 'write',
  'bookmarks.add': 'write',
  'bookmarks.remove': 'write',
};

/**
 * Slack API 메서드의 동시성 안전 여부 판별
 *
 * @param method - Slack API 메서드 이름 (e.g., 'conversations.info')
 * @returns true면 병렬 실행 안전
 */
export const isConcurrencySafe = (method: string): boolean =>
  METHOD_CONCURRENCY[method] === 'read';

/**
 * 동시성 분류 조회
 *
 * @param method - Slack API 메서드 이름
 * @returns 'read' 또는 'write'
 */
export const getMethodClass = (
  method: string,
): ConcurrencyClass =>
  METHOD_CONCURRENCY[method] ?? 'write';

/** 배치 실행 작업 단위 */
export interface BatchTask<T> {
  /** Slack API 메서드 이름 */
  method: string;
  /** 실행 함수 */
  execute: () => Promise<T>;
}

/** 배치 파티션 (동일 concurrency class끼리 그룹핑) */
interface Partition<T> {
  concurrencyClass: ConcurrencyClass;
  tasks: BatchTask<T>[];
}

/**
 * 작업 목록을 동시성 기준으로 파티셔닝
 *
 * 연속된 read 작업은 하나의 배치로, write 작업은 개별 배치로 분리.
 * Claude Code의 partitionToolCalls 패턴과 동일.
 *
 * @param tasks - 실행할 작업 목록
 * @returns 파티셔닝된 배치 배열
 */
export const partitionTasks = <T>(
  tasks: BatchTask<T>[],
): Partition<T>[] => {
  if (tasks.length === 0) {
    return [];
  }

  const partitions: Partition<T>[] = [];
  let current: Partition<T> | null = null;

  for (const task of tasks) {
    const cls = getMethodClass(task.method);

    if (!current || current.concurrencyClass !== cls || cls === 'write') {
      // write는 항상 새 파티션 (1개씩 직렬)
      // read는 연속되면 같은 파티션에 합침
      current = { concurrencyClass: cls, tasks: [task] };
      partitions.push(current);
    } else {
      // read 연속 → 같은 배치에 추가
      current.tasks.push(task);
    }
  }

  return partitions;
};

/** 최대 동시 실행 수 (read 배치) */
const MAX_CONCURRENCY = 5;

/**
 * 파티셔닝된 작업 배치 실행
 *
 * - read 배치: MAX_CONCURRENCY 제한 내 병렬 실행
 * - write 배치: 순서대로 직렬 실행
 * - 모든 호출에 rate limiter 슬롯 획득 적용
 *
 * @param tasks - 실행할 작업 목록
 * @returns 실행 결과 배열 (입력 순서 보장)
 */
export const executeBatch = async <T>(
  tasks: BatchTask<T>[],
): Promise<Array<{ result?: T; error?: unknown }>> => {
  const results: Array<{ result?: T; error?: unknown }> = new Array(
    tasks.length,
  );
  let globalIdx = 0;

  const partitions = partitionTasks(tasks);

  for (const partition of partitions) {
    if (partition.concurrencyClass === 'read') {
      // 병렬 실행 (MAX_CONCURRENCY 제한)
      const indices = partition.tasks.map(() => globalIdx++);
      const chunks = chunkArray(partition.tasks, MAX_CONCURRENCY);
      let chunkOffset = 0;

      for (const chunk of chunks) {
        const settled = await Promise.allSettled(
          chunk.map(async (task) => {
            await acquireSlot();
            return task.execute();
          }),
        );

        for (let i = 0; i < settled.length; i++) {
          const idx = indices[chunkOffset + i];
          const outcome = settled[i];
          if (outcome.status === 'fulfilled') {
            results[idx] = { result: outcome.value };
          } else {
            results[idx] = { error: outcome.reason };
          }
        }
        chunkOffset += chunk.length;
      }
    } else {
      // 직렬 실행
      for (const task of partition.tasks) {
        const idx = globalIdx++;
        try {
          await acquireSlot();
          const result = await task.execute();
          results[idx] = { result };
        } catch (error) {
          results[idx] = { error };
        }
      }
    }
  }

  return results;
};

/**
 * 배열을 지정 크기로 분할
 *
 * @param arr - 원본 배열
 * @param size - 청크 크기
 * @returns 분할된 배열의 배열
 */
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};
