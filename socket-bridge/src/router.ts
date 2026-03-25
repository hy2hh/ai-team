import Anthropic from '@anthropic-ai/sdk';
import type {
  ExecutionMode,
  RoutingAgent,
  RoutingResult,
} from './types.js';

/** 키워드 기반 라우팅 규칙 */
const ROUTING_RULES: Record<string, RegExp> = {
  backend: /API|서버|DB|데이터베이스|엔드포인트|배포|인프라/i,
  frontend: /UI|컴포넌트|CSS|페이지|화면|레이아웃|React/i,
  designer: /디자인|UX|피그마|목업|와이어프레임|색상/i,
  pm: /기획|로드맵|스프린트|우선순위|PRD|일정|요구사항/i,
  researcher: /조사|트렌드|경쟁사|시장|분석|리서치/i,
  secops: /보안|인증|권한|취약점|SSL|토큰|암호화/i,
};

/** 에이전트별 scope 설명 (LLM 라우팅 프롬프트용) */
export const AGENT_SCOPES: Record<string, string> = {
  pm: '기능 요청, 요구사항 정의, 우선순위, 스프린트 관리, 로드맵, GTM',
  designer:
    'UI/UX 디자인, 디자인 시스템, 접근성, 프로토타입, 디자인 토큰',
  frontend:
    'React/TS 구현, 컴포넌트, 성능 최적화, 반응형, 상태관리',
  backend:
    'API 설계, DB 아키텍처, 시스템 설계, 인프라, 마이크로서비스',
  researcher:
    '시장 조사, 경쟁사 분석, 트렌드, 기회 평가, 기술 스카우팅',
  secops: '보안 리뷰, 위협 모델링, 취약점 평가, 인증/인가, 암호화',
};

/** LLM 라우팅용 Anthropic 클라이언트 (lazy init) */
let anthropicClient: Anthropic | null = null;

/** Anthropic 클라이언트 싱글톤 */
export const getAnthropicClient = (): Anthropic => {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
};

/** LLM 라우팅 타임아웃 (ms) */
const LLM_ROUTING_TIMEOUT = 5000;

/**
 * 타임아웃 부착 Promise.race 헬퍼 — resolve/reject 후 타이머 정리
 * @param promise - 원본 Promise
 * @param ms - 타임아웃 밀리초
 * @param label - 타임아웃 에러 메시지 라벨
 * @returns 원본 Promise 결과
 */
const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timeout`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
};

/** 에이전트 이름으로 RoutingAgent 생성 */
const toRoutingAgent = (name: string): RoutingAgent => ({
  name,
  role: AGENT_SCOPES[name] ?? '',
});

/** botUserId -> agentName 매핑 (런타임에 채워짐) */
const botUserIdToAgent = new Map<string, string>();

/** botUserId 매핑 등록 */
export const registerBotUser = (
  botUserId: string,
  agentName: string,
): void => {
  botUserIdToAgent.set(botUserId, agentName);
};

/**
 * 메시지 텍스트에서 멘션된 에이전트 목록 추출
 * @param text - Slack 메시지 텍스트
 * @returns 멘션된 에이전트 이름 배열
 */
export const parseMentions = (text: string): string[] => {
  const mentions: string[] = [];
  const mentionPattern = /<@(U[A-Z0-9]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(text)) !== null) {
    const userId = match[1];
    const agentName = botUserIdToAgent.get(userId);
    if (agentName) {
      mentions.push(agentName);
    }
  }
  return mentions;
};

/**
 * 키워드 패턴 매칭으로 모든 매칭 에이전트 반환
 * @param text - Slack 메시지 텍스트
 * @returns 매칭된 에이전트 이름 배열
 */
export const matchKeywords = (text: string): string[] => {
  const matches: string[] = [];
  for (const [agentName, pattern] of Object.entries(
    ROUTING_RULES,
  )) {
    if (pattern.test(text)) {
      matches.push(agentName);
    }
  }
  return matches;
};

/** LLM 단일 에이전트 분류 응답 */
interface LlmSingleResponse {
  agentName: string;
}

/** LLM 복합 태스크 분류 응답 */
interface LlmComplexResponse {
  execution: ExecutionMode;
  firstStep: {
    agents: string[];
    execution: 'single' | 'parallel';
  };
  intent: string;
}

/**
 * LLM 기반 의미 분류로 에이전트 결정 (단일)
 * @param text - Slack 메시지 텍스트
 * @param candidates - 후보 에이전트 목록 (비어있으면 전체 대상)
 * @returns 에이전트 이름 또는 null (타임아웃/실패 시)
 */
const classifyWithLlm = async (
  text: string,
  candidates: string[] = [],
): Promise<string | null> => {
  const scopeEntries =
    candidates.length > 0
      ? Object.entries(AGENT_SCOPES).filter(([name]) =>
          candidates.includes(name),
        )
      : Object.entries(AGENT_SCOPES);

  const scopeList = scopeEntries
    .map(([name, scope]) => `- ${name}: ${scope}`)
    .join('\n');

  const validNames = scopeEntries
    .map(([name]) => name)
    .join(', ');

  const prompt = [
    '다음 메시지를 가장 적합한 에이전트에게 라우팅해야 합니다.',
    '',
    '## 에이전트 목록',
    scopeList,
    '',
    '## 메시지',
    text,
    '',
    '## 규칙',
    '- 반드시 하나의 에이전트만 선택',
    '- JSON으로만 응답: {"agentName":"에이전트이름"}',
    `- 유효한 에이전트 이름: ${validNames}`,
  ].join('\n');

  try {
    const client = getAnthropicClient();

    const response = await withTimeout(
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }],
      }),
      LLM_ROUTING_TIMEOUT,
      'LLM routing',
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    const parsed = JSON.parse(content.text) as LlmSingleResponse;
    const { agentName } = parsed;

    if (agentName && agentName in AGENT_SCOPES) {
      return agentName;
    }

    console.warn(
      `[router] LLM이 유효하지 않은 에이전트 반환: ${content.text}`,
    );
    return null;
  } catch (err) {
    console.warn('[router] LLM 라우팅 실패:', err);
    return null;
  }
};

/**
 * LLM 기반 복합 태스크 감지 및 실행 모드 결정
 * @param text - Slack 메시지 텍스트
 * @returns 복합 라우팅 결과 또는 null
 */
export const classifyComplexTask = async (
  text: string,
): Promise<RoutingResult | null> => {
  const scopeList = Object.entries(AGENT_SCOPES)
    .map(([name, scope]) => `- ${name}: ${scope}`)
    .join('\n');

  const prompt = [
    '다음 메시지를 분석하여 실행 방식을 결정해야 합니다.',
    '',
    '## 에이전트 목록',
    scopeList,
    '',
    '## 메시지',
    text,
    '',
    '## 실행 모드',
    '- single: 한 에이전트만 필요한 단순 작업',
    '- parallel: 여러 에이전트가 독립적으로 동시 작업 (예: 코드 리뷰)',
    '- sequential: 에이전트 간 의존성이 있는 순차 작업 (예: 디자인 후 구현)',
    '',
    '## 표준 패턴',
    '- 코드 리뷰 → parallel: frontend + backend',
    '- 디자인 후 구현 → sequential: designer 먼저 (이후 동적 결정)',
    '- API + UI 동시 → parallel: backend + frontend',
    '- 풀 사이클 기능 → sequential: pm 먼저 (이후 동적 결정)',
    '',
    '## 규칙',
    '- JSON으로만 응답',
    '- single이면: {"execution":"single","firstStep":{"agents":["에이전트"],"execution":"single"},"intent":"설명"}',
    '- parallel이면: {"execution":"parallel","firstStep":{"agents":["에이전트1","에이전트2"],"execution":"parallel"},"intent":"설명"}',
    '- sequential이면: {"execution":"sequential","firstStep":{"agents":["첫에이전트"],"execution":"single"},"intent":"전체 의도 설명"}',
    '- sequential의 firstStep에는 첫 단계 에이전트만 포함 (나머지는 동적 결정)',
  ].join('\n');

  try {
    const client = getAnthropicClient();

    const response = await withTimeout(
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
      LLM_ROUTING_TIMEOUT,
      'LLM complex routing',
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    const parsed = JSON.parse(content.text) as LlmComplexResponse;

    // 유효성 검증
    const validExecutions = ['single', 'parallel', 'sequential'];
    if (!validExecutions.includes(parsed.execution)) {
      console.warn(
        `[router] LLM이 유효하지 않은 실행 모드 반환: ${parsed.execution}`,
      );
      return null;
    }

    const rawAgents = parsed.firstStep?.agents;
    if (!Array.isArray(rawAgents)) {
      console.warn(
        `[router] LLM이 유효하지 않은 에이전트 형식 반환: ${content.text}`,
      );
      return null;
    }

    const validAgents = rawAgents.filter(
      (a): a is string =>
        typeof a === 'string' && a in AGENT_SCOPES,
    );
    if (validAgents.length === 0) {
      console.warn(
        `[router] LLM이 유효하지 않은 에이전트 반환: ${content.text}`,
      );
      return null;
    }

    return {
      agents: validAgents.map(toRoutingAgent),
      execution: parsed.execution,
      method: 'llm',
    };
  } catch (err) {
    console.warn('[router] LLM 복합 라우팅 실패:', err);
    return null;
  }
};

/**
 * 4단계 라우팅: mention -> keyword -> LLM(complex) -> PM default
 * @param text - Slack 메시지 텍스트
 * @returns 라우팅 결과 (에이전트 목록 + 실행 모드)
 */
export const routeMessage = async (
  text: string,
): Promise<RoutingResult> => {
  // 1순위: @mention
  const mentions = parseMentions(text);
  if (mentions.length > 0) {
    return {
      agents: mentions.map(toRoutingAgent),
      execution: mentions.length > 1 ? 'parallel' : 'single',
      method: 'mention',
    };
  }

  // 2순위: 키워드 매칭
  const keywordMatches = matchKeywords(text);
  if (keywordMatches.length === 1) {
    return {
      agents: [toRoutingAgent(keywordMatches[0])],
      execution: 'single',
      method: 'keyword',
    };
  }

  // 복수 키워드 매칭 → LLM에 후보 목록 제공하여 분류
  if (keywordMatches.length > 1) {
    console.log(
      `[router] 복수 키워드 매칭: [${keywordMatches.join(', ')}] → LLM 분류`,
    );
    const llmDisambiguated = await classifyWithLlm(
      text,
      keywordMatches,
    );
    if (llmDisambiguated) {
      return {
        agents: [toRoutingAgent(llmDisambiguated)],
        execution: 'single',
        method: 'keyword',
      };
    }
    return {
      agents: [toRoutingAgent(keywordMatches[0])],
      execution: 'single',
      method: 'keyword',
    };
  }

  // 3순위: LLM 복합 태스크 감지 (실행 모드 + 에이전트 결정)
  const complexResult = await classifyComplexTask(text);
  if (complexResult) {
    return complexResult;
  }

  // 4순위: PM 기본값
  return {
    agents: [toRoutingAgent('pm')],
    execution: 'single',
    method: 'default',
  };
};
