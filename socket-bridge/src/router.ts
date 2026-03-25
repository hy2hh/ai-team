import Anthropic from '@anthropic-ai/sdk';
import type { RoutingResult } from './types.js';

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
const AGENT_SCOPES: Record<string, string> = {
  pm: '기능 요청, 요구사항 정의, 우선순위, 스프린트 관리, 로드맵, GTM',
  designer: 'UI/UX 디자인, 디자인 시스템, 접근성, 프로토타입, 디자인 토큰',
  frontend:
    'React/TS 구현, 컴포넌트, 성능 최적화, 반응형, 상태관리',
  backend:
    'API 설계, DB 아키텍처, 시스템 설계, 인프라, 마이크로서비스',
  researcher: '시장 조사, 경쟁사 분석, 트렌드, 기회 평가, 기술 스카우팅',
  secops: '보안 리뷰, 위협 모델링, 취약점 평가, 인증/인가, 암호화',
};

/** LLM 라우팅용 Anthropic 클라이언트 (lazy init) */
let anthropicClient: Anthropic | null = null;

/** Anthropic 클라이언트 싱글톤 */
const getAnthropicClient = (): Anthropic => {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
};

/** LLM 라우팅 타임아웃 (ms) */
const LLM_ROUTING_TIMEOUT = 5000;

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
  for (const [agentName, pattern] of Object.entries(ROUTING_RULES)) {
    if (pattern.test(text)) {
      matches.push(agentName);
    }
  }
  return matches;
};

/**
 * LLM 기반 의미 분류로 에이전트 결정
 * @param text - Slack 메시지 텍스트
 * @param candidates - 후보 에이전트 목록 (비어있으면 전체 대상)
 * @returns 에이전트 이름 또는 null (타임아웃/실패 시)
 */
const classifyWithLlm = async (
  text: string,
  candidates: string[] = [],
): Promise<string | null> => {
  const scopeEntries = candidates.length > 0
    ? Object.entries(AGENT_SCOPES).filter(([name]) =>
        candidates.includes(name),
      )
    : Object.entries(AGENT_SCOPES);

  const scopeList = scopeEntries
    .map(([name, scope]) => `- ${name}: ${scope}`)
    .join('\n');

  const validNames = scopeEntries.map(([name]) => name).join(', ');

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

    const response = await Promise.race([
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('LLM routing timeout')),
          LLM_ROUTING_TIMEOUT,
        ),
      ),
    ]);

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    const parsed = JSON.parse(content.text) as {
      agentName?: string;
    };
    const agentName = parsed.agentName;

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
 * 3단계 라우팅: mention -> keyword -> LLM -> PM default
 * @param text - Slack 메시지 텍스트
 * @returns 라우팅 결과 (첫 번째 매칭만 반환)
 */
export const routeMessage = async (
  text: string,
): Promise<RoutingResult> => {
  // 1순위: @mention
  const mentions = parseMentions(text);
  if (mentions.length > 0) {
    return { agentName: mentions[0], method: 'mention' };
  }

  // 2순위: 키워드 매칭
  const keywordMatches = matchKeywords(text);
  if (keywordMatches.length === 1) {
    return { agentName: keywordMatches[0], method: 'keyword' };
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
      return { agentName: llmDisambiguated, method: 'keyword' };
    }
    // LLM 실패 시 첫 번째 매칭 사용
    return { agentName: keywordMatches[0], method: 'keyword' };
  }

  // 3순위: LLM 의미 분류 (키워드 매칭 없음)
  const llmMatch = await classifyWithLlm(text);
  if (llmMatch) {
    return { agentName: llmMatch, method: 'llm' };
  }

  // 4순위: PM 기본값
  return { agentName: 'pm', method: 'default' };
};
