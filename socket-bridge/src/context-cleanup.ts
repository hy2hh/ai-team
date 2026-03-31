/**
 * 컨텍스트 정리 시스템 — 매일 자정 실행
 *
 * 4계층 메모리 구조:
 *   Core   (영구): facts/, tasks/active-*.md → 절대 삭제 안 함
 *   Warm   (7일):  tasks/active-*.md, 최근 decisions/ → 원본 유지
 *   Cool   (30일): decisions/ 30-90일 → 원본 유지 (Phase 2: LLM 압축 예정)
 *   Archive (90일+): decisions/ → .memory/archive/YYYY-MM/ 이동
 *
 * 삭제 대상:
 *   conversations/ — 7일+ 경과 (actionable outcome 미포함 시)
 *   handoff/       — 7일+ 경과
 */

import { readdir, stat, rename, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { MEMORY_DIR } from './db.js';

// ─── 설정 상수 ───────────────────────────────────────────

const envInt = (key: string, fallback: number): number => {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

/** decisions/ 파일을 아카이브로 이동하는 기준 (일) */
export const CLEANUP_ARCHIVE_AFTER_DAYS = envInt(
  'BRIDGE_CLEANUP_ARCHIVE_AFTER_DAYS',
  90,
);

/** conversations/ 파일을 삭제하는 기준 (일) */
export const CLEANUP_CONVERSATIONS_EXPIRE_DAYS = envInt(
  'BRIDGE_CLEANUP_CONVERSATIONS_EXPIRE_DAYS',
  7,
);

/** handoff/ 파일을 삭제하는 기준 (일) */
export const CLEANUP_HANDOFF_EXPIRE_DAYS = envInt(
  'BRIDGE_CLEANUP_HANDOFF_EXPIRE_DAYS',
  7,
);

/** 컨텍스트 정리 활성화 여부 */
export const CONTEXT_CLEANUP_ENABLED =
  process.env.BRIDGE_CONTEXT_CLEANUP_ENABLED !== '0';

// ─── 타입 ────────────────────────────────────────────────

export interface CleanupAction {
  type: 'archived' | 'deleted' | 'skipped';
  file: string;
  reason: string;
  ageInDays: number;
}

export interface CleanupResult {
  archivedCount: number;
  deletedCount: number;
  skippedCount: number;
  actions: CleanupAction[];
  durationMs: number;
  runAt: string;
}

// ─── 날짜 파싱 ───────────────────────────────────────────

/**
 * 파일명에서 날짜를 파싱한다.
 * 지원 형식: YYYY-MM-DD_*.md, YYYY-MM-DD-*.md
 * 파싱 실패 시 파일 mtime을 사용한다.
 */
const parseDateFromFilename = async (
  filePath: string,
): Promise<Date> => {
  const name = basename(filePath);
  const match = name.match(/^(\d{4}-\d{2}-\d{2})[_-]/);
  if (match) {
    const parsed = new Date(match[1]);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  // 파일명에서 파싱 실패 → mtime 사용
  const s = await stat(filePath);
  return s.mtime;
};

/**
 * 기준 날짜로부터 경과한 일수를 계산한다.
 */
const ageInDays = (date: Date): number => {
  const now = Date.now();
  return Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24));
};

// ─── 아카이브 이동 ────────────────────────────────────────

/**
 * 파일을 .memory/archive/YYYY-MM/ 디렉토리로 이동한다.
 */
const archiveFile = async (
  filePath: string,
  fileDate: Date,
): Promise<void> => {
  const yearMonth = `${fileDate.getFullYear()}-${String(fileDate.getMonth() + 1).padStart(2, '0')}`;
  const archiveDir = join(MEMORY_DIR, 'archive', yearMonth);

  if (!existsSync(archiveDir)) {
    await mkdir(archiveDir, { recursive: true });
  }

  const dest = join(archiveDir, basename(filePath));
  await rename(filePath, dest);
};

// ─── 디렉토리별 정리 로직 ─────────────────────────────────

/**
 * decisions/ 정리: ARCHIVE_AFTER_DAYS 초과 파일을 archive로 이동
 */
const cleanupDecisions = async (): Promise<CleanupAction[]> => {
  const dir = join(MEMORY_DIR, 'decisions');
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const actions: CleanupAction[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = join(dir, file);
    const fileDate = await parseDateFromFilename(filePath);
    const age = ageInDays(fileDate);

    if (age >= CLEANUP_ARCHIVE_AFTER_DAYS) {
      await archiveFile(filePath, fileDate);
      actions.push({
        type: 'archived',
        file: `decisions/${file}`,
        reason: `${age}일 경과 (기준: ${CLEANUP_ARCHIVE_AFTER_DAYS}일)`,
        ageInDays: age,
      });
    } else {
      actions.push({
        type: 'skipped',
        file: `decisions/${file}`,
        reason: `${age}일 경과 (보존 중)`,
        ageInDays: age,
      });
    }
  }

  return actions;
};

/**
 * conversations/ 정리: CONVERSATIONS_EXPIRE_DAYS 초과 파일 삭제
 * 단, 파일 내용에 "promoted" 태그가 있으면 보존
 */
const cleanupConversations = async (): Promise<CleanupAction[]> => {
  const dir = join(MEMORY_DIR, 'conversations');
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const actions: CleanupAction[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = join(dir, file);
    const fileDate = await parseDateFromFilename(filePath);
    const age = ageInDays(fileDate);

    if (age >= CLEANUP_CONVERSATIONS_EXPIRE_DAYS) {
      // "promoted" 태그 확인
      try {
        const content = await readFile(filePath, 'utf-8');
        if (content.includes('promoted:') || content.includes('<!-- promoted -->')) {
          actions.push({
            type: 'skipped',
            file: `conversations/${file}`,
            reason: `${age}일 경과지만 promoted 태그 있음 → 보존`,
            ageInDays: age,
          });
          continue;
        }
      } catch {
        // 읽기 실패 시 삭제 진행
      }

      await unlink(filePath);
      actions.push({
        type: 'deleted',
        file: `conversations/${file}`,
        reason: `${age}일 경과 (기준: ${CLEANUP_CONVERSATIONS_EXPIRE_DAYS}일)`,
        ageInDays: age,
      });
    } else {
      actions.push({
        type: 'skipped',
        file: `conversations/${file}`,
        reason: `${age}일 경과 (보존 중)`,
        ageInDays: age,
      });
    }
  }

  return actions;
};

/**
 * handoff/ 정리: HANDOFF_EXPIRE_DAYS 초과 파일 삭제
 * index.md는 보존
 */
const cleanupHandoffs = async (): Promise<CleanupAction[]> => {
  const dir = join(MEMORY_DIR, 'handoff');
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const actions: CleanupAction[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    if (file === 'index.md') continue; // 인덱스 파일은 보존

    const filePath = join(dir, file);
    const s = await stat(filePath);
    const age = ageInDays(s.mtime); // handoff는 mtime 기준

    if (age >= CLEANUP_HANDOFF_EXPIRE_DAYS) {
      await unlink(filePath);
      actions.push({
        type: 'deleted',
        file: `handoff/${file}`,
        reason: `${age}일 경과 (기준: ${CLEANUP_HANDOFF_EXPIRE_DAYS}일)`,
        ageInDays: age,
      });
    } else {
      actions.push({
        type: 'skipped',
        file: `handoff/${file}`,
        reason: `${age}일 경과 (보존 중)`,
        ageInDays: age,
      });
    }
  }

  return actions;
};

// ─── 메인 정리 실행 ───────────────────────────────────────

/**
 * 전체 컨텍스트 정리를 실행한다.
 * 각 디렉토리별 정리 후 결과를 집계하여 반환한다.
 */
export const runContextCleanup = async (): Promise<CleanupResult> => {
  const startMs = Date.now();
  const runAt = new Date().toISOString();

  console.log(`[context-cleanup] 정리 시작: ${runAt}`);

  if (!CONTEXT_CLEANUP_ENABLED) {
    console.log('[context-cleanup] 비활성화됨 (BRIDGE_CONTEXT_CLEANUP_ENABLED=0)');
    return {
      archivedCount: 0,
      deletedCount: 0,
      skippedCount: 0,
      actions: [],
      durationMs: Date.now() - startMs,
      runAt,
    };
  }

  const allActions: CleanupAction[] = [];

  try {
    const [decisionActions, convActions, handoffActions] = await Promise.all([
      cleanupDecisions(),
      cleanupConversations(),
      cleanupHandoffs(),
    ]);

    allActions.push(...decisionActions, ...convActions, ...handoffActions);
  } catch (err) {
    console.error('[context-cleanup] 정리 중 오류 발생:', err);
  }

  const archivedCount = allActions.filter((a) => a.type === 'archived').length;
  const deletedCount = allActions.filter((a) => a.type === 'deleted').length;
  const skippedCount = allActions.filter((a) => a.type === 'skipped').length;
  const durationMs = Date.now() - startMs;

  console.log(
    `[context-cleanup] 완료: 아카이브=${archivedCount}, 삭제=${deletedCount}, 유지=${skippedCount} (${durationMs}ms)`,
  );

  return { archivedCount, deletedCount, skippedCount, actions: allActions, durationMs, runAt };
};

// ─── 자정 스케줄러 ─────────────────────────────────────────

/**
 * 다음 자정까지 남은 밀리초를 계산한다.
 * 현재 시간이 자정과 정확히 같으면 24시간 후를 반환한다.
 */
export const msUntilMidnight = (): number => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // 오늘 자정 → 내일 00:00:00.000
  return midnight.getTime() - now.getTime();
};

/**
 * 매일 자정에 runContextCleanup을 실행하는 스케줄러를 시작한다.
 * onComplete 콜백을 통해 Slack 알림 등 외부 동작을 연결할 수 있다.
 *
 * @returns 스케줄러를 중단하는 cleanup 함수
 */
export const startContextCleanupScheduler = (
  onComplete?: (result: CleanupResult) => void,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout>;

  const schedule = () => {
    const ms = msUntilMidnight();
    const nextRun = new Date(Date.now() + ms).toISOString();
    console.log(
      `[context-cleanup] 다음 실행 예정: ${nextRun} (${Math.round(ms / 1000 / 60)}분 후)`,
    );

    timer = setTimeout(async () => {
      const result = await runContextCleanup();
      onComplete?.(result);
      schedule(); // 다음 날 자정 재예약
    }, ms);
  };

  schedule();

  return () => {
    clearTimeout(timer);
    console.log('[context-cleanup] 스케줄러 중단됨');
  };
};

// ─── Slack 보고 포맷 ──────────────────────────────────────

/**
 * CleanupResult를 Slack mrkdwn 포맷의 보고 텍스트로 변환한다.
 */
export const formatCleanupReport = (result: CleanupResult): string => {
  const { archivedCount, deletedCount, skippedCount, durationMs, runAt, actions } = result;

  if (archivedCount === 0 && deletedCount === 0) {
    return `*🗂️ 컨텍스트 정리 완료* (${new Date(runAt).toLocaleDateString('ko-KR')})\n정리할 파일 없음 — 모든 파일이 보존 기준 내에 있습니다. (${durationMs}ms)`;
  }

  const lines: string[] = [
    `*🗂️ 컨텍스트 정리 완료* (${new Date(runAt).toLocaleDateString('ko-KR')})`,
    `• 아카이브: *${archivedCount}개* | 삭제: *${deletedCount}개* | 유지: ${skippedCount}개 | ${durationMs}ms`,
  ];

  const archived = actions.filter((a) => a.type === 'archived');
  const deleted = actions.filter((a) => a.type === 'deleted');

  if (archived.length > 0) {
    lines.push('');
    lines.push('*📦 아카이브된 파일:*');
    for (const a of archived) {
      lines.push(`• \`${a.file}\` — ${a.reason}`);
    }
  }

  if (deleted.length > 0) {
    lines.push('');
    lines.push('*🗑️ 삭제된 파일:*');
    for (const a of deleted) {
      lines.push(`• \`${a.file}\` — ${a.reason}`);
    }
  }

  return lines.join('\n');
};
