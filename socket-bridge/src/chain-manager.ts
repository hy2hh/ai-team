import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  ChainState,
  ChainStep,
  RoutingAgent,
  SlackEvent,
} from './types.js';
import {
  AGENT_SCOPES,
  getAnthropicClient,
  withTimeout,
} from './router.js';

const PROJECT_DIR = join(import.meta.dirname, '..', '..');
const HANDOFF_DIR = join(PROJECT_DIR, '.memory', 'handoff');

/** LLM 라우팅 타임아웃 (ms) */
const LLM_TIMEOUT = 5000;

/** 활성 체인 맵 */
const activeChains = new Map<string, ChainState>();

/**
 * 새 순차 체인 생성
 * @param event - 원본 Slack 이벤트
 * @param firstAgents - 첫 단계 에이전트 목록
 * @param firstExecution - 첫 단계 실행 모드
 * @returns 생성된 ChainState
 */
export const createChain = (
  event: SlackEvent,
  firstAgents: RoutingAgent[],
  firstExecution: 'single' | 'parallel',
): ChainState => {
  const chainId = `chain-${event.ts.replace('.', '-')}`;

  const firstStep: ChainStep = {
    agents: firstAgents.map((a) => a.name),
    execution: firstExecution,
    status: 'pending',
  };

  const chain: ChainState = {
    chainId,
    originalRequest: event.text,
    steps: [firstStep],
    currentStep: 0,
    status: 'in_progress',
  };

  activeChains.set(chainId, chain);
  persistChain(chain);

  console.log(
    `[chain] 생성: ${chainId} — 첫 단계: [${firstStep.agents.join(', ')}]`,
  );

  return chain;
};

/**
 * 현재 단계 시작 표시
 * @param chainId - 체인 ID
 */
export const markStepInProgress = (chainId: string): void => {
  const chain = activeChains.get(chainId);
  if (!chain) {
    return;
  }

  const step = chain.steps[chain.currentStep];
  if (step) {
    step.status = 'in_progress';
    persistChain(chain);
  }
};

/**
 * 현재 단계 완료 처리 및 다음 단계 LLM 평가
 * @param chainId - 체인 ID
 * @param result - 이전 단계 결과 요약
 * @returns 다음 단계 에이전트 목록 (null이면 체인 완료)
 */
export const completeStepAndEvaluateNext = async (
  chainId: string,
  result: string,
): Promise<ChainStep | null> => {
  const chain = activeChains.get(chainId);
  if (!chain) {
    return null;
  }

  // 현재 단계 완료
  const currentStep = chain.steps[chain.currentStep];
  if (currentStep) {
    currentStep.status = 'completed';
    currentStep.result = result.slice(0, 500);
  }

  // LLM에게 다음 단계 결정 요청
  const nextStep = await evaluateNextStep(chain);

  if (!nextStep) {
    // 체인 완료
    chain.status = 'completed';
    persistChain(chain);
    activeChains.delete(chainId);
    console.log(`[chain] 완료: ${chainId}`);
    return null;
  }

  // 다음 단계 추가
  chain.steps.push(nextStep);
  chain.currentStep += 1;
  persistChain(chain);

  console.log(
    `[chain] 다음 단계: ${chainId} step ${chain.currentStep} — [${nextStep.agents.join(', ')}]`,
  );

  return nextStep;
};

/**
 * 체인 실패 처리
 * @param chainId - 체인 ID
 */
export const failChain = (chainId: string): void => {
  const chain = activeChains.get(chainId);
  if (!chain) {
    return;
  }

  chain.status = 'failed';
  const currentStep = chain.steps[chain.currentStep];
  if (currentStep) {
    currentStep.status = 'completed';
  }
  persistChain(chain);
  activeChains.delete(chainId);
  console.log(`[chain] 실패: ${chainId}`);
};

/** 체인 ID로 체인 조회 */
export const getChain = (
  chainId: string,
): ChainState | undefined => activeChains.get(chainId);

/**
 * LLM 기반 다음 단계 평가
 * @param chain - 현재 체인 상태
 * @returns 다음 ChainStep 또는 null (완료 시)
 */
const evaluateNextStep = async (
  chain: ChainState,
): Promise<ChainStep | null> => {
  const scopeList = Object.entries(AGENT_SCOPES)
    .map(([name, scope]) => `- ${name}: ${scope}`)
    .join('\n');

  const stepSummary = chain.steps
    .filter((s) => s.status === 'completed')
    .map(
      (s, i) =>
        `단계 ${i + 1} (${s.agents.join(', ')}): ${s.result ?? '결과 없음'}`,
    )
    .join('\n');

  const prompt = [
    '순차 작업 체인의 다음 단계를 결정해야 합니다.',
    '',
    '## 에이전트 목록',
    scopeList,
    '',
    '## 원본 요청',
    chain.originalRequest,
    '',
    '## 완료된 단계',
    stepSummary,
    '',
    '## 규칙',
    '- 원본 요청의 의도가 모두 충족되었으면: {"done":true}',
    '- 추가 작업이 필요하면: {"done":false,"nextStep":{"agents":["에이전트"],"execution":"single"}}',
    '- 병렬 가능하면 execution을 "parallel"로 설정',
    '- JSON으로만 응답',
  ].join('\n');

  try {
    const anthropic = getAnthropicClient();

    const response = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
      LLM_TIMEOUT,
      'LLM chain eval',
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    const parsed = JSON.parse(content.text) as {
      done?: unknown;
      nextStep?: {
        agents?: unknown;
        execution?: string;
      };
    };

    if (parsed.done === true) {
      return null;
    }

    const rawAgents = parsed.nextStep?.agents;
    if (!Array.isArray(rawAgents)) {
      return null;
    }

    const validAgents = rawAgents.filter(
      (a): a is string =>
        typeof a === 'string' && a in AGENT_SCOPES,
    );
    if (validAgents.length === 0) {
      return null;
    }

    return {
      agents: validAgents,
      execution:
        parsed.nextStep?.execution === 'parallel'
          ? 'parallel'
          : 'single',
      status: 'pending',
    };
  } catch (err) {
    console.warn('[chain] LLM 다음 단계 평가 실패:', err);
    return null;
  }
};

/**
 * 체인 상태를 .memory/handoff/ 파일에 기록
 * @param chain - 체인 상태
 */
const persistChain = (chain: ChainState): void => {
  try {
    if (!existsSync(HANDOFF_DIR)) {
      mkdirSync(HANDOFF_DIR, { recursive: true });
    }

    const filePath = join(HANDOFF_DIR, `${chain.chainId}.md`);
    const stepLines = chain.steps.map((s, i) => {
      const status =
        s.status === 'completed'
          ? '[x]'
          : s.status === 'in_progress'
            ? '[~]'
            : '[ ]';
      const result = s.result ? ` — ${s.result.slice(0, 100)}` : '';
      return `${i + 1}. ${status} ${s.agents.join(' + ')} (${s.execution})${result}`;
    });

    const content = [
      `# Chain: ${chain.chainId}`,
      `Status: ${chain.status}`,
      `Current Step: ${chain.currentStep + 1}`,
      '',
      '## 원본 요청',
      chain.originalRequest,
      '',
      '## 단계',
      ...stepLines,
    ].join('\n');

    writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    console.error('[chain] persist 실패:', err);
  }
};
