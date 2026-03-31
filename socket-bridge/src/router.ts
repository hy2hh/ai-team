import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type {
  ExecutionMode,
  RoutingAgent,
  RoutingResult,
} from './types.js';

/** QA 직접 실행 명령어 패턴 */
const QA_COMMAND_PATTERN =
  /(?:QA|qa)\s*(?:실행|검증|run)\s+(docs\/specs\/[^\s]+\.md)/i;

/**
 * QA 실행 명령어 파싱
 *
 * "QA 실행 docs/specs/xxx.md", "qa run docs/specs/xxx.md",
 * "QA 검증 docs/specs/xxx.md" 형태를 감지하고 specPath를 추출한다.
 *
 * @param text - Slack 메시지 텍스트
 * @returns 파싱 결과 — isQACommand: 명령어 여부, specPath: 경로 (없으면 undefined)
 */
export const parseQACommand = (
  text: string,
): { isQACommand: boolean; specPath?: string } => {
  const match = QA_COMMAND_PATTERN.exec(text);
  if (match) {
    return { isQACommand: true, specPath: match[1] };
  }
  return { isQACommand: false };
};

/** 텍스트에서 docs/specs/*.md 경로를 추출 (QA 명령어 외 일반 텍스트에서도 사용) */
const SPEC_PATH_EXTRACT_PATTERN = /docs\/specs\/[^\s\])"']+\.md/i;

/**
 * 텍스트에서 Feature Spec 경로를 추출
 *
 * "QA 실행" 명령어 외에도 일반 위임 텍스트에 포함된
 * docs/specs/*.md 경로를 파싱할 때 사용한다.
 *
 * @param text - 파싱할 텍스트
 * @returns specPath (없으면 undefined)
 */
export const extractSpecPath = (text: string): string | undefined => {
  const match = SPEC_PATH_EXTRACT_PATTERN.exec(text);
  return match ? match[0] : undefined;
};

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
  'qa',
];

/** 키워드 기반 라우팅 규칙 */
const ROUTING_RULES: Record<string, RegExp> = {
  backend: /API|서버|DB|데이터베이스|엔드포인트|배포|인프라/i,
  frontend: /UI|컴포넌트|CSS|페이지|화면|레이아웃|React/i,
  designer: /디자인|UX|피그마|목업|와이어프레임|색상/i,
  pm: /기획|로드맵|스프린트|우선순위|PRD|일정|요구사항|계획/i,
  researcher: /조사|트렌드|경쟁사|시장 분석/i,
  secops: /보안|인증|권한|취약점|SSL|토큰|암호화/i,
  qa: /QA|품질|검증|테스트|리뷰|검수|완료.*확인|완료.*조건/i,
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
  qa: '독립 품질 검증, 산출물 리뷰, 완료 조건 체크, 증거 기반 검수, 완료 판정',
};

/** JSON 스키마 검증 — classifyWithLlm 응답 */
const ClassifyWithLlmSchema = z.object({
  agentName: z.string(),
});

/** JSON 스키마 검증 — classifyComplexTask 응답 */
const ClassifyComplexTaskSchema = z.object({
  execution: z.enum(['single', 'parallel']),
  firstStep: z.object({
    agents: z.array(z.string()),
    execution: z.enum(['single', 'parallel']),
  }),
  intent: z.string().optional(),
});

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

/** 에이전트 display name → role name 매핑 (대소문자 무관 매칭용) */
const DISPLAY_NAME_TO_AGENT: Record<string, string> = {
  marge: 'pm',
  krusty: 'designer',
  bart: 'frontend',
  homer: 'backend',
  lisa: 'researcher',
  wiggum: 'secops',
  chalmers: 'qa',
};

/**
 * 메시지 텍스트에서 명시적 <@USER_ID> 멘션만 추출 (hub-review 루프용)
 *
 * hub-review 루프에서 PM 응답 파싱 시 사용 — 일반 텍스트 display name은
 * 오감지(false positive)를 유발하므로 Slack 공식 <@USER_ID> 형식만 인정.
 * @param text - Slack 메시지 텍스트
 * @returns 멘션된 에이전트 이름 배열 (중복 제거)
 */
export const parseExplicitMentions = (
  text: string,
): string[] => {
  const mentions = new Set<string>();
  const mentionPattern = /<@(U[A-Z0-9]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(text)) !== null) {
    const userId = match[1];
    const agentName = botUserIdToAgent.get(userId);
    if (agentName) {
      mentions.add(agentName);
    }
  }
  return Array.from(mentions);
};

/**
 * 메시지 텍스트에서 멘션된 에이전트 목록 추출
 *
 * 2단계 감지:
 * 1. Slack 형식 <@USER_ID> 패턴
 * 2. Display name 폴백 (@Krusty 등)
 * @param text - Slack 메시지 텍스트
 * @returns 멘션된 에이전트 이름 배열 (중복 제거)
 */
export const parseMentions = (text: string): string[] => {
  const mentions = new Set<string>();

  // 1단계: Slack <@USER_ID> 형식
  const mentionPattern = /<@(U[A-Z0-9]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(text)) !== null) {
    const userId = match[1];
    const agentName = botUserIdToAgent.get(userId);
    if (agentName) {
      mentions.add(agentName);
    }
  }

  // 2단계: Display name 폴백 (@Krusty 등) — @ 접두사 필수
  if (mentions.size === 0) {
    const lowerText = text.toLowerCase();
    for (const [displayName, agentName] of Object.entries(
      DISPLAY_NAME_TO_AGENT,
    )) {
      if (lowerText.includes(`@${displayName}`)) {
        mentions.add(agentName);
      }
    }
  }

  // Stage 3 (@ 없는 bare display name 폴백) 제거:
  // "homer", "lisa" 같은 단어가 메시지에 포함될 때 false positive 과다 발생.
  // 명시적 <@USER_ID> 또는 @displayName 형식만 멘션으로 인정.

  return Array.from(mentions);
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

    const jsonText = extractJson(responseText);
    const parsed = JSON.parse(jsonText);

    // 스키마 검증
    const validated = ClassifyWithLlmSchema.parse(parsed);
    const agentName = validated.agentName;

    // agentName이 유효한 에이전트인지 확인
    if (agentName in AGENT_SCOPES) {
      return agentName;
    }

    console.warn(
      `[router] LLM이 유효하지 않은 에이전트 반환: agentName=${agentName}`,
    );
    return null;
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.warn('[router] LLM 응답이 스키마와 맞지 않음');
    } else if (err instanceof SyntaxError) {
      console.warn('[router] LLM 응답이 유효하지 않은 JSON');
    } else {
      console.warn('[router] LLM 라우팅 실패');
    }
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
    '- 코드 리뷰 → parallel: frontend + backend',
    '- API + UI 동시 작업 → parallel: backend + frontend',
    '- 의존성 있는 작업 (예: 디자인 후 구현) → single: PM (PM이 @mention으로 순차 위임)',
    '- 계획 수립/킥오프/로드맵/구현 전략 → single: PM (PM이 계획 후 필요한 에이전트에 위임)',
    '- 특정 도메인 질문 → single: 해당 에이전트 1명',
    '- 모호하거나 판단하기 어려운 경우 → single: PM',
    '',
    '## 핵심 원칙',
    '- parallel은 각 에이전트가 독립적으로 동시 작업할 때만 사용. 불확실하면 single PM.',
    '- 여러 도메인에 걸치는 업무 요청은 PM single로 시작 — PM이 위임 체인으로 분배',
    '- 인사/공지/상태확인 등 비업무 메시지는 이 단계 이전에 이미 처리됨. 여기서는 업무 메시지만 분류.',
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

    const jsonText = extractJson(responseText);
    const parsed = JSON.parse(jsonText);

    // 스키마 검증
    const validated = ClassifyComplexTaskSchema.parse(parsed);

    // 에이전트 필터링 (유효한 이름만 사용)
    const validAgents = validated.firstStep.agents.filter(
      (a): a is string => typeof a === 'string' && a in AGENT_SCOPES,
    );

    if (validAgents.length === 0) {
      console.warn(
        `[router] LLM이 유효한 에이전트를 반환하지 않음: ${responseText}`,
      );
      return null;
    }

    return {
      agents: validAgents.map(toRoutingAgent),
      execution: validated.execution as ExecutionMode,
      method: 'llm',
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.warn('[router] LLM 응답이 스키마와 맞지 않음');
    } else if (err instanceof SyntaxError) {
      console.warn('[router] LLM 응답이 유효하지 않은 JSON');
    } else {
      console.warn('[router] LLM 복합 라우팅 실패');
    }
    return null;
  }
};

/**
 * 4단계 라우팅: mention -> keyword -> LLM(complex) -> PM default
 * @param text - Slack 메시지 텍스트
 * @param threadParticipants - 스레드에 참여한 에이전트 이름 목록 (스레드 메시지일 때만 전달)
 *   전달 시 브로드캐스트 억제 + 라우팅 결과를 참여자로 제한
 * @returns 라우팅 결과 (에이전트 목록 + 실행 모드)
 */
export const routeMessage = async (
  text: string,
  threadParticipants?: string[],
): Promise<RoutingResult> => {
  const routeStart = Date.now();
  const isInThread =
    threadParticipants !== undefined &&
    threadParticipants.length > 0;

  /**
   * 스레드 컨텍스트일 때 에이전트 목록을 참여자로 제한.
   * 매칭되는 참여자가 없으면 PM fallback.
   */
  const restrictToThread = (agents: string[]): string[] => {
    if (!isInThread) return agents;
    const filtered = agents.filter((a) =>
      threadParticipants!.includes(a),
    );
    return filtered.length > 0 ? filtered : ['pm'];
  };

  // 0순위: QA 직접 실행 명령어 — 모든 다른 라우팅보다 우선
  const qaCmd = parseQACommand(text);
  if (qaCmd.isQACommand) {
    console.log(
      `[perf] stage=qa-command specPath=${qaCmd.specPath ?? '(none)'} elapsed=${Date.now() - routeStart}ms`,
    );
    return {
      agents: [toRoutingAgent('qa')],
      execution: 'single',
      method: 'keyword',
      isQACommand: true,
      specPath: qaCmd.specPath,
    };
  }

  // 1순위: @mention — 스레드 제한 없이 명시적 멘션은 항상 우선
  const mentions = parseMentions(text);
  if (mentions.length > 0) {
    console.log(
      `[perf] stage=mention elapsed=${Date.now() - routeStart}ms`,
    );
    return {
      agents: mentions.map(toRoutingAgent),
      execution: mentions.length > 1 ? 'parallel' : 'single',
      method: 'mention',
    };
  }

  // 2순위: 간단한 대화 메시지 → PM 직행 (LLM 분류 건너뜀, 0ms)
  if (CONVERSATIONAL_PATTERN.test(text)) {
    console.log(
      `[perf] stage=conversational elapsed=${Date.now() - routeStart}ms`,
    );
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
  // 스레드에서는 전체 브로드캐스트 억제 → 참여자에게만 전달
  if (BROADCAST_PATTERN.test(text) && keywordMatches.length === 0) {
    if (isInThread) {
      const agents = threadParticipants!;
      console.log(
        `[perf] stage=broadcast(thread-restricted) participants=[${agents.join(',')}] elapsed=${Date.now() - routeStart}ms`,
      );
      return {
        agents: agents.map(toRoutingAgent),
        execution: agents.length > 1 ? 'parallel' : 'single',
        method: 'broadcast',
      };
    }
    console.log(
      `[perf] stage=broadcast elapsed=${Date.now() - routeStart}ms`,
    );
    return {
      agents: ALL_AGENT_NAMES.map(toRoutingAgent),
      execution: 'parallel',
      method: 'broadcast',
    };
  }
  if (keywordMatches.length === 1) {
    const candidates = restrictToThread([keywordMatches[0]]);
    console.log(
      `[perf] stage=keyword agent=${candidates[0]} elapsed=${Date.now() - routeStart}ms`,
    );
    return {
      agents: candidates.map(toRoutingAgent),
      execution: 'single',
      method: 'keyword',
    };
  }

  // 복수 키워드 매칭 → classifyComplexTask로 위임 (PM 라우팅 포함)
  // 여러 도메인에 걸치는 요청은 PM이 계획 후 위임해야 하므로
  // 단순 후보 1개 선택(classifyWithLlm)이 아닌 복합 분류 사용
  if (keywordMatches.length > 1) {
    console.log(
      `[router] 복수 키워드 매칭: [${keywordMatches.join(', ')}] → classifyComplexTask`,
    );
    const llmStart = Date.now();
    const complexResult = await classifyComplexTask(text);
    console.log(
      `[perf] stage=keyword+complex elapsed=${Date.now() - routeStart}ms llm=${Date.now() - llmStart}ms`,
    );
    if (complexResult) {
      if (isInThread) {
        const filteredAgents = restrictToThread(
          complexResult.agents.map((a) => a.name),
        );
        return {
          agents: filteredAgents.map(toRoutingAgent),
          execution:
            filteredAgents.length > 1 ? 'parallel' : 'single',
          method: complexResult.method,
        };
      }
      return complexResult;
    }
    // LLM 실패 시 PM fallback (복수 도메인이므로 PM이 조율)
    return {
      agents: [toRoutingAgent('pm')],
      execution: 'single',
      method: 'keyword',
    };
  }

  // 3순위: LLM 복합 태스크 감지 (실행 모드 + 에이전트 결정)
  const llmStart = Date.now();
  const complexResult = await classifyComplexTask(text);
  console.log(
    `[perf] stage=llm-complex elapsed=${Date.now() - routeStart}ms llm=${Date.now() - llmStart}ms`,
  );
  if (complexResult) {
    if (isInThread) {
      // 스레드에서는 LLM 결과도 참여자로 제한
      const filteredAgents = restrictToThread(
        complexResult.agents.map((a) => a.name),
      );
      return {
        agents: filteredAgents.map(toRoutingAgent),
        execution:
          filteredAgents.length > 1 ? 'parallel' : 'single',
        method: complexResult.method,
      };
    }
    return complexResult;
  }

  // 4순위: PM 기본값
  console.log(
    `[perf] stage=default elapsed=${Date.now() - routeStart}ms`,
  );
  return {
    agents: [toRoutingAgent('pm')],
    execution: 'single',
    method: 'default',
  };
};
