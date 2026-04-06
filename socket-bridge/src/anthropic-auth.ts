/**
 * Claude Agent SDK(내부 Claude Code 프로세스)용 Anthropic 인증 모드.
 *
 * - api_key: ANTHROPIC_API_KEY(Console) — 기존 동작
 * - claude_oauth: env의 OAuth 토큰(전역 또는 에이전트별)으로 Claude.ai 요금제
 * - claude_local: 로컬에 `claude login` 된 계정(키체인) 요금제 — env의 전역 OAuth는 자식 프로세스에서 제거
 *
 * 에이전트별 다른 계정: BRIDGE_CLAUDE_OAUTH_TOKEN_PM 등 (역할 대문자)
 *
 * @see https://code.claude.com/docs/en/env-vars — ANTHROPIC_API_KEY가 있으면 구독 인증을 덮어씀
 */

import type { Options, Settings } from '@anthropic-ai/claude-agent-sdk';

/** query() options 중 인증 관련 필드만 */
export type ClaudeSdkAuthQueryOptions = Pick<Options, 'env' | 'settings'>;

export type AnthropicAuthMode = 'api_key' | 'claude_oauth' | 'claude_local';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

const isTruthy = (v: string | undefined): boolean =>
  v !== undefined && TRUTHY.has(v.toLowerCase().trim());

/**
 * BRIDGE_ANTHROPIC_AUTH_MODE:
 * - 미설정 / api_key / console → API 키 모드
 * - claude_oauth / oauth / subscription / claudeai → env OAuth(전역+에이전트별)
 * - claude_local / local → 로컬 Claude Code 로그인(키체인); 전역 OAuth env는 제거, 에이전트별 토큰만 주입 가능
 */
export const getAnthropicAuthMode = (): AnthropicAuthMode => {
  const raw = process.env.BRIDGE_ANTHROPIC_AUTH_MODE?.toLowerCase().trim() ?? '';
  if (raw === 'claude_local' || raw === 'local') {
    return 'claude_local';
  }
  if (
    raw === 'claude_oauth' ||
    raw === 'oauth' ||
    raw === 'subscription' ||
    raw === 'claudeai'
  ) {
    return 'claude_oauth';
  }
  return 'api_key';
};

/**
 * OAuth 모드에서 필수 자격 증명이 있는지 검사. 부족하면 프로세스 종료.
 */
export const validateAnthropicAuthOrExit = (): void => {
  const mode = getAnthropicAuthMode();
  if (mode === 'claude_local') {
    console.log(
      '[startup] Anthropic: claude_local — 로컬 Claude Code 로그인 계정(키체인). 전역 OAuth env는 자식에서 제거됩니다.',
    );
    return;
  }
  if (mode !== 'claude_oauth') return;

  const agentRoles = [
    'PM',
    'DESIGNER',
    'FRONTEND',
    'BACKEND',
    'RESEARCHER',
    'SECOPS',
    'QA',
  ];
  const anyPerAgentToken =
    nonEmpty(process.env.BRIDGE_CLAUDE_OAUTH_TOKEN_INFRA) ||
    agentRoles.some((role) =>
      nonEmpty(process.env[`BRIDGE_CLAUDE_OAUTH_TOKEN_${role}`]),
    );
  const anyPerAgentRefresh =
    (nonEmpty(process.env.BRIDGE_CLAUDE_OAUTH_REFRESH_TOKEN_INFRA) &&
      nonEmpty(process.env.BRIDGE_CLAUDE_OAUTH_SCOPES_INFRA)) ||
    agentRoles.some(
      (role) =>
        nonEmpty(process.env[`BRIDGE_CLAUDE_OAUTH_REFRESH_TOKEN_${role}`]) &&
        nonEmpty(process.env[`BRIDGE_CLAUDE_OAUTH_SCOPES_${role}`]),
    );

  const access =
    nonEmpty(process.env.CLAUDE_CODE_OAUTH_TOKEN) ||
    nonEmpty(process.env.BRIDGE_CLAUDE_OAUTH_TOKEN);
  const refreshPair =
    nonEmpty(process.env.CLAUDE_CODE_OAUTH_REFRESH_TOKEN) &&
    nonEmpty(process.env.CLAUDE_CODE_OAUTH_SCOPES);

  if (access || refreshPair || anyPerAgentToken || anyPerAgentRefresh) {
    console.log(
      '[startup] Anthropic: claude_oauth — 전역/에이전트별 OAuth 토큰 사용, ANTHROPIC_API_KEY는 기본 제거',
    );
    return;
  }

  console.error('[startup] CRITICAL: BRIDGE_ANTHROPIC_AUTH_MODE=claude_oauth 인데 OAuth 자격이 없습니다.');
  console.error(
    '  다음 중 하나를 설정하세요:',
  );
  console.error('  - CLAUDE_CODE_OAUTH_TOKEN (또는 BRIDGE_CLAUDE_OAUTH_TOKEN)');
  console.error(
    '  - 또는 CLAUDE_CODE_OAUTH_REFRESH_TOKEN + CLAUDE_CODE_OAUTH_SCOPES',
  );
  process.exit(1);
};

const nonEmpty = (s: string | undefined): boolean =>
  s !== undefined && s.trim() !== '';

/** 에이전트 역할 pm → PM */
const agentRoleUpper = (agentName: string | undefined): string =>
  agentName ? agentName.toUpperCase() : '';

/**
 * 자식 프로세스 env에서 전역 OAuth 관련 키 제거(로컬 키체인 우선).
 */
const stripGlobalOAuthFromEnv = (env: Record<string, string | undefined>): void => {
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.BRIDGE_CLAUDE_OAUTH_TOKEN;
  delete env.CLAUDE_CODE_OAUTH_REFRESH_TOKEN;
  delete env.CLAUDE_CODE_OAUTH_SCOPES;
  delete env.BRIDGE_CLAUDE_OAUTH_REFRESH_TOKEN;
  delete env.BRIDGE_CLAUDE_OAUTH_SCOPES;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.BRIDGE_ANTHROPIC_AUTH_TOKEN;
};

/**
 * BRIDGE_CLAUDE_OAUTH_TOKEN_<ROLE> 등 에이전트별 값을 공식 env 키에 반영(덮어쓰기).
 * agentName 없음 → 라우터/압축 등: BRIDGE_CLAUDE_OAUTH_TOKEN_INFRA
 */
const applyPerAgentOAuthFromProcessEnv = (
  env: Record<string, string | undefined>,
  agentName: string | undefined,
): void => {
  const role = agentRoleUpper(agentName);
  if (!role) {
    const infraTok = process.env.BRIDGE_CLAUDE_OAUTH_TOKEN_INFRA;
    if (nonEmpty(infraTok)) env.CLAUDE_CODE_OAUTH_TOKEN = infraTok;
    const infraRt = process.env.BRIDGE_CLAUDE_OAUTH_REFRESH_TOKEN_INFRA;
    if (nonEmpty(infraRt)) env.CLAUDE_CODE_OAUTH_REFRESH_TOKEN = infraRt;
    const infraSc = process.env.BRIDGE_CLAUDE_OAUTH_SCOPES_INFRA;
    if (nonEmpty(infraSc)) env.CLAUDE_CODE_OAUTH_SCOPES = infraSc;
    const infraBearer = process.env.BRIDGE_ANTHROPIC_AUTH_TOKEN_INFRA;
    if (nonEmpty(infraBearer)) env.ANTHROPIC_AUTH_TOKEN = infraBearer;
    return;
  }

  const token = process.env[`BRIDGE_CLAUDE_OAUTH_TOKEN_${role}`];
  if (nonEmpty(token)) env.CLAUDE_CODE_OAUTH_TOKEN = token;

  const rt = process.env[`BRIDGE_CLAUDE_OAUTH_REFRESH_TOKEN_${role}`];
  if (nonEmpty(rt)) env.CLAUDE_CODE_OAUTH_REFRESH_TOKEN = rt;

  const sc = process.env[`BRIDGE_CLAUDE_OAUTH_SCOPES_${role}`];
  if (nonEmpty(sc)) env.CLAUDE_CODE_OAUTH_SCOPES = sc;

  const bearer = process.env[`BRIDGE_ANTHROPIC_AUTH_TOKEN_${role}`];
  if (nonEmpty(bearer)) env.ANTHROPIC_AUTH_TOKEN = bearer;
};

/**
 * Claude Code 자식 프로세스에 넘길 env.
 * 구독 경로에서는 ANTHROPIC_API_KEY를 제거해 요금제(또는 OAuth)가 적용되도록 함.
 *
 * @param agentName - Slack 에이전트 이름 (pm, designer, …). 라우터·압축 등 비에이전트 호출은 생략.
 */
export const buildClaudeCodeProcessEnv = (
  agentName?: string,
): Record<string, string | undefined> => {
  const env: Record<string, string | undefined> = { ...process.env };
  const mode = getAnthropicAuthMode();

  if (mode === 'api_key') {
    return env;
  }

  // 구독/OAuth 경로: API 키 제거(문서상 구독 덮어씀). 예외: BRIDGE_OAUTH_KEEP_API_KEY=1
  if (!isTruthy(process.env.BRIDGE_OAUTH_KEEP_API_KEY)) {
    delete env.ANTHROPIC_API_KEY;
  }

  if (mode === 'claude_local') {
    stripGlobalOAuthFromEnv(env);
    applyPerAgentOAuthFromProcessEnv(env, agentName);
    return env;
  }

  // claude_oauth: 전역 별칭 후 에이전트별로 덮어쓰기
  if (nonEmpty(process.env.BRIDGE_CLAUDE_OAUTH_TOKEN)) {
    env.CLAUDE_CODE_OAUTH_TOKEN = process.env.BRIDGE_CLAUDE_OAUTH_TOKEN;
  }
  if (nonEmpty(process.env.BRIDGE_CLAUDE_OAUTH_REFRESH_TOKEN)) {
    env.CLAUDE_CODE_OAUTH_REFRESH_TOKEN =
      process.env.BRIDGE_CLAUDE_OAUTH_REFRESH_TOKEN;
  }
  if (nonEmpty(process.env.BRIDGE_CLAUDE_OAUTH_SCOPES)) {
    env.CLAUDE_CODE_OAUTH_SCOPES = process.env.BRIDGE_CLAUDE_OAUTH_SCOPES;
  }
  if (nonEmpty(process.env.BRIDGE_ANTHROPIC_AUTH_TOKEN)) {
    env.ANTHROPIC_AUTH_TOKEN = process.env.BRIDGE_ANTHROPIC_AUTH_TOKEN;
  }

  applyPerAgentOAuthFromProcessEnv(env, agentName);
  return env;
};

/**
 * OAuth(Claude.ai) 로그인 방식을 SDK settings에 반영.
 * api_key 모드에서는 undefined.
 */
export const getClaudeSdkOAuthSettings = (
  agentName?: string,
): Settings | undefined => {
  const mode = getAnthropicAuthMode();
  if (mode !== 'claude_oauth' && mode !== 'claude_local') return undefined;

  const role = agentRoleUpper(agentName);
  const orgFromAgent =
    role && nonEmpty(process.env[`BRIDGE_FORCE_LOGIN_ORG_UUID_${role}`])
      ? process.env[`BRIDGE_FORCE_LOGIN_ORG_UUID_${role}`]!.trim()
      : undefined;

  const orgUuid =
    orgFromAgent ||
    process.env.BRIDGE_FORCE_LOGIN_ORG_UUID?.trim() ||
    process.env.CLAUDE_CODE_FORCE_LOGIN_ORG_UUID?.trim();

  const s: Settings = {
    forceLoginMethod: 'claudeai',
  };
  if (orgUuid) s.forceLoginOrgUUID = orgUuid;
  return s;
};

/**
 * 모든 `query({ options })` 호출에 spread: `...getClaudeSdkQueryAuthOptions(agentName?)`
 * 에이전트 런타임에서는 반드시 agentName(pm, designer, …)을 넘깁니다.
 */
export const getClaudeSdkQueryAuthOptions = (
  agentName?: string,
): ClaudeSdkAuthQueryOptions => {
  const env = buildClaudeCodeProcessEnv(agentName);
  const settings = getClaudeSdkOAuthSettings(agentName);
  if (!settings) return { env };
  return { env, settings };
};
