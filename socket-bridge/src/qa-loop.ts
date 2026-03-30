/**
 * QA Loop Module — 팀 Ralph Loop 오케스트레이션
 *
 * Cross-verify 또는 Chalmers QA가 FAIL을 반환하면
 * 자동으로 해당 에이전트에게 재작업을 위임하고,
 * 재검증을 수행하는 루프를 관리한다.
 *
 * 핵심 원칙:
 * - 루프 탈출 조건 = 코드 실행 결과 (빌드/테스트/런타임), LLM 판단이 아님
 * - 최대 반복 횟수 초과 시 sid에게 에스컬레이션
 * - 상태 관리: DB에 iteration count 기록
 */

import type { App } from '@slack/bolt';
import { handleMessage } from './agent-runtime.js';
import type { SlackEvent } from './types.js';
import { MAX_RALPH_LOOP_ITERATIONS, RALPH_LOOP_ENABLED } from './config.js';
import { getDb } from './db.js';
import { rateLimited } from './rate-limiter.js';
import {
  runCrossVerification,
  snapshotChangedFiles,
  diffSnapshots,
  type VerifyResult,
} from './cross-verify.js';

/** 루프 상태 */
export interface LoopState {
  messageTs: string;
  agent: string;
  iteration: number;
  maxIterations: number;
  lastResult: 'PASS' | 'WARN' | 'FAIL' | 'PENDING';
  createdAt: number;
  updatedAt: number;
}

/**
 * 루프 상태를 DB에 기록/업데이트
 */
const upsertLoopState = (state: LoopState): void => {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO ralph_loop_state
        (message_ts, agent, iteration, max_iterations, last_result, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(message_ts, agent) DO UPDATE SET
        iteration = excluded.iteration,
        last_result = excluded.last_result,
        updated_at = excluded.updated_at
    `).run(
      state.messageTs,
      state.agent,
      state.iteration,
      state.maxIterations,
      state.lastResult,
      state.createdAt,
      state.updatedAt,
    );
  } catch (err) {
    console.error('[qa-loop] 루프 상태 저장 실패:', err);
  }
};

/**
 * 현재 루프 상태 조회
 */
const getLoopState = (messageTs: string, agent: string): LoopState | null => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT message_ts, agent, iteration, max_iterations, last_result, created_at, updated_at
      FROM ralph_loop_state
      WHERE message_ts = ? AND agent = ?
    `).get(messageTs, agent) as {
      message_ts: string;
      agent: string;
      iteration: number;
      max_iterations: number;
      last_result: string;
      created_at: number;
      updated_at: number;
    } | undefined;

    if (!row) {
      return null;
    }

    return {
      messageTs: row.message_ts,
      agent: row.agent,
      iteration: row.iteration,
      maxIterations: row.max_iterations,
      lastResult: row.last_result as LoopState['lastResult'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
};

/**
 * Chalmers QA 에이전트 호출
 *
 * Cross-verify와 달리 Chalmers는 전체 작업 결과를
 * 독립적·증거 기반으로 검증한다.
 *
 * specPath가 제공되면 QA 모드(Feature Spec AC 기반 E2E 검증)로 동작한다.
 * specPath가 없으면 코드리뷰 모드(파일 기반 산출물 검증)로 동작한다.
 *
 * @param producerAgent - 작업을 완료한 에이전트
 * @param producerResult - 에이전트 출력 텍스트
 * @param changedFiles - 변경된 파일 경로 배열
 * @param event - 원본 Slack 이벤트
 * @param slackApp - Slack App
 * @param specPath - (선택) Feature Spec 경로 — 제공 시 QA 모드로 실행
 * @returns QA 결과 (PASS/WARN/FAIL + 상세)
 */
export const runChalmersQA = async (
  producerAgent: string,
  producerResult: string,
  changedFiles: string[],
  event: SlackEvent,
  slackApp: App,
  specPath?: string,
): Promise<{ result: VerifyResult; details: string }> => {
  const MAX_RESULT_LENGTH = 4000;
  const MAX_DETAILS_LENGTH = 4000;

  const truncatedResult = producerResult.length > MAX_RESULT_LENGTH
    ? producerResult.slice(0, MAX_RESULT_LENGTH) + '\n\n... (결과 잘림)'
    : producerResult;

  const fileList = changedFiles.length > 0
    ? changedFiles.map((f) => `• \`${f}\``).join('\n')
    : '*(변경된 파일 없음)*';

  const isQaMode = Boolean(specPath);

  const qaEvent: SlackEvent = {
    type: 'message',
    channel: event.channel,
    channel_name: event.channel_name,
    user: 'qa-loop',
    text: isQaMode
      ? [
          `[QA 검증 요청] Feature Spec AC 기반 E2E 검증을 실행해주세요.`,
          '',
          `*스펙 파일:* \`${specPath}\``,
          '',
          `*구현 에이전트:* ${producerAgent}`,
          `*변경된 파일 (${changedFiles.length}개):*`,
          fileList,
          '',
          `*${producerAgent} 작업 요약:*`,
          truncatedResult,
          '',
          `스펙 파일(\`${specPath}\`)을 읽어 AC를 추출하고, Layer 1 → Layer 2 → Layer 3 순서로 E2E 검증을 실행해주세요.`,
          '검증 완료 후 🧪 [QA 검증 결과] 형식으로 보고해주세요.',
        ].join('\n')
      : [
          `[QA 검증 요청] ${producerAgent}의 작업 결과를 독립 검증해주세요.`,
          '',
          `*변경된 파일 (${changedFiles.length}개):*`,
          fileList,
          '',
          `*${producerAgent} 작업 요약:*`,
          truncatedResult,
          '',
          '위 파일을 직접 읽고(Read), 빌드/린트/런타임 테스트(Bash)로 검증해주세요.',
          '검증 완료 후 코드리뷰 보고 형식으로 종합 판정(PASS/CONDITIONAL PASS/FAIL)을 포함해 보고해주세요.',
        ].join('\n'),
    ts: event.ts,
    thread_ts: event.thread_ts ?? event.ts,
    mentions: [],
    raw: {},
  };

  try {
    const response = await handleMessage(
      'chalmers',
      qaEvent,
      'delegation',
      slackApp,
      true, // skipReaction
      false, // skipPosting = false → QA 결과 Slack에 게시
      'high', // 품질 검증은 HIGH tier
    );

    // 결과 파싱
    // QA 모드: "결과: N PASS, N FAIL" 또는 "→ FAIL 있으면/FAIL 없으면" 패턴
    // 코드리뷰 모드: "종합 판정: PASS/CONDITIONAL PASS/FAIL" 패턴
    const responseText = response.text.trim();
    let qaResult: VerifyResult = 'WARN';

    // QA 모드 파싱: "결과:" 섹션에서 FAIL 여부 확인
    const qaResultMatch = responseText.match(/결과:\s*\d+\s*PASS,\s*(\d+)\s*FAIL/);
    if (qaResultMatch) {
      const failCount = parseInt(qaResultMatch[1], 10);
      qaResult = failCount > 0 ? 'FAIL' : 'PASS';
    } else {
      // 코드리뷰 모드 파싱: "종합 판정:" 패턴
      const verdictMatch = responseText.match(/종합\s*판정[:\s]+(PASS|CONDITIONAL\s*PASS|FAIL)/i);
      if (verdictMatch) {
        const verdict = verdictMatch[1].toUpperCase();
        if (verdict === 'FAIL') {
          qaResult = 'FAIL';
        } else if (verdict.includes('CONDITIONAL')) {
          qaResult = 'WARN';
        } else {
          qaResult = 'PASS';
        }
      } else {
        // 폴백: 전체 텍스트에서 FAIL/PASS 탐색
        const upperText = responseText.toUpperCase();
        if (/\bFAIL\b/.test(upperText)) {
          qaResult = 'FAIL';
        } else if (/\bPASS\b/.test(upperText)) {
          qaResult = 'PASS';
        }
      }
    }

    return {
      result: qaResult,
      details: responseText.slice(0, MAX_DETAILS_LENGTH),
    };
  } catch (err) {
    console.error('[qa-loop] Chalmers QA 실행 실패:', err);
    return {
      result: 'WARN',
      details: `QA 실행 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

/**
 * 에이전트에게 재작업 요청
 */
const requestRework = async (
  agent: string,
  failureDetails: string,
  originalTask: string,
  event: SlackEvent,
  slackApp: App,
): Promise<{ text: string; changedFiles: string[] }> => {
  const reworkEvent: SlackEvent = {
    ...event,
    user: 'qa-loop',
    text: [
      `[재작업 요청] 이전 작업이 검증에서 FAIL 판정을 받았습니다.`,
      '',
      '*FAIL 사유:*',
      failureDetails,
      '',
      '*원래 작업:*',
      originalTask,
      '',
      '위 이슈를 수정하고 완료 보고해주세요.',
    ].join('\n'),
  };

  // 변경 파일 추적을 위한 스냅샷
  const beforeSnapshot = snapshotChangedFiles();

  const result = await handleMessage(
    agent,
    reworkEvent,
    'delegation',
    slackApp,
    true, // skipReaction
    false, // skipPosting = false → 재작업 결과 Slack에 게시
    'standard',
  );

  // 에이전트 실행 후 변경된 파일 추적
  const afterSnapshot = snapshotChangedFiles();
  const changedFiles = diffSnapshots(beforeSnapshot, afterSnapshot);

  return {
    text: result.text,
    changedFiles,
  };
};

/**
 * sid에게 에스컬레이션
 */
const escalateToSid = async (
  agent: string,
  iteration: number,
  lastFailureDetails: string,
  event: SlackEvent,
  slackApp: App,
): Promise<void> => {
  try {
    await rateLimited(() =>
      slackApp.client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts ?? event.ts,
        text: [
          `:rotating_light: *[Ralph Loop 에스컬레이션]*`,
          '',
          `*에이전트:* ${agent}`,
          `*반복 횟수:* ${iteration}/${MAX_RALPH_LOOP_ITERATIONS}`,
          `*마지막 FAIL 사유:*`,
          lastFailureDetails.slice(0, 500),
          '',
          `최대 반복 횟수에 도달했습니다. <@${process.env.SID_USER_ID ?? 'U0AJ3T423RU'}>님의 판단이 필요합니다.`,
        ].join('\n'),
      }),
    );
  } catch (err) {
    console.error('[qa-loop] 에스컬레이션 실패:', err);
  }
};

/** Ralph Loop 결과 */
export interface RalphLoopResult {
  finalResult: 'PASS' | 'WARN' | 'ESCALATED';
  iterations: number;
  details: string;
}

/**
 * 팀 Ralph Loop 실행
 *
 * Cross-verify FAIL 또는 Chalmers QA FAIL 시 호출되어
 * 자동으로 재작업 → 재검증 루프를 실행한다.
 *
 * @param agent - 재작업할 에이전트
 * @param originalTask - 원래 작업 내용
 * @param initialFailureDetails - 초기 FAIL 상세
 * @param event - 원본 Slack 이벤트
 * @param slackApp - Slack App (위임 에이전트용)
 * @param pmApp - PM Slack App (검증용)
 * @param specPath - (선택) Feature Spec 경로 — 제공 시 Chalmers가 QA 모드로 실행
 * @returns 최종 결과
 */
export const runRalphLoop = async (
  agent: string,
  originalTask: string,
  initialFailureDetails: string,
  event: SlackEvent,
  slackApp: App,
  pmApp: App,
  specPath?: string,
): Promise<RalphLoopResult> => {
  if (!RALPH_LOOP_ENABLED) {
    console.log('[qa-loop] Ralph Loop 비활성화됨');
    return {
      finalResult: 'WARN',
      iterations: 0,
      details: 'Ralph Loop이 비활성화되어 있습니다.',
    };
  }

  // 기존 루프 상태 확인
  let state = getLoopState(event.ts, agent);
  if (!state) {
    state = {
      messageTs: event.ts,
      agent,
      iteration: 0,
      maxIterations: MAX_RALPH_LOOP_ITERATIONS,
      lastResult: 'FAIL',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  let failureDetails = initialFailureDetails;

  while (state.iteration < MAX_RALPH_LOOP_ITERATIONS) {
    state.iteration++;
    state.updatedAt = Date.now();
    upsertLoopState(state);

    console.log(
      `[qa-loop] Ralph Loop ${agent}: iteration ${state.iteration}/${MAX_RALPH_LOOP_ITERATIONS}`,
    );

    // 1. 재작업 요청
    const reworkResult = await requestRework(
      agent,
      failureDetails,
      originalTask,
      event,
      slackApp,
    );

    // 2. Cross-verify 재실행
    const verifyResults = await runCrossVerification(
      agent,
      reworkResult.text,
      reworkResult.changedFiles,
      event,
      pmApp,
    );

    const hasFail = verifyResults.some((r) => r.result === 'FAIL');

    if (!hasFail) {
      // 3. Chalmers QA 최종 검증
      const qaResult = await runChalmersQA(
        agent,
        reworkResult.text,
        reworkResult.changedFiles,
        event,
        pmApp,
        specPath,
      );

      if (qaResult.result !== 'FAIL') {
        state.lastResult = qaResult.result;
        state.updatedAt = Date.now();
        upsertLoopState(state);

        console.log(
          `[qa-loop] Ralph Loop ${agent}: ${qaResult.result} (iteration ${state.iteration})`,
        );

        return {
          finalResult: qaResult.result,
          iterations: state.iteration,
          details: qaResult.details,
        };
      }

      // QA FAIL — 다음 루프로
      failureDetails = qaResult.details;
    } else {
      // Cross-verify FAIL — 다음 루프로
      const failedVerifier = verifyResults.find((r) => r.result === 'FAIL');
      failureDetails = failedVerifier?.details ?? 'Cross-verify FAIL';
    }

    state.lastResult = 'FAIL';
    state.updatedAt = Date.now();
    upsertLoopState(state);
  }

  // 최대 반복 도달 — 에스컬레이션
  console.warn(
    `[qa-loop] Ralph Loop ${agent}: 최대 반복 도달 — 에스컬레이션`,
  );

  await escalateToSid(
    agent,
    state.iteration,
    failureDetails,
    event,
    pmApp,
  );

  return {
    finalResult: 'ESCALATED',
    iterations: state.iteration,
    details: `최대 반복 횟수(${MAX_RALPH_LOOP_ITERATIONS}) 도달. sid 에스컬레이션.`,
  };
};

/** runDirectQA 결과 */
export interface DirectQAResult {
  result: VerifyResult;
  details: string;
}

/**
 * QA 직접 실행 — 사용자 명령어 "QA 실행 docs/specs/xxx.md" 처리
 *
 * runRalphLoop()과 달리 재작업 루프 없이 Chalmers QA를 1회 직접 호출한다.
 * 파일 존재 여부를 먼저 검증하고, 미존재 시 에러 메시지를 반환한다.
 *
 * @param specPath - Feature Spec 경로 (e.g. docs/specs/xxx.md)
 * @param event - 원본 Slack 이벤트
 * @param slackApp - Slack App
 * @returns QA 결과 (PASS/WARN/FAIL + 상세)
 */
export const runDirectQA = async (
  specPath: string,
  event: SlackEvent,
  slackApp: App,
): Promise<DirectQAResult> => {
  // 스펙 파일 존재 검증
  const { existsSync } = await import('fs');
  const { resolve } = await import('path');

  const projectRoot = resolve(import.meta.dirname, '..', '..');
  const absoluteSpecPath = resolve(projectRoot, specPath);

  if (!existsSync(absoluteSpecPath)) {
    const errorMsg = [
      `❌ *[QA 직접 실행 오류]* 스펙 파일을 찾을 수 없습니다.`,
      ``,
      `*경로:* \`${specPath}\``,
      ``,
      `올바른 사용법:`,
      `> \`QA 실행 docs/specs/파일명.md\``,
      `> \`QA 검증 docs/specs/파일명.md\``,
      `> \`qa run docs/specs/파일명.md\``,
      ``,
      `\`docs/specs/\` 디렉토리에 존재하는 스펙 파일 경로를 정확히 입력해주세요.`,
    ].join('\n');

    try {
      const { rateLimited } = await import('./rate-limiter.js');
      await rateLimited(() =>
        slackApp.client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts ?? event.ts,
          text: errorMsg,
        }),
      );
    } catch (postErr) {
      console.error('[qa-loop] 에러 메시지 게시 실패:', postErr);
    }

    return {
      result: 'FAIL',
      details: `스펙 파일 미존재: ${specPath}`,
    };
  }

  console.log(`[qa-loop] runDirectQA: specPath=${specPath}`);

  // Chalmers QA 직접 호출 (재작업 루프 없음)
  return runChalmersQA(
    'user',      // producerAgent: 사용자가 직접 요청
    event.text,  // producerResult: 원본 명령어 텍스트
    [],          // changedFiles: 직접 실행이므로 빈 배열
    event,
    slackApp,
    specPath,
  );
};

/**
 * DB 테이블 초기화 (bridge 시작 시 호출)
 */
export const initQaLoopTable = (): void => {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS ralph_loop_state (
        message_ts TEXT NOT NULL,
        agent TEXT NOT NULL,
        iteration INTEGER NOT NULL DEFAULT 0,
        max_iterations INTEGER NOT NULL DEFAULT 3,
        last_result TEXT NOT NULL DEFAULT 'PENDING',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (message_ts, agent)
      )
    `);
    console.log('[qa-loop] ralph_loop_state 테이블 초기화 완료');
  } catch (err) {
    console.error('[qa-loop] 테이블 초기화 실패:', err);
  }
};

/**
 * 오래된 루프 상태 정리 (7일 이상)
 */
export const cleanupOldLoopStates = (): void => {
  try {
    const db = getDb();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const result = db.prepare(`
      DELETE FROM ralph_loop_state WHERE updated_at < ?
    `).run(cutoff);
    if (result.changes > 0) {
      console.log(`[qa-loop] ${result.changes}개 오래된 루프 상태 정리`);
    }
  } catch (err) {
    console.error('[qa-loop] 루프 상태 정리 실패:', err);
  }
};
