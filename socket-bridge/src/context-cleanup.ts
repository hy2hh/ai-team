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
 *
 * 구조적 감사 대상 (삭제 없음, Slack 경고만):
 *   decisions/, docs/specs/ — frontmatter 5필드 누락
 *   .memory/ 서브디렉토리   — _index.md / index.md 50줄 초과
 *   decisions/              — _index.md 미등록 파일
 *   auto-memory MEMORY.md   — 행 150자 초과
 */

import {
  readdir,
  stat,
  rename,
  unlink,
  mkdir,
  readFile,
  writeFile,
} from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { MEMORY_DIR } from './db.js';

// ─── 설정 상수 ───────────────────────────────────────────

const envInt = (key: string, fallback: number): number => {
  const val = process.env[key];
  if (val === undefined) { return fallback; }
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

/** _index.md / index.md 최대 허용 줄 수 (token-optimized-docs 규칙) */
export const INDEX_MAX_LINES = 50;

/** auto-memory MEMORY.md 행 최대 허용 길이 (token-optimized-docs 규칙) */
export const MEMORY_LINE_MAX_CHARS = 150;

/** 컨텍스트 정리 활성화 여부 */
export const CONTEXT_CLEANUP_ENABLED =
  process.env.BRIDGE_CONTEXT_CLEANUP_ENABLED !== '0';

// ─── 경로 상수 ───────────────────────────────────────────

/** 프로젝트 루트 (.memory/ 의 부모) */
const PROJECT_ROOT = join(MEMORY_DIR, '..');

/**
 * auto-memory MEMORY.md 경로.
 * MEMORY_DIR(/path/to/project/.memory)에서 프로젝트 ID를 파생.
 * 환경변수 BRIDGE_AUTO_MEMORY_PATH로 오버라이드 가능.
 */
const AUTO_MEMORY_PATH = (() => {
  if (process.env.BRIDGE_AUTO_MEMORY_PATH) {
    return process.env.BRIDGE_AUTO_MEMORY_PATH;
  }
  // /Users/foo/git/project → -Users-foo-git-project
  const projectId = PROJECT_ROOT.replace(/\//g, '-');
  return join(
    process.env.HOME ?? '',
    '.claude',
    'projects',
    projectId,
    'memory',
    'MEMORY.md',
  );
})();

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
  /**
   * 구조적 규칙 위반 항목 목록 (삭제 없음, Slack 경고만).
   * frontmatter 누락 / index 줄 수 초과 / index 미등록 / MEMORY.md 행 길이 초과 포함.
   */
  structuralWarnings: string[];
  durationMs: number;
  runAt: string;
}

// ─── 날짜 파싱 ───────────────────────────────────────────

/**
 * 파일명에서 날짜를 파싱한다.
 * 지원 형식: YYYY-MM-DD_*.md, YYYY-MM-DD-*.md
 * 파싱 실패 시 파일 mtime을 사용한다.
 */
const parseDateFromFilename = async (filePath: string): Promise<Date> => {
  const name = basename(filePath);
  const match = name.match(/^(\d{4}-\d{2}-\d{2})[_-]/);
  if (match) {
    const parsed = new Date(match[1]);
    if (!isNaN(parsed.getTime())) { return parsed; }
  }
  const s = await stat(filePath);
  return s.mtime;
};

/** 기준 날짜로부터 경과한 일수를 계산한다. */
const ageInDays = (date: Date): number => {
  const now = Date.now();
  return Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24));
};

// ─── 아카이브 이동 ────────────────────────────────────────

/** 파일을 .memory/archive/YYYY-MM/ 디렉토리로 이동한다. */
const archiveFile = async (filePath: string, fileDate: Date): Promise<void> => {
  const yearMonth = `${fileDate.getFullYear()}-${String(fileDate.getMonth() + 1).padStart(2, '0')}`;
  const archiveDir = join(MEMORY_DIR, 'archive', yearMonth);

  if (!existsSync(archiveDir)) {
    await mkdir(archiveDir, { recursive: true });
  }

  const dest = join(archiveDir, basename(filePath));
  await rename(filePath, dest);
};

// ─── 디렉토리별 정리 로직 ─────────────────────────────────

/** decisions/ 정리: ARCHIVE_AFTER_DAYS 초과 파일을 archive로 이동 */
const cleanupDecisions = async (): Promise<CleanupAction[]> => {
  const dir = join(MEMORY_DIR, 'decisions');
  if (!existsSync(dir)) { return []; }

  const files = await readdir(dir);
  const actions: CleanupAction[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) { continue; }

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
  if (!existsSync(dir)) { return []; }

  const files = await readdir(dir);
  const actions: CleanupAction[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) { continue; }

    const filePath = join(dir, file);
    const fileDate = await parseDateFromFilename(filePath);
    const age = ageInDays(fileDate);

    if (age >= CLEANUP_CONVERSATIONS_EXPIRE_DAYS) {
      try {
        const content = await readFile(filePath, 'utf-8');
        if (
          content.includes('promoted:') ||
          content.includes('<!-- promoted -->')
        ) {
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

/** handoff/index.md에서 특정 파일명이 포함된 행을 제거한다. */
const removeFromHandoffIndex = async (filename: string): Promise<void> => {
  const indexPath = join(MEMORY_DIR, 'handoff', 'index.md');
  try {
    const content = await readFile(indexPath, 'utf-8');
    const updated = content
      .split('\n')
      .filter((line) => !line.includes(`\`${filename}\``))
      .join('\n');
    await writeFile(indexPath, updated, 'utf-8');
  } catch {
    // index.md 없으면 무시
  }
};

/**
 * handoff/ 정리: HANDOFF_EXPIRE_DAYS 초과 파일 삭제 + index.md 자동 갱신
 * index.md는 보존
 */
const cleanupHandoffs = async (): Promise<CleanupAction[]> => {
  const dir = join(MEMORY_DIR, 'handoff');
  if (!existsSync(dir)) { return []; }

  const files = await readdir(dir);
  const actions: CleanupAction[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) { continue; }
    if (file === 'index.md') { continue; }

    const filePath = join(dir, file);
    const s = await stat(filePath);
    const age = ageInDays(s.mtime);

    if (age >= CLEANUP_HANDOFF_EXPIRE_DAYS) {
      await unlink(filePath);
      await removeFromHandoffIndex(file);
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

// ─── 구조적 감사 ──────────────────────────────────────────

/** frontmatter 필수 5필드 */
const REQUIRED_FM_FIELDS = ['date:', 'topic:', 'roles:', 'summary:', 'status:'];

/**
 * 지정된 디렉토리에서 frontmatter 5필드가 누락된 .md 파일 목록을 반환한다.
 * _index.md / index.md / README.md는 제외.
 */
const auditFrontmatter = async (
  dir: string,
  prefix: string,
): Promise<string[]> => {
  if (!existsSync(dir)) { return []; }

  const files = await readdir(dir);
  const warnings: string[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) { continue; }
    if (['_index.md', 'index.md', 'README.md'].includes(file)) { continue; }

    const filePath = join(dir, file);
    try {
      const content = await readFile(filePath, 'utf-8');
      if (!content.startsWith('---')) {
        warnings.push(`${prefix}/${file} (frontmatter 없음)`);
        continue;
      }
      const fmEnd = content.indexOf('---', 3);
      if (fmEnd === -1) {
        warnings.push(`${prefix}/${file} (frontmatter 종료 태그 없음)`);
        continue;
      }
      const fm = content.slice(0, fmEnd);
      const missing = REQUIRED_FM_FIELDS.filter((f) => !fm.includes(f));
      if (missing.length > 0) {
        warnings.push(`${prefix}/${file} (frontmatter 누락: ${missing.join(', ')})`);
      }
    } catch {
      // 읽기 실패 무시
    }
  }

  return warnings;
};

/**
 * .memory/ 서브디렉토리 내 _index.md / index.md 파일이 INDEX_MAX_LINES를 초과하는지 감사.
 * archive / done / claims / heartbeats / logs 는 제외.
 */
const auditIndexSizes = async (): Promise<string[]> => {
  if (!existsSync(MEMORY_DIR)) { return []; }

  const SKIP_DIRS = new Set(['archive', 'done', 'claims', 'heartbeats', 'logs']);
  const warnings: string[] = [];

  const entries = await readdir(MEMORY_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) { continue; }
    if (SKIP_DIRS.has(entry.name)) { continue; }

    const subDir = join(MEMORY_DIR, entry.name);

    for (const indexName of ['_index.md', 'index.md']) {
      const indexPath = join(subDir, indexName);
      if (!existsSync(indexPath)) { continue; }

      try {
        const content = await readFile(indexPath, 'utf-8');
        const lines = content.split('\n');
        // 후행 빈 줄 제외
        const lineCount =
          lines.at(-1) === '' ? lines.length - 1 : lines.length;
        if (lineCount > INDEX_MAX_LINES) {
          warnings.push(
            `.memory/${entry.name}/${indexName} (${lineCount}줄 > ${INDEX_MAX_LINES}줄 한도)`,
          );
        }
      } catch {
        // 읽기 실패 무시
      }
    }
  }

  return warnings;
};

/**
 * decisions/ 폴더의 각 .md 파일이 _index.md 테이블에 등록되어 있는지 감사.
 * 파일명 앞 25자를 키로 사용 (긴 한국어 파일명의 truncation 대응).
 */
const auditDecisionIndexSync = async (): Promise<string[]> => {
  const decisionsDir = join(MEMORY_DIR, 'decisions');
  const indexPath = join(decisionsDir, '_index.md');

  if (!existsSync(decisionsDir) || !existsSync(indexPath)) { return []; }

  const [files, indexContent] = await Promise.all([
    readdir(decisionsDir),
    readFile(indexPath, 'utf-8'),
  ]);

  const warnings: string[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) { continue; }
    if (['_index.md', 'index.md', 'README.md'].includes(file)) { continue; }

    // 파일명 앞 25자가 인덱스에 포함되는지 확인 (한국어 truncation 대응)
    const key = file.replace(/\.md$/, '').slice(0, 25);
    if (!indexContent.includes(key)) {
      warnings.push(`.memory/decisions/${file} (_index.md 미등록)`);
    }
  }

  return warnings;
};

/**
 * auto-memory MEMORY.md 각 행의 길이가 MEMORY_LINE_MAX_CHARS를 초과하는지 감사.
 * frontmatter / 제목 / 빈 줄은 제외.
 */
const auditMemoryMd = async (): Promise<string[]> => {
  if (!existsSync(AUTO_MEMORY_PATH)) { return []; }

  try {
    const content = await readFile(AUTO_MEMORY_PATH, 'utf-8');
    const lines = content.split('\n');
    const warnings: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') { continue; }
      if (line.startsWith('#')) { continue; } // 헤딩 제외
      if (line.length > MEMORY_LINE_MAX_CHARS) {
        warnings.push(
          `MEMORY.md L${i + 1} (${line.length}자 > ${MEMORY_LINE_MAX_CHARS}자 한도): ${line.slice(0, 60)}…`,
        );
      }
    }

    return warnings;
  } catch {
    return [];
  }
};

// ─── 메인 정리 실행 ───────────────────────────────────────

/**
 * 전체 컨텍스트 정리를 실행한다.
 * 각 디렉토리별 정리 + 구조적 감사 후 결과를 집계하여 반환한다.
 */
export const runContextCleanup = async (): Promise<CleanupResult> => {
  const startMs = Date.now();
  const runAt = new Date().toISOString();

  console.log(`[context-cleanup] 정리 시작: ${runAt}`);

  if (!CONTEXT_CLEANUP_ENABLED) {
    console.log(
      '[context-cleanup] 비활성화됨 (BRIDGE_CONTEXT_CLEANUP_ENABLED=0)',
    );
    return {
      archivedCount: 0,
      deletedCount: 0,
      skippedCount: 0,
      actions: [],
      structuralWarnings: [],
      durationMs: Date.now() - startMs,
      runAt,
    };
  }

  const allActions: CleanupAction[] = [];
  let structuralWarnings: string[] = [];

  try {
    const [
      decisionActions,
      convActions,
      handoffActions,
      fmDecisions,
      fmSpecs,
      indexSizeWarnings,
      decisionSyncWarnings,
      memoryMdWarnings,
    ] = await Promise.all([
      cleanupDecisions(),
      cleanupConversations(),
      cleanupHandoffs(),
      auditFrontmatter(
        join(MEMORY_DIR, 'decisions'),
        '.memory/decisions',
      ),
      auditFrontmatter(
        join(PROJECT_ROOT, 'docs', 'specs'),
        'docs/specs',
      ),
      auditIndexSizes(),
      auditDecisionIndexSync(),
      auditMemoryMd(),
    ]);

    allActions.push(...decisionActions, ...convActions, ...handoffActions);
    structuralWarnings = [
      ...fmDecisions,
      ...fmSpecs,
      ...indexSizeWarnings,
      ...decisionSyncWarnings,
      ...memoryMdWarnings,
    ];
  } catch (err) {
    console.error('[context-cleanup] 정리 중 오류 발생:', err);
  }

  const archivedCount = allActions.filter((a) => a.type === 'archived').length;
  const deletedCount = allActions.filter((a) => a.type === 'deleted').length;
  const skippedCount = allActions.filter((a) => a.type === 'skipped').length;
  const durationMs = Date.now() - startMs;

  console.log(
    `[context-cleanup] 완료: 아카이브=${archivedCount}, 삭제=${deletedCount}, 유지=${skippedCount}, 구조경고=${structuralWarnings.length} (${durationMs}ms)`,
  );

  return {
    archivedCount,
    deletedCount,
    skippedCount,
    actions: allActions,
    structuralWarnings,
    durationMs,
    runAt,
  };
};

// ─── 자정 스케줄러 ─────────────────────────────────────────

/**
 * 다음 자정까지 남은 밀리초를 계산한다.
 * 현재 시간이 자정과 정확히 같으면 24시간 후를 반환한다.
 */
export const msUntilMidnight = (): number => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
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
      schedule();
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
  const { archivedCount, deletedCount, skippedCount, durationMs, runAt, actions, structuralWarnings } =
    result;

  const dateStr = new Date(runAt).toLocaleDateString('ko-KR');
  const lines: string[] = [];

  if (archivedCount === 0 && deletedCount === 0 && structuralWarnings.length === 0) {
    return `*🗂️ 컨텍스트 정리 완료* (${dateStr})\n정리할 파일 없음 — 모든 파일이 보존 기준 내에 있습니다. (${durationMs}ms)`;
  }

  lines.push(`*🗂️ 컨텍스트 정리 완료* (${dateStr})`);
  lines.push(
    `• 아카이브: *${archivedCount}개* | 삭제: *${deletedCount}개* | 유지: ${skippedCount}개 | ${durationMs}ms`,
  );

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

  if (structuralWarnings.length > 0) {
    lines.push('');
    lines.push(`*⚠️ 구조 규칙 위반 (${structuralWarnings.length}건):*`);
    for (const w of structuralWarnings) {
      lines.push(`• ${w}`);
    }
  }

  return lines.join('\n');
};
