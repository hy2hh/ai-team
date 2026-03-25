/** Slack 이벤트를 파일로 기록할 때 사용하는 구조체 */
export interface SlackEvent {
  /** 이벤트 유형 (message, app_mention 등) */
  type: string;
  /** 채널 ID */
  channel: string;
  /** 채널 이름 (캐시된 값) */
  channel_name: string;
  /** 발신자 user ID */
  user: string;
  /** 메시지 본문 */
  text: string;
  /** 메시지 타임스탬프 */
  ts: string;
  /** 스레드 부모 타임스탬프 (스레드가 아니면 null) */
  thread_ts: string | null;
  /** 멘션된 에이전트 목록 */
  mentions: string[];
  /** Slack 원본 이벤트 데이터 */
  raw: Record<string, unknown>;
}

/** 에이전트 설정 */
export interface AgentConfig {
  /** 에이전트 이름 */
  name: string;
  /** Slack Bot Token (xoxb-) */
  botToken: string;
  /** Slack App-Level Token (xapp-) */
  appToken: string;
  /** Slack Bot User ID (런타임에 채워짐) */
  botUserId?: string;
}

/** 실행 모드 */
export type ExecutionMode = 'single' | 'parallel' | 'sequential';

/** 라우팅 방식 */
export type RoutingMethod =
  | 'mention'
  | 'keyword'
  | 'llm'
  | 'default';

/** 라우팅 대상 에이전트 */
export interface RoutingAgent {
  /** 에이전트 이름 */
  name: string;
  /** 에이전트 역할 설명 */
  role: string;
}

/** 라우팅 결과 (확장) */
export interface RoutingResult {
  /** 라우팅 대상 에이전트 목록 */
  agents: RoutingAgent[];
  /** 실행 모드 */
  execution: ExecutionMode;
  /** 라우팅 방식 */
  method: RoutingMethod;
}

/** 순차 체인의 개별 단계 */
export interface ChainStep {
  /** 이 단계에 참여하는 에이전트 */
  agents: string[];
  /** 단계 내 실행 모드 (single 또는 parallel) */
  execution: 'single' | 'parallel';
  /** 단계 상태 */
  status: 'pending' | 'in_progress' | 'completed';
  /** 에이전트 작업 결과 요약 */
  result?: string;
}

/** 순차 체인 전체 상태 */
export interface ChainState {
  /** 체인 고유 ID */
  chainId: string;
  /** 원본 사용자 요청 */
  originalRequest: string;
  /** 체인 단계 목록 */
  steps: ChainStep[];
  /** 현재 실행 중인 단계 인덱스 */
  currentStep: number;
  /** 체인 전체 상태 */
  status: 'in_progress' | 'completed' | 'failed';
}

/** 에이전트별 세션 정보 */
export interface AgentSession {
  /** 에이전트 이름 */
  agentName: string;
  /** 시스템 프롬프트 (persona 파일 내용) */
  systemPrompt: string;
  /** SDK 세션 ID (resume용) */
  sessionId?: string;
}
