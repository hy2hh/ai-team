import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type {
  ExecutionMode,
  RoutingAgent,
  RoutingResult,
} from './types.js';

/** 전체 에이전트 브로드캐스트 패턴 (인사, 공지, 전체 호출) */
const BROADCAST_PATTERN =
  /친구들|여러분|모두들|다들|전원|공지합니다|공지사항|좋은 아침|좋은 저녁|안녕하세요|수고하셨|수고했|다같이|팀[  ]?전체/i;

/** 간단한 대화 패턴 — LLM 분류 없이 PM 직행 (0ms 라우팅) */
const CONVERSATIONAL_PATTERN =
  /^[\s]*(하이[염요]?|ㅎㅇ|안녕[하세요]*|헬로|hello|hi|hey|넵|네|ㅇㅇ|ㅋㅋ+|ㄱㅅ|감사[합니다]*|고마워[요]?|오[키케이]+|확인[했어요]*|알겠[습니다어]*|응|음+|흠+|좋[아습니다]*|됐[어습니다]*|괜찮[아습니다]*|ㅎ+|수고|어떻게\s*생각|뭐라고\s*생각|의견|조언|추천|도움|알려|설명|요약|정리|분석|검토|리뷰|피드백|어때|뭐해|상태|현황|진행|보고)[\s!?.~]*$/i;

/** 모든 에이전트 이름 목록 */
const ALL_AGENT_NAMES = [
  'pm',
  'designer',
  'frontend',
  'backend',
  'researcher',
  'secops',
];

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

/** LLM 라우팅 타임아웃 (ms) */
const LLM_ROUTING_TIMEOUT = 10000;

/**
 * Agent SDK query()를 사용한 LLM 텍스트 응답 헬퍼
 * @param prompt - 프롬프트 텍스트
 * @param timeoutMs - 타임아웃 밀리초
 * @returns LLM 응답 텍스트 또는 null
 */
export const queryLlm = async (
  prompt: string,
  timeoutMs = LLM_ROUTING_TIMEOUT,
): Promise<string | null> => {
  const run = async (): Promise<string | null> => {
    let resultText: string | null = null;
    for await (const message of query({
      prompt,
      options: {
        model: 'claude-haiku-4-5-20251001',
        systemPrompt:
          'JSON으로만 응답하세요. 설명이나 부가 텍스트 없이 순수 JSON만 출력하세요.',
        maxTurns: 1,
        allowedTools: [],
      },
    })) {
      if (message.type === 'result') {
        const resultMsg = message as SDKResultMessage;
        if (resultMsg.subtype === 'success') {
          resultText = resultMsg.result;
        }
      }
    }
    return resultText;
  };

  try {
    return await withTimeout(run(), timeoutMs, 'LLM routing');
  } catch (err) {
    console.warn('[router] LLM 쿼리 실패:', err);
    return null;
  }
};

/**
 * 타임아웃 부착 Promise.race 헬퍼 — resolve/reject 후 타이머 정리
 * @param promise - 원본 Promise
 * @param ms - 타임아웃 밀리초
 * @param label - 타임아웃 에러 메시지 라벨
 * @returns 원본 Promise 결과
 */
export const withTimeout = <T>(
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

/**
 * LLM 응답에서 JSON을 추출 (```json 래핑 제거)
 * @param text - LLM 응답 텍스트
 * @returns 순수 JSON 문자열
 */
const extractJson = (text: string): string => {
  const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(
    text,
  );
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
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
    const responseText = await queryLlm(prompt);
    if (!responseText) {
      return null;
    }

    const parsed = JSON.parse(extractJson(responseText)) as Record<
      string,
      unknown
    >;
    const agentName = parsed.agentName;

    if (
      typeof agentName === 'string' &&
      agentName in AGENT_SCOPES
    ) {
      return agentName;
    }

    console.warn(
      `[router] LLM이 유효하지 않은 에이전트 반환: ${responseText}`,
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
    '- parallel: 여러 에이전트가 독립적으로 동시 작업',
    '',
    '## 표준 패턴',
    '- 인사/공지/전체 메시지 (예: "좋은 아침", "공지합니다") → parallel: 모든 에이전트 (pm, designer, frontend, backend, researcher, secops)',
    '- 코드 리뷰 → parallel: frontend + backend',
    '- API + UI 동시 → parallel: backend + frontend',
    '- 의존성 있는 작업 (예: 디자인 후 구현) → single: 가장 먼저 할 에이전트 (에이전트가 응답에서 @mention으로 다음 에이전트에 위임)',
    '',
    '## 규칙',
    '- JSON으로만 응답',
    '- single이면: {"execution":"single","firstStep":{"agents":["에이전트"],"execution":"single"},"intent":"설명"}',
    '- parallel이면: {"execution":"parallel","firstStep":{"agents":["에이전트1","에이전트2"],"execution":"parallel"},"intent":"설명"}',
  ].join('\n');

  try {
    const responseText = await queryLlm(prompt);
    if (!responseText) {
      return null;
    }

    const parsed = JSON.parse(extractJson(responseText)) as Record<
      string,
      unknown
    >;

    // 유효성 검증
    const execution = parsed.execution as string | undefined;
    const validExecutions = ['single', 'parallel'];
    if (!execution || !validExecutions.includes(execution)) {
      console.warn(
        `[router] LLM이 유효하지 않은 실행 모드 반환: ${parsed.execution}`,
      );
      return null;
    }

    const firstStep = parsed.firstStep as
      | Record<string, unknown>
      | undefined;
    const rawAgents = firstStep?.agents;
    if (!Array.isArray(rawAgents)) {
      console.warn(
        `[router] LLM이 유효하지 않은 에이전트 형식 반환: ${responseText}`,
      );
      return null;
    }

    const validAgents = rawAgents.filter(
      (a): a is string =>
        typeof a === 'string' && a in AGENT_SCOPES,
    );
    if (validAgents.length === 0) {
      console.warn(
        `[router] LLM이 유효하지 않은 에이전트 반환: ${responseText}`,
      );
      return null;
    }

    return {
      agents: validAgents.map(toRoutingAgent),
      execution: execution as ExecutionMode,
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

  // 2순위: 간단한 대화 메시지 → PM 직행 (LLM 분류 건너뜀, 0ms)
  if (CONVERSATIONAL_PATTERN.test(text)) {
    console.log('[router] 대화 메시지 감지 → PM 직행');
    return {
      agents: [toRoutingAgent('pm')],
      execution: 'single',
      method: 'conversational',
    };
  }

  // 3순위: 키워드 매칭 (브로드캐스트 판정보다 먼저 수행)
  const keywordMatches = matchKeywords(text);

  // 3순위: 브로드캐스트 (인사, 공지 → 전체 에이전트 병렬)
  // 단, 업무 키워드가 포함되면 LLM 복합 분류로 위임
  if (BROADCAST_PATTERN.test(text) && keywordMatches.length === 0) {
    console.log('[router] 브로드캐스트 감지 → 전체 에이전트');
    return {
      agents: ALL_AGENT_NAMES.map(toRoutingAgent),
      execution: 'parallel',
      method: 'broadcast',
    };
  }
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
