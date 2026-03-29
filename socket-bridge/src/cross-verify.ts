/**
 * Cross-Verification Module
 *
 * 에이전트 작업 완료 후 자동으로 다른 에이전트가 검증한다.
 * 생산자-검증자 매트릭스에 따라 검증 대상을 결정하고,
 * 결과에 따라 PASS/WARN/FAIL을 반환한다.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { App } from '@slack/bolt';
import { getDb } from './db.js';
import { handleMessage } from './agent-runtime.js';
import type { SlackEvent } from './types.js';
import { rateLimited } from './rate-limiter.js';

/** 프로젝트 루트 (socket-bridge의 부모) */
const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');

/** 파일당 최대 문자 수 */
const MAX_CHARS_PER_FILE = 3000;

/** 전체 주입 최대 문자 수 */
const MAX_TOTAL_CHARS = 15000;

/** 허용 확장자 (텍스트 파일만) */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.md', '.json', '.js', '.mjs', '.css', '.html',
]);

/**
 * git 워킹 트리의 변경 파일 목록 스냅샷
 * @returns 변경된 파일 경로 Set
 */
export const snapshotChangedFiles = (): Set<string> => {
  try {
    const output = execSync('git diff --name-only && git diff --name-only --cached', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return new Set(output.trim().split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
};

/**
 * 두 스냅샷 차이에서 새로 변경된 파일 목록 추출
 * @param before - 에이전트 실행 전 스냅샷
 * @param after - 에이전트 실행 후 스냅샷
 * @returns 새로 변경된 파일 경로 배열
 */
export const diffSnapshots = (
  before: Set<string>,
  after: Set<string>,
): string[] =>
  [...after].filter((f) => !before.has(f));

/**
 * 변경 파일 내용을 읽어 문자열로 조합
 * @param changedFiles - 변경된 파일 경로 배열
 * @returns 주입용 텍스트 (파일별 내용 포함)
 */
export const readChangedFileContents = (changedFiles: string[]): string => {
  if (changedFiles.length === 0) {
    return '';
  }

  const textFiles = changedFiles.filter((f) => {
    const ext = f.slice(f.lastIndexOf('.'));
    return TEXT_EXTENSIONS.has(ext);
  });

  const sections: string[] = [];
  let totalChars = 0;

  for (const filePath of textFiles) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      sections.push(`\n... (${textFiles.length - sections.length}개 파일 생략, 총 용량 초과)`);
      break;
    }

    try {
      const absPath = resolve(PROJECT_ROOT, filePath);
      let content = readFileSync(absPath, 'utf-8');
      if (content.length > MAX_CHARS_PER_FILE) {
        content = content.slice(0, MAX_CHARS_PER_FILE) + '\n... (잘림)';
      }
      sections.push(`### \`${filePath}\`\n\`\`\`\n${content}\n\`\`\``);
      totalChars += content.length;
    } catch {
      sections.push(`### \`${filePath}\`\n(읽기 실패)`);
    }
  }

  return sections.join('\n\n');
};

/** 검증 결과 등급 */
export type VerifyResult = 'PASS' | 'WARN' | 'FAIL';

/** 검증 매트릭스: 생산자 → 검증자 + 체크 항목 */
const VERIFY_MATRIX: Record<
  string,
  Array<{ verifier: string; checkItems: string }>
> = {
  backend: [
    {
      verifier: 'frontend',
      checkItems: 'API 계약 호환성: 엔드포인트 URL, 요청/응답 스키마, 에러 코드가 프론트엔드 기대와 일치하는지 확인',
    },
    {
      verifier: 'secops',
      checkItems: '보안 검토: 인증/인가, 입력 검증, SQL 인젝션 방지, 민감 데이터 노출 확인',
    },
  ],
  frontend: [
    {
      verifier: 'designer',
      checkItems: '디자인 일치: 컴포넌트가 디자인 스펙(색상, 간격, 타이포그래피, 반응형)과 일치하는지 확인',
    },
    {
      verifier: 'backend',
      checkItems: 'API 통합: 프론트엔드가 호출하는 API 엔드포인트, 파라미터, 에러 처리가 백엔드 구현과 일치하는지 확인',
    },
  ],
  designer: [
    {
      verifier: 'frontend',
      checkItems: '구현 가능성: 디자인 스펙이 현재 기술 스택으로 구현 가능한지, 성능 이슈가 없는지 확인',
    },
  ],
};

/**
 * 에이전트가 검증이 필요한지 판단
 * @param producerAgent - 작업을 완료한 에이전트
 * @returns 검증 필요 여부
 */
export const shouldVerify = (producerAgent: string): boolean =>
  producerAgent in VERIFY_MATRIX;

/**
 * 검증자 목록 반환
 * @param producerAgent - 작업을 완료한 에이전트
 * @returns 검증자 + 체크 항목 배열
 */
export const getVerifiers = (
  producerAgent: string,
): Array<{ verifier: string; checkItems: string }> =>
  VERIFY_MATRIX[producerAgent] ?? [];

/**
 * 검증 결과를 DB에 기록
 */
const recordVerification = (
  messageTs: string,
  agent: string,
  checklist: string,
  passed: boolean,
  attempt: number,
  details: string,
): void => {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO verification_results
        (message_ts, agent, checklist, passed, attempt, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageTs,
      agent,
      checklist,
      passed ? 1 : 0,
      attempt,
      details,
      Date.now(),
    );
  } catch {
    // 기록 실패는 무시
  }
};

/**
 * 크로스 검증 실행
 *
 * 생산자의 작업 결과를 검증자에게 전달하고,
 * 검증 결과를 파싱하여 PASS/WARN/FAIL을 반환한다.
 *
 * @param producerAgent - 작업 완료 에이전트
 * @param producerResult - 에이전트 출력 텍스트
 * @param changedFiles - 에이전트가 실제 변경한 파일 경로 배열 (git diff 기반)
 * @param event - 원본 Slack 이벤트
 * @param slackApp - Slack App
 * @returns 검증 결과 배열
 */
export const runCrossVerification = async (
  producerAgent: string,
  producerResult: string,
  changedFiles: string[],
  event: SlackEvent,
  slackApp: App,
): Promise<Array<{ verifier: string; result: VerifyResult; details: string }>> => {
  const verifiers = getVerifiers(producerAgent);
  if (verifiers.length === 0) {
    return [];
  }

  const results: Array<{
    verifier: string;
    result: VerifyResult;
    details: string;
  }> = [];

  // ── 결과 텍스트 전처리 ──
  const MAX_RESULT_LENGTH = 4000;
  const truncatedResult = producerResult.length > MAX_RESULT_LENGTH
    ? producerResult.slice(0, MAX_RESULT_LENGTH) + '\n\n... (결과 잘림)'
    : producerResult;

  // ── 코드가 직접 읽은 변경 파일 내용 (구조적 강제) ──
  const fileContents = readChangedFileContents(changedFiles);
  const fileSection = fileContents
    ? `\n\n*변경된 파일 내용 (${changedFiles.length}개, 코드가 직접 읽음):*\n${fileContents}`
    : '\n\n*(변경된 파일 없음)*';

  // 검증자 병렬 실행
  const verifyPromises = verifiers.map(async ({ verifier, checkItems }) => {
    const verifyEvent: SlackEvent = {
      type: 'message',
      channel: event.channel,
      channel_name: event.channel_name,
      user: 'cross-verify',
      text: [
        `[Cross-Verification] ${producerAgent}의 작업 결과를 검증해주세요.`,
        '',
        `*검증 항목:* ${checkItems}`,
        fileSection,
        '',
        `*${producerAgent} 작업 요약:*`,
        truncatedResult,
        '',
        '응답 형식:',
        '1. 첫 줄: `VERDICT: PASS` 또는 `VERDICT: WARN` 또는 `VERDICT: FAIL`',
        '2. 둘째 줄부터: 위 파일 내용 기반 검증 상세',
      ].join('\n'),
      ts: event.ts,
      thread_ts: event.thread_ts ?? event.ts,
      mentions: [],
      raw: {},
    };

    try {
      const response = await handleMessage(
        verifier,
        verifyEvent,
        'delegation',
        slackApp,
        true,
        true,
      );

      // ── 결과 파싱 개선: VERDICT: 접두사 기반 (기존 firstLine 방식보다 안정적) ──
      const responseText = response.text.trim();
      let verifyResult: VerifyResult = 'WARN';

      // 1차: VERDICT: 패턴 (가장 신뢰)
      const verdictMatch = responseText.match(/VERDICT:\s*(PASS|WARN|FAIL)/i);
      if (verdictMatch) {
        verifyResult = verdictMatch[1].toUpperCase() as VerifyResult;
      } else {
        // 2차: 첫 5줄 내에서 PASS/FAIL/WARN 단독 단어 탐색
        const firstLines = responseText.split('\n').slice(0, 5).join(' ').toUpperCase();
        if (/\bFAIL\b/.test(firstLines)) {
          verifyResult = 'FAIL';
        } else if (/\bPASS\b/.test(firstLines)) {
          verifyResult = 'PASS';
        }
        // 둘 다 없으면 기본 WARN 유지
      }

      recordVerification(
        event.ts,
        verifier,
        checkItems,
        verifyResult !== 'FAIL',
        1,
        responseText.slice(0, 1000),
      );

      return {
        verifier,
        result: verifyResult,
        details: responseText.slice(0, 1000),
      };
    } catch (err) {
      console.error(
        `[cross-verify] ${verifier} 검증 실패:`,
        err,
      );
      return {
        verifier,
        result: 'WARN' as VerifyResult,
        details: `검증 실행 실패: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  const verifyResults = await Promise.all(verifyPromises);
  results.push(...verifyResults);

  // 결과 요약 Slack 포스팅
  const summary = results
    .map((r) => {
      const emoji =
        r.result === 'PASS'
          ? '✅'
          : r.result === 'FAIL'
            ? '❌'
            : '⚠️';
      return `${emoji} *${r.verifier}:* ${r.result}`;
    })
    .join('\n');

  try {
    await rateLimited(() =>
      slackApp.client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts ?? event.ts,
        text: `*[Cross-Verification] ${producerAgent} 작업 검증 결과*\n${summary}`,
      }),
    );
  } catch {
    // 포스팅 실패 무시
  }

  const hasFail = results.some((r) => r.result === 'FAIL');
  if (hasFail) {
    console.log(
      `[cross-verify] ${producerAgent}: FAIL 감지 — 에스컬레이션 필요`,
    );
  }

  return results;
};
