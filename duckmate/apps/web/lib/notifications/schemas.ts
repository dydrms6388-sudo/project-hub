// =============================================================================
// D7 · 알림 입력 스키마 + 공용 타입
// actions.ts 는 "use server" 파일이라 async 함수 외 export 불가 → 스키마는 여기
// (D2 의 lib/auth/schemas.ts 와 동일 패턴).
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Web Push 구독 (PushSubscription.toJSON() 결과)
// push_tokens.token 에는 이 JSON 을 문자열 그대로 저장한다 —
// Edge Function(push-dispatch)이 endpoint/keys 를 파싱해 발송.
// ---------------------------------------------------------------------------
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionSchema>;

export const registerPushTokenSchema = z.object({
  subscription: pushSubscriptionSchema,
});
export type RegisterPushTokenInput = z.input<typeof registerPushTokenSchema>;

export const unregisterPushTokenSchema = z.object({
  endpoint: z.string().url().max(2048),
});
export type UnregisterPushTokenInput = z.input<typeof unregisterPushTokenSchema>;

// ---------------------------------------------------------------------------
// 알림 설정 (notification_prefs — 자기 행 upsert)
//   · channelDaily / channelReminder 는 광고성 계열 — 실제 발송은
//     marketingConsent 와 AND (00011 pick_* 함수가 판정)
//   · channelEvent 는 기능성(매칭/메시지/좋아요). 안전·법적 고지(system)는
//     이 토글과 무관하게 발송됨을 E4 화면에 명시할 것 (B1 §6-③ E4 지시)
// ---------------------------------------------------------------------------
export const notificationPrefsSchema = z.object({
  channelDaily: z.boolean(),
  channelEvent: z.boolean(),
  channelReminder: z.boolean(),
  marketingConsent: z.boolean(),
});
export type NotificationPrefsInput = z.input<typeof notificationPrefsSchema>;

export interface NotificationPrefs {
  channelDaily: boolean;
  channelEvent: boolean;
  channelReminder: boolean;
  marketingConsent: boolean;
  /** 동의/철회 시각 (서버 트리거 기록 — 읽기 전용) */
  marketingConsentAt: string | null;
}

/** 행이 아직 없는 유저의 기본값 (광고성 동의는 opt-in 이므로 false) */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  channelDaily: true,
  channelEvent: true,
  channelReminder: true,
  marketingConsent: false,
  marketingConsentAt: null,
};
