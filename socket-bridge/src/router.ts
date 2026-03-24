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
 * 키워드 패턴 매칭으로 에이전트 결정
 * @param text - Slack 메시지 텍스트
 * @returns 매칭된 에이전트 이름 또는 null
 */
export const matchKeywords = (text: string): string | null => {
  for (const [agentName, pattern] of Object.entries(ROUTING_RULES)) {
    if (pattern.test(text)) {
      return agentName;
    }
  }
  return null;
};

/**
 * 3단계 라우팅: mention -> keyword -> PM default
 * @param text - Slack 메시지 텍스트
 * @returns 라우팅 결과 (첫 번째 매칭만 반환)
 */
export const routeMessage = (text: string): RoutingResult => {
  // 1순위: @mention
  const mentions = parseMentions(text);
  if (mentions.length > 0) {
    return { agentName: mentions[0], method: 'mention' };
  }

  // 2순위: 키워드 매칭
  const keywordMatch = matchKeywords(text);
  if (keywordMatch) {
    return { agentName: keywordMatch, method: 'keyword' };
  }

  // 3순위: PM 기본값
  return { agentName: 'pm', method: 'default' };
};
