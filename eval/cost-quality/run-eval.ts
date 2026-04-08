/**
 * run-eval.ts
 *
 * Donald(단일 에이전트) vs ai-team(멀티 에이전트) 비용/품질 평가 파이프라인.
 * test-cases.json을 읽어 각 케이스를 양쪽 시스템에 전송하고,
 * 토큰 사용량·비용·지연시간을 측정하여 results/ 디렉토리에 저장합니다.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/** test-cases.json 개별 항목 */
interface TestCase {
  id: string;
  category: string;
  prompt: string;
  context: string | null;
  expected_skills: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

/** 단일 실행 결과 */
interface RunResult {
  response: string;
  input_tokens: number;
  output_tokens: number;
  total_cost_usd: number;
  latency_ms: number;
  tool_calls_count: number;
}

/** 한 테스트 케이스의 전체 결과 */
interface EvalResult {
  test_case_id: string;
  category: string;
  difficulty: string;
  prompt: string;
  context: string | null;
  expected_skills: string[];
  donald: RunResult;
  aiteam: RunResult;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 요금 설정 (claude-sonnet-4-6 기준, $/1M tokens)
// ---------------------------------------------------------------------------

const PRICING = {
  input_per_million: 3.0,
  output_per_million: 15.0,
} as const;

const MODEL = 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// 에이전트 시스템 프롬프트
// ---------------------------------------------------------------------------

const DONALD_SYSTEM_PROMPT = `You are Donald, a highly capable generalist AI assistant.
You handle all types of tasks: code review, system design, debugging, UI/UX planning, security analysis, and more.
Provide thorough, accurate, and directly actionable responses.
Always consider multiple angles — technical correctness, security, performance, and usability.
Respond in Korean unless technical terms require English.`;

/**
 * ai-team 시뮬레이션용 에이전트 시스템 프롬프트 맵.
 * expected_skills 기반으로 가장 적합한 에이전트를 선택합니다.
 */
const AGENT_PROMPTS: Record<string, string> = {
  pm: `You are Marge, an expert Product Manager with 10+ years of experience.
You specialize in: product planning, requirements definition, roadmap, sprint management, GTM strategy.
You think in outcomes, not outputs. Make trade-offs explicit and never bury them.
Provide structured, outcome-focused responses grounded in user needs and business goals.
Respond in Korean unless technical terms require English.`,

  designer: `You are Krusty, a UI/UX Designer specialized in the Apple design system and Apple HIG.
You specialize in: UI/UX design, design tokens (color, typography, spacing), accessibility, component specs, prototypes.
All design outputs follow Apple's actual design language and constraints.
Provide clear, implementable design specifications.
Respond in Korean unless technical terms require English.`,

  frontend: `You are Bart, an expert Frontend Developer specializing in React, TypeScript, and modern web technologies.
You specialize in: React/TS implementation, component design, performance optimization, responsive design, state management, accessibility.
You write clean, type-safe, performant code following best practices.
Respond in Korean unless technical terms require English.`,

  backend: `You are Homer, a Senior Backend Architect specializing in scalable system design and API development.
You specialize in: API design, database architecture, system design, infrastructure, microservices, performance optimization.
You design systems that scale, with security and reliability as first principles.
Respond in Korean unless technical terms require English.`,

  secops: `You are Wiggum, an expert Security Engineer specializing in threat modeling and vulnerability assessment.
You specialize in: security reviews, threat modeling, vulnerability assessment, authentication/authorization, encryption, OWASP top 10.
You find vulnerabilities others miss and provide concrete remediation steps.
Respond in Korean unless technical terms require English.`,

  researcher: `You are a Research Analyst specializing in technology market research and competitive analysis.
You specialize in: technical comparisons, market research, technology evaluation, documentation analysis.
You provide evidence-based insights with clear sources and reasoning.
Respond in Korean unless technical terms require English.`,

  triage: `You are a generalist coordinator who routes and synthesizes insights from multiple domains.
You provide balanced, cross-domain responses drawing on PM, design, frontend, backend, and security perspectives.
Respond in Korean unless technical terms require English.`,
};

/**
 * expected_skills → 담당 에이전트 매핑.
 * 멀티 에이전트 시뮬레이션: 여러 에이전트의 응답을 순차 생성 후 통합합니다.
 */
const SKILL_TO_AGENT: Record<string, string> = {
  explanation: 'researcher',
  code_reading: 'frontend',
  error_diagnosis: 'frontend',
  comparison: 'researcher',
  recommendation: 'researcher',
  code_review: 'frontend',
  bug_detection: 'frontend',
  react_expertise: 'frontend',
  security_review: 'secops',
  vulnerability_detection: 'secops',
  api_expertise: 'backend',
  accessibility_review: 'frontend',
  css_expertise: 'frontend',
  wcag_knowledge: 'frontend',
  system_design: 'backend',
  auth_expertise: 'backend',
  security_planning: 'secops',
  ui_design: 'designer',
  ux_planning: 'designer',
  layout_design: 'designer',
  api_design: 'backend',
  infrastructure_planning: 'backend',
  bug_diagnosis: 'backend',
  auth_flow: 'backend',
  nextjs_expertise: 'frontend',
  performance_diagnosis: 'backend',
  sql_optimization: 'backend',
  n_plus_one_detection: 'backend',
  css_debugging: 'frontend',
  responsive_design: 'frontend',
  mobile_optimization: 'frontend',
  product_planning: 'pm',
  implementation_planning: 'backend',
  security_remediation: 'secops',
  frontend_security: 'frontend',
  backend_security: 'backend',
  design_system: 'designer',
  component_design: 'frontend',
  frontend_implementation: 'frontend',
};

// ---------------------------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------------------------

/** 토큰 수와 요금으로 USD 비용 계산 */
const calculateCost = (inputTokens: number, outputTokens: number): number => {
  const inputCost = (inputTokens / 1_000_000) * PRICING.input_per_million;
  const outputCost = (outputTokens / 1_000_000) * PRICING.output_per_million;
  return inputCost + outputCost;
};

/** 사용자 메시지 텍스트 조합 */
const buildUserMessage = (testCase: TestCase): string => {
  if (testCase.context) {
    return `${testCase.prompt}\n\n\`\`\`\n${testCase.context}\n\`\`\``;
  }
  return testCase.prompt;
};

/** 지정된 밀리초만큼 대기 (rate limit 방지) */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Donald (단일 에이전트) 실행
// ---------------------------------------------------------------------------

/**
 * Donald 단일 에이전트로 테스트 케이스를 실행합니다.
 * @param client - Anthropic SDK 클라이언트
 * @param testCase - 평가할 테스트 케이스
 */
const runDonald = async (
  client: Anthropic,
  testCase: TestCase,
): Promise<RunResult> => {
  const userMessage = buildUserMessage(testCase);
  const startTime = Date.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: DONALD_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const latency = Date.now() - startTime;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    response: text,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_cost_usd: calculateCost(inputTokens, outputTokens),
    latency_ms: latency,
    tool_calls_count: 0,
  };
};

// ---------------------------------------------------------------------------
// ai-team (멀티 에이전트 시뮬레이션) 실행
// ---------------------------------------------------------------------------

/**
 * expected_skills에서 담당 에이전트 목록을 도출합니다.
 * 중복 에이전트는 제거하고, 최대 3개까지만 사용합니다.
 */
const resolveAgentsForSkills = (expectedSkills: string[]): string[] => {
  const agents = new Set<string>();
  for (const skill of expectedSkills) {
    const agent = SKILL_TO_AGENT[skill];
    if (agent) {
      agents.add(agent);
    }
  }
  // 에이전트가 없으면 triage 폴백
  if (agents.size === 0) {
    agents.add('triage');
  }
  // 최대 3개 (비용 제어)
  return [...agents].slice(0, 3);
};

/**
 * 멀티 에이전트 응답을 통합 요약하는 프롬프트를 생성합니다.
 */
const buildSynthesisPrompt = (
  originalTask: string,
  agentResponses: Array<{ agent: string; response: string }>,
): string => {
  const responseBlocks = agentResponses
    .map(
      ({ agent, response }) =>
        `### ${agent.toUpperCase()} 에이전트 응답\n${response}`,
    )
    .join('\n\n');

  return `원본 태스크: ${originalTask}

아래는 각 전문 에이전트의 응답입니다. 이를 통합하여 일관되고 완성도 높은 최종 답변을 작성해주세요.
중복 내용은 제거하고, 각 에이전트의 전문 인사이트를 조화롭게 결합하세요.

${responseBlocks}

위 내용을 통합한 최종 답변:`;
};

/**
 * ai-team 멀티 에이전트 시뮬레이션을 실행합니다.
 * 1단계: 관련 에이전트별 전문 응답 생성
 * 2단계: Triage 에이전트가 응답 통합
 *
 * @param client - Anthropic SDK 클라이언트
 * @param testCase - 평가할 테스트 케이스
 */
const runAiTeam = async (
  client: Anthropic,
  testCase: TestCase,
): Promise<RunResult> => {
  const userMessage = buildUserMessage(testCase);
  const agents = resolveAgentsForSkills(testCase.expected_skills);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let toolCallsCount = 0;
  const startTime = Date.now();

  // 1단계: 각 에이전트별 응답 생성
  const agentResponses: Array<{ agent: string; response: string }> = [];

  for (const agentKey of agents) {
    const systemPrompt = AGENT_PROMPTS[agentKey] ?? AGENT_PROMPTS['triage'];

    const agentResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    totalInputTokens += agentResponse.usage.input_tokens;
    totalOutputTokens += agentResponse.usage.output_tokens;
    toolCallsCount += 1; // 에이전트 호출 1건

    const agentText = agentResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    agentResponses.push({ agent: agentKey, response: agentText });

    // rate limit 방지 (에이전트 간 0.5초 대기)
    await sleep(500);
  }

  // 2단계: 에이전트가 1개면 통합 불필요, 2개 이상이면 triage가 통합
  let finalResponse: string;

  if (agentResponses.length === 1) {
    finalResponse = agentResponses[0].response;
  } else {
    const synthesisMessage = buildSynthesisPrompt(
      userMessage,
      agentResponses,
    );

    const synthesisResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: AGENT_PROMPTS['triage'],
      messages: [{ role: 'user', content: synthesisMessage }],
    });

    totalInputTokens += synthesisResponse.usage.input_tokens;
    totalOutputTokens += synthesisResponse.usage.output_tokens;
    toolCallsCount += 1; // 통합 호출 1건

    finalResponse = synthesisResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  const latency = Date.now() - startTime;

  return {
    response: finalResponse,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    total_cost_usd: calculateCost(totalInputTokens, totalOutputTokens),
    latency_ms: latency,
    tool_calls_count: toolCallsCount,
  };
};

// ---------------------------------------------------------------------------
// 메인 실행 로직
// ---------------------------------------------------------------------------

/**
 * 평가 파이프라인 진입점.
 * test-cases.json을 읽어 모든 케이스를 순차 실행하고,
 * 결과를 results/{id}.json 으로 저장합니다.
 */
const main = async (): Promise<void> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('오류: ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // 경로 설정
  const evalDir = path.dirname(new URL(import.meta.url).pathname);
  const testCasesPath = path.join(evalDir, 'test-cases.json');
  const resultsDir = path.join(evalDir, 'results');

  // 결과 디렉토리 생성
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // 테스트 케이스 로드
  const rawCases = fs.readFileSync(testCasesPath, 'utf-8');
  const testCases: TestCase[] = JSON.parse(rawCases);

  // CLI 인수로 특정 케이스 필터링 가능: --id=simple-01 또는 --category=code_review
  const args = process.argv.slice(2);
  const idFilter = args.find((a) => a.startsWith('--id='))?.split('=')[1];
  const categoryFilter = args
    .find((a) => a.startsWith('--category='))
    ?.split('=')[1];

  const filteredCases = testCases.filter((tc) => {
    if (idFilter && tc.id !== idFilter) {
      return false;
    }
    if (categoryFilter && tc.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  console.log(`\n평가 시작: ${filteredCases.length}개 테스트 케이스`);
  console.log(`모델: ${MODEL}`);
  console.log(`결과 저장 위치: ${resultsDir}\n`);

  let totalDonaldCost = 0;
  let totalAiTeamCost = 0;

  for (let i = 0; i < filteredCases.length; i++) {
    const tc = filteredCases[i];
    console.log(
      `[${i + 1}/${filteredCases.length}] ${tc.id} (${tc.category}, ${tc.difficulty})`,
    );

    try {
      // Donald 실행
      process.stdout.write('  Donald 실행 중...');
      const donaldResult = await runDonald(client, tc);
      console.log(
        ` 완료 (${donaldResult.latency_ms}ms, $${donaldResult.total_cost_usd.toFixed(6)})`,
      );
      totalDonaldCost += donaldResult.total_cost_usd;

      // rate limit 방지
      await sleep(1000);

      // ai-team 실행
      process.stdout.write('  ai-team 실행 중...');
      const aiTeamResult = await runAiTeam(client, tc);
      console.log(
        ` 완료 (${aiTeamResult.latency_ms}ms, $${aiTeamResult.total_cost_usd.toFixed(6)})`,
      );
      totalAiTeamCost += aiTeamResult.total_cost_usd;

      // 결과 저장
      const evalResult: EvalResult = {
        test_case_id: tc.id,
        category: tc.category,
        difficulty: tc.difficulty,
        prompt: tc.prompt,
        context: tc.context,
        expected_skills: tc.expected_skills,
        donald: donaldResult,
        aiteam: aiTeamResult,
        timestamp: new Date().toISOString(),
      };

      const resultPath = path.join(resultsDir, `${tc.id}.json`);
      fs.writeFileSync(resultPath, JSON.stringify(evalResult, null, 2), 'utf-8');
      console.log(`  저장: ${resultPath}`);

      // 케이스 간 대기 (rate limit 방지)
      if (i < filteredCases.length - 1) {
        await sleep(2000);
      }
    } catch (err) {
      console.error(`  오류 발생 (${tc.id}):`, err);
      // 오류 발생 시 계속 진행 (다른 케이스 평가)
    }

    console.log('');
  }

  // 요약 출력
  console.log('='.repeat(60));
  console.log('평가 완료 요약');
  console.log('='.repeat(60));
  console.log(`총 테스트 케이스: ${filteredCases.length}개`);
  console.log(`Donald 총 비용: $${totalDonaldCost.toFixed(6)}`);
  console.log(`ai-team 총 비용: $${totalAiTeamCost.toFixed(6)}`);
  console.log(
    `비용 비율 (ai-team/Donald): ${(totalAiTeamCost / totalDonaldCost).toFixed(2)}x`,
  );
  console.log('\n다음 단계: npx tsx report.ts 로 품질 리포트를 생성하세요.');
};

main().catch((err) => {
  console.error('실행 실패:', err);
  process.exit(1);
});
