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

/** Claim 상태 */
type ClaimStatus = 'processing' | 'completed' | 'failed';

/** Claim 파일 내용 */
interface ClaimData {
  agent: string;
  status: ClaimStatus;
  timestamp: string;
  messageTs: string;
}

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
 * @returns true면 claim 획득 성공, false면 이미 다른 에이전트가 처리 중
 */
export const tryClaim = (
  messageTs: string,
  agentName: string,
): boolean => {
  ensureClaimsDir();

  const filePath = join(CLAIMS_DIR, tsToFilename(messageTs));

  // wx 플래그가 원자적으로 중복 방지하므로 existsSync 불필요
  const data: ClaimData = {
    agent: agentName,
    status: 'processing',
    timestamp: new Date().toISOString(),
    messageTs,
  };

  const content = [
    `# Claim: ${messageTs}`,
    `Agent: ${data.agent}`,
    `Status: ${data.status}`,
    `Timestamp: ${data.timestamp}`,
  ].join('\n');

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
