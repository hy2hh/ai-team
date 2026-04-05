/**
 * Model Select Module
 *
 * 사용자가 모델 변경 의도를 표현하면 Slack Block Kit으로
 * Opus / Sonnet / Haiku 선택 버튼을 표시하고 응답을 대기한다.
 *
 * 흐름:
 * 1. 메시지에서 모델 변경 키워드 감지
 * 2. Block Kit 버튼 (Opus / Sonnet / Haiku / 취소) 전송
 * 3. 사용자 클릭 → resolveModelSelect() 호출
 * 4. 선택된 tier로 에이전트 실행
 */

import type { App } from '@slack/bolt';

/** 모델 tier 타입 */
export type ModelTier = 'high' | 'standard' | 'fast';

/** 대기 중인 모델 선택 */
interface PendingModelSelect {
  resolve: (tier: ModelTier | null) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/** 대기 중인 모델 선택 Map: `${channel}:${threadTs}` → PendingModelSelect */
const pendingModelSelects = new Map<string, PendingModelSelect>();

/** 모델 선택 타임아웃 (3분) */
const MODEL_SELECT_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * 모델 변경 의도 감지 패턴
 *
 * false positive를 최소화하기 위해 좁게 설정:
 * - "opus", "haiku" 단독 언급
 * - "모델 변경", "모델 바꿔", "모델 선택"
 * - "claude opus/sonnet/haiku"
 * - "opus/haiku로", "opus/haiku 써줘", "opus 사용"
 * - "tier high", "tier=fast", "tier standard" 등 tier 직접 지정
 */
const MODEL_SELECT_PATTERN =
  /(?:모델\s*(?:변경|바꿔|바꾸|선택|골라|골라줘|바꿔줘))|(?:claude[\s-]?(?:opus|sonnet|haiku))|(?:(?:opus|haiku|sonnet)\s*(?:로|으로|써줘|사용|쓰고|쓸게|써|씀|사용해줘|사용할게|모델)?(?:\s|$))|(?:(?:고성능|빠른|빠르게|저렴한)\s*모델)|(?:tier[\s=]*(?:high|fast|standard|opus|haiku|sonnet))/i;

/**
 * 메시지 텍스트에서 모델 변경 의도를 감지한다
 *
 * @param text - Slack 메시지 텍스트
 * @returns 모델 변경 의도 여부
 */
export const detectModelSelectRequest = (text: string): boolean =>
  MODEL_SELECT_PATTERN.test(text);

/**
 * 메시지 텍스트에서 명시된 모델 tier를 직접 추출한다
 *
 * "opus로 작업해줘", "haiku 써줘", "claude sonnet" 등에서 tier를 직접 파싱.
 * 모델이 명시되지 않은 경우(e.g. "모델 바꿔줘") null 반환 → Block Kit UI 필요.
 *
 * @param text - Slack 메시지 텍스트
 * @returns 명시된 ModelTier, 또는 null (명시 없음)
 */
export const extractModelTierFromText = (text: string): ModelTier | null => {
  const lower = text.toLowerCase();
  // opus 명시
  if (/(?:claude[\s-]?opus|opus\s*(?:로|으로|써줘|사용|쓰고|쓸게|써|씀|사용해줘|사용할게|모델)?(?:\s|$))/i.test(lower)) {
    return 'high';
  }
  // haiku 명시
  if (/(?:claude[\s-]?haiku|haiku\s*(?:로|으로|써줘|사용|쓰고|쓸게|써|씀|사용해줘|사용할게|모델)?(?:\s|$))/i.test(lower)) {
    return 'fast';
  }
  // sonnet 명시
  if (/(?:claude[\s-]?sonnet|sonnet\s*(?:로|으로|써줘|사용|쓰고|쓸게|써|씀|사용해줘|사용할게|모델)?(?:\s|$))/i.test(lower)) {
    return 'standard';
  }
  // 고성능 → opus
  if (/고성능\s*모델/i.test(lower)) {
    return 'high';
  }
  // 빠른/저렴 → haiku
  if (/(?:빠른|빠르게|저렴한)\s*모델/i.test(lower)) {
    return 'fast';
  }
  // tier 직접 지정: tier=high, tier high, tier opus 등
  if (/tier[\s=]*(?:high|opus)/i.test(lower)) {
    return 'high';
  }
  if (/tier[\s=]*(?:fast|haiku)/i.test(lower)) {
    return 'fast';
  }
  if (/tier[\s=]*(?:standard|sonnet)/i.test(lower)) {
    return 'standard';
  }
  // 명시 없음 (e.g. "모델 변경", "모델 바꿔줘") → null
  return null;
};

/**
 * 대기 키 생성
 */
const makeKey = (channel: string, threadTs: string): string =>
  `${channel}:${threadTs}`;

/**
 * Block Kit 모델 선택 버튼을 Slack에 전송하고 사용자 선택 대기
 *
 * @param slackApp - 메시지 전송용 Slack Bolt App
 * @param channel - 채널 ID
 * @param threadTs - 스레드 timestamp
 * @returns 선택된 ModelTier, 취소/타임아웃 시 null
 */
export const postModelSelectMessage = async (
  slackApp: App,
  channel: string,
  threadTs: string,
): Promise<ModelTier | null> => {
  const key = makeKey(channel, threadTs);

  const selectedPromise = new Promise<ModelTier | null>((resolve) => {
    const timeoutId = setTimeout(() => {
      pendingModelSelects.delete(key);
      console.log(`[model-select] 타임아웃: ${key}`);
      resolve(null);
    }, MODEL_SELECT_TIMEOUT_MS);

    pendingModelSelects.set(key, { resolve, timeoutId });
  });

  await slackApp.client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: '사용할 모델을 선택해주세요: Opus / Sonnet / Haiku',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*🤖 어떤 모델을 사용할까요?*',
            '',
            '*`Opus`* — 복잡한 추론, 회의, 계획 (고성능, 느림)',
            '*`Sonnet`* — 일반 작업 기본값 (균형, 권장)',
            '*`Haiku`* — 빠른 분류, 요약, 경량 작업 (빠름, 저비용)',
          ].join('\n'),
        },
      },
      {
        type: 'actions',
        block_id: `model_select_${threadTs}`,
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🧠 Opus', emoji: true },
            style: 'primary',
            action_id: 'model_select_opus',
            value: key,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '⚡ Sonnet', emoji: true },
            action_id: 'model_select_sonnet',
            value: key,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🚀 Haiku', emoji: true },
            action_id: 'model_select_haiku',
            value: key,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '✖ 취소', emoji: true },
            style: 'danger',
            action_id: 'model_select_cancel',
            value: key,
          },
        ],
      },
    ],
  });

  return selectedPromise;
};

/**
 * 버튼 클릭 이벤트를 수신해 대기 중인 모델 선택을 해결한다
 *
 * @param key - `${channel}:${threadTs}` 형태의 대기 키
 * @param tier - 선택된 ModelTier, 취소 시 null
 * @returns 대기 중인 요청이 존재했으면 true
 */
export const resolveModelSelect = (
  key: string,
  tier: ModelTier | null,
): boolean => {
  const pending = pendingModelSelects.get(key);
  if (!pending) {
    console.warn(`[model-select] 알 수 없는 key: ${key}`);
    return false;
  }
  clearTimeout(pending.timeoutId);
  pendingModelSelects.delete(key);
  const label = tier ?? '취소';
  console.log(`[model-select] 선택 완료: ${key} → ${label}`);
  pending.resolve(tier);
  return true;
};
