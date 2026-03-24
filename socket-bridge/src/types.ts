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
