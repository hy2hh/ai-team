import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

const PROJECT_DIR = join(import.meta.dirname, '..', '..');
const CLAIMS_DIR = join(PROJECT_DIR, '.memory', 'claims');

/** Claim 만료 시간 (24시간) */
const CLAIM_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** 오펀 claim 임계값 (2시간 이상 processing 상태 유지 시 고착으로 판단) */
const ORPHAN_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/** Claim 상태 */
type ClaimStatus = 'processing' | 'completed' | 'failed';

/** Claim 파일 내용 */
interface ClaimData {
  agent: string;
  status: ClaimStatus;
  timestamp: string;
  messageTs: string;
  /** 처리 시도 버전 (재큐잉 시 증가, 최초 = 1) */
  version: number;
  /** 알림 발송용 채널 ID */
  channel?: string;
}

/** 오펀 claim 정보 */
export interface OrphanClaimInfo {
  messageTs: string;
  agent: string;
  timestamp: string;
  channel?: string;
  ageMs: number;
  /** 현재 처리 시도 버전 (재큐잉 한도 판단용) */
  version: number;
}

/** 오펀 claim 최대 재큐잉 시도 횟수 */
export const MAX_REQUEUE_ATTEMPTS = 2;

/**
 * claims 디렉토리 확보
 */
const ensureClaimsDir = (): void => {
  if (!existsSync(CLAIMS_DIR)) {
    mkdirSync(CLAIMS_DIR, { recursive: true });
  }
};

/** 메시지 ts를 파일명으로 변환 */
const tsToFilename = (ts: string): string =>
  `${ts.replace('.', '-')}.md`;

/**
 * 메시지에 대한 claim 획득 시도
 * @param messageTs - Slack 메시지 타임스탬프
 * @param agentName - 처리할 에이전트 이름
 * @param channel - Slack 채널 ID (오펀 알림용, 선택)
 * @returns true면 claim 획득 성공, false면 이미 다른 에이전트가 처리 중
 */
export const tryClaim = (
  messageTs: string,
  agentName: string,
  channel?: string,
): boolean => {
  ensureClaimsDir();

  const filePath = join(CLAIMS_DIR, tsToFilename(messageTs));

  // wx 플래그가 원자적으로 중복 방지하므로 existsSync 불필요
  const data: ClaimData = {
    agent: agentName,
    status: 'processing',
    timestamp: new Date().toISOString(),
    messageTs,
    version: 1,
    channel,
  };

  const lines = [
    `# Claim: ${messageTs}`,
    `Agent: ${data.agent}`,
    `Status: ${data.status}`,
    `Version: ${data.version}`,
    `Timestamp: ${data.timestamp}`,
  ];
  if (data.channel) {
    lines.push(`Channel: ${data.channel}`);
  }
  const content = lines.join('\n');

  try {
    writeFileSync(filePath, content, { flag: 'wx' });
    return true;
  } catch {
    // 동시 쓰기 경합 시 wx 플래그가 EEXIST 에러 발생
    return false;
  }
};

/**
 * Claim 상태 업데이트
 * @param messageTs - Slack 메시지 타임스탬프
 * @param status - 새 상태
 */
export const updateClaim = (
  messageTs: string,
  status: ClaimStatus,
): void => {
  const filePath = join(CLAIMS_DIR, tsToFilename(messageTs));

  if (!existsSync(filePath)) {
    return;
  }

  try {
    const existing = readFileSync(filePath, 'utf-8');
    const updated = existing.replace(
      /Status: \w+/,
      `Status: ${status}`,
    );
    writeFileSync(filePath, updated, 'utf-8');
  } catch (err) {
    console.error(`[claim] 상태 업데이트 실패: ${messageTs}`, err);
  }
};

/**
 * 만료된 claim 파일 정리 (completed/failed + 24시간 경과)
 * @returns 삭제된 파일 수
 */
export const cleanupExpiredClaims = (): number => {
  ensureClaimsDir();

  let cleaned = 0;
  const now = Date.now();

  try {
    const files = readdirSync(CLAIMS_DIR).filter((f) =>
      f.endsWith('.md'),
    );

    for (const file of files) {
      const filePath = join(CLAIMS_DIR, file);
      try {
        const content = readFileSync(filePath, 'utf-8');

        // processing 상태는 건너뜀
        if (content.includes('Status: processing')) {
          continue;
        }

        // Timestamp 파싱
        const tsMatch = content.match(
          /Timestamp: (.+)/,
        );
        if (!tsMatch) {
          continue;
        }

        const fileTime = new Date(tsMatch[1]).getTime();
        if (Number.isNaN(fileTime)) {
          continue;
        }
        if (now - fileTime > CLAIM_EXPIRY_MS) {
          unlinkSync(filePath);
          cleaned += 1;
        }
      } catch {
        // 개별 파일 처리 실패는 무시
      }
    }
  } catch (err) {
    console.error('[claim] cleanup 실패:', err);
  }

  if (cleaned > 0) {
    console.log(`[claim] ${cleaned}개 만료 claim 정리 완료`);
  }

  return cleaned;
};

/**
 * 오펀 claim 감지 및 복구
 * processing 상태가 ORPHAN_THRESHOLD_MS(2h) 이상 지속된 claim을 failed로 전환
 * @returns 발견된 오펀 claim 목록 (Slack 알림용)
 */
export const cleanupOrphanClaims = (): OrphanClaimInfo[] => {
  ensureClaimsDir();

  const orphans: OrphanClaimInfo[] = [];
  const now = Date.now();

  try {
    const files = readdirSync(CLAIMS_DIR).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = join(CLAIMS_DIR, file);
      try {
        const content = readFileSync(filePath, 'utf-8');

        // processing 상태인 파일만 검사
        if (!content.includes('Status: processing')) {
          continue;
        }

        const tsMatch = content.match(/Timestamp: (.+)/);
        if (!tsMatch) {
          continue;
        }

        const fileTime = new Date(tsMatch[1].trim()).getTime();
        if (Number.isNaN(fileTime)) {
          continue;
        }

        const ageMs = now - fileTime;
        if (ageMs < ORPHAN_THRESHOLD_MS) {
          continue;
        }

        // 2시간 이상 processing 상태 → 오펀으로 판단
        const agentMatch = content.match(/Agent: (.+)/);
        const tsValMatch = content.match(/# Claim: (.+)/);
        const channelMatch = content.match(/Channel: (.+)/);

        const versionMatch = content.match(/Version: (\d+)/);
        const version = versionMatch
          ? parseInt(versionMatch[1], 10)
          : 1;

        const orphan: OrphanClaimInfo = {
          messageTs: tsValMatch?.[1]?.trim() ?? file.replace('.md', '').replace('-', '.'),
          agent: agentMatch?.[1]?.trim() ?? 'unknown',
          timestamp: tsMatch[1].trim(),
          channel: channelMatch?.[1]?.trim(),
          ageMs,
          version,
        };

        orphans.push(orphan);

        // failed로 마킹 (파일 삭제 대신 — 디버깅 추적 가능)
        const updated = content.replace(/Status: processing/, 'Status: failed');
        writeFileSync(filePath, updated, 'utf-8');

        console.warn(
          `[claim] 오펀 감지 → failed: ${orphan.messageTs} (agent=${orphan.agent}, age=${Math.round(ageMs / 60000)}min)`,
        );
      } catch {
        // 개별 파일 처리 실패는 무시
      }
    }
  } catch (err) {
    console.error('[claim] 오펀 cleanup 실패:', err);
  }

  if (orphans.length > 0) {
    console.warn(`[claim] ${orphans.length}개 오펀 claim 복구 완료`);
  }

  return orphans;
};

/**
 * 오펀 claim을 재큐잉용으로 초기화
 * 현재 버전이 MAX_REQUEUE_ATTEMPTS 미만인 경우에만 재큐잉 허용.
 * 기존 실패 파일을 삭제하고 버전을 올린 새 processing claim을 생성.
 *
 * @param messageTs - 재큐잉할 메시지 ts
 * @param channel - 알림 채널 ID (기존 파일에서 가져오는 것으로 폴백)
 * @returns 새 버전 번호, 한도 초과 또는 오류 시 null
 */
export const requeueClaim = (
  messageTs: string,
  channel?: string,
): number | null => {
  const filePath = join(CLAIMS_DIR, tsToFilename(messageTs));

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const versionMatch = content.match(/Version: (\d+)/);
    const currentVersion = versionMatch
      ? parseInt(versionMatch[1], 10)
      : 1;

    if (currentVersion >= MAX_REQUEUE_ATTEMPTS) {
      console.warn(
        `[claim] 재큐잉 한도 초과: ${messageTs} (v${currentVersion}/${MAX_REQUEUE_ATTEMPTS})`,
      );
      return null;
    }

    const newVersion = currentVersion + 1;
    const agentMatch = content.match(/Agent: (.+)/);
    const agent = agentMatch?.[1]?.trim() ?? 'bridge';
    const channelToUse =
      channel ?? content.match(/Channel: (.+)/)?.[1]?.trim();

    // 기존 실패 파일 삭제 후 새 버전으로 재생성
    unlinkSync(filePath);

    const lines = [
      `# Claim: ${messageTs}`,
      `Agent: ${agent}`,
      `Status: processing`,
      `Version: ${newVersion}`,
      `Timestamp: ${new Date().toISOString()}`,
    ];
    if (channelToUse) {
      lines.push(`Channel: ${channelToUse}`);
    }

    writeFileSync(filePath, lines.join('\n'), { flag: 'wx' });

    console.log(
      `[claim] 재큐잉 완료: ${messageTs} v${currentVersion} → v${newVersion}`,
    );
    return newVersion;
  } catch (err) {
    console.error(`[claim] 재큐잉 실패: ${messageTs}`, err);
    return null;
  }
};
