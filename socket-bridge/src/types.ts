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
  /** 스레드 주제 요약 (프리프로세싱 결과) */
  threadTopic?: string;
  /** Slack 원본 이벤트 데이터 */
  raw: Record<string, unknown>;
  /** 디바운스 배치로 병합된 메시지들의 ts 목록 (배치 시에만 존재) */
  batchTs?: string[];
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
export type ExecutionMode = 'single' | 'parallel';

/** 라우팅 방식 */
export type RoutingMethod =
  | 'mention'
  | 'keyword'
  | 'broadcast'
  | 'conversational'
  | 'llm'
  | 'default'
  | 'delegation'
  | 'hub-review';

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
  /** QA 직접 실행 명령어 여부 (runDirectQA() 분기용) */
  isQACommand?: boolean;
  /** QA 명령어에서 파싱된 스펙 파일 경로 */
  specPath?: string;
  /** 검증 계층(Verification Tier) 라우팅 여부 — specPath 없이 회귀 검증 모드 트리거 */
  isQAVerification?: boolean;
}

/** 에이전트별 세션 정보 */
export interface AgentSession {
  /** 에이전트 이름 */
  agentName: string;
  /** 시스템 프롬프트 (persona 파일 내용) */
  systemPrompt: string;
  /** persona 파일 로드 시각 (ms) — 파일 변경 감지용 */
  personaLoadedAt: number;
  /** 스레드별 SDK 세션 ID (thread_ts → sessionId) */
  threadSessions: Map<string, string>;
}
